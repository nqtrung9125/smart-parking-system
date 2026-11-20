import { useState } from 'react'
import { useAuth } from '../auth/useAuth'
import { Field, Empty, Loading, Notice, PageHeader } from '../components/Ui'
import Icon from '../components/Icon'
import { useResource } from '../lib/useResource'
import { money } from '../lib/format'
import './revenue.css'

const periods = { day: 'Ngày', month: 'Tháng', year: 'Năm' }
const bucketLabels = { day: 'Giờ', month: 'Ngày', year: 'Tháng' }
const methods = [[1, 'Tiền mặt'], [3, 'VietQR'], [4, 'Số dư'], [2, 'Thẻ mô phỏng']]
const inVietnam = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Ho_Chi_Minh', dateStyle: 'short' })

function bucketLabel(period, index) {
  if (period === 'day') return String(index).padStart(2, '0') + ':00'
  return bucketLabels[period] + ' ' + (index + 1)
}

function RevenueDetails({ report }) {
  const [picked, setPicked] = useState(null)
  const selected = report.periods.find((bucket) => bucket.index === picked)
  const detail = selected || report
  const maximum = Math.max(1, ...report.periods.map((period) => period.revenue))
  const visibleMethods = methods.filter(([value]) => report.methods.some((item) => item.method === value))
  const average = report.paymentCount ? Math.round(report.revenue / report.paymentCount) : 0

  return <>
    <section className="revenue-kpis" aria-label="Tổng hợp doanh thu">
      <div className="portal-card revenue-kpi"><span>Tổng doanh thu</span><strong>{money(report.revenue)}</strong></div>
      <div className="portal-card revenue-kpi"><span>Lượt đã thanh toán</span><strong>{report.paymentCount.toLocaleString('vi-VN')}</strong></div>
      <div className="portal-card revenue-kpi"><span>Doanh thu trung bình mỗi lượt</span><strong>{money(average)}</strong></div>
    </section>

    <section className="panel revenue-chart" aria-labelledby="revenue-chart-title">
      <div className="panel-head"><div>
        <h2 id="revenue-chart-title">Doanh thu theo {bucketLabels[report.period].toLowerCase()}</h2>
        <p>{report.lot.name} · Giờ Việt Nam</p>
      </div>{selected && <button className="button light-button" type="button" onClick={() => setPicked(null)}>Xem cả kỳ</button>}</div>

      {!report.paymentCount && <p className="helper-text">Chưa có lượt thanh toán trong kỳ đã chọn.</p>}
      <div className="revenue-scroll">
        <div className="revenue-bars" style={{ '--bucket-count': report.periods.length }}>
          {report.periods.map((bucket) => {
            const label = bucketLabel(report.period, bucket.index)
            const showLabel = report.period === 'year' || bucket.index === 0 || bucket.index === report.periods.length - 1 ||
              bucket.index % (report.period === 'day' ? 3 : 5) === 0
            return <button type="button" className="revenue-bar" key={bucket.index}
              aria-pressed={selected?.index === bucket.index}
              aria-label={label + ', ' + money(bucket.revenue) + ', ' + bucket.paymentCount + ' lượt thanh toán'}
              title={label + ' · ' + money(bucket.revenue)}
              onClick={() => setPicked((index) => index === bucket.index ? null : bucket.index)}>
              <span className="revenue-bar-track"><span className="revenue-bar-fill" style={{ '--bar-size': (bucket.revenue / maximum * 100) + '%' }} /></span>
              <span className="revenue-bar-label" aria-hidden="true">{showLabel ? (report.period === 'year' ? 'T' + (bucket.index + 1) : report.period === 'day' ? label : bucket.index + 1) : ''}</span>
            </button>
          })}
        </div>
      </div>

      <div className="revenue-breakdown" aria-live="polite">
        <div><h3>{selected ? bucketLabel(report.period, selected.index) : 'Cả kỳ báo cáo'}</h3>
          <strong>{money(detail.revenue)}</strong> <span>· {detail.paymentCount} lượt</span>
        </div>
        {visibleMethods.length > 0 && <dl>
          {visibleMethods.map(([value, label]) => <div key={value}><dt>{label}</dt>
            <dd>{money(detail.methods.find((item) => item.method === value)?.amount ?? 0)}</dd>
          </div>)}
        </dl>}
      </div>
    </section>

    <section className="panel revenue-table">
      <h2>Chi tiết theo {bucketLabels[report.period].toLowerCase()}</h2>
      <div className="revenue-scroll"><table>
        <thead><tr><th scope="col">{bucketLabels[report.period]}</th><th scope="col">Lượt thanh toán</th>
          {visibleMethods.map(([value, label]) => <th key={value} scope="col">{label}</th>)}
          <th scope="col">Doanh thu</th>
        </tr></thead>
        <tbody>{report.periods.map((bucket) => <tr key={bucket.index} className={selected?.index === bucket.index ? 'revenue-selected' : undefined}>
          <th scope="row">{bucketLabel(report.period, bucket.index)}</th><td>{bucket.paymentCount}</td>
          {visibleMethods.map(([value]) => <td key={value}>{money(bucket.methods.find((item) => item.method === value)?.amount ?? 0)}</td>)}
          <td>{money(bucket.revenue)}</td>
        </tr>)}</tbody>
      </table></div>
    </section>
  </>
}

