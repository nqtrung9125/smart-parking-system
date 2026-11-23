import { Link, NavLink, useLocation } from 'react-router'
import { useRef } from 'react'
import NavDisclosure from './NavDisclosure'
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
  const navigation = <>
    <Link to="/#lots" aria-current={directory ? 'location' : undefined}>Danh sách bãi</Link>
    <NavLink to="/parking-search">Tìm theo giờ đến</NavLink>
    {area === 'customer' && <NavLink to="/reservations">Đặt chỗ</NavLink>}
    {user && <NavLink to={portalPaths[area]}>{area === 'admin' ? 'Quản trị' : area === 'staff' ? 'Ca trực' : 'Gửi xe cá nhân'}</NavLink>}
  </>
  return <header className="site-top" id="site-top"><div className="site-shell">
    <Brand />
    <nav className="site-nav" aria-label="Điều hướng chính">{navigation}</nav>
    <NavDisclosure className="mobile-menu" label="Mở điều hướng" trigger="☰ Menu"><nav aria-label="Điều hướng di động">{navigation}</nav></NavDisclosure>
    <div className="site-account">{user ? <AccountLink user={user} /> : <Link className="site-login" to="/login">Đăng nhập <span aria-hidden="true">↗</span></Link>}</div>
  </div></header>
}

const footerLinks = {
  customer: [['/parking-search', 'Tìm bãi theo giờ'], ['/reservations', 'Đặt chỗ'], ['/parked', 'Tìm xe đã gửi']],
  staff: [['/staff/check-in', 'Nhận xe'], ['/staff/check-out', 'Trả xe và thu phí'], ['/staff/revenue', 'Doanh thu bãi']],
  admin: [['/admin/manage', 'Quản lý bãi'], ['/admin/manage?tab=staff', 'Phân công nhân viên'], ['/admin/forecast', 'Dự báo nhu cầu']],
}
const helpSteps = {
  customer: ['Chọn bãi và khung giờ đến để tìm ô phù hợp với xe.', 'Kiểm tra tiền cọc và phí dự kiến trước khi xác nhận.', 'Mở Tìm xe để xem lại vị trí khi lấy xe.'],
  staff: ['Mở Bãi phụ trách để kiểm tra bãi được phân công.', 'Tra lịch đặt hoặc biển số tại quầy nhận xe.', 'Khi trả xe, kiểm tra phí và trạng thái thanh toán trước khi hoàn tất.'],
  admin: ['Mở Quản lý bãi để kiểm tra bãi và ô đỗ.', 'Phân công nhân viên theo bãi trước khi giao ca.', 'Mở Doanh thu hoặc Dự báo để so sánh tình hình vận hành.'],
}
export function SiteFooter({ area }) {
  const { user } = useAuth()
  const view = area || portalFor(user)
  const dialog = useRef(null)
  return <footer className="site-bottom"><div className="site-shell">
    <div className="site-bottom-main">
      <div className="footer-intro"><Brand /><p>Hệ thống quản lý bãi đỗ xe Đà Nẵng</p></div>
      <nav aria-label="Lối tắt cuối trang"><h2>{view === 'admin' ? 'Quản trị' : view === 'staff' ? 'Ca trực' : 'Gửi xe'}</h2>
        {footerLinks[view].map(([to, label]) => <Link key={to} to={to}>{label}</Link>)}</nav>
      <nav aria-label="Hỗ trợ và tài khoản"><h2>Trợ giúp</h2>
        <button type="button" onClick={() => dialog.current.showModal()}>Hướng dẫn sử dụng</button>
        <Link to={user ? '/account' : '/login'}>{user ? 'Hồ sơ tài khoản' : 'Đăng nhập'}</Link>
        {!user && <Link to="/register">Tạo tài khoản</Link>}
      </nav>
    </div>
    <div className="site-bottom-meta"><button type="button" onClick={() => window.scrollTo({top: 0, behavior: 'instant'})}>Về đầu trang ↑</button></div>
    <dialog ref={dialog} className="help-dialog" aria-labelledby="help-title">
      <h2 id="help-title">Hướng dẫn {view === 'admin' ? 'quản trị' : view === 'staff' ? 'ca trực' : 'gửi xe'}</h2>
      <ol>{helpSteps[view].map(step => <li key={step}>{step}</li>)}</ol>
      <form method="dialog"><button className="button main-button">Đóng hướng dẫn</button></form>
    </dialog>
  </div></footer>
}
