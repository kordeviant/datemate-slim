export interface GeoCountryDetails {
  id: number;
  name: string;
  native?: string | null;
  emoji?: string | null;
}

export interface GeoStateDetails {
  id: number;
  name: string;
  countryId?: number | null;
  Country?: GeoCountryDetails | null;
}

export interface CityGeoDetails {
  id: number;
  name: string;
  stateId?: number | null;
  countryId?: number | null;
  state: { id: number; name: string } | string | null;
  country: { id: number; name: string } | string | null;
  countryNative?: string | null;
  countryEmoji?: string | null;
  State?: GeoStateDetails | null;
}

export interface GeoHierarchyCity {
  id: number;
  name: string;
  stateId?: number | null;
  countryId?: number | null;
  latitude?: number | null;
  longitude?: number | null;
}

export interface GeoHierarchyState {
  id: number;
  name: string;
  countryId?: number | null;
  cities: GeoHierarchyCity[];
}

export interface GeoHierarchyCountry {
  id: number;
  name: string;
  native?: string | null;
  emoji?: string | null;
  states: GeoHierarchyState[];
}

export interface GeoStats {
  countriesCount: number;
  statesCount: number;
  citiesCount: number;
  hierarchyCount: number;
  initialized: boolean;
}

export interface DownloadPackage {
  id: string;
  name: string;
  category: string;
  description: string;
  format: string;
  downloadUrl: string;
  apiUrl?: string;
  sizeBytes: number;
  updatedAt: string;
  registeredAt?: string;
  scalableFilterSupport?: string[];
  examples?: string[];
}

export interface DownloadCatalog {
  version: string;
  totalPackages: number;
  categories: string[];
  items: DownloadPackage[];
}

export interface IGeoLookupService {
  getCityById(cityId: number): Promise<CityGeoDetails | null>;
  resolveCity(idOrName: number | string): Promise<CityGeoDetails | null>;
  getCountries(options?: { search?: string }): Promise<GeoCountryDetails[]> | GeoCountryDetails[];
  getStates(
    optionsOrId?:
      | { countryId?: number | string; country?: string; search?: string }
      | number
      | string,
  ): Promise<any> | any;
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
  ): Promise<any> | any;
  getCountryHierarchy(
    idOrName: number | string,
  ): Promise<GeoHierarchyCountry | null> | GeoHierarchyCountry | null;
  getStats(): GeoStats;
}
