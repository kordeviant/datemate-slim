import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import * as fs from 'fs';
import * as path from 'path';

async function exportSwagger() {
  const app = await NestFactory.create(AppModule, { logger: false });

  const config = new DocumentBuilder()
    .setTitle('DateMate Backend API')
    .setDescription(
      'DateMate REST API documentation covering Authentication, Users, Matching, Messaging, and Platform services.',
    )
    .setVersion('1.0.0')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        name: 'JWT',
        description: 'Enter JWT Access Token',
        in: 'header',
      },
      'JWT-auth',
    )
    .build();

  const document = SwaggerModule.createDocument(app, config);

  const rootPath = path.join(__dirname, '..', 'datemate-api.json');
  const docsPath = path.join(__dirname, '..', 'docs', 'api', 'swagger.json');

  fs.writeFileSync(rootPath, JSON.stringify(document, null, 2), 'utf-8');
  fs.writeFileSync(docsPath, JSON.stringify(document, null, 2), 'utf-8');

  console.log(`OpenAPI JSON exported to:`);
  console.log(` - ${rootPath}`);
  console.log(` - ${docsPath}`);

  await app.close();
  process.exit(0);
}

exportSwagger().catch((err) => {
  console.error('Failed to export Swagger JSON:', err);
  process.exit(1);
});
