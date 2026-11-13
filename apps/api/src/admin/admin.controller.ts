import { Controller, Get, Inject, Param, Query, UseGuards } from '@nestjs/common';

import { AdminQuerySchema } from '@tuckly/contracts';

import { AdminGuard } from '../auth/admin.guard';
import { parse } from '../common/validation';

import { AdminService } from './admin.service';

@Controller('api/admin')
@UseGuards(AdminGuard)
export class AdminController {
  constructor(@Inject(AdminService) private readonly admin: AdminService) {}
  @Get('overview') overview() {
    return this.admin.overview();
  }
  @Get('users') users(@Query() query: unknown) {
    return this.admin.users(parse(AdminQuerySchema, query));
  }
  @Get('users/:id') user(@Param('id') id: string) {
    return this.admin.user(id);
  }
}
