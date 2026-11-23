import { useState } from 'react'
import { Link } from 'react-router'
import { useAuth } from '../auth/useAuth'
import { Field, Empty, Loading, Notice, PageHeader } from '../components/Ui'
import Icon from '../components/Icon'
import { useResource } from '../lib/useResource'
import { bookingInputTime, hourMs, maxDuration } from '../lib/bookingTime'
import { dateTime, money, vehicleType } from '../lib/format'
import './parking-search.css'

const kilometers = new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 2 })

function SearchResults({ result, destination }) {
  const { startUtc, endUtc, type, lots } = result
  return <section className="arrival-results" aria-labelledby="arrival-results-title">
    <div className="panel-head">
      <div>
        <h2 id="arrival-results-title">Bãi xe gần {destination}</h2>
        <p>{vehicleType(type)} · Đến {dateTime(startUtc)} · Lấy xe {dateTime(endUtc)}</p>
      </div>
      <span className="arrival-result-count">{lots.length} bãi</span>
    </div>
    {lots.length === 0 ? <Empty>Chưa có bãi trong danh mục Đà Nẵng hỗ trợ loại xe này.</Empty> :
      <div className="arrival-results-grid">
        {lots.map((lot) => <article key={lot.lotId} className="panel arrival-card">
          <div className="arrival-card-heading">
            <div className="arrival-place"><Icon name="pin" size={16} />{kilometers.format(lot.distanceKm)} km đường thẳng</div>
            <h3>{lot.name}</h3>
            <p>{lot.address}</p>
          </div>
          <dl className="arrival-metrics">
            <div><dt>Dự kiến còn lúc đến</dt><dd>{lot.predictedAvailable == null ? '—' : lot.predictedAvailable + ' chỗ'}</dd></div>
            <div><dt>Ô có thể đặt cả khung</dt><dd className={lot.bookable ? 'arrival-positive' : ''}>{lot.bookable} ô</dd></div>
            <div><dt>Phí nếu lấy xe đúng giờ</dt><dd>{money(lot.estimatedFee)}</dd></div>
          </dl>
          <p className="arrival-source">{lot.source === 'synthetic' ? 'Dự báo từ dữ liệu mô phỏng' :
            lot.model === 'context-knn' ? 'Dự báo có xét xe đang đỗ và lịch đã duyệt' :
              lot.source === 'operational' ? 'Dự báo từ lịch sử vận hành' : 'Chưa đủ lịch sử để dự báo'}</p>
          <div className="arrival-actions">
            {lot.bookable > 0 && <Link className="button main-button" to={'/reservations?' +
              new URLSearchParams({ lot: lot.lotId, type, startUtc, endUtc })}>Xem ô có thể đặt <Icon name="arrow" size={16} /></Link>}
            <Link className="button light-button" to={'/lots/' + lot.lotId}>Sơ đồ bãi</Link>
          </div>
        </article>)}
      </div>}
  </section>
}

export default function ParkingSearchPage() {
  const { token } = useAuth()
  const destinations = useResource('/api/parking-search/destinations')
  const [destination, setDestination] = useState('cau-rong')
  const [type, setType] = useState('2')
  const [start, setStart] = useState(() => bookingInputTime(Date.now() + 2 * hourMs))
  const [end, setEnd] = useState(() => bookingInputTime(Date.now() + 5 * hourMs))
  const [submitted, setSubmitted] = useState(null)
  const [error, setError] = useState('')
  const result = useResource(submitted?.path, token)

  function submit(event) {
    event.preventDefault()
    const from = Date.parse(start)
    const to = Date.parse(end)
    const now = Date.now()
    if (!(from > now && from <= now + maxDuration && to > from && to - from <= maxDuration)) {
      setError('Chọn giờ đến trong 30 ngày tới và giờ lấy xe tối đa 30 ngày sau giờ đến.')
      return
    }
    const params = new URLSearchParams({ destination, type, startUtc: new Date(from).toISOString(), endUtc: new Date(to).toISOString() })
    const path = '/api/parking-search?' + params
    if (path === submitted?.path) result.refresh()
    setSubmitted({ path, name: destinations.data.find((item) => item.key === destination)?.name })
    setError('')
  }

  return <main className="page-wrap arrival-page">
    <PageHeader title="Tìm bãi theo giờ đến" description="So sánh chỗ đỗ dự kiến, số ô có thể đặt và chi phí gần điểm đến của bạn tại Đà Nẵng." />
    <form className="panel arrival-form" onSubmit={submit}>
      <div className="arrival-fields">
        <Field label="Điểm đến"><select value={destination} onChange={(event) => setDestination(event.target.value)} required>
          {destinations.data?.map((item) => <option key={item.key} value={item.key}>{item.name}</option>)}
        </select></Field>
        <Field label="Loại xe"><select value={type} onChange={(event) => setType(event.target.value)}>
          <option value="2">Ô tô</option><option value="1">Xe máy</option>
        </select></Field>
        <Field label="Giờ đến"><input type="datetime-local" value={start} onChange={(event) => setStart(event.target.value)} required /></Field>
        <Field label="Giờ lấy xe"><input type="datetime-local" value={end} min={start} onChange={(event) => setEnd(event.target.value)} required /></Field>
      </div>
      <button className="button main-button" type="submit" disabled={!destinations.data?.length || result.loading}>
        <Icon name="search" size={17} /> {result.loading ? 'Đang so sánh…' : 'So sánh bãi xe'}
      </button>
    </form>
    <Notice error={error || destinations.error || result.error} />
    {result.loading ? <Loading>Đang dự báo và kiểm tra các ô có thể đặt…</Loading> :
      result.data && <SearchResults result={result.data} destination={submitted.name} />}
  </main>
}
