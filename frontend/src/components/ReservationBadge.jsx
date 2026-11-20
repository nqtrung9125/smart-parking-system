import { reservationStatus } from '../lib/format'

export default function ReservationBadge({ status }) {
  return <span className={'reservation-badge reservation-badge-' + status}>{reservationStatus[status] || 'Không rõ trạng thái'}</span>
}
