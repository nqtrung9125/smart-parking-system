import { useState } from 'react'
import { useAuth } from '../auth/useAuth'
import { Empty, Field, Loading, Notice, PageHeader } from '../components/Ui'
import { api } from '../lib/api'
import { dateTime, money } from '../lib/format'
import { useResource } from '../lib/useResource'

export default function WalletReviewPage() {
  const { token } = useAuth()
  const requests = useResource('/api/wallet/top-ups/pending', token, { refreshInterval: 15000 })
  const [selectedId, setSelectedId] = useState(null)
  const [received, setReceived] = useState('')
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const items = requests.data || []
  const selected = items.find((item) => item.id === selectedId)

  function select(id) {
    setSelectedId(id)
    setReceived('')
    setCode('')
    setError('')
    setMessage('')
  }

  async function approve(event) {
    event.preventDefault()
    if (!selected) return
    setBusy(true)
    setError('')
    setMessage('')
    try {
      await api('/api/wallet/top-ups/' + selected.id + '/approve', {
        method: 'POST', token, body: { receivedAmount: Number(received), bankTransactionCode: code.trim() },
      })
      select(null)
      setMessage('Đã cộng ' + money(selected.amount) + ' vào số dư khách hàng.')
      requests.refresh()
    } catch (cause) {
      setError(cause.message)
      if (cause.status === 409) requests.refresh()
    } finally { setBusy(false) }
  }

  return <main className="page-wrap">
    <PageHeader title="Duyệt nạp số dư" description="Đối chiếu tài khoản nhận, số tiền và nội dung chuyển khoản trên sao kê trước khi cộng tiền."
      actions={<button className="button light-button" type="button" disabled={busy || requests.loading} onClick={requests.refresh}>Cập nhật</button>} />
    <Notice error={error || requests.error} success={message} />
    {requests.loading ? <Loading /> : !requests.error && <div className="two-column booking-grid wallet-grid">
      <section className="panel">
        <h2>Yêu cầu chờ đối soát</h2>
        {items.length ? <ul className="bill-list wallet-history">
          {items.map((item) => <li key={item.id}>
            <button className="choice-row bill-choice" type="button" disabled={busy} aria-pressed={item.id === selectedId} onClick={() => select(item.id)}>
              <span><strong>{item.customerEmail}</strong><small>{dateTime(item.createdAtUtc)}</small></span>
              <strong>{money(item.amount)}</strong>
            </button>
          </li>)}
        </ul> : <Empty>Hiện không có yêu cầu nạp chờ duyệt.</Empty>}
      </section>
      {selected && <form className="panel" onSubmit={approve}>
        <h2>Đối soát giao dịch</h2>
        <dl className="bill-facts">
          <div><dt>Khách hàng</dt><dd>{selected.customerEmail}</dd></div>
          <div><dt>Tài khoản nhận</dt><dd>{selected.accountName} · {selected.accountNumber}</dd></div>
          <div><dt>Số tiền yêu cầu</dt><dd>{money(selected.amount)}</dd></div>
          <div><dt>Nội dung</dt><dd><code>{selected.transferReference}</code></dd></div>
        </dl>
        <Field label="Số tiền thực nhận (đồng)">
          <input type="number" min="1" step="1" value={received} disabled={busy} onChange={(event) => setReceived(event.target.value)} required />
        </Field>
        <Field label="Mã giao dịch trên sao kê">
          <input value={code} disabled={busy} onChange={(event) => setCode(event.target.value)} maxLength="80" required />
        </Field>
        <button className="button main-button" disabled={busy || Number(received) !== selected.amount || !code.trim()}>
          {busy ? 'Đang xử lý…' : 'Xác nhận và cộng số dư'}
        </button>
      </form>}
    </div>}
  </main>
}
