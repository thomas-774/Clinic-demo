import AssistantApiProvider from '../staff/AssistantApiProvider'
import SidebarLayout from './SidebarLayout'

const LINKS = [
  { to: '/assistant', label: 'nav.today', end: true },
  { to: '/assistant/patients', label: 'nav.patients' },
  { to: '/assistant/schedule', label: 'nav.schedule' },
]

/**
 * Assistant (front desk) area: same sidebar as the doctor's, fewer links; the
 * shared screens inside call the /assistant API (Module I).
 */
export default function AssistantLayout() {
  return (
    <AssistantApiProvider>
      <SidebarLayout id="assistant-sidebar" links={LINKS} />
    </AssistantApiProvider>
  )
}
