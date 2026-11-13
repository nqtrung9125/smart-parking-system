import { useState } from 'react'
import { Link } from 'react-router'
import { useAuth } from '../auth/useAuth'
import { api } from '../lib/api'
import { useResource } from '../lib/useResource'
import { dateTime, reservationStatus, vehicleType } from '../lib/format'
import { PageHeader, Notice, Loading, Empty, Field } from '../components/Ui'

function localTime(offsetMinutes) {
  const d = new Date(Date.now() + offsetMinutes * 60000)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}T${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

export default function ReservationsPage() {
  const { token } = useAuth()
  const vehicles = useResource('/api/vehicles/mine', token)
  const lots = useResource('/api/parking-lots')
  const spots = useResource('/api/parking-spots')
  const reservations = useResource('/api/reservations/mine', token)
  const [vehicleId, setVehicleId] = useState('')
  const [lotId, setLotId] = useState('')
  const [spotId, setSpotId] = useState('')
  const [start, setStart] = useState(() => localTime(10))
  const [end, setEnd] = useState(() => localTime(70))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const chosenVehicle = vehicles.data?.find((v) => v.id === Number(vehicleId))
  const possibleSpots = spots.data?.filter((spot) => spot.parkingLotId === Number(lotId) && spot.isActive && (!chosenVehicle || spot.type === chosenVehicle.type)) || []

  async function create(event) {
    event.preventDefault(); setBusy(true); setError(''); setMessage('')
    try {
      await api('/api/reservations', { method: 'POST', token, body: { vehicleId: Number(vehicleId), parkingSpotId: Number(spotId), startUtc: new Date(start).toISOString(), endUtc: new Date(end).toISOString() } })
      setMessage('Đặt chỗ thành công.'); reservations.refresh()
    } catch (cause) { setError(cause.message) } finally { setBusy(false) }
  }
  async function cancel(id) {
    if (!window.confirm('Hủy lịch đặt này?')) return
    setError(''); setMessage('')
    try { await api(`/api/reservations/${id}/cancel`, { method: 'POST', token }); setMessage('Đã hủy lịch đặt.'); reservations.refresh() }
    catch (cause) { setError(cause.message) }
  }

  return <main className="page-wrap"><PageHeader eyebrow="ĐẶT CHỖ" title="Chọn chỗ đỗ trước khi đến" description="Chọn xe và khung giờ. Hệ thống sẽ kiểm tra trùng lịch khi bạn xác nhận." />
    <Notice error={error || vehicles.error || lots.error || spots.error || reservations.error} success={message} />
    <div className="two-column wide-left"><form className="panel" onSubmit={create}><h2>Đặt chỗ mới</h2>
      {!vehicles.loading && !vehicles.data?.length && <p className="helper-text">Bạn cần <Link to="/vehicles">đăng ký xe</Link> trước khi đặt chỗ.</p>}
      <Field label="Xe của bạn"><select value={vehicleId} onChange={(event) => { setVehicleId(event.target.value); setSpotId('') }} required><option value="">Chọn xe</option>{vehicles.data?.map((vehicle) => <option key={vehicle.id} value={vehicle.id}>{vehicle.plateNumber} · {vehicleType(vehicle.type)}</option>)}</select></Field>
      <Field label="Bãi xe"><select value={lotId} onChange={(event) => { setLotId(event.target.value); setSpotId('') }} required><option value="">Chọn bãi xe</option>{lots.data?.map((lot) => <option key={lot.id} value={lot.id}>{lot.name}</option>)}</select></Field>
      <Field label="Chỗ đỗ"><select value={spotId} onChange={(event) => setSpotId(event.target.value)} required><option value="">Chọn chỗ phù hợp</option>{possibleSpots.map((spot) => <option key={spot.id} value={spot.id}>{spot.code} · {vehicleType(spot.type)}</option>)}</select></Field>
      <div className="form-grid"><Field label="Bắt đầu"><input type="datetime-local" value={start} onChange={(event) => setStart(event.target.value)} required /></Field><Field label="Kết thúc"><input type="datetime-local" value={end} onChange={(event) => setEnd(event.target.value)} required /></Field></div>
      <p className="helper-text">Tối đa 24 giờ, bắt đầu trong tương lai. Giờ được đổi sang UTC khi gửi API. Trạng thái chỗ sẽ được kiểm tra lại lúc xác nhận.</p>
      <button className="button main-button" disabled={busy || !vehicles.data?.length}>{busy ? 'Đang đặt…' : 'Xác nhận đặt chỗ'}</button>
    </form><section className="panel"><h2>Lịch đặt của tôi</h2>{reservations.loading ? <Loading /> : !reservations.data?.length ? <Empty>Bạn chưa có lịch đặt nào.</Empty> : <div className="data-list">{reservations.data.map((item) => <div className="data-item stacked" key={item.id}><div><strong>Đơn #{item.id} · {spots.data?.find((s) => s.id === item.parkingSpotId)?.code || 'Chỗ đỗ'}</strong><span>{dateTime(item.startUtc)} – {dateTime(item.endUtc)}</span><span className="status-text">{reservationStatus[item.status]}</span></div>{item.status === 1 && <button className="text-danger" onClick={() => cancel(item.id)}>Hủy</button>}</div>)}</div>}</section></div>
  </main>
}
