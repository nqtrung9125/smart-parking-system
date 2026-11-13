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
      Object.values(data?.errors || {}).flat().join(' ') || data?.detail || data?.title
    const error = new Error(response.status === 429 ? 'Bạn thao tác quá nhanh. Hãy thử lại sau một phút.' : detail || `Yêu cầu thất bại (${response.status}).`)
    error.status = response.status
    error.detail = data?.detail
    throw error
  }
  return data
}
