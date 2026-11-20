import { useState } from 'react'
import { useAuth } from '../auth/useAuth'
import { api } from '../lib/api'
import { useResource } from '../lib/useResource'
import { dateTime, parkingDuration, reservationStates } from '../lib/format'
import { PageHeader, Notice, Loading, Empty, Field } from '../components/Ui'
import Icon from '../components/Icon'
import ReservationBadge from '../components/ReservationBadge'

export default function ReservationReviewPage() {
  const { token, user } = useAuth()
  const isAdmin = user.roles.includes('Admin')
  const pending = useResource('/api/reservations/pending', token, { refreshInterval: 15000 })
  const assigned = useResource('/api/parking-lots/assigned', token, { refreshInterval: 15000 })
  const [lotId, setLotId] = useState(null)
  const [rejecting, setRejecting] = useState(null)
  const [reason, setReason] = useState('')
  const [working, setWorking] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const lots = assigned.data || []
  const lotIds = new Set(lots.map((lot) => lot.id))
  const items = (pending.data || []).filter((item) => lotIds.has(item.lotId))
  const selectedLot = lots.find((lot) => lot.id === lotId) || (lots.length === 1 ? lots[0] : null)
  const visible = selectedLot ? items.filter((item) => item.lotId === selectedLot.id) : items
  const loading = assigned.loading || pending.loading
  const counts = new Map()
  for (const item of items) counts.set(item.lotId, (counts.get(item.lotId) || 0) + 1)

  function refresh() { assigned.refresh(); pending.refresh() }

  async function review(id, rejectionReason) {
    const rejected = rejectionReason !== undefined
    setWorking(true)
    setError('')
    setMessage('')
    try {
      await api('/api/reservations/' + id + (rejected ? '/reject' : '/approve'), {
        method: 'POST', token, body: rejected ? { reason: rejectionReason } : undefined,
      })
      setMessage((rejected ? 'Đã từ chối yêu cầu #' : 'Đã xác nhận yêu cầu #') + id + '.')
      setRejecting(null)
      setReason('')
      pending.refresh()
    } catch (cause) {
      setError(cause.message)
      if (cause.status === 404 || cause.status === 409) refresh()
    } finally { setWorking(false) }
  }

  return <main className="page-wrap reservation-review">
    <PageHeader title="Duyệt đặt chỗ"
      description={isAdmin ? 'Xác nhận hoặc từ chối yêu cầu của tất cả bãi.' : 'Xác nhận hoặc từ chối yêu cầu tại các bãi bạn phụ trách.'}
      actions={<button type="button" className="button light-button" disabled={loading || working} onClick={refresh}><Icon name="refresh" size={16} /> Cập nhật</button>} />
    <Notice error={error || assigned.error || pending.error} success={message} />
    {!isAdmin && <section className="panel assigned-lots" aria-labelledby="assigned-lots-title">
      <div className="reservation-section-head">
        <h2 id="assigned-lots-title">Bãi được phân công</h2>
        {lots.length > 1 && <button type="button" className="button light-button" aria-pressed={!selectedLot} onClick={() => setLotId(null)}>Tất cả bãi phụ trách</button>}
      </div>
      {assigned.loading ? <Loading /> : !assigned.error && (lots.length ? <ul className="assigned-lot-list">
        {lots.map((lot) => <li key={lot.id}>
          <button type="button" className="assigned-lot" aria-pressed={selectedLot?.id === lot.id} onClick={() => setLotId(lot.id)}>
            <span className="portal-icon"><Icon name="pin" size={18} /></span>
            <span className="assigned-lot-details"><strong>{lot.name}</strong><span>{lot.address}</span></span>
            {!pending.loading && !pending.error && <span className="reservation-count">{counts.get(lot.id) || 0} chờ duyệt</span>}
          </button>
        </li>)}
      </ul> : <Empty>Tài khoản chưa được phân công bãi. Admin có thể phân công trong mục Nhân viên.</Empty>)}
    </section>}
    {lots.length > 0 &&
    <section className="panel" aria-labelledby="pending-title">
      <div className="reservation-section-head">
        <h2 id="pending-title">Đặt chỗ chờ xác nhận {!pending.loading && !pending.error && <span className="reservation-count">{visible.length}</span>}</h2>
        {isAdmin && lots.length > 1 && <Field label="Lọc theo bãi">
          <select value={selectedLot?.id ?? ''} onChange={(event) => setLotId(Number(event.target.value) || null)}>
            <option value="">Tất cả bãi</option>
            {lots.map((lot) => <option value={lot.id} key={lot.id}>{lot.name}</option>)}
          </select>
        </Field>}
      </div>
      {pending.loading ? <Loading /> : !pending.error && (visible.length ? <ul className="reservation-list">
        {visible.map((item) => <li key={item.id} className="reservation-list-item">
          <div className="reservation-list-title">
            <strong>{item.plateNumber} · #{item.id}</strong>
            <span>{item.lotName} · Ô {item.spotCode}</span>
          </div>
          <div className="reservation-list-time">
            <span>Đến <strong>{dateTime(item.startUtc)}</strong></span>
            <span>Lấy xe <strong>{dateTime(item.endUtc)}</strong></span>
            <span>{parkingDuration(Date.parse(item.endUtc) - Date.parse(item.startUtc))} · Gửi yêu cầu lúc {dateTime(item.createdAtUtc)}</span>
          </div>
          <div className="reservation-row-actions">
            <ReservationBadge status={reservationStates.pending} />
            {rejecting !== item.id && <div className="row-actions">
              <button type="button" className="button main-button" aria-label={'Xác nhận yêu cầu #' + item.id} disabled={working} onClick={() => review(item.id)}>Xác nhận</button>
              <button type="button" className="button light-button" aria-label={'Từ chối yêu cầu #' + item.id} disabled={working}
                onClick={() => { setRejecting(item.id); setReason('') }}>Từ chối</button>
            </div>}
          </div>
          {rejecting === item.id && <form className="reservation-reject-form" onSubmit={(event) => { event.preventDefault(); if (reason.trim()) review(item.id, reason.trim()) }}>
            <Field label="Lý do từ chối" hint="Khách hàng sẽ thấy nội dung này trong lịch đặt.">
              <textarea value={reason} onChange={(event) => setReason(event.target.value)} required maxLength={300} rows={2} />
            </Field>
            <div className="row-actions">
              <button className="button main-button" disabled={working || !reason.trim()}>Gửi từ chối</button>
              <button type="button" className="button light-button" disabled={working} onClick={() => setRejecting(null)}>Quay lại</button>
            </div>
          </form>}
        </li>)}
      </ul> : <Empty>{selectedLot ? `Không có đơn chờ xác nhận tại ${selectedLot.name}.` : 'Hiện không có lượt đặt chỗ chờ xác nhận.'}</Empty>)}
    </section>}
    {isAdmin && (assigned.loading ? <Loading /> : !assigned.error && !lots.length && <Empty>Chưa có bãi xe.</Empty>)}
  </main>
}
