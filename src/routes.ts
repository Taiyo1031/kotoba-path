export const ROUTES = {
  welcome: '/welcome',
  home: '/',
  unit: '/unit/:id',
  lesson: '/lesson/:unitId/:stepId',
  review: '/review',
  words: '/words',
  guide: '/guide',
  data: '/data',
  settings: '/settings',
  debug: '/debug',
  intro: '/intro',
} as const

export function unitPath(id: string): string {
  return `/unit/${encodeURIComponent(id)}`
}

export function lessonPath(unitId: string, stepId: string): string {
  return `/lesson/${encodeURIComponent(unitId)}/${encodeURIComponent(stepId)}`
}

export const NAV_ITEMS: ReadonlyArray<{
  path: string
  labelKey: 'nav.home' | 'nav.review' | 'nav.words' | 'nav.data' | 'nav.settings'
}> = [
  { path: ROUTES.home, labelKey: 'nav.home' },
  { path: ROUTES.review, labelKey: 'nav.review' },
  { path: ROUTES.words, labelKey: 'nav.words' },
  { path: ROUTES.data, labelKey: 'nav.data' },
  { path: ROUTES.settings, labelKey: 'nav.settings' },
]
