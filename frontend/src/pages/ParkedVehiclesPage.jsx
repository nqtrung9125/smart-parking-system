import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { useAuth } from '../auth/useAuth'
import { useResource } from '../lib/useResource'
import { api } from '../lib/api'
import { dateTime, money, vehicleType } from '../lib/format'
import BookingPreview from '../components/BookingPreview'
import ParkingFeeBreakdown from '../components/ParkingFeeBreakdown'
import ParkingExtensionForm from '../components/ParkingExtensionForm'
import { Empty, Loading, Notice, PageHeader } from '../components/Ui'

function CustomerCheckout({ session, token }) {
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const base = '/api/parking-sessions/mine/' + session.id
  const quote = useResource(open ? base + '/checkout-quote' : null, token)
  const billPage = '/payments?session=' + session.id
  const charge = quote.data?.charge

  async function confirmCheckout() {
    setBusy(true)
    setError('')
    try {
      await api(base + '/check-out', { method: 'POST', token, body: { expectedFee: charge.total } })
      navigate(billPage)
    } catch (cause) {
      setError(cause.message)
      if (cause.status === 409) quote.refresh()
    } finally { setBusy(false) }
  }

  return <section className="customer-checkout" aria-label="Trả xe và thanh toán">
    {!open ? <div className="payment-actions">
      <button type="button" className="button main-button" onClick={() => setOpen(true)}>Xem phí và trả xe</button>
      <Link className="button light-button" to="/payments">Xem thanh toán</Link>
    </div> : <>
      {quote.loading && <Loading>Đang tính phí trả xe…</Loading>}
      <Notice error={quote.error || error} />
      {charge && <>
        <div className="bill-amount"><span>Phí dự tính khi trả xe lúc này</span><strong>{money(charge.total)}</strong></div>
        <ParkingFeeBreakdown charge={charge} />
        {quote.data.depositApplied > 0 && <p>Trừ tiền cọc {money(quote.data.depositApplied)} · Còn phải trả <strong>{money(quote.data.amountDue)}</strong></p>}
        <p className="helper-text">Chỉ xác nhận sau khi bạn đã đưa xe ra khỏi ô đỗ.</p>
      </>}
      <div className="payment-actions">
        {charge && <button type="button" className="button main-button" disabled={busy} onClick={confirmCheckout}>
          {busy ? 'Đang xác nhận…' : 'Xác nhận xe ra và thanh toán'}
        </button>}
        <button type="button" className="button light-button" disabled={busy} onClick={() => { setOpen(false); setError('') }}>Đóng</button>
        {quote.error && <Link className="button light-button" to={billPage}>Xem hóa đơn</Link>}
      </div>
    </>}
  </section>
}

export default function ParkedVehiclesPage() {
  const { token } = useAuth()
  const [params, setParams] = useSearchParams()
  const sessions = useResource('/api/parking-sessions/mine/active', token, { refreshInterval: 15000 })
  const [message, setMessage] = useState('')
  const active = sessions.data || []
  const selection = params.get('session')
  const selected = selection ? active.find((item) => String(item.id) === selection) : active[0]
  const map = useResource(selected ? '/api/parking-spots/map?parkingLotId=' + selected.lotId : null)

  return <main className="page-wrap">
    <PageHeader eyebrow="LẤY XE" title="Xe đang gửi" description="Xem vị trí xe của bạn trước khi đến lấy xe." actions={<button type="button" className="button light-button" disabled={sessions.loading} onClick={() => { sessions.refresh(); map.refresh() }}>↻ Cập nhật</button>} />
    <Notice success={message} />
    {sessions.loading ? <Loading /> : sessions.error ? <Notice error={sessions.error} /> : !active.length ? <>
      <Empty>Bạn không có xe đang gửi. Vị trí xe sẽ xuất hiện sau khi nhân viên ghi nhận xe vào bãi.</Empty>
      <div className="section-gap"><Link className="button light-button" to="/reservations">Xem lịch đặt chỗ</Link></div>
    </> : <div className="two-column booking-grid">
      <section className="panel">
        <h2>Chọn xe để tìm</h2>
        {selection && !selected && <Notice error="Lượt gửi này không còn trong danh sách xe đang gửi." />}
        <div className="parked-options" role="group" aria-label="Xe của bạn đang trong bãi">{active.map((item) =>
          <button key={item.id} type="button" className="choice-row parked-choice" aria-pressed={selected?.id === item.id}
            onClick={() => { setMessage(''); setParams({ session: String(item.id) }, { replace: true }) }}>
            <strong>{item.plateNumber}</strong><span>{item.lotName} · Ô {item.spotCode}</span>
          </button>
        )}</div>
        {selected && <>
          <dl className="parked-details">
            <div><dt>Ô đỗ</dt><dd className="parked-code">{selected.spotCode}</dd></div>
            <div><dt>Bãi xe</dt><dd>{selected.lotName}<small>{selected.lotAddress}</small></dd></div>
            <div><dt>Loại xe</dt><dd>{vehicleType(selected.vehicleType)}</dd></div>
            <div><dt>Giờ vào bãi</dt><dd>{dateTime(selected.checkInUtc)}</dd></div>
            {selected.scheduledEndUtc && <div><dt>Giờ lấy xe đã đặt</dt><dd>{dateTime(selected.scheduledEndUtc)}</dd></div>}
          </dl>
          <ParkingExtensionForm key={'extension:' + selected.id + ':' + selected.scheduledEndUtc} session={selected} token={token}
            onChange={(message) => { setMessage(message); sessions.refresh() }} />
          <CustomerCheckout key={selected.id + ':' + selected.scheduledEndUtc} session={selected} token={token} />
        </>}
      </section>
      {selected && <BookingPreview key={selected.id + ':' + params.get('view')} map={map} lot={{ name: selected.lotName }}
        spotId={selected.parkingSpotId} initialMode={params.get('view')} parked />}
    </div>}
  </main>
}
