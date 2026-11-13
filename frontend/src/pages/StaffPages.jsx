import { useState } from 'react'
import { Link } from 'react-router'
import { useAuth } from '../auth/useAuth'
import { api } from '../lib/api'
import { useResource } from '../lib/useResource'
import { dateTime, money, vehicleType } from '../lib/format'
import { PageHeader, Notice, Loading, Empty, Field } from '../components/Ui'
import QrImage from '../components/QrImage'

export function StaffCheckInPage() {
  const { token } = useAuth()
  const lots = useResource('/api/parking-lots')
  const spots = useResource('/api/parking-spots')
  const [plate, setPlate] = useState('')
  const [matches, setMatches] = useState([])
  const [reservations, setReservations] = useState([])
  const [vehicleId, setVehicleId] = useState('')
  const [lotId, setLotId] = useState('')
  const [spotId, setSpotId] = useState('')
  const [reservationId, setReservationId] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const vehicle = matches.find((v) => v.id === Number(vehicleId))
  const candidates = spots.data?.filter((s) => s.parkingLotId === Number(lotId) && s.isActive && (!vehicle || s.type === vehicle.type)) || []

  async function search(event) {
    event.preventDefault(); setBusy(true); setError(''); setMessage('')
    try {
      const term = encodeURIComponent(plate.trim())
      const [found, bookings] = await Promise.all([api(`/api/vehicles/search?plate=${term}`, { token }), api(`/api/reservations/active?plate=${term}`, { token })])
      setMatches(found); setReservations(bookings); setVehicleId(''); setReservationId('')
    } catch (cause) { setError(cause.message) } finally { setBusy(false) }
  }
  async function checkIn(event) {
    event.preventDefault(); setBusy(true); setError(''); setMessage('')
    try {
      const result = await api('/api/parking-sessions/check-in', { method: 'POST', token, body: { vehicleId: Number(vehicleId), parkingSpotId: Number(spotId), reservationId: reservationId ? Number(reservationId) : null } })
      setMessage(`Đã ghi nhận xe vào. Mã lượt gửi #${result.id}.`); setSpotId(''); setReservationId('')
    } catch (cause) { setError(cause.message) } finally { setBusy(false) }
  }

  return <main className="page-wrap"><PageHeader eyebrow="NHÂN VIÊN · CỔNG VÀO" title="Ghi nhận xe vào" description="Tra biển số, chọn chỗ phù hợp và xác nhận lượt gửi xe." actions={<Link className="button light-button" to="/staff/check-out">Chuyển sang trả xe →</Link>} />
    <Notice error={error || lots.error || spots.error} success={message} />
    <div className="two-column"><section className="panel"><h2>1. Tìm xe</h2><form onSubmit={search} className="inline-form"><Field label="Biển số xe"><input value={plate} onChange={(event) => setPlate(event.target.value)} minLength={2} required placeholder="Nhập ít nhất 2 ký tự" /></Field><button className="button main-button" disabled={busy}>Tìm xe</button></form>
      {matches.length > 0 && <div className="data-list">{matches.map((item) => <button type="button" className={`choice-row ${vehicleId === String(item.id) ? 'chosen' : ''}`} key={item.id} onClick={() => { setVehicleId(String(item.id)); setSpotId('') }}>{item.plateNumber} <span>{vehicleType(item.type)}</span></button>)}</div>}
      {!busy && plate && matches.length === 0 && <p className="helper-text">Không có xe nào trong kết quả hiện tại. Xe cần được khách đăng ký trước.</p>}
      {reservations.length > 0 && <p className="helper-text">Tìm thấy {reservations.length} lịch đặt còn hiệu lực cho biển số này.</p>}
    </section>
    <form className="panel" onSubmit={checkIn}><h2>2. Chọn vị trí</h2><Field label="Bãi xe"><select value={lotId} onChange={(event) => { setLotId(event.target.value); setSpotId('') }} required><option value="">Chọn bãi xe</option>{lots.data?.map((lot) => <option key={lot.id} value={lot.id}>{lot.name}</option>)}</select></Field>
      <Field label="Chỗ đỗ"><select value={spotId} onChange={(event) => setSpotId(event.target.value)} required><option value="">Chọn chỗ phù hợp</option>{candidates.map((spot) => <option key={spot.id} value={spot.id}>{spot.code} · {vehicleType(spot.type)}</option>)}</select></Field>
      <Field label="Lịch đặt (nếu có)"><select value={reservationId} onChange={(event) => { const id = event.target.value; setReservationId(id); const booking = reservations.find((r) => r.id === Number(id)); if (booking) { const target = spots.data?.find((s) => s.id === booking.parkingSpotId); setVehicleId(String(booking.vehicleId)); setLotId(String(target?.parkingLotId || '')); setSpotId(String(booking.parkingSpotId)) } }}><option value="">Không có lịch đặt</option>{reservations.filter((r) => !vehicleId || r.vehicleId === Number(vehicleId)).map((r) => <option key={r.id} value={r.id}>#{r.id} · {r.code} · {dateTime(r.startUtc)}</option>)}</select></Field>
      <p className="helper-text">Hệ thống kiểm tra xe, loại chỗ và lịch đặt ngay khi ghi nhận.</p><button className="button main-button" disabled={busy || !vehicleId}>Xác nhận xe vào</button>
    </form></div>
  </main>
}

export function StaffCheckOutPage() {
  const { token } = useAuth()
  const active = useResource('/api/parking-sessions/active', token)
  const unpaid = useResource('/api/parking-sessions/unpaid', token)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [busyId, setBusyId] = useState(null)
  const [transfer, setTransfer] = useState(null)
  const [transaction, setTransaction] = useState('')

  async function checkOut(id) {
    setBusyId(id); setError(''); setMessage('')
    try {
      const result = await api(`/api/parking-sessions/${id}/check-out`, { method: 'POST', token })
      setMessage(`Đã ghi nhận xe ra. Phí cần thanh toán: ${money(result.fee)}.`)
      active.refresh(); unpaid.refresh()
    } catch (cause) { setError(cause.message) } finally { setBusyId(null) }
  }
  async function openTransfer(id) {
    setBusyId(id); setError(''); setMessage('')
    try { const details = await api('/api/payments/parking-session/' + id + '/transfer', { token }); setTransfer({ ...details, id }); setTransaction('') }
    catch (cause) { setError(cause.message) }
    finally { setBusyId(null) }
  }
  async function pay(id, method = 1) {
    setBusyId(id); setError(''); setMessage('')
    try { await api(`/api/payments/parking-session/${id}`, { method: 'POST', token, body: { method, note: method === 3 ? transaction.trim() : undefined } }); setMessage(`Đã ghi nhận thanh toán cho lượt #${id}.`); setTransfer(null); unpaid.refresh() }
    catch (cause) { setError(cause.message) } finally { setBusyId(null) }
  }

  return <main className="page-wrap"><PageHeader eyebrow="NHÂN VIÊN · CỔNG RA" title="Trả xe & thanh toán" description="Ghi nhận xe ra, kiểm tra phí và thu tiền mặt hoặc chuyển khoản tại quầy." actions={<Link className="button light-button" to="/staff/check-in">← Nhận xe</Link>} /><Notice error={error || active.error || unpaid.error} success={message} />
    <section className="panel"><div className="panel-head"><h2>Xe đang trong bãi</h2><button className="button light-button" onClick={active.refresh}>Cập nhật</button></div>{active.loading ? <Loading /> : !active.data?.length ? <Empty>Hiện không có xe đang gửi.</Empty> : <div className="data-list">{active.data.map((item) => <div className="data-item" key={item.id}><div><strong>{item.plateNumber} · chỗ {item.code}</strong><span>Vào bãi: {dateTime(item.checkInUtc)} · Lượt #{item.id}</span></div><button className="button main-button" disabled={busyId === item.id} onClick={() => checkOut(item.id)}>Ghi nhận xe ra</button></div>)}</div>}</section>
    <section className="panel section-gap"><div className="panel-head"><div><h2>Chờ thanh toán</h2><p>Chỉ ghi nhận sau khi đã thu tiền hoặc xác minh giao dịch.</p></div><button className="button light-button" onClick={unpaid.refresh}>Cập nhật</button></div>{unpaid.loading ? <Loading /> : !unpaid.data?.length ? <Empty>Không có lượt gửi chờ thanh toán.</Empty> : <div className="data-list">{unpaid.data.map((item) => <div className="data-item" key={item.id}><div><strong>{item.plateNumber} · {money(item.fee)}</strong><span>Ra bãi: {dateTime(item.checkOutUtc)} · Lượt #{item.id}</span></div><div className="payment-actions"><button className="button light-button" disabled={busyId != null} onClick={() => openTransfer(item.id)}>Chuyển khoản QR</button><button className="button main-button" disabled={busyId != null} onClick={() => pay(item.id)}>Đã thu tiền mặt</button></div></div>)}</div>}</section>
    {transfer && <section className="panel section-gap">
      <div className="panel-head"><h2>Chuyển khoản lượt #{transfer.id}</h2><button className="button light-button" type="button" onClick={() => setTransfer(null)}>Đóng</button></div>
      {transfer.enabled ? <form onSubmit={(event) => { event.preventDefault(); pay(transfer.id, 3) }}>
        <div className="qr-block"><QrImage key={transfer.id} value={transfer.payload} label="Mã VietQR chuyển khoản phí gửi xe" /><div><p>{transfer.name} · {transfer.account}</p><p><strong>{money(transfer.amount)}</strong> · Nội dung: <code>{transfer.reference}</code></p></div></div>
        <p>Kiểm tra số tiền và nội dung trên tài khoản nhận trước khi xác nhận.</p>
        <Field label="Mã giao dịch đã đối soát"><input maxLength={80} value={transaction} onChange={(event) => setTransaction(event.target.value)} required /></Field>
        <button className="button main-button" disabled={busyId != null || !transaction.trim()}>Xác nhận đã nhận chuyển khoản</button>
      </form> : <p>Bãi xe chưa cấu hình tài khoản nhận chuyển khoản. Bạn có thể thu tiền mặt.</p>}
    </section>}
  </main>
}
