import {
  BadGatewayException,
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  GoneException,
  Inject,
  Param,
  Patch,
  Post,
  Query,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { User } from '@prisma/client';
import type { Response } from 'express';
import { memoryStorage } from 'multer';

import {
  BulkSchema,
  CopyItemSchema,
  CreateCollectionSchema,
  CreateItemSchema,
  ItemDetailsSchema,
  ItemQuerySchema,
  MEDIA_MIMES,
  MoveItemSchema,
  SourcesQuerySchema,
  TagsQuerySchema,
  UpdateCollectionSchema,
  UpdateItemSchema,
  UPLOAD_FORM_LIMITS,
} from '@tuckly/contracts';

import { AuthGuard, CurrentUser } from '../auth/auth.guard';
import { parse } from '../common/validation';
import { imageMime } from '../telegram/telegram-media.service';

import { CatalogueService } from './catalogue.service';

@Controller('api')
@UseGuards(AuthGuard)
export class CatalogueController {
  constructor(@Inject(CatalogueService) private readonly catalogue: CatalogueService) {}
  @Get('collections') collections(@CurrentUser() user: User, @Query('spaceId') spaceId?: string) {
    return this.catalogue.collections(user, spaceId);
  }
  @Post('collections') collection(@CurrentUser() user: User, @Body() body: unknown) {
    const data = parse(CreateCollectionSchema, body);
    return this.catalogue.createCollection(user, data.name, data.spaceId, data.rules);
  }
  @Patch('collections/:id') collectionUpdate(
    @CurrentUser() user: User,
    @Param('id') id: string,
    @Body() body: unknown,
  ) {
    return this.catalogue.updateCollection(user, id, parse(UpdateCollectionSchema, body));
  }
  @Delete('collections/:id') collectionDelete(@CurrentUser() user: User, @Param('id') id: string) {
    return this.catalogue.removeCollection(user, id);
  }
  @Get('items') items(@CurrentUser() user: User, @Query() query: unknown) {
    return this.catalogue.list(user, parse(ItemQuerySchema, query));
  }
  @Post('items') add(@CurrentUser() user: User, @Body() body: unknown) {
    return this.catalogue.add(user, parse(CreateItemSchema, body));
  }
  @Get('sources') sources(@CurrentUser() user: User, @Query() query: unknown) {
    return this.catalogue.sources(user, parse(SourcesQuerySchema, query));
  }
  @Get('tags') tags(@CurrentUser() user: User, @Query() query: unknown) {
    return this.catalogue.tags(user, parse(TagsQuerySchema, query));
  }
  @Post('items/bulk') bulk(@CurrentUser() user: User, @Body() body: unknown) {
    return this.catalogue.bulk(user, parse(BulkSchema, body));
  }
  @Post('items/:id/enrich') enrich(@CurrentUser() user: User, @Param('id') id: string) {
    return this.catalogue.retry(user, id);
  }
  @Post('items/:id/move') move(
    @CurrentUser() user: User,
    @Param('id') id: string,
    @Body() body: unknown,
  ) {
    return this.catalogue.move(user, id, parse(MoveItemSchema, body).spaceId);
  }
  @Post('items/:id/copy') copy(
    @CurrentUser() user: User,
    @Param('id') id: string,
    @Body() body: unknown,
  ) {
    const data = parse(CopyItemSchema, body);
    return this.catalogue.copy(user, id, data.spaceId, data.collectionIds || [], data.includeNote);
  }
  @Post('items/media')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: UPLOAD_FORM_LIMITS,
      fileFilter: (_req, file, callback) =>
        callback(
          MEDIA_MIMES.includes(file.mimetype)
            ? null
            : new BadRequestException('Поддерживаются JPEG, PNG, WebP, MP4 и WebM'),
          true,
        ),
    }),
  )
  upload(
    @CurrentUser() user: User,
    @UploadedFile() file: Express.Multer.File | undefined,
    @Body('metadata') raw: string | undefined,
  ) {
    let metadata: unknown;
    try {
      metadata = JSON.parse(raw || '{}');
    } catch {
      throw new BadRequestException('Неверные данные карточки');
    }
    return this.catalogue.upload(user, file, parse(ItemDetailsSchema, metadata));
  }
  @Post('items/:id/send') send(@CurrentUser() user: User, @Param('id') id: string) {
    return this.catalogue.send(user, id);
  }
  @Get('items/:id/preview') async preview(
    @CurrentUser() user: User,
    @Param('id') id: string,
    @Res() res: Response,
  ) {
    const bytes = await this.catalogue.preview(user, id);
    const mime = imageMime(bytes);
    if (!mime) {
      throw new BadGatewayException('Превью недоступно');
    }
    res
      .set({
        'Content-Type': mime,
        'Content-Length': String(bytes.length),
        'Cache-Control': 'private, no-store',
        'X-Content-Type-Options': 'nosniff',
      })
      .send(bytes);
  }
  @Patch('items/:id') edit(
    @CurrentUser() user: User,
    @Param('id') id: string,
    @Body() body: unknown,
  ) {
    return this.catalogue.edit(user, id, parse(UpdateItemSchema, body));
  }
  @Delete('items/:id') remove(@CurrentUser() user: User, @Param('id') id: string) {
    return this.catalogue.remove(user, id);
  }
  @Post('uploads') retired() {
    throw new GoneException('Загрузка в S3 отключена. Используйте POST /api/items/media');
  }
}
