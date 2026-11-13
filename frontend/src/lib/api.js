export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5181'

export async function api(path, { method = 'GET', body, token, signal } = {}) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method,
    signal,
    headers: {
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  })

  if (response.status === 204) return null
  const raw = await response.text()
  let data = raw
  try { data = raw ? JSON.parse(raw) : null } catch { /* Some API errors are plain text. */ }
  if (!response.ok) {
    const detail = typeof data === 'string' ? data :
      data?.detail || data?.title || Object.values(data?.errors || {}).flat().join(' ')
    throw new Error(detail || `Yêu cầu thất bại (${response.status}).`)
  }
  return data
}
