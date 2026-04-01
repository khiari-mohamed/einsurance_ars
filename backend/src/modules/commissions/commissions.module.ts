import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Commission } from './commission.entity';
import { CommissionCalculatorService } from './commission-calculator.service';

@Module({
  imports: [TypeOrmModule.forFeature([Commission])],
  providers: [CommissionCalculatorService],
  exports: [CommissionCalculatorService],
})
export class CommissionsModule {}
