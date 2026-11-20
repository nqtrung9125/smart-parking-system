import { useEffect, useState } from 'react'
import { api } from './api'

export function useResource(path, token, { refreshInterval = 0 } = {}) {
  const [result, setResult] = useState(null)
  const [version, setVersion] = useState(0)

  useEffect(() => {
    if (!path) return
    const controller = new AbortController()
    const { signal } = controller
    let inFlight = false
    async function load() {
      if (signal.aborted || inFlight) return
      inFlight = true
      try {
        const data = await api(path, { token, signal })
        if (!signal.aborted) setResult({ path, token, version, data, error: '' })
      } catch (cause) {
        if (!signal.aborted && cause.name !== 'AbortError') {
          setResult({ path, token, version, data: null, error: cause.message })
        }
      } finally { inFlight = false }
    }
    // Let React finish the StrictMode setup and cleanup before starting a request.
    queueMicrotask(load)
    const timer = refreshInterval > 0 ? window.setInterval(() => { if (!document.hidden) load() }, refreshInterval) : null
    return () => { controller.abort(); if (timer !== null) window.clearInterval(timer) }
  }, [path, token, version, refreshInterval])

  function refresh() { setVersion((v) => v + 1) }
  const match = !!path && result?.path === path && result?.token === token && result?.version === version
  return { data: match ? result.data : null, loading: !!path && !match, error: match ? result.error : '', refresh }
}
