export interface CassandraConfig {
  contactPoints: string[];
  localDataCenter: string;
  keyspace: string;
  username?: string;
  password?: string;
  autoMigrate: boolean;
  replicationFactor: number;
}

export const cassandraConfig = (): { cassandra: CassandraConfig } => {
  const contactPointsRaw = process.env.CASSANDRA_CONTACT_POINTS || process.env.CASSANDRA_HOSTS || '127.0.0.1';
  const contactPoints = contactPointsRaw.split(',').map((p) => p.trim()).filter(Boolean);

  return {
    cassandra: {
      contactPoints: contactPoints.length > 0 ? contactPoints : ['127.0.0.1'],
      localDataCenter: process.env.CASSANDRA_LOCAL_DATACENTER || process.env.CASSANDRA_DC || 'datacenter1',
      keyspace: process.env.CASSANDRA_KEYSPACE || 'datemate_chat',
      username: process.env.CASSANDRA_USERNAME,
      password: process.env.CASSANDRA_PASSWORD,
      autoMigrate: process.env.CASSANDRA_AUTO_MIGRATE !== 'false',
      replicationFactor: parseInt(process.env.CASSANDRA_REPLICATION_FACTOR || '1', 10),
    },
  };
};
