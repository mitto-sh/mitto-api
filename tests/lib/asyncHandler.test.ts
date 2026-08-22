import { describe, it, expect, vi } from 'vitest'
import { asyncHandler } from '@/lib/asyncHandler'

describe('asyncHandler', () => {
  it('calls through to the wrapped handler on success', async () => {
    const handler = vi.fn().mockResolvedValue(undefined)
    const wrapped = asyncHandler(handler)
    const req = {} as any
    const res = {} as any
    const next = vi.fn()

    await wrapped(req, res, next)

    expect(handler).toHaveBeenCalledWith(req, res, next)
    expect(next).not.toHaveBeenCalled()
  })

  it('forwards a rejected promise to next()', async () => {
    const err = new Error('boom')
    const handler = vi.fn().mockRejectedValue(err)
    const wrapped = asyncHandler(handler)
    const next = vi.fn()

    wrapped({} as any, {} as any, next)
    await new Promise((resolve) => setImmediate(resolve))

    expect(next).toHaveBeenCalledWith(err)
  })
})
