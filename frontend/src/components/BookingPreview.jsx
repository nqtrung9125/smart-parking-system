import { lazy, Suspense, useState } from 'react'
import { spotStatus, vehicleType } from '../lib/format'
import ParkingPlan from './ParkingPlan'
import { Empty, Loading, Notice } from './Ui'

const SpotScene = lazy(() => import('./SpotScene'))
const ignoreSelect = () => {}

export default function BookingPreview({ map, lot, spotId, initialMode, parked = false, onChoose, vehicleTypeId }) {
  const [mode, setMode] = useState(initialMode === '3D' ? '3D' : '2D')
  const spots = map.data
  const selected = spots?.find((spot) => spot.id === Number(spotId))
  const canSelect = (spot) => spot.status === 'Available' && (!vehicleTypeId || vehicleTypeId === spot.type)
  const choose = (spot) => { if (onChoose && canSelect(spot)) onChoose(String(spot.id)) }
  const plan = <ParkingPlan spots={spots || []} selectedId={selected?.id} onSelect={onChoose ? choose : undefined} canSelect={canSelect} />
  return <section className="panel booking-preview">
    <div className="panel-head map-panel-head"><div><h2>{parked ? 'Vị trí xe của bạn' : 'Chọn trên sơ đồ'}</h2><p>{lot?.name || 'Chọn bãi để xem sơ đồ.'}</p></div>
      {spots?.length > 0 && <div className="map-switch" role="group" aria-label={parked ? 'Chế độ xem vị trí xe' : 'Chế độ xem trước'}>{['2D', '3D'].map((view) =>
        <button key={view} type="button" aria-pressed={mode === view} onClick={() => setMode(view)}>{view}</button>
      )}</div>}
    </div>
    {map.loading ? <Loading /> : map.error ? <Notice error={map.error} /> : !spots?.length ? <Empty>{lot ? 'Bãi này chưa có vị trí để xem.' : 'Chọn bãi xe và vị trí trong biểu mẫu đặt chỗ.'}</Empty> :
      <>
        {mode === '3D' ? <Suspense fallback={<Loading>Đang tải bản xem trước 3D…</Loading>}><SpotScene spots={spots} selectedId={selected?.id} onSelect={onChoose ? choose : ignoreSelect} preview interactivePreview={!!onChoose} filter={vehicleTypeId || 0} fallback={plan} /></Suspense> :
          plan}
        <div className="preview-caption" aria-live="polite">{selected ? <><i style={{ background: '#04bfa5' }} /><strong>{parked ? 'Xe của bạn · Ô ' : 'Vị trí '}{selected.code} · {vehicleType(selected.type)}</strong><span>{parked ? 'Xe màu ngọc lam trên sơ đồ.' : 'Xe màu ngọc lam là hình xem trước · ' + spotStatus[selected.status]}</span></> : <span>{parked ? 'Chưa tìm thấy ô này trên sơ đồ. Hãy kiểm tra mã ô trong thông tin lượt gửi.' : 'Chọn một vị trí để xem trước xe trên sơ đồ.'}</span>}</div>
      </>}
  </section>
}
