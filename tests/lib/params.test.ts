import { describe, it, expect } from 'vitest'
import { param } from '../../src/lib/params'

describe('param', () => {
  it('returns the string unchanged', () => {
    expect(param('abc')).toBe('abc')
  })

  it('returns the first element when given an array', () => {
    expect(param(['first', 'second'])).toBe('first')
  })
})
