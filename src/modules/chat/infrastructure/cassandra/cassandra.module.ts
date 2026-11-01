import { Module } from "@nestjs/common";
import { CassandraClientService } from "./cassandra.client";
import { CassandraMigrationService } from "./cassandra-migration.service";
import { CassandraConversationRepository } from "./repositories/cassandra-conversation.repository";
import { CassandraConversationMemberRepository } from "./repositories/cassandra-conversation-member.repository";
import { CassandraMessageRepository } from "./repositories/cassandra-message.repository";
import { CassandraDirectPairRepository } from "./repositories/cassandra-direct-pair.repository";
import { CassandraMessageIdempotencyRepository } from "./repositories/cassandra-message-idempotency.repository";
import { CassandraGroupRepository } from "./repositories/cassandra-group.repository";
import { CassandraUserPresenceRepository } from "./repositories/cassandra-user-presence.repository";

@Module({
  providers: [
    CassandraClientService,
    CassandraMigrationService,
    {
      provide: "IConversationRepository",
      useClass: CassandraConversationRepository,
    },
    {
      provide: "IConversationMemberRepository",
      useClass: CassandraConversationMemberRepository,
    },
    {
      provide: "IMessageRepository",
      useClass: CassandraMessageRepository,
    },
    {
      provide: "IDirectPairRepository",
      useClass: CassandraDirectPairRepository,
    },
    {
      provide: "IMessageIdempotencyRepository",
      useClass: CassandraMessageIdempotencyRepository,
    },
    {
      provide: "IGroupRepository",
      useClass: CassandraGroupRepository,
    },
    {
      provide: "IUserPresenceRepository",
      useClass: CassandraUserPresenceRepository,
    },
  ],
  exports: [
    CassandraClientService,
    CassandraMigrationService,
    "IConversationRepository",
    "IConversationMemberRepository",
    "IMessageRepository",
    "IDirectPairRepository",
    "IMessageIdempotencyRepository",
    "IGroupRepository",
    "IUserPresenceRepository",
  ],
})
export class CassandraModule {}
