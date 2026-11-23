import { Link, useNavigate } from 'react-router'
import { initials, roleNames } from '../lib/format'
import { useAuth } from '../auth/useAuth'
import NavDisclosure from './NavDisclosure'

export default function AccountLink({ user }) {
  const { logout } = useAuth()
  const navigate = useNavigate()
  const name = user.displayName || user.email || 'Tài khoản'
  return <NavDisclosure label={'Menu tài khoản ' + name} trigger={<span className="account-link">
    <span className="account-avatar" aria-hidden="true">{initials(name)}</span>
    <span className="account-link-copy"><strong>{name}</strong><span>{roleNames(user.roles).join(' · ')}</span></span><span aria-hidden="true">⌄</span>
  </span>}>
    <Link to="/account">Hồ sơ tài khoản</Link><Link to="/security">Bảo mật</Link>
    <button type="button" onClick={() => { logout(); navigate('/') }}>Đăng xuất</button>
  </NavDisclosure>
}
