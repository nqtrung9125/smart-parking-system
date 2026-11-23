import { useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { useAuth } from '../auth/useAuth'
import { api } from '../lib/api'
import Icon from '../components/Icon'
import ParkingFeeBreakdown from '../components/ParkingFeeBreakdown'
import QrImage from '../components/QrImage'
import { Empty, Loading, Notice, PageHeader } from '../components/Ui'
import { dateTime, money, parkingDuration } from '../lib/format'
import { useResource } from '../lib/useResource'

const methods = { 1: 'Tiền mặt', 2: 'Thẻ mô phỏng', 3: 'Chuyển khoản', 4: 'Số dư gửi xe', 5: 'Cọc giữ chỗ' }

function BillDetail({ bill, token, onRefresh, balance, payBalance, paying }) {
  const [showQr, setShowQr] = useState(false)
  const qrPath = showQr && !bill.paidAtUtc ? '/api/payments/parking-session/' + bill.sessionId + '/transfer' : null
  const transfer = useResource(qrPath, token)

  function refresh() {
    onRefresh()
    transfer.refresh()
  }

  return <section className="panel payment-detail">
    <div className="panel-head">
      <div><h2>Phí gửi xe</h2><p>Lượt gửi #{bill.sessionId} · {bill.plateNumber}</p></div>
      <span className={'pill ' + (bill.paidAtUtc ? 'pill-green' : 'pill-amber')}>{bill.paidAtUtc ? 'Đã thanh toán' : 'Chờ thanh toán'}</span>
    </div>
    <div className="bill-amount"><span>{bill.paidAtUtc ? 'Đã thu' : 'Cần thanh toán'}</span><strong>{money(bill.paidAtUtc ? bill.amount : bill.amountDue)}</strong></div>
    <dl className="bill-facts">
      <div><dt>Bãi xe</dt><dd>{bill.lotName} · Ô {bill.spotCode}</dd></div>
      <div><dt>Vào bãi</dt><dd>{dateTime(bill.checkInUtc)}</dd></div>
      <div><dt>Ra bãi</dt><dd>{dateTime(bill.checkOutUtc)}</dd></div>
      {bill.scheduledEndUtc && <div><dt>Giờ lấy xe đã đặt</dt><dd>{dateTime(bill.scheduledEndUtc)}</dd></div>}
      <div><dt>Thời gian gửi</dt><dd>{parkingDuration(Date.parse(bill.checkOutUtc) - Date.parse(bill.checkInUtc))}</dd></div>
      {bill.paidAtUtc && <>
        <div><dt>Phương thức</dt><dd>{methods[bill.paymentMethod] || 'Đã ghi nhận'}</dd></div>
        <div><dt>Giờ thanh toán</dt><dd>{dateTime(bill.paidAtUtc)}</dd></div>
      </>}
    </dl>
    <ParkingFeeBreakdown charge={bill} />
    {bill.depositApplied > 0 && <p>Tổng phí {money(bill.amount)} · Đã trừ cọc {money(bill.depositApplied)}</p>}
    {!bill.paidAtUtc && <>
      <p className="helper-text">Số dư gửi xe <strong>{money(balance)}</strong> · <Link to="/wallet">Nạp số dư</Link></p>
      <div className="payment-actions">
        <button type="button" className="button main-button" aria-expanded={showQr} onClick={() => setShowQr(!showQr)}>
          {showQr ? 'Ẩn mã QR' : 'Xem mã VietQR'}
        </button>
        <button type="button" className="button light-button" disabled={paying || balance == null || balance < bill.amountDue} onClick={() => payBalance(bill)}>
          {paying ? 'Đang thanh toán…' : 'Trả bằng số dư'}
        </button>
        <button type="button" className="button light-button" onClick={refresh}>Kiểm tra trạng thái</button>
      </div>
      {showQr && <div className="bill-transfer">
        {transfer.loading && <Loading>Đang tải thông tin chuyển khoản…</Loading>}
        {transfer.error && <Notice error={transfer.error} />}
        {transfer.data && (transfer.data.enabled ? <>
          <QrImage value={transfer.data.payload} label={'Mã VietQR cho lượt gửi #' + bill.sessionId} />
          <div>
            <p><strong>{transfer.data.name}</strong> · {transfer.data.account}</p>
            <p>{money(transfer.data.amount)} · Nội dung <code>{transfer.data.reference}</code></p>
            <p>Nhân viên sẽ ghi nhận sau khi đối soát. Nếu đã chuyển khoản, dùng <strong>Kiểm tra trạng thái</strong> trước khi trả bằng số dư.</p>
          </div>
        </> : <p>Bãi xe chưa bật VietQR. Bạn có thể thanh toán tiền mặt tại quầy.</p>)}
      </div>}
    </>}
  </section>
}

export default function CustomerPaymentsPage() {
  const { token } = useAuth()
  const [params, setParams] = useSearchParams()
  const bills = useResource('/api/payments/mine', token)
  const wallet = useResource('/api/wallet/mine', token)
  const [filter, setFilter] = useState('all')
  const [paying, setPaying] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const rows = bills.data || []
  const selectedId = params.get('session')
  const visibleBills = rows.filter((bill) => filter === 'all' || (filter === 'paid' ? bill.paidAtUtc : !bill.paidAtUtc))
  const requestedBill = rows.find((bill) => String(bill.sessionId) === selectedId)
  const invalidSelection = Boolean(selectedId && !requestedBill && filter === 'all')
  const selectedBill = invalidSelection ? null
    : visibleBills.find((bill) => bill === requestedBill) || visibleBills.find((bill) => !bill.paidAtUtc) || visibleBills[0]
  const unpaidTotal = rows.reduce((total, bill) => total + (bill.paidAtUtc ? 0 : bill.amountDue), 0)

  function refresh() { bills.refresh(); wallet.refresh() }

  async function payBalance(bill) {
    if (!window.confirm('Dùng ' + money(bill.paidAtUtc ? bill.amount : bill.amountDue) + ' từ số dư để thanh toán lượt #' + bill.sessionId + '?')) return
    setPaying(true)
    setError('')
    setMessage('')
    try {
      await api('/api/payments/parking-session/' + bill.sessionId + '/balance', { method: 'POST', token })
      setMessage('Đã thanh toán lượt #' + bill.sessionId + ' bằng số dư gửi xe.')
      refresh()
    } catch (cause) {
      setError(cause.message)
      if (cause.status === 409) refresh()
    } finally { setPaying(false) }
  }

  return <main className="page-wrap">
    <PageHeader title="Thanh toán của tôi" description="Xem các khoản phí và trạng thái thanh toán sau khi xác nhận xe ra."
      actions={<button type="button" className="button light-button" onClick={refresh} disabled={bills.loading || paying}>Cập nhật</button>} />
    <Notice error={error || bills.error || wallet.error} success={message} />
    {bills.loading ? <Loading /> : !bills.error && <>
      <div className="portal-card bills-total">
        <span className="portal-icon"><Icon name="clock" size={20} /></span>
        <div><span>Tổng phí chờ thanh toán</span><strong>{money(unpaidTotal)}</strong></div>
        <Link to="/history">Lịch sử gửi xe →</Link>
      </div>
      {!rows.length ? <Empty>Chưa có lượt gửi nào đã ra bãi. Phí sẽ xuất hiện ở đây sau khi xe ra.</Empty> :
        <div className="two-column booking-grid">
          <section className="panel">
            <h2>Lượt gửi xe</h2>
            <div className="map-switch bill-filters" role="group" aria-label="Lọc theo thanh toán">
              {[['all', 'Tất cả'], ['pending', 'Chờ thanh toán'], ['paid', 'Đã thanh toán']].map(([key, label]) =>
                <button key={key} type="button" aria-pressed={filter === key} onClick={() => setFilter(key)}>{label}</button>)}
            </div>
            {!visibleBills.length ? <Empty>Không có lượt gửi phù hợp.</Empty> :
              <ul className="bill-list">{visibleBills.map((bill) => <li key={bill.sessionId}>
                <button type="button" className="choice-row bill-choice" aria-pressed={bill.sessionId === selectedBill?.sessionId}
                  onClick={() => setParams({ session: String(bill.sessionId) }, { replace: true })}>
                  <span><strong>{bill.plateNumber}</strong><small>{bill.lotName} · Lượt #{bill.sessionId}</small></span>
                  <span><strong>{money(bill.paidAtUtc ? bill.amount : bill.amountDue)}</strong><small>{bill.paidAtUtc ? 'Đã thanh toán' : 'Chờ thanh toán'}</small></span>
                </button>
              </li>)}</ul>}
          </section>
          {selectedBill ? <BillDetail key={selectedBill.sessionId} bill={selectedBill} token={token} onRefresh={refresh}
            balance={wallet.data?.balance} payBalance={payBalance} paying={paying} /> :
            <Empty>{invalidSelection ? 'Lượt gửi này không có trong danh sách của bạn.' : 'Chọn một lượt gửi để xem phí.'}</Empty>}
        </div>}
    </>}
  </main>
}
