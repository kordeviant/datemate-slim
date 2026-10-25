import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import * as path from 'path';
import { GeoLookupService } from './geo-lookup.service';

describe('GeoLookupService', () => {
  let service: GeoLookupService;

  beforeAll(async () => {
    const mockConfigService = {
      get: jest.fn().mockImplementation((key: string, defaultVal?: any) => {
        if (key === 'GEO_DATA_DIR') {
          return path.resolve(process.cwd(), 'data/geo');
        }
        return defaultVal;
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GeoLookupService,
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    service = module.get<GeoLookupService>(GeoLookupService);
    await service.init();
  });

  it('should initialize and load dataset statistics', () => {
    const stats = service.getStats();
    expect(stats.initialized).toBe(true);
    expect(stats.countriesCount).toBe(250);
    expect(stats.statesCount).toBe(5308);
    expect(stats.citiesCount).toBe(152970);
  });

  it('should return null for invalid city IDs (0, negative, NaN, null, undefined)', async () => {
    expect(await service.getCityById(0)).toBeNull();
    expect(await service.getCityById(-5)).toBeNull();
    expect(await service.getCityById(NaN)).toBeNull();
    expect(await service.resolveCity(null)).toBeNull();
    expect(await service.resolveCity(undefined)).toBeNull();
    expect(await service.resolveCity('null')).toBeNull();
    expect(await service.resolveCity('')).toBeNull();
  });

  it('should resolve city by ID (135129 = Tehran) with state and country', async () => {
    const city = await service.resolveCity(135129);
    expect(city).toBeDefined();
    expect(city!.id).toBe(135129);
    expect(city!.name).toBe('Tehran');
    expect(city!.state).toEqual({ id: 3945, name: 'Tehran' });
    expect(city!.country).toEqual({ id: 103, name: 'Iran' });
    expect(city!.State).toBeDefined();
    expect(city!.State!.name).toBe('Tehran');
    expect(city!.State!.Country!.name).toBe('Iran');
  });

  it('should resolve city by Persian name (تهران) mapped to Tehran', async () => {
    const city = await service.resolveCity('تهران');
    expect(city).toBeDefined();
    expect(city!.id).toBe(135129);
    expect(city!.name).toBe('Tehran');
  });

  it('should resolve country by ID, name, or common alias', () => {
    const byId = service.resolveCountry(233);
    expect(byId).toBeDefined();
    expect(byId!.name).toBe('United States');

    const byName = service.resolveCountry('United States');
    expect(byName).toBeDefined();
    expect(byName!.id).toBe(233);

    const byAliasUsa = service.resolveCountry('usa');
    expect(byAliasUsa).toBeDefined();
    expect(byAliasUsa!.id).toBe(233);

    const byAliasAmerica = service.resolveCountry('America');
    expect(byAliasAmerica).toBeDefined();
    expect(byAliasAmerica!.id).toBe(233);

    const byAliasUk = service.resolveCountry('uk');
    expect(byAliasUk).toBeDefined();
    expect(byAliasUk!.name).toBe('United Kingdom');
  });

  it('should resolve state by ID or name', () => {
    const byId = service.resolveState(1456);
    expect(byId).toBeDefined();
    expect(byId!.name).toBe('Alabama');
    expect(byId!.countryId).toBe(233);

    const byName = service.resolveState('Alabama');
    expect(byName).toBeDefined();
    expect(byName!.id).toBe(1456);
  });

  it('should filter countries with search query', () => {
    const all = service.getCountries();
    expect(all.length).toBe(250);

    const filtered = service.getCountries({ search: 'united' });
    expect(filtered.length).toBeGreaterThan(0);
    expect(filtered.some((c) => c.name === 'United States')).toBe(true);
    expect(filtered.some((c) => c.name === 'United Kingdom')).toBe(true);
  });

  it('should return states filtered by countryId or country name', () => {
    const usStatesById = service.getStates({ countryId: 233 });
    expect(usStatesById.country).toBeDefined();
    expect(usStatesById.country!.id).toBe(233);
    expect(usStatesById.states.length).toBe(60);
    expect(usStatesById.states.every((s) => s.countryId === 233)).toBe(true);

    const usStatesByName = service.getStates({ country: 'America' });
    expect(usStatesByName.states.length).toBe(60);

    const searchState = service.getStates({ countryId: 233, search: 'california' });
    expect(searchState.states.length).toBe(1);
    expect(searchState.states[0].name).toBe('California');
  });

  it('should return cities filtered by state, country, search, and pagination', () => {
    const alabamaCities = service.getCities({ stateId: 1456 });
    expect(alabamaCities.state).toBeDefined();
    expect(alabamaCities.state!.id).toBe(1456);
    expect(alabamaCities.total).toBe(311);
    expect(alabamaCities.cities.length).toBe(311);

    const paginated = service.getCities({ stateId: 1456, limit: 10, offset: 5 });
    expect(paginated.total).toBe(311);
    expect(paginated.limit).toBe(10);
    expect(paginated.offset).toBe(5);
    expect(paginated.cities.length).toBe(10);

    const searchCity = service.getCities({ stateId: 1456, search: 'birmingham' });
    expect(searchCity.cities.length).toBeGreaterThanOrEqual(1);
    expect(searchCity.cities[0].name.toLowerCase()).toContain('birmingham');
  });

  it('should retrieve full hierarchy tree for country', () => {
    const hierarchy = service.getCountryHierarchy(233);
    expect(hierarchy).toBeDefined();
    expect(hierarchy!.id).toBe(233);
    expect(hierarchy!.name).toBe('United States');
    expect(hierarchy!.states.length).toBe(60);
    expect(hierarchy!.states[0].cities.length).toBeGreaterThan(0);
  });
});