export default function RevenuePage() {
  const { token } = useAuth()
  const lots = useResource('/api/parking-lots/assigned', token)
  const [requestedLot, setRequestedLot] = useState('')
  const [period, setPeriod] = useState('day')
  const [date, setDate] = useState(() => inVietnam.format(new Date()))
  const [selectedYear, setSelectedYear] = useState(null)
  const lot = lots.data?.find((item) => String(item.id) === requestedLot) || lots.data?.[0]
  const year = selectedYear ?? date.slice(0, 4)
  const reportDate = period === 'year' ? (/^\d{4}$/.test(year) && Number(year) >= 2 && Number(year) <= 9998 ? year + '-01-01' : '')
    : period === 'month' && date ? date.slice(0, 7) + '-01' : date
  const params = lot && reportDate ? new URLSearchParams({ lotId: lot.id, period, date: reportDate }) : null
  const revenue = useResource(params ? '/api/dashboard/revenue?' + params : null, token)

  return <main className="page-wrap revenue-page">
    <PageHeader title="Doanh thu bãi xe" description="Theo dõi phí gửi xe đã thanh toán theo bãi và thời điểm ghi nhận."
      actions={<button className="button light-button" type="button" disabled={lots.loading || revenue.loading}
        onClick={() => { lots.refresh(); revenue.refresh() }}><Icon name="refresh" size={17} /> Cập nhật</button>} />
    <Notice error={lots.error || revenue.error} />
    {lots.loading ? <Loading /> : !lots.error && !lot ? <Empty>Bạn chưa có bãi xe trong phạm vi phụ trách.</Empty> : lot && <>
      <section className="panel revenue-filters" aria-label="Bộ lọc doanh thu">
        <Field label="Bãi xe">
          <select value={lot.id} onChange={(event) => setRequestedLot(event.target.value)}>
            {lots.data.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
        </Field>
        <Field label="Kỳ báo cáo">
          <select value={period} onChange={(event) => setPeriod(event.target.value)}>
            {Object.entries(periods).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </Field>
        {period === 'year' ? <Field label="Năm báo cáo">
          <input inputMode="numeric" maxLength="4" value={year} onChange={(event) => setSelectedYear(event.target.value.replace(/[^0-9]/g, ''))} />
        </Field> : <Field label={period === 'month' ? 'Tháng báo cáo' : 'Ngày báo cáo'}>
          <input type={period === 'month' ? 'month' : 'date'} min={period === 'month' ? '0002-01' : '0002-01-01'}
            max={period === 'month' ? '9998-12' : '9998-12-31'}
            value={period === 'month' ? date.slice(0, 7) : date}
            onChange={(event) => {
              const next = event.target.value
              if (next) { setDate(period === 'month' ? next + '-01' : next); setSelectedYear(null) }
            }} />
        </Field>}
      </section>

      {!reportDate ? <Empty>Nhập năm báo cáo gồm bốn chữ số.</Empty>
        : revenue.loading ? <Loading>Đang tải doanh thu…</Loading>
        : revenue.data && <RevenueDetails key={params.toString()} report={revenue.data} />}
    </>}
  </main>
}
