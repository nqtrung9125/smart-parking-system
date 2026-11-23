import { useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { useAuth } from '../auth/useAuth'
import { api } from '../lib/api'
import { useResource } from '../lib/useResource'
import { initials, roleNames } from '../lib/format'
import { portalFor, portalPaths } from '../lib/portal'
import { Field, Notice, PageHeader } from '../components/Ui'
import ProfileFields from '../components/ProfileFields'

export default function AccountPage() {
  const { user, token, logout, setProfile } = useAuth()
  const navigate = useNavigate()
  const area = portalFor(user)
  const customer = area === 'customer'
  const vehicles = useResource(customer ? '/api/vehicles/mine' : null, token)
  const reservations = useResource(customer ? '/api/reservations/mine' : null, token)
  const [profile, setDraft] = useState(() => editableProfile(user))
  const [editCitizenId, setEditCitizenId] = useState(false)
  const [citizenId, setCitizenId] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [loadedAt] = useState(() => Date.now())
  const display = user.displayName || 'Tài khoản của tôi'

  async function save(event) {
    event.preventDefault()
    setBusy(true); setError(''); setSuccess('')
    try {
      const result = await api('/api/me', { method: 'PUT', token,
        body: editCitizenId ? { ...profile, citizenId } : profile })
      setProfile(result)
      setDraft(editableProfile(result))
      setEditCitizenId(false)
      setCitizenId('')
      setSuccess('Đã lưu thông tin tài khoản.')
    } catch (cause) { setError(cause.message) }
    finally { setBusy(false) }
  }

  return <main className="page-wrap">
    <PageHeader eyebrow="KHU VỰC CÁ NHÂN" title="Thông tin tài khoản" description="Xem thông tin đăng nhập, quản lý hồ sơ và bảo mật." />
    <section className="account-overview" aria-label="Tổng quan tài khoản">
      <div className="profile-identity"><span className="account-avatar profile-avatar" aria-hidden="true">{initials(user.displayName || user.email?.split('@')[0])}</span><div><span className="profile-overline">HỒ SƠ CÁ NHÂN</span><h2>{display}</h2><p>{user.email}</p><div className="profile-roles">{roleNames(user.roles).map((role) => <span key={role}>{role}</span>)}</div></div></div>
      {customer ? <div className="profile-metrics"><Link to="/vehicles"><strong>{vehicles.data?.length ?? '—'}</strong> Xe đã lưu</Link><Link to="/reservations"><strong>{reservations.data?.filter((row) => row.status === 1 && Date.parse(row.endUtc) > loadedAt).length ?? '—'}</strong> Lịch đang hiệu lực</Link></div> :
        <Link className="button portal-hero-action" to={portalPaths[area]}>{area === 'admin' ? 'Về trang quản trị' : 'Về ca trực'}</Link>}
    </section>
    <div className="two-column section-gap">
      <form className="panel" onSubmit={save}>
        <h2>Hồ sơ cá nhân</h2>
        <Notice error={error} success={success} />
        <Field label="Email đăng nhập"><input type="email" value={user.email || ''} readOnly /></Field>
        <ProfileFields profile={profile} onChange={setDraft} />
        {user.contactPhone && <p>{user.phoneLoginEnabled ? 'Có thể đăng nhập bằng số điện thoại đã lưu.' : 'Số hiện tại chưa dùng được để đăng nhập. Hãy lưu một số hợp lệ, riêng cho tài khoản này.'}</p>}
        {editCitizenId ? <Field label="Số căn cước công dân (CCCD)" hint="Nhập 12 chữ số. Để trống và lưu để xóa CCCD.">
          <input type="text" inputMode="numeric" autoComplete="off" pattern="[0-9]{12}" maxLength={12}
            value={citizenId} onChange={(event) => setCitizenId(event.target.value)} />
        </Field> : <div><strong>CCCD</strong><p>{user.citizenIdLast4 ? '•••• •••• ' + user.citizenIdLast4 : 'Chưa cập nhật'}</p></div>}
        <button type="button" className="text-button" onClick={() => { setCitizenId(''); setEditCitizenId(!editCitizenId) }}>
          {editCitizenId ? 'Hủy chỉnh sửa CCCD' : user.citizenIdLast4 ? 'Thay đổi CCCD' : 'Thêm CCCD'}
        </button>
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

function editableProfile(user) {
  return { displayName: user.displayName || '', contactPhone: user.contactPhone || '', address: user.address || '' }
}
