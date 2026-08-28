import { useEffect, useState } from 'react'
import './App.css'

type RecordItem = { id: number; address: string; city: string; nucleus: string; propertyType: string; inspectedAt: string; photos: string[] }
const demoRecords: RecordItem[] = [
  { id: 1, address: 'Rua Emiliano Di Cavalcanti, 543', city: 'Franca', nucleus: 'Franca 01', propertyType: 'Territorial', inspectedAt: '29 jun. 2026, 09:48', photos: ['fachada', 'passeio', 'situação'] },
  { id: 2, address: 'Rua Anita Malfati, 670', city: 'Franca', nucleus: 'Franca 01', propertyType: 'Predial', inspectedAt: '29 jun. 2026, 09:27', photos: ['fachada', 'lateral'] },
  { id: 3, address: 'Rua José Vicente, 07', city: 'Franca', nucleus: 'Franca 02', propertyType: 'Predial', inspectedAt: '15 jul. 2026, 14:53', photos: ['fachada', 'passeio', 'fundos', 'documento'] },
]

function App() {
  const [search, setSearch] = useState('')
  const [activeFilter, setActiveFilter] = useState('Todos')
  const [selected, setSelected] = useState<RecordItem | null>(demoRecords[0])
  const [records, setRecords] = useState(demoRecords)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('Carregando exportação protegida...')
  const filtered = records.filter((record) => [record.address, record.city, record.nucleus].some((value) => value.toLowerCase().includes(search.toLowerCase())) && (activeFilter === 'Todos' || record.city === activeFilter || record.nucleus === activeFilter))

  async function loadRecords() {
    setLoading(true); setMessage('Carregando registros exportados...')
    try {
      const response = await fetch(`${import.meta.env.BASE_URL}data/vistorias.json`)
      if (!response.ok) throw new Error('arquivo de dados ainda não publicado')
      const data: { registros: Array<{ id: number; endereco: string; cidade: string; nucleo: string; tipo_imovel: string; data_inspecao: string; imagens: string[] }> } = await response.json()
      const mapped = data.registros.map((item) => ({ id: item.id, address: item.endereco, city: item.cidade, nucleus: item.nucleo, propertyType: item.tipo_imovel, inspectedAt: item.data_inspecao, photos: item.imagens.map((image) => `${import.meta.env.BASE_URL}${image}`) }))
      setRecords(mapped); setSelected(mapped[0] ?? null); setMessage(`${mapped.length} vistorias atualizadas pelo GitHub Actions`)
    } catch (error) { setMessage(`Não foi possível consultar a camada: ${error instanceof Error ? error.message : 'erro desconhecido'}`) } finally { setLoading(false) }
  }

  useEffect(() => { void loadRecords() }, [])

  function downloadReport() {
    const report = `<html><head><title>Relatório de vistorias</title><style>body{font-family:Arial;color:#192b2a;padding:32px}h1{color:#126b61}li{margin:12px 0}</style></head><body><h1>Relatório de vistorias cautelares</h1><p>Gerado em ${new Date().toLocaleDateString('pt-BR')}</p><p>${filtered.length} registro(s) encontrado(s).</p><ul>${filtered.map((item) => `<li><strong>${item.address}</strong> | ${item.city} | ${item.nucleus} | ${item.photos.length} imagens</li>`).join('')}</ul></body></html>`
    const link = document.createElement('a'); link.href = URL.createObjectURL(new Blob([report], { type: 'text/html' })); link.download = 'relatorio-vistorias.html'; link.click(); URL.revokeObjectURL(link.href)
  }

  return (
    <main className="app-shell"><header className="topbar"><div className="brand-mark">EF</div><div><span className="eyebrow">CENTRO DE VISTORIAS</span><h1>Arquivo de campo</h1></div><span className="secure">● Exportação protegida</span></header><section className="intro"><div><p className="kicker">PC 399 · FRANCA</p><h2>Encontre uma vistoria em segundos.</h2><p className="subtitle">Pesquise por endereço, cidade ou núcleo e reúna as evidências fotográficas em um só lugar.</p></div><div className="intro-stamp"><strong>{records.length}</strong><span>registros<br />disponíveis</span></div></section><section className="config-panel"><div><label>Fonte de dados</label><p className="source-status">Atualizada automaticamente pelo GitHub Actions usando credenciais protegidas.</p></div><button className="outline-button" onClick={() => void loadRecords()} disabled={loading}>{loading ? 'Carregando...' : '↻ Atualizar dados'}</button></section><section className="workspace"><aside className="sidebar"><div className="search-box"><span>⌕</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar endereço, cidade..." /></div><div className="filter-title"><span>LOCALIZAÇÃO</span><strong>{filtered.length}</strong></div>{['Todos', 'Franca', 'Franca 01', 'Franca 02'].map((filter) => <button key={filter} className={`filter ${activeFilter === filter ? 'active' : ''}`} onClick={() => setActiveFilter(filter)}><span className="dot" />{filter}</button>)}<div className="sidebar-bottom"><p>{message}</p><button className="export-button" onClick={downloadReport}>↓ Baixar relatório</button></div></aside><section className="results"><div className="results-head"><div><span className="kicker">RESULTADOS DA BUSCA</span><h3>{filtered.length} vistorias encontradas</h3></div><span className="date-label">Atualizado em 28 ago. 2026</span></div><div className="record-list">{filtered.map((record) => <button className={`record ${selected?.id === record.id ? 'selected' : ''}`} key={record.id} onClick={() => setSelected(record)}><div className="record-icon">⌂</div><div className="record-main"><strong>{record.address}</strong><span>{record.city} · {record.nucleus}</span></div><div className="record-meta"><span>{record.propertyType}</span><small>{record.inspectedAt}</small></div><span className="arrow">›</span></button>)}</div></section><aside className="detail"><div className="detail-top"><span className="kicker">VISTORIA SELECIONADA</span><span className="status">CONCLUÍDA</span></div>{selected ? <><h3>{selected.address}</h3><p className="location">{selected.city} · {selected.nucleus}</p><div className="detail-grid"><div><span>TIPO DE IMÓVEL</span><strong>{selected.propertyType}</strong></div><div><span>DATA DA INSPEÇÃO</span><strong>{selected.inspectedAt}</strong></div></div><div className="photos-head"><h4>Imagens da vistoria</h4><span>{selected.photos.length} arquivos</span></div><div className="photo-grid">{selected.photos.length ? selected.photos.map((photo, index) => photo.startsWith('http') ? <div className="photo" key={photo}><img src={photo} alt={`Anexo ${index + 1}`} /></div> : <div className={`photo photo-${index + 1}`} key={photo}><span>{photo}</span></div>) : <p className="empty-photos">Sem anexos disponíveis neste registro.</p>}</div><button className="primary-button" onClick={downloadReport}>↓ Baixar relatório resumido</button></> : <p>Nenhuma vistoria selecionada.</p>}</aside></section></main>
  )
}

export default App
