import type { ReactNode } from 'react'
import { useLocation } from 'react-router-dom'

export function PageTransition({ children }: { children: ReactNode }) {
  const location = useLocation()

  return (
    <div
      key={`${location.key}:${location.pathname}${location.search}${location.hash}`}
      className="page-transition"
    >
      {children}
    </div>
  )
}
