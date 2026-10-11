import SidebarLayout from './SidebarLayout'

const LINKS = [
  { to: '/doctor', label: 'nav.dashboard', end: true },
  { to: '/doctor/schedule', label: 'nav.schedule' },
  { to: '/doctor/patients', label: 'nav.patients' },
  { to: '/doctor/reports', label: 'nav.reports' },
  { to: '/doctor/settings', label: 'nav.settings' },
]

/** Doctor area: sidebar on wide screens; on phones it opens from a Menu button. */
export default function DoctorLayout() {
  return <SidebarLayout id="doctor-sidebar" links={LINKS} />
}
