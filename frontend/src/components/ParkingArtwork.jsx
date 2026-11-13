const rowA = ['Available', 'Occupied', 'Available', 'Reserved', 'Occupied']
const rowB = ['Occupied', 'Available', 'Available', 'Occupied', 'Available']
const accent = { Available: '#46e4be', Occupied: '#6179a0', Reserved: '#9caaff' }

export default function ParkingArtwork({ spots = [] }) {
  const statuses = spots.slice(0, 10).map((spot) => spot.status)
  return <svg className="parking-artwork" viewBox="0 0 600 365" aria-hidden="true">
    <defs>
      <pattern id="parking-grid" width="25" height="25" patternUnits="userSpaceOnUse"><path d="M25 0H0V25" fill="none" stroke="#38526c" strokeOpacity=".35" /></pattern>
      <linearGradient id="deck-fill" x2=".7" y2="1"><stop stopColor="#294660" /><stop offset="1" stopColor="#15283d" /></linearGradient>
      <radialGradient id="art-glow"><stop stopColor="#21cbb0" stopOpacity=".23" /><stop offset="1" stopColor="#21cbb0" stopOpacity="0" /></radialGradient>
    </defs>
    <path fill="url(#parking-grid)" d="M0 0h600v365H0z" />
    <ellipse cx="303" cy="201" rx="300" ry="169" fill="url(#art-glow)" />
    <path d="M53 218 263 88 555 188 350 333Z" fill="#030e1a" opacity=".66" />
    <path d="M53 196 349 297 555 167v23L350 318 53 216Z" fill="#172e43" stroke="#345872" />
    <path d="m349 297 206-130v23L350 318Z" fill="#294962" />
    <g transform="matrix(.74 .255 -.69 .44 263 58)">
      <rect width="395" height="303" rx="8" fill="url(#deck-fill)" stroke="#4d7591" strokeWidth="2" />
      <rect x="14" y="14" width="367" height="275" rx="4" fill="none" stroke="#7293a9" strokeOpacity=".26" />
      <path d="M26 152h335" stroke="#83a7bc" strokeWidth="2.5" strokeDasharray="14 12" opacity=".5" />
      <path d="m155 144-10 8 10 8m79-16 10 8-10 8" fill="none" stroke="#b4c5d5" strokeWidth="2" />
      {[rowA, rowB].flatMap((row, i) => row.map((preset, j) => {
        const status = statuses[i * 5 + j] || preset
        const color = accent[status] || '#617287'
        const x = 26 + 70 * j, y = i ? 177 : 26
        return <g key={i * 5 + j} transform={'translate(' + x + ' ' + y + ')'}>
          <rect width="62" height="100" rx="4" fill={color} fillOpacity=".11" stroke={color} strokeOpacity=".83" />
          <path d="M4 92h54" stroke={color} strokeWidth="3" opacity=".8" />
          {status === 'Occupied' ? <><rect x="15" y="19" width="33" height="61" rx="10" fill="#0c1b2e" /><rect x="13" y="13" width="33" height="61" rx="10" fill={j % 2 ? '#6b8df6' : '#c0d3ea'} /><path d="m18 30 4-8h15l4 8v21l-4 9H22l-4-9z" fill="#1d3351" /><path d="M19 66h6m9 0h6" stroke="#e8f5fc" strokeWidth="2" /></> : <path d="M26 49h10m-5-5v10" stroke={color} strokeWidth="2" opacity=".8" />}
        </g>
      }))}
    </g>
    <path d="M73 104h66m-66 0v40m453 98h-53m53 0v-37" fill="none" stroke="#4c7588" strokeDasharray="3 5" />
    <circle cx="73" cy="104" r="3" fill="#5de4c5" /><circle cx="526" cy="242" r="3" fill="#5de4c5" />
  </svg>
}
