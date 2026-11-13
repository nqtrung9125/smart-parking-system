import { useState } from 'react'
import { Link } from 'react-router'
import { useAuth } from '../auth/useAuth'
import { api } from '../lib/api'
import { useResource } from '../lib/useResource'
import { money, vehicleType } from '../lib/format'
import { PageHeader, Notice, Loading, Empty, Field } from '../components/Ui'

export function AdminDashboardPage() {
  const { token } = useAuth()
  const summary = useResource('/api/dashboard/summary', token)
  const s = summary.data
  const utilization = s?.activeSpots ? Math.min(100, Math.round(s.occupiedSpots / s.activeSpots * 100)) : 0
  return <main className="page-wrap"><PageHeader eyebrow="QUẢN TRỊ HỆ THỐNG" title="Tổng quan bãi đỗ" description="Số liệu hiện tại từ hệ thống PostgreSQL." actions={<button className="button light-button" onClick={summary.refresh}>Cập nhật số liệu</button>} /><Notice error={summary.error} />
    {summary.loading ? <Loading /> : s && <><div className="admin-stats"><div className="stat-box"><strong>{s.lots}</strong><span>Bãi xe</span></div><div className="stat-box"><strong>{s.activeSpots}/{s.totalSpots}</strong><span>Chỗ đang hoạt động</span></div><div className="stat-box"><strong>{s.occupiedSpots}</strong><span>Xe trong bãi</span></div><div className="stat-box"><strong>{s.activeReservations}</strong><span>Lịch đặt hiệu lực</span></div></div>
      <div className="two-column section-gap"><section className="panel"><h2>Chỗ đang có xe</h2><p className="muted-text">Tỷ lệ trên số chỗ đang hoạt động</p><div className="large-percent">{utilization}%</div><div className="progress-track"><span style={{ width: `${utilization}%` }} /></div><p className="helper-text">{s.occupiedSpots} / {s.activeSpots} chỗ đang có xe. Số chỗ trống thực tế còn phụ thuộc vào lịch đặt.</p></section>
        <section className="panel"><h2>Hoạt động hôm nay</h2><div className="data-list"><div className="data-item"><div><strong>{s.checkInsToday}</strong><span>Lượt xe vào từ 00:00 UTC</span></div></div><div className="data-item"><div><strong>{money(s.revenueToday)}</strong><span>Doanh thu ghi nhận từ 00:00 UTC</span></div></div></div><Link className="button main-button" to="/admin/manage">Quản lý bãi xe →</Link></section></div>
    </>}
  </main>
}

