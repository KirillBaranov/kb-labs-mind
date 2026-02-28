/**
 * User model representing a user entity
 */

export interface UserData {
  id?: string;
  email: string;
  passwordHash: string;
  name: string;
  createdAt: Date;
  updatedAt?: Date;
  isActive?: boolean;
}

export class User {
  public id?: string;
  public email: string;
  public passwordHash: string;
  public name: string;
  public createdAt: Date;
  public updatedAt?: Date;
  public isActive: boolean;

  constructor(data: UserData) {
    this.id = data.id;
    this.email = data.email;
    this.passwordHash = data.passwordHash;
    this.name = data.name;
    this.createdAt = data.createdAt;
    this.updatedAt = data.updatedAt;
    this.isActive = data.isActive ?? true;
  }

  update(data: Partial<UserData>): void {
    if (data.email !== undefined) {this.email = data.email;}
    if (data.name !== undefined) {this.name = data.name;}
    if (data.isActive !== undefined) {this.isActive = data.isActive;}
    this.updatedAt = new Date();
  }

  toJSON(): UserData {
    return {
      id: this.id,
      email: this.email,
      passwordHash: this.passwordHash,
      name: this.name,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      isActive: this.isActive
    };
  }

  static fromJSON(data: UserData): User {
    return new User(data);
  }
}

