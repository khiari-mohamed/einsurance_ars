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

  // ── Dashboard ─────────────────────────────────────────────────

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

  // ── Chiffre d'affaires / Primes aging / Budget vs actual ─────

  @Get('chiffre-affaires')
  @RequirePermissions(Permission.REPORTING_READ)
  @ApiQuery({ name: 'mode', required: false })
  @ApiQuery({ name: 'period', required: false })
  getChiffreAffaires(@Query('mode') mode?: string, @Query('period') period?: string) {
    return this.reporting.getChiffreAffaires(mode, period);
  }

  @Get('primes-aging')
  @RequirePermissions(Permission.REPORTING_READ)
  @ApiQuery({ name: 'period', required: false })
  getPrimesAging(@Query('period') period?: string) {
    return this.reporting.getPrimesAging(period);
  }

  @Get('budget-vs-actual')
  @RequirePermissions(Permission.REPORTING_READ)
  @ApiQuery({ name: 'period', required: false })
  getBudgetVsActual(@Query('period') period?: string) {
    return this.reporting.getBudgetVsActual(period);
  }

  // ── Portfolio ─────────────────────────────────────────────────

  @Get('portfolio/performance')
  @RequirePermissions(Permission.REPORTING_READ)
  @ApiQuery({ name: 'startDate', required: false })
  @ApiQuery({ name: 'endDate', required: false })
  @ApiQuery({ name: 'groupBy', required: false })
  getPortfolioPerformance(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('groupBy') groupBy?: string,
  ) { return this.reporting.getPortfolioPerformance({ startDate, endDate, groupBy }); }

  @Get('portfolio/concentration')
  @RequirePermissions(Permission.REPORTING_READ)
  @ApiQuery({ name: 'type', required: false })
  getRiskConcentration(@Query('type') type?: string) {
    return this.reporting.getRiskConcentration(type);
  }

  // ── Reinsurers ────────────────────────────────────────────────

  @Get('reinsurers/performance')
  @RequirePermissions(Permission.REPORTING_READ)
  @ApiQuery({ name: 'startDate', required: false })
  @ApiQuery({ name: 'endDate', required: false })
  getReinsurersPerformance(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) { return this.reporting.getReinsurersPerformance({ startDate, endDate }); }

  // ── SAP Report ────────────────────────────────────────────────

  @Get('sap/report')
  @RequirePermissions(Permission.REPORTING_READ)
  @ApiQuery({ name: 'startDate', required: false })
  @ApiQuery({ name: 'endDate', required: false })
  getSAPReport(@Query('startDate') startDate?: string, @Query('endDate') endDate?: string) {
    return this.reporting.getSAPReport({ startDate, endDate });
  }

  // ── Production monthly ────────────────────────────────────────

  @Get('production/monthly')
  @RequirePermissions(Permission.REPORTING_READ)
  @ApiQuery({ name: 'year', required: false })
  @ApiQuery({ name: 'month', required: false })
  getMonthlyProduction(@Query('year') year?: number, @Query('month') month?: number) {
    return this.reporting.getMonthlyProduction(year, month);
  }

  // ── Commissions analysis ──────────────────────────────────────

  @Get('commissions/analysis')
  @RequirePermissions(Permission.REPORTING_READ)
  @ApiQuery({ name: 'startDate', required: false })
  @ApiQuery({ name: 'endDate', required: false })
  getCommissionAnalysis(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) { return this.reporting.getCommissionAnalysis({ startDate, endDate }); }

  // ── Cedantes performance ──────────────────────────────────────

  @Get('cedantes/performance')
  @RequirePermissions(Permission.REPORTING_READ)
  @ApiQuery({ name: 'startDate', required: false })
  @ApiQuery({ name: 'endDate', required: false })
  getCedantesPerformance(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) { return this.reporting.getCedantesPerformance({ startDate, endDate }); }

  // ── Branches analysis ─────────────────────────────────────────

  @Get('branches/analysis')
  @RequirePermissions(Permission.REPORTING_READ)
  @ApiQuery({ name: 'startDate', required: false })
  @ApiQuery({ name: 'endDate', required: false })
  getBranchesAnalysis(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) { return this.reporting.getBranchesAnalysis({ startDate, endDate }); }

  // ── Payment aging ─────────────────────────────────────────────

  @Get('payment/aging')
  @RequirePermissions(Permission.REPORTING_READ)
  @ApiQuery({ name: 'type', required: false })
  getPaymentAging(@Query('type') type?: string) {
    return this.reporting.getPaymentAging(type);
  }

  // ── Portfolio / bordereaux summary ────────────────────────────

  @Get('bordereaux/summary')
  @RequirePermissions(Permission.REPORTING_READ)
  @ApiQuery({ name: 'startDate', required: false })
  @ApiQuery({ name: 'endDate', required: false })
  @ApiQuery({ name: 'type', required: false })
  getBordereauxSummary(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('type') type?: string,
  ) { return this.reporting.getBordereauxSummary({ startDate, endDate, type }); }

  // ── Cedante / Reassureur statements ───────────────────────────

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

  // ── Annual report ─────────────────────────────────────────────

  @Get('annual/:year')
  @RequirePermissions(Permission.REPORTING_READ)
  @ApiOperation({ summary: 'Rapport annuel exportable — Direction Générale' })
  getAnnualReport(@Param('year') year: number) { return this.reporting.getAnnualReport(year); }

  // ── Budget ────────────────────────────────────────────────────

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
