import { useEffect, useRef, useState } from 'react'
import { Link, useLocation } from 'react-router'
import { useAuth } from '../auth/useAuth'
import { api } from '../lib/api'
import { money } from '../lib/format'
import './parking-assistant.css'

const suggestions = {
  customer: ['Tìm chỗ xe máy gần Cầu Rồng ngày mai từ 19:00 đến 22:00', 'Xe mình đang ở đâu?', 'Mở ví giúp mình'],
  staff: ['Hôm nay các bãi tôi phụ trách có xe nào sắp đến?', 'Mở trang dự báo'],
  admin: ['Bãi nào có doanh thu cao nhất tháng này?', 'Mở trang dự báo'],
}

const local = new Intl.DateTimeFormat('vi-VN', { dateStyle: 'short', timeStyle: 'short', timeZone: 'Asia/Ho_Chi_Minh' })
const time = value => local.format(new Date(value))

function BookingCard({ booking, busy, actionable, confirm, close }) {
  const { request, lotName, spotCode, plateNumber, lotId, balance } = booking
  const enough = balance >= request.expectedDeposit
  return <section className="assistant-card" aria-label="Đề xuất đặt chỗ">
    <h3>{lotName} · Ô {spotCode}</h3>
    <p>{plateNumber} · {time(request.startUtc)} – {time(request.endUtc)} (giờ Việt Nam)</p>
    <dl>
      <div><dt>Phí dự kiến</dt><dd>{money(request.expectedFee)}</dd></div>
      <div><dt>Cọc giữ chỗ</dt><dd>{money(request.expectedDeposit)}</dd></div>
      <div><dt>Dự kiến trả thêm</dt><dd>{money(request.expectedFee - request.expectedDeposit)}</dd></div>
      <div><dt>Số dư khả dụng</dt><dd>{money(balance)}</dd></div>
    </dl>
    <p>Hủy trước giờ đến được hoàn cọc. Hủy từ giờ đến hoặc vắng mặt sẽ mất cọc.</p>
    <div className="assistant-actions">
      <Link to={'/lots/' + lotId + '?spot=' + request.parkingSpotId} onClick={close}>Xem sơ đồ</Link>
      {enough ? <button type="button" disabled={busy || !actionable} onClick={() => confirm(booking)}>{busy ? 'Đang xử lý…' : 'Xác nhận đặt cọc'}</button> :
        <Link to="/wallet" onClick={close}>Nạp số dư</Link>}
    </div>
  </section>
}

function ExtensionCard({ extension, actionable, busy, confirm }) {
  return <section className="assistant-card" aria-label="Đề xuất gia hạn">
    <h3>Gia hạn xe {extension.plateNumber}</h3>
    <p>Giờ lấy mới {time(extension.endUtc)} (giờ Việt Nam)</p>
    <dl>
      <div><dt>Phí trước gia hạn</dt><dd>{money(extension.previousFee)}</dd></div>
      <div><dt>Phí dự kiến mới</dt><dd>{money(extension.expectedFee)}</dd></div>
      <div><dt>Chênh lệch</dt><dd>{money(extension.expectedFee - extension.previousFee)}</dd></div>
    </dl>
    {extension.requiresReview && <p>Lượt gửi đã quá hạn. Nhân viên cần duyệt yêu cầu này.</p>}
    <div className="assistant-actions">
      <button type="button" disabled={busy || !actionable} onClick={() => confirm(extension)}>
        {busy ? 'Đang xử lý…' : extension.requiresReview ? 'Gửi yêu cầu gia hạn' : 'Xác nhận gia hạn'}
      </button>
    </div>
  </section>
}

export default function ParkingAssistant() {
  const { user, token } = useAuth()
  return <AssistantPanel key={user?.id || 'guest'} user={user} token={token} />
}

