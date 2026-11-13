export const vehicleType = (type) => type === 2 ? 'Ô tô' : 'Xe máy'
export const money = (value) => value == null ? '—' : `${Number(value).toLocaleString('vi-VN')} đ`
export const dateTime = (value) => value ? new Date(value).toLocaleString('vi-VN', { dateStyle: 'short', timeStyle: 'short' }) : '—'
export const reservationStatus = { 1: 'Đang hiệu lực', 2: 'Đã hủy', 3: 'Đã sử dụng' }
export const spotStatus = { Available: 'Có thể sử dụng', Occupied: 'Đang có xe', Reserved: 'Đang được đặt', Inactive: 'Tạm đóng' }

export const initials = (name = '') => name.trim().split(/\s+/).slice(-2).map((part) => part[0]?.toUpperCase()).join('') || 'T'

export function roleNames(roles = []) {
  if (!roles.length) return ['Khách hàng']
  const labels = { Admin: 'Quản trị viên', Staff: 'Nhân viên' }
  return roles.map((role) => labels[role] || role)
}
