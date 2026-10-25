import { Global, Module } from '@nestjs/common';
import { GeoLookupService } from './geo-lookup.service';
import { DownloadRegistryService } from './download-registry.service';
import { GeoController } from './geo.controller';
import { DownloadController } from './download.controller';

@Global()
@Module({
  controllers: [GeoController, DownloadController],
  providers: [GeoLookupService, DownloadRegistryService],
  exports: [GeoLookupService, DownloadRegistryService],
})
export class GeoModule {}
