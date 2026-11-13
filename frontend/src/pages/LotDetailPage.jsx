import { Link, useParams } from 'react-router'
import { useResource } from '../lib/useResource'
import { PageHeader, Loading, Notice, Empty } from '../components/Ui'
import { spotStatus, vehicleType } from '../lib/format'

export default function LotDetailPage() {
  const { id } = useParams()
  const lot = useResource(`/api/parking-lots/${id}`)
  const map = useResource(`/api/parking-spots/map?parkingLotId=${id}`)
  const spots = map.data || []
  const available = spots.filter((spot) => spot.status === 'Available').length
  return <main className="page-wrap">
    <PageHeader eyebrow="CHI TIẾT BÃI XE" title={lot.data?.name || 'Sơ đồ bãi xe'} description={lot.data?.address} actions={<Link className="button light-button" to="/">← Về danh sách</Link>} />
    {(lot.loading || map.loading) && <Loading />}
    <Notice error={lot.error || map.error} />
    {!map.loading && !map.error && <><div className="stat-row"><div className="stat-box"><strong>{spots.length}</strong><span>Tổng chỗ</span></div><div className="stat-box"><strong>{available}</strong><span>Chưa có xe hoặc lịch đặt lúc này</span></div><div className="stat-box"><strong>{spots.filter((s) => s.status === 'Occupied').length}</strong><span>Đang có xe</span></div></div>
      <section className="panel"><div className="panel-head"><div><h2>Sơ đồ chỗ đỗ</h2><p>Trạng thái tại thời điểm tải trang. Nhấn cập nhật để lấy dữ liệu mới.</p></div><button className="button light-button" onClick={map.refresh}>Cập nhật</button></div>
        {spots.length ? <div className="detail-map"><div className="detail-lane">LỐI DI CHUYỂN →</div><div className="detail-spots">{spots.map((spot) => <div key={spot.id} className={`detail-spot status-${spot.status.toLowerCase()}`}><strong>{spot.code}</strong><span>{vehicleType(spot.type)}</span><em>{spotStatus[spot.status]}</em></div>)}</div></div> : <Empty>Bãi xe này chưa có chỗ đỗ.</Empty>}
        <p className="helper-text">Trạng thái có thể thay đổi khi nhân viên nhận xe, trả xe hoặc khách đặt chỗ.</p>
      </section>
      <div className="page-bottom-action"><Link to="/reservations" className="button main-button">Đặt chỗ tại bãi xe</Link></div>
    </>}
  </main>
}
