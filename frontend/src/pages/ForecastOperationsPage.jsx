import { useState } from 'react'
import { useAuth } from '../auth/useAuth'
import { Empty, Field, Loading, Notice, PageHeader } from '../components/Ui'
import { useResource } from '../lib/useResource'
import { dateTime } from '../lib/format'
import './parking-search.css'

const formatError = (error) => error == null ? '—' : error.toLocaleString('vi-VN') + ' chỗ'

function ChartRows({ points, capacity, labels, values }) {
  return <div className="forecast-scroll"><table className="forecast-table">
    <thead><tr><th scope="col">Thời điểm</th>{labels.map((label) => <th key={label} scope="col">{label}</th>)}</tr></thead>
    <tbody>{points.map((point, index) => <tr key={point.atUtc + ':' + index}>
      <th scope="row">{dateTime(point.atUtc)}</th>
      {values(point).map((value, series) => <td key={labels[series]}><div className="forecast-bars"><span>
        {value != null && <i aria-hidden="true" className={series ? 'comparison-bar' : undefined}
          style={{ '--fraction': value / Math.max(1, capacity) }} />}{value ?? '—'}
      </span></div></td>)}
    </tr>)}</tbody>
  </table></div>
}

export default function ForecastOperationsPage({ admin = false }) {
  const { token } = useAuth()
  const lots = useResource('/api/parking-lots/assigned', token)
  const [requestedLot, setLot] = useState('')
  const [type, setType] = useState('2')
  const lot = lots.data?.find((item) => String(item.id) === requestedLot) || lots.data?.[0]
  const report = useResource(lot ? '/api/parking-search/operations/' + lot.id + '?type=' + type : null, token)
  const { capacity, points, source, evaluation, contextEvaluation, contextSeasonalError } = report.data || {}

  return <main className="page-wrap">
    <PageHeader title="Dự báo bãi xe" description="Theo dõi nhu cầu từng giờ và số ô đã có lịch được duyệt."
      actions={<button type="button" className="button light-button" disabled={!lot || report.loading}
        onClick={report.refresh}>Cập nhật</button>} />
    <Notice error={lots.error || report.error} />
    {lots.loading ? <Loading /> : !lot ? <Empty>Chưa có bãi trong phạm vi phụ trách.</Empty> : <>
      <div className="panel arrival-fields">
        <Field label="Bãi xe"><select value={lot.id} onChange={(event) => setLot(event.target.value)}>
          {lots.data.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
        </select></Field>
        <Field label="Loại xe"><select value={type} onChange={(event) => setType(event.target.value)}>
          <option value="2">Ô tô</option><option value="1">Xe máy</option>
        </select></Field>
      </div>
      {report.loading ? <Loading /> : points && <section className="panel section-gap">
        <h2>12 giờ tới</h2>
        <p>{capacity} ô đang khai thác · {source === 'synthetic' ? 'Nguồn dự báo: dữ liệu mô phỏng' :
          source === 'operational' ? 'Nguồn dự báo: lịch sử vận hành' : 'Chưa đủ dữ liệu dự báo'}</p>
        <ChartRows points={points} capacity={capacity} labels={['Dự kiến có xe', 'Ô có lịch đã duyệt']}
          values={(point) => [point.predictedOccupied, point.confirmedSpots]} />
      </section>}
      {admin && evaluation && <section className="panel section-gap">
        <h2>Dự báo so với số liệu ghi nhận</h2>
        <p className="forecast-key">
          <span>KNN theo giờ và thứ <strong>{formatError(evaluation.meanAbsoluteError)}</strong></span>
          <span>Cùng giờ tuần trước <strong>{formatError(evaluation.previousWeekError)}</strong></span>
        </p>
        <p>{evaluation.count} giờ kiểm tra · {evaluation.falseAvailabilityCount} giờ dự báo còn chỗ khi số liệu ghi nhận cho thấy bãi đầy.</p>
        {contextEvaluation && <p>Trên {contextEvaluation.count} mẫu có dữ liệu thời điểm dự báo, sai số KNN có ngữ cảnh là
          {' '}{formatError(contextEvaluation.meanAbsoluteError)}, so với {formatError(contextSeasonalError)} của KNN theo giờ và thứ.</p>}
        <ChartRows points={evaluation.points} capacity={capacity} labels={['KNN dự báo', 'Số ô ghi nhận có xe']}
          values={(point) => [point.predicted, point.actual]} />
      </section>}
    </>}
  </main>
}
