import { Controller, Get, Patch, Post, Body, Param, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { DocumentChecklistService } from './document-checklist.service';
import { AffaireStatus } from '../affaires/affaires.entity';

@Controller('document-checklist')
@UseGuards(JwtAuthGuard)
export class DocumentChecklistController {
  constructor(private readonly checklistService: DocumentChecklistService) {}

  @Get('affaire/:affaireId')
  async getChecklist(@Param('affaireId') affaireId: string) {
    return this.checklistService.getChecklist(affaireId);
  }

  @Patch('affaire/:affaireId')
  async updateChecklist(
    @Param('affaireId') affaireId: string,
    @Body() updates: Record<string, boolean>
  ) {
    return this.checklistService.updateChecklist(affaireId, updates);
  }

  @Post('affaire/:affaireId/validate')
  async validateForStatusChange(
    @Param('affaireId') affaireId: string,
    @Body() body: { newStatus: AffaireStatus }
  ) {
    return this.checklistService.validateForStatusChange(affaireId, body.newStatus);
  }

  @Post('affaire/:affaireId/initialize')
  async initializeChecklist(@Param('affaireId') affaireId: string) {
    await this.checklistService.initializeChecklist(affaireId);
    return { message: 'Checklist initialized successfully' };
  }

  @Post('summary')
  async getCompletionSummary(@Body() body: { affaireIds: string[] }) {
    return this.checklistService.getCompletionSummary(body.affaireIds);
  }
}
