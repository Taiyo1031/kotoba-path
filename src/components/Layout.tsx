import type { ReactNode } from 'react'
import { Link, NavLink } from 'react-router-dom'
import { APP_CONFIG } from '../config/app'
import { NAV_ITEMS, ROUTES } from '../routes'
import { useT } from '../i18n'

export function Layout({
  children,
  showNavigation = true,
}: {
  children: ReactNode
  showNavigation?: boolean
}) {
  const t = useT()

  return (
    <div className="app-shell">
      <header className="app-header">
        <Link to={ROUTES.home} className="app-brand">
          {APP_CONFIG.name}
        </Link>
        {showNavigation && (
          <nav className="app-nav" aria-label="メインナビゲーション">
            {NAV_ITEMS.map((item) => (
              <NavLink key={item.path} to={item.path} end>
                {t(item.labelKey)}
              </NavLink>
            ))}
          </nav>
        )}
      </header>
      <main className="app-main">{children}</main>
    </div>
  )
}
