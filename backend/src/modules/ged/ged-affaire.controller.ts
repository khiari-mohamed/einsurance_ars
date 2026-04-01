import { Controller, Get, Post, Param, Body, UseGuards } from '@nestjs/common';
import { AffaireIntegrationService } from './affaire-integration.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('ged/affaire')
@UseGuards(JwtAuthGuard)
export class GedAffaireController {
  constructor(private affaireService: AffaireIntegrationService) {}

  @Get(':affaireId/documents')
  async getAffaireDocuments(@Param('affaireId') affaireId: string) {
    return this.affaireService.getAffaireDocuments(affaireId);
  }

  @Post(':affaireId/link-document')
  async linkDocumentToAffaire(
    @Param('affaireId') affaireId: string,
    @Body('documentId') documentId: string,
  ) {
    await this.affaireService.linkDocumentToAffaire(documentId, affaireId);
    return { message: 'Document linked to affaire successfully' };
  }
}
