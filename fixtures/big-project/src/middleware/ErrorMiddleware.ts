/**
 * Error handling middleware
 */

import { Logger } from '../utils/Logger';

export class ErrorMiddleware {
  private logger: Logger;

  constructor(logger: Logger) {
    this.logger = logger;
  }

  handleError(error: any, req: any, res: any, next: any): void {
    this.logger.error('Unhandled error:', error);
    
    res.status(500).json({
      error: 'Internal server error',
      message: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong'
    });
  }

  handleNotFound(req: any, res: any): void {
    res.status(404).json({
      error: 'Not found',
      message: `Route ${req.method} ${req.path} not found`
    });
  }
}

