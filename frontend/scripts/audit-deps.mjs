// `npm run audit:deps` (T11-03, NFR-S.3): fails on a high or critical advisory
// in a production dependency. `npm run` hands its config to child processes
// as npm_config_* variables, and npm 12 refuses an inherited `allow-scripts`
// setting in `npm audit`, so the audit runs without the inherited ones.
import { spawnSync } from 'node:child_process'

const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !/^npm_config_/i.test(key)))

const { status, error } = spawnSync('npm', ['audit', '--omit=dev', '--audit-level=high'], {
  env,
  stdio: 'inherit',
  shell: process.platform === 'win32',
})

if (error) throw error
process.exit(status ?? 1)
