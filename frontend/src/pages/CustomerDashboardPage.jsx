import { useState } from 'react'
import { Link } from 'react-router'
import Icon from '../components/Icon'
import { useAuth } from '../auth/useAuth'
import { Empty, Loading, Notice } from '../components/Ui'
import { dateTime, reservationStates, reservationStatus } from '../lib/format'
import { useResource } from '../lib/useResource'

const actions = [
  { to: '/reservations', icon: 'pin', title: 'Đặt chỗ', description: 'Chọn bãi, giờ đến và ô đỗ.' },
  { to: '/parked', icon: 'map', title: 'Tìm xe đang gửi', description: 'Xem vị trí xe trên sơ đồ 2D hoặc 3D.' },
  { to: '/vehicles', icon: 'car', title: 'Xe của tôi', description: 'Thêm và quản lý biển số xe.' },
]

export default function CustomerDashboardPage() {
  const { user, token } = useAuth()
  const sessions = useResource('/api/parking-sessions/mine/active', token)
  const reservations = useResource('/api/reservations/mine', token)
  const [openedAt] = useState(Date.now)
  const upcoming = (reservations.data || [])
    .filter((item) => (item.status === reservationStates.confirmed && Date.parse(item.endUtc) > openedAt) ||
      (item.status === reservationStates.pending && Date.parse(item.startUtc) > openedAt))
    .sort((first, second) => Date.parse(first.startUtc) - Date.parse(second.startUtc))
  const name = user.displayName?.trim()

  return <main className="page-wrap customer-home">
    <section className="portal-hero customer-hero">
      <div className="portal-hero-copy">
        {name && <p className="portal-kicker">Xin chào, {name}</p>}
        <h1>Gửi xe của tôi</h1>
        <p>Đặt chỗ trước khi đến và tìm đúng vị trí khi quay lại lấy xe.</p>
        <Link className="button portal-hero-action" to="/#lots">Khám phá bãi xe <Icon name="arrow" size={16} /></Link>
      </div>
      <div className="trip-ticket"><Icon name="map" size={24} /><span>{sessions.data?.length ? 'Xe đang gửi' : 'Lịch đặt tiếp theo'}</span>
        {sessions.loading || reservations.loading ? <strong>Đang tải…</strong> : sessions.error || reservations.error ? <strong>Chưa tải được lượt gửi</strong> : sessions.data?.length ?
          <><strong>{sessions.data[0].plateNumber}</strong><small>{sessions.data[0].lotName} · Ô {sessions.data[0].spotCode}</small><Link to={'/parked?session=' + sessions.data[0].id}>Xem vị trí xe ↗</Link></> :
          upcoming.length ? <><strong>{dateTime(upcoming[0].startUtc)}</strong><Link to="/reservations">Xem lịch #{upcoming[0].id} ↗</Link></> :
          <><strong>Chưa có lịch đặt</strong><Link to="/parking-search">Tìm bãi theo giờ đến ↗</Link></>}
      </div>
    </section>

    <nav className="customer-shortcuts" aria-label="Thao tác gửi xe">
      {actions.map(({ to, icon, title, description }) => <Link key={to} to={to} className="portal-card shortcut">
        <span className="portal-icon"><Icon name={icon} /></span>
        <span className="shortcut-copy"><strong>{title}</strong><small>{description}</small></span>
        <Icon name="arrow" size={16} />
      </Link>)}
    </nav>

    <div className="customer-activity">
      <section className="portal-card activity-card">
        <div className="activity-heading"><h2>Xe đang trong bãi</h2><Link to="/parked">Tất cả <Icon name="arrow" size={15} /></Link></div>
        {sessions.loading ? <Loading /> : sessions.error ? <Notice error={sessions.error} /> :
          sessions.data?.length ? <ul className="activity-list">{sessions.data.slice(0, 3).map((item) =>
            <li key={item.id}><Link to={'/parked?session=' + item.id}>
              <span className="portal-icon"><Icon name="car" size={18} /></span>
              <span><strong>{item.plateNumber}</strong><small>{item.lotName} · Ô {item.spotCode}</small></span>
              <Icon name="arrow" size={15} />
            </Link></li>
          )}</ul> : <Empty>Bạn chưa có xe đang gửi.</Empty>}
      </section>
      <section className="portal-card activity-card">
        <div className="activity-heading"><h2>Lịch đặt sắp tới</h2><Link to="/reservations">Tất cả <Icon name="arrow" size={15} /></Link></div>
        {reservations.loading ? <Loading /> : reservations.error ? <Notice error={reservations.error} /> :
          upcoming.length ? <ul className="activity-list">{upcoming.slice(0, 3).map((item) =>
            <li key={item.id}><Link to="/reservations">
              <span className="portal-icon"><Icon name="clock" size={18} /></span>
              <span><strong>{dateTime(item.startUtc)}</strong><small>Lịch đặt #{item.id} · {reservationStatus[item.status]}</small></span>
              <Icon name="arrow" size={15} />
            </Link></li>
          )}</ul> : <Empty>Bạn chưa có lịch đặt còn hiệu lực.</Empty>}
      </section>
    </div>
  </main>
}
