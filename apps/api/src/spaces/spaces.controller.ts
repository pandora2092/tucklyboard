import {
  Body,
  Controller,
  Delete,
  Get,
  Inject,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import type { User } from '@prisma/client';
import { z } from 'zod';

import {
  CreateInviteSchema,
  CreateSpaceSchema,
  CreateStatusSchema,
  DeleteStatusSchema,
  ReorderStatusesSchema,
  UpdateSpaceSchema,
  UpdateStatusSchema,
} from '@tuckly/contracts';

import { AuthGuard, CurrentUser } from '../auth/auth.guard';
import { parse } from '../common/validation';

import { SpacesService } from './spaces.service';
import { StatusesService } from './statuses.service';

@Controller('api')
@UseGuards(AuthGuard)
export class SpacesController {
  constructor(
    @Inject(SpacesService) private readonly spaces: SpacesService,
    @Inject(StatusesService) private readonly statuses: StatusesService,
  ) {}
  @Get('spaces/:id/statuses') statusList(@CurrentUser() user: User, @Param('id') id: string) {
    return this.statuses.list(user, id);
  }
  @Post('spaces/:id/statuses') statusCreate(
    @CurrentUser() user: User,
    @Param('id') id: string,
    @Body() body: unknown,
  ) {
    return this.statuses.create(user, id, parse(CreateStatusSchema, body));
  }
  @Patch('spaces/:id/statuses/order') statusOrder(
    @CurrentUser() user: User,
    @Param('id') id: string,
    @Body() body: unknown,
  ) {
    return this.statuses.reorder(user, id, parse(ReorderStatusesSchema, body).keys);
  }
  @Patch('spaces/:id/statuses/:key') statusUpdate(
    @CurrentUser() user: User,
    @Param('id') id: string,
    @Param('key') key: string,
    @Body() body: unknown,
  ) {
    return this.statuses.update(user, id, key, parse(UpdateStatusSchema, body));
  }
  @Delete('spaces/:id/statuses/:key') statusDelete(
    @CurrentUser() user: User,
    @Param('id') id: string,
    @Param('key') key: string,
    @Body() body: unknown,
  ) {
    return this.statuses.remove(
      user,
      id,
      key,
      parse(DeleteStatusSchema, body ?? {}).replacementKey,
    );
  }
  @Get('spaces') list(@CurrentUser() user: User) {
    return this.spaces.list(user);
  }
  @Post('spaces') create(@CurrentUser() user: User, @Body() body: unknown) {
    return this.spaces.create(user, parse(CreateSpaceSchema, body).name);
  }
  @Patch('spaces/:id') update(
    @CurrentUser() user: User,
    @Param('id') id: string,
    @Body() body: unknown,
  ) {
    return this.spaces.updateTheme(user, id, parse(UpdateSpaceSchema, body).theme);
  }
  @Get('spaces/:id/members') members(@CurrentUser() user: User, @Param('id') id: string) {
    return this.spaces.members(user, id);
  }
  @Patch('spaces/:id/members/:userId') role(
    @CurrentUser() user: User,
    @Param('id') id: string,
    @Param('userId') userId: string,
    @Body() body: unknown,
  ) {
    return this.spaces.changeRole(
      user,
      id,
      userId,
      parse(z.object({ role: z.enum(['editor', 'viewer']) }).strict(), body).role,
    );
  }
  @Delete('spaces/:id/members/:userId') remove(
    @CurrentUser() user: User,
    @Param('id') id: string,
    @Param('userId') userId: string,
  ) {
    return this.spaces.removeMember(user, id, userId);
  }
  @Post('spaces/:id/invites') invite(
    @CurrentUser() user: User,
    @Param('id') id: string,
    @Body() body: unknown,
  ) {
    const data = parse(CreateInviteSchema, body);
    return this.spaces.invite(user, id, data.role, data.days);
  }
  @Get('spaces/:id/invites') invites(@CurrentUser() user: User, @Param('id') id: string) {
    return this.spaces.invites(user, id);
  }
  @Post('spaces/:id/invites/:inviteId/revoke') revoke(
    @CurrentUser() user: User,
    @Param('id') id: string,
    @Param('inviteId') inviteId: string,
  ) {
    return this.spaces.revoke(user, id, inviteId);
  }
  @Delete('spaces/:id/invites/:inviteId') deleteInvite(
    @CurrentUser() user: User,
    @Param('id') id: string,
    @Param('inviteId') inviteId: string,
  ) {
    return this.spaces.deleteInvite(user, id, inviteId);
  }
  @Get('invites/:token') info(@Param('token') token: string) {
    return this.spaces.inviteInfo(token);
  }
  @Post('invites/:token/join') join(@CurrentUser() user: User, @Param('token') token: string) {
    return this.spaces.join(user, token);
  }
}
