import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { User } from './entities/user.entity';
import { CreateUserDto, UserResponseDto } from './dto';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
  ) {}

  async register(dto: CreateUserDto): Promise<UserResponseDto> {
    const hashedPassword = await bcrypt.hash(dto.password, 10);

    const user = await this.usersRepository.save(
      this.usersRepository.create({
        phone_number: dto.phone_number,
        email: dto.email,
        password: hashedPassword,
      }),
    );

    return {
      id: user.id,
      phone_number: user.phone_number,
      email: user.email,
      created_at: user.created_at,
    };
  }

  async findByPhoneNumber(phone_number: string): Promise<User | null> {
    return this.usersRepository.findOne({ where: { phone_number } });
  }

  async findById(id: string): Promise<User | null> {
    return this.usersRepository.findOne({ where: { id } });
  }

  toResponse(user: User): UserResponseDto {
    return {
      id: user.id,
      phone_number: user.phone_number,
      email: user.email,
      created_at: user.created_at,
    };
  }
}
