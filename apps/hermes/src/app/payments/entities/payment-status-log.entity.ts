import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { PaymentStatus } from './payment.types';
import type { Payment } from './payment.entity';

@Entity('payment_status_logs')
export class PaymentStatusLog {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column('uuid')
  payment_id!: string;

  @ManyToOne('Payment', 'status_logs', {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'payment_id' })
  payment!: Payment;

  @Column({
    type: 'enum',
    enum: PaymentStatus,
    enumName: 'payments_status_enum',
  })
  from_status!: PaymentStatus;

  @Column({
    type: 'enum',
    enum: PaymentStatus,
    enumName: 'payments_status_enum',
  })
  to_status!: PaymentStatus;

  @Column({ type: 'varchar', nullable: true })
  reason!: string;

  @Column({ type: 'varchar', nullable: true })
  triggered_by!: string;

  @CreateDateColumn()
  created_at!: Date;
}
