import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';

@Entity('access_tokens')
export class AccessToken {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column()
  user_id!: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'user_id' })
  user!: User;

  @Column({ unique: true })
  token_hash!: string;

  @Column()
  expires_at!: Date;

  @Column({ type: 'timestamp', nullable: true })
  invalidated_at!: Date | null;

  @CreateDateColumn()
  created_at!: Date;
}
