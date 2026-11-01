import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

function resolveDataDir(): string | null {
  const candidateDirs = [
    process.env.GEO_DATA_DIR,
    path.join(__dirname, '..', '..', 'downloads'),
    path.join(__dirname, '..', '..', 'assets'),
    path.join(process.cwd(), '..', 'downloads'),
    path.join(process.cwd(), '..', 'assets'),
    process.env.HOME ? path.join(process.env.HOME, 'downloads') : null,
    process.env.HOME ? path.join(process.env.HOME, 'assets') : null,
  ].filter(Boolean) as string[];

  for (const dir of candidateDirs) {
    if (
      fs.existsSync(path.join(dir, 'countries.json')) &&
      fs.existsSync(path.join(dir, 'states.json')) &&
      fs.existsSync(path.join(dir, 'cities.json'))
    ) {
      return dir;
    }
  }

  return null;
}

async function main() {
  console.log('Starting geographic database seeding...');

  const dataDir = resolveDataDir();
  if (!dataDir) {
    console.error('Geo dataset files (countries.json, states.json, cities.json) not found in candidate directories!');
    process.exit(1);
  }

  console.log(`Using geo dataset directory: ${dataDir}`);

  const countriesPath = path.join(dataDir, 'countries.json');
  const statesPath = path.join(dataDir, 'states.json');
  const citiesPath = path.join(dataDir, 'cities.json');

  const rawCountries = JSON.parse(fs.readFileSync(countriesPath, 'utf8'));
  const rawStates = JSON.parse(fs.readFileSync(statesPath, 'utf8'));
  const rawCities = JSON.parse(fs.readFileSync(citiesPath, 'utf8'));

  console.log(`Seeding ${rawCountries.length} countries...`);
  for (const c of rawCountries) {
    const code = c.code || `C${c.id}`;
    await prisma.country.upsert({
      where: { id: c.id },
      create: {
        id: c.id,
        name: c.name.slice(0, 100),
        code: code.slice(0, 10),
      },
      update: {
        name: c.name.slice(0, 100),
        code: code.slice(0, 10),
      },
    });
  }

  console.log(`Seeding ${rawStates.length} states in chunks...`);
  const stateChunks = [];
  const stateChunkSize = 500;
  for (let i = 0; i < rawStates.length; i += stateChunkSize) {
    stateChunks.push(rawStates.slice(i, i + stateChunkSize));
  }

  for (const chunk of stateChunks) {
    const data = chunk.map((s: any) => ({
      id: s.id,
      name: s.name.slice(0, 100),
      countryId: s.countryId,
    }));
    await prisma.state.createMany({
      data,
      skipDuplicates: true,
    });
  }

  console.log(`Seeding ${rawCities.length} cities in chunks...`);
  const cityChunkSize = 2000;
  for (let i = 0; i < rawCities.length; i += cityChunkSize) {
    const chunk = rawCities.slice(i, i + cityChunkSize);
    const data = chunk.map((c: any) => ({
      id: c.id,
      name: c.name.slice(0, 100),
      stateId: c.stateId,
    }));
    await prisma.city.createMany({
      data,
      skipDuplicates: true,
    });
  }

  // Update PostgreSQL sequence counters
  try {
    await prisma.$executeRawUnsafe(
      `SELECT setval(pg_get_serial_sequence('countries', 'id'), COALESCE(MAX(id), 1)) FROM countries;`
    );
    await prisma.$executeRawUnsafe(
      `SELECT setval(pg_get_serial_sequence('states', 'id'), COALESCE(MAX(id), 1)) FROM states;`
    );
    await prisma.$executeRawUnsafe(
      `SELECT setval(pg_get_serial_sequence('cities', 'id'), COALESCE(MAX(id), 1)) FROM cities;`
    );
  } catch (seqErr) {
    console.warn('Could not reset sequence values (non-critical):', seqErr);
  }

  const countryCount = await prisma.country.count();
  const stateCount = await prisma.state.count();
  const cityCount = await prisma.city.count();
  console.log(`Seeding finished successfully! DB counts: ${countryCount} countries, ${stateCount} states, ${cityCount} cities.`);
}

main()
  .catch((e) => {
    console.error('Seeding error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
