import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { GeoLookupService } from './geo-lookup.service';

describe('GeoLookupService', () => {
  let service: GeoLookupService;
  let mockConfigService: any;
  let originalFetch: typeof global.fetch;

  beforeEach(async () => {
    originalFetch = global.fetch;
    mockConfigService = {
      get: jest.fn().mockImplementation((key: string, defaultVal?: any) => {
        if (key === 'DOWNLOADS_SERVICE_URL') return 'http://127.0.0.1:5454';
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
  });

  afterEach(() => {
    global.fetch = originalFetch;
    service.clearCache();
  });

  it('should return null for invalid city IDs (0, negative, NaN)', async () => {
    expect(await service.getCityById(0)).toBeNull();
    expect(await service.getCityById(-5)).toBeNull();
    expect(await service.getCityById(NaN)).toBeNull();
  });

  it('should successfully fetch and return city details with nested state and country', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: jest.fn().mockResolvedValue({
        id: 135129,
        name: 'Tehran',
        stateId: 3945,
        countryId: 103,
        state: { id: 3945, name: 'Tehran' },
        country: { id: 103, name: 'Iran' },
      }),
    } as any);

    const result = await service.getCityById(135129);

    expect(result).toEqual({
      id: 135129,
      name: 'Tehran',
      state: 'Tehran',
      country: 'Iran',
    });
    expect(global.fetch).toHaveBeenCalledWith(
      'http://127.0.0.1:5454/v1/geo/cities/135129',
      expect.anything(),
    );
  });

  it('should cache resolved cities in memory to avoid repeated HTTP calls', async () => {
    const mockFetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: jest.fn().mockResolvedValue({
        id: 135129,
        name: 'Tehran',
        state: 'Tehran',
        country: 'Iran',
      }),
    });
    global.fetch = mockFetch as any;

    const res1 = await service.getCityById(135129);
    const res2 = await service.getCityById(135129);

    expect(res1).toEqual(res2);
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('should return null when downloads service responds with 404', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 404,
      statusText: 'Not Found',
    } as any);

    const result = await service.getCityById(9999999);
    expect(result).toBeNull();
  });

  it('should handle network error gracefully without throwing', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('Connection refused'));

    const result = await service.getCityById(135129);
    expect(result).toBeNull();
  });
});
