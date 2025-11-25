import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { UsersService } from './users.service';
import { User } from './entities/user.entity';

jest.mock('bcrypt');

describe('UsersService', () => {
  let service: UsersService;
  let usersRepository: jest.Mocked<Repository<User>>;

  const mockUser = {
    id: 'user-uuid',
    phone_number: '+254712345678',
    email: 'test@example.com',
    password: 'hashed-password',
    created_at: new Date(),
    updated_at: new Date(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        {
          provide: getRepositoryToken(User),
          useValue: {
            create: jest.fn(),
            save: jest.fn(),
            findOne: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
    usersRepository = module.get(getRepositoryToken(User));
  });

  describe('register', () => {
    it('should hash password and create user', async () => {
      const createUserDto = {
        phone_number: '+254712345678',
        email: 'test@example.com',
        password: 'plain-password',
      };
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashed-password');
      usersRepository.create.mockReturnValue(mockUser as User);
      usersRepository.save.mockResolvedValue(mockUser as User);

      const result = await service.register(createUserDto);

      expect(bcrypt.hash).toHaveBeenCalledWith('plain-password', 10);
      expect(usersRepository.create).toHaveBeenCalledWith({
        phone_number: '+254712345678',
        email: 'test@example.com',
        password: 'hashed-password',
      });
      expect(result).toEqual({
        id: mockUser.id,
        phone_number: mockUser.phone_number,
        email: mockUser.email,
        created_at: mockUser.created_at,
      });
    });
  });

  describe('findByPhoneNumber', () => {
    it('should return user when found', async () => {
      usersRepository.findOne.mockResolvedValue(mockUser as User);

      const result = await service.findByPhoneNumber('+254712345678');

      expect(usersRepository.findOne).toHaveBeenCalledWith({
        where: { phone_number: '+254712345678' },
      });
      expect(result).toEqual(mockUser);
    });

    it('should return null when user not found', async () => {
      usersRepository.findOne.mockResolvedValue(null);

      const result = await service.findByPhoneNumber('+254000000000');

      expect(result).toBeNull();
    });
  });

  describe('findById', () => {
    it('should return user when found', async () => {
      usersRepository.findOne.mockResolvedValue(mockUser as User);

      const result = await service.findById('user-uuid');

      expect(usersRepository.findOne).toHaveBeenCalledWith({
        where: { id: 'user-uuid' },
      });
      expect(result).toEqual(mockUser);
    });
  });

  describe('toResponse', () => {
    it('should convert user entity to response dto', () => {
      const result = service.toResponse(mockUser as User);

      expect(result).toEqual({
        id: mockUser.id,
        phone_number: mockUser.phone_number,
        email: mockUser.email,
        created_at: mockUser.created_at,
      });
    });
  });
});
