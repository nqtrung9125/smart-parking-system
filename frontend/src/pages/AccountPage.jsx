import { useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { useAuth } from '../auth/useAuth'
import { api } from '../lib/api'
import { useResource } from '../lib/useResource'
import { initials, roleNames } from '../lib/format'
import { Field, Notice, PageHeader } from '../components/Ui'

export default function AccountPage() {
  const { user, token, logout, setProfile } = useAuth()
  const navigate = useNavigate()
  const vehicles = useResource('/api/vehicles/mine', token)
  const reservations = useResource('/api/reservations/mine', token)
  const [displayName, setName] = useState(user.displayName || '')
  const [contactPhone, setPhone] = useState(user.contactPhone || '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [loadedAt] = useState(() => Date.now())
  const display = user.displayName || 'Tài khoản của tôi'

  async function save(event) {
    event.preventDefault()
    setBusy(true); setError(''); setSuccess('')
    try {
      const result = await api('/api/me', { method: 'PUT', token, body: {
        displayName: displayName.trim() || null, contactPhone: contactPhone.trim() || null,
      } })
      setProfile(result)
      setName(result.displayName || ''); setPhone(result.contactPhone || '')
      setSuccess('Đã lưu thông tin tài khoản.')
    } catch (cause) { setError(cause.message) }
    finally { setBusy(false) }
  }

  return <main className="page-wrap">
    <PageHeader eyebrow="KHU VỰC CÁ NHÂN" title="Thông tin tài khoản" description="Xem thông tin đăng nhập, quản lý hồ sơ và bảo mật." />
    <section className="account-overview" aria-label="Tổng quan tài khoản">
      <div className="profile-identity"><span className="account-avatar profile-avatar" aria-hidden="true">{initials(user.displayName || user.email?.split('@')[0])}</span><div><span className="profile-overline">HỒ SƠ CÁ NHÂN</span><h2>{display}</h2><p>{user.email}</p><div className="profile-roles">{roleNames(user.roles).map((role) => <span key={role}>{role}</span>)}</div></div></div>
      <div className="profile-metrics"><Link to="/vehicles"><strong>{vehicles.data?.length ?? '—'}</strong> Xe đã lưu</Link><Link to="/reservations"><strong>{reservations.data?.filter((row) => row.status === 1 && Date.parse(row.endUtc) > loadedAt).length ?? '—'}</strong> Lịch đang hiệu lực</Link></div>
    </section>
    <div className="two-column section-gap">
      <form className="panel" onSubmit={save}>
        <h2>Hồ sơ cá nhân</h2>
        <Notice error={error} success={success} />
        <Field label="Tên hiển thị"><input autoComplete="name" value={displayName} maxLength={80} onChange={(event) => setName(event.target.value)} placeholder="Nhập tên của bạn" /></Field>
        <Field label="Email đăng nhập"><input type="email" value={user.email || ''} readOnly /></Field>
        <Field label="Số điện thoại liên hệ" hint="Không bắt buộc. Số này dùng để liên hệ."><input type="tel" autoComplete="tel" maxLength={20} value={contactPhone} onChange={(event) => setPhone(event.target.value)} placeholder="Nhập số điện thoại" /></Field>
        <button className="button main-button" disabled={busy}>{busy ? 'Đang lưu…' : 'Lưu thông tin'}</button>
      </form>
      <div>
        <section className="panel"><h2>Bảo mật đăng nhập</h2><dl className="profile-security">
          <div><dt>Xác thực hai bước</dt><dd><span className={'pill ' + (user.twoFactorEnabled ? 'pill-green' : 'pill-amber')}>{user.twoFactorEnabled ? 'Đã bật' : 'Chưa bật'}</span></dd></div>
        </dl><Link className="button light-button" to="/security">Quản lý OTP →</Link></section>
        <section className="panel section-gap"><h2>Phiên hiện tại</h2><p>Đăng xuất khi dùng xong trên thiết bị dùng chung.</p>
          <button className="button light-button" type="button" onClick={() => { logout(); navigate('/', { replace: true }) }}>Đăng xuất</button></section>
      </div>
    </div>
  </main>
}
