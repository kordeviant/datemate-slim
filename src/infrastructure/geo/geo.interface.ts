export interface CityGeoDetails {
  id: number;
  name: string;
  state: string | null;
  country: string | null;
}

export interface IGeoLookupService {
  getCityById(cityId: number): Promise<CityGeoDetails | null>;
}
