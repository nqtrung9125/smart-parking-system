import { parkingLayout, parkingTones } from '../lib/parkingLayout'
import { spotStatus } from '../lib/format'

export default function ParkingPlan({ spots, selectedId }) {
  const { positions, width, length, pitch, depth, lane, rows } = parkingLayout(spots)
  const scale = 18
  const w = width * scale, h = length * scale
  return <svg className="parking-plan" role="img" aria-label="Sơ đồ 2D với vị trí đã chọn được đánh dấu" viewBox={'0 0 ' + w + ' ' + h}>
    <rect width={w} height={h} rx="14" fill="#293743" />
    <rect x="13" y="13" width={w - 26} height={h - 26} rx="10" fill="none" stroke="#7b8b8f" strokeWidth="1.5" />
    {Array.from({ length: rows - 1 }, (_, i) => {
      const y = h / 2 + (i + .5 - (rows - 1) / 2) * (depth + lane) * scale
      return <path key={i} d={'M26 ' + y + 'H' + (w - 26)} stroke="#d4cc91" strokeWidth="2" strokeDasharray="9 8" opacity=".85" />
    })}
    {positions.map(({ spot, x, z }) => {
      const active = spot.id === selectedId, color = parkingTones[spot.status] || parkingTones.Inactive
      const cx = w / 2 + x * scale, cy = h / 2 + z * scale
      return <g key={spot.id}>
        <title>{spot.code + ' · ' + (spotStatus[spot.status] || '')}</title>
        <rect x={cx - (pitch - .16) * scale / 2} y={cy - depth * scale / 2} width={(pitch - .16) * scale} height={depth * scale}
          rx="3" fill={color} fillOpacity={active ? '.72' : '.22'} stroke={active ? '#fff7cc' : color} strokeWidth={active ? 4 : 1.8} />
        {spot.status === 'Occupied' && <rect x={cx - 7} y={cy - 24} width="14" height="36" rx="4" fill="#b5c4d2" opacity=".8" />}
        <text x={cx} y={cy + 31} textAnchor="middle" fontSize="12" fontWeight="700" fill="#fff">{spot.code}</text>
      </g>
    })}
  </svg>
}
