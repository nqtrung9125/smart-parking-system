import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router'
import { useAuth } from '../auth/useAuth'
import { Field, Notice } from '../components/Ui'
import ParkingArtwork from '../components/ParkingArtwork'
import ProfileFields from '../components/ProfileFields'
import { portalFor, portalPaths } from '../lib/portal'

export default function AuthPage({ register = false }) {
  const { login, register: createAccount } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [details, setDetails] = useState({ displayName: '', contactPhone: '', address: '' })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [secondStep, setSecondStep] = useState(false)
  const [useRecovery, setUseRecovery] = useState(false)
  const [code, setCode] = useState('')

  async function submit(event) {
    event.preventDefault()
    setBusy(true)
    setError('')
    try {
      const factor = secondStep ? { [useRecovery ? 'twoFactorRecoveryCode' : 'twoFactorCode']: code.trim() } : undefined
      const profile = await (register ? createAccount(email.trim(), password, details) : login(email.trim(), password, factor))
      const destination = location.state?.from || portalPaths[portalFor(profile)]
      navigate(destination, { replace: true })
    } catch (cause) {
      if (!register && cause.detail === 'RequiresTwoFactor') setSecondStep(true)
      else if (!register && cause.status === 401) setError(secondStep ? 'Mã xác thực không hợp lệ, đã hết hạn hoặc tài khoản đang tạm khóa.' : 'Thông tin đăng nhập không đúng hoặc tài khoản đang tạm khóa.')
      else setError(cause.message)
    }
    finally { setBusy(false) }
  }

  return <main className="auth-page"><div className="auth-intro"><span className="eyebrow">SMART PARKING</span><h1>{register ? 'Bắt đầu hành trình thuận tiện.' : 'Chào mừng bạn quay lại.'}</h1><p>Quản lý xe, đặt chỗ và theo dõi lượt gửi xe trong một tài khoản.</p><div className="auth-art"><ParkingArtwork /></div></div>
    <form className="auth-form panel" onSubmit={submit}><span className="eyebrow">TÀI KHOẢN</span><h2>{register ? 'Tạo tài khoản' : 'Đăng nhập'}</h2><p>{register ? 'Tạo tài khoản để lưu xe và đặt chỗ.' : 'Đăng nhập để tiếp tục sử dụng hệ thống.'}</p>
      <Notice error={error} />
      {secondStep ? <>
        <Field label={useRecovery ? 'Mã khôi phục' : 'Mã OTP 6 số'}><input autoComplete="one-time-code" inputMode={useRecovery ? 'text' : 'numeric'} pattern={useRecovery ? undefined : '[0-9]{6}'} maxLength={useRecovery ? 30 : 6} value={code} onChange={(e) => setCode(e.target.value)} required /></Field>
        <div className="row-actions"><button type="button" className="text-button" onClick={() => { setCode(''); setUseRecovery(!useRecovery) }}>{useRecovery ? 'Dùng ứng dụng xác thực' : 'Dùng mã khôi phục'}</button><button type="button" className="text-button" onClick={() => { setSecondStep(false); setPassword(''); setCode(''); setError('') }}>Quay lại</button></div>
      </> : <>
        <Field label={register ? 'Email' : 'Email hoặc số điện thoại'}><input type={register ? 'email' : 'text'} autoComplete={register ? 'email' : 'username'} value={email} onChange={(event) => setEmail(event.target.value)} required placeholder={register ? 'ban@example.com' : 'Nhập email hoặc số điện thoại'} /></Field>
        {register && <ProfileFields profile={details} onChange={setDetails} />}
        <Field label="Mật khẩu" hint={register ? 'Ít nhất 6 ký tự, gồm chữ hoa, chữ thường, số và ký tự đặc biệt.' : undefined}><input type="password" autoComplete={register ? 'new-password' : 'current-password'} value={password} onChange={(event) => setPassword(event.target.value)} required minLength={6} /></Field>
      </>}
      <button className="button main-button" disabled={busy}>{busy ? 'Đang xử lý…' : register ? 'Tạo tài khoản' : secondStep ? 'Xác thực đăng nhập' : 'Đăng nhập'}</button>
      {!secondStep && <div className="auth-switch">{register ? <>Đã có tài khoản? <Link to="/login" state={location.state}>Đăng nhập</Link></> : <>Chưa có tài khoản? <Link to="/register" state={location.state}>Đăng ký</Link></>}</div>}
    </form>
  </main>
}
