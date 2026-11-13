export const parkingTones = { Available: '#25a384', Occupied: '#d17b3e', Reserved: '#8772cc', Inactive: '#778698' }

export function parkingLayout(spots) {
  const across = Math.min(8, Math.max(2, Math.ceil(Math.sqrt(spots.length * 1.6))))
  const rows = Math.ceil(spots.length / across)
  const pitch = 2.65, depth = 4.95, lane = 3.8
  const width = across * pitch + 6, length = rows * (depth + lane) + 2
  const positions = spots.map((spot, index) => ({
    spot,
    x: (index % across - (across - 1) / 2) * pitch,
    z: (Math.floor(index / across) - (rows - 1) / 2) * (depth + lane),
  }))
  return { positions, across, rows, pitch, depth, lane, width, length }
}
