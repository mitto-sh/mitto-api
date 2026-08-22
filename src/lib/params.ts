import { AppError } from '../middleware/error'

export function param(value: string | string[]): string {
  if (Array.isArray(value)) return value[0]!
  return value
}

export function requireQueryParam(query: Record<string, unknown>, name: string): string {
  const value = query[name]
  if (!value || typeof value !== 'string') {
    throw new AppError(400, `${name} query param is required`)
  }
  return value
}
