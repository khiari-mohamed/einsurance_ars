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