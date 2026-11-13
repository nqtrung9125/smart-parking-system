import { useState } from 'react'
import { useAuth } from '../auth/useAuth'
import { api } from '../lib/api'
import { useResource } from '../lib/useResource'
import { Field, Loading, Notice, PageHeader } from '../components/Ui'
import QrImage from '../components/QrImage'

const endpoint = '/api/security/authenticator'

export default function SecurityPage() {
  const { token, user } = useAuth()
  const status = useResource(endpoint, token)
  const [password, setPassword] = useState('')
  const [code, setCode] = useState('')
  const [key, setKey] = useState('')
  const [recovery, setRecovery] = useState([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const enabled = status.data?.enabled
  const needsCode = enabled || key
  const qrValue = 'otpauth://totp/' + encodeURIComponent('Smart Parking:' + user.email) + '?secret=' + encodeURIComponent(key) + '&issuer=Smart%20Parking'

  async function submit(event) {
    event.preventDefault()
    setBusy(true); setError(''); setSuccess('')
    const action = enabled ? 'disable' : key ? 'enable' : 'setup'
    try {
      const result = await api(endpoint + '/' + action, { method: 'POST', token, body: { password, code: needsCode ? code : undefined } })
      if (action === 'setup') { setKey(result.sharedKey); return }
      setRecovery(result?.recoveryCodes || [])
      setSuccess(enabled ? 'Đã tắt xác thực hai bước.' : 'Đã bật xác thực hai bước. Hãy lưu các mã khôi phục bên dưới.')
      setPassword(''); setCode(''); setKey(''); status.refresh()
    } catch (cause) { setError(cause.message) }
    finally { setBusy(false) }
  }

  return <main className="page-wrap">
    <PageHeader eyebrow="TÀI KHOẢN" title="Bảo mật" description="Bảo vệ tài khoản bằng mã OTP từ ứng dụng xác thực." />
    <Notice error={error || status.error} success={success} />
    {status.loading ? <Loading /> : status.data && <div className="two-column">
      <form className="panel" onSubmit={submit}>
        <div className="panel-head"><h2>Xác thực hai bước</h2><span className={'pill ' + (enabled ? 'pill-green' : 'pill-amber')}>{enabled ? 'Đang bật' : 'Chưa bật'}</span></div>
        <p>{enabled ? 'Nhập mật khẩu và mã OTP hiện tại để tắt xác thực hai bước.' : 'Dùng Google Authenticator, Microsoft Authenticator hoặc ứng dụng tương thích.'}</p>
        <Field label="Mật khẩu hiện tại"><input type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required /></Field>
        {key && <div className="qr-block"><p>Quét mã QR hoặc nhập khóa bên dưới vào ứng dụng.</p><QrImage value={qrValue} label="QR thiết lập ứng dụng xác thực" /><code>{key}</code></div>}
        {needsCode && <Field label="Mã OTP 6 số"><input autoComplete="one-time-code" inputMode="numeric" pattern="[0-9]{6}" maxLength={6} value={code} onChange={(e) => setCode(e.target.value)} required /></Field>}
        <button className="button main-button" disabled={busy}>{busy ? 'Đang xử lý…' : enabled ? 'Tắt xác thực hai bước' : key ? 'Xác nhận và bật' : 'Bắt đầu thiết lập'}</button>
      </form>
      <section className="panel">
        <h2>Mã khôi phục</h2>
        {recovery.length ? <><p>Lưu các mã này ở nơi an toàn. Mỗi mã chỉ dùng được một lần và chỉ hiển thị lúc tạo.</p><ul className="recovery-codes">{recovery.map((value) => <li key={value}><code>{value}</code></li>)}</ul><button type="button" className="button light-button" onClick={() => setRecovery([])}>Tôi đã lưu mã</button></> :
          <p>{enabled ? 'Số mã khôi phục còn lại: ' + status.data.recoveryCodesLeft + '. Dùng một mã khi không thể mở ứng dụng xác thực.' : 'Mã khôi phục sẽ xuất hiện sau khi bạn bật xác thực hai bước.'}</p>}
      </section>
    </div>}
  </main>
}
