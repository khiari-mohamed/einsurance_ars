import { Controller, Get, Post, Body, Query, Param, UseGuards } from '@nestjs/common';
import { ReportingService } from './reporting.service';
import { BudgetService, BudgetData, ActualData } from './budget.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('reporting')
@UseGuards(JwtAuthGuard)
export class ReportingController {
  constructor(
    private service: ReportingService,
    private budgetService: BudgetService,
  ) {}

  @Get('dashboard/kpis')
  getKPIs(@Query() filters: { startDate?: string; endDate?: string; cedanteId?: string; reassureurId?: string }) {
    return this.service.getDashboardKPIs(filters);
  }

  @Get('dashboard/ca-evolution')
  getCAEvolution(@Query() filters: { period?: string; year?: number }) {
    return this.service.getCAEvolution(filters);
  }

  @Get('dashboard/ca-cedantes')
  getCACedantes(@Query() filters: { limit?: number; startDate?: string; endDate?: string }) {
    return this.service.getCACedantes(filters);
  }

  @Get('dashboard/ca-reassureurs')
  getCAReassureurs(@Query() filters: { limit?: number; startDate?: string; endDate?: string }) {
    return this.service.getCAReassureurs(filters);
  }

  @Get('dashboard/ca-branches')
  getCABranches(@Query() filters: { startDate?: string; endDate?: string }) {
    return this.service.getCABranches(filters);
  }

  @Get('dashboard/sinistres-trend')
  getSinistresTrend(@Query() filters: { months?: number }) {
    return this.service.getSinistresTrend(filters);
  }

  @Get('dashboard/top-affaires')
  getTopAffaires(@Query() filters: { limit?: number; month?: string }) {
    return this.service.getTopAffaires(filters);
  }

  @Get('dashboard/sinistres-majeurs')
  getSinistresMajeurs(@Query() filters: { minAmount?: number; limit?: number }) {
    return this.service.getSinistresMajeurs(filters);
  }

  @Get('dashboard/echeances')
  getEcheances(@Query() filters: { days?: number }) {
    return this.service.getEcheances(filters);
  }

  @Get('dashboard/alerts')
  getAlerts() {
    return this.service.getAlerts();
  }

  @Get('dashboard/cash-flow')
  getCashFlow(@Query() filters: { startDate?: string; endDate?: string }) {
    return this.service.getCashFlow(filters);
  }

  @Get('dashboard/finance')
  getFinanceDashboard(@Query() filters: { startDate?: string; endDate?: string }) {
    return this.service.getFinanceDashboard(filters);
  }

  @Get('dashboard/export-pdf')
  async exportDashboardPDF(@Query() filters: any) {
    return { message: 'PDF export endpoint - implement with puppeteer or similar' };
  }

  @Get('dashboard/export-excel')
  async exportDashboardExcel(@Query() filters: any) {
    return { message: 'Excel export endpoint - implement with exceljs' };
  }

  @Get('bordereaux/summary')
  getBordereauxSummary(@Query() filters: { startDate?: string; endDate?: string; type?: string }) {
    return this.service.getBordereauxSummary(filters);
  }

  @Get('portfolio/performance')
  getPortfolioPerformance(@Query() filters: { startDate?: string; endDate?: string; groupBy?: string }) {
    return this.service.getPortfolioPerformance(filters);
  }

  @Get('portfolio/concentration')
  getRiskConcentration(@Query() filters: { type?: string }) {
    return this.service.getRiskConcentration(filters);
  }

  @Get('reinsurers/performance')
  getReinsurersPerformance(@Query() filters: { startDate?: string; endDate?: string }) {
    return this.service.getReinsurersPerformance(filters);
  }

  @Get('sap/report')
  getSAPReport(@Query() filters: { startDate?: string; endDate?: string }) {
    return this.service.getSAPReport(filters);
  }

  @Get('production/monthly')
  getMonthlyProduction(@Query() filters: { year?: number; month?: number }) {
    return this.service.getMonthlyProduction(filters);
  }

  @Get('commissions/analysis')
  getCommissionAnalysis(@Query() filters: { startDate?: string; endDate?: string }) {
    return this.service.getCommissionAnalysis(filters);
  }

  @Get('cedantes/performance')
  getCedantesPerformance(@Query() filters: { startDate?: string; endDate?: string }) {
    return this.service.getCedantesPerformance(filters);
  }

  @Get('branches/analysis')
  getBranchesAnalysis(@Query() filters: { startDate?: string; endDate?: string }) {
    return this.service.getBranchesAnalysis(filters);
  }

  @Get('payment/aging')
  getPaymentAging(@Query() filters: { type?: string }) {
    return this.service.getPaymentAging(filters);
  }

  // Budget endpoints
  @Get('budget/:year')
  getBudget(@Param('year') year: string): Promise<BudgetData> {
    return this.budgetService.getBudget(parseInt(year));
  }

  @Post('budget/:year')
  saveBudget(@Param('year') year: string, @Body() budgetData: any): Promise<BudgetData> {
    return this.budgetService.saveBudget(parseInt(year), budgetData);
  }

  @Get('actual/:year')
  getActual(@Param('year') year: string): Promise<ActualData> {
    return this.budgetService.getActual(parseInt(year));
  }

  @Get('variance/:year')
  getVarianceAnalysis(@Param('year') year: string) {
    return this.budgetService.getVarianceAnalysis(parseInt(year));
  }

  @Get('quarterly/:year/:quarter')
  getQuarterlyReport(@Param('year') year: string, @Param('quarter') quarter: string) {
    return this.budgetService.getQuarterlyReport(parseInt(year), parseInt(quarter));
  }
}
