// Express route params come as string | string[] — this helper asserts string
export function param(value: string | string[]): string {
  if (Array.isArray(value)) return value[0]!
  return value
}
