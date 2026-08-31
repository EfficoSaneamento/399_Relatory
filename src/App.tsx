import { useEffect, useState } from 'react'
import './App.css'

type RecordItem = { id: number; address: string; city: string; nucleus: string; propertyType: string; inspectedAt: string; photos: string[]; details: Array<Record<string, unknown>> }
function formatAddress(address: string, number: unknown) {
  const value = String(number ?? '').trim()
  if (!value || address.toLowerCase().endsWith(value.toLowerCase())) return address
  return `${address}, ${value}`
}
const demoRecords: RecordItem[] = [
  { id: 1, address: 'Rua Emiliano Di Cavalcanti, 543', city: 'Franca', nucleus: 'Franca 01', propertyType: 'Territorial', inspectedAt: '29 jun. 2026, 09:48', photos: [], details: [] },
  { id: 2, address: 'Rua Anita Malfati, 670', city: 'Franca', nucleus: 'Franca 01', propertyType: 'Predial', inspectedAt: '29 jun. 2026, 09:27', photos: [], details: [] },
  { id: 3, address: 'Rua José Vicente, 07', city: 'Franca', nucleus: 'Franca 02', propertyType: 'Predial', inspectedAt: '15 jul. 2026, 14:53', photos: [], details: [] },
]

function App() {
  const [search, setSearch] = useState('')
  const [activeFilter, setActiveFilter] = useState('Todos')
  const [selected, setSelected] = useState<RecordItem | null>(demoRecords[0])
  const [records, setRecords] = useState(demoRecords)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('Carregando exportação protegida...')
  const filtered = records.filter((record) => [record.address, record.city, record.nucleus].some((value) => value.toLowerCase().includes(search.toLowerCase())) && (activeFilter === 'Todos' || record.city === activeFilter || record.nucleus === activeFilter))
  const filterOptions = ['Todos', ...Array.from(new Set(records.map((record) => record.city))).sort((a, b) => a.localeCompare(b, 'pt-BR'))]

  async function loadRecords() {
    setLoading(true); setMessage('Carregando registros exportados...')
    try {
      const response = await fetch(`${import.meta.env.BASE_URL}data/vistorias.json`)
      if (!response.ok) throw new Error('arquivo de dados ainda não publicado')
      const data: { registros: Array<{ id: number; endereco: string; numero_imovel?: string; cidade: string; nucleo: string; tipo_imovel: string; data_inspecao: string; imagens: string[]; detalhes?: Array<Record<string, unknown>> }> } = await response.json()
      const mapped = data.registros.map((item) => ({ id: item.id, address: formatAddress(item.endereco, item.numero_imovel), city: item.cidade.trim(), nucleus: item.nucleo.trim(), propertyType: item.tipo_imovel, inspectedAt: item.data_inspecao, photos: item.imagens.map((image) => `${import.meta.env.BASE_URL}${image}`), details: item.detalhes ?? [] }))
      setRecords(mapped); setSelected(mapped[0] ?? null); setMessage(`${mapped.length} vistorias atualizadas pelo GitHub Actions`)
      setActiveFilter((current) => current === 'Todos' || mapped.some((record) => record.city === current) ? current : 'Todos')
    } catch (error) { setMessage(`Não foi possível consultar a camada: ${error instanceof Error ? error.message : 'erro desconhecido'}`) } finally { setLoading(false) }
  }

  useEffect(() => { void loadRecords() }, [])

  async function buildRecordSection(record: RecordItem) {
    const images = await Promise.all(record.photos.map(async (photo) => {
      if (!photo.startsWith('http') && !photo.startsWith('/')) return { src: '', label: photo }
      try {
        const response = await fetch(new URL(photo, window.location.href).href)
        if (!response.ok) throw new Error('imagem não encontrada')
        const blob = await response.blob()
        return { src: await new Promise<string>((resolve) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.readAsDataURL(blob) }), label: 'Imagem da vistoria' }
      } catch { return { src: '', label: 'Não foi possível incorporar esta imagem' } }
    }))
    const photoHtml = images.map((image) => image.src ? `<img src="${image.src}" alt="${image.label}">` : `<div class="missing">${image.label}</div>`).join('')
    const detailHtml = record.details.length ? record.details.flatMap((detail) => Object.entries(detail).map(([key, value]) => `<tr><th>${key.replaceAll('_', ' ')}</th><td>${String(value)}</td></tr>`)).join('') : '<tr><td>Nenhum detalhe complementar registrado.</td></tr>'
    return `<section id="vistoria-${record.id}" class="record-report"><h2>${record.address}</h2><div class="meta"><p>${record.city} · ${record.nucleus}<br>Tipo: ${record.propertyType}<br>Inspeção: ${record.inspectedAt}</p></div><h3>Detalhamento da vistoria</h3><table>${detailHtml}</table><h3>Imagens da vistoria</h3><div class="photos">${photoHtml || '<p>Nenhuma imagem anexada a esta vistoria.</p>'}</div></section>`
  }

  async function downloadReport(recordsToExport: RecordItem[], filename: string) {
    if (!recordsToExport.length) { setMessage('Nenhuma vistoria para exportar.'); return }
    setMessage(`Gerando relatório de ${recordsToExport.length} vistoria(s)...`)
    const sections: string[] = []
    for (const record of recordsToExport) sections.push(await buildRecordSection(record))
    const index = recordsToExport.length > 1 ? `<nav class="report-index"><h2>Índice</h2><ul>${recordsToExport.map((record) => `<li><a href="#vistoria-${record.id}">${record.address}</a></li>`).join('')}</ul></nav>` : ''
    const report = `<html><head><meta charset="utf-8"><title>Relatório de vistoria</title><style>body{font-family:Arial;color:#192b2a;padding:32px;max-width:900px;margin:auto}h1{color:#126b61}p{line-height:1.5}.meta{border-block:1px solid #ccd8d2;padding:16px 0;margin:20px 0}table{width:100%;border-collapse:collapse;margin:18px 0 28px}th,td{border:1px solid #ccd8d2;padding:9px;text-align:left;font-size:13px}th{width:35%;background:#eef3ec;text-transform:capitalize}.photos{display:grid;grid-template-columns:1fr 1fr;gap:12px}img{width:100%;height:220px;object-fit:cover}.missing{height:220px;background:#eef3ec;display:grid;place-items:center;color:#73847d}.report-index ul{columns:2;gap:24px}.record-report+.record-report{margin-top:40px;padding-top:32px;border-top:2px solid #ccd8d2}@media print{button{display:none}.record-report{break-before:page}}</style></head><body><h1>Relatório de vistoria cautelar</h1><p>Gerado em ${new Date().toLocaleDateString('pt-BR')} · ${recordsToExport.length} vistoria${recordsToExport.length > 1 ? 's' : ''}</p>${index}${sections.join('')}</body></html>`
    const link = document.createElement('a'); link.href = URL.createObjectURL(new Blob([report], { type: 'text/html' })); link.download = filename; link.click(); URL.revokeObjectURL(link.href)
    setMessage(`Relatório com ${recordsToExport.length} vistoria(s) baixado.`)
  }

  return (
    <main className="app-shell"><header className="topbar"><div className="brand-mark">EF</div><div><span className="eyebrow">CENTRO DE VISTORIAS</span><h1>Arquivo de campo</h1></div><span className="secure">● Exportação protegida</span></header><section className="intro"><div><p className="kicker">PC 399 · FRANCA</p><h2>Encontre uma vistoria em segundos.</h2><p className="subtitle">Pesquise por endereço, cidade ou núcleo e reúna as evidências fotográficas em um só lugar.</p></div><div className="intro-stamp"><strong>{records.length}</strong><span>registros<br />disponíveis</span></div></section><section className="config-panel"><div><label>Fonte de dados</label><p className="source-status">Atualizada automaticamente pelo GitHub Actions usando credenciais protegidas.</p></div><button className="outline-button" onClick={() => void loadRecords()} disabled={loading}>{loading ? 'Carregando...' : '↻ Atualizar dados'}</button></section><section className="workspace"><aside className="sidebar"><div className="search-box"><span>⌕</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar endereço, cidade..." /></div><div className="filter-title"><span>LOCALIZAÇÃO</span><strong>{filtered.length}</strong></div>{filterOptions.map((filter) => <button key={filter} className={`filter ${activeFilter === filter ? 'active' : ''}`} onClick={() => setActiveFilter(filter)}><span className="dot" />{filter}</button>)}<div className="sidebar-bottom"><p>{message}</p><button className="export-button" onClick={() => void downloadReport(filtered, `relatorio-vistorias-${activeFilter.toLowerCase().replaceAll(' ', '-')}.html`)} disabled={!filtered.length}>↓ Baixar relatório ({filtered.length})</button></div></aside><section className="results"><div className="results-head"><div><span className="kicker">RESULTADOS DA BUSCA</span><h3>{filtered.length} vistorias encontradas</h3></div><span className="date-label">Atualizado em 28 ago. 2026</span></div><div className="record-list">{filtered.map((record) => <button className={`record ${selected?.id === record.id ? 'selected' : ''}`} key={record.id} onClick={() => setSelected(record)}><div className="record-icon">⌂</div><div className="record-main"><strong>{record.address}</strong><span>{record.city} · {record.nucleus}</span></div><div className="record-meta"><span>{record.propertyType}</span><small>{record.inspectedAt}</small></div><span className="arrow">›</span></button>)}</div></section><aside className="detail"><div className="detail-top"><span className="kicker">VISTORIA SELECIONADA</span><span className="status">CONCLUÍDA</span></div>{selected ? <><h3>{selected.address}</h3><p className="location">{selected.city} · {selected.nucleus}</p><div className="detail-grid"><div><span>TIPO DE IMÓVEL</span><strong>{selected.propertyType}</strong></div><div><span>DATA DA INSPEÇÃO</span><strong>{selected.inspectedAt}</strong></div></div><div className="photos-head"><h4>Imagens da vistoria</h4><span>{selected.photos.length} arquivos</span></div><div className="photo-grid">{selected.photos.length ? selected.photos.map((photo, index) => photo.startsWith('http') || photo.startsWith('/') ? <div className="photo" key={photo}><img src={photo} alt={`Anexo ${index + 1}`} /></div> : <div className={`photo photo-${index + 1}`} key={photo}><span>{photo}</span></div>) : <p className="empty-photos">Sem anexos disponíveis neste registro.</p>}</div><button className="primary-button" onClick={() => void downloadReport([selected], `relatorio-${selected.id}.html`)}>↓ Baixar relatório resumido</button></> : <p>Nenhuma vistoria selecionada.</p>}</aside></section></main>
  )
}

export default App
