import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { DownloadCatalog, DownloadPackage } from './geo.interface';

@Injectable()
export class DownloadRegistryService {
  private readonly logger = new Logger(DownloadRegistryService.name);
  private readonly packages = new Map<string, DownloadPackage>();
  private dataDir: string;

  constructor() {
    this.dataDir = path.resolve(process.cwd(), 'data/geo');
    this.initDefaultPackages();
  }

  setDataDir(dir: string): void {
    this.dataDir = dir;
    this.packages.clear();
    this.initDefaultPackages();
  }

  getDataDir(): string {
    return this.dataDir;
  }

  private getFileStats(filePath: string): { sizeBytes: number; updatedAt: string } {
    try {
      if (fs.existsSync(filePath)) {
        const stats = fs.statSync(filePath);
        return {
          sizeBytes: stats.size,
          updatedAt: stats.mtime.toISOString(),
        };
      }
    } catch (e: any) {
      this.logger.warn(`Unable to stat file ${filePath}: ${e.message}`);
    }
    return { sizeBytes: 0, updatedAt: new Date().toISOString() };
  }

  initDefaultPackages(): void {
    const countriesStats = this.getFileStats(path.join(this.dataDir, 'countries.json'));
    const statesStats = this.getFileStats(path.join(this.dataDir, 'states.json'));
    const citiesStats = this.getFileStats(path.join(this.dataDir, 'cities.json'));
    const hierarchyStats = this.getFileStats(
      path.join(this.dataDir, 'countries_states_cities.json'),
    );

    this.register({
      id: 'countries',
      name: 'All Countries',
      category: 'geo',
      description: 'Complete list of 250 countries formatted for client models',
      format: 'json',
      downloadUrl: '/v1/downloads/raw/countries.json',
      apiUrl: '/v1/geo/countries',
      sizeBytes: countriesStats.sizeBytes,
      updatedAt: countriesStats.updatedAt,
      scalableFilterSupport: ['search'],
    });

    this.register({
      id: 'states',
      name: 'All States & Provinces',
      category: 'geo',
      description: 'Complete list of 5,308 states/provinces worldwide',
      format: 'json',
      downloadUrl: '/v1/downloads/raw/states.json',
      apiUrl: '/v1/geo/states',
      sizeBytes: statesStats.sizeBytes,
      updatedAt: statesStats.updatedAt,
      scalableFilterSupport: ['countryId', 'country', 'search'],
      examples: [
        '/v1/geo/countries/233/states?download=true',
        '/v1/geo/states?country=United States&download=true',
      ],
    });

    this.register({
      id: 'cities',
      name: 'All Cities',
      category: 'geo',
      description: 'Complete list of 152,970 global cities with stateId and countryId',
      format: 'json',
      downloadUrl: '/v1/downloads/raw/cities.json',
      apiUrl: '/v1/geo/cities',
      sizeBytes: citiesStats.sizeBytes,
      updatedAt: citiesStats.updatedAt,
      scalableFilterSupport: [
        'stateId',
        'state',
        'countryId',
        'country',
        'search',
        'limit',
        'offset',
      ],
      examples: [
        '/v1/geo/states/1456/cities?download=true',
        '/v1/geo/cities?state=Alabama&download=true',
        '/v1/geo/countries/233/cities?download=true',
      ],
    });

    this.register({
      id: 'hierarchy',
      name: 'Countries States Cities Hierarchy',
      category: 'geo',
      description: 'Complete nested hierarchical dataset (Country -> State -> City)',
      format: 'json',
      downloadUrl: '/v1/downloads/raw/countries_states_cities.json',
      apiUrl: '/v1/geo/countries/:countryId/hierarchy',
      sizeBytes: hierarchyStats.sizeBytes,
      updatedAt: hierarchyStats.updatedAt,
      scalableFilterSupport: ['countryId', 'country'],
      examples: [
        '/v1/geo/countries/233/hierarchy?download=true',
        '/v1/geo/countries/United States/hierarchy?download=true',
      ],
    });
  }

  register(pkg: DownloadPackage): void {
    if (!pkg.id) {
      throw new Error('Package registration requires an "id" field');
    }
    this.packages.set(pkg.id, {
      ...pkg,
      registeredAt: pkg.registeredAt || new Date().toISOString(),
    });
  }

  unregister(id: string): boolean {
    return this.packages.delete(id);
  }

  getPackage(id: string): DownloadPackage | null {
    return this.packages.get(id) || null;
  }

  listPackages(filter?: { category?: string }): DownloadPackage[] {
    const list = Array.from(this.packages.values());
    if (filter?.category) {
      return list.filter((p) => p.category === filter.category);
    }
    return list;
  }

  getCatalog(): DownloadCatalog {
    const packages = this.listPackages();
    const categories: Record<string, DownloadPackage[]> = {};

    for (const pkg of packages) {
      if (!categories[pkg.category]) {
        categories[pkg.category] = [];
      }
      categories[pkg.category].push(pkg);
    }

    return {
      version: '1.0.0',
      totalPackages: packages.length,
      categories: Object.keys(categories),
      items: packages,
    };
  }
}
