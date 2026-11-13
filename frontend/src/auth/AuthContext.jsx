import { useEffect, useState } from 'react'
import { api } from '../lib/api'
import { AuthContext } from './context'

const storageKey = 'smart-parking-token'

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => sessionStorage.getItem(storageKey))
  const [user, setUser] = useState(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    if (!token) return
    let active = true
    api('/api/me', { token })
      .then((profile) => { if (active) setUser(profile) })
      .catch(() => { if (active) { sessionStorage.removeItem(storageKey); setToken(null); setUser(null) } })
      .finally(() => { if (active) setReady(true) })
    return () => { active = false }
  }, [token])

  async function login(email, password, secondFactor) {
    const result = await api('/api/auth/login?useCookies=false', { method: 'POST', body: { email, password, ...secondFactor } })
    const profile = await api('/api/me', { token: result.accessToken })
    sessionStorage.setItem(storageKey, result.accessToken)
    setUser(profile)
    setToken(result.accessToken)
    setReady(true)
    return profile
  }

  async function register(email, password) {
    await api('/api/auth/register', { method: 'POST', body: { email, password } })
    return login(email, password)
  }

  function logout() {
    sessionStorage.removeItem(storageKey)
    setToken(null)
    setUser(null)
    setReady(true)
  }

  return <AuthContext.Provider value={{ token, user, ready: ready || !token, login, register, logout }}>
    {children}
  </AuthContext.Provider>
}

