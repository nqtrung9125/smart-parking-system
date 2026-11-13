import { useState } from 'react'
import { useResource } from '../lib/useResource'
import { Loading, Notice } from './Ui'

const zones = { timeZone: 'Asia/Ho_Chi_Minh' }
const time = new Intl.DateTimeFormat('vi-VN', { ...zones, hour: '2-digit', minute: '2-digit' })
const date = new Intl.DateTimeFormat('vi-VN', { ...zones, day: '2-digit', month: '2-digit' })
const weekday = new Intl.DateTimeFormat('vi-VN', { ...zones, weekday: 'short' })
const number = new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 1 })
const modes = { hour: ['Theo giờ', '12 giờ tới'], day: ['Theo ngày', '7 ngày đầy đủ tới'], week: ['Theo tuần', '4 tuần tới · Thứ Hai đến Chủ Nhật'] }

function label(point, period) {
  const start = new Date(point.atUtc)
  if (period === 'hour') return time.format(start)
  if (period === 'day') return weekday.format(start) + ' ' + date.format(start)
  return date.format(start) + '–' + date.format(new Date(Date.parse(point.endUtc) - 1))
}

export default function ForecastPanel({ id, vehicleFilter }) {
  const [period, setPeriod] = useState('hour')
  const forecast = useResource('/api/parking-lots/' + id + '/forecast?period=' + period + (vehicleFilter ? '&type=' + vehicleFilter : ''))
  const result = forecast.data
  const max = result?.ready ? Math.max(...result.points.map((point) => point.available)) : 0
  const least = result?.ready ? result.points.reduce((worst, point) => point.minAvailable < worst.minAvailable ? point : worst) : null
  return <section className="panel section-gap forecast-panel">
    <div className="panel-head map-panel-head"><div><h2>Dự báo chỗ trống</h2><p>{modes[period][1]} · Giờ Việt Nam</p></div><div className="map-switch" role="group" aria-label="Kỳ dự báo">
      {Object.entries(modes).map(([key, [title]]) => <button type="button" key={key} aria-pressed={period === key} onClick={() => setPeriod(key)}>{title}</button>)}
    </div></div>
    {forecast.loading ? <Loading /> : <><Notice error={forecast.error} />{!forecast.error && result && (result.ready ? <>
      {period !== 'hour' && <div className="forecast-summary"><span>Cột biểu đồ: số chỗ trống trung bình</span><strong>Đông nhất: {time.format(new Date(least.peakAtUtc))} ngày {date.format(new Date(least.peakAtUtc))} · còn khoảng {least.minAvailable} chỗ</strong></div>}
      <div className={'forecast-plot forecast-' + period} aria-label={period === 'hour' ? 'Số chỗ trống theo giờ' : 'Số chỗ trống trung bình theo kỳ'}>
        {result.points.map((point) => {
          const caption = label(point, period)
          const peak = new Date(point.peakAtUtc)
          return <div className={'forecast-column' + (point.available === max ? ' forecast-high' : '')} key={point.atUtc}
            title={period === 'hour' ? undefined : 'Ít nhất ' + point.minAvailable + ' chỗ lúc ' + time.format(peak) + ' ngày ' + date.format(peak)}>
            <strong>{number.format(point.available)}</strong><div className="forecast-track" aria-hidden="true"><span style={{ height: Math.max(2, point.available / result.capacity * 100) + '%' }} /></div>
            <time dateTime={point.atUtc}>{caption}</time>
            {period !== 'hour' && <small>Ít nhất {point.minAvailable}</small>}
          </div>
        })}
      </div>
      {period === 'week' && <p className="helper-text">Mô hình học nhịp theo ngày trong tuần, nên các tuần có thể cho kết quả giống nhau. Chưa tính thời tiết, sự kiện hoặc lịch đặt sắp tới.</p>}
      <p className="helper-text"><strong>{result.source === 'synthetic' ? 'Nguồn: dữ liệu mô phỏng Đà Nẵng.' : 'Nguồn: lịch sử vận hành.'}</strong> {number.format(result.sampleHours)} mẫu theo giờ trong {result.historyDays} ngày. Sai số trung bình của dự báo theo giờ trên {result.holdoutDays} ngày kiểm tra: {number.format(result.meanAbsoluteError)} chỗ.{period !== 'week' && ' Chưa tính lịch đặt sắp tới.'}</p>
    </> : <p>Chưa đủ dữ liệu dự báo ({result.sampleSessions} lượt trong {result.historyDays} ngày). Cần ít nhất 20 lượt gửi đã hoàn tất và lịch sử trải dài 14 ngày.</p>)}</>}
  </section>
}
