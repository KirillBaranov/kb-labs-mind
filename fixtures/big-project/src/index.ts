/**
 * Main application entry point
 */

import { Application } from './api/Application.js';
import { DatabaseService } from './services/DatabaseService.js';
import { AuthService } from './services/AuthService.js';
import { Logger } from './utils/Logger.js';
import { Config } from './config/Config.js';

export class App {
  private app: Application;
  private db: DatabaseService;
  private auth: AuthService;
  private logger: Logger;
  private config: Config;

  constructor() {
    this.config = new Config();
    this.logger = new Logger(this.config.logLevel);
    this.db = new DatabaseService(this.config.database);
    this.auth = new AuthService(this.config.auth);
    this.app = new Application(this.db, this.auth, this.logger);
  }

  async start(): Promise<void> {
    try {
      await this.db.connect();
      await this.auth.initialize();
      await this.app.start();
      
      this.logger.info('Application started successfully');
    } catch (error) {
      this.logger.error('Failed to start application:', error);
      process.exit(1);
    }
  }

  async stop(): Promise<void> {
    try {
      await this.app.stop();
      await this.db.disconnect();
      this.logger.info('Application stopped');
    } catch (error) {
      this.logger.error('Error stopping application:', error);
    }
  }
}

// Start the application
const app = new App();
app.start().catch(console.error);

// Graceful shutdown
process.on('SIGINT', () => app.stop());
process.on('SIGTERM', () => app.stop());

