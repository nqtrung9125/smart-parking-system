import { useEffect, useRef } from 'react'
import { useLocation } from 'react-router'

export default function NavDisclosure({ className = '', label, trigger, children }) {
  const ref = useRef(null)
  const location = useLocation()
  useEffect(() => { ref.current.open = false }, [location.key])
  useEffect(() => {
    const root = ref.current
    function outside(event) { if (root.open && !root.contains(event.target)) root.open = false }
    document.addEventListener('pointerdown', outside)
    return () => document.removeEventListener('pointerdown', outside)
  }, [])
  return <details ref={ref} className={'nav-disclosure ' + className}
    onBlur={(event) => { if (event.relatedTarget && !ref.current.contains(event.relatedTarget)) ref.current.open = false }}
    onKeyDown={(event) => {
      if (event.key === 'Escape' && ref.current.open) { ref.current.open = false; ref.current.querySelector('summary').focus() }
    }}>
    <summary aria-label={label}>{trigger}</summary>
    <div className="nav-flyout" onClick={(event) => { if (event.target.closest('a,button')) ref.current.open = false }}>{children}</div>
  </details>
}
