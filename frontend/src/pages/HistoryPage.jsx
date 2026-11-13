import { Link } from 'react-router'
import { useAuth } from '../auth/useAuth'
import { useResource } from '../lib/useResource'
import { dateTime, money } from '../lib/format'
import { PageHeader, Loading, Notice, Empty } from '../components/Ui'

export default function HistoryPage() {
  const { token } = useAuth()
  const sessions = useResource('/api/parking-sessions/mine', token)
  const vehicles = useResource('/api/vehicles/mine', token)
  const spots = useResource('/api/parking-spots')
  return <main className="page-wrap"><PageHeader eyebrow="TÀI KHOẢN CỦA TÔI" title="Lịch sử gửi xe" description="Theo dõi thời gian ra vào, phí gửi xe và trạng thái thanh toán." actions={<Link className="button light-button" to="/parked">Tìm xe đang gửi →</Link>} />
    <Notice error={sessions.error || vehicles.error || spots.error} />
    {sessions.loading ? <Loading /> : !sessions.data?.length ? <Empty>Bạn chưa có lượt gửi xe nào.</Empty> : <section className="panel table-panel"><div className="table-scroll"><table><thead><tr><th>Xe</th><th>Chỗ đỗ</th><th>Vào bãi</th><th>Ra bãi</th><th>Phí</th><th>Thanh toán</th></tr></thead><tbody>{sessions.data.map((item) => <tr key={item.id}><td>{vehicles.data?.find((v) => v.id === item.vehicleId)?.plateNumber || `Xe #${item.vehicleId}`}</td><td>{spots.data?.find((s) => s.id === item.parkingSpotId)?.code || `#${item.parkingSpotId}`}</td><td>{dateTime(item.checkInUtc)}</td><td>{dateTime(item.checkOutUtc)}</td><td>{money(item.fee)}</td><td><span className={`pill ${item.isPaid ? 'pill-green' : 'pill-amber'}`}>{item.isPaid ? 'Đã thanh toán' : item.checkOutUtc ? 'Chưa thanh toán' : 'Đang gửi'}</span></td></tr>)}</tbody></table></div></section>}
  </main>
}
