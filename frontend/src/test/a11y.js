import { cleanup, screen, waitFor } from '@testing-library/react'
import axe from 'axe-core'
import i18next from '../i18n'

// axe probes <canvas> for icon fonts; jsdom has none and logs "Not implemented".
HTMLCanvasElement.prototype.getContext = () => null

/** What fails a test (NFR-U.1): axe's two worst levels. */
const BLOCKING = ['serious', 'critical']

const describe = (violation) =>
  `${violation.id} (${violation.impact}): ${violation.help} — ${violation.nodes
    .slice(0, 3)
    .map((node) => node.target.join(' '))
    .join(', ')}`

/**
 * Runs axe on the rendered page and fails on any serious or critical issue.
 * jsdom has no layout, so colour contrast is left to the browser audit
 * (T11-13); everything else (names, roles, labels, ARIA, landmarks) runs.
 */
export async function expectNoA11yViolations(context = document.body) {
  const { violations } = await axe.run(context, {
    resultTypes: ['violations'],
    rules: { 'color-contrast': { enabled: false } },
  })
  const blocking = violations.filter((violation) => BLOCKING.includes(violation.impact))
  if (blocking.length > 0) {
    throw new Error(`axe found ${blocking.length} serious or critical issue(s):\n${blocking.map(describe).join('\n')}`)
  }
}

/** The page has its <h1> and nothing says "Loading…" (in the current language). */
export function pageLoaded() {
  return waitFor(() => {
    screen.getByRole('heading', { level: 1 })
    const loading = i18next.t('common.loading')
    expect(screen.queryAllByText(loading)).toHaveLength(0)
    expect(screen.queryAllByLabelText(loading)).toHaveLength(0)
  })
}

/**
 * Renders the page in Arabic (RTL) and then in English and checks each.
 * `renderPage()` renders the page; `ready()` waits
 * until the page has its data (by default pageLoaded()).
 */
export async function expectNoA11yViolationsInBothLanguages(renderPage, ready = pageLoaded) {
  try {
    for (const language of ['ar', 'en']) {
      await i18next.changeLanguage(language)
      renderPage()
      await ready()
      await expectNoA11yViolations()
      cleanup()
    }
  } finally {
    await i18next.changeLanguage('en')
  }
}

/**
 * Presses Tab (user-event) until `element` has the focus, as a keyboard
 * user would; fails if it is never reached.
 */
export async function tabTo(user, element, maxPresses = 80) {
  for (let i = 0; i < maxPresses; i++) {
    if (document.activeElement === element) return
    await user.tab()
  }
  throw new Error(`Tab never reached ${element.outerHTML.slice(0, 80)}`)
}

/** The toast live regions (ToastProvider): successes and errors. */
export const successToasts = () => document.querySelector('[data-toasts="success"]')
export const errorToasts = () => document.querySelector('[data-toasts="error"]')
