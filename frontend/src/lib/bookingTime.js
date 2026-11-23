export const hourMs = 60 * 60 * 1000
export const maxDuration = 30 * 24 * hourMs

export function bookingInputTime(value) {
  const date = new Date(value)
  if (!Number.isFinite(date.getTime())) return ''
  const zoneAdjusted = new Date(date.getTime() - date.getTimezoneOffset() * 60000)
  return zoneAdjusted.toISOString().slice(0, 16)
}
