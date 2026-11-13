import { lazy, Suspense, useState } from 'react'
import { Link, useParams } from 'react-router'
import { useResource } from '../lib/useResource'
import { PageHeader, Loading, Notice, Empty } from '../components/Ui'
import { spotStatus, vehicleType } from '../lib/format'
import ForecastPanel from '../components/ForecastPanel'

const SpotScene = lazy(() => import('../components/SpotScene'))
const noSpots = []
const groups = { Available: 'Trống', Occupied: 'Có xe', Reserved: 'Đã đặt', Inactive: 'Tạm đóng' }

export default function LotDetailPage() {
  const { id } = useParams()
  return <LotDetail key={id} id={id} />
}

function LotDetail({ id }) {
  const lot = useResource('/api/parking-lots/' + id)
  const map = useResource('/api/parking-spots/map?parkingLotId=' + id)
  const [mode, setMode] = useState('2D')
  const [filter, setFilter] = useState(0)
  const [selectedId, setSelectedId] = useState(null)
  const all = map.data || noSpots
  const spots = filter ? all.filter((spot) => spot.type === filter) : all
  const selected = spots.find((spot) => spot.id === selectedId)
  const booking = '/reservations?lot=' + id + (selected?.status === 'Available' ? '&spot=' + selected.id : '')
  return <main className="page-wrap">
    <PageHeader eyebrow="KHÁM PHÁ BÃI ĐỖ" title={lot.data?.name || 'Sơ đồ bãi xe'} description={lot.data?.address} actions={<Link className="button light-button" to="/#lots">← Danh sách bãi</Link>} />
    {(lot.loading || map.loading) && <Loading />}
    <Notice error={lot.error || map.error} />
    {lot.data && !map.loading && !map.error && <>
      <div className="map-stats">{Object.entries(groups).map(([key, label]) => <div className="stat-box" key={key}><span><i className={'state-dot dot-' + key} />{label}</span><strong>{spots.filter((spot) => spot.status === key).length}</strong></div>)}</div>
      <section className="panel map-panel"><div className="panel-head map-panel-head">
        <div><h2>Sơ đồ chỗ đỗ</h2><p>Sơ đồ mô phỏng cách bố trí. Màu sắc phản ánh trạng thái lúc tải dữ liệu.</p></div>
        <div className="map-toolbar"><div className="map-switch" role="group" aria-label="Chế độ sơ đồ">{['2D', '3D'].map((view) => <button type="button" key={view} aria-pressed={mode === view} onClick={() => setMode(view)}>{view}</button>)}</div><button className="button light-button" type="button" onClick={map.refresh}>↻ Cập nhật</button></div>
      </div>
        <div className="directory-filters map-filters" role="group" aria-label="Loại xe">{[[0, 'Tất cả'], [2, 'Ô tô'], [1, 'Xe máy']].map(([value, label]) => <button key={value} type="button" aria-pressed={filter === value} onClick={() => { setFilter(value); setSelectedId(null) }}>{label}</button>)}</div>
        {!spots.length ? <Empty>Không có vị trí đỗ cho bộ lọc này.</Empty> : mode === '3D' ?
          <Suspense fallback={<Loading>Đang tải sơ đồ 3D…</Loading>}><SpotScene spots={spots} onSelect={(spot) => setSelectedId(spot.id)} /></Suspense> :
          <div className="detail-map"><div className="detail-lane">LỐI DI CHUYỂN →</div><div className="detail-spots">{spots.map((spot) => <button type="button" key={spot.id} aria-pressed={selectedId === spot.id} onClick={() => setSelectedId(spot.id)} className={'detail-spot status-' + spot.status.toLowerCase()}><strong>{spot.code}</strong><span>{vehicleType(spot.type)}</span><em>{spotStatus[spot.status]}</em></button>)}</div></div>}
        <div className="map-selection" aria-live="polite"><span>{selected ? selected.code + ' · ' + vehicleType(selected.type) + ' · ' + spotStatus[selected.status] : 'Chọn một vị trí để xem chi tiết.'}</span><Link to={booking} className="button main-button">{selected?.status === 'Available' ? 'Đặt chỗ ' + selected.code : 'Đặt chỗ tại bãi'}</Link></div>
      </section>
      <ForecastPanel key={filter} id={id} vehicleFilter={filter} />
    </>}
  </main>
}
