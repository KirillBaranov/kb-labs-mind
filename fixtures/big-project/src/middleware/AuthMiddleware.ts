/**
 * Authentication middleware
 */

import type { AuthService } from '../services/AuthService';

export class AuthMiddleware {
  private auth: AuthService;

  constructor(auth: AuthService) {
    this.auth = auth;
  }

  async authenticate(req: any, res: any, next: any): Promise<void> {
    try {
      const token = this.extractToken(req);
      if (!token) {
        res.status(401).json({ error: 'No token provided' });
        return;
      }

      const payload = await this.auth.verifyToken(token);
      if (!payload) {
        res.status(401).json({ error: 'Invalid token' });
        return;
      }

      req.user = payload;
      next();
    } catch (error) {
      res.status(401).json({ error: 'Authentication failed' });
    }
  }

  private extractToken(req: any): string | null {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return null;
    }
    
    return authHeader.substring(7);
  }
}

