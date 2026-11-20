import { useState } from 'react'
import { Link } from 'react-router'
import Icon from '../components/Icon'
import { useAuth } from '../auth/useAuth'
import { api } from '../lib/api'
import { useResource } from '../lib/useResource'
import { dateTime, money, parkingDuration, vehicleType } from '../lib/format'
import { Notice, Loading, Empty, Field } from '../components/Ui'
import QrImage from '../components/QrImage'
import ParkingFeeBreakdown from '../components/ParkingFeeBreakdown'

function GateHeader({ outbound = false }) {
  return <div className="portal-hero gate-hero">
    <div className="portal-hero-copy">
      <p className="portal-kicker">{outbound ? 'Cổng ra' : 'Cổng vào'}</p>
      <h1>{outbound ? 'Trả xe & thu phí' : 'Ghi nhận xe vào'}</h1>
      <p>{outbound ? 'Tìm lượt gửi, xác nhận xe ra và ghi nhận thanh toán.' : 'Xác nhận xe có lịch hẹn theo bãi phụ trách hoặc tra biển số xe đến trực tiếp.'}</p>
    </div>
    <Link className="button portal-hero-action" to={outbound ? '/staff/check-in' : '/staff/check-out'}>
      {outbound ? 'Chuyển sang nhận xe' : 'Chuyển sang trả xe'} <Icon name="arrow" size={16} />
    </Link>
  </div>
}

function ArrivalQueue({ lots, arrivals, busy, onCheckIn }) {
  const groups = new Map(lots.map((lot) => [lot.id, []]))
  for (const arrival of arrivals.data || []) groups.get(arrival.lotId)?.push(arrival)

  return <section className="panel arrival-queue" aria-labelledby="arrivals-title">
    <div className="panel-head">
      <div><h2 id="arrivals-title">Lịch xe vào theo bãi</h2><p>Các lịch đã xác nhận còn hiệu lực hoặc sẽ đến trong 24 giờ tới.</p></div>
      <button type="button" className="button light-button" disabled={busy || arrivals.loading} onClick={arrivals.refresh}>Cập nhật</button>
    </div>
    {arrivals.loading ? <Loading /> : arrivals.error ? <Notice error={arrivals.error} /> : lots.map((lot) => <section className="arrival-group" key={lot.id}>
      <h3>{lot.name}</h3>
      {groups.get(lot.id).length ? <ul className="reservation-list">{groups.get(lot.id).map((item) =>
        <li className="reservation-list-item" key={item.id}>
          <div className="reservation-list-title"><strong>{item.plateNumber}</strong><span>Ô {item.code} · Lịch #{item.id}</span></div>
          <div className="reservation-list-time"><span>Đến {dateTime(item.startUtc)}</span><span>Lấy xe {dateTime(item.endUtc)}</span></div>
          <div className="reservation-row-actions">
            <button type="button" className="button main-button" disabled={busy || !item.canCheckIn}
              onClick={() => onCheckIn({ vehicleId: item.vehicleId, parkingSpotId: item.parkingSpotId, reservationId: item.id })}>Xác nhận xe vào</button>
            {!item.canCheckIn && <small>Chưa thể nhận xe</small>}
          </div>
        </li>)}</ul> : <p className="helper-text">Chưa có lịch xe vào.</p>}
    </section>)}
  </section>
}

