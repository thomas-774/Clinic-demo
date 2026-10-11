/**
 * A small seeded PRNG (mulberry32), so the demo seed is the same every time.
 * Math.random is never used by the seed.
 */
export function createRandom(seed) {
  let state = seed >>> 0

  const next = () => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }

  /** Integer in [min, max], both included (like PHP's mt_rand). */
  const int = (min, max) => min + Math.floor(next() * (max - min + 1))

  const pick = (list) => list[int(0, list.length - 1)]

  /** A shuffled copy (Fisher–Yates). */
  const shuffle = (list) => {
    const copy = [...list]
    for (let i = copy.length - 1; i > 0; i--) {
      const j = int(0, i)
      ;[copy[i], copy[j]] = [copy[j], copy[i]]
    }
    return copy
  }

  /** `count` distinct indexes of `list`, in ascending order (like PHP's array_rand). */
  const indexes = (list, count) =>
    shuffle(list.map((_, i) => i))
      .slice(0, Math.min(count, list.length))
      .sort((a, b) => a - b)

  return { next, int, pick, shuffle, indexes }
}
