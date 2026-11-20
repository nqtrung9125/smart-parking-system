import { Link, NavLink, useLocation } from 'react-router'
import AccountLink from './AccountLink'
import { useAuth } from '../auth/useAuth'
import { portalFor, portalPaths } from '../lib/portal'
import './site-chrome.css'

export function Brand() {
  return <Link className="parking-brand" to="/" aria-label="Smart Parking, trang chủ"><span className="parking-mark">P</span><span>Smart<span>Parking</span></span></Link>
}

export function SiteHeader() {
  const { user } = useAuth()
  const location = useLocation()
  const area = portalFor(user)
  const home = location.pathname === '/'
  const directory = (home && location.hash !== '#guide') || location.pathname.startsWith('/lots/')
  return <header className="site-top" id="site-top"><div className="site-shell">
    <Brand />
    <nav className="site-nav" aria-label="Điều hướng chính">
      <Link to="/#lots" aria-current={directory ? 'location' : undefined}>Danh sách bãi</Link>
      {area === 'customer' && <NavLink to="/reservations">Đặt chỗ</NavLink>}
      {user ? <NavLink to={portalPaths[area]}>{area === 'admin' ? 'Quản trị' : area === 'staff' ? 'Ca trực' : 'Gửi xe cá nhân'}</NavLink>
        : <Link to="/#guide" aria-current={home && location.hash === '#guide' ? 'location' : undefined}>Hướng dẫn</Link>}
    </nav>
    <div className="site-account">{user ? <AccountLink user={user} /> : <Link className="site-login" to="/login">Đăng nhập <span aria-hidden="true">↗</span></Link>}</div>
  </div></header>
}

export function SiteFooter() {
  const { user } = useAuth()
  return <footer className="site-bottom"><div className="site-shell">
    <div className="site-bottom-main">
      <div className="footer-intro"><Brand /><p>Tìm chỗ trước khi đến, xem lại vị trí trước khi lấy xe.</p></div>
      <nav aria-label="Khám phá và đặt chỗ"><h2>Lên lịch đỗ xe</h2><Link to="/#lots">Danh sách bãi</Link><Link to="/reservations">Đặt chỗ</Link><Link to="/#guide">Cách hoạt động</Link></nav>
      <nav aria-label="Tài khoản"><h2>Tài khoản</h2>{user ? <Link to="/account">Thông tin tài khoản</Link> : <><Link to="/login">Đăng nhập</Link><Link to="/register">Tạo tài khoản</Link></>}</nav>
    </div>
    <div className="site-bottom-meta"><a href="#site-top">Về đầu trang ↑</a></div>
  </div></footer>
}
