import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
  Index,
} from 'typeorm';
import { PaymentStatus, PaymentCurrency, PaymentMethod } from './payment.types';
import type { PaymentStatusLog } from './payment-status-log.entity';

@Entity('payments')
export class Payment {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index({ unique: true })
  @Column()
  reference!: string;

  @Column('uuid')
  user_id!: string;

  @Column({ type: 'decimal', precision: 18, scale: 2 })
  amount!: number;

  @Column({ type: 'enum', enum: PaymentCurrency })
  currency!: PaymentCurrency;

  @Column({ type: 'enum', enum: PaymentMethod })
  payment_method!: PaymentMethod;

  @Column()
  customer_phone!: string;

  @Column()
  customer_email!: string;

  @Column({
    type: 'enum',
    enum: PaymentStatus,
    default: PaymentStatus.INITIATED,
  })
  status!: PaymentStatus;

  @Column({ type: 'varchar', nullable: true })
  provider_reference!: string;

  @Column({ type: 'varchar', nullable: true })
  provider_transaction_id!: string;

  @Column({ type: 'varchar', nullable: true })
  failure_reason!: string;

  @CreateDateColumn()
  created_at!: Date;

  @UpdateDateColumn()
  updated_at!: Date;

  @OneToMany('PaymentStatusLog', 'payment')
  status_logs!: PaymentStatusLog[];
}
