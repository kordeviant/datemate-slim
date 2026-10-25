import {
  Controller,
  Get,
  HttpStatus,
  Param,
  Query,
  Res,
  VERSION_NEUTRAL,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiParam, ApiQuery } from '@nestjs/swagger';
import { Response } from 'express';
import * as fs from 'fs';
import * as path from 'path';
import { GeoLookupService } from './geo-lookup.service';
import { DownloadRegistryService } from './download-registry.service';
import { BypassTransform } from '../../common/interceptors/transform.interceptor';

function sanitizeFilename(name: string | null | undefined): string {
  return String(name || 'data')
    .toLowerCase()
    .replace(/[^a-z0-9_\-]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

@ApiTags('Downloads')
@BypassTransform()
@Controller({ path: 'downloads', version: ['1', VERSION_NEUTRAL] })
export class DownloadController {
  constructor(
    private readonly geoLookupService: GeoLookupService,
    private readonly downloadRegistry: DownloadRegistryService,
  ) {}

  @Get(['', 'catalog'])
  @ApiOperation({
    summary: 'Get downloads catalog or list packages by category',
  })
  @ApiQuery({ name: 'category', required: false, type: String })
  getCatalog(
    @Query('category') category?: string,
    @Res() res?: Response,
  ) {
    const catalog = this.downloadRegistry.getCatalog();
    if (category) {
      const filtered = this.downloadRegistry.listPackages({ category });
      return res!.status(HttpStatus.OK).json({
        category,
        total: filtered.length,
        items: filtered,
      });
    }
    return res!.status(HttpStatus.OK).json(catalog);
  }

  @Get('raw/:filename')
  @ApiOperation({
    summary: 'Stream static raw file directly with download headers',
  })
  @ApiParam({ name: 'filename', type: String, description: 'Filename to stream' })
  getRawFile(
    @Param('filename') filename: string,
    @Res() res: Response,
  ) {
    const safeFilename = path.basename(filename);
    const dataDir = this.geoLookupService.getDataDir() || this.downloadRegistry.getDataDir();
    const filePath = path.join(dataDir, safeFilename);

    if (!fs.existsSync(filePath)) {
      return res.status(HttpStatus.NOT_FOUND).json({
        error: 'File not found',
        file: safeFilename,
      });
    }

    return res.download(filePath, safeFilename);
  }

  @Get('countries')
  @ApiOperation({
    summary: 'Download countries JSON dataset directly as attachment',
  })
  @ApiQuery({ name: 'search', required: false, type: String })
  downloadCountries(
    @Query('search') search: string,
    @Res() res: Response,
  ) {
    const list = this.geoLookupService.getCountries({ search });
    const filename = search ? `countries_${sanitizeFilename(search)}.json` : 'countries.json';

    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Type', 'application/json');
    return res.status(HttpStatus.OK).send(JSON.stringify(list, null, 2));
  }

  @Get('states')
  @ApiOperation({
    summary: 'Download states JSON dataset directly as attachment',
  })
  @ApiQuery({ name: 'countryId', required: false, type: String })
  @ApiQuery({ name: 'country', required: false, type: String })
  @ApiQuery({ name: 'search', required: false, type: String })
  downloadStates(
    @Query('countryId') countryId: string,
    @Query('country') country: string,
    @Query('search') search: string,
    @Res() res: Response,
  ) {
    const result = this.geoLookupService.getStates({ countryId, country, search });
    let filename = 'states.json';
    if (result.country) {
      filename = `states_${sanitizeFilename(result.country.name)}.json`;
      res.setHeader('X-Country-Id', result.country.id);
    }

    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Type', 'application/json');
    return res.status(HttpStatus.OK).send(JSON.stringify(result.states, null, 2));
  }

  @Get('cities')
  @ApiOperation({
    summary: 'Download cities JSON dataset directly as attachment',
  })
  @ApiQuery({ name: 'stateId', required: false, type: String })
  @ApiQuery({ name: 'state', required: false, type: String })
  @ApiQuery({ name: 'countryId', required: false, type: String })
  @ApiQuery({ name: 'country', required: false, type: String })
  @ApiQuery({ name: 'search', required: false, type: String })
  @ApiQuery({ name: 'limit', required: false, type: String })
  @ApiQuery({ name: 'offset', required: false, type: String })
  downloadCities(
    @Query('stateId') stateId: string,
    @Query('state') state: string,
    @Query('countryId') countryId: string,
    @Query('country') country: string,
    @Query('search') search: string,
    @Query('limit') limit: string,
    @Query('offset') offset: string,
    @Res() res: Response,
  ) {
    const result = this.geoLookupService.getCities({
      stateId,
      state,
      countryId,
      country,
      search,
      limit,
      offset,
    });

    let filename = 'cities.json';
    if (result.state) {
      filename = `cities_${sanitizeFilename(result.state.name)}.json`;
      res.setHeader('X-State-Id', result.state.id);
    } else if (result.country) {
      filename = `cities_${sanitizeFilename(result.country.name)}.json`;
      res.setHeader('X-Country-Id', result.country.id);
    }

    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Type', 'application/json');
    return res.status(HttpStatus.OK).send(JSON.stringify(result.cities, null, 2));
  }

  @Get('hierarchy')
  @ApiOperation({
    summary: 'Download hierarchy JSON dataset directly as attachment',
  })
  @ApiQuery({ name: 'countryId', required: false, type: String })
  @ApiQuery({ name: 'country', required: false, type: String })
  downloadHierarchy(
    @Query('countryId') countryId: string,
    @Query('country') country: string,
    @Res() res: Response,
  ) {
    if (countryId || country) {
      const hierarchy = this.geoLookupService.getCountryHierarchy(countryId || country);
      if (!hierarchy) {
        return res.status(HttpStatus.NOT_FOUND).json({
          error: 'Country not found',
          query: countryId || country,
        });
      }
      const filename = `hierarchy_${sanitizeFilename(hierarchy.name)}.json`;
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.setHeader('Content-Type', 'application/json');
      return res.status(HttpStatus.OK).send(JSON.stringify(hierarchy, null, 2));
    }

    const dataDir = this.geoLookupService.getDataDir() || this.downloadRegistry.getDataDir();
    const filePath = path.join(dataDir, 'countries_states_cities.json');
    if (!fs.existsSync(filePath)) {
      return res.status(HttpStatus.NOT_FOUND).json({ error: 'File not found' });
    }
    return res.download(filePath, 'countries_states_cities.json');
  }

  @Get('package/:id')
  @ApiOperation({
    summary: 'Download package by registered ID',
  })
  @ApiParam({ name: 'id', type: String, description: 'Package ID' })
  downloadPackage(
    @Param('id') id: string,
    @Res() res: Response,
  ) {
    const pkg = this.downloadRegistry.getPackage(id);
    if (!pkg) {
      return res.status(HttpStatus.NOT_FOUND).json({
        error: 'Package not found in registry',
        packageId: id,
      });
    }

    if (pkg.downloadUrl.startsWith('/v1/downloads/raw/')) {
      const filename = path.basename(pkg.downloadUrl);
      const dataDir = this.geoLookupService.getDataDir() || this.downloadRegistry.getDataDir();
      const filePath = path.join(dataDir, filename);
      if (!fs.existsSync(filePath)) {
        return res.status(HttpStatus.NOT_FOUND).json({ error: 'File not found', file: filename });
      }
      return res.download(filePath, filename);
    }

    return res.redirect(pkg.downloadUrl);
  }
}
