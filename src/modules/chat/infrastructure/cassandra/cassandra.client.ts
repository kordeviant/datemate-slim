import { Injectable, OnModuleInit, OnModuleDestroy, Logger, Optional } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Client, mapping, types as CassandraTypes } from "cassandra-driver";
import { CassandraMigrationService } from "./cassandra-migration.service";

@Injectable()
export class CassandraClientService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(CassandraClientService.name);
  private client: Client;
  private isConnected = false;

  constructor(
    private readonly configService: ConfigService,
    @Optional() private readonly migrationService?: CassandraMigrationService,
  ) {
    const contactPoints = this.configService.get<string[]>("cassandra.contactPoints") || ["127.0.0.1"];
    const localDataCenter = this.configService.get<string>("cassandra.localDataCenter") || "datacenter1";
    const keyspace = this.configService.get<string>("cassandra.keyspace") || "datemate_chat";
    const username = this.configService.get<string>("cassandra.username");
    const password = this.configService.get<string>("cassandra.password");

    const clientOptions: any = {
      contactPoints,
      localDataCenter,
      keyspace,
      queryOptions: {
        prepare: true,
      },
    };

    if (username && password) {
      clientOptions.credentials = { username, password };
    }

    this.client = new Client(clientOptions);
  }

  async onModuleInit() {
    // We defer or attempt connection
    try {
      await this.connectWithRetry(3, 2000);
      if (this.migrationService) {
        try {
          await this.migrationService.runMigrations();
        } catch (migErr: any) {
          this.logger.warn(`Automatic Cassandra migration warning: ${migErr.message}`);
        }
      }
    } catch (err: any) {
      this.logger.warn(`Could not connect to Cassandra on startup: ${err.message}. Ensure Cassandra container is running.`);
    }
  }

  async onModuleDestroy() {
    if (this.isConnected) {
      await this.client.shutdown();
      this.isConnected = false;
      this.logger.log("Cassandra connection closed.");
    }
  }

  public getClient(): Client {
    return this.client;
  }

  public async connectWithRetry(maxRetries = 5, delayMs = 3000): Promise<void> {
    if (this.isConnected) return;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        await this.client.connect();
        this.isConnected = true;
        this.logger.log("Connected to Apache Cassandra successfully.");
        return;
      } catch (err: any) {
        this.logger.warn(`Cassandra connection attempt ${attempt}/${maxRetries} failed: ${err.message}`);
        if (attempt === maxRetries) {
          throw err;
        }
        await new Promise((res) => setTimeout(res, delayMs));
      }
    }
  }

  public toLong(val: number | string): CassandraTypes.Long {
    if (typeof val === "number") {
      return CassandraTypes.Long.fromNumber(val);
    }
    return CassandraTypes.Long.fromString(String(val));
  }

  public fromLong(val: any): number {
    if (!val) return 0;
    if (typeof val === "number") return val;
    if (typeof val.toNumber === "function") return val.toNumber();
    return Number(val.toString());
  }
}
