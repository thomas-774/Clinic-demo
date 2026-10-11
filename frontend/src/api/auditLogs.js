import client from './client'

/**
 * Settings → Activity (NFR-S.5): one page of the audit log, newest first, as
 * { data, meta, filters: { patient } }. Empty filters are not sent.
 */
export const listAuditLogs = ({ patientId, userId, action, from, to, page = 1 } = {}) =>
  client
    .get('/doctor/audit-logs', {
      params: {
        patient_id: patientId || undefined,
        user_id: userId || undefined,
        action: action || undefined,
        from: from || undefined,
        to: to || undefined,
        page,
      },
    })
    .then((res) => res.data)
