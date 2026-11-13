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
          rx="3" fill={color} fillOpacity=".22" stroke={color} strokeWidth="1.8" />
        {(active || spot.status === 'Occupied') && <g transform={'translate(' + cx + ' ' + (cy - 5) + ')'}>
          {spot.type === 2 ? <>
            <rect x="-12" y="-27" width="24" height="54" rx="8" fill="#101f2d" />
            <rect x="-10" y="-26" width="20" height="51" rx="7" fill={active ? '#50f1d0' : '#b5c4d2'} />
            <path d="M-7 -15L-5 -19H5L7 -15V11L4 16H-4L-7 11Z" fill="#223b4e" />
            <path d="M-6 -21H-3M3 -21H6" stroke="#fff" strokeWidth="2" />
          </> : <>
            <rect x="-4" y="-21" width="8" height="41" rx="4" fill="#132537" />
            <rect x="-6" y="-16" width="12" height="28" rx="5" fill={active ? '#50f1d0' : '#b5c4d2'} />
            <path d="M-9 -12H9M-3 1H3V8H-3Z" stroke="#dcecf1" strokeWidth="2" fill="#223b4e" />
          </>}
        </g>}
        <text x={cx} y={cy + 31} textAnchor="middle" fontSize="12" fontWeight="700" fill="#fff">{spot.code}</text>
      </g>
    })}
  </svg>
}
