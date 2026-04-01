import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards, Request } from '@nestjs/common';
import { ComptabiliteService } from './comptabilite.service';
import { AuxiliaryAccountService } from './auxiliary-account.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CreateAccountDto } from './dto/create-account.dto';
import { UpdateAccountDto } from './dto/update-account.dto';
import { ClosePeriodDto } from './dto/close-period.dto';
import { AccountClass } from './plan-comptable.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JournalEntry } from './journal-entry.entity';

@Controller('comptabilite')
@UseGuards(JwtAuthGuard)
export class ComptabiliteController {
  constructor(
    private service: ComptabiliteService,
    private auxService: AuxiliaryAccountService,
    @InjectRepository(JournalEntry) private journalRepo: Repository<JournalEntry>,
  ) {}

  @Post('accounts')
  createAccount(@Body() dto: CreateAccountDto) {
    return this.service.createAccount(dto);
  }

  @Get('accounts')
  findAllAccounts(@Query('classe') classe?: AccountClass, @Query('isActive') isActive?: string) {
    return this.service.findAllAccounts({
      classe,
      isActive: isActive === 'true' ? true : isActive === 'false' ? false : undefined,
    });
  }

  @Get('accounts/:id')
  findOneAccount(@Param('id') id: string) {
    return this.service.findOneAccount(id);
  }

  @Put('accounts/:id')
  updateAccount(@Param('id') id: string, @Body() dto: UpdateAccountDto) {
    return this.service.updateAccount(id, dto);
  }

  @Delete('accounts/:id')
  deleteAccount(@Param('id') id: string) {
    return this.service.deleteAccount(id);
  }

  @Get('ledger/:accountCode')
  getLedger(
    @Param('accountCode') accountCode: string,
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
  ) {
    return this.service.getLedger(accountCode, startDate, endDate);
  }

  @Get('trial-balance')
  getTrialBalance(@Query('exercice') exercice: string, @Query('mois') mois?: string) {
    return this.service.getTrialBalance(parseInt(exercice), mois ? parseInt(mois) : undefined);
  }

  @Get('balance-sheet')
  getBalanceSheet(@Query('exercice') exercice: string) {
    return this.service.getBalanceSheet(parseInt(exercice));
  }

  @Get('profit-loss')
  getProfitLoss(@Query('exercice') exercice: string) {
    return this.service.getProfitLoss(parseInt(exercice));
  }

  @Get('periods/current')
  getCurrentPeriod() {
    return this.service.getCurrentPeriod();
  }

  @Post('periods/close')
  closePeriod(@Body() dto: ClosePeriodDto, @Request() req) {
    return this.service.closePeriod(dto, req.user.id);
  }

  @Post('periods/reopen')
  reopenPeriod(@Body() dto: ClosePeriodDto) {
    return this.service.reopenPeriod(dto);
  }



  @Get('journal-entries')
  async getJournalEntries(
    @Query('journalType') journalType?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    const where: any = {};
    if (journalType) where.journalType = journalType;
    return this.journalRepo.find({ where, relations: ['lines'], order: { entryDate: 'DESC' } });
  }

  @Get('journal-entries/:id')
  getJournalEntry(@Param('id') id: string) {
    return this.journalRepo.findOne({ where: { id }, relations: ['lines'] });
  }

  @Post('journal-entries/:id/validate')
  async validateJournalEntry(
    @Param('id') id: string,
    @Body() body: { notes?: string },
    @Request() req
  ) {
    const entry = await this.journalRepo.findOne({ where: { id } });
    if (!entry) throw new Error('Entry not found');
    
    entry.status = 'valide' as any;
    entry.validatedById = req.user.userId;
    entry.validatedAt = new Date();
    entry.validationNotes = body.notes;
    entry.historique = [
      ...(entry.historique || []),
      {
        date: new Date(),
        action: 'Validated',
        user: req.user.userId,
        oldStatus: 'brouillon',
        newStatus: 'valide',
        notes: body.notes,
      },
    ];
    
    return this.journalRepo.save(entry);
  }

  @Get('journal-entries/export/integration')
  async exportIntegrationFile(
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
    @Query('format') format: 'txt' | 'excel' = 'txt'
  ) {
    const entries = await this.journalRepo.find({
      where: { status: 'valide' as any, exported: false },
      relations: ['lines'],
      order: { entryDate: 'ASC' },
    });

    // Mark as exported
    for (const entry of entries) {
      entry.exported = true;
      entry.exportedAt = new Date();
      await this.journalRepo.save(entry);
    }

    return {
      format,
      count: entries.length,
      entries: entries.map(e => ({
        reference: e.reference,
        date: e.entryDate,
        description: e.description,
        lines: e.lines.map(l => ({
          accountCode: l.accountNumber,
          debit: l.debit,
          credit: l.credit,
          label: l.description,
        })),
      })),
    };
  }

  @Get('auxiliary-accounts')
  getAuxiliaryAccounts() {
    return this.auxService.findAll();
  }

  @Post('auxiliary-accounts/cedante')
  createCedanteAccount(@Body() data: { cedanteId: string; cedanteName: string }) {
    return this.auxService.createForCedante(data.cedanteId, data.cedanteName);
  }

  @Post('auxiliary-accounts/reassureur')
  createReassureurAccount(@Body() data: { reassureurId: string; reassureurName: string }) {
    return this.auxService.createForReassureur(data.reassureurId, data.reassureurName);
  }
}
