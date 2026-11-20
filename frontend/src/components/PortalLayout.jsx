import { Link, Outlet, useLocation } from 'react-router'
import { useAuth } from '../auth/useAuth'
import { portalFor, portalPaths } from '../lib/portal'
import AccountLink from './AccountLink'
import { Brand } from './SiteChrome'
import Icon from './Icon'
import './portal.css'

const accountLinks = [
  { to: '/account', label: 'Tài khoản', icon: 'car' },
  { to: '/security', label: 'Bảo mật', icon: 'grid' },
]

const areas = {
  customer: {
    title: 'Gửi xe cá nhân',
    primary: [
      { to: '/my-parking', label: 'Tổng quan', icon: 'grid' },
      { to: '/reservations', label: 'Đặt chỗ', icon: 'pin' },
      { to: '/parked', label: 'Tìm xe', icon: 'map' },
      { to: '/vehicles', label: 'Xe của tôi', icon: 'car' },
      { to: '/payments', label: 'Thanh toán', icon: 'wallet' },
      { to: '/wallet', label: 'Số dư', icon: 'wallet' },
      { to: '/history', label: 'Lịch sử', icon: 'clock' },
    ],
  },
  staff: {
    title: 'Ca trực bãi xe',
    primary: [
      { to: '/staff/check-in', label: 'Nhận xe', icon: 'car' },
      { to: '/staff/check-out', label: 'Trả xe & thu phí', icon: 'arrow' },
      { to: '/staff/reservations', label: 'Duyệt đặt chỗ', icon: 'clock' },
      { to: '/staff/revenue', label: 'Doanh thu', icon: 'wallet' },
    ],
  },
  admin: {
    title: 'Quản trị hệ thống',
    primary: [
      { to: '/admin', label: 'Tổng quan', icon: 'grid' },
      { to: '/admin/manage', label: 'Bãi xe', icon: 'pin' },
      { to: '/admin/manage?tab=spots', label: 'Chỗ đỗ', icon: 'map' },
      { to: '/admin/manage?tab=staff', label: 'Nhân viên', icon: 'car' },
      { to: '/admin/reservations', label: 'Duyệt đặt chỗ', icon: 'clock' },
      { to: '/admin/wallet', label: 'Duyệt nạp số dư', icon: 'wallet' },
      { to: '/admin/revenue', label: 'Doanh thu', icon: 'wallet' },
    ],
  },
}

function currentLink(to, { pathname, search }) {
  const [targetPath, targetSearch] = to.split('?')
  if (pathname !== targetPath) return false
  if (pathname !== '/admin/manage') return true
  const requested = new URLSearchParams(search).get('tab')
  const tab = requested === 'spots' || requested === 'staff' ? requested : 'lots'
  return tab === (new URLSearchParams(targetSearch).get('tab') || 'lots')
}

function PortalNav({ links, label, location }) {
  return <nav className="portal-nav" aria-label={label}>
    {links.map(({ to, label: name, icon }) => {
      const active = currentLink(to, location)
      return <Link key={to} to={to} aria-current={active ? 'page' : undefined}>
        <Icon name={icon} size={17} /><span>{name}</span>
      </Link>
    })}
  </nav>
}

export default function PortalLayout({ area }) {
  const { user } = useAuth()
  const location = useLocation()
  const ownArea = portalFor(user)
  const view = area || ownArea
  const config = areas[view]
  const admin = user.roles.includes('Admin')
  const browsing = location.pathname === '/' || location.pathname.startsWith('/lots/')

  return <div className={'workspace-shell portal-shell portal-' + view}>
    <aside className="portal-sidebar" aria-label={config.title}>
      <div className="portal-brand"><Brand /><span>{config.title}</span></div>
      <PortalNav links={config.primary} label={config.title} location={location} />
      {view !== 'customer' && <div className="portal-sidebar-bottom">
        <PortalNav links={accountLinks} label="Thông tin cá nhân" location={location} />
        {admin && view === 'admin' && <Link className="portal-switch" to={portalPaths.staff}>Mở ca trực <Icon name="arrow" size={16} /></Link>}
        {admin && view === 'staff' && <Link className="portal-switch" to={portalPaths.admin}>Về quản trị <Icon name="arrow" size={16} /></Link>}
      </div>}
    </aside>
    <div className="portal-body">
      <header className="portal-topbar" id="site-top">
        <div className="portal-top-links">
          {view !== 'customer' && <span className="portal-context">{config.title}</span>}
          <Link to="/#lots" aria-current={browsing ? 'location' : undefined}>{ownArea === 'staff' ? 'Bãi phụ trách' : 'Danh sách bãi xe'}</Link>
          {view === 'customer' && ownArea !== 'customer' && <Link to={portalPaths[ownArea]}>{areas[ownArea].title}</Link>}
        </div>
        <AccountLink user={user} />
      </header>
      <Outlet />
      <footer className="portal-footer">
        <span>Smart Parking</span>
        <a href="#site-top">Về đầu trang ↑</a>
      </footer>
    </div>
  </div>
}
