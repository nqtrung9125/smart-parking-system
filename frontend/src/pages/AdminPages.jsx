import { useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import Icon from '../components/Icon'
import { useAuth } from '../auth/useAuth'
import { api } from '../lib/api'
import { useResource } from '../lib/useResource'
import { money, vehicleType } from '../lib/format'
import { PageHeader, Notice, Loading, Empty, Field } from '../components/Ui'

export function AdminDashboardPage() {
  const { token } = useAuth()
  const summary = useResource('/api/dashboard/summary', token)
  const data = summary.data
  const utilization = data?.activeSpots ? Math.min(100, Math.round(data.occupiedSpots / data.activeSpots * 100)) : 0
  const stats = [
    ['pin', 'Bãi xe', data?.lots],
    ['grid', 'Chỗ đang hoạt động', data && data.activeSpots + '/' + data.totalSpots],
    ['car', 'Xe trong bãi', data?.occupiedSpots],
    ['clock', 'Lịch đặt còn hiệu lực', data?.activeReservations],
  ]

  return <main className="page-wrap admin-home">
    <PageHeader title="Tổng quan vận hành" description="Theo dõi công suất bãi, lượt xe và doanh thu."
      actions={<button type="button" className="button light-button" onClick={summary.refresh} disabled={summary.loading}>Cập nhật số liệu</button>} />
    <Notice error={summary.error} />
    {summary.loading ? <Loading /> : data && <>
      <dl className="portal-kpis">{stats.map(([icon, label, value]) =>
        <div className="portal-card portal-kpi" key={label}>
          <span className="portal-icon" aria-hidden="true"><Icon name={icon} /></span>
          <dt>{label}</dt><dd>{value}</dd>
        </div>
      )}</dl>
      <div className="two-column portal-dashboard-grid">
        <section className="portal-card admin-capacity">
          <div><h2>Công suất sử dụng</h2><p>{data.occupiedSpots} trên {data.activeSpots} chỗ đang hoạt động có xe.</p></div>
          <strong className="capacity-value">{utilization}%</strong>
          <progress max="100" value={utilization} aria-label="Tỷ lệ chỗ đang có xe" />
        </section>
        <section className="portal-card admin-today">
          <h2>Hoạt động hôm nay</h2>
          <p>Tính từ 00:00 giờ Việt Nam.</p>
          <dl><div><dt>Lượt xe vào</dt><dd>{data.checkInsToday}</dd></div><div><dt>Doanh thu ghi nhận</dt><dd>{money(data.revenueToday)}</dd></div></dl>
        </section>
      </div>
    </>}
    <section className="admin-tools">
      <h2>Quản lý vận hành</h2>
      <div className="customer-shortcuts">
        {[['/admin/manage', 'pin', 'Bãi xe', 'Thêm hoặc cập nhật bãi xe.'],
          ['/admin/manage?tab=spots', 'map', 'Chỗ đỗ', 'Thêm vị trí và thay đổi trạng thái.'],
          ['/admin/manage?tab=staff', 'car', 'Nhân viên', 'Cấp quyền và phân công bãi.'],
          ['/admin/reservations', 'clock', 'Duyệt đặt chỗ', 'Xem các yêu cầu chờ xác nhận.']].map(([to, icon, title, hint]) =>
          <Link className="portal-card shortcut" to={to} key={to}><span className="portal-icon"><Icon name={icon} /></span>
            <span className="shortcut-copy"><strong>{title}</strong><small>{hint}</small></span><Icon name="arrow" size={16} />
          </Link>)}
      </div>
    </section>
  </main>
}

export function AdminManagePage() {
  const { token } = useAuth()
  const lots = useResource('/api/parking-lots')
  const spots = useResource('/api/parking-spots')
  const staff = useResource('/api/admin/staff', token)
  const [params, setParams] = useSearchParams()
  const requestedTab = params.get('tab')
  const tab = requestedTab === 'spots' || requestedTab === 'staff' ? requestedTab : 'lots'
  const [lotName, setLotName] = useState('')
  const [lotAddress, setLotAddress] = useState('')
  const [editingLotId, setEditingLotId] = useState(null)
  const [spotLotId, setSpotLotId] = useState('')
  const [spotCode, setSpotCode] = useState('')
  const [spotType, setSpotType] = useState('1')
  const [staffEmail, setStaffEmail] = useState('')
  const [staffAssignment, setStaffAssignment] = useState(null)
  const [assignedLotIds, setAssignedLotIds] = useState([])
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
  function editStaffLots(person) {
    setStaffAssignment(person)
    setAssignedLotIds(person.parkingLotIds || [])
  }
  async function saveStaffLots(event) {
    event.preventDefault()
    await mutate('/api/admin/staff/' + staffAssignment.id + '/lots', { method: 'PUT', body: { parkingLotIds: assignedLotIds } },
      'Đã lưu bãi phụ trách.', () => { staff.refresh(); setStaffAssignment(null) })
  }
  function revokeStaff(person) { if (window.confirm(`Thu hồi quyền nhân viên của ${person.email}?`)) mutate(`/api/admin/staff/${person.id}`, { method: 'DELETE' }, 'Đã thu hồi quyền. Token cũ có thể còn hiệu lực đến khi hết hạn.', staff.refresh) }

  const management = {
    lots: ['Quản lý bãi xe', 'Thêm bãi mới hoặc cập nhật tên và địa chỉ.'],
    spots: ['Quản lý chỗ đỗ', 'Thêm vị trí, mở lại hoặc tạm đóng chỗ đỗ.'],
    staff: ['Quản lý nhân viên', 'Cấp quyền vận hành và phân công bãi để nhân viên duyệt đặt chỗ.'],
  }

  return <main className="page-wrap admin-management"><PageHeader title={management[tab][0]} description={management[tab][1]} />
    <Notice error={error || lots.error || spots.error || staff.error} success={message} />
    <div className="admin-sections" role="group" aria-label="Nhóm quản lý">{[['lots','Bãi xe'],['spots','Chỗ đỗ'],['staff','Nhân viên']].map(([key,label]) => <button key={key} type="button" aria-pressed={tab === key} onClick={() => setParams(key === 'lots' ? {} : { tab: key })}>{label}</button>)}</div>
    {tab === 'lots' && <div className="two-column wide-left"><section className="panel"><h2>Danh sách bãi xe</h2>{lots.loading ? <Loading /> : !lots.data?.length ? <Empty>Chưa có bãi xe.</Empty> : <div className="data-list">{lots.data.map((lot) => <div className="data-item" key={lot.id}><div><strong>{lot.name}</strong><span>{lot.address}</span></div><div className="row-actions"><button className="text-button" onClick={() => editLot(lot)}>Sửa</button><button className="text-danger" onClick={() => deleteLot(lot)}>Xóa</button></div></div>)}</div>}</section><form className="panel" onSubmit={saveLot}><h2>{editingLotId ? 'Sửa bãi xe' : 'Thêm bãi xe'}</h2><Field label="Tên bãi xe"><input value={lotName} onChange={(e) => setLotName(e.target.value)} maxLength={120} required /></Field><Field label="Địa chỉ"><input value={lotAddress} onChange={(e) => setLotAddress(e.target.value)} maxLength={255} required /></Field><button className="button main-button" disabled={busy}>{editingLotId ? 'Lưu thay đổi' : 'Thêm bãi xe'}</button>{editingLotId && <button type="button" className="button light-button" onClick={() => { setEditingLotId(null); setLotName(''); setLotAddress('') }}>Hủy sửa</button>}</form></div>}
    {tab === 'spots' && <div className="two-column wide-left"><section className="panel"><h2>Chỗ đỗ</h2>{spots.loading ? <Loading /> : !spots.data?.length ? <Empty>Chưa có chỗ đỗ.</Empty> : <div className="data-list">{spots.data.map((spot) => <div className="data-item" key={spot.id}><div><strong>{spot.code} · {vehicleType(spot.type)}</strong><span>{lots.data?.find((lot) => lot.id === spot.parkingLotId)?.name || `Bãi #${spot.parkingLotId}`} · {spot.isActive ? 'Đang hoạt động' : 'Tạm đóng'}</span></div><button className="text-button" disabled={busy} onClick={() => toggleSpot(spot)}>{spot.isActive ? 'Tạm đóng' : 'Mở lại'}</button></div>)}</div>}</section><form className="panel" onSubmit={addSpot}><h2>Thêm chỗ đỗ</h2><Field label="Bãi xe"><select value={spotLotId} onChange={(e) => setSpotLotId(e.target.value)} required><option value="">Chọn bãi xe</option>{lots.data?.map((lot) => <option key={lot.id} value={lot.id}>{lot.name}</option>)}</select></Field><Field label="Mã chỗ"><input value={spotCode} onChange={(e) => setSpotCode(e.target.value)} maxLength={20} placeholder="A01" required /></Field><Field label="Loại xe"><select value={spotType} onChange={(e) => setSpotType(e.target.value)}><option value="1">Xe máy</option><option value="2">Ô tô</option></select></Field><button className="button main-button" disabled={busy}>Thêm chỗ đỗ</button></form></div>}
    {tab === 'staff' && <div className="two-column wide-left">
      <section className="panel"><h2>Nhân viên</h2>
        {staff.loading ? <Loading /> : !staff.data?.length ? <Empty>Chưa có tài khoản nhân viên.</Empty> : <div className="data-list">
          {staff.data.map((person) => <div className="data-item" key={person.id}>
            <div><strong>{person.email}</strong><span>{lots.data?.filter((lot) => person.parkingLotIds?.includes(lot.id)).map((lot) => lot.name).join(', ') || 'Chưa phân công bãi'}</span></div>
            <div className="row-actions">
              <button type="button" className="text-button" disabled={busy} onClick={() => editStaffLots(person)}>Phân công bãi</button>
              <button type="button" className="text-danger" disabled={busy} onClick={() => revokeStaff(person)}>Thu hồi</button>
            </div>
          </div>)}
        </div>}
      </section>
      <div className="staff-assignment-panels">
        {staffAssignment && <form className="panel" onSubmit={saveStaffLots}>
          <h2>Phân công bãi</h2><p className="muted-text">{staffAssignment.email}</p>
          {lots.loading ? <Loading /> : lots.data?.length ? <fieldset className="staff-lot-options">
            <legend>Bãi được duyệt đặt chỗ</legend>
            {lots.data.map((lot) => <label key={lot.id}>
              <input type="checkbox" checked={assignedLotIds.includes(lot.id)} onChange={(event) => {
                const checked = event.target.checked
                setAssignedLotIds((ids) => checked ? [...ids, lot.id] : ids.filter((id) => id !== lot.id))
              }} /> {lot.name}
            </label>)}
          </fieldset> : <Empty>Chưa có bãi xe.</Empty>}
          <div className="row-actions">
            <button className="button main-button" disabled={busy || lots.loading || !!lots.error}>Lưu phân công</button>
            <button type="button" className="button light-button" disabled={busy} onClick={() => setStaffAssignment(null)}>Đóng</button>
          </div>
        </form>}
        <form className="panel" onSubmit={addStaff}>
          <h2>Cấp quyền nhân viên</h2><p className="muted-text">Tài khoản cần đăng ký trước khi được cấp quyền.</p>
          <Field label="Email tài khoản"><input type="email" value={staffEmail} onChange={(e) => setStaffEmail(e.target.value)} required placeholder="nhanvien@example.com" /></Field>
          <button className="button main-button" disabled={busy}>Cấp quyền</button>
        </form>
      </div>
    </div>}
  </main>
}