export function StaffCheckInPage() {
  const { token } = useAuth()
  const lots = useResource('/api/parking-lots/assigned', token)
  const spots = useResource('/api/parking-spots/operational', token)
  const arrivals = useResource('/api/reservations/arrivals', token, { refreshInterval: 15000 })
  const [plate, setPlate] = useState('')
  const [matches, setMatches] = useState([])
  const [searched, setSearched] = useState(false)
  const [reservations, setReservations] = useState([])
  const [vehicleId, setVehicleId] = useState('')
  const [lotId, setLotId] = useState('')
  const [spotId, setSpotId] = useState('')
  const [reservationId, setReservationId] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const vehicle = matches.find((v) => v.id === Number(vehicleId))
  const selectedLot = lots.data?.find((lot) => String(lot.id) === lotId) || (lots.data?.length === 1 ? lots.data[0] : null)
  const candidates = spots.data?.filter((s) => s.parkingLotId === selectedLot?.id && s.isActive && (!vehicle || s.type === vehicle.type)) || []

  async function search(event) {
    event.preventDefault(); setBusy(true); setError(''); setMessage('')
    try {
      const term = encodeURIComponent(plate.trim())
      const [found, bookings] = await Promise.all([api(`/api/vehicles/search?plate=${term}`, { token }), api(`/api/reservations/active?plate=${term}`, { token })])
      setMatches(found); setReservations(bookings); setVehicleId(''); setReservationId(''); setSpotId(''); setSearched(true)
    } catch (cause) { setError(cause.message) } finally { setBusy(false) }
  }
  async function checkIn(body) {
    setBusy(true); setError(''); setMessage('')
    try {
      const result = await api('/api/parking-sessions/check-in', { method: 'POST', token, body })
      setMessage(`Đã ghi nhận xe vào. Mã lượt gửi #${result.id}.`); setSpotId(''); setReservationId('')
      setReservations((items) => items.filter((item) => item.id !== body.reservationId))
    } catch (cause) { setError(cause.message) }
    finally { arrivals.refresh(); setBusy(false) }
  }
  function checkInFromForm(event) {
    event.preventDefault()
    return checkIn({ vehicleId: Number(vehicleId), parkingSpotId: Number(spotId), reservationId: reservationId ? Number(reservationId) : null })
  }

  return <main className="page-wrap staff-home"><GateHeader />
    <Notice error={error || lots.error || spots.error} success={message} />
    {lots.loading && <Loading />}
    {lots.data?.length === 0 && <Empty>Tài khoản chưa phụ trách bãi nào. Admin có thể phân công trong mục Nhân viên.</Empty>}
    {lots.data?.length > 0 && <>
    <ArrivalQueue lots={lots.data} arrivals={arrivals} busy={busy} onCheckIn={checkIn} />
    <div className="two-column gate-grid"><section className="panel"><h2>Tra cứu biển số</h2><form onSubmit={search} className="gate-search"><Field label="Biển số xe"><input value={plate} onChange={(event) => {
      setPlate(event.target.value); setSearched(false); setMatches([]); setReservations([])
      setVehicleId(''); setReservationId(''); setSpotId('')
    }} autoCapitalize="characters" minLength={2} disabled={busy} required placeholder="Ví dụ 43A-123.45" /></Field><button className="button main-button" disabled={busy}><Icon name="search" size={17} /> Tìm xe</button></form>
      {matches.length > 0 && <div className="data-list">{matches.map((item) => <button type="button" aria-pressed={vehicleId === String(item.id)} className={`choice-row ${vehicleId === String(item.id) ? 'chosen' : ''}`} key={item.id} onClick={() => { setVehicleId(String(item.id)); setSpotId(''); setReservationId('') }}>{item.plateNumber} <span>{vehicleType(item.type)}</span></button>)}</div>}
      {!busy && searched && matches.length === 0 && <Empty>Không tìm thấy xe. Kiểm tra lại biển số hoặc đề nghị khách đăng ký xe.</Empty>}
      {reservations.length > 0 && <p className="helper-text">Tìm thấy {reservations.length} lịch đặt còn hiệu lực cho biển số này.</p>}
    </section>
    <form className="panel" onSubmit={checkInFromForm}><h2>Xác nhận lượt gửi</h2>
      <div className="gate-selected"><span>Xe được chọn</span><strong>{vehicle?.plateNumber || 'Chưa chọn xe'}</strong></div>
      <Field label="Bãi phụ trách"><select value={selectedLot?.id ?? ''} onChange={(event) => { setLotId(event.target.value); setSpotId(''); setReservationId('') }} required>
        {lots.data.length > 1 && <option value="">Chọn bãi xe</option>}
        {lots.data.map((lot) => <option key={lot.id} value={lot.id}>{lot.name}</option>)}
      </select></Field>
      <Field label="Chỗ đỗ"><select value={spotId} onChange={(event) => { setSpotId(event.target.value); setReservationId('') }} required><option value="">Chọn chỗ phù hợp</option>{candidates.map((spot) => <option key={spot.id} value={spot.id}>{spot.code} · {vehicleType(spot.type)}</option>)}</select></Field>
      <Field label="Lịch đặt (nếu có)"><select value={reservationId} onChange={(event) => { const id = event.target.value; setReservationId(id); const booking = reservations.find((r) => r.id === Number(id)); if (booking) { const target = spots.data?.find((s) => s.id === booking.parkingSpotId); setVehicleId(String(booking.vehicleId)); setLotId(String(target?.parkingLotId || '')); setSpotId(String(booking.parkingSpotId)) } }}><option value="">Không có lịch đặt</option>{reservations.filter((r) => !vehicleId || r.vehicleId === Number(vehicleId)).map((r) => <option key={r.id} value={r.id}>#{r.id} · {r.code} · {dateTime(r.startUtc)}</option>)}</select></Field>
      <button className="button main-button" disabled={busy || !vehicle || !candidates.some((spot) => spot.id === Number(spotId))}>Xác nhận xe vào</button>
    </form></div></>}
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
  const [query, setQuery] = useState('')
  const plateQuery = query.replace(/[^a-z0-9]/gi, '').toUpperCase()
  const matchingPlate = (item) => item.plateNumber.replace(/[^a-z0-9]/gi, '').toUpperCase().includes(plateQuery)
  const activeMatches = (active.data || []).filter(matchingPlate)
  const unpaidMatches = (unpaid.data || []).filter(matchingPlate)

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

  return <main className="page-wrap staff-home">
    <GateHeader outbound />
    <Notice error={error || active.error || unpaid.error} success={message} />
    <div className="panel gate-queue-toolbar">
      <Field label="Lọc theo biển số"><input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Nhập biển số xe" /></Field>
      <button className="button light-button" type="button" disabled={active.loading || unpaid.loading} onClick={() => { active.refresh(); unpaid.refresh() }}>Cập nhật danh sách</button>
    </div>
    <section className="panel gate-queue">
      <div className="panel-head"><h2>Xe đang trong bãi</h2><span className="gate-count">{active.data?.length ?? '—'} xe</span></div>
      {active.loading ? <Loading /> : active.error ? null : !activeMatches.length ? <Empty>{plateQuery ? 'Không có xe phù hợp.' : 'Hiện không có xe đang gửi.'}</Empty> :
        <div className="data-list">{activeMatches.map((item) => <div className="data-item" key={item.id}>
          <div><strong>{item.plateNumber} · Ô {item.code}</strong><span>{item.lotName} · Vào bãi {dateTime(item.checkInUtc)} · Lượt #{item.id}</span></div>
          <button className="button main-button" disabled={busyId != null} onClick={() => checkOut(item.id)}>Ghi nhận xe ra</button>
        </div>)}</div>}
    </section>
    <section className="panel gate-queue section-gap">
      <div className="panel-head"><h2>Chờ thanh toán</h2><span className="gate-count">{unpaid.data?.length ?? '—'} lượt</span></div>
      {unpaid.loading ? <Loading /> : unpaid.error ? null : !unpaidMatches.length ? <Empty>{plateQuery ? 'Không có lượt phù hợp.' : 'Không có lượt gửi chờ thanh toán.'}</Empty> :
        <div className="data-list">{unpaidMatches.map((item) => <div className="data-item" key={item.id}>
          <div><strong>{item.plateNumber} · {money(item.fee)}</strong><span>{item.lotName} · Ra bãi {dateTime(item.checkOutUtc)} · Gửi {parkingDuration(Date.parse(item.checkOutUtc) - Date.parse(item.checkInUtc))} · Lượt #{item.id}</span><ParkingFeeBreakdown charge={item} /></div>
          <div className="payment-actions">
            <button className="button light-button" disabled={busyId != null} onClick={() => openTransfer(item.id)}>Chuyển khoản QR</button>
            <button className="button main-button" disabled={busyId != null} onClick={() => pay(item.id)}>Đã thu tiền mặt</button>
          </div>
        </div>)}</div>}
    </section>
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
