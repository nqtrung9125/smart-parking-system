import { useState } from 'react'
import { Link } from 'react-router'
import { useAuth } from './auth/useAuth'
import ParkingArtwork from './components/ParkingArtwork'
import { useResource } from './lib/useResource'
import './App.css'

export function Icon({ name, size = 20 }) {
  const shapes = {
    arrow: <><path d="M4 12h15m-6-6 6 6-6 6" /></>,
    pin: <><path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 0 1 16 0Z" /><circle cx="12" cy="10" r="2.6" /></>,
    search: <><circle cx="10.8" cy="10.8" r="6.3" /><path d="m16 16 4.5 4.5" /></>,
    grid: <><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></>,
    clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
    map: <path d="m3 6 6-3 6 3 6-3v15l-6 3-6-3-6 3zM9 3v15m6-12v15" />,
    car: <path d="m5 11 2-5h10l2 5M4 11h16v6H4zM7 17v2m10-2v2M7 14h1m8 0h1" />,
  }
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{shapes[name]}</svg>
}

export function Brand() {
  return <Link className="parking-brand" to="/" aria-label="Smart Parking, trang chủ"><span className="parking-mark">P</span><span>Smart<span>Parking</span></span></Link>
}

export default function App() {
  const { user } = useAuth()
  const lots = useResource('/api/parking-lots')
  const spots = useResource('/api/parking-spots')
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState(0)
  const lotRows = lots.data || []
  const allSpots = spots.data || []
  const term = query.trim().toLocaleLowerCase('vi')
  const results = lotRows.filter((lot) =>
    [lot.name, lot.address].some((value) => value.toLocaleLowerCase('vi').includes(term)) &&
    (!filter || allSpots.some((spot) => spot.parkingLotId === lot.id && spot.isActive && spot.type === filter)))
  const error = lots.error || spots.error
  const busy = lots.loading || spots.loading
  const accountPath = user?.roles.includes('Admin') ? '/admin' : user?.roles.includes('Staff') ? '/staff/check-in' : '/vehicles'

  return <div className="parking-home">
    <header className="landing-header"><div className="landing-container landing-nav">
      <Brand />
      <nav aria-label="Điều hướng chính"><a className="nav-selected" href="#lots">Khám phá</a><a href="#guide">Cách hoạt động</a></nav>
      <Link className="landing-button nav-button" to={user ? accountPath : '/login'}>{user ? 'Tài khoản' : 'Đăng nhập'} <Icon name="arrow" size={16} /></Link>
    </div></header>
    <main className="landing-container">
      <section className="landing-hero" aria-labelledby="hero-title">
        <div className="hero-copy-new">
          <div className="hero-tag"><span /> BÃI ĐỖ XE THÔNG MINH</div>
          <h1 id="hero-title">Tìm chỗ đỗ.<br /><em>Đi tiếp thôi.</em></h1>
          <p>Khám phá các bãi xe, xem trạng thái từng chỗ đỗ và đặt trước ngay trên một trang.</p>
          <div className="hero-buttons"><a className="landing-button teal-button" href="#lots">Tìm bãi đỗ <Icon name="arrow" size={18} /></a><Link className="landing-button ghost-button" to="/reservations">Đặt chỗ trước</Link></div>
        </div>
        <div className="hero-visual"><div className="visual-meta"><span><Icon name="grid" size={16} /> SƠ ĐỒ BÃI XE</span><small>Minh họa</small></div><ParkingArtwork /><div className="visual-legend"><span><i /> Chỗ trống</span><span><i /> Có xe</span><span><i /> Đã đặt</span></div></div>
      </section>

      <div className="landing-metrics" aria-label="Tổng quan hệ thống">
        {[['pin', lotRows.length, 'Bãi xe'], ['grid', allSpots.length, 'Vị trí đỗ'], ['car', allSpots.filter((s) => s.isActive).length, 'Vị trí đang mở']].map(([icon, value, label]) =>
          <div key={label}><span className="metric-icon"><Icon name={icon} /></span><div><strong>{busy || error ? '—' : value}</strong><span>{label}</span></div></div>)}
      </div>

      <section className="directory" id="lots" aria-labelledby="directory-title">
        <div className="directory-heading"><div><span className="landing-kicker">DANH MỤC BÃI ĐỖ</span><h2 id="directory-title">Khám phá bãi đỗ xe</h2><p>Chọn một bãi để xem chỗ trống và đặt chỗ.</p></div>
          <button className="landing-button refresh-light" type="button" disabled={busy} onClick={() => { lots.refresh(); spots.refresh() }}>↻ Cập nhật</button></div>
        <div className="directory-tools"><label className="directory-search"><Icon name="search" /><span className="sr-only">Tìm theo tên hoặc địa chỉ</span><input placeholder="Tìm theo tên hoặc địa chỉ…" value={query} onChange={(event) => setQuery(event.target.value)} /></label>
          <div className="directory-filters" role="group" aria-label="Loại xe">{[[0, 'Tất cả'], [2, 'Ô tô'], [1, 'Xe máy']].map(([value, label]) => <button key={value} type="button" aria-pressed={filter === value} onClick={() => setFilter(value)}>{label}</button>)}</div></div>
        {busy ? <div className="directory-state" role="status">Đang tải bãi xe…</div> : error ? <div className="directory-state" role="status">Chưa tải được dữ liệu. Kiểm tra API rồi nhấn Cập nhật.</div> : !results.length ? <div className="directory-state" role="status">{lotRows.length ? 'Không tìm thấy bãi xe phù hợp.' : 'Chưa có bãi xe nào.'}</div> :
          <div className="directory-cards">{results.map((lot) => {
            const local = allSpots.filter((spot) => spot.parkingLotId === lot.id && spot.isActive)
            return <article className="directory-card" key={lot.id}><div className="directory-card-top"><span className="metric-icon"><Icon name="car" /></span><span className="directory-chip">{local.length} vị trí đang mở</span></div><h3>{lot.name}</h3><p><Icon name="pin" size={16} /> {lot.address}</p><Link to={'/lots/' + lot.id}>Xem sơ đồ và chi tiết <Icon name="arrow" size={17} /></Link></article>
          })}</div>}
      </section>
      <section className="landing-guide" id="guide" aria-labelledby="guide-title"><span className="landing-kicker">TRƯỚC KHI BẠN ĐẾN</span><h2 id="guide-title">Đỗ xe trong 3 bước</h2><div className="guide-steps">
        {[['search', 'Chọn bãi', 'Tìm theo tên, địa chỉ hoặc loại xe.'], ['map', 'Xem sơ đồ', 'Kiểm tra trạng thái từng vị trí đỗ.'], ['clock', 'Đặt chỗ', 'Chọn xe, vị trí và giờ bạn dự kiến đến.']].map(([icon, title, body], i) => <div key={title}><span className="metric-icon"><Icon name={icon} /></span><div><h3>{i + 1}. {title}</h3><p>{body}</p></div></div>)}
      </div></section>
    </main>
    <footer className="landing-container landing-footer"><Brand /><span>Hệ thống quản lý bãi đỗ xe</span><a href="#root">Về đầu trang ↑</a></footer>
  </div>
}
