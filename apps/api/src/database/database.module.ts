import { Module } from '@nestjs/common';

import { Store } from './database.service';

@Module({ providers: [Store], exports: [Store] })
export class DatabaseModule {}
