import { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'
import { env } from '@/config/env'
import * as usersRepo from '@/repositories/users.repository'

export interface AuthRequest extends Request {
  user?: {
    id: string
    email: string
    plan: string
  }
}

export async function requireAuth(req: AuthRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization

  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or invalid authorization header' })
  }

  const token = authHeader.slice(7)

  try {
    const payload = jwt.verify(token, env.JWT_SECRET) as { sub: string }

    const user = await usersRepo.findAuthProfileById(payload.sub)

    if (!user) {
      return res.status(401).json({ error: 'User not found' })
    }

    req.user = user
    next()
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' })
  }
}

export function generateToken(userId: string): string {
  return jwt.sign({ sub: userId }, env.JWT_SECRET, {
    expiresIn: '7d',
  })
}
