import { Link, NavLink, useLocation } from 'react-router'
import AccountLink from './AccountLink'
import { useAuth } from '../auth/useAuth'
import './site-chrome.css'

export function Brand() {
  return <Link className="parking-brand" to="/" aria-label="Smart Parking, trang chủ"><span className="parking-mark">P</span><span>Smart<span>Parking</span></span></Link>
}

export function SiteHeader() {
  const { user } = useAuth()
  const location = useLocation()
  const roles = user?.roles || []
  const home = location.pathname === '/'
  return <header className="site-top" id="site-top"><div className="site-shell">
    <div className="site-identity"><Brand /><span className="site-caption">TÌM BÃI · ĐẶT CHỖ · LẤY XE</span></div>
    <nav className="site-nav" aria-label="Điều hướng chính">
      <Link to="/#lots" className={home && location.hash !== '#guide' ? 'nav-current' : undefined}>Khám phá bãi</Link>
      <NavLink to="/reservations">Đặt chỗ</NavLink>
      <NavLink to="/parked">Xe đang gửi</NavLink>
      {user ? <>
        <NavLink to="/vehicles">Xe của tôi</NavLink>
        <NavLink to="/history">Lịch sử</NavLink>
        {roles.some((role) => role === 'Admin' || role === 'Staff') && <NavLink to="/staff/check-in">Nhân viên</NavLink>}
        {roles.includes('Admin') && <NavLink to="/admin">Quản trị</NavLink>}
      </> : <Link to="/#guide" className={home && location.hash === '#guide' ? 'nav-current' : undefined}>Hướng dẫn</Link>}
    </nav>
    <div className="site-account">{user ? <AccountLink user={user} /> : <Link className="site-login" to="/login">Đăng nhập <span aria-hidden="true">↗</span></Link>}</div>
  </div></header>
}

export function SiteFooter() {
  return <footer className="site-bottom"><div className="site-shell">
    <div className="site-bottom-main">
      <div className="footer-intro"><Brand /><p>Tìm chỗ trước khi đến, xem lại vị trí trước khi lấy xe.</p></div>
      <nav aria-label="Khám phá và đặt chỗ"><h2>Lên lịch đỗ xe</h2><Link to="/#lots">Danh sách bãi</Link><Link to="/reservations">Đặt chỗ</Link><Link to="/#guide">Cách hoạt động</Link></nav>
      <nav aria-label="Tài khoản và xe"><h2>Xe và tài khoản</h2><Link to="/parked">Tìm xe đang gửi</Link><Link to="/history">Lịch sử gửi xe</Link><Link to="/account">Thông tin tài khoản</Link></nav>
    </div>
    <div className="site-bottom-meta"><span>Smart Parking · Đồ án quản lý bãi đỗ xe</span><a href="#site-top">Về đầu trang ↑</a></div>
  </div></footer>
}
