import { lazy, Suspense, useState } from 'react'
import { parkingTones } from '../lib/parkingLayout'
import { spotStatus, vehicleType } from '../lib/format'
import ParkingPlan from './ParkingPlan'
import { Empty, Loading, Notice } from './Ui'

const SpotScene = lazy(() => import('./SpotScene'))
const ignoreSelect = () => {}

export default function BookingPreview({ map, lot, spotId, initialMode }) {
  const [mode, setMode] = useState(initialMode === '3D' ? '3D' : '2D')
  const spots = map.data
  const selected = spots?.find((spot) => spot.id === Number(spotId))
  return <section className="panel booking-preview">
    <div className="panel-head map-panel-head"><div><h2>Xem trước chỗ đỗ</h2><p>{lot?.name || 'Chọn bãi để xem sơ đồ.'}</p></div>
      {spots?.length > 0 && <div className="map-switch" role="group" aria-label="Chế độ xem trước">{['2D', '3D'].map((view) =>
        <button key={view} type="button" aria-pressed={mode === view} onClick={() => setMode(view)}>{view}</button>
      )}</div>}
    </div>
    {map.loading ? <Loading /> : map.error ? <Notice error={map.error} /> : !spots?.length ? <Empty>{lot ? 'Bãi này chưa có vị trí để xem.' : 'Chọn bãi xe và vị trí trong biểu mẫu đặt chỗ.'}</Empty> :
      <>
        {mode === '3D' ? <Suspense fallback={<Loading>Đang tải bản xem trước 3D…</Loading>}><SpotScene spots={spots} selectedId={selected?.id} onSelect={ignoreSelect} preview fallback={<ParkingPlan spots={spots} selectedId={selected?.id} />} /></Suspense> :
          <ParkingPlan spots={spots} selectedId={selected?.id} />}
        <div className="preview-caption" aria-live="polite">{selected ? <><i style={{ background: parkingTones[selected.status] }} /><strong>Vị trí {selected.code} · {vehicleType(selected.type)}</strong><span>{spotStatus[selected.status]} lúc tải sơ đồ</span></> : <span>Chọn một vị trí để đánh dấu trên sơ đồ.</span>}</div>
      </>}
  </section>
}
