/**
 * Password hashing utility
 */

import { createHash, randomBytes } from 'crypto';

export class PasswordHash {
  private readonly saltLength = 16;
  private readonly iterations = 10000;
  private readonly keyLength = 64;

  async hash(password: string): Promise<string> {
    const salt = randomBytes(this.saltLength).toString('hex');
    const hash = createHash('sha256')
      .update(password + salt)
      .digest('hex');
    
    return `${salt}:${hash}`;
  }

  async verify(password: string, hashedPassword: string): Promise<boolean> {
    const [salt, hash] = hashedPassword.split(':');
    if (!salt || !hash) {
      return false;
    }

    const computedHash = createHash('sha256')
      .update(password + salt)
      .digest('hex');
    
    return computedHash === hash;
  }
}

