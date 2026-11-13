export interface PublicUser {
  id: string;
  email: string;
  displayName: string;
  createdAt: Date;
}

export interface JwtPayload {
  sub: string;
  email: string;
}
