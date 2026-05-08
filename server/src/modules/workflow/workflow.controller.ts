import {
  Controller, Get, Patch, Body, Param, Query, UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { WorkflowTaskStatut, WorkflowTaskType } from '@prisma/client';
import { WorkflowEngineService } from './workflow-engine.service';
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
  getTasks(
    @CurrentUser() user: any,
    @Query('type') type?: WorkflowTaskType,
    @Query('statut') statut?: WorkflowTaskStatut,
    @Query('affaireId') affaireId?: string,
    @Query('mine') mine?: boolean,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.engine.getTasks({
      assignedToId: mine ? user.id : undefined,
      type, statut, affaireId, page, limit,
    });
  }

  @Patch('tasks/:id/assign')
  @RequirePermissions(Permission.AFFAIRES_UPDATE)
  @ApiOperation({ summary: 'Assigner une tâche à un utilisateur' })
  assign(@Param('id') id: string, @Body('userId') userId: string) {
    return this.engine.assignTask(id, userId);
  }

  @Patch('tasks/:id/complete')
  @RequirePermissions(Permission.AFFAIRES_UPDATE)
  @ApiOperation({ summary: 'Marquer une tâche comme terminée' })
  complete(@Param('id') id: string, @Body('note') note: string, @CurrentUser() user: any) {
    return this.engine.completeTask(id, user.id, note);
  }

  @Patch('tasks/:id/cancel')
  @RequirePermissions(Permission.AFFAIRES_VALIDATE)
  cancel(@Param('id') id: string) { return this.engine.cancelTask(id); }
}