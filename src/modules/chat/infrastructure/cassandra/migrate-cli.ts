import { NestFactory } from "@nestjs/core";
import { AppModule } from "../../../../app.module";
import { CassandraMigrationService } from "./cassandra-migration.service";

async function run() {
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ["log", "error", "warn"] });
  const migrationService = app.get(CassandraMigrationService);
  try {
    console.log("Running Cassandra schema migrations...");
    await migrationService.runMigrations();
    console.log("Migrations executed successfully.");
    process.exit(0);
  } catch (err: any) {
    console.error("Migration failed:", err);
    process.exit(1);
  } finally {
    await app.close();
  }
}

run();
