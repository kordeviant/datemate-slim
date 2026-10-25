import {
  Controller,
  Get,
  HttpStatus,
  Param,
  Query,
  Req,
  Res,
  VERSION_NEUTRAL,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiQuery } from '@nestjs/swagger';
import { Request, Response } from 'express';
import { GeoLookupService } from './geo-lookup.service';
import { BypassTransform } from '../../common/interceptors/transform.interceptor';

function sanitizeFilename(name: string | null | undefined): string {
  return String(name || 'data')
    .toLowerCase()
    .replace(/[^a-z0-9_\-]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function handleDownloadHeaders(req: Request, res: Response, filename: string): void {
  if (req.query.download === 'true' || req.query.attachment === 'true') {
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  }
}

@ApiTags('Geo')
@BypassTransform()
@Controller({ path: 'geo', version: ['1', VERSION_NEUTRAL] })
export class GeoController {
  constructor(private readonly geoLookupService: GeoLookupService) {}

  @Get('countries')
  @ApiOperation({
    summary: 'Get all countries or search countries',
    description: 'Retrieves complete list of countries or searches by query string.',
  })
  @ApiQuery({ name: 'search', required: false, type: String })
  @ApiQuery({ name: 'envelope', required: false, type: String })
  @ApiQuery({ name: 'download', required: false, type: String })
  getCountries(
    @Req() req: Request,
    @Res() res: Response,
    @Query('search') search?: string,
    @Query('envelope') envelope?: string,
  ) {
    const list = this.geoLookupService.getCountries({ search });
    res.setHeader('X-Total-Count', list.length);
    handleDownloadHeaders(
      req,
      res,
      search ? `countries_${sanitizeFilename(search)}.json` : 'countries.json',
    );

    if (envelope === 'true') {
      return res.status(HttpStatus.OK).json({
        total: list.length,
        search: search || null,
        countries: list,
      });
    }

    return res.status(HttpStatus.OK).json(list);
  }

  @Get('countries/:idOrName/states')
  @ApiOperation({
    summary: 'Get states of a specific country by ID or Name',
  })
  @ApiParam({ name: 'idOrName', type: String, description: 'Country ID, name, or alias' })
  @ApiQuery({ name: 'search', required: false, type: String })
  @ApiQuery({ name: 'envelope', required: false, type: String })
  @ApiQuery({ name: 'download', required: false, type: String })
  getCountryStates(
    @Req() req: Request,
    @Res() res: Response,
    @Param('idOrName') idOrName: string,
    @Query('search') search?: string,
    @Query('envelope') envelope?: string,
  ) {
    const country = this.geoLookupService.resolveCountry(idOrName);
    if (!country) {
      return res.status(HttpStatus.NOT_FOUND).json({
        error: 'Country not found',
        query: idOrName,
      });
    }

    const result = this.geoLookupService.getStates({ countryId: country.id, search });
    res.setHeader('X-Total-Count', result.states.length);
    res.setHeader('X-Country-Id', country.id);
    res.setHeader('X-Country-Name', country.name);

    handleDownloadHeaders(req, res, `states_${sanitizeFilename(country.name)}.json`);

    if (envelope === 'true') {
      return res.status(HttpStatus.OK).json({
        country: { id: country.id, name: country.name },
        total: result.states.length,
        states: result.states,
      });
    }

    return res.status(HttpStatus.OK).json(result.states);
  }

  @Get('countries/:idOrName/cities')
  @ApiOperation({
    summary: 'Get cities of a specific country by ID or Name',
  })
  @ApiParam({ name: 'idOrName', type: String, description: 'Country ID, name, or alias' })
  @ApiQuery({ name: 'search', required: false, type: String })
  @ApiQuery({ name: 'limit', required: false, type: String })
  @ApiQuery({ name: 'offset', required: false, type: String })
  @ApiQuery({ name: 'envelope', required: false, type: String })
  @ApiQuery({ name: 'download', required: false, type: String })
  getCountryCities(
    @Req() req: Request,
    @Res() res: Response,
    @Param('idOrName') idOrName: string,
    @Query('search') search?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
    @Query('envelope') envelope?: string,
  ) {
    const country = this.geoLookupService.resolveCountry(idOrName);
    if (!country) {
      return res.status(HttpStatus.NOT_FOUND).json({
        error: 'Country not found',
        query: idOrName,
      });
    }

    const result = this.geoLookupService.getCities({
      countryId: country.id,
      search,
      limit,
      offset,
    });

    res.setHeader('X-Total-Count', result.total);
    res.setHeader('X-Country-Id', country.id);
    res.setHeader('X-Country-Name', country.name);

    handleDownloadHeaders(req, res, `cities_${sanitizeFilename(country.name)}.json`);

    if (envelope === 'true') {
      return res.status(HttpStatus.OK).json({
        country: { id: country.id, name: country.name },
        total: result.total,
        offset: result.offset,
        limit: result.limit,
        cities: result.cities,
      });
    }

    return res.status(HttpStatus.OK).json(result.cities);
  }

  @Get('countries/:idOrName/hierarchy')
  @ApiOperation({
    summary: 'Get nested hierarchy for a specific country (Country -> States -> Cities)',
  })
  @ApiParam({ name: 'idOrName', type: String, description: 'Country ID, name, or alias' })
  @ApiQuery({ name: 'asArray', required: false, type: String })
  @ApiQuery({ name: 'download', required: false, type: String })
  getCountryHierarchy(
    @Req() req: Request,
    @Res() res: Response,
    @Param('idOrName') idOrName: string,
    @Query('asArray') asArray?: string,
  ) {
    const hierarchy = this.geoLookupService.getCountryHierarchy(idOrName);
    if (!hierarchy) {
      return res.status(HttpStatus.NOT_FOUND).json({
        error: 'Country not found for hierarchy',
        query: idOrName,
      });
    }

    res.setHeader('X-Country-Id', hierarchy.id);
    res.setHeader('X-Country-Name', hierarchy.name);
    res.setHeader('X-States-Count', (hierarchy.states || []).length);

    handleDownloadHeaders(req, res, `hierarchy_${sanitizeFilename(hierarchy.name)}.json`);

    if (asArray === 'true') {
      return res.status(HttpStatus.OK).json([hierarchy]);
    }

    return res.status(HttpStatus.OK).json(hierarchy);
  }

  @Get('countries/:idOrName')
  @ApiOperation({
    summary: 'Get single country by ID, Name, or Alias',
  })
  @ApiParam({ name: 'idOrName', type: String, description: 'Country ID, name, or alias' })
  getCountry(
    @Req() req: Request,
    @Res() res: Response,
    @Param('idOrName') idOrName: string,
  ) {
    const country = this.geoLookupService.resolveCountry(idOrName);
    if (!country) {
      return res.status(HttpStatus.NOT_FOUND).json({
        error: 'Country not found',
        query: idOrName,
      });
    }

    handleDownloadHeaders(req, res, `country_${sanitizeFilename(country.name)}.json`);
    return res.status(HttpStatus.OK).json(country);
  }

  @Get('states/:idOrName/cities')
  @ApiOperation({
    summary: 'Get cities of a specific state by ID or Name',
  })
  @ApiParam({ name: 'idOrName', type: String, description: 'State ID or Name' })
  @ApiQuery({ name: 'search', required: false, type: String })
  @ApiQuery({ name: 'limit', required: false, type: String })
  @ApiQuery({ name: 'offset', required: false, type: String })
  @ApiQuery({ name: 'envelope', required: false, type: String })
  @ApiQuery({ name: 'download', required: false, type: String })
  getStateCities(
    @Req() req: Request,
    @Res() res: Response,
    @Param('idOrName') idOrName: string,
    @Query('search') search?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
    @Query('envelope') envelope?: string,
  ) {
    const state = this.geoLookupService.resolveState(idOrName);
    if (!state) {
      return res.status(HttpStatus.NOT_FOUND).json({
        error: 'State not found',
        query: idOrName,
      });
    }

    const result = this.geoLookupService.getCities({
      stateId: state.id,
      search,
      limit,
      offset,
    });

    res.setHeader('X-Total-Count', result.total);
    res.setHeader('X-State-Id', state.id);
    res.setHeader('X-State-Name', state.name);
    if (result.country) {
      res.setHeader('X-Country-Id', result.country.id);
    }

    handleDownloadHeaders(req, res, `cities_${sanitizeFilename(state.name)}.json`);

    if (envelope === 'true') {
      return res.status(HttpStatus.OK).json({
        state: { id: state.id, name: state.name, countryId: state.countryId },
        total: result.total,
        offset: result.offset,
        limit: result.limit,
        cities: result.cities,
      });
    }

    return res.status(HttpStatus.OK).json(result.cities);
  }

  @Get('states/:idOrName')
  @ApiOperation({
    summary: 'Get single state by ID or Name',
  })
  @ApiParam({ name: 'idOrName', type: String, description: 'State ID or Name' })
  getState(
    @Req() req: Request,
    @Res() res: Response,
    @Param('idOrName') idOrName: string,
  ) {
    const state = this.geoLookupService.resolveState(idOrName);
    if (!state) {
      return res.status(HttpStatus.NOT_FOUND).json({
        error: 'State not found',
        query: idOrName,
      });
    }

    handleDownloadHeaders(req, res, `state_${sanitizeFilename(state.name)}.json`);
    return res.status(HttpStatus.OK).json(state);
  }

  @Get('states')
  @ApiOperation({
    summary: 'Get states (optionally filtered by country or search)',
  })
  @ApiQuery({ name: 'countryId', required: false, type: String })
  @ApiQuery({ name: 'country', required: false, type: String })
  @ApiQuery({ name: 'search', required: false, type: String })
  @ApiQuery({ name: 'envelope', required: false, type: String })
  @ApiQuery({ name: 'download', required: false, type: String })
  getStates(
    @Req() req: Request,
    @Res() res: Response,
    @Query('countryId') countryId?: string,
    @Query('country') country?: string,
    @Query('search') search?: string,
    @Query('envelope') envelope?: string,
  ) {
    if (countryId || country) {
      const targetCountry = this.geoLookupService.resolveCountry(countryId || country);
      if (!targetCountry) {
        return res.status(HttpStatus.NOT_FOUND).json({
          error: 'Country not found',
          query: countryId || country,
        });
      }

      const result = this.geoLookupService.getStates({ countryId: targetCountry.id, search });
      res.setHeader('X-Total-Count', result.states.length);
      res.setHeader('X-Country-Id', targetCountry.id);
      res.setHeader('X-Country-Name', targetCountry.name);

      handleDownloadHeaders(req, res, `states_${sanitizeFilename(targetCountry.name)}.json`);

      if (envelope === 'true') {
        return res.status(HttpStatus.OK).json({
          country: { id: targetCountry.id, name: targetCountry.name },
          total: result.states.length,
          states: result.states,
        });
      }

      return res.status(HttpStatus.OK).json(result.states);
    }

    const result = this.geoLookupService.getStates({ search });
    res.setHeader('X-Total-Count', result.states.length);
    handleDownloadHeaders(req, res, 'states.json');

    if (envelope === 'true') {
      return res.status(HttpStatus.OK).json({
        total: result.states.length,
        states: result.states,
      });
    }

    return res.status(HttpStatus.OK).json(result.states);
  }

  @Get('cities/:idOrName')
  @ApiOperation({
    summary: 'Get single city by ID or Name',
  })
  @ApiParam({ name: 'idOrName', type: String, description: 'City ID or Name' })
  async getCity(
    @Req() req: Request,
    @Res() res: Response,
    @Param('idOrName') idOrName: string,
  ) {
    const city = await this.geoLookupService.resolveCity(idOrName);
    if (!city) {
      return res.status(HttpStatus.NOT_FOUND).json({
        error: 'City not found',
        query: idOrName,
      });
    }

    handleDownloadHeaders(req, res, `city_${sanitizeFilename(city.name)}.json`);
    return res.status(HttpStatus.OK).json({
      id: city.id,
      name: city.name,
      stateId: city.stateId != null ? city.stateId : null,
      countryId: city.countryId != null ? city.countryId : null,
      state: city.state,
      country: city.country,
    });
  }

  @Get('cities')
  @ApiOperation({
    summary: 'Get cities (by ID query or filtered by state, country, search, pagination)',
  })
  @ApiQuery({ name: 'id', required: false, type: String })
  @ApiQuery({ name: 'cityId', required: false, type: String })
  @ApiQuery({ name: 'stateId', required: false, type: String })
  @ApiQuery({ name: 'state', required: false, type: String })
  @ApiQuery({ name: 'countryId', required: false, type: String })
  @ApiQuery({ name: 'country', required: false, type: String })
  @ApiQuery({ name: 'search', required: false, type: String })
  @ApiQuery({ name: 'limit', required: false, type: String })
  @ApiQuery({ name: 'offset', required: false, type: String })
  @ApiQuery({ name: 'envelope', required: false, type: String })
  @ApiQuery({ name: 'download', required: false, type: String })
  async getCities(
    @Req() req: Request,
    @Res() res: Response,
    @Query('id') id?: string,
    @Query('cityId') cityId?: string,
    @Query('stateId') stateId?: string,
    @Query('state') state?: string,
    @Query('countryId') countryId?: string,
    @Query('country') country?: string,
    @Query('search') search?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
    @Query('envelope') envelope?: string,
  ) {
    if (id || cityId) {
      const city = await this.geoLookupService.resolveCity(id || cityId);
      if (!city) {
        return res.status(HttpStatus.NOT_FOUND).json({
          error: 'City not found',
          query: id || cityId,
        });
      }

      handleDownloadHeaders(req, res, `city_${sanitizeFilename(city.name)}.json`);
      return res.status(HttpStatus.OK).json({
        id: city.id,
        name: city.name,
        stateId: city.stateId != null ? city.stateId : null,
        countryId: city.countryId != null ? city.countryId : null,
        state: city.state,
        country: city.country,
      });
    }

    const result = this.geoLookupService.getCities({
      stateId,
      state,
      countryId,
      country,
      search,
      limit,
      offset,
    });

    res.setHeader('X-Total-Count', result.total);
    let fileLabel = 'cities';
    if (result.state) {
      fileLabel = `cities_${sanitizeFilename(result.state.name)}`;
      res.setHeader('X-State-Id', result.state.id);
    } else if (result.country) {
      fileLabel = `cities_${sanitizeFilename(result.country.name)}`;
      res.setHeader('X-Country-Id', result.country.id);
    }

    handleDownloadHeaders(req, res, `${fileLabel}.json`);

    if (envelope === 'true') {
      return res.status(HttpStatus.OK).json({
        country: result.country ? { id: result.country.id, name: result.country.name } : null,
        state: result.state ? { id: result.state.id, name: result.state.name } : null,
        total: result.total,
        offset: result.offset,
        limit: result.limit,
        cities: result.cities,
      });
    }

    return res.status(HttpStatus.OK).json(result.cities);
  }
}
