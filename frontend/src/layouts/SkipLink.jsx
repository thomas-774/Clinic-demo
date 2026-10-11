import { useTranslation } from 'react-i18next'

/** Hidden until focused: the first Tab on a page offers to jump past the menus to <main id="main">. */
export default function SkipLink() {
  const { t } = useTranslation()

  return (
    <a
      href="#main"
      onClick={(event) => {
        // Move focus without adding #main to the address.
        event.preventDefault()
        document.getElementById('main')?.focus()
      }}
      className="sr-only focus:not-sr-only focus:fixed focus:start-4 focus:top-4 focus:z-[70] focus:rounded-lg focus:bg-white focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-sky-800 focus:shadow-lg focus:ring-2 focus:ring-sky-700"
    >
      {t('a11y.skipToContent')}
    </a>
  )
}
