import { Controller, Post, Get, Patch, Param, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { JwksAuthGuard, CurrentUser, type JwtPayload } from '@opareta/common';
import { PaymentsService } from './payments.service';
import { CreatePaymentDto, UpdatePaymentStatusDto } from './dto';

@ApiTags('payments')
@Controller('payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Post()
  @UseGuards(JwksAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Initiate a new payment' })
  @ApiResponse({ status: 201, description: 'Payment initiated successfully' })
  @ApiResponse({ status: 400, description: 'Invalid input' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async createPayment(
    @CurrentUser() user: JwtPayload,
    @Body() createPaymentDto: CreatePaymentDto
  ) {
    return this.paymentsService.createPayment(user.sub, createPaymentDto);
  }

  @Get(':reference')
  @UseGuards(JwksAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get payment by reference' })
  @ApiResponse({ status: 200, description: 'Payment found' })
  @ApiResponse({ status: 404, description: 'Payment not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getPayment(
    @CurrentUser() user: JwtPayload,
    @Param('reference') reference: string
  ) {
    return this.paymentsService.getPaymentByReference(reference, user.sub);
  }

  @Patch(':reference/status')
  @UseGuards(JwksAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update payment status (admin)' })
  @ApiResponse({ status: 200, description: 'Payment status updated' })
  @ApiResponse({ status: 400, description: 'Invalid status transition' })
  @ApiResponse({ status: 404, description: 'Payment not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async updatePaymentStatus(
    @CurrentUser() user: JwtPayload,
    @Param('reference') reference: string,
    @Body() updateStatusDto: UpdatePaymentStatusDto
  ) {
    return this.paymentsService.updatePaymentStatus(reference, user.sub, updateStatusDto);
  }
}
