import { describe, it, expect } from 'vitest'
import { parseMittoConfig, MITTO_CONFIG_FILENAME } from '../../src/lib/mittoConfig'

describe('parseMittoConfig', () => {
  it('has the expected config filename', () => {
    expect(MITTO_CONFIG_FILENAME).toBe('mitto.yaml')
  })

  it('parses a valid single-service config', () => {
    const yaml = `
services:
  - name: web
    type: web
    port: 3000
    buildCommand: npm run build
    startCommand: npm start
`
    const result = parseMittoConfig(yaml)
    expect(result.valid).toBe(true)
    if (result.valid) {
      expect(result.config.services).toHaveLength(1)
      expect(result.config.services[0]).toMatchObject({ name: 'web', type: 'web', port: 3000 })
    }
  })

  it('parses multiple services', () => {
    const yaml = `
services:
  - name: web
    type: web
    port: 3000
  - name: worker
    type: worker
`
    const result = parseMittoConfig(yaml)
    expect(result.valid).toBe(true)
    if (result.valid) expect(result.config.services).toHaveLength(2)
  })

  it('rejects malformed YAML', () => {
    const result = parseMittoConfig('services: [this is not: valid: yaml')
    expect(result.valid).toBe(false)
  })

  it('rejects a config with no services array', () => {
    const result = parseMittoConfig('name: my-app')
    expect(result.valid).toBe(false)
  })

  it('rejects an empty services array', () => {
    const result = parseMittoConfig('services: []')
    expect(result.valid).toBe(false)
  })

  it('rejects an invalid service type', () => {
    const yaml = `
services:
  - name: web
    type: not-a-real-type
`
    const result = parseMittoConfig(yaml)
    expect(result.valid).toBe(false)
    if (!result.valid) expect(result.error).toContain('type')
  })

  it('rejects a negative port', () => {
    const yaml = `
services:
  - name: web
    type: web
    port: -1
`
    const result = parseMittoConfig(yaml)
    expect(result.valid).toBe(false)
  })
})
