/**
 * Authentication configuration
 */

export class AuthConfig {
  public readonly secret: string;
  public readonly expiresIn: string;
  public readonly refreshExpiresIn: string;
  public readonly algorithm: string;

  constructor() {
    this.secret = process.env.JWT_SECRET || 'your-secret-key';
    this.expiresIn = process.env.JWT_EXPIRES_IN || '1h';
    this.refreshExpiresIn = process.env.JWT_REFRESH_EXPIRES_IN || '7d';
    this.algorithm = process.env.JWT_ALGORITHM || 'HS256';
  }

  getSecret(): string {
    return this.secret;
  }

  getExpiresIn(): string {
    return this.expiresIn;
  }

  getRefreshExpiresIn(): string {
    return this.refreshExpiresIn;
  }

  getAlgorithm(): string {
    return this.algorithm;
  }
}

