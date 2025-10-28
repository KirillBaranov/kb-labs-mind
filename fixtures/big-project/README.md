# Big Project Architecture

## Overview

This is a large TypeScript project designed to test the mind indexing capabilities with complex dependency graphs, multiple layers, and various patterns.

## Architecture

### Layers

1. **API Layer** (`src/api/`)
   - Application class - main application logic
   - Route definitions and handlers

2. **Services Layer** (`src/services/`)
   - DatabaseService - database operations
   - AuthService - authentication logic

3. **Controllers Layer** (`src/controllers/`)
   - UserController - user management
   - ProductController - product operations

4. **Models Layer** (`src/models/`)
   - User - user entity model

5. **Utils Layer** (`src/utils/`)
   - Logger - logging utility
   - JWT - token handling
   - PasswordHash - password hashing

6. **Middleware Layer** (`src/middleware/`)
   - AuthMiddleware - authentication
   - ErrorMiddleware - error handling

7. **Config Layer** (`src/config/`)
   - Config - main configuration
   - DatabaseConfig - database settings
   - AuthConfig - authentication settings

## Dependencies

- Express.js for web framework
- Lodash for utilities
- Axios for HTTP requests
- TypeScript for type safety

## Testing

The project includes comprehensive test suites:
- Unit tests (`tests/unit/`)
- Integration tests (`tests/integration/`)

## Documentation

- ADR documents (`docs/adr/`)
- User guides (`docs/guides/`)

