import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, VersioningType } from '@nestjs/common';
import request from 'supertest';
import * as path from 'path';
import { ConfigModule } from '@nestjs/config';
import { GeoModule } from './geo.module';
import { GeoLookupService } from './geo-lookup.service';
import { DownloadRegistryService } from './download-registry.service';

describe('Geo & Downloads Integration Tests (matching downloads project filters)', () => {
  let app: INestApplication;
  let geoLookupService: GeoLookupService;
  let downloadRegistry: DownloadRegistryService;

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          envFilePath: '.env',
        }),
        GeoModule,
      ],
    }).compile();

    geoLookupService = moduleRef.get<GeoLookupService>(GeoLookupService);
    downloadRegistry = moduleRef.get<DownloadRegistryService>(DownloadRegistryService);

    await geoLookupService.init(path.resolve(process.cwd(), 'data/geo'));

    app = moduleRef.createNestApplication();
    app.enableVersioning({
      type: VersioningType.URI,
      defaultVersion: '1',
    });

    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /v1/downloads/catalog returns registered download packages', async () => {
    const res = await request(app.getHttpServer()).get('/v1/downloads/catalog');
    expect(res.status).toBe(200);
    expect(res.body.totalPackages).toBeGreaterThanOrEqual(4);
    expect(res.body.items.some((item: any) => item.id === 'countries')).toBe(true);
    expect(res.body.items.some((item: any) => item.id === 'states')).toBe(true);
    expect(res.body.items.some((item: any) => item.id === 'cities')).toBe(true);
    expect(res.body.items.some((item: any) => item.id === 'hierarchy')).toBe(true);
  });

  it('GET /v1/geo/countries returns 250 countries', async () => {
    const res = await request(app.getHttpServer()).get('/v1/geo/countries');
    expect(res.status).toBe(200);
    expect(res.body.length).toBe(250);
    expect(res.headers['x-total-count']).toBe('250');
  });

  it('GET /v1/geo/countries?envelope=true returns envelope response', async () => {
    const res = await request(app.getHttpServer()).get('/v1/geo/countries?envelope=true');
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(250);
    expect(res.body.countries.length).toBe(250);
  });

  it('GET /v1/geo/countries/233 returns United States', async () => {
    const res = await request(app.getHttpServer()).get('/v1/geo/countries/233');
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(233);
    expect(res.body.name).toBe('United States');
  });

  it('GET /v1/geo/countries/America returns United States via alias', async () => {
    const res = await request(app.getHttpServer()).get('/v1/geo/countries/America');
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(233);
    expect(res.body.name).toBe('United States');
  });

  it('GET /v1/geo/countries/:id/states returns only states of America (60 states)', async () => {
    // 1. By country ID (233)
    const byId = await request(app.getHttpServer()).get('/v1/geo/countries/233/states');
    expect(byId.status).toBe(200);
    expect(byId.body.length).toBe(60);
    expect(byId.headers['x-country-id']).toBe('233');
    expect(byId.body.every((s: any) => s.countryId === 233)).toBe(true);
    expect(byId.body.some((s: any) => s.name === 'California')).toBe(true);
    expect(byId.body.some((s: any) => s.name === 'Alabama')).toBe(true);

    // 2. By country name alias 'America'
    const byName = await request(app.getHttpServer()).get('/v1/geo/countries/America/states');
    expect(byName.status).toBe(200);
    expect(byName.body.length).toBe(60);

    // 3. Via query parameter /v1/geo/states?country=United States
    const byQuery = await request(app.getHttpServer()).get('/v1/geo/states?country=United%20States');
    expect(byQuery.status).toBe(200);
    expect(byQuery.body.length).toBe(60);
  });

  it('GET /v1/geo/states/:id/cities returns cities of one state (Alabama)', async () => {
    // Alabama ID is 1456
    const byId = await request(app.getHttpServer()).get('/v1/geo/states/1456/cities');
    expect(byId.status).toBe(200);
    expect(byId.body.length).toBe(311);
    expect(byId.headers['x-state-id']).toBe('1456');
    expect(byId.body.every((c: any) => c.stateId === 1456)).toBe(true);

    // By state name /v1/geo/states/Alabama/cities
    const byName = await request(app.getHttpServer()).get('/v1/geo/states/Alabama/cities');
    expect(byName.status).toBe(200);
    expect(byName.body.length).toBe(311);

    // Via query parameter /v1/geo/cities?state=Alabama
    const byQuery = await request(app.getHttpServer()).get('/v1/geo/cities?state=Alabama');
    expect(byQuery.status).toBe(200);
    expect(byQuery.body.length).toBe(311);
  });

  it('GET /v1/geo/countries/:id/cities returns all cities in the country', async () => {
    const res = await request(app.getHttpServer()).get('/v1/geo/countries/233/cities?limit=50');
    expect(res.status).toBe(200);
    expect(res.body.length).toBe(50);
    expect(res.headers['x-country-id']).toBe('233');
    expect(Number(res.headers['x-total-count'])).toBeGreaterThan(10000);
  });

  it('GET /v1/geo/countries/233/hierarchy returns complete nested tree for United States', async () => {
    const res = await request(app.getHttpServer()).get('/v1/geo/countries/233/hierarchy');
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(233);
    expect(res.body.name).toBe('United States');
    expect(res.body.states.length).toBe(60);
    expect(res.body.states[0].cities.length).toBeGreaterThan(0);
    expect(res.headers['x-country-id']).toBe('233');
  });

  it('GET /v1/geo/cities/:id returns single city with state and country', async () => {
    // Test by ID (135129 is Tehran)
    const byId = await request(app.getHttpServer()).get('/v1/geo/cities/135129');
    expect(byId.status).toBe(200);
    expect(byId.body.id).toBe(135129);
    expect(byId.body.name).toBe('Tehran');
    expect(byId.body.state.name).toBe('Tehran');
    expect(byId.body.country.name).toBe('Iran');

    // Test by query param ?id=135129
    const byQuery = await request(app.getHttpServer()).get('/v1/geo/cities?id=135129');
    expect(byQuery.status).toBe(200);
    expect(byQuery.body.id).toBe(135129);
    expect(byQuery.body.name).toBe('Tehran');

    // Test 404 for unknown city
    const notFound = await request(app.getHttpServer()).get('/v1/geo/cities/9999999');
    expect(notFound.status).toBe(404);
  });

  it('download=true query param sets Content-Disposition header', async () => {
    const res = await request(app.getHttpServer()).get('/v1/geo/countries/233/states?download=true');
    expect(res.status).toBe(200);
    const disp = res.headers['content-disposition'];
    expect(disp).toBeDefined();
    expect(disp).toContain('attachment; filename="states_united_states.json"');

    const resCity = await request(app.getHttpServer()).get('/v1/geo/states/Alabama/cities?download=true');
    expect(resCity.status).toBe(200);
    const dispCity = resCity.headers['content-disposition'];
    expect(dispCity).toBeDefined();
    expect(dispCity).toContain('attachment; filename="cities_alabama.json"');
  });

  it('Convenience download endpoints force download headers', async () => {
    const resStates = await request(app.getHttpServer()).get('/v1/downloads/states?countryId=233');
    expect(resStates.status).toBe(200);
    expect(resStates.headers['content-disposition']).toContain('states_united_states.json');

    const resCities = await request(app.getHttpServer()).get('/v1/downloads/cities?stateId=1456');
    expect(resCities.status).toBe(200);
    expect(resCities.headers['content-disposition']).toContain('cities_alabama.json');

    const resHierarchy = await request(app.getHttpServer()).get('/v1/downloads/hierarchy?countryId=233');
    expect(resHierarchy.status).toBe(200);
    expect(resHierarchy.headers['content-disposition']).toContain('hierarchy_united_states.json');
  });

  it('Raw static file downloads work via /v1/downloads/raw', async () => {
    const resRaw = await request(app.getHttpServer()).get('/v1/downloads/raw/countries.json');
    expect(resRaw.status).toBe(200);
    expect(resRaw.headers['content-disposition']).toContain('attachment; filename="countries.json"');
  });

  it('Extensible DownloadRegistry allows dynamic package registration', async () => {
    downloadRegistry.register({
      id: 'custom_dataset',
      name: 'Custom User Dataset',
      category: 'custom',
      description: 'A newly added dataset package',
      format: 'json',
      downloadUrl: '/v1/downloads/raw/countries.json',
      sizeBytes: 100,
      updatedAt: new Date().toISOString(),
    });

    const pkg = downloadRegistry.getPackage('custom_dataset');
    expect(pkg).toBeDefined();
    expect(pkg!.name).toBe('Custom User Dataset');

    const res = await request(app.getHttpServer()).get('/v1/downloads/catalog?category=custom');
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(1);
    expect(res.body.items[0].id).toBe('custom_dataset');

    // Clean up
    downloadRegistry.unregister('custom_dataset');
  });
});
