import { Global, Module } from '@nestjs/common';
import { GeoLookupService } from './geo-lookup.service';

@Global()
@Module({
  providers: [GeoLookupService],
  exports: [GeoLookupService],
})
export class GeoModule {}
