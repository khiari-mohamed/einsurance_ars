import {
  Controller, Get, Post, Patch, Body, Param, Query, UseGuards,
  DefaultValuePipe, ParseIntPipe, ParseBoolPipe,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { WorkflowTaskStatut, WorkflowTaskType } from '@prisma/client';
import { WorkflowEngineService } from './workflow-engine.service';
import { CreateWorkflowTaskDto } from './dto/create-workflow-task.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Permission } from '../../config/permissions.config';

@ApiTags('Workflow')
@ApiBearerAuth()
@Controller('workflow')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class WorkflowController {
  constructor(private engine: WorkflowEngineService) {}

  @Get('tasks')
  @RequirePermissions(Permission.AFFAIRES_READ)
  @ApiQuery({ name: 'type', required: false, enum: WorkflowTaskType })
  @ApiQuery({ name: 'statut', required: false, enum: WorkflowTaskStatut })
  @ApiQuery({ name: 'affaireId', required: false })
  @ApiQuery({ name: 'mine', required: false })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  getTasks(
    @CurrentUser() user: any,
    @Query('type') type?: WorkflowTaskType,
    @Query('statut') statut?: WorkflowTaskStatut,
    @Query('affaireId') affaireId?: string,
    // FIX (Workflow pass): `@Query('mine') mine?: boolean` previously
    // received the raw STRING "true"/"false" — both truthy in JS, so
    // `mine=false` behaved identically to `mine=true`, silently scoping
    // every caller to their own tasks regardless of what was requested.
    @Query('mine', new DefaultValuePipe(false), ParseBoolPipe) mine?: boolean,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page?: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit?: number,
  ) {
    return this.engine.getTasks({
      assignedToId: mine ? user.id : undefined,
      type, statut, affaireId, page, limit,
    });
  }

  @Get('audit-history')
  @RequirePermissions(Permission.AFFAIRES_READ)
  @ApiOperation({ summary: "Historique du cycle de vie des affaires (audit trail)" })
  @ApiQuery({ name: 'affaireId', required: false })
  @ApiQuery({ name: 'entityType', required: false, description: 'Défaut: Affaire' })
  @ApiQuery({ name: 'action', required: false })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  getAuditHistory(
    @Query('affaireId') affaireId?: string,
    @Query('entityType') entityType?: string,
    @Query('action') action?: string,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page?: number,
    @Query('limit', new DefaultValuePipe(30), ParseIntPipe) limit?: number,
  ) {
    return this.engine.getAuditHistory({ affaireId, entityType, action, page, limit });
  }

  @Post('tasks')
  @RequirePermissions(Permission.AFFAIRES_UPDATE)
  @ApiOperation({ summary: 'Créer une tâche manuellement (ex: transfert inter-service)' })
  createTask(@Body() dto: CreateWorkflowTaskDto, @CurrentUser() user: any) {
    return this.engine.createTask(dto, user.id);
  }

  @Patch('tasks/:id/assign')
  @RequirePermissions(Permission.AFFAIRES_UPDATE)
  @ApiOperation({ summary: 'Assigner une tâche à un utilisateur' })
  assign(@Param('id') id: string, @Body('userId') userId: string, @CurrentUser() user: any) {
    return this.engine.assignTask(id, userId, user.id);
  }

  // FIX (Workflow pass, new): self-service "take this task" — uses the
  // JWT-derived current user (same `@CurrentUser()` pattern as `mine=true`
  // above), avoiding the need for a user-picker UI backed by an unreviewed
  // /users list endpoint.
  @Patch('tasks/:id/claim')
  @RequirePermissions(Permission.AFFAIRES_UPDATE)
  @ApiOperation({ summary: 'Prendre en charge une tâche non assignée' })
  claim(@Param('id') id: string, @CurrentUser() user: any) {
    return this.engine.assignTask(id, user.id, user.id);
  }

  @Patch('tasks/:id/complete')
  @RequirePermissions(Permission.AFFAIRES_UPDATE)
  @ApiOperation({ summary: 'Marquer une tâche comme terminée' })
  complete(@Param('id') id: string, @Body('note') note: string, @CurrentUser() user: any) {
    return this.engine.completeTask(id, user.id, note);
  }

  @Patch('tasks/:id/cancel')
  @RequirePermissions(Permission.AFFAIRES_VALIDATE)
  cancel(@Param('id') id: string, @CurrentUser() user: any) {
    return this.engine.cancelTask(id, user.id);
  }
}