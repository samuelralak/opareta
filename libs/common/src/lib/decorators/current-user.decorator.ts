import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Request } from 'express';
import { JwtPayload } from '../types';

export const CurrentUser = createParamDecorator(
  (data: keyof JwtPayload | undefined, ctx: ExecutionContext): JwtPayload | JwtPayload[keyof JwtPayload] => {
    const request = ctx.switchToHttp().getRequest<Request & { user: JwtPayload }>();
    const user = request.user;

    return data ? user?.[data] : user;
  },
);
