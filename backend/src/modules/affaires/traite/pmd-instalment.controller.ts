import { Controller, Get, Post, Patch, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { PMDInstalmentService, CreatePMDInstalmentDto, UpdatePMDInstalmentDto } from './pmd-instalment.service';

@Controller('pmd-instalments')
@UseGuards(JwtAuthGuard)
export class PMDInstalmentController {
  constructor(private readonly pmdService: PMDInstalmentService) {}

  @Post('schedule')
  async createSchedule(
    @Body() body: { affaireId: string; pmdTotal: number; instalments: Array<{ percentage: number; daysFromStart: number }> }
  ) {
    return this.pmdService.createSchedule(body.affaireId, body.pmdTotal, body.instalments);
  }

  @Get('affaire/:affaireId')
  async findByAffaire(@Param('affaireId') affaireId: string) {
    return this.pmdService.findByAffaire(affaireId);
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.pmdService.findOne(id);
  }

  @Patch(':id')
  async update(@Param('id') id: string, @Body() updateDto: UpdatePMDInstalmentDto) {
    return this.pmdService.update(id, updateDto);
  }

  @Post(':id/pay')
  async markAsPaid(
    @Param('id') id: string,
    @Body() body: { montantPaye: number; referencePaiement: string; datePaiement: Date }
  ) {
    return this.pmdService.markAsPaid(id, body.montantPaye, body.referencePaiement, body.datePaiement);
  }

  @Post(':id/reminder')
  async sendReminder(@Param('id') id: string) {
    return this.pmdService.sendReminder(id);
  }

  @Get('check/overdue')
  async checkOverdue() {
    return this.pmdService.checkOverdue();
  }

  @Get('check/due')
  async checkDue() {
    return this.pmdService.checkDue();
  }

  @Delete(':id')
  async delete(@Param('id') id: string) {
    await this.pmdService.delete(id);
    return { message: 'Instalment deleted successfully' };
  }
}
