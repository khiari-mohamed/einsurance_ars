import { Controller, Get, Post, Param, Body, UseGuards } from '@nestjs/common';
import { SinistreIntegrationService } from './sinistre-integration.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('ged/sinistre')
@UseGuards(JwtAuthGuard)
export class GedSinistreController {
  constructor(private sinistreService: SinistreIntegrationService) {}

  @Get(':sinistreId/documents')
  async getSinistreDocuments(@Param('sinistreId') sinistreId: string) {
    return this.sinistreService.getSinistreDocuments(sinistreId);
  }

  @Post(':sinistreId/link-affaire')
  async linkSinistreToAffaire(
    @Param('sinistreId') sinistreId: string,
    @Body('affaireId') affaireId: string,
  ) {
    await this.sinistreService.linkSinistreToAffaire(sinistreId, affaireId);
    return { message: 'Sinistre linked to affaire successfully' };
  }
}
