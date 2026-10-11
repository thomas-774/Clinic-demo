import { Component } from 'react'
import { useTranslation } from 'react-i18next'
import { isChunkLoadError } from '../utils/chunkLoad'

function CrashScreen({ error, onRetry, fullPage }) {
  const { t } = useTranslation()
  const chunk = isChunkLoadError(error)

  return (
    <div className={fullPage ? 'flex min-h-screen items-center justify-center bg-slate-50 p-4' : 'py-6'}>
      <div role="alert" className="mx-auto max-w-md rounded-2xl bg-white p-6 text-center ring-1 ring-slate-200">
        <h1 className="text-lg font-bold text-slate-900">{t('errorPage.title')}</h1>
        <p className="mt-2 text-slate-600">{t(chunk ? 'errorPage.chunkBody' : 'errorPage.body')}</p>
        <div className="mt-4 flex flex-wrap justify-center gap-2">
          <button
            type="button"
            onClick={() => (chunk ? window.location.reload() : onRetry())}
            className="min-h-11 rounded-lg bg-sky-700 px-4 font-semibold text-white hover:bg-sky-800"
          >
            {t(chunk ? 'errorPage.reload' : 'common.retry')}
          </button>
          <a href="/" className="inline-flex min-h-11 items-center rounded-lg px-4 font-semibold text-sky-700 hover:bg-slate-100">
            {t('errorPage.home')}
          </a>
        </div>
      </div>
    </div>
  )
}

/**
 * Catches a page that crashed while rendering, so the user sees a way out
 * instead of a blank screen. `resetKey` (the path) clears the error when the
 * user navigates elsewhere; "Retry" renders the page again.
 */
export default class ErrorBoundary extends Component {
  state = { error: null, resetKey: this.props.resetKey }

  static getDerivedStateFromError(error) {
    return { error }
  }

  static getDerivedStateFromProps(props, state) {
    return props.resetKey === state.resetKey ? null : { error: null, resetKey: props.resetKey }
  }

  componentDidCatch(error, info) {
    console.error(error, info.componentStack)
  }

  render() {
    if (this.state.error) {
      return <CrashScreen error={this.state.error} fullPage={this.props.fullPage} onRetry={() => this.setState({ error: null })} />
    }
    return this.props.children
  }
}
