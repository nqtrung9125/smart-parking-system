import { Link } from 'react-router'
import { initials, roleNames } from '../lib/format'

export default function AccountLink({ user }) {
  return <Link className="account-link" to="/account" aria-label="Thông tin tài khoản">
    <span className="account-avatar" aria-hidden="true">{initials(user.displayName || user.email?.split('@')[0])}</span>
    <span className="account-link-copy"><strong>{user.displayName || 'Tài khoản'}</strong><span>{roleNames(user.roles).join(' · ')}</span></span>
    <span className="account-link-arrow" aria-hidden="true">↗</span>
  </Link>
}
