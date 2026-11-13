import { Link, Navigate, Outlet, useLocation } from 'react-router'
import { useAuth } from '../auth/useAuth'
import { SiteHeader, SiteFooter } from './SiteChrome'
import '../workspace.css'

export function Layout() {
  return <div className="workspace-shell">
    <SiteHeader />
    <Outlet />
    <SiteFooter />
  </div>
}

export function RequireAuth({ roles, children }) {
  const { user, ready } = useAuth()
  const location = useLocation()
  if (!ready) return <div className="page-wrap"><p>Đang kiểm tra phiên đăng nhập…</p></div>
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />
  if (roles && !roles.some((role) => user.roles.includes(role))) return <div className="page-wrap"><h1>Không có quyền truy cập</h1><p>Tài khoản này không có quyền dùng trang bạn vừa mở.</p><Link to="/">Về trang chủ</Link></div>
  return children
}
