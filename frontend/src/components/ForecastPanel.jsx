import { useResource } from '../lib/useResource'
import { Loading, Notice } from './Ui'

const hourLabel = new Intl.DateTimeFormat('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', hour: '2-digit', minute: '2-digit' })

export default function ForecastPanel({ id, vehicleFilter }) {
  const forecast = useResource('/api/parking-lots/' + id + '/forecast' + (vehicleFilter ? '?type=' + vehicleFilter : ''))
  const result = forecast.data
  const max = result?.ready ? Math.max(...result.points.map((point) => point.available)) : 0
  return <section className="panel section-gap forecast-panel">
    <div className="panel-head"><div><h2>Dự báo chỗ trống</h2><p>12 giờ tiếp theo · Giờ Việt Nam</p></div><span className="pill pill-green">Học máy</span></div>
    {forecast.loading ? <Loading /> : <><Notice error={forecast.error} />{!forecast.error && result && (result.ready ? <>
      <div className="forecast-plot" aria-label="Số chỗ trống dự báo theo giờ">
        {result.points.map((point) => <div className={'forecast-column' + (point.available === max ? ' forecast-high' : '')} key={point.atUtc} aria-label={hourLabel.format(new Date(point.atUtc)) + ', ' + point.available + ' chỗ trống'}>
          <strong>{point.available}</strong><div className="forecast-track"><span style={{ height: Math.max(2, point.available / result.capacity * 100) + '%' }} /></div><time dateTime={point.atUtc}>{hourLabel.format(new Date(point.atUtc))}</time>
        </div>)}
      </div>
      <p className="helper-text">Dựa trên {result.sampleSessions.toLocaleString('vi-VN')} lượt gửi trong {result.historyDays} ngày. Sai số trung bình khi kiểm tra trên 3 ngày gần nhất: {result.meanAbsoluteError.toLocaleString('vi-VN')} chỗ. Dự báo chưa tính lịch đặt sắp tới và không bảo đảm còn chỗ khi đến.</p>
    </> : <p>Chưa đủ dữ liệu dự báo ({result.sampleSessions} lượt trong {result.historyDays} ngày). Cần ít nhất 20 lượt gửi đã hoàn tất và lịch sử trải dài 14 ngày.</p>)}</>}
  </section>
}
