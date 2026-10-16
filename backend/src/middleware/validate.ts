import { Request, Response, NextFunction } from 'express';
import { ZodType } from 'zod';
import { zodResponse } from '../lib/validation';

/** Valida y reemplaza req.body con el resultado parseado; 400 si no cumple el esquema. */
export const validateBody =
  (schema: ZodType) => (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body ?? {});
    if (!result.success) {
      return res.status(400).json(zodResponse(result.error));
    }
    req.body = result.data;
    next();
  };

/** Igual que validateBody pero para req.query. */
export const validateQuery =
  (schema: ZodType) => (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.query ?? {});
    if (!result.success) {
      return res.status(400).json(zodResponse(result.error));
    }
    (req as any).validatedQuery = result.data;
    next();
  };
