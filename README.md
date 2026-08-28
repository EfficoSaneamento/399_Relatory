# 399 Relatory

Aplicação React para consultar vistorias do ArcGIS Feature Service por endereço, cidade ou núcleo, visualizar anexos e baixar um relatório resumido.

## Executar localmente

```bash
npm install
npm run dev
```

Use a URL do Feature Service, por exemplo:

```text
https://services6.arcgis.com/.../FeatureServer
```

O app usa automaticamente a camada `/0`. Como o serviço exige autenticação, informe um token temporário no campo próprio. O token fica somente na memória do navegador e não deve ser commitado.

## Publicar

O workflow em `.github/workflows/export-vistorias.yml` reproduz a lógica do Dash Bonificação: o GitHub Actions usa `ARCGIS_USERNAME` e `ARCGIS_PASSWORD` como Secrets, gera o token, exporta registros e imagens e só então publica o GitHub Pages. O token nunca chega ao navegador.

Cadastre os seguintes Secrets em **Settings > Secrets and variables > Actions**:

```text
ARCGIS_USERNAME
ARCGIS_PASSWORD
```

O workflow pode ser executado manualmente em **Actions > Exportar vistorias ArcGIS > Run workflow**.

No repositório, abra **Settings > Pages** e selecione **GitHub Actions** como origem. O endereço esperado será:

`https://efficosaneamento.github.io/399_Relatory/`

Para produção, prefira uma camada pública somente leitura ou um backend/proxy seguro. Não coloque tokens permanentes no frontend.
