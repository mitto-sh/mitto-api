import { Request, Response, NextFunction, RequestHandler } from 'express'

// Express 4 does not catch rejected promises from async handlers — an error
// thrown after an `await` becomes an unhandled rejection instead of reaching
// errorHandler. Wrap every async route handler with this.
export function asyncHandler<Req extends Request = Request>(
  fn: (req: Req, res: Response, next: NextFunction) => Promise<unknown>,
): RequestHandler {
  return (req, res, next) => {
    fn(req as Req, res, next).catch(next)
  }
}
