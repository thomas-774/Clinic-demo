/**
 * White panel with a heading and an optional action on the heading row.
 * `headingLevel={1}` when the card's title is the page's heading.
 */
export default function Card({ title, action, children, className = '', headingLevel = 2 }) {
  const Heading = `h${headingLevel}`

  return (
    <section className={`rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200 ${className}`}>
      {(title || action) && (
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          {title && <Heading className="text-base font-semibold text-slate-900">{title}</Heading>}
          {action}
        </div>
      )}
      {children}
    </section>
  )
}
