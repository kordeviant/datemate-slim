export interface AuthUser {
  id: number;
  sub?: number;
  email?: string;
  role?: string;
  name?: string;
  sessionId?: number;
}

export interface JwtPayload {
  sub: number | string;
  email?: string;
  role?: string;
  sessionId?: number;
  iat?: number;
  exp?: number;
  [key: string]: any;
}
