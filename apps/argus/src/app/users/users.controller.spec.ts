import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { JwksAuthGuard } from '@opareta/common';

describe('UsersController', () => {
  let controller: UsersController;
  let usersService: jest.Mocked<UsersService>;

  const mockUserResponse = {
    id: 'user-uuid',
    phone_number: '+254712345678',
    email: 'test@example.com',
    created_at: new Date(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [
        {
          provide: UsersService,
          useValue: {
            register: jest.fn(),
            findById: jest.fn(),
            toResponse: jest.fn(),
          },
        },
      ],
    })
      .overrideGuard(JwksAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<UsersController>(UsersController);
    usersService = module.get(UsersService);
  });

  describe('create', () => {
    it('should register a new user', async () => {
      const createUserDto = {
        phone_number: '+254712345678',
        email: 'test@example.com',
        password: 'password123',
      };
      usersService.register.mockResolvedValue(mockUserResponse);

      const result = await controller.create(createUserDto);

      expect(usersService.register).toHaveBeenCalledWith(createUserDto);
      expect(result).toEqual(mockUserResponse);
    });
  });

  describe('me', () => {
    it('should return current user info', async () => {
      const jwtPayload = {
        sub: 'user-uuid',
        phone_number: '+254712345678',
        iat: 123,
        exp: 456,
      };
      const mockUser = { ...mockUserResponse, password: 'hashed', updated_at: new Date() };
      usersService.findById.mockResolvedValue(mockUser as never);
      usersService.toResponse.mockReturnValue(mockUserResponse);

      const result = await controller.me(jwtPayload);

      expect(usersService.findById).toHaveBeenCalledWith('user-uuid');
      expect(usersService.toResponse).toHaveBeenCalledWith(mockUser);
      expect(result).toEqual(mockUserResponse);
    });

    it('should throw NotFoundException when user not found', async () => {
      const jwtPayload = {
        sub: 'non-existent-uuid',
        phone_number: '+254712345678',
        iat: 123,
        exp: 456,
      };
      usersService.findById.mockResolvedValue(null);

      await expect(controller.me(jwtPayload)).rejects.toThrow(NotFoundException);
    });
  });
});
