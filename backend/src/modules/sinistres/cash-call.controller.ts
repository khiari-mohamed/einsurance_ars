import { Controller, Get, Post, Patch, Body, Param, Query, UseGuards, Request } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CashCallService } from './cash-call.service';
import { CreateCashCallDto, UpdateCashCallDto, AddCommunicationDto, AddSuiviDto } from './dto/cash-call.dto';

@Controller('cash-calls')
@UseGuards(JwtAuthGuard)
export class CashCallController {
  constructor(private readonly cashCallService: CashCallService) {}

  @Post()
  async create(@Body() createDto: CreateCashCallDto, @Request() req) {
    return this.cashCallService.create(createDto, req.user.userId);
  }

  @Get()
  async findAll(@Query() filters: any) {
    return this.cashCallService.findAll(filters);
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.cashCallService.findOne(id);
  }

  @Patch(':id')
  async update(@Param('id') id: string, @Body() updateDto: UpdateCashCallDto, @Request() req) {
    return this.cashCallService.update(id, updateDto, req.user.userId);
  }

  @Post(':id/communications')
  async addCommunication(@Param('id') id: string, @Body() dto: AddCommunicationDto, @Request() req) {
    return this.cashCallService.addCommunication(id, dto, req.user.userId);
  }

  @Post(':id/suivis')
  async addSuivi(@Param('id') id: string, @Body() dto: AddSuiviDto, @Request() req) {
    return this.cashCallService.addSuivi(id, dto, req.user.userId);
  }

  @Post(':id/reminder')
  async sendReminder(@Param('id') id: string, @Request() req) {
    return this.cashCallService.sendReminder(id, req.user.userId);
  }

  @Post(':id/mark-paid')
  async markAsPaid(
    @Param('id') id: string,
    @Body() body: { montantRecu: number; referencePaiement: string },
    @Request() req
  ) {
    return this.cashCallService.markAsPaid(id, body.montantRecu, body.referencePaiement, req.user.userId);
  }

  @Get('overdue/check')
  async checkOverdue() {
    return this.cashCallService.checkOverdue();
  }
}
