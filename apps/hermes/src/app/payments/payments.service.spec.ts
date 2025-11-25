import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { DataSource, Repository, EntityManager } from 'typeorm';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { Payment, PaymentStatus, PaymentCurrency, PaymentMethod } from './entities';

describe('PaymentsService', () => {
  let service: PaymentsService;
  let paymentRepository: jest.Mocked<Repository<Payment>>;
  let dataSource: jest.Mocked<DataSource>;

  const mockTransactionManager = {
    create: jest.fn(),
    save: jest.fn(),
    update: jest.fn(),
  };

  const mockPayment: Payment = {
    id: 'payment-uuid-123',
    reference: 'PAY-ABC12345',
    user_id: 'user-uuid-123',
    amount: 1000,
    currency: PaymentCurrency.UGX,
    payment_method: PaymentMethod.MOBILE_MONEY,
    customer_phone: '+256700000000',
    customer_email: 'test@example.com',
    status: PaymentStatus.INITIATED,
    provider_reference: null as unknown as string,
    provider_transaction_id: null as unknown as string,
    failure_reason: null as unknown as string,
    created_at: new Date(),
    updated_at: new Date(),
    status_logs: [],
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentsService,
        {
          provide: getRepositoryToken(Payment),
          useValue: {
            create: jest.fn(),
            save: jest.fn(),
            findOne: jest.fn(),
            findOneOrFail: jest.fn(),
          },
        },
        {
          provide: DataSource,
          useValue: {
            transaction: jest.fn((callback: (manager: EntityManager) => Promise<void>) =>
              callback(mockTransactionManager as unknown as EntityManager)
            ),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockReturnValue('http://localhost:3001'),
          },
        },
      ],
    }).compile();

    service = module.get<PaymentsService>(PaymentsService);
    paymentRepository = module.get(getRepositoryToken(Payment));
    dataSource = module.get(DataSource);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createPayment', () => {
    const createPaymentInput = {
      amount: 1000,
      currency: PaymentCurrency.UGX,
      payment_method: PaymentMethod.MOBILE_MONEY,
      customer_phone: '+256700000000',
      customer_email: 'test@example.com',
    };

    it('should create a payment and transition to PENDING status', async () => {
      const savedPayment = { ...mockPayment };
      const paymentWithLogs = { ...savedPayment, status_logs: [] };

      paymentRepository.create.mockReturnValue(savedPayment);
      paymentRepository.save.mockResolvedValue(savedPayment);
      paymentRepository.findOneOrFail.mockResolvedValue(paymentWithLogs);
      mockTransactionManager.create.mockReturnValue({});
      mockTransactionManager.save.mockResolvedValue({});
      mockTransactionManager.update.mockResolvedValue({});

      const result = await service.createPayment('user-uuid-123', createPaymentInput);

      expect(paymentRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          user_id: 'user-uuid-123',
          amount: 1000,
          currency: PaymentCurrency.UGX,
          status: PaymentStatus.INITIATED,
        })
      );
      expect(paymentRepository.save).toHaveBeenCalled();
      expect(result).toEqual(paymentWithLogs);
    });

    it('should generate a unique payment reference', async () => {
      const savedPayment = { ...mockPayment };
      paymentRepository.create.mockReturnValue(savedPayment);
      paymentRepository.save.mockResolvedValue(savedPayment);
      paymentRepository.findOneOrFail.mockResolvedValue(savedPayment);
      mockTransactionManager.create.mockReturnValue({});
      mockTransactionManager.save.mockResolvedValue({});
      mockTransactionManager.update.mockResolvedValue({});

      await service.createPayment('user-uuid-123', createPaymentInput);

      expect(paymentRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          reference: expect.stringMatching(/^PAY-[A-Z0-9]{8}$/),
        })
      );
    });
  });

  describe('getPaymentByReference', () => {
    it('should return a payment when found', async () => {
      const payment = { ...mockPayment, status_logs: [] };
      paymentRepository.findOne.mockResolvedValue(payment);

      const result = await service.getPaymentByReference('PAY-ABC12345');

      expect(paymentRepository.findOne).toHaveBeenCalledWith({
        where: { reference: 'PAY-ABC12345' },
        relations: ['status_logs'],
      });
      expect(result).toEqual(payment);
    });

    it('should throw NotFoundException when payment is not found', async () => {
      paymentRepository.findOne.mockResolvedValue(null);

      await expect(service.getPaymentByReference('PAY-NOTFOUND')).rejects.toThrow(
        NotFoundException
      );
      await expect(service.getPaymentByReference('PAY-NOTFOUND')).rejects.toThrow(
        'Payment with reference PAY-NOTFOUND not found'
      );
    });
  });

  describe('updatePaymentStatus', () => {
    it('should update payment status with valid transition', async () => {
      const pendingPayment = { ...mockPayment, status: PaymentStatus.PENDING };
      const updatedPayment = { ...pendingPayment, status: PaymentStatus.SUCCESS };

      paymentRepository.findOne.mockResolvedValue(pendingPayment);
      paymentRepository.findOneOrFail.mockResolvedValue(updatedPayment);
      mockTransactionManager.create.mockReturnValue({});
      mockTransactionManager.save.mockResolvedValue({});
      mockTransactionManager.update.mockResolvedValue({});

      const result = await service.updatePaymentStatus('PAY-ABC12345', {
        status: PaymentStatus.SUCCESS,
        reason: 'Manual approval',
      });

      expect(dataSource.transaction).toHaveBeenCalled();
      expect(mockTransactionManager.update).toHaveBeenCalledWith(
        Payment,
        pendingPayment.id,
        { status: PaymentStatus.SUCCESS }
      );
      expect(result.status).toBe(PaymentStatus.SUCCESS);
    });

    it('should throw BadRequestException for invalid status transition', async () => {
      const successPayment = { ...mockPayment, status: PaymentStatus.SUCCESS };
      paymentRepository.findOne.mockResolvedValue(successPayment);

      await expect(
        service.updatePaymentStatus('PAY-ABC12345', {
          status: PaymentStatus.PENDING,
        })
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when transitioning from FAILED', async () => {
      const failedPayment = { ...mockPayment, status: PaymentStatus.FAILED };
      paymentRepository.findOne.mockResolvedValue(failedPayment);

      await expect(
        service.updatePaymentStatus('PAY-ABC12345', {
          status: PaymentStatus.SUCCESS,
        })
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('status transitions', () => {
    const testCases = [
      { from: PaymentStatus.INITIATED, to: PaymentStatus.PENDING, valid: true },
      { from: PaymentStatus.INITIATED, to: PaymentStatus.FAILED, valid: true },
      { from: PaymentStatus.INITIATED, to: PaymentStatus.SUCCESS, valid: false },
      { from: PaymentStatus.PENDING, to: PaymentStatus.SUCCESS, valid: true },
      { from: PaymentStatus.PENDING, to: PaymentStatus.FAILED, valid: true },
      { from: PaymentStatus.PENDING, to: PaymentStatus.INITIATED, valid: false },
      { from: PaymentStatus.SUCCESS, to: PaymentStatus.PENDING, valid: false },
      { from: PaymentStatus.SUCCESS, to: PaymentStatus.FAILED, valid: false },
      { from: PaymentStatus.FAILED, to: PaymentStatus.SUCCESS, valid: false },
      { from: PaymentStatus.FAILED, to: PaymentStatus.PENDING, valid: false },
    ];

    testCases.forEach(({ from, to, valid }) => {
      it(`should ${valid ? 'allow' : 'reject'} transition from ${from} to ${to}`, async () => {
        const payment = { ...mockPayment, status: from };
        paymentRepository.findOne.mockResolvedValue(payment);

        if (valid) {
          paymentRepository.findOneOrFail.mockResolvedValue({ ...payment, status: to });
          mockTransactionManager.create.mockReturnValue({});
          mockTransactionManager.save.mockResolvedValue({});
          mockTransactionManager.update.mockResolvedValue({});

          const result = await service.updatePaymentStatus('PAY-ABC12345', { status: to });
          expect(result.status).toBe(to);
        } else {
          await expect(
            service.updatePaymentStatus('PAY-ABC12345', { status: to })
          ).rejects.toThrow(BadRequestException);
        }
      });
    });
  });

  describe('transaction handling', () => {
    it('should use callback-style transaction', async () => {
      const pendingPayment = { ...mockPayment, status: PaymentStatus.PENDING };
      paymentRepository.findOne.mockResolvedValue(pendingPayment);
      paymentRepository.findOneOrFail.mockResolvedValue(pendingPayment);
      mockTransactionManager.create.mockReturnValue({});
      mockTransactionManager.save.mockResolvedValue({});
      mockTransactionManager.update.mockResolvedValue({});

      await service.updatePaymentStatus('PAY-ABC12345', {
        status: PaymentStatus.SUCCESS,
      });

      expect(dataSource.transaction).toHaveBeenCalledWith(expect.any(Function));
    });

    it('should propagate errors from transaction callback', async () => {
      const pendingPayment = { ...mockPayment, status: PaymentStatus.PENDING };
      paymentRepository.findOne.mockResolvedValue(pendingPayment);
      mockTransactionManager.create.mockReturnValue({});
      mockTransactionManager.save.mockRejectedValue(new Error('Database error'));

      await expect(
        service.updatePaymentStatus('PAY-ABC12345', {
          status: PaymentStatus.SUCCESS,
        })
      ).rejects.toThrow('Database error');
    });
  });
});
