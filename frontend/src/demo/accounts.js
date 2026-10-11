/**
 * The demo's accounts, kept apart from the seed so the login page can use
 * them without loading the fake backend. All passwords are "password".
 */
export const DEMO_PASSWORD = 'password'

/** The accounts behind the "Enter as …" buttons. */
export const DEMO_ACCOUNTS = {
  doctor: '01000000000',
  patient: '01020000001',
  assistant: '01100000000',
}

/** The order of the role buttons. */
export const DEMO_ROLES = ['doctor', 'patient', 'assistant']
