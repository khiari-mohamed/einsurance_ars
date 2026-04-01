import { Controller, Get, Post, Param, Body, UseGuards } from '@nestjs/common';
import { FinanceIntegrationService } from './finance-integration.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('ged/finance')
@UseGuards(JwtAuthGuard)
export class GedFinanceController {
  constructor(private financeService: FinanceIntegrationService) {}

  @Get('payment/:paymentId/documents')
  async getPaymentDocuments(@Param('paymentId') paymentId: string) {
    return this.financeService.getPaymentDocuments(paymentId);
  }

  @Post('payment/:paymentId/link-documents')
  async linkPaymentToDocuments(
    @Param('paymentId') paymentId: string,
    @Body('documentIds') documentIds: string[],
  ) {
    await this.financeService.linkPaymentToDocuments(paymentId, documentIds);
    return { message: 'Documents linked to payment successfully' };
  }

  @Get('payment/:paymentId/validate')
  async validatePaymentDocuments(@Param('paymentId') paymentId: string) {
    const isValid = await this.financeService.validatePaymentDocuments(paymentId);
    return { valid: isValid };
  }
}
