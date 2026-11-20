import { useState } from 'react'
import { Link } from 'react-router'
import Icon from './components/Icon'
import ParkingArtwork from './components/ParkingArtwork'
import { useAuth } from './auth/useAuth'
import { portalFor, portalPaths } from './lib/portal'
import { useResource } from './lib/useResource'
import './App.css'

const spotFilters = [[0, 'Tất cả'], [2, 'Ô tô'], [1, 'Xe máy']]

const guide = [
  ['search', 'Chọn bãi', 'Tìm theo tên, địa chỉ hoặc loại xe.'],
  ['map', 'Xem sơ đồ', 'Kiểm tra trạng thái từng vị trí đỗ trước khi đến.'],
  ['clock', 'Đặt chỗ', 'Chọn xe, vị trí và khung giờ bạn dự kiến gửi.'],
]

const operatorLinks = {
  admin: 'Quản trị hệ thống',
  staff: 'Mở ca trực',
}

function HomeHero({ operation, area }) {
  return <section className="landing-hero" aria-labelledby="hero-title">
    <div className="hero-copy">
      <h1 id="hero-title">Tìm bãi đỗ xe</h1>
      <p>{operation ? 'Tra cứu bãi, kiểm tra sơ đồ và trạng thái các ô đỗ.' : 'Tìm bãi theo địa chỉ, xem chỗ trống trên sơ đồ và đặt trước khi đến.'}</p>
      <div className="hero-buttons">
        {operation ?
          <Link className="landing-button hero-primary" to={portalPaths[area]}>{operation} <Icon name="arrow" size={18} /></Link> :
          <Link className="landing-button hero-primary" to="/#lots"><Icon name="search" size={18} /> Xem danh sách bãi</Link>}
        {operation ?
          <Link className="landing-button hero-secondary" to="/#lots">Xem danh sách bãi</Link> :
          <Link className="landing-button hero-secondary" to="/reservations">Đặt chỗ trước <Icon name="arrow" size={17} /></Link>}
      </div>
    </div>
    <figure className="hero-visual">
      <ParkingArtwork />
      <figcaption><span>Sơ đồ minh họa</span><span><i /> Trống</span><span><i /> Có xe</span><span><i /> Đã đặt</span></figcaption>
    </figure>
  </section>
}

function LotCard({ lot, activeCount }) {
  return <article className="directory-card">
    <div className="directory-card-top">
      <span className="metric-icon"><Icon name="car" /></span>
      <span className="directory-chip">{activeCount} ô đang hoạt động</span>
    </div>
    <h3>{lot.name}</h3>
    <p><Icon name="pin" size={16} /> {lot.address}</p>
    <Link to={'/lots/' + lot.id} aria-label={'Xem sơ đồ ' + lot.name}>Xem sơ đồ <Icon name="arrow" size={17} /></Link>
  </article>
}

export default function App() {
  const { user, token } = useAuth()
  const area = portalFor(user)
  const operation = operatorLinks[area]
  const staff = area === 'staff'
  const lots = useResource(staff ? '/api/parking-lots/assigned' : '/api/parking-lots', staff ? token : undefined)
  const spots = useResource(staff ? '/api/parking-spots/operational' : '/api/parking-spots', staff ? token : undefined)
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState(0)
  const lotRows = lots.data || []
  const allSpots = spots.data || []
  const activeSpotsByLot = new Map()
  let activeCount = 0

  for (const spot of allSpots) {
    if (!spot.isActive) continue
    const active = activeSpotsByLot.get(spot.parkingLotId) || []
    active.push(spot)
    activeSpotsByLot.set(spot.parkingLotId, active)
    activeCount += 1
  }

  const term = query.trim().toLocaleLowerCase('vi')
  const results = lotRows.filter((lot) =>
    [lot.name, lot.address].some((value) => value.toLocaleLowerCase('vi').includes(term)) &&
    (!filter || activeSpotsByLot.get(lot.id)?.some((spot) => spot.type === filter)))
  const error = lots.error || spots.error
  const busy = lots.loading || spots.loading
  const metrics = [['pin', lotRows.length, 'Bãi xe'], ['grid', allSpots.length, 'Ô đỗ'], ['car', activeCount, 'Ô đang hoạt động']]

  function refreshDirectory() {
    lots.refresh()
    spots.refresh()
  }

  return <main className="page-wrap home-page">
    <HomeHero operation={operation} area={area} />
    <dl className="landing-metrics" aria-label="Tổng quan hệ thống">
      {metrics.map(([icon, value, label]) => <div key={label}>
        <span className="metric-icon"><Icon name={icon} size={18} /></span>
        <dt>{label}</dt>
        <dd>{busy || error ? '—' : value}</dd>
      </div>)}
    </dl>

    <section className="directory" id="lots" aria-labelledby="directory-title">
      <div className="directory-heading">
        <div>
          <h2 id="directory-title">{staff ? 'Bãi được phân công' : 'Danh sách bãi xe'}</h2>
          <p>Chọn một bãi để xem sơ đồ và tình trạng chỗ đỗ.</p>
        </div>
        <button className="landing-button refresh-light" type="button" disabled={busy} onClick={refreshDirectory}><Icon name="refresh" size={17} /> Cập nhật</button>
      </div>
      <div className="directory-tools">
        <label className="directory-search">
          <Icon name="search" size={19} />
          <span className="sr-only">Tìm theo tên hoặc địa chỉ</span>
          <input placeholder="Tìm theo tên hoặc địa chỉ…" value={query} onChange={(event) => setQuery(event.target.value)} />
        </label>
        <div className="directory-filters" role="group" aria-label="Loại xe">
          {spotFilters.map(([value, label]) => <button key={value} type="button" aria-pressed={filter === value} onClick={() => setFilter(value)}>{label}</button>)}
        </div>
      </div>
      {busy && <div className="directory-state" role="status">Đang tải bãi xe…</div>}
      {!busy && error && <div className="directory-state" role="status">Chưa tải được danh sách bãi. Hãy thử cập nhật lại.</div>}
      {!busy && !error && (results.length ? <div className="directory-cards">
        {results.map((lot) => <LotCard key={lot.id} lot={lot} activeCount={activeSpotsByLot.get(lot.id)?.length ?? 0} />)}
      </div> : <div className="directory-state" role="status">{lotRows.length ? 'Không tìm thấy bãi xe phù hợp.' : staff ? 'Tài khoản chưa được phân công bãi.' : 'Chưa có bãi xe nào.'}</div>)}
    </section>

    {!operation && <section className="landing-guide" id="guide" aria-labelledby="guide-title">
      <h2 id="guide-title">Cách đặt chỗ</h2>
      <ol className="guide-steps">
        {guide.map(([icon, title, body]) => <li key={title}>
          <span className="metric-icon"><Icon name={icon} size={18} /></span>
          <div><h3>{title}</h3><p>{body}</p></div>
        </li>)}
      </ol>
    </section>}
  </main>
}
