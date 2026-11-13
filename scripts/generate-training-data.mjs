import { writeFileSync } from 'node:fs'

const locations = [
  ['bach-dang', 32, 9, 19, .58], ['cau-rong', 28, 10, 20, .65],
  ['my-khe', 40, 7, 17, .72], ['an-thuong', 24, 11, 20, .68],
  ['bien-dong', 36, 7, 18, .74], ['helio', 38, 13, 20, .78],
  ['nguyen-tat-thanh', 26, 8, 17, .57], ['hoa-khanh', 30, 8, 16, .55],
]
const DAY = 86400000
const start = Date.UTC(2026, 7, 10)
let state = 81267
const random = () => ((state = (Math.imul(state, 1664525) + 1013904223) >>> 0) / 2 ** 32)
const wave = (hour, peak, spread) => Math.exp(-.5 * ((hour - peak) / spread) ** 2)
const lines = ['lot_key,hour_local,car_capacity,car_occupied,motorbike_capacity,motorbike_occupied']
for (const [key, spaces, early, late, intensity] of locations) {
  for (let day = 0; day < 91; day++) {
    const date = new Date(start + day * DAY)
    const weekend = [0, 6].includes(date.getUTCDay())
    const dayVariance = .84 + random() * .31
    const special = day % 17 === 4 ? .13 : 0
    for (let hour = 0; hour < 24; hour++) {
      const demand = .035 + intensity * dayVariance * (
        (weekend ? .70 : .90) * wave(hour, early, 2.2) +
        (weekend ? 1.16 : .86) * wave(hour, late, 2.7)) + special * wave(hour, late, 1.7)
      const load = (cap, shift) => Math.min(cap, Math.max(0, Math.round(cap * (demand * shift + (random() - .5) * .19))))
      const cars = spaces / 2
      const bikes = cars - 1
      lines.push([key, date.toISOString().slice(0, 10) + 'T' + String(hour).padStart(2, '0') + ':00', cars, load(cars, 1), bikes, load(bikes, 1.07)].join(','))
    }
  }
}
writeFileSync(new URL('../backend/Parking.Api/Data/Training/da-nang-occupancy.csv', import.meta.url), lines.join('\n') + '\n')
console.log(lines.length - 1 + ' hourly records')
