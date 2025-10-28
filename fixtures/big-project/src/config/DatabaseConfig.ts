/**
 * Database configuration
 */

export class DatabaseConfig {
  public readonly host: string;
  public readonly port: number;
  public readonly database: string;
  public readonly username: string;
  public readonly password: string;
  public readonly ssl: boolean;
  public readonly poolSize: number;

  constructor() {
    this.host = process.env.DB_HOST || 'localhost';
    this.port = parseInt(process.env.DB_PORT || '5432');
    this.database = process.env.DB_NAME || 'myapp';
    this.username = process.env.DB_USER || 'postgres';
    this.password = process.env.DB_PASSWORD || 'password';
    this.ssl = process.env.DB_SSL === 'true';
    this.poolSize = parseInt(process.env.DB_POOL_SIZE || '10');
  }

  getConnectionString(): string {
    return `postgresql://${this.username}:${this.password}@${this.host}:${this.port}/${this.database}`;
  }
}

