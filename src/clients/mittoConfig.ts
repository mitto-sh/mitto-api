import { parse as parseYaml } from 'yaml'
import { z } from 'zod'

const mittoServiceSchema = z.object({
  name:           z.string().min(1).max(64),
  type:           z.enum(['web', 'worker', 'cron', 'static']),
  port:           z.number().int().positive().optional(),
  buildCommand:   z.string().optional(),
  startCommand:   z.string().optional(),
  dockerfilePath: z.string().optional(),
})

const mittoConfigSchema = z.object({
  services: z.array(mittoServiceSchema).min(1),
})

export type MittoService = z.infer<typeof mittoServiceSchema>
export type MittoConfig = z.infer<typeof mittoConfigSchema>

export type ParseMittoConfigResult =
  | { valid: true; config: MittoConfig }
  | { valid: false; error: string }

export function parseMittoConfig(yamlText: string): ParseMittoConfigResult {
  let raw: unknown
  try {
    raw = parseYaml(yamlText)
  } catch (e) {
    return { valid: false, error: `Invalid YAML: ${e instanceof Error ? e.message : String(e)}` }
  }

  const result = mittoConfigSchema.safeParse(raw)
  if (!result.success) {
    return { valid: false, error: result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ') }
  }

  return { valid: true, config: result.data }
}
