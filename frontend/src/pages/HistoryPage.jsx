import { Link } from 'react-router'
import { useAuth } from '../auth/useAuth'
import { useResource } from '../lib/useResource'
import { dateTime, money, parkingDuration } from '../lib/format'
import { PageHeader, Loading, Notice, Empty } from '../components/Ui'

export default function HistoryPage() {
  const { token } = useAuth()
  const sessions = useResource('/api/parking-sessions/mine', token)
  const vehicles = useResource('/api/vehicles/mine', token)
  const spots = useResource('/api/parking-spots')
  return <main className="page-wrap">
    <PageHeader title="Lịch sử gửi xe" description="Theo dõi thời gian ra vào, phí gửi xe và trạng thái thanh toán."
      actions={<Link className="button light-button" to="/payments">Thanh toán →</Link>} />
    <Notice error={sessions.error || vehicles.error || spots.error} />
    {sessions.loading ? <Loading /> : !sessions.error && (!sessions.data?.length ? <Empty>Bạn chưa có lượt gửi xe nào.</Empty> :
      <section className="panel table-panel"><div className="table-scroll">
        <table>
          <thead><tr><th>Xe / ô đỗ</th><th>Vào bãi</th><th>Ra bãi</th><th>Thời gian gửi</th><th>Phí</th><th>Thanh toán</th></tr></thead>
          <tbody>{sessions.data.map((item) => <tr key={item.id}>
            <td><strong>{vehicles.data?.find((vehicle) => vehicle.id === item.vehicleId)?.plateNumber || 'Xe #' + item.vehicleId}</strong><br />
              {spots.data?.find((spot) => spot.id === item.parkingSpotId)?.code || 'Ô #' + item.parkingSpotId}</td>
            <td>{dateTime(item.checkInUtc)}</td>
            <td>{dateTime(item.checkOutUtc)}</td>
            <td>{parkingDuration(Date.parse(item.checkOutUtc) - Date.parse(item.checkInUtc))}</td>
            <td>{money(item.fee)}</td>
            <td>{item.checkOutUtc ? <Link className={'pill bill-history-link ' + (item.isPaid ? 'pill-green' : 'pill-amber')} to={'/payments?session=' + item.id}>
              {item.isPaid ? 'Đã thanh toán' : 'Thanh toán'}
            </Link> : <Link className="pill pill-amber bill-history-link" to={'/parked?session=' + item.id}>Đang gửi · Tìm xe</Link>}</td>
          </tr>)}</tbody>
        </table>
      </div></section>)}
  </main>
}
