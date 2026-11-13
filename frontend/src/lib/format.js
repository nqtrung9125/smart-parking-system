export const vehicleType = (type) => type === 2 ? 'Ô tô' : 'Xe máy'
export const money = (value) => value == null ? '—' : `${Number(value).toLocaleString('vi-VN')} đ`
export const dateTime = (value) => value ? new Date(value).toLocaleString('vi-VN', { dateStyle: 'short', timeStyle: 'short' }) : '—'
export const reservationStatus = { 1: 'Đang hiệu lực', 2: 'Đã hủy', 3: 'Đã sử dụng' }
export const spotStatus = { Available: 'Có thể sử dụng', Occupied: 'Đang có xe', Reserved: 'Đang được đặt', Inactive: 'Tạm đóng' }
