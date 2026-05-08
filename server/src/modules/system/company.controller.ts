import {
  Controller, Get, Post, Put, Delete, Body, Param, Res, UseGuards,
} from '@nestjs/common';
import { Response } from 'express';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { CompanyService } from './company.service';
import { BackupService } from './backup.service';
import { ImportExportService } from './import-export.service';
import { PrinterService } from './printer.service';
import { CreateCompanyDto } from './dto/create-company.dto';
import { UpdateCompanyDto } from './dto/update-company.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { Permission } from '../../config/permissions.config';

@ApiTags('Système')
@ApiBearerAuth()
@Controller('system')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class CompanyController {
  constructor(
    private companyService: CompanyService,
    private backupService: BackupService,
    private importExport: ImportExportService,
    private printerService: PrinterService,
  ) {}

  // ── Company Profile ──────────────────────────────────────────────
  @Get('company')
  @RequirePermissions(Permission.SYSTEM_READ)
  getProfile() { return this.companyService.getProfile(); }

  @Post('company')
  @RequirePermissions(Permission.SYSTEM_UPDATE)
  createOrUpdate(@Body() dto: CreateCompanyDto) { return this.companyService.createOrUpdate(dto); }

  @Put('company/:id')
  @RequirePermissions(Permission.SYSTEM_UPDATE)
  update(@Param('id') id: string, @Body() dto: UpdateCompanyDto) {
    return this.companyService.update(id, dto);
  }

  // ── Password Policy ──────────────────────────────────────────────
  @Get('password-policy')
  @RequirePermissions(Permission.SYSTEM_READ)
  getPasswordPolicy() { return this.companyService.getPasswordPolicy(); }

  @Put('password-policy')
  @RequirePermissions(Permission.SYSTEM_UPDATE)
  updatePasswordPolicy(@Body() data: any) { return this.companyService.updatePasswordPolicy(data); }

  // ── Backup ───────────────────────────────────────────────────────
  @Post('backup')
  @RequirePermissions(Permission.SYSTEM_UPDATE)
  @ApiOperation({ summary: 'Créer une sauvegarde PostgreSQL' })
  createBackup() { return this.backupService.createBackup(); }

  @Get('backups')
  @RequirePermissions(Permission.SYSTEM_READ)
  listBackups() { return this.backupService.listBackups(); }

  @Get('backup/download/:fileName')
  @RequirePermissions(Permission.SYSTEM_READ)
  downloadBackup(@Param('fileName') fileName: string, @Res() res: Response) {
    const buffer = this.backupService.getBackupFile(fileName);
    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.send(buffer);
  }

  @Delete('backup/:fileName')
  @RequirePermissions(Permission.SYSTEM_UPDATE)
  deleteBackup(@Param('fileName') fileName: string) {
    this.backupService.deleteBackup(fileName);
    return { message: 'Sauvegarde supprimée' };
  }

  // ── Export ───────────────────────────────────────────────────────
  @Get('export/cedantes')
  @RequirePermissions(Permission.DONNEES_READ)
  async exportCedantes(@Res() res: Response) {
    const buffer = await this.importExport.exportCedantes();
    this.sendExcel(res, buffer, 'cedantes.xlsx');
  }

  @Get('export/reassureurs')
  @RequirePermissions(Permission.DONNEES_READ)
  async exportReassureurs(@Res() res: Response) {
    const buffer = await this.importExport.exportReassureurs();
    this.sendExcel(res, buffer, 'reassureurs.xlsx');
  }

  @Get('export/affaires')
  @RequirePermissions(Permission.AFFAIRES_READ)
  async exportAffaires(@Res() res: Response) {
    const buffer = await this.importExport.exportAffaires();
    this.sendExcel(res, buffer, 'affaires.xlsx');
  }

  @Get('export/sinistres')
  @RequirePermissions(Permission.SINISTRES_READ)
  async exportSinistres(@Res() res: Response) {
    const buffer = await this.importExport.exportSinistres();
    this.sendExcel(res, buffer, 'sinistres.xlsx');
  }

  // ── Printers ─────────────────────────────────────────────────────
  @Get('printers')
  @RequirePermissions(Permission.SYSTEM_READ)
  getPrinters() { return this.printerService.getAll(); }

  @Post('printers/:reportType')
  @RequirePermissions(Permission.SYSTEM_UPDATE)
  upsertPrinter(@Param('reportType') reportType: string, @Body() data: any) {
    return this.printerService.upsert(reportType, data);
  }

  @Delete('printers/:id')
  @RequirePermissions(Permission.SYSTEM_UPDATE)
  removePrinter(@Param('id') id: string) { return this.printerService.remove(id); }

  private sendExcel(res: Response, buffer: Buffer, filename: string) {
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(buffer);
  }
}