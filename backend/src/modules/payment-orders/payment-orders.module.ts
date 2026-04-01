import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PaymentOrder } from './payment-order.entity';

@Module({
  imports: [TypeOrmModule.forFeature([PaymentOrder])],
})
export class PaymentOrdersModule {}
