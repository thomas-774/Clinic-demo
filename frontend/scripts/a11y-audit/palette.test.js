import { contrast, oklchToLinearSrgb, pairsInSource } from './palette.mjs'

// T11-13: the palette check behind `npm run check:contrast`.
describe('palette contrast', () => {
  it('matches known ratios', () => {
    expect(contrast([1, 1, 1], [0, 0, 0])).toBeCloseTo(21, 5)
    // green-600 on white: axe measured 3.21 in the browser.
    expect(contrast(oklchToLinearSrgb(0.627, 0.194, 149.214), [1, 1, 1])).toBeCloseTo(3.21, 1)
    // slate-500 on white: the lightest grey used for text.
    expect(contrast(oklchToLinearSrgb(0.554, 0.046, 257.417), [1, 1, 1])).toBeGreaterThan(4.5)
  })

  it('finds no text colour under 4.5:1 on its background in src/', () => {
    const pairs = pairsInSource()
    expect(pairs.length).toBeGreaterThan(40)
    expect(pairs.filter(([, { ratio }]) => ratio < 4.5).map(([key]) => key)).toEqual([])
  })
})
