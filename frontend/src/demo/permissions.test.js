import i18next from 'i18next'
import { beforeEach, describe, expect, it } from 'vitest'
import { tokenStorage } from '../api/client'
import { handle } from './router'
import { routes } from './routes'
import { client, loginAs, resetDemo } from '../test/demo'

/**
 * Like the source's RoleMiddlewareTest: every route of the /doctor,
 * /assistant and /patient areas answers 403 to the other roles (before any
 * record lookup, so ids that do not exist still give 403) and 401 without a token.
 */
const AREAS = ['doctor', 'assistant', 'patient']
const areaOf = (path) => AREAS.find((area) => path.startsWith(`/${area}/`))
const fill = (path) => path.replace(/:[a-zA-Z]+/g, '999999')

const cases = routes
  .filter((route) => areaOf(route.path))
  .flatMap((route) => AREAS.filter((role) => role !== areaOf(route.path)).map((role) => [route.method, route.path, role]))

beforeEach(resetDemo)

describe('role checks', () => {
  it('every area route is limited to its own role', () => {
    for (const route of routes.filter((r) => areaOf(r.path))) {
      expect(route.roles, `${route.method} ${route.path}`).toEqual([areaOf(route.path)])
    }
    expect(routes.filter((r) => r.path.startsWith('/assistant/')).length).toBeGreaterThan(0)
  })

  it.each(cases)('%s %s answers 403 to the %s', async (method, path, role) => {
    await loginAs(role)
    const res = await client.request({ method, url: fill(path), data: {} }).catch((error) => error.response)
    expect(res.status).toBe(403)
    expect(res.data).toEqual({ message: 'This action is unauthorized.' })
  })

  it('answers 401 without a token on every route that needs one', () => {
    for (const route of routes.filter((r) => r.auth !== false)) {
      expect(handle({ method: route.method, path: fill(route.path) }).status, `${route.method} ${route.path}`).toBe(401)
    }
  })

  it('lets every role read the slots, and translates the 403', async () => {
    for (const role of AREAS) {
      await loginAs(role)
      expect((await client.get('/slots', { params: { date: '2026-01-01' } })).status).toBe(200)
    }
    await i18next.changeLanguage('ar')
    const res = await client.get('/doctor/patients').catch((error) => error.response)
    expect(res.data).toEqual({ message: 'هذا الإجراء غير مصرح به.' })
    tokenStorage.clear()
  })
})
