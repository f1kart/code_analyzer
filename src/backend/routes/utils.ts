import type { NextFunction, Request, RequestHandler, Response } from 'express';
import { validationResult } from 'express-validator';
import { UnauthorizedError, ValidationError } from '../errors';
import config from '../config';

export type AsyncHandler = (req: Request, res: Response, next: NextFunction) => Promise<unknown>;

export const asyncHandler = (handler: AsyncHandler): RequestHandler => {
  return (req, res, next) => {
    Promise.resolve(handler(req, res, next)).catch(next);
  };
};

export const ensureValidRequest = (req: Request): void => {
  const validation = validationResult(req);
  if (!validation.isEmpty()) {
    throw new ValidationError('Invalid request payload', validation.array());
  }
};

export const protectRoute = (req: Request, res: Response, next: NextFunction): void => {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    throw new UnauthorizedError('Missing Authorization header');
  }

  const [scheme, token] = authHeader.split(' ');
  if (scheme !== 'Bearer' || !token) {
    throw new UnauthorizedError('Invalid Authorization header format');
  }

  if (token !== config.apiKey) {
    throw new UnauthorizedError('Invalid API key');
  }

  next();
};