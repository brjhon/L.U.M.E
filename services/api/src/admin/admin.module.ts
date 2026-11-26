import { Module } from '@nestjs/common';
import { PartnerModule } from '../partner/partner.module';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';

@Module({ imports: [PartnerModule], controllers: [AdminController], providers: [AdminService] })
export class AdminModule {}
