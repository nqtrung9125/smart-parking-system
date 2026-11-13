import { useState } from 'react'
import { useAuth } from '../auth/useAuth'
import { api } from '../lib/api'
import { useResource } from '../lib/useResource'
import { vehicleType } from '../lib/format'
import { PageHeader, Notice, Loading, Empty, Field } from '../components/Ui'

export default function VehiclesPage() {
  const { token } = useAuth()
  const vehicles = useResource('/api/vehicles/mine', token)
  const [plate, setPlate] = useState('')
  const [type, setType] = useState('1')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  async function addVehicle(event) {
    event.preventDefault(); setBusy(true); setError(''); setMessage('')
    try {
      await api('/api/vehicles', { method: 'POST', token, body: { plateNumber: plate.trim(), type: Number(type) } })
      setPlate(''); setMessage('Đã thêm xe vào tài khoản.'); vehicles.refresh()
    } catch (cause) { setError(cause.message) } finally { setBusy(false) }
  }
  async function removeVehicle(vehicle) {
    if (!window.confirm(`Xóa xe ${vehicle.plateNumber} khỏi tài khoản?`)) return
    setError(''); setMessage('')
    try { await api(`/api/vehicles/${vehicle.id}`, { method: 'DELETE', token }); setMessage('Đã xóa xe.'); vehicles.refresh() }
    catch (cause) { setError(cause.message) }
  }

  return <main className="page-wrap"><PageHeader eyebrow="TÀI KHOẢN CỦA TÔI" title="Xe của tôi" description="Lưu biển số để đặt chỗ và theo dõi các lượt gửi xe." />
    <Notice error={error || vehicles.error} success={message} />
    <div className="two-column"><section className="panel"><h2>Xe đã đăng ký</h2>{vehicles.loading ? <Loading /> : !vehicles.data?.length ? <Empty>Bạn chưa đăng ký xe nào.</Empty> : <div className="data-list">{vehicles.data.map((vehicle) => <div key={vehicle.id} className="data-item"><div><strong>{vehicle.plateNumber}</strong><span>{vehicleType(vehicle.type)}</span></div><button className="text-danger" onClick={() => removeVehicle(vehicle)}>Xóa</button></div>)}</div>}</section>
      <form className="panel" onSubmit={addVehicle}><h2>Thêm xe mới</h2><p className="muted-text">Mỗi biển số chỉ được đăng ký một lần trong hệ thống.</p><Field label="Biển số xe"><input value={plate} onChange={(event) => setPlate(event.target.value)} maxLength={15} minLength={5} required placeholder="Ví dụ: 30A-12345" /></Field><Field label="Loại xe"><select value={type} onChange={(event) => setType(event.target.value)}><option value="1">Xe máy</option><option value="2">Ô tô</option></select></Field><button className="button main-button" disabled={busy}>{busy ? 'Đang lưu…' : 'Thêm xe'}</button></form></div>
  </main>
}
