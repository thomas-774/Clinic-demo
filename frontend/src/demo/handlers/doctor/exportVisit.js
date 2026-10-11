import * as audit from '../../audit'
import { HttpError } from '../../http'
import { buildReport, renderReport } from '../../visitReport'
import { validate } from '../../validate'
import { bind } from '../shared'

/**
 * GET /doctor/visits/{visit}/export?format=pdf|docx (VisitExportController).
 * The demo answers `pdf` with a printable HTML page (the app opens the print
 * dialog, where the browser saves it as PDF); Word files need the real server.
 */
const NOT_AVAILABLE = { ar: 'غير متاح في النسخة التجريبية', en: 'Not available in the demo' }

export function exportVisit(ctx) {
  const visit = bind(ctx, 'visits', 'visit')
  const { format } = validate(ctx, ctx.input, { format: ['required', 'string', 'in:pdf,docx'] }, { attributes: { format: 'file format' } })
  if (format === 'docx') {
    const message = NOT_AVAILABLE[ctx.locale]
    throw new HttpError(422, { message, errors: { format: [message] } })
  }
  const html = renderReport(buildReport(visit, ctx.locale))
  audit.record(ctx, 'exported', 'visits', visit)
  return {
    status: 200,
    data: html,
    headers: {
      'content-type': 'text/html; charset=utf-8',
      'content-disposition': `attachment; filename="visit-${visit.visit_date}-${visit.id}.html"`,
      'cache-control': 'no-store, private',
    },
  }
}
