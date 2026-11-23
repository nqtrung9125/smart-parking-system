import { useState } from 'react'
import { api } from '../lib/api'
import { bookingInputTime, hourMs } from '../lib/bookingTime'
import { dateTime, money } from '../lib/format'
import { useResource } from '../lib/useResource'
import { Field, Loading, Notice } from './Ui'
import ParkingFeeBreakdown from './ParkingFeeBreakdown'
import './parking-extension.css'

const durations = [[1, 'Thêm 1 giờ'], [2, 'Thêm 2 giờ'], [24, 'Thêm 1 ngày']]

export default function ParkingExtensionForm({ session, token, onChange }) {
  const base = '/api/parking-extensions/mine/'
  const [open, setOpen] = useState(false)
  const [end, setEnd] = useState('')
  const [quotedEnd, setQuotedEnd] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const quote = useResource(open && quotedEnd ? base + session.id + '/quote?' + new URLSearchParams({ endUtc: quotedEnd }) : null, token)
  const result = quote.data
  const pending = session.extension?.status === 1

  function setDeadline(value) {
    setEnd(value)
    setQuotedEnd('')
    setError('')
  }

  function preview(event) {
    event.preventDefault()
    const date = new Date(end)
    if (!Number.isFinite(date.getTime())) return
    const iso = date.toISOString()
    setError('')
    if (quotedEnd === iso) quote.refresh()
    else setQuotedEnd(iso)
  }

  async function confirm() {
    setBusy(true)
    setError('')
    try {
      const saved = await api(base + session.id, { method: 'POST', token, body: {
        previousEndUtc: result.previousEndUtc, endUtc: result.endUtc, expectedFee: result.after.total,
      } })
      onChange(saved.status === 1 ? 'Đã gửi yêu cầu gia hạn cho nhân viên.' :
        'Đã gia hạn đến ' + dateTime(saved.requestedEndUtc) + '.')
    } catch (cause) {
      setError(cause.message)
      if (cause.status === 409) quote.refresh()
    } finally { setBusy(false) }
  }

  async function cancel() {
    setBusy(true)
    setError('')
    try {
      await api(base + session.extension.id + '/cancel', { method: 'POST', token })
      onChange('Đã hủy yêu cầu gia hạn.')
    } catch (cause) { setError(cause.message) }
    finally { setBusy(false) }
  }

  if (!session.scheduledEndUtc) return null

  return <section className="parking-extension" aria-label="Gia hạn gửi xe">
    <Notice error={error || quote.error} />
    {pending ? <div className="extension-pending">
      <strong>Chờ duyệt gia hạn</strong>
      <p>Giờ lấy xe đề nghị {dateTime(session.extension.requestedEndUtc)} · Dự kiến {money(session.extension.estimatedFee)}</p>
      <button type="button" className="button light-button" disabled={busy} onClick={cancel}>Hủy yêu cầu</button>
    </div> : !open ? <>
      {session.extension?.status === 3 && <p className="helper-text">Nhân viên đã từ chối yêu cầu gia hạn gần nhất.</p>}
      <button type="button" className="button light-button" onClick={() => {
        const from = Math.max(Date.parse(session.scheduledEndUtc), Date.now())
        setDeadline(bookingInputTime(from + hourMs))
        setOpen(true)
      }}>Gia hạn gửi xe</button>
    </> : <>
      <form className="extension-form" onSubmit={preview}>
        <div className="panel-head">
          <h3>Gia hạn gửi xe</h3>
          <button type="button" className="button light-button" disabled={busy} onClick={() => { setOpen(false); setError('') }}>Đóng</button>
        </div>
        <Field label="Giờ lấy xe mới"><input type="datetime-local" value={end} disabled={busy}
          onChange={(event) => setDeadline(event.target.value)} required /></Field>
        <div className="payment-actions" aria-label="Chọn nhanh thời gian">
          {durations.map(([hours, label]) => <button key={hours} type="button" className="button light-button" disabled={busy}
            onClick={() => setDeadline(bookingInputTime(Math.max(Date.parse(session.scheduledEndUtc), Date.now()) + hours * hourMs))}>{label}</button>)}
        </div>
        <button type="submit" className="button light-button" disabled={busy || quote.loading}>Xem trước phí</button>
      </form>
      {quote.loading && <Loading>Đang kiểm tra lịch ô đỗ và tính phí…</Loading>}
      {result?.blockedReason && <>
        <Notice error={result.blockedReason} />
        {Date.parse(result.latestEndUtc) > Math.max(Date.parse(result.quotedAtUtc), Date.parse(result.previousEndUtc)) && <button type="button"
          className="button light-button" onClick={() => {
            const local = bookingInputTime(result.latestEndUtc)
            setDeadline(local)
            setQuotedEnd(new Date(local).toISOString())
          }}>Xem phí đến {dateTime(result.latestEndUtc)}</button>}
      </>}
      {result && !result.blockedReason && <div className="extension-quote">
        <dl className="extension-comparison">
          <div><dt>{result.requiresReview ? 'Phí nếu lấy xe lúc này' : 'Phí theo lịch hiện tại'}</dt><dd>{money(result.before.total)}</dd></div>
          <div><dt>Tổng dự kiến sau gia hạn</dt><dd>{money(result.after.total)}</dd></div>
          <div><dt>Phí tăng thêm</dt><dd>{money(result.after.total - result.before.total)}</dd></div>
        </dl>
        <ParkingFeeBreakdown charge={result.after} />
        {result.requiresReview && <p className="helper-text">Nhân viên cần duyệt vì lượt gửi đã quá hạn.
          {' '}Tổng phí đã gồm khoản trễ phát sinh đến lúc gửi yêu cầu ({money(result.newLateFee)}).</p>}
        <p className="helper-text">Giờ lấy xe đề nghị {dateTime(result.endUtc)}. Thanh toán khi lấy xe.</p>
        <button className="button main-button" type="button" disabled={busy} onClick={confirm}>
          {busy ? 'Đang xử lý…' : result.requiresReview ? 'Gửi yêu cầu gia hạn' : 'Xác nhận gia hạn'}
        </button>
      </div>}
    </>}
  </section>
}
