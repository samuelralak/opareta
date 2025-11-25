import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { JwksAuthGuard } from '@opareta/common';
import { Payment, PaymentStatus, PaymentCurrency, PaymentMethod } from './entities';
import type { JwtPayload } from '@opareta/common';

describe('PaymentsController', () => {
  let controller: PaymentsController;
  let paymentsService: jest.Mocked<PaymentsService>;

  const mockJwksAuthGuard = {
    canActivate: jest.fn().mockReturnValue(true),
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
    status: PaymentStatus.PENDING,
    provider_reference: 'PRV-123',
    provider_transaction_id: null as unknown as string,
    failure_reason: null as unknown as string,
    created_at: new Date(),
    updated_at: new Date(),
    status_logs: [],
  };

  const mockUser: JwtPayload = {
    sub: 'user-uuid-123',
    phone_number: '+256700000000',
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 3600,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [PaymentsController],
      providers: [
        {
          provide: PaymentsService,
          useValue: {
            createPayment: jest.fn(),
            getPaymentByReference: jest.fn(),
            updatePaymentStatus: jest.fn(),
          },
        },
      ],
    })
      .overrideGuard(JwksAuthGuard)
      .useValue(mockJwksAuthGuard)
      .compile();

    controller = module.get<PaymentsController>(PaymentsController);
    paymentsService = module.get(PaymentsService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('createPayment', () => {
    const createPaymentDto = {
      amount: 1000,
      currency: PaymentCurrency.UGX,
      payment_method: PaymentMethod.MOBILE_MONEY,
      customer_phone: '+256700000000',
      customer_email: 'test@example.com',
    };

    it('should create a payment successfully', async () => {
      paymentsService.createPayment.mockResolvedValue(mockPayment);

      const result = await controller.createPayment(mockUser, createPaymentDto);

      expect(paymentsService.createPayment).toHaveBeenCalledWith(
        mockUser.sub,
        createPaymentDto
      );
      expect(result).toEqual(mockPayment);
    });

    it('should pass user sub from JWT to service', async () => {
      paymentsService.createPayment.mockResolvedValue(mockPayment);

      await controller.createPayment(mockUser, createPaymentDto);

      expect(paymentsService.createPayment).toHaveBeenCalledWith(
        'user-uuid-123',
        expect.any(Object)
      );
    });
  });

  describe('getPayment', () => {
    it('should return a payment when found', async () => {
      paymentsService.getPaymentByReference.mockResolvedValue(mockPayment);

      const result = await controller.getPayment(mockUser, 'PAY-ABC12345');

      expect(paymentsService.getPaymentByReference).toHaveBeenCalledWith('PAY-ABC12345', mockUser.sub);
      expect(result).toEqual(mockPayment);
    });

    it('should throw NotFoundException when payment is not found', async () => {
      paymentsService.getPaymentByReference.mockRejectedValue(
        new NotFoundException('Payment with reference PAY-NOTFOUND not found')
      );

      await expect(controller.getPayment(mockUser, 'PAY-NOTFOUND')).rejects.toThrow(
        NotFoundException
      );
    });
  });

  describe('updatePaymentStatus', () => {
    const updateStatusDto = {
      status: PaymentStatus.SUCCESS,
      reason: 'Manual approval',
    };

    it('should update payment status successfully', async () => {
      const updatedPayment = { ...mockPayment, status: PaymentStatus.SUCCESS };
      paymentsService.updatePaymentStatus.mockResolvedValue(updatedPayment);

      const result = await controller.updatePaymentStatus(mockUser, 'PAY-ABC12345', updateStatusDto);

      expect(paymentsService.updatePaymentStatus).toHaveBeenCalledWith(
        'PAY-ABC12345',
        mockUser.sub,
        updateStatusDto
      );
      expect(result.status).toBe(PaymentStatus.SUCCESS);
    });

    it('should throw BadRequestException for invalid status transition', async () => {
      paymentsService.updatePaymentStatus.mockRejectedValue(
        new BadRequestException('Invalid status transition from SUCCESS to PENDING')
      );

      await expect(
        controller.updatePaymentStatus(mockUser, 'PAY-ABC12345', {
          status: PaymentStatus.PENDING,
        })
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw NotFoundException when payment is not found', async () => {
      paymentsService.updatePaymentStatus.mockRejectedValue(
        new NotFoundException('Payment with reference PAY-NOTFOUND not found')
      );

      await expect(
        controller.updatePaymentStatus(mockUser, 'PAY-NOTFOUND', updateStatusDto)
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('route decorators', () => {
    it('should have POST decorator on createPayment', () => {
      const metadata = Reflect.getMetadata('method', controller.createPayment);
      expect(metadata).toBeDefined();
    });

    it('should have GET decorator on getPayment', () => {
      const metadata = Reflect.getMetadata('method', controller.getPayment);
      expect(metadata).toBeDefined();
    });

    it('should have PATCH decorator on updatePaymentStatus', () => {
      const metadata = Reflect.getMetadata('method', controller.updatePaymentStatus);
      expect(metadata).toBeDefined();
    });
  });
});
