import { useEffect, useState } from 'react'
import { api } from './api'

export function useResource(path, token) {
  const [result, setResult] = useState(null)
  const [version, setVersion] = useState(0)

  useEffect(() => {
    if (!path) return
    const controller = new AbortController()
    let active = true
    api(path, { token, signal: controller.signal })
      .then((data) => { if (active) setResult({ path, token, version, data, error: '' }) })
      .catch((cause) => { if (active && cause.name !== 'AbortError') setResult({ path, token, version, data: null, error: cause.message }) })
    return () => { active = false; controller.abort() }
  }, [path, token, version])

  function refresh() { setVersion((v) => v + 1) }
  const match = !!path && result?.path === path && result?.token === token && result?.version === version
  return { data: match ? result.data : null, loading: !!path && !match, error: match ? result.error : '', refresh }
}
