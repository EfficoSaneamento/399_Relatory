import json
import os
import re
import sys
from datetime import datetime, timezone
from pathlib import Path

import requests

SERVICE_URL = os.environ.get(
    "ARCGIS_SERVICE_URL",
    "https://services6.arcgis.com/QJAp6nG4ishOkuMg/arcgis/rest/services/service_95186ff112e345eda73abaf81f8b18a7/FeatureServer",
).rstrip("/")
USERNAME = os.environ.get("ARCGIS_USERNAME")
PASSWORD = os.environ.get("ARCGIS_PASSWORD")
LAYER_INDEX = int(os.environ.get("ARCGIS_LAYER_INDEX", "0"))
ROOT = Path(__file__).resolve().parents[1]
DATA_PATH = ROOT / "public" / "data" / "vistorias.json"
ATTACHMENTS_PATH = ROOT / "public" / "attachments"


def fail(message):
    sys.exit(f"Erro: {message}")


def get_token():
    if not USERNAME or not PASSWORD:
        fail("defina ARCGIS_USERNAME e ARCGIS_PASSWORD nos Secrets do GitHub.")
    response = requests.post(
        "https://www.arcgis.com/sharing/rest/generateToken",
        data={"username": USERNAME, "password": PASSWORD, "referer": "https://www.arcgis.com", "expiration": 1440, "f": "json"},
        timeout=30,
    )
    response.raise_for_status()
    data = response.json()
    if "token" not in data:
        fail(f"não foi possível gerar o token ArcGIS: {data}")
    return data["token"]


def request_json(url, token, **params):
    params.update({"f": "json", "token": token})
    response = requests.get(url, params=params, timeout=60)
    response.raise_for_status()
    data = response.json()
    if "error" in data:
        fail(f"ArcGIS retornou {data['error']}")
    return data


def find_value(attributes, candidates):
    normalized = {re.sub(r"[^a-z0-9]", "", key.lower()): value for key, value in attributes.items()}
    for candidate in candidates:
        value = normalized.get(re.sub(r"[^a-z0-9]", "", candidate.lower()))
        if value not in (None, ""):
            return value
    return None


def format_date(value):
    if value in (None, ""):
        return "Data não informada"
    try:
        return datetime.fromtimestamp(float(value) / 1000, timezone.utc).strftime("%d/%m/%Y %H:%M")
    except (TypeError, ValueError, OverflowError):
        return str(value)


def image_fields(attributes):
    return [value for name, value in attributes.items() if re.search(r"foto|imagem|image|anexo", name, re.IGNORECASE) and isinstance(value, str) and value.strip()]


def get_features(token, layer_url, fields):
    features = []
    offset = 0
    while True:
        data = request_json(layer_url + "/query", token, where="1=1", outFields=",".join(fields), returnGeometry="false", resultRecordCount=1000, resultOffset=offset)
        page = data.get("features", [])
        features.extend(page)
        if len(page) < 1000:
            return features
        offset += len(page)


def get_related_features(token, table_url, parent_global_id):
    data = request_json(
        table_url + "/query",
        token,
        where=f"parentglobalid = '{parent_global_id}'",
        outFields="*",
        returnGeometry="false",
    )
    return data.get("features", [])


def main():
    token = get_token()
    layer_url = f"{SERVICE_URL}/{LAYER_INDEX}"
    related_url = f"{SERVICE_URL}/1"
    layer_info = request_json(layer_url, token)
    fields = [field["name"] for field in layer_info.get("fields", [])]
    features = get_features(token, layer_url, fields or ["*"])
    ATTACHMENTS_PATH.mkdir(parents=True, exist_ok=True)
    registros = []

    for index, feature in enumerate(features, start=1):
        attributes = feature.get("attributes", {})
        object_id = find_value(attributes, ["OBJECTID", "objectid"]) or index
        attachment_data = request_json(f"{layer_url}/{object_id}/attachments", token, returnMetadata="true")
        images = []
        attachments = attachment_data.get("attachmentInfos", [])
        for attachment in attachments:
            filename = f"{object_id}_{attachment['id']}_{re.sub(r'[^a-zA-Z0-9._-]', '_', attachment.get('name', 'imagem'))}"
            destination = ATTACHMENTS_PATH / filename
            image_response = requests.get(f"{layer_url}/{object_id}/attachments/{attachment['id']}", params={"token": token}, timeout=60)
            image_response.raise_for_status()
            destination.write_bytes(image_response.content)
            images.append(f"attachments/{filename}")
        for image_url in image_fields(attributes):
            if image_url.startswith(("http://", "https://")):
                image_response = requests.get(image_url, params={"token": token}, timeout=60)
                if image_response.ok and image_response.headers.get("content-type", "").startswith("image/"):
                    filename = f"{object_id}_campo_{len(images) + 1}{Path(image_url.split('?')[0]).suffix or '.jpg'}"
                    (ATTACHMENTS_PATH / filename).write_bytes(image_response.content)
                    images.append(f"attachments/{filename}")
        related_details = []
        parent_global_id = find_value(attributes, ["globalid"])
        if parent_global_id:
            for related_feature in get_related_features(token, related_url, parent_global_id):
                related_attributes = related_feature.get("attributes", {})
                related_details.append({
                    key: value for key, value in related_attributes.items()
                    if key.lower() not in {"objectid", "globalid", "parentglobalid", "creationdate", "creator", "editdate", "editor"}
                    and value not in (None, "")
                })
                related_object_id = find_value(related_attributes, ["OBJECTID", "objectid"])
                if related_object_id:
                    related_attachments = request_json(f"{related_url}/{related_object_id}/attachments", token, returnMetadata="true")
                    for attachment in related_attachments.get("attachmentInfos", []):
                        filename = f"{object_id}_{related_object_id}_{attachment['id']}_{re.sub(r'[^a-zA-Z0-9._-]', '_', attachment.get('name', 'imagem'))}"
                        destination = ATTACHMENTS_PATH / filename
                        image_response = requests.get(f"{related_url}/{related_object_id}/attachments/{attachment['id']}", params={"token": token}, timeout=60)
                        image_response.raise_for_status()
                        destination.write_bytes(image_response.content)
                        images.append(f"attachments/{filename}")
        images = list(dict.fromkeys(images))
        print(f"Registro {object_id}: {len(images)} anexo(s)")

        registros.append({
            "id": object_id,
            "endereco": find_value(attributes, ["endereco", "Endereco", "address"]) or "Endereço não informado",
            "cidade": find_value(attributes, ["cidade", "Cidade", "city"]) or "Cidade não informada",
            "nucleo": find_value(attributes, ["nucleo", "Núcleo", "nucleo_nome"]) or "Núcleo não informado",
            "tipo_imovel": find_value(attributes, ["tipo_imovel", "Tipo_de_imovel", "tipo de imóvel"]) or "Imóvel",
            "data_inspecao": format_date(find_value(attributes, ["data_inspecao", "Data_da_inspecao", "data da inspeção"])),
            "imagens": images,
            "detalhes": related_details,
        })

    DATA_PATH.parent.mkdir(parents=True, exist_ok=True)
    DATA_PATH.write_text(json.dumps({"gerado_em": datetime.now(timezone.utc).isoformat(), "registros": registros}, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"OK: {len(registros)} vistorias exportadas para {DATA_PATH}")


if __name__ == "__main__":
    main()
