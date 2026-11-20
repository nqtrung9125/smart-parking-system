import { useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { useAuth } from '../auth/useAuth'
import { api } from '../lib/api'
import { useResource } from '../lib/useResource'
import { dateTime, money, parkingDuration, spotStatus, vehicleType } from '../lib/format'
import { Notice, Loading, Empty, Field } from '../components/Ui'
import BookingPreview from '../components/BookingPreview'
import ReservationBadge from '../components/ReservationBadge'
import Icon from '../components/Icon'
import ParkingPriceTable from '../components/ParkingPriceTable'

const hourMs = 60 * 60 * 1000
const maxDuration = 30 * 24 * hourMs
const quickDurations = [[2, '2 giờ'], [24, '1 ngày'], [72, '3 ngày'], [168, '7 ngày']]

function localTime(date) {
  const pad = (value) => String(value).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

function ReservationHistory({ reservations, cancel, busy }) {
  return <section className="panel section-gap reservation-history" id="my-reservations" aria-labelledby="reservation-history-title">
    <div className="reservation-section-head">
      <h2 id="reservation-history-title">Đặt chỗ của tôi</h2>
      <button type="button" className="button light-button" onClick={reservations.refresh} disabled={reservations.loading || busy}>
        <Icon name="refresh" size={16} /> Cập nhật trạng thái
      </button>
    </div>
    {reservations.loading ? <Loading /> : reservations.error ? <Notice error={reservations.error} /> :
      reservations.data?.length ? <ul className="reservation-list">
        {reservations.data.map((item) => <li key={item.id} className="reservation-list-item">
          <div className="reservation-list-title">
            <strong>{item.lotName} · Ô {item.spotCode}</strong>
            <span>#{item.id} · {item.plateNumber}</span>
          </div>
          <div className="reservation-list-time">
            <span>Đến <strong>{dateTime(item.startUtc)}</strong></span>
            <span>Lấy xe <strong>{dateTime(item.endUtc)}</strong></span>
            {item.estimatedFee != null && <span>Phí dự kiến <strong>{money(item.estimatedFee)}</strong></span>}
            {item.rejectionReason && <span className="reservation-reason">Lý do từ chối: {item.rejectionReason}</span>}
          </div>
          <div className="reservation-row-actions">
            <ReservationBadge status={item.status} />
            {item.canCancel && <button type="button" className="text-danger" disabled={busy} onClick={() => cancel(item.id)}>Hủy đơn #{item.id}</button>}
          </div>
        </li>)}
      </ul> : <Empty>Bạn chưa có lượt đặt chỗ.</Empty>}
  </section>
}

export default function ReservationsPage() {
  const { token } = useAuth()
  const [params] = useSearchParams()
  const vehicles = useResource('/api/vehicles/mine', token)
  const lots = useResource('/api/parking-lots')
  const reservations = useResource('/api/reservations/mine', token, { refreshInterval: 15000 })
  const pricing = useResource('/api/pricing')
  const [vehicleId, setVehicleId] = useState('')
  const [lotId, setLotId] = useState(() => params.get('lot') || '')
  const [spotId, setSpotId] = useState(() => params.get('spot') || '')
  const [openedAt] = useState(Date.now)
  const [start, setStart] = useState(() => localTime(new Date(openedAt + 10 * 60000)))
  const [end, setEnd] = useState(() => localTime(new Date(openedAt + 70 * 60000)))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const selectedLot = lots.data?.find((lot) => lot.id === Number(lotId))
  const selectedVehicle = vehicles.data?.find((vehicle) => vehicle.id === Number(vehicleId))
  const startMs = Date.parse(start)
  const endMs = Date.parse(end)
  const duration = endMs - startMs
  const durationValid = duration > 0 && duration <= maxDuration
  const estimateQuery = selectedVehicle && durationValid && new URLSearchParams({
    vehicleType: String(selectedVehicle.type), startUtc: new Date(startMs).toISOString(), endUtc: new Date(endMs).toISOString(),
  })
  const estimate = useResource(estimateQuery ? '/api/pricing/estimate?' + estimateQuery : null)

  const mapQuery = selectedLot && durationValid && new URLSearchParams({
    parkingLotId: String(selectedLot.id),
    startUtc: new Date(startMs).toISOString(),
    endUtc: new Date(endMs).toISOString(),
  })
  const spotMap = useResource(mapQuery ? '/api/parking-spots/map?' + mapQuery : null)
  const compatibleSpots = (spotMap.data || []).filter((spot) => !selectedVehicle || spot.type === selectedVehicle.type)
  const chosenSpot = compatibleSpots.find((spot) => spot.id === Number(spotId))
  const availableSpots = compatibleSpots.filter((spot) => spot.status === 'Available')

  async function create(event) {
    event.preventDefault()
    setError('')
    setMessage('')
    if (!durationValid || startMs <= openedAt) {
      setError('Chọn giờ đến trong tương lai và giờ lấy xe trong vòng 30 ngày sau khi đến.')
      return
    }
    if (chosenSpot?.status !== 'Available' || !selectedVehicle || !estimate.data || pricing.error) return
    setBusy(true)
    try {
      const result = await api('/api/reservations', { method: 'POST', token, body: {
        vehicleId: selectedVehicle.id, parkingSpotId: chosenSpot.id,
        startUtc: new Date(startMs).toISOString(), endUtc: new Date(endMs).toISOString(), expectedFee: estimate.data.total,
      } })
      setMessage(`Đã gửi yêu cầu #${result.id}. Xem kết quả duyệt trong mục Đặt chỗ của tôi.`)
      reservations.refresh()
      spotMap.refresh()
    } catch (cause) {
      setError(cause.message)
      if (cause.status === 409) { spotMap.refresh(); pricing.refresh(); estimate.refresh() }
    } finally { setBusy(false) }
  }

  async function cancel(id) {
    if (!window.confirm('Hủy đơn đặt chỗ này?')) return
    setBusy(true)
    setError('')
    setMessage('')
    try {
      await api(`/api/reservations/${id}/cancel`, { method: 'POST', token })
      setMessage(`Đã hủy đơn #${id}.`)
      reservations.refresh()
      spotMap.refresh()
    } catch (cause) {
      setError(cause.message)
      if (cause.status === 409) reservations.refresh()
    } finally { setBusy(false) }
  }

  return <main className="page-wrap reservations-page">
    <section className="portal-hero reservation-hero">
      <div className="portal-hero-copy">
        <h1>Đặt chỗ đỗ xe</h1>
        <p>Chọn xe, bãi và khung giờ gửi. Quản lý bãi sẽ xác nhận yêu cầu trước giờ bạn đến.</p>
      </div>
      <a href="#my-reservations" className="button portal-hero-action"><Icon name="clock" size={17} /> Đặt chỗ của tôi</a>
    </section>
    <Notice error={error || vehicles.error || lots.error || pricing.error || estimate.error} success={message} />
    <div className="two-column booking-grid">
      <form className="panel booking-form" onSubmit={create}>
        <h2>Gửi yêu cầu đặt chỗ</h2>
        {!vehicles.loading && !vehicles.error && !vehicles.data?.length && <p className="helper-text">Bạn cần <Link to="/vehicles">đăng ký xe</Link> trước khi đặt chỗ.</p>}
        <div className="form-grid">
          <Field label="Xe của bạn"><select value={vehicleId} onChange={(event) => {
            const id = event.target.value
            const type = vehicles.data?.find((vehicle) => vehicle.id === Number(id))?.type
            if (type && chosenSpot?.type !== type) setSpotId('')
            setVehicleId(id)
          }} required>
            <option value="">{vehicles.loading ? 'Đang tải xe…' : 'Chọn xe'}</option>
            {vehicles.data?.map((vehicle) => <option key={vehicle.id} value={vehicle.id}>{vehicle.plateNumber} · {vehicleType(vehicle.type)}</option>)}
          </select></Field>
          <Field label="Bãi xe"><select value={lotId} onChange={(event) => { setLotId(event.target.value); setSpotId('') }} required>
            <option value="">Chọn bãi xe</option>
            {lots.data?.map((lot) => <option key={lot.id} value={lot.id}>{lot.name}</option>)}
          </select></Field>
        </div>
        <div className="form-grid">
          <Field label="Giờ đến"><input type="datetime-local" value={start} onChange={(event) => setStart(event.target.value)} required /></Field>
          <Field label="Giờ lấy xe dự kiến"><input type="datetime-local" value={end} min={start || undefined}
            max={Number.isFinite(startMs) ? localTime(new Date(startMs + maxDuration)) : undefined}
            onChange={(event) => setEnd(event.target.value)} required /></Field>
        </div>
        <div className="payment-actions booking-durations" role="group" aria-label="Chọn nhanh thời gian gửi">
          {quickDurations.map(([hours, label]) => <button type="button" key={hours} className="button light-button"
            disabled={!Number.isFinite(startMs)} aria-pressed={duration === hours * hourMs}
            onClick={() => setEnd(localTime(new Date(startMs + hours * hourMs)))}>{label}</button>)}
        </div>
        <p className="helper-text" aria-live="polite">{durationValid ? 'Thời gian dự kiến ' + parkingDuration(duration) + '. ' : ''}Mỗi lượt đặt tối đa 30 ngày.</p>
        <Field label="Ô đỗ" hint={spotMap.data ? availableSpots.length ? availableSpots.length + ' ô phù hợp đang nhận đặt chỗ.' : 'Hãy chọn khung giờ hoặc bãi khác.' : undefined}>
          <select value={chosenSpot ? spotId : ''} disabled={!spotMap.data} onChange={(event) => setSpotId(event.target.value)} required>
            <option value="">{spotMap.loading ? 'Đang kiểm tra ô đỗ…' : 'Chọn ô theo khung giờ'}</option>
            {chosenSpot && chosenSpot.status !== 'Available' && <option value={spotId} disabled>{chosenSpot.code} · {spotStatus[chosenSpot.status]}</option>}
            {availableSpots.map((spot) => <option key={spot.id} value={spot.id}>{spot.code} · {vehicleType(spot.type)}</option>)}
          </select>
        </Field>
        <div className="booking-estimate" aria-live="polite">
          <div><span>Dự kiến nếu ra đúng giờ</span><strong>{estimate.loading ? 'Đang tính…' : money(estimate.data?.total)}</strong></div>
          {pricing.data && <a href="#parking-prices">Xem bảng giá</a>}
        </div>
        {estimate.data && <p className="helper-text">{estimate.data.billableHours} giờ tính phí{estimate.data.surcharge > 0 ? ' · Đã gồm phụ phí ' + money(estimate.data.surcharge) : ''}. Hệ thống chốt phí khi xác nhận xe ra.</p>}
        <button className="button main-button" disabled={busy || !selectedVehicle || chosenSpot?.status !== 'Available' || !estimate.data || !pricing.data}>
          {busy ? 'Đang xử lý…' : 'Gửi yêu cầu'}
        </button>
      </form>
      <BookingPreview map={spotMap} lot={selectedLot} spotId={spotId} initialMode={params.get('view')?.toUpperCase()} />
    </div>
    {pricing.data && <ParkingPriceTable rates={pricing.data} />}
    <ReservationHistory reservations={reservations} cancel={cancel} busy={busy} />
  </main>
}
