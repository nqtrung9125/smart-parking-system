import { useEffect, useState } from 'react'
import { api } from './api'

export function useResource(path, token) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [version, setVersion] = useState(0)

  useEffect(() => {
    if (!path) return
    const controller = new AbortController()
    let active = true
    api(path, { token, signal: controller.signal })
      .then((result) => { if (active) { setData(result); setError('') } })
      .catch((cause) => { if (active && cause.name !== 'AbortError') setError(cause.message) })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false; controller.abort() }
  }, [path, token, version])

  function refresh() { setLoading(true); setVersion((v) => v + 1) }
  return { data, loading, error, refresh }
}
