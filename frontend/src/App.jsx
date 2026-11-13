import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router'
import './App.css'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5181'

const paths = {
  arrow: <><path d="M5 12h14" /><path d="m13 6 6 6-6 6" /></>,
  car: <><path d="m5 11 1.6-4.2A2 2 0 0 1 8.5 5.5h7A2 2 0 0 1 17.4 6.8L19 11" /><path d="M4 11h16v6H4zM7 17v2m10-2v2M7 13h.01M17 13h.01" /></>,
  pin: <><path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z" /><circle cx="12" cy="10" r="2.5" /></>,
  search: <><circle cx="10.8" cy="10.8" r="6.3" /><path d="m16 16 4.5 4.5" /></>,
  refresh: <><path d="M20 7v5h-5M4 17v-5h5" /><path d="M5.7 9A7 7 0 0 1 18 7l2 5M4 12l2 5a7 7 0 0 0 12.3-2" /></>,
  grid: <><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></>,
}

function Icon({ name, size = 20 }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>
}

function ParkingMap({ lot, spots }) {
  return <div className="parking-map" id="map">
    <div className="map-topline"><span className="map-caption"><i className="live-dot" /> Sơ đồ chỗ đỗ</span><span className="map-location">{lot?.name || 'Chọn một bãi xe'}</span></div>
    <div className="map-board"><div className="map-lane"><span>LỐI DI CHUYỂN</span><span className="lane-arrow">→</span></div>
      <div className="map-spots">{spots.length ? spots.slice(0, 12).map((spot) =>
        <div className={`map-spot ${spot.isActive ? 'is-active' : 'is-inactive'}`} key={spot.id} title={`${spot.code} · ${spot.type === 2 ? 'Ô tô' : 'Xe máy'} · ${spot.isActive ? 'Đang hoạt động' : 'Tạm đóng'}`}>
          <span className="spot-code">{spot.code}</span><Icon name="car" size={23} /><span className="spot-type">{spot.type === 2 ? 'Ô tô' : 'Xe máy'}</span>
        </div>) : <p className="map-empty">{lot ? 'Bãi này chưa có chỗ đỗ.' : 'Sơ đồ sẽ hiển thị khi có dữ liệu.'}</p>}</div>
      {spots.length > 12 && <span className="map-more">Và {spots.length - 12} chỗ khác</span>}
    </div>
    <div className="map-legend"><span><i className="legend-mark active" /> Đang hoạt động</span><span><i className="legend-mark inactive" /> Tạm đóng</span></div>
  </div>
}

