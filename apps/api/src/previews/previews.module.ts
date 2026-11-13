import { Module } from '@nestjs/common';

import { LinkPreview } from './link-preview.service';
import { PublicHttp } from './public-http';
import { SiteMetadataService } from './site-metadata';

@Module({
  providers: [PublicHttp, LinkPreview, SiteMetadataService],
  exports: [PublicHttp, LinkPreview, SiteMetadataService],
})
export class PreviewsModule {}
