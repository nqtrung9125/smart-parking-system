import { Link, useSearchParams } from 'react-router'
import { useAuth } from '../auth/useAuth'
import { useResource } from '../lib/useResource'
import { dateTime, vehicleType } from '../lib/format'
import BookingPreview from '../components/BookingPreview'
import { Empty, Loading, Notice, PageHeader } from '../components/Ui'

export default function ParkedVehiclesPage() {
  const { token } = useAuth()
  const [params, setParams] = useSearchParams()
  const sessions = useResource('/api/parking-sessions/mine/active', token)
  const active = sessions.data || []
  const selection = params.get('session')
  const selected = selection ? active.find((item) => String(item.id) === selection) : active[0]
  const map = useResource(selected ? '/api/parking-spots/map?parkingLotId=' + selected.lotId : null)

  return <main className="page-wrap">
    <PageHeader eyebrow="LẤY XE" title="Xe đang gửi" description="Xem vị trí xe của bạn trước khi đến lấy xe." actions={<button type="button" className="button light-button" disabled={sessions.loading} onClick={() => { sessions.refresh(); map.refresh() }}>↻ Cập nhật</button>} />
    {sessions.loading ? <Loading /> : sessions.error ? <Notice error={sessions.error} /> : !active.length ? <>
      <Empty>Bạn không có xe đang gửi. Vị trí xe sẽ xuất hiện sau khi nhân viên ghi nhận xe vào bãi.</Empty>
      <div className="section-gap"><Link className="button light-button" to="/reservations">Xem lịch đặt chỗ</Link></div>
    </> : <div className="two-column booking-grid">
      <section className="panel">
        <h2>Chọn xe để tìm</h2>
        {selection && !selected && <Notice error="Lượt gửi này không còn trong danh sách xe đang gửi." />}
        <div className="parked-options" role="group" aria-label="Xe của bạn đang trong bãi">{active.map((item) =>
          <button key={item.id} type="button" className="choice-row parked-choice" aria-pressed={selected?.id === item.id}
            onClick={() => setParams({ session: String(item.id) }, { replace: true })}>
            <strong>{item.plateNumber}</strong><span>{item.lotName} · Ô {item.spotCode}</span>
          </button>
        )}</div>
        {selected && <>
          <dl className="parked-details">
            <div><dt>Ô đỗ</dt><dd className="parked-code">{selected.spotCode}</dd></div>
            <div><dt>Bãi xe</dt><dd>{selected.lotName}<small>{selected.lotAddress}</small></dd></div>
            <div><dt>Loại xe</dt><dd>{vehicleType(selected.vehicleType)}</dd></div>
            <div><dt>Giờ vào bãi</dt><dd>{dateTime(selected.checkInUtc)}</dd></div>
          </dl>
          <p className="helper-text">Khi lấy xe, nhân viên tại cổng sẽ xác nhận xe ra.</p>
        </>}
      </section>
      {selected && <BookingPreview map={map} lot={{ name: selected.lotName }} spotId={selected.parkingSpotId} parked />}
    </div>}
  </main>
}
