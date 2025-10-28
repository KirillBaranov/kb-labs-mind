/**
 * Application class - main application logic
 */

import { DatabaseService } from '../services/DatabaseService.js';
import { AuthService } from '../services/AuthService.js';
import { Logger } from '../utils/Logger.js';
import { UserController } from '../controllers/UserController.js';
import { ProductController } from '../controllers/ProductController.js';
import { AuthMiddleware } from '../middleware/AuthMiddleware.js';
import { ErrorMiddleware } from '../middleware/ErrorMiddleware.js';

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

