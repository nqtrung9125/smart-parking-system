import { Link, NavLink, Navigate, Outlet, useLocation } from 'react-router'
import { useAuth } from '../auth/useAuth'
import '../workspace.css'

const links = [
  { to: '/', label: 'Trang chủ' },
  { to: '/vehicles', label: 'Xe của tôi', auth: true },
  { to: '/reservations', label: 'Đặt chỗ', auth: true },
  { to: '/history', label: 'Lịch sử', auth: true },
  { to: '/staff/check-in', label: 'Nhân viên', roles: ['Admin', 'Staff'] },
  { to: '/admin', label: 'Quản trị', roles: ['Admin'] },
]

export function Layout() {
  const { user, logout } = useAuth()
  return <div className="workspace-shell">
    <header className="workspace-header">
      <Link to="/" className="workspace-brand">P<span>.</span> <small>smartparking</small></Link>
      <nav aria-label="Điều hướng chính">{links.filter((item) => item.roles ? item.roles.some((role) => user?.roles?.includes(role)) : !item.auth || user).map((item) => <NavLink key={item.to} to={item.to} end={item.to === '/'} className={({ isActive }) => isActive ? 'active' : ''}>{item.label}</NavLink>)}</nav>
      <div className="account-actions">{user ? <><span className="account-email" title={user.email}>{user.email}</span><button className="quiet-button" onClick={logout}>Đăng xuất</button></> : <Link className="primary-link" to="/login">Đăng nhập</Link>}</div>
    </header>
    <Outlet />
    <footer className="workspace-footer">Smart Parking · Quản lý bãi đỗ xe</footer>
  </div>
}

export function RequireAuth({ roles, children }) {
  const { user, ready } = useAuth()
  const location = useLocation()
  if (!ready) return <div className="page-wrap"><p>Đang kiểm tra phiên đăng nhập…</p></div>
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />
  if (roles && !roles.some((role) => user.roles.includes(role))) return <div className="page-wrap"><h1>Không có quyền truy cập</h1><p>Tài khoản này không có quyền dùng trang bạn vừa mở.</p><Link to="/">Về trang chủ</Link></div>
  return children
}
