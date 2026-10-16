import 'express';

declare global {
  namespace Express {
    interface Request {
      userId?: string;
      user?: {
        userId: string;
        role: 'OWNER' | 'ADMIN' | 'STAFF' | 'CLIENT';
        clientId?: string;
        tenantId: string;
      };
    }
  }
}

export {};
