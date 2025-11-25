import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwksAuthGuard } from '@opareta/common';

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
