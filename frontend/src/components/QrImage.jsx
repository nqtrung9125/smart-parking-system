import { useEffect, useState } from 'react'
import QRCode from 'qrcode'

export default function QrImage({ value, label }) {
  const [src, setSrc] = useState('')
  const [failed, setFailed] = useState(false)
  useEffect(() => {
    let active = true
    QRCode.toDataURL(value, { width: 232, margin: 2, errorCorrectionLevel: 'M' })
      .then((url) => { if (active) setSrc(url) })
      .catch(() => { if (active) setFailed(true) })
    return () => { active = false }
  }, [value])
  return failed ? <p>Không thể hiển thị mã QR.</p> : src ? <img className="account-qr" src={src} alt={label} width="232" height="232" /> : <p role="status">Đang tạo mã QR…</p>
}
