import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtPayload, JwksAuthGuard } from '@opareta/common';

describe('AuthController', () => {
  let controller: AuthController;
  let authService: jest.Mocked<AuthService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        {
          provide: AuthService,
          useValue: {
            register: jest.fn(),
            login: jest.fn(),
            logout: jest.fn(),
          },
        },
      ],
    })
      .overrideGuard(JwksAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<AuthController>(AuthController);
    authService = module.get(AuthService);
  });

  describe('register', () => {
    it('should register a new user', async () => {
      const registerDto = {
        phone_number: '+254712345678',
        email: 'test@example.com',
        password: 'password123',
      };
      const expectedResponse = {
        id: 'user-uuid',
        phone_number: '+254712345678',
        email: 'test@example.com',
        created_at: new Date(),
      };
      authService.register.mockResolvedValue(expectedResponse);

      const result = await controller.register(registerDto);

      expect(authService.register).toHaveBeenCalledWith(registerDto);
      expect(result).toEqual(expectedResponse);
    });
  });

  describe('login', () => {
    it('should return access token on successful login', async () => {
      const loginDto = { phone_number: '+254712345678', password: 'password123' };
      const expectedResponse = { access_token: 'jwt-token', expires_in: 7200 };
      authService.login.mockResolvedValue(expectedResponse);

      const result = await controller.login(loginDto);

      expect(authService.login).toHaveBeenCalledWith(loginDto);
      expect(result).toEqual(expectedResponse);
    });
  });

  describe('verify', () => {
    it('should return user payload from token', async () => {
      const user: JwtPayload = {
        sub: 'user-uuid',
        phone_number: '+254712345678',
        iat: 1704067200,
        exp: 1704074400,
      };

      const result = await controller.verify(user);

      expect(result).toEqual(user);
    });
  });

  describe('logout', () => {
    it('should call logout with extracted token', async () => {
      const authorization = 'Bearer jwt-token';
      authService.logout.mockResolvedValue();

      await controller.logout(authorization);

      expect(authService.logout).toHaveBeenCalledWith('jwt-token');
    });

    it('should handle authorization without Bearer prefix', async () => {
      const authorization = 'jwt-token';
      authService.logout.mockResolvedValue();

      await controller.logout(authorization);

      expect(authService.logout).toHaveBeenCalledWith('jwt-token');
    });
  });
});