function AssistantPanel({ user, token }) {
  const location = useLocation()
  const panel = useRef(null)
  const launcher = useRef(null)
  const input = useRef(null)
  const log = useRef(null)
  const inFlight = useRef(false)
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState('')
  const [messages, setMessages] = useState([])
  const [status, setStatus] = useState('')
  const [error, setError] = useState('')
  const [canRefreshQuote, setCanRefreshQuote] = useState(false)
  const [completed, setCompleted] = useState(null)
  const role = user?.roles.includes('Admin') ? 'admin' : user?.roles.includes('Staff') ? 'staff' : 'customer'

  function close(restoreFocus = false) {
    panel.current.close()
    setOpen(false)
    if (restoreFocus) launcher.current?.focus()
  }

  function toggle() {
    if (panel.current.open) { close(true); return }
    panel.current.show()
    input.current?.focus()
    setOpen(true)
  }

  useEffect(() => {
    if (log.current) log.current.scrollTop = log.current.scrollHeight
  }, [messages, status, error, open])

  async function send(raw) {
    const text = raw.trim()
    if (!text || !token || inFlight.current) return
    const previous = [...messages, { role: 'user', text }]
    setMessages(previous)
    setDraft('')
    setError('')
    setStatus('Đang tìm thông tin…')
    inFlight.current = true
    try {
      const history = previous.slice(-9).map(({ role, text }) => ({ role, text }))
      const result = await api('/api/assistant/messages', { method: 'POST', token, body: { messages: history } })
      setCanRefreshQuote(false)
      setCompleted(null)
      setMessages([...previous, { ...result, role: 'assistant' }])
    } catch (cause) {
      setMessages(messages)
      setDraft(text)
      setError(cause.message)
    } finally {
      inFlight.current = false
      setStatus('')
    }
  }

  async function confirm(proposal, type) {
    if (inFlight.current || completed === proposal) return
    const booking = type === 'booking'
    inFlight.current = true
    setStatus('Đang xác nhận…')
    setError('')
    setCanRefreshQuote(false)
    try {
      const body = booking ? proposal.request : {
        previousEndUtc: proposal.previousEndUtc, endUtc: proposal.endUtc, expectedFee: proposal.expectedFee,
      }
      const result = await api(booking ? '/api/reservations' : '/api/parking-extensions/mine/' + proposal.sessionId,
        { method: 'POST', token, body })
      setCompleted(proposal)
      const text = booking ? `Đã đặt chỗ #${result.id}.` : result.status === 1 ?
        'Đã gửi yêu cầu gia hạn. Nhân viên sẽ xem xét.' : 'Đã xác nhận gia hạn.'
      const link = booking ? { label: 'Mở lịch vừa đặt', path: '/reservations#my-reservations' } :
        { label: 'Mở lượt gửi', path: '/parked?session=' + proposal.sessionId }
      setMessages(current => [...current, { role: 'assistant', text, links: [link] }])
    } catch (cause) {
      setError(cause.message)
      if (cause.status === 409) {
        setCompleted(proposal)
        setCanRefreshQuote(true)
      }
    } finally {
      inFlight.current = false
      setStatus('')
    }
  }

  return <div className="parking-assistant">
    <button ref={launcher} type="button" className="assistant-launcher" onClick={toggle}
      aria-expanded={open} aria-controls="parking-assistant-panel">Trợ lý AI <span aria-hidden="true">↗</span></button>
    <dialog ref={panel} id="parking-assistant-panel" className="assistant-panel" aria-labelledby="assistant-title"
      onKeyDown={event => { if (event.key === 'Escape') close(true) }}>
      <header><div><h2 id="assistant-title">Trợ lý Smart Parking</h2><span>Tìm bãi, xem lịch và đặt chỗ</span></div>
        <button type="button" aria-label="Đóng trợ lý" onClick={() => close(true)}>×</button>
      </header>
      <div className="assistant-log" ref={log} role="log" aria-label="Cuộc trò chuyện" tabIndex={0}>
        {!user ? <div className="assistant-welcome"><p>Đăng nhập để hỏi về xe, lịch đặt và bãi đỗ của bạn.</p>
          <Link className="button main-button" to="/login" state={{ from: location.pathname + location.search }} onClick={() => close()}>Đăng nhập</Link></div> :
          messages.length === 0 && <div className="assistant-welcome"><p>Bạn muốn trợ lý giúp việc gì?</p>
            <div className="assistant-suggestions">{suggestions[role].map(item =>
              <button type="button" key={item} onClick={() => send(item)} disabled={!!status}>{item}</button>)}</div>
          </div>}
        {messages.map((message, index) => {
          const actionable = index === messages.length - 1
          return <div key={index} className={'assistant-message chat-' + message.role}>
            <p>{message.text}</p>
            {message.rows && <ul>{message.rows.map((row, at) => <li key={at}>{row}</li>)}</ul>}
            {message.links && <div className="assistant-actions">{message.links.map(({ label, path }) =>
              <Link key={label} to={path} onClick={() => close()}>{label} ↗</Link>)}</div>}
            {message.choices && <div className="assistant-actions">{message.choices.map(plate =>
              <button type="button" key={plate} disabled={!!status || !actionable} onClick={() => send('Dùng xe ' + plate)}>{plate}</button>)}</div>}
            {message.booking && <BookingCard booking={message.booking} busy={!!status && actionable}
              actionable={actionable && completed !== message.booking} confirm={item => confirm(item, 'booking')} close={() => close()} />}
            {message.extension && <ExtensionCard extension={message.extension} busy={!!status && actionable}
              actionable={actionable && completed !== message.extension} confirm={item => confirm(item, 'extension')} />}
          </div>
        })}
        {status && <p className="assistant-status" role="status">{status}</p>}
      </div>
      {error && <div className="assistant-error">
        <p role="alert">{error}</p>
        {canRefreshQuote && <div className="assistant-actions">
          <button type="button" disabled={!!status} onClick={() => send(messages.findLast(item => item.role === 'user')?.text || '')}>
            Tìm lại và cập nhật giá
          </button>
        </div>}
      </div>}
      {user && <form className="assistant-form" onSubmit={event => { event.preventDefault(); send(draft) }}>
        <input ref={input} aria-label="Nhập tin nhắn" placeholder="Nhập câu hỏi…" maxLength={1000} value={draft}
          onChange={event => setDraft(event.target.value)} />
        <button type="submit" disabled={!draft.trim() || !!status}>Gửi</button>
      </form>}
    </dialog>
  </div>
}
