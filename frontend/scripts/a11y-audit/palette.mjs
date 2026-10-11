// Contrast of the Tailwind colours the app uses (NFR-U.1, T11-13): every
// text colour in src/ against the background it is written on — the bg-* in
// the same class list, else white and the page's slate-50. Prints the pairs
// under 4.5:1 (normal text) and under 3:1 (large text, UI parts); judge each
// against where it is used. Colours come from tailwindcss/theme.css (OKLCH).
//
//   node scripts/a11y-audit/palette.mjs
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const theme = readFileSync(join(root, 'node_modules', 'tailwindcss', 'theme.css'), 'utf8')

const palette = { white: [1, 1, 1], black: [0, 0, 0] }
for (const [, name, l, c, h] of theme.matchAll(/--color-([a-z]+-\d+): oklch\(([\d.]+)% ([\d.]+) ([\d.]+)\)/g)) {
  palette[name] = oklchToLinearSrgb(Number(l) / 100, Number(c), Number(h))
}

/** OKLCH → linear sRGB, clipped to the sRGB gamut as a screen shows it. */
export function oklchToLinearSrgb(L, C, h) {
  const a = C * Math.cos((h * Math.PI) / 180)
  const b = C * Math.sin((h * Math.PI) / 180)
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3
  const clip = (v) => Math.min(1, Math.max(0, v))
  return [
    clip(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s),
    clip(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s),
    clip(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s),
  ]
}

const luminance = ([r, g, b]) => 0.2126 * r + 0.7152 * g + 0.0722 * b
export const contrast = (x, y) => {
  const [hi, lo] = [luminance(x), luminance(y)].sort((p, q) => q - p)
  return (hi + 0.05) / (lo + 0.05)
}
/** bg-sky-50/60 on white: mixed in linear light (close enough for a check). */
const over = (color, alpha, base) => color.map((v, i) => v * alpha + base[i] * (1 - alpha))

function files(dir) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) return files(path)
    return /\.jsx?$/.test(name) && !/\.test\./.test(name) ? [path] : []
  })
}

/** Every text colour with its background(s) in src/, lowest contrast first. */
export function pairsInSource() {
  const pairs = new Map()
  for (const file of files(join(root, 'src'))) {
    for (const [list] of readFileSync(file, 'utf8').matchAll(/[`'"][^`'"]*\btext-(?:white|black|[a-z]+-\d{2,3})\b[^`'"]*[`'"]/g)) {
      const texts = [...list.matchAll(/(?<![:\w-])text-(white|black|[a-z]+-\d{2,3})\b/g)].map((m) => m[1])
      const bgs = [...list.matchAll(/(?<![:\w-])bg-(white|[a-z]+-\d{2,3})(?:\/(\d+))?\b/g)].map((m) => [m[1], m[2] ? Number(m[2]) / 100 : 1])
      const backgrounds = bgs.length ? bgs : [['white', 1], ['slate-50', 1]]
      for (const text of texts) {
        for (const [bg, alpha] of backgrounds) {
          if (!palette[text] || !palette[bg]) continue
          const key = `text-${text} on bg-${bg}${alpha < 1 ? `/${alpha * 100}` : ''}`
          const ratio = contrast(palette[text], over(palette[bg], alpha, palette.white))
          const where = file.slice(root.length + 5).replaceAll('\\', '/')
          const entry = pairs.get(key) ?? { ratio, where: new Set() }
          entry.where.add(where)
          pairs.set(key, entry)
        }
      }
    }
  }
  return [...pairs].sort((a, b) => a[1].ratio - b[1].ratio)
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const rows = pairsInSource()
  const low = rows.filter(([, { ratio }]) => ratio < 4.5)
  console.log(`Contrast: ${rows.length} text / background pairs; ${low.length} under 4.5:1, ${low.filter(([, e]) => e.ratio < 3).length} under 3:1`)
  for (const [key, { ratio, where }] of low) console.log(`${ratio.toFixed(2).padStart(5)}  ${key.padEnd(34)} ${[...where].slice(0, 4).join(', ')}`)
  // Every pair counts as normal-size text; a large-text exception goes in docs/a11y/wcag-aa-audit.md first.
  process.exitCode = low.length ? 1 : 0
}
