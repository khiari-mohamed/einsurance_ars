import {
  Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { ExchangeRatesService } from './exchange-rates.service';
import { BctSyncService } from './bct-sync.service';
import { CreateRateDto, CreateCurrencyDto } from './dto/create-rate.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { Permission } from '../../config/permissions.config';

@ApiTags('Cours de change')
@ApiBearerAuth()
@Controller('exchange-rates')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class ExchangeRatesController {
  constructor(
    private exchangeRates: ExchangeRatesService,
    private bctSync: BctSyncService,
  ) {}

  @Get('currencies')
  @RequirePermissions(Permission.DONNEES_READ)
  getCurrencies() { return this.exchangeRates.getCurrencies(); }

  @Post('currencies')
  @RequirePermissions(Permission.DONNEES_CREATE)
  createCurrency(@Body() dto: CreateCurrencyDto) { return this.exchangeRates.createCurrency(dto); }

  @Get()
  @RequirePermissions(Permission.DONNEES_READ)
  @ApiQuery({ name: 'currencyCode', required: false })
  @ApiQuery({ name: 'dateFrom', required: false })
  @ApiQuery({ name: 'dateTo', required: false })
  getRates(
    @Query('currencyCode') currencyCode?: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
  ) { return this.exchangeRates.getRates(currencyCode, dateFrom, dateTo); }

  @Get('latest/:currencyCode')
  @RequirePermissions(Permission.DONNEES_READ)
  getLatest(@Param('currencyCode') code: string) { return this.exchangeRates.getLatestRate(code); }

  @Post()
  @RequirePermissions(Permission.DONNEES_CREATE)
  create(@Body() dto: CreateRateDto) { return this.exchangeRates.createRate(dto); }

  @Put(':id/settlement-rate')
  @RequirePermissions(Permission.DONNEES_UPDATE)
  updateSettlement(@Param('id') id: string, @Body('taux') taux: number) {
    return this.exchangeRates.updateSettlementRate(id, taux);
  }

  @Delete(':id')
  @RequirePermissions(Permission.DONNEES_DELETE)
  delete(@Param('id') id: string) { return this.exchangeRates.deleteRate(id); }

  @Post('sync/bct')
  @RequirePermissions(Permission.SYSTEM_UPDATE)
  syncBct() { return this.bctSync.fetchBctRates(); }
}