import { fromPiastres, isMoney, toPiastres } from './money'

describe('money helpers', () => {
  it('accepts up to two decimals only', () => {
    expect(['1500', '1500.5', '1500.50', '0', ' 12.3 '].every(isMoney)).toBe(true)
    expect(['', '-1', '1.234', '1,500', 'abc', '.5', null].some(isMoney)).toBe(false)
  })

  it('converts to whole piastres and back without float drift', () => {
    expect(toPiastres('1500.5')).toBe(150050)
    expect(toPiastres('0.10') + toPiastres('0.20')).toBe(toPiastres('0.30'))
    expect(fromPiastres(toPiastres('0.10') + toPiastres('0.20'))).toBe('0.30')
    expect(fromPiastres(150000 - 100000)).toBe('500.00')
    expect(fromPiastres(-5)).toBe('-0.05')
    expect(toPiastres('1.234')).toBeNaN()
  })
})
