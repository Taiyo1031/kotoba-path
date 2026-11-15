import { describe, it, expect } from 'vitest'
import { matchPath } from 'react-router-dom'
import { unitPath, lessonPath, ROUTES, NAV_ITEMS } from './routes'

describe('routes', () => {
  it.each([
    ['u01', '/unit/u01'],
    ['u/01', '/unit/u%2F01'],
    ['u?01', '/unit/u%3F01'],
    ['単元 #1%', '/unit/%E5%8D%98%E5%85%83%20%231%25'],
  ])('unitPath(%j) returns %j', (id, expected) => {
    expect(unitPath(id), `入力: ${JSON.stringify(id)}`).toBe(expected)
  })

  it.each([
    ['u01', 's2', '/lesson/u01/s2'],
    ['u/01', 's?2', '/lesson/u%2F01/s%3F2'],
    ['u #%', '歩/2', '/lesson/u%20%23%25/%E6%AD%A9%2F2'],
  ])('lessonPath(%j, %j) returns %j', (unitId, stepId, expected) => {
    expect(lessonPath(unitId, stepId), `入力: ${JSON.stringify({ unitId, stepId })}`).toBe(expected)
  })

  it('NAV_ITEMS contains only home, review, words, data, settings with matching label keys', () => {
    expect(NAV_ITEMS, '入力: NAV_ITEMS').toEqual([
      { path: '/', labelKey: 'nav.home' },
      { path: '/review', labelKey: 'nav.review' },
      { path: '/words', labelKey: 'nav.words' },
      { path: '/data', labelKey: 'nav.data' },
      { path: '/settings', labelKey: 'nav.settings' },
    ])
  })

  it.each([ROUTES.welcome, ROUTES.intro, ROUTES.unit, ROUTES.lesson, ROUTES.debug, ROUTES.guide])(
    'NAV_ITEMS excludes %j',
    (path) => {
      expect(
        NAV_ITEMS.map((item) => item.path),
        `入力: ${path}`,
      ).not.toContain(path)
    },
  )

  it('defines all eleven route patterns', () => {
    expect(Object.keys(ROUTES), '入力: ROUTES').toHaveLength(11)
    expect(ROUTES, '入力: ROUTES').toEqual({
      welcome: '/welcome',
      intro: '/intro',
      home: '/',
      unit: '/unit/:id',
      lesson: '/lesson/:unitId/:stepId',
      review: '/review',
      words: '/words',
      guide: '/guide',
      data: '/data',
      settings: '/settings',
      debug: '/debug',
    })
  })

  it('should match unit route with params', () => {
    const match = matchPath({ path: ROUTES.unit }, '/unit/u01')
    expect(match?.params.id, `入力: ${ROUTES.unit}, /unit/u01`).toBe('u01')
  })

  it('should match lesson route with params', () => {
    const match = matchPath({ path: ROUTES.lesson }, '/lesson/u01/s2')
    expect(match?.params, `入力: ${ROUTES.lesson}, /lesson/u01/s2`).toEqual({
      unitId: 'u01',
      stepId: 's2',
    })
  })
})