function App() {
  const [lots, setLots] = useState([])
  const [spots, setSpots] = useState([])
  const [selectedId, setSelectedId] = useState(null)
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [updatedAt, setUpdatedAt] = useState(null)

  const loadData = useCallback(async (signal) => {
    try {
      const [lotsResponse, spotsResponse] = await Promise.all([
        fetch(`${API_BASE_URL}/api/parking-lots`, { signal }),
        fetch(`${API_BASE_URL}/api/parking-spots`, { signal }),
      ])
      if (!lotsResponse.ok || !spotsResponse.ok) throw new Error('API chưa sẵn sàng. Hãy kiểm tra backend C# và Docker.')
      const [nextLots, nextSpots] = await Promise.all([lotsResponse.json(), spotsResponse.json()])
      if (signal?.aborted) return
      setLots(nextLots)
      setSpots(nextSpots)
      setSelectedId((current) => nextLots.some((lot) => lot.id === current) ? current : nextLots[0]?.id ?? null)
      setUpdatedAt(new Date())
    } catch (cause) {
      if (cause.name !== 'AbortError') setError(cause.message === 'Failed to fetch' ? 'Không kết nối được API. Hãy chạy backend C# tại cổng 5181.' : cause.message)
    } finally {
      if (!signal?.aborted) setLoading(false)
    }
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    queueMicrotask(() => { if (!controller.signal.aborted) loadData(controller.signal) })
    return () => controller.abort()
  }, [loadData])

  const selectedLot = lots.find((lot) => lot.id === selectedId) || lots[0]
  const selectedSpots = spots.filter((spot) => spot.parkingLotId === selectedLot?.id)
  const activeSpots = spots.filter((spot) => spot.isActive).length
  const filteredLots = lots.filter((lot) => `${lot.name} ${lot.address}`.toLocaleLowerCase('vi-VN').includes(query.trim().toLocaleLowerCase('vi-VN')))

  function refreshData() {
    setLoading(true)
    setError('')
    loadData()
  }

  function showMap(id) {
    setSelectedId(id)
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    document.getElementById('map')?.scrollIntoView({ behavior: reducedMotion ? 'instant' : 'smooth', block: 'center' })
  }

  return <div className="site-shell" id="top">
    <header className="site-header">
      <a className="brand" href="#top" aria-label="Smart Parking, về đầu trang"><span className="brand-mark">P<span>.</span></span><span className="brand-name">smart<span>parking</span></span></a>
      <nav className="main-nav" aria-label="Điều hướng chính"><a href="#lots">Bãi đỗ xe</a><a href="#map">Sơ đồ chỗ đỗ</a></nav>
      <Link className="header-cta" to="/login">Đăng nhập <Icon name="arrow" size={17} /></Link>
    </header>

    <main>
      <section className="hero" aria-labelledby="hero-title">
        <div className="hero-copy"><div className="hero-kicker"><span className="kicker-line" /> Hệ thống quản lý bãi đỗ xe</div>
          <h1 id="hero-title">Bãi đỗ rõ ràng.<br /><span>Hành trình nhẹ nhàng.</span></h1>
          <p className="hero-description">Xem các bãi xe, kiểm tra sơ đồ chỗ đỗ và chọn điểm đến phù hợp từ một nơi.</p>
          <div className="hero-actions"><a className="button-primary" href="#lots">Xem danh sách bãi xe <Icon name="arrow" size={19} /></a><a className="button-secondary" href="#map"><Icon name="grid" size={19} /> Xem sơ đồ</a></div>
          <div className="hero-meta"><i className="signal-dot" /> Dữ liệu lấy trực tiếp từ hệ thống{updatedAt && <span className="update-time"> · Đồng bộ lúc {updatedAt.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}</span>}</div>
        </div>
        <ParkingMap lot={selectedLot} spots={selectedSpots} />
      </section>

      <section className="metrics" aria-label="Tổng quan hệ thống">
        <div className="metric"><span className="metric-number">{loading ? '—' : lots.length.toString().padStart(2, '0')}</span><span className="metric-label">Bãi xe trong hệ thống</span></div>
        <div className="metric"><span className="metric-number">{loading ? '—' : spots.length.toString().padStart(2, '0')}</span><span className="metric-label">Tổng chỗ đỗ</span></div>
        <div className="metric"><span className="metric-number">{loading ? '—' : activeSpots.toString().padStart(2, '0')}</span><span className="metric-label">Chỗ đang hoạt động</span></div>
        <p className="metric-note">“Đang hoạt động” là chỗ được mở sử dụng; chưa phản ánh xe đang chiếm chỗ.</p>
      </section>

      <section className="lots-section" id="lots" aria-labelledby="lots-title">
        <div className="section-heading"><div><span className="section-index">KHÁM PHÁ BÃI ĐỖ</span><h2 id="lots-title">Tìm điểm đỗ của bạn</h2><p>Chọn một bãi xe để xem vị trí và sơ đồ chỗ đỗ.</p></div><button type="button" className="refresh-button" onClick={refreshData} disabled={loading}><Icon name="refresh" size={17} /> Cập nhật</button></div>
        <label className="search-box"><Icon name="search" size={21} /><span className="sr-only">Tìm bãi xe theo tên hoặc địa chỉ</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Tìm theo tên bãi xe hoặc địa chỉ" /></label>
        {loading && <div className="feedback-panel">Đang tải danh sách bãi xe…</div>}
        {error && <div className="feedback-panel error-panel"><strong>Không tải được dữ liệu.</strong><span>{error}</span><button type="button" onClick={refreshData}>Thử lại</button></div>}
        {!loading && !error && !filteredLots.length && <div className="feedback-panel">{lots.length ? 'Không tìm thấy bãi xe phù hợp. Thử từ khóa khác.' : 'Chưa có bãi xe trong hệ thống.'}</div>}
        {!loading && !error && filteredLots.length > 0 && <div className="lot-list">{filteredLots.map((lot) => {
          const lotSpots = spots.filter((spot) => spot.parkingLotId === lot.id)
          const lotActive = lotSpots.filter((spot) => spot.isActive).length
          return <div key={lot.id} className={`lot-card ${lot.id === selectedLot?.id ? 'selected' : ''}`}>
            <span className="lot-card-top"><span className="lot-icon"><Icon name="car" size={24} /></span><span className="lot-count">{lotActive}/{lotSpots.length} chỗ hoạt động</span></span>
            <span className="lot-name">{lot.name}</span><span className="lot-address"><Icon name="pin" size={17} />{lot.address}</span>
            <span className="lot-card-bottom"><button type="button" onClick={() => showMap(lot.id)}>Xem sơ đồ</button><Link to={`/lots/${lot.id}`}>Chi tiết <Icon name="arrow" size={19} /></Link></span>
          </div>
        })}</div>}
      </section>
    </main>
    <footer className="site-footer"><span className="footer-brand">smartparking<span>.</span></span><span>Thông tin bãi xe trong một màn hình.</span><a href="#top">Về đầu trang ↑</a></footer>
  </div>
}

export default App
