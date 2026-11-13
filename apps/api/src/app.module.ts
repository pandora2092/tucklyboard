import { Controller, Get, Inject, Module, UseGuards } from '@nestjs/common';
import type { User } from '@prisma/client';

import { AdminModule } from './admin/admin.module';
import { isAdmin } from './auth/admin-access';
import { AuthGuard, CurrentUser } from './auth/auth.guard';
import { AuthModule } from './auth/auth.module';
import { CatalogueModule } from './catalogue/catalogue.module';
import { SpacesModule } from './spaces/spaces.module';
import { TelegramMedia } from './telegram/telegram-media.service';
import { TelegramModule } from './telegram/telegram.module';

@Controller('api')
class AppController {
  constructor(@Inject(TelegramMedia) private readonly telegram: TelegramMedia) {}
  @Get('health') health() {
    return { ok: true };
  }
  @Get('me') @UseGuards(AuthGuard) me(@CurrentUser() user: User) {
    return {
      ...user,
      isAdmin: isAdmin(user.telegramId),
      telegramMediaEnabled: this.telegram.configured,
    };
  }
}
@Module({
  imports: [AuthModule, TelegramModule, CatalogueModule, SpacesModule, AdminModule],
  controllers: [AppController],
})
export class AppModule {}
