import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

async function main() {
  console.log('Starting geographic database seeding...');

  const countriesPath = path.join(
    __dirname,
    '..',
    '..',
    'downloads',
    'countries.json',
  );
  const statesPath = path.join(
    __dirname,
    '..',
    '..',
    'downloads',
    'states.json',
  );
  const citiesPath = path.join(
    __dirname,
    '..',
    '..',
    'downloads',
    'cities.json',
  );

  if (!fs.existsSync(countriesPath)) {
    console.error('countries.json not found in downloads folder!');
    return;
  }

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

  const cityCount = await prisma.city.count();
  console.log(`Seeding finished successfully! Total cities in DB: ${cityCount}`);
}

main()
  .catch((e) => {
    console.error('Seeding error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