export function AdminManagePage() {
  const { token } = useAuth()
  const lots = useResource('/api/parking-lots')
  const spots = useResource('/api/parking-spots')
  const staff = useResource('/api/admin/staff', token)
  const [tab, setTab] = useState('lots')
  const [lotName, setLotName] = useState('')
  const [lotAddress, setLotAddress] = useState('')
  const [editingLotId, setEditingLotId] = useState(null)
  const [spotLotId, setSpotLotId] = useState('')
  const [spotCode, setSpotCode] = useState('')
  const [spotType, setSpotType] = useState('1')
  const [staffEmail, setStaffEmail] = useState('')
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)

  async function mutate(path, options, success, refresh) {
    setBusy(true); setError(''); setMessage('')
    try { await api(path, { ...options, token }); setMessage(success); refresh?.() }
    catch (cause) { setError(cause.message) }
    finally { setBusy(false) }
  }
  async function saveLot(event) {
    event.preventDefault()
    const editing = editingLotId != null
    await mutate(editing ? `/api/parking-lots/${editingLotId}` : '/api/parking-lots', { method: editing ? 'PUT' : 'POST', body: { name: lotName, address: lotAddress } }, editing ? 'Đã cập nhật bãi xe.' : 'Đã thêm bãi xe.', () => { lots.refresh(); if (!editing) { setLotName(''); setLotAddress('') } })
  }
  function editLot(lot) { setEditingLotId(lot.id); setLotName(lot.name); setLotAddress(lot.address); window.scrollTo({ top: 0, behavior: 'smooth' }) }
  function deleteLot(lot) { if (window.confirm(`Xóa bãi xe ${lot.name}? Bãi còn chỗ đỗ sẽ không xóa được.`)) mutate(`/api/parking-lots/${lot.id}`, { method: 'DELETE' }, 'Đã xóa bãi xe.', lots.refresh) }
  async function addSpot(event) {
    event.preventDefault()
    await mutate('/api/parking-spots', { method: 'POST', body: { parkingLotId: Number(spotLotId), code: spotCode, type: Number(spotType) } }, 'Đã thêm chỗ đỗ.', () => { spots.refresh(); setSpotCode('') })
  }
  function toggleSpot(spot) { mutate(`/api/parking-spots/${spot.id}/active`, { method: 'PATCH', body: { isActive: !spot.isActive } }, 'Đã cập nhật trạng thái chỗ đỗ.', spots.refresh) }
  async function addStaff(event) {
    event.preventDefault()
    await mutate('/api/admin/staff', { method: 'POST', body: { email: staffEmail.trim() } }, 'Đã cấp quyền nhân viên. Người dùng cần đăng nhập lại.', () => { staff.refresh(); setStaffEmail('') })
  }
  function revokeStaff(person) { if (window.confirm(`Thu hồi quyền nhân viên của ${person.email}?`)) mutate(`/api/admin/staff/${person.id}`, { method: 'DELETE' }, 'Đã thu hồi quyền. Token cũ có thể còn hiệu lực đến khi hết hạn.', staff.refresh) }

  return <main className="page-wrap"><PageHeader eyebrow="QUẢN TRỊ HỆ THỐNG" title="Quản lý vận hành" description="Quản lý bãi xe, chỗ đỗ và tài khoản nhân viên." />
    <Notice error={error || lots.error || spots.error || staff.error} success={message} />
    <div className="tabs" role="tablist" aria-label="Nhóm quản lý">{[['lots','Bãi xe'],['spots','Chỗ đỗ'],['staff','Nhân viên']].map(([key,label]) => <button key={key} type="button" role="tab" aria-selected={tab === key} className={tab === key ? 'active' : ''} onClick={() => setTab(key)}>{label}</button>)}</div>
    {tab === 'lots' && <div className="two-column wide-left"><section className="panel"><h2>Danh sách bãi xe</h2>{lots.loading ? <Loading /> : !lots.data?.length ? <Empty>Chưa có bãi xe.</Empty> : <div className="data-list">{lots.data.map((lot) => <div className="data-item" key={lot.id}><div><strong>{lot.name}</strong><span>{lot.address}</span></div><div className="row-actions"><button className="text-button" onClick={() => editLot(lot)}>Sửa</button><button className="text-danger" onClick={() => deleteLot(lot)}>Xóa</button></div></div>)}</div>}</section><form className="panel" onSubmit={saveLot}><h2>{editingLotId ? 'Sửa bãi xe' : 'Thêm bãi xe'}</h2><Field label="Tên bãi xe"><input value={lotName} onChange={(e) => setLotName(e.target.value)} maxLength={120} required /></Field><Field label="Địa chỉ"><input value={lotAddress} onChange={(e) => setLotAddress(e.target.value)} maxLength={255} required /></Field><button className="button main-button" disabled={busy}>{editingLotId ? 'Lưu thay đổi' : 'Thêm bãi xe'}</button>{editingLotId && <button type="button" className="button light-button" onClick={() => { setEditingLotId(null); setLotName(''); setLotAddress('') }}>Hủy sửa</button>}</form></div>}
    {tab === 'spots' && <div className="two-column wide-left"><section className="panel"><h2>Chỗ đỗ</h2>{spots.loading ? <Loading /> : !spots.data?.length ? <Empty>Chưa có chỗ đỗ.</Empty> : <div className="data-list">{spots.data.map((spot) => <div className="data-item" key={spot.id}><div><strong>{spot.code} · {vehicleType(spot.type)}</strong><span>{lots.data?.find((lot) => lot.id === spot.parkingLotId)?.name || `Bãi #${spot.parkingLotId}`} · {spot.isActive ? 'Đang hoạt động' : 'Tạm đóng'}</span></div><button className="text-button" disabled={busy} onClick={() => toggleSpot(spot)}>{spot.isActive ? 'Tạm đóng' : 'Mở lại'}</button></div>)}</div>}</section><form className="panel" onSubmit={addSpot}><h2>Thêm chỗ đỗ</h2><Field label="Bãi xe"><select value={spotLotId} onChange={(e) => setSpotLotId(e.target.value)} required><option value="">Chọn bãi xe</option>{lots.data?.map((lot) => <option key={lot.id} value={lot.id}>{lot.name}</option>)}</select></Field><Field label="Mã chỗ"><input value={spotCode} onChange={(e) => setSpotCode(e.target.value)} maxLength={20} placeholder="A01" required /></Field><Field label="Loại xe"><select value={spotType} onChange={(e) => setSpotType(e.target.value)}><option value="1">Xe máy</option><option value="2">Ô tô</option></select></Field><button className="button main-button" disabled={busy}>Thêm chỗ đỗ</button></form></div>}
    {tab === 'staff' && <div className="two-column wide-left"><section className="panel"><h2>Nhân viên</h2>{staff.loading ? <Loading /> : !staff.data?.length ? <Empty>Chưa có tài khoản nhân viên.</Empty> : <div className="data-list">{staff.data.map((person) => <div className="data-item" key={person.id}><div><strong>{person.email}</strong><span>Nhân viên</span></div><button className="text-danger" onClick={() => revokeStaff(person)}>Thu hồi</button></div>)}</div>}</section><form className="panel" onSubmit={addStaff}><h2>Cấp quyền nhân viên</h2><p className="muted-text">Tài khoản cần đăng ký trước khi được cấp quyền.</p><Field label="Email tài khoản"><input type="email" value={staffEmail} onChange={(e) => setStaffEmail(e.target.value)} required placeholder="nhanvien@example.com" /></Field><button className="button main-button" disabled={busy}>Cấp quyền</button></form></div>}
  </main>
}
