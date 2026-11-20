export const vehicleType = (type) => type === 2 ? 'Ô tô' : 'Xe máy'
export const money = (value) => value == null ? '—' : `${Number(value).toLocaleString('vi-VN')} đ`
export const dateTime = (value) => value ? new Date(value).toLocaleString('vi-VN', { dateStyle: 'short', timeStyle: 'short' }) : '—'

export function parkingDuration(milliseconds) {
  if (!Number.isFinite(milliseconds) || milliseconds <= 0) return '—'
  const minutes = Math.max(1, Math.floor(milliseconds / 60000))
  const days = Math.floor(minutes / 1440)
  const hours = Math.floor(minutes % 1440 / 60)
  const remaining = minutes % 60
  return [days && days + ' ngày', hours && hours + ' giờ', remaining && remaining + ' phút'].filter(Boolean).join(' ')
}
export const reservationStates = { confirmed: 1, cancelled: 2, used: 3, pending: 4, rejected: 5, expired: 6 }
export const reservationStatus = {
  1: 'Đã xác nhận', 2: 'Đã hủy', 3: 'Đã sử dụng', 4: 'Chờ xác nhận', 5: 'Đã từ chối', 6: 'Hết hạn xác nhận',
}
export const spotStatus = { Available: 'Có thể sử dụng', Occupied: 'Đang có xe', Reserved: 'Đang được đặt', Inactive: 'Tạm đóng' }

export const initials = (name = '') => name.trim().split(/\s+/).slice(-2).map((part) => part[0]?.toUpperCase()).join('') || 'T'

export function roleNames(roles = []) {
  if (!roles.length) return ['Khách hàng']
  const labels = { Admin: 'Quản trị viên', Staff: 'Nhân viên' }
  return roles.map((role) => labels[role] || role)
}
