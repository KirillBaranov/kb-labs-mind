/**
 * JWT utility for token generation and verification
 */

export class JWT {
  private secret: string;

  constructor(secret: string) {
    this.secret = secret;
  }

  sign(payload: any): string {
    // Simulate JWT signing
    const header = { alg: 'HS256', typ: 'JWT' };
    const encodedHeader = this.base64UrlEncode(JSON.stringify(header));
    const encodedPayload = this.base64UrlEncode(JSON.stringify(payload));
    const signature = this.createSignature(encodedHeader + '.' + encodedPayload);
    
    return `${encodedHeader}.${encodedPayload}.${signature}`;
  }

  verify(token: string): any {
    try {
      const parts = token.split('.');
      if (parts.length !== 3) {
        throw new Error('Invalid token format');
      }

      const [header, payload, signature] = parts;
      const expectedSignature = this.createSignature(header + '.' + payload);
      
      if (signature !== expectedSignature) {
        throw new Error('Invalid signature');
      }

      return JSON.parse(this.base64UrlDecode(payload));
    } catch (error) {
      throw new Error('Token verification failed');
    }
  }

  private base64UrlEncode(str: string): string {
    return Buffer.from(str)
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '');
  }

  private base64UrlDecode(str: string): string {
    str += '='.repeat((4 - str.length % 4) % 4);
    str = str.replace(/-/g, '+').replace(/_/g, '/');
    return Buffer.from(str, 'base64').toString();
  }

  private createSignature(data: string): string {
    // Simulate HMAC-SHA256 signature
    return 'signature_' + Buffer.from(data + this.secret).toString('base64');
  }
}

