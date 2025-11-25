export interface JwtPayload {
  sub: string;
  phone_number: string;
  iat: number;
  exp: number;
}
