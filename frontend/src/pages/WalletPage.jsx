import { useRef, useState } from 'react'
import { Link } from 'react-router'
import { useAuth } from '../auth/useAuth'
import Icon from '../components/Icon'
import QrImage from '../components/QrImage'
import { Empty, Field, Loading, Notice, PageHeader } from '../components/Ui'
import { api } from '../lib/api'
import { dateTime, money } from '../lib/format'
import { useResource } from '../lib/useResource'

const maximum = 499999999
const suggestions = [50000, 100000, 200000]

export default function WalletPage() {
  const { token } = useAuth()
  const wallet = useResource('/api/wallet/mine', token, { refreshInterval: 15000 })
  const [amount, setAmount] = useState('')
  const [selectedId, setSelectedId] = useState(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const requestId = useRef(null)
  const topUps = wallet.data?.topUps || []
  const selected = topUps.find((item) => item.id === selectedId)

  function changeAmount(value) {
    setAmount(value)
    requestId.current = null
  }

  async function create(event) {
    event.preventDefault()
    const value = Number(amount)
    if (!Number.isInteger(value) || value < 1 || value > maximum) return
    setBusy(true)
    setError('')
    try {
      requestId.current ??= crypto.randomUUID()
      const result = await api('/api/wallet/top-ups', {
        method: 'POST', token, body: { requestId: requestId.current, amount: value },
      })
      setSelectedId(result.id)
      changeAmount('')
      wallet.refresh()
    } catch (cause) { setError(cause.message) }
    finally { setBusy(false) }
  }

  return <main className="page-wrap">
    <PageHeader title="Số dư gửi xe" description="Nạp bằng VietQR để đặt cọc giữ chỗ và thanh toán phí gửi xe."
      actions={<button type="button" className="button light-button" disabled={wallet.loading || busy} onClick={wallet.refresh}>Cập nhật</button>} />
    <Notice error={error || wallet.error} />
    {wallet.loading ? <Loading /> : wallet.data && <>
      <div className="portal-card bills-total">
        <span className="portal-icon"><Icon name="wallet" /></span>
        <div><span>Số dư khả dụng</span><strong>{money(wallet.data.balance)}</strong></div>
        <div><span>Cọc đang giữ</span><strong>{money(wallet.data.heldDeposit)}</strong></div>
        <Link to="/payments">Xem phí gửi xe →</Link>
      </div>
      <div className="two-column booking-grid wallet-grid">
        <section className="panel">
          <h2>Nạp số dư</h2>
          {wallet.data.canTopUp ? <form onSubmit={create}>
            <Field label="Số tiền nạp (đồng)">
              <input type="number" min="1" step="1" max={maximum} value={amount} disabled={busy}
                onChange={(event) => changeAmount(event.target.value)} required inputMode="numeric" />
            </Field>
            <div className="payment-actions wallet-amounts" role="group" aria-label="Chọn nhanh số tiền">
              {suggestions.map((value) => <button className="button light-button" key={value} type="button" disabled={busy}
                aria-pressed={Number(amount) === value} onClick={() => changeAmount(String(value))}>{money(value)}</button>)}
            </div>
            <button className="button main-button" disabled={busy}>{busy ? 'Đang tạo mã…' : 'Tạo mã VietQR'}</button>
          </form> : <Empty>Chưa cấu hình tài khoản nhận VietQR.</Empty>}
          {selected && <section className="bill-transfer" aria-label="Thông tin yêu cầu nạp">
            {selected.payload && <QrImage value={selected.payload} label="VietQR nạp số dư gửi xe" />}
            <div>
              <p><strong>{money(selected.amount)}</strong></p>
              {selected.approvedAtUtc ? <p>Đã cộng vào số dư lúc {dateTime(selected.approvedAtUtc)}.</p> : <>
                <p>{selected.name} · {selected.account}</p>
                <p>Nội dung <code>{selected.transferReference}</code></p>
                <p>Số dư sẽ cập nhật sau khi Admin đối chiếu sao kê.</p>
              </>}
            </div>
          </section>}
        </section>
        <section className="panel">
          <h2>Lịch sử nạp</h2>
          {topUps.length ? <ul className="bill-list wallet-history">
            {topUps.map((item) => <li key={item.id}>
              <button type="button" className="choice-row bill-choice" aria-pressed={selectedId === item.id} onClick={() => setSelectedId(item.id)}>
                <span><strong>{money(item.amount)}</strong><small>{dateTime(item.createdAtUtc)}</small></span>
                <span className={'pill ' + (item.approvedAtUtc ? 'pill-green' : 'pill-amber')}>{item.approvedAtUtc ? 'Đã cộng tiền' : 'Chờ đối soát'}</span>
              </button>
            </li>)}
          </ul> : <Empty>Bạn chưa có yêu cầu nạp.</Empty>}
        </section>
      </div>
    </>}
  </main>
}
