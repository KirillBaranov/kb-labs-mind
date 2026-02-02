/**
 * Application class - main application logic
 */

import type { DatabaseService } from '../services/DatabaseService';
import type { AuthService } from '../services/AuthService';
import type { Logger } from '../utils/Logger';
import { UserController } from '../controllers/UserController';
import { ProductController } from '../controllers/ProductController';
import { AuthMiddleware } from '../middleware/AuthMiddleware';
import { ErrorMiddleware } from '../middleware/ErrorMiddleware';

export class Application {
  private db: DatabaseService;
  private auth: AuthService;
  private logger: Logger;
  private userController: UserController;
  private productController: ProductController;
  private authMiddleware: AuthMiddleware;
  private errorMiddleware: ErrorMiddleware;

  constructor(
    db: DatabaseService,
    auth: AuthService,
    logger: Logger
  ) {
    this.db = db;
    this.auth = auth;
    this.logger = logger;
    
    this.userController = new UserController(db, logger);
    this.productController = new ProductController(db, logger);
    this.authMiddleware = new AuthMiddleware(auth);
    this.errorMiddleware = new ErrorMiddleware(logger);
  }

  async start(): Promise<void> {
    this.logger.info('Starting application...');
    
    // Initialize controllers
    await this.userController.initialize();
    await this.productController.initialize();
    
    this.logger.info('Application started');
  }

  async stop(): Promise<void> {
    this.logger.info('Stopping application...');
    
    await this.userController.cleanup();
    await this.productController.cleanup();
    
    this.logger.info('Application stopped');
  }

  getRoutes(): any[] {
    return [
      ...this.userController.getRoutes(),
      ...this.productController.getRoutes()
    ];
  }
}

