import { Injectable, Logger, OnModuleInit, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs';
import * as path from 'path';
import {
  CityGeoDetails,
  GeoCountryDetails,
  GeoHierarchyCountry,
  GeoStateDetails,
  GeoStats,
  IGeoLookupService,
} from './geo.interface';

const PERSIAN_TO_ENGLISH_CITY_MAP: Record<string, string> = {
  'تهران': 'Tehran',
  'مشهد': 'Mashhad',
  'اصفهان': 'Isfahan',
  'شیراز': 'Shiraz',
  'تبریز': 'Tabriz',
  'کرج': 'Karaj',
  'قم': 'Qom',
  'اهواز': 'Ahvaz',
  'کرمانشاه': 'Kermanshah',
  'ارومیه': 'Urmia',
  'رشت': 'Rasht',
  'زاهدان': 'Zahedan',
  'همدان': 'Hamadan',
  'کرمان': 'Kerman',
  'یزد': 'Yazd',
  'اردبیل': 'Ardabil',
  'بندرعباس': 'Bandar Abbas',
  'بندر عباس': 'Bandar Abbas',
  'اراک': 'Arak',
  'اسلامشهر': 'Eslamshahr',
  'اسلام شهر': 'Eslamshahr',
  'زنجان': 'Zanjan',
  'سنندج': 'Sanandaj',
  'قزوین': 'Qazvin',
  'خرم‌آباد': 'Khorramabad',
  'خرم اباد': 'Khorramabad',
  'گرگان': 'Gorgan',
  'ساری': 'Sari',
  'شهریار': 'Shahriar',
  'قدس': 'Qods',
  'شهر قدس': 'Qods',
  'کاشان': 'Kashan',
  'ملارد': 'Malard',
  'دزفول': 'Dezful',
  'نیشابور': 'Neyshabur',
  'بابل': 'Babol',
  'خمینی‌شهر': 'Khomeyni Shahr',
  'خمینی شهر': 'Khomeyni Shahr',
  'سبزوار': 'Sabzevar',
  'گلستان': 'Golestan',
  'آمل': 'Amol',
  'پاکدشت': 'Pakdasht',
  'نجف‌آباد': 'Najafabad',
  'نجف اباد': 'Najafabad',
  'بروجرد': 'Borujerd',
  'آبادان': 'Abadan',
  'قرچک': 'Qarchak',
  'بجنورد': 'Bojnurd',
  'ورامین': 'Varamin',
  'بوشهر': 'Bushehr',
  'ساوه': 'Saveh',
  'قائم‌شهر': 'Qaem Shahr',
  'قائم شهر': 'Qaem Shahr',
  'بیرجند': 'Birjand',
  'نسیم‌شهر': 'Nasim Shahr',
  'نسیم شهر': 'Nasim Shahr',
  'سیرجان': 'Sirjan',
  'خوی': 'Khoy',
  'ایلام': 'Ilam',
  'بوکان': 'Bukan',
  'شهرکرد': 'Shahr-e Kord',
  'سمنان': 'Semnan',
  'فردیس': 'Fardis',
  'مراغه': 'Maragheh',
  'شاهین‌شهر': 'Shahin Shahr',
  'شاهین شهر': 'Shahin Shahr',
  'مهاباد': 'Mahabad',
  'سقز': 'Saqqez',
};

function normalizeCityQuery(input: string): string {
  return input
    .replace(/[\u200B-\u200D\uFEFF]/g, ' ')
    .replace(/ي/g, 'ی')
    .replace(/ك/g, 'ک')
    .trim();
}

@Injectable()
export class GeoLookupService implements IGeoLookupService, OnModuleInit {
  private readonly logger = new Logger(GeoLookupService.name);
  private initialized = false;
  private dataDir = '';

  private countries: GeoCountryDetails[] = [];
  private states: GeoStateDetails[] = [];
  private cities: any[] = [];
  private hierarchy: GeoHierarchyCountry[] = [];

  // Indexed Lookup Maps
  private readonly countryById = new Map<number, GeoCountryDetails>();
  private readonly countryByName = new Map<string, GeoCountryDetails>();
  private readonly countryAliases = new Map<string, GeoCountryDetails>();

  private readonly stateById = new Map<number, GeoStateDetails>();
  private readonly stateByName = new Map<string, GeoStateDetails>();
  private readonly statesByCountryId = new Map<number, GeoStateDetails[]>();

  private readonly cityById = new Map<number, any>();
  private readonly citiesByStateId = new Map<number, any[]>();
  private readonly citiesByCountryId = new Map<number, any[]>();

  private readonly hierarchyByCountryId = new Map<number, GeoHierarchyCountry>();
  private readonly hierarchyByCountryName = new Map<string, GeoHierarchyCountry>();

  // Resolution Caches
  private readonly idCache = new Map<number, CityGeoDetails>();
  private readonly nameCache = new Map<string, CityGeoDetails>();

  constructor(@Optional() private readonly configService?: ConfigService) {}

  async onModuleInit(): Promise<void> {
    await this.init();
  }

  getDataDir(): string {
    return this.dataDir;
  }

  resolveDataDir(): string {
    const candidateDirs = [
      this.configService?.get<string>('GEO_DATA_DIR'),
      path.resolve(process.cwd(), 'data/geo'),
      path.resolve(__dirname, '../../../../data/geo'),
      path.resolve(__dirname, '../../data/geo'),
      '/home/parsa/Documents/projects/datemate/downloads',
    ].filter(Boolean) as string[];

    for (const dir of candidateDirs) {
      if (
        fs.existsSync(dir) &&
        fs.existsSync(path.join(dir, 'countries.json')) &&
        fs.existsSync(path.join(dir, 'states.json'))
      ) {
        return dir;
      }
    }

    return path.resolve(process.cwd(), 'data/geo');
  }

  async init(customDataDir?: string): Promise<void> {
    if (this.initialized && !customDataDir) {
      return;
    }

    this.dataDir = customDataDir || this.resolveDataDir();
    const startTime = Date.now();
    this.logger.log(`[GeoLookupService] Loading datasets from ${this.dataDir}...`);

    try {
      const countriesFile = path.join(this.dataDir, 'countries.json');
      const statesFile = path.join(this.dataDir, 'states.json');
      const citiesFile = path.join(this.dataDir, 'cities.json');
      const hierarchyFile = path.join(this.dataDir, 'countries_states_cities.json');

      if (!fs.existsSync(countriesFile) || !fs.existsSync(statesFile)) {
        this.logger.warn(
          `[GeoLookupService] Geo dataset files not found in ${this.dataDir}. In-memory lookups will be empty until files exist.`,
        );
        this.initialized = true;
        return;
      }

      // 1. Countries
      const rawCountries = fs.readFileSync(countriesFile, 'utf8');
      this.countries = JSON.parse(rawCountries);
      this.countryById.clear();
      this.countryByName.clear();
      for (const country of this.countries) {
        this.countryById.set(country.id, country);
        this.countryByName.set(country.name.toLowerCase().trim(), country);
      }
      this.registerCountryAliases();

      // 2. States
      const rawStates = fs.readFileSync(statesFile, 'utf8');
      this.states = JSON.parse(rawStates);
      this.stateById.clear();
      this.stateByName.clear();
      this.statesByCountryId.clear();
      for (const state of this.states) {
        this.stateById.set(state.id, state);

        const stateKey = state.name.toLowerCase().trim();
        if (state.countryId != null) {
          this.stateByName.set(`${state.countryId}:${stateKey}`, state);
          if (!this.statesByCountryId.has(state.countryId)) {
            this.statesByCountryId.set(state.countryId, []);
          }
          this.statesByCountryId.get(state.countryId)!.push(state);
        }
        if (!this.stateByName.has(stateKey)) {
          this.stateByName.set(stateKey, state);
        }
      }

      // 3. Cities
      if (fs.existsSync(citiesFile)) {
        const rawCities = fs.readFileSync(citiesFile, 'utf8');
        this.cities = JSON.parse(rawCities);
        this.cityById.clear();
        this.citiesByStateId.clear();
        this.citiesByCountryId.clear();
        for (const city of this.cities) {
          this.cityById.set(city.id, city);
          if (city.stateId != null) {
            if (!this.citiesByStateId.has(city.stateId)) {
              this.citiesByStateId.set(city.stateId, []);
            }
            this.citiesByStateId.get(city.stateId)!.push(city);
          }
          if (city.countryId != null) {
            if (!this.citiesByCountryId.has(city.countryId)) {
              this.citiesByCountryId.set(city.countryId, []);
            }
            this.citiesByCountryId.get(city.countryId)!.push(city);
          }
        }
      }

      // 4. Hierarchy
      if (fs.existsSync(hierarchyFile)) {
        const rawHierarchy = fs.readFileSync(hierarchyFile, 'utf8');
        this.hierarchy = JSON.parse(rawHierarchy);
        this.hierarchyByCountryId.clear();
        this.hierarchyByCountryName.clear();
        for (const item of this.hierarchy) {
          this.hierarchyByCountryId.set(item.id, item);
          this.hierarchyByCountryName.set(item.name.toLowerCase().trim(), item);
        }
      }

      this.initialized = true;
      const duration = Date.now() - startTime;
      this.logger.log(
        `[GeoLookupService] Datasets loaded & indexed in ${duration}ms (` +
          `${this.countries.length} countries, ` +
          `${this.states.length} states, ` +
          `${this.cities.length} cities)`,
      );
    } catch (err: any) {
      this.logger.error(`[GeoLookupService] Failed to load datasets: ${err.message}`, err.stack);
      this.initialized = true;
    }
  }

  private registerCountryAliases(): void {
    const aliasMap: Record<string, string> = {
      usa: 'united states',
      us: 'united states',
      america: 'united states',
      'united states of america': 'united states',
      uk: 'united kingdom',
      britain: 'united kingdom',
      'great britain': 'united kingdom',
      uae: 'united arab emirates',
      russia: 'russian federation',
    };

    for (const [alias, targetName] of Object.entries(aliasMap)) {
      const targetCountry = this.countryByName.get(targetName);
      if (targetCountry) {
        this.countryAliases.set(alias.toLowerCase(), targetCountry);
      }
    }
  }

  resolveCountry(idOrName: number | string | null | undefined): GeoCountryDetails | null {
    if (idOrName == null) return null;
    const str = String(idOrName).trim();
    if (!str) return null;

    const numId = Number(str);
    if (!isNaN(numId) && this.countryById.has(numId)) {
      return this.countryById.get(numId)!;
    }

    const lower = str.toLowerCase();
    if (this.countryAliases.has(lower)) {
      return this.countryAliases.get(lower)!;
    }

    if (this.countryByName.has(lower)) {
      return this.countryByName.get(lower)!;
    }

    for (const [name, country] of this.countryByName.entries()) {
      if (name.includes(lower)) {
        return country;
      }
    }

    return null;
  }

  resolveState(
    idOrName: number | string | null | undefined,
    countryId: number | null = null,
  ): GeoStateDetails | null {
    if (idOrName == null) return null;
    const str = String(idOrName).trim();
    if (!str) return null;

    const numId = Number(str);
    if (!isNaN(numId) && this.stateById.has(numId)) {
      return this.stateById.get(numId)!;
    }

    const lower = str.toLowerCase();
    if (countryId != null) {
      const scoped = this.stateByName.get(`${countryId}:${lower}`);
      if (scoped) return scoped;
    }

    if (this.stateByName.has(lower)) {
      return this.stateByName.get(lower)!;
    }

    if (countryId != null && this.statesByCountryId.has(countryId)) {
      const countryStates = this.statesByCountryId.get(countryId)!;
      const match = countryStates.find((s) => s.name.toLowerCase().includes(lower));
      if (match) return match;
    }

    return null;
  }

  async resolveCity(idOrName: number | string | null | undefined): Promise<CityGeoDetails | null> {
    if (idOrName == null) return null;

    if (typeof idOrName === 'number' && (isNaN(idOrName) || idOrName <= 0)) {
      return null;
    }

    const queryStr = String(idOrName).trim();
    if (!queryStr) return null;

    const lowerQuery = queryStr.toLowerCase();
    if (
      lowerQuery === 'nan' ||
      lowerQuery === 'null' ||
      lowerQuery === 'undefined' ||
      lowerQuery === '0'
    ) {
      return null;
    }

    const numericId = Number(queryStr);
    const isNumeric = !isNaN(numericId) && numericId > 0 && String(numericId) === queryStr;

    if (isNumeric && this.idCache.has(numericId)) {
      return this.idCache.get(numericId)!;
    }
    if (!isNumeric && this.nameCache.has(lowerQuery)) {
      return this.nameCache.get(lowerQuery)!;
    }

    // 1. Look up by ID
    if (isNumeric && this.cityById.has(numericId)) {
      const city = this.cityById.get(numericId);
      const state = city.stateId != null ? this.stateById.get(city.stateId) || null : null;
      const country =
        city.countryId != null
          ? this.countryById.get(city.countryId) || (state ? this.countryById.get(state.countryId || 0) || null : null)
          : state ? this.countryById.get(state.countryId || 0) || null : null;

      const result: CityGeoDetails = {
        id: city.id,
        name: city.name,
        stateId: city.stateId != null ? city.stateId : null,
        countryId: city.countryId != null ? city.countryId : state ? state.countryId ?? null : null,
        state: state ? { id: state.id, name: state.name } : null,
        country: country ? { id: country.id, name: country.name } : null,
        countryNative: country?.native ?? null,
        countryEmoji: country?.emoji ?? null,
        State: state
          ? {
              id: state.id,
              name: state.name,
              countryId: state.countryId ?? null,
              Country: country
                ? {
                    id: country.id,
                    name: country.name,
                    native: country.native ?? null,
                    emoji: country.emoji ?? null,
                  }
                : null,
            }
          : null,
      };

      this.idCache.set(numericId, result);
      return result;
    }

    // 2. Look up by Name (support Persian transliteration map)
    const normalized = normalizeCityQuery(queryStr);
    const searchTarget = PERSIAN_TO_ENGLISH_CITY_MAP[normalized] || queryStr;
    const searchTargetLower = searchTarget.toLowerCase();

    const match = this.cities.find((c) => c.name.toLowerCase() === searchTargetLower);
    if (match) {
      const state = match.stateId != null ? this.stateById.get(match.stateId) || null : null;
      const country =
        match.countryId != null
          ? this.countryById.get(match.countryId) || (state ? this.countryById.get(state.countryId || 0) || null : null)
          : state ? this.countryById.get(state.countryId || 0) || null : null;

      const result: CityGeoDetails = {
        id: match.id,
        name: match.name,
        stateId: match.stateId != null ? match.stateId : null,
        countryId: match.countryId != null ? match.countryId : state ? state.countryId ?? null : null,
        state: state ? { id: state.id, name: state.name } : null,
        country: country ? { id: country.id, name: country.name } : null,
        countryNative: country?.native ?? null,
        countryEmoji: country?.emoji ?? null,
        State: state
          ? {
              id: state.id,
              name: state.name,
              countryId: state.countryId ?? null,
              Country: country
                ? {
                    id: country.id,
                    name: country.name,
                    native: country.native ?? null,
                    emoji: country.emoji ?? null,
                  }
                : null,
            }
          : null,
      };

      this.idCache.set(match.id, result);
      this.nameCache.set(lowerQuery, result);
      return result;
    }

    return null;
  }

  async getCityById(cityId: number): Promise<CityGeoDetails | null> {
    return this.resolveCity(cityId);
  }

  getCity(idOrName: number | string): Promise<CityGeoDetails | null> {
    return this.resolveCity(idOrName);
  }

  getCountry(idOrName: number | string): GeoCountryDetails | null {
    return this.resolveCountry(idOrName);
  }

  getCountries(options?: { search?: string }): GeoCountryDetails[] {
    const search = options?.search;
    if (!search) {
      return this.countries;
    }
    const q = search.toLowerCase().trim();
    return this.countries.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        Boolean(c.native && c.native.toLowerCase().includes(q)),
    );
  }

  getStates(
    optionsOrId?:
      | { countryId?: number | string; country?: string; search?: string }
      | number
      | string,
  ): { country: GeoCountryDetails | null; states: GeoStateDetails[] } {
    let opts: { countryId?: number | string; country?: string; search?: string } = {};
    if (typeof optionsOrId === 'number' || typeof optionsOrId === 'string') {
      opts = { countryId: optionsOrId };
    } else if (optionsOrId && typeof optionsOrId === 'object') {
      opts = optionsOrId;
    }

    const { countryId, country, search } = opts;
    let result: GeoStateDetails[] = [];
    const targetCountry = countryId || country ? this.resolveCountry(countryId || country) : null;

    if (countryId || country) {
      if (!targetCountry) {
        return { country: null, states: [] };
      }
      result = this.statesByCountryId.get(targetCountry.id) || [];
    } else {
      result = this.states;
    }

    if (search) {
      const q = search.toLowerCase().trim();
      result = result.filter((s) => s.name.toLowerCase().includes(q));
    }

    return {
      country: targetCountry,
      states: result,
    };
  }

  getCities(
    optionsOrId?:
      | {
          stateId?: number | string;
          state?: string;
          countryId?: number | string;
          country?: string;
          search?: string;
          limit?: number | string;
          offset?: number | string;
        }
      | number
      | string,
  ): {
    country: GeoCountryDetails | null;
    state: GeoStateDetails | null;
    total: number;
    offset: number;
    limit: number;
    cities: any[];
  } {
    let opts: {
      stateId?: number | string;
      state?: string;
      countryId?: number | string;
      country?: string;
      search?: string;
      limit?: number | string;
      offset?: number | string;
    } = {};

    if (typeof optionsOrId === 'number' || typeof optionsOrId === 'string') {
      opts = { stateId: optionsOrId };
    } else if (optionsOrId && typeof optionsOrId === 'object') {
      opts = optionsOrId;
    }

    const { stateId, state, countryId, country, search, limit, offset } = opts;

    let targetCountry = countryId || country ? this.resolveCountry(countryId || country) : null;
    let targetState: GeoStateDetails | null = null;

    if (stateId || state) {
      targetState = this.resolveState(stateId || state, targetCountry ? targetCountry.id : null);
      if (targetState && !targetCountry && targetState.countryId != null) {
        targetCountry = this.countryById.get(targetState.countryId) || null;
      }
    }

    let result: any[] = [];

    if (targetState) {
      result = this.citiesByStateId.get(targetState.id) || [];
    } else if (targetCountry) {
      result = this.citiesByCountryId.get(targetCountry.id) || [];
    } else {
      result = this.cities;
    }

    if (search) {
      const q = search.toLowerCase().trim();
      result = result.filter((c) => c.name.toLowerCase().includes(q));
    }

    const total = result.length;
    const off = offset ? Math.max(0, parseInt(String(offset), 10)) : 0;
    const lim = limit ? Math.max(1, parseInt(String(limit), 10)) : total;

    if (offset || (limit && lim < total)) {
      result = result.slice(off, off + lim);
    }

    return {
      country: targetCountry,
      state: targetState,
      total,
      offset: off,
      limit: lim,
      cities: result,
    };
  }

  getCountryHierarchy(idOrName: number | string): GeoHierarchyCountry | null {
    const country = this.resolveCountry(idOrName);
    if (!country) return null;

    if (this.hierarchyByCountryId.has(country.id)) {
      return this.hierarchyByCountryId.get(country.id)!;
    }

    const lower = country.name.toLowerCase();
    if (this.hierarchyByCountryName.has(lower)) {
      return this.hierarchyByCountryName.get(lower)!;
    }

    // Dynamic reconstruction from states and cities
    const states = this.statesByCountryId.get(country.id) || [];
    const nestedStates = states.map((s) => {
      const stateCities = (this.citiesByStateId.get(s.id) || []).map((c) => ({
        id: c.id,
        name: c.name,
        stateId: c.stateId,
        countryId: c.countryId,
        latitude: null,
        longitude: null,
      }));
      return {
        id: s.id,
        name: s.name,
        countryId: s.countryId ?? null,
        cities: stateCities,
      };
    });

    return {
      id: country.id,
      name: country.name,
      native: country.native ?? null,
      emoji: country.emoji ?? null,
      states: nestedStates,
    };
  }

  getStats(): GeoStats {
    return {
      countriesCount: this.countries.length,
      statesCount: this.states.length,
      citiesCount: this.cities.length,
      hierarchyCount: this.hierarchy.length,
      initialized: this.initialized,
    };
  }
}
