import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CityGeoDetails, IGeoLookupService } from './geo.interface';

@Injectable()
export class GeoLookupService implements IGeoLookupService {
  private readonly logger = new Logger(GeoLookupService.name);
  private readonly baseUrl: string;
  private readonly cache = new Map<number, CityGeoDetails>();

  constructor(private readonly configService: ConfigService) {
    // Internal service URL for datemate_downloads (port 5454)
    this.baseUrl =
      this.configService.get<string>('DOWNLOADS_SERVICE_URL') ||
      this.configService.get<string>('GEO_SERVICE_URL') ||
      'http://127.0.0.1:5454';
  }

  async getCityById(cityId: number): Promise<CityGeoDetails | null> {
    if (!cityId || isNaN(cityId) || cityId <= 0) {
      return null;
    }

    if (this.cache.has(cityId)) {
      return this.cache.get(cityId)!;
    }

    let timeoutId: NodeJS.Timeout | undefined;
    try {
      const controller = new AbortController();
      timeoutId = setTimeout(() => controller.abort(), 3000);

      const res = await fetch(`${this.baseUrl}/v1/geo/cities/${cityId}`, {
        signal: controller.signal,
        headers: { Accept: 'application/json' },
      });

      if (!res.ok) {
        if (res.status === 404) {
          return null;
        }
        this.logger.warn(`Failed to fetch city ${cityId} from geo service: ${res.statusText}`);
        return null;
      }

      const data: any = await res.json();
      if (!data || !data.id || !data.name) {
        return null;
      }

      const details: CityGeoDetails = {
        id: Number(data.id),
        name: String(data.name),
        state: typeof data.state === 'string' ? data.state : data.state?.name ?? null,
        country: typeof data.country === 'string' ? data.country : data.country?.name ?? null,
      };

      this.cache.set(cityId, details);
      return details;
    } catch (err: any) {
      this.logger.warn(`Error resolving city ${cityId} from ${this.baseUrl}: ${err.message}`);
      return null;
    } finally {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    }
  }

  clearCache(): void {
    this.cache.clear();
  }
}
