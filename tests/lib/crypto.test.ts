import { describe, it, expect } from 'vitest'
import { encrypt, decrypt } from '../../src/lib/crypto'

describe('crypto', () => {
  it('round-trips plaintext through encrypt/decrypt', () => {
    const plaintext = 'super-secret-value'
    const ciphertext = encrypt(plaintext)
    expect(decrypt(ciphertext)).toBe(plaintext)
  })

  it('produces a different ciphertext each time (random IV)', () => {
    const a = encrypt('same-input')
    const b = encrypt('same-input')
    expect(a).not.toBe(b)
    expect(decrypt(a)).toBe('same-input')
    expect(decrypt(b)).toBe('same-input')
  })

  it('produces ciphertext in iv:tag:ciphertext hex format', () => {
    const ciphertext = encrypt('x')
    const parts = ciphertext.split(':')
    expect(parts).toHaveLength(3)
    for (const part of parts) {
      expect(part).toMatch(/^[0-9a-f]+$/)
    }
  })

  it('throws on malformed ciphertext', () => {
    expect(() => decrypt('not-a-valid-ciphertext')).toThrow('Invalid ciphertext format')
  })

  it('throws when the auth tag does not match (tampered ciphertext)', () => {
    const ciphertext = encrypt('hello')
    const [iv, tag, data] = ciphertext.split(':')
    const tampered = `${iv}:${tag}:${data!.slice(0, -2)}ff`
    expect(() => decrypt(tampered)).toThrow()
  })
})
