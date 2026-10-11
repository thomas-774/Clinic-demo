/** Temporary page body until the page is built in a later phase. */
export default function PagePlaceholder({ title }) {
  return (
    <section>
      <h1 className="text-xl font-bold text-slate-900">{title}</h1>
    </section>
  )
}
