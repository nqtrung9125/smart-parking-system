import { useState } from 'react'
import { api } from '../lib/api'
import { dateTime, money } from '../lib/format'
import { useResource } from '../lib/useResource'
import { Empty, Loading, Notice } from './Ui'

export default function ParkingExtensionQueue({ token, onReview }) {
  const pending = useResource('/api/parking-extensions/pending', token, { refreshInterval: 15000 })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  async function review(id, approve) {
    setBusy(true)
    setError('')
    setMessage('')
    try {
      await api('/api/parking-extensions/' + id + '/review', { method: 'POST', token, body: { approve } })
      setMessage(approve ? 'Đã duyệt gia hạn.' : 'Đã từ chối gia hạn.')
      pending.refresh()
      onReview()
    } catch (cause) { setError(cause.message) }
    finally { setBusy(false) }
  }

  return <section className="panel gate-queue section-gap" aria-labelledby="extension-queue-title">
    <div className="panel-head">
      <h2 id="extension-queue-title">Yêu cầu gia hạn quá hạn</h2>
      <button type="button" className="button light-button" disabled={pending.loading || busy} onClick={pending.refresh}>Cập nhật</button>
    </div>
    <Notice error={error || pending.error} success={message} />
    {pending.loading ? <Loading /> : pending.error ? null : !pending.data?.length ?
      <Empty>Chưa có yêu cầu gia hạn cần duyệt.</Empty> :
      <div className="data-list">{pending.data.map((item) => <div className="data-item" key={item.id}>
        <div>
          <strong>{item.plateNumber} · Ô {item.spotCode}</strong>
          <span>{item.lotName}</span>
          <span>{dateTime(item.previousEndUtc)} → {dateTime(item.requestedEndUtc)}</span>
          <span>Tổng dự kiến {money(item.estimatedFee)} · Phí trễ của yêu cầu {money(item.accruedLateFee)}</span>
        </div>
        <div className="payment-actions">
          <button type="button" className="button main-button" disabled={busy} onClick={() => review(item.id, true)}>Duyệt gia hạn</button>
          <button type="button" className="button light-button" disabled={busy} onClick={() => review(item.id, false)}>Từ chối</button>
        </div>
      </div>)}</div>}
  </section>
}
