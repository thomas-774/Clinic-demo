/**
 * One number on the dashboard: a label, the value and an optional line under
 * it. With onClick the whole card is a button (e.g. to open details).
 */
export default function StatCard({ label, value, sub, tone = 'default', onClick }) {
  const valueColor = tone === 'warning' ? 'text-amber-700' : 'text-slate-900'
  const body = (
    <>
      <span className="block text-sm text-slate-600">{label}</span>
      <span dir="ltr" className={`mt-1 block text-2xl font-bold break-words rtl:text-end ${valueColor}`}>
        {value}
      </span>
      {sub && <span className="mt-1 block text-xs text-slate-500">{sub}</span>}
    </>
  )
  const box = 'rounded-xl bg-slate-50 p-4 ring-1 ring-slate-200'

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className={`${box} w-full text-start transition hover:bg-sky-50 hover:ring-sky-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500`}
      >
        {body}
      </button>
    )
  }
  return (
    <div role="group" aria-label={label} className={box}>
      {body}
    </div>
  )
}
