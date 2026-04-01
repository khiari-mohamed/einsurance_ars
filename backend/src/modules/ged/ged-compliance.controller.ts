import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { ComplianceService } from './compliance.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { EntityType } from './document.entity';

@Controller('ged/compliance')
@UseGuards(JwtAuthGuard)
export class GedComplianceController {
  constructor(private complianceService: ComplianceService) {}

  @Get(':entityType/:entityId')
  async checkCompliance(
    @Param('entityType') entityType: EntityType,
    @Param('entityId') entityId: string,
  ) {
    return this.complianceService.checkCompliance(entityType, entityId);
  }

  @Get('reports/missing-documents')
  async getMissingDocumentsReport() {
    return this.complianceService.getMissingDocumentsReport();
  }
}
