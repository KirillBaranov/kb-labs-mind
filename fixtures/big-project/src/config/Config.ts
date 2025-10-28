/**
 * Main configuration class
 */

import { DatabaseConfig } from './DatabaseConfig.js';
import { AuthConfig } from './AuthConfig.js';

export class Config {
  public readonly database: DatabaseConfig;
  public readonly auth: AuthConfig;
  public readonly logLevel: string;
  public readonly port: number;
  public readonly environment: string;

  constructor() {
    this.environment = process.env.NODE_ENV || 'development';
    this.port = parseInt(process.env.PORT || '3000');
    this.logLevel = process.env.LOG_LEVEL || 'info';
    
    this.database = new DatabaseConfig();
    this.auth = new AuthConfig();
  }

  isDevelopment(): boolean {
    return this.environment === 'development';
  }

  isProduction(): boolean {
    return this.environment === 'production';
  }

  isTest(): boolean {
    return this.environment === 'test';
  }
}

