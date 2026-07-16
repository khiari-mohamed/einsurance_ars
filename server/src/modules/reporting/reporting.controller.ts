import {
  Controller, Get, Post, Query, Param, Body, UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { ReportingService } from './reporting.service';
import { DashboardService } from './dashboard.service';
import { BudgetService } from './budget.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { Permission } from '../../config/permissions.config';

@ApiTags('Reporting & Dashboard')
@ApiBearerAuth()
@Controller('reporting')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class ReportingController {
  constructor(
    private reporting: ReportingService,
    private dashboard: DashboardService,
    private budget: BudgetService,
  ) {}

  @Get('dashboard/summary')
  @RequirePermissions(Permission.REPORTING_READ)
  getSummary() { return this.dashboard.getSummary(); }

  @Get('dashboard/kpis')
  @RequirePermissions(Permission.REPORTING_READ)
  @ApiQuery({ name: 'startDate', required: false })
  @ApiQuery({ name: 'endDate', required: false })
  @ApiQuery({ name: 'cedanteId', required: false })
  @ApiQuery({ name: 'reassureurId', required: false })
  getKPIs(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('cedanteId') cedanteId?: string,
    @Query('reassureurId') reassureurId?: string,
  ) {
    return this.dashboard.getKPIs({ startDate, endDate, cedanteId, reassureurId });
  }

  @Get('dashboard/ca-evolution')
  @RequirePermissions(Permission.REPORTING_READ)
  getCAEvolution() { return this.dashboard.getCAEvolution(); }

  @Get('dashboard/ca-cedantes')
  @RequirePermissions(Permission.REPORTING_READ)
  @ApiQuery({ name: 'limit', required: false })
  getCACedantes(@Query('limit') limit?: number) {
    return this.dashboard.getCACedantes(limit);
  }

  @Get('dashboard/ca-reassureurs')
  @RequirePermissions(Permission.REPORTING_READ)
  @ApiQuery({ name: 'limit', required: false })
  getCAReassureurs(@Query('limit') limit?: number) {
    return this.dashboard.getCAReassureurs(limit);
  }

  @Get('dashboard/sinistres-trend')
  @RequirePermissions(Permission.REPORTING_READ)
  @ApiQuery({ name: 'months', required: false })
  getSinistresTrend(@Query('months') months?: number) {
    return this.dashboard.getSinistresTrend(months);
  }

  @Get('dashboard/top-affaires')
  @RequirePermissions(Permission.REPORTING_READ)
  @ApiQuery({ name: 'limit', required: false })
  getTopAffaires(@Query('limit') limit?: number) {
    return this.dashboard.getTopAffaires(limit);
  }

  @Get('dashboard/sinistres-majeurs')
  @RequirePermissions(Permission.REPORTING_READ)
  @ApiQuery({ name: 'minAmount', required: false })
  @ApiQuery({ name: 'limit', required: false })
  getSinistresMajeurs(
    @Query('minAmount') minAmount?: number,
    @Query('limit') limit?: number,
  ) {
    return this.dashboard.getSinistresMajeurs(minAmount, limit);
  }

  @Get('dashboard/echeances')
  @RequirePermissions(Permission.REPORTING_READ)
  @ApiQuery({ name: 'days', required: false })
  getEcheances(@Query('days') days?: number) {
    return this.dashboard.getEcheances(days);
  }

  @Get('dashboard/alerts')
  @RequirePermissions(Permission.REPORTING_READ)
  getAlerts() { return this.dashboard.getAlerts(); }

  @Get('dashboard/cash-flow')
  @RequirePermissions(Permission.REPORTING_READ)
  @ApiQuery({ name: 'startDate', required: false })
  @ApiQuery({ name: 'endDate', required: false })
  getCashFlow(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.dashboard.getCashFlow({ startDate, endDate });
  }

  @Get('dashboard/finance')
  @RequirePermissions(Permission.REPORTING_READ)
  @ApiQuery({ name: 'startDate', required: false })
  @ApiQuery({ name: 'endDate', required: false })
  getFinanceDashboard(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.dashboard.getFinanceDashboard({ startDate, endDate });
  }

  @Get('dashboard/panel1')
  @RequirePermissions(Permission.REPORTING_READ)
  @ApiQuery({ name: 'year', required: false })
  getPanel1(@Query('year') year?: number) { return this.dashboard.getPanel1Ca(year); }

  @Get('dashboard/panel2')
  @RequirePermissions(Permission.REPORTING_READ)
  @ApiQuery({ name: 'year', required: false })
  getPanel2(@Query('year') year?: number) { return this.dashboard.getPanel2Primes(year); }

  @Get('dashboard/panel3')
  @RequirePermissions(Permission.REPORTING_READ)
  @ApiQuery({ name: 'year', required: false })
  @ApiQuery({ name: 'cedanteId', required: false })
  getPanel3(@Query('year') year?: number, @Query('cedanteId') cedanteId?: string) {
    return this.dashboard.getPanel3Budget(year, cedanteId);
  }

  @Get('dashboard/panel4')
  @RequirePermissions(Permission.REPORTING_READ)
  @ApiQuery({ name: 'year', required: false })
  @ApiQuery({ name: 'quarter', required: false })
  getPanel4(@Query('year') year?: number, @Query('quarter') quarter?: number) {
    return this.dashboard.getPanel4QuarterlyReport(year, quarter);
  }

  @Get('cedante/:cedanteId')
  @RequirePermissions(Permission.REPORTING_READ)
  @ApiQuery({ name: 'year', required: false })
  getCedanteStatement(@Param('cedanteId') cedanteId: string, @Query('year') year?: number) {
    return this.reporting.getCedanteStatement(cedanteId, year ?? new Date().getFullYear());
  }

  @Get('reassureur/:code')
  @RequirePermissions(Permission.REPORTING_READ)
  @ApiQuery({ name: 'year', required: false })
  getReassureurStatement(@Param('code') code: string, @Query('year') year?: number) {
    return this.reporting.getReassureurStatement(code, year ?? new Date().getFullYear());
  }

  @Get('annual/:year')
  @RequirePermissions(Permission.REPORTING_READ)
  @ApiOperation({ summary: 'Rapport annuel exportable — Direction Générale' })
  getAnnualReport(@Param('year') year: number) { return this.reporting.getAnnualReport(year); }

  @Get('budget')
  @RequirePermissions(Permission.REPORTING_READ)
  @ApiQuery({ name: 'year', required: false })
  getBudget(@Query('year') year?: number) { return this.budget.getTargets(year); }

  @Post('budget/target')
  @RequirePermissions(Permission.FINANCES_APPROVE)
  setTarget(@Body() data: any) { return this.budget.setTarget(data); }

  @Post('budget/refresh/:year')
  @RequirePermissions(Permission.FINANCES_APPROVE)
  @ApiOperation({ summary: 'Mettre à jour les réalisations vs objectifs budgétaires' })
  refreshActuals(@Param('year') year: number) { return this.budget.refreshActuals(year); }
}