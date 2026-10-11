import '@testing-library/jest-dom/vitest'
import i18next from '../i18n'

// Tests read English text; the Arabic default is covered in i18n.test.jsx.
beforeEach(async () => {
  await i18next.changeLanguage('en')
})
