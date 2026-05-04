export type ConnectionConfig = {
  connectionString: string;
  readReplicaUrl: string | null;
  isLocal: boolean;
  isTest: boolean;
};

export function isLocalDevelopment(): boolean {
  return process.env.VERCEL_ENV === 'development' || process.env.NODE_ENV === 'development';
}

export function isTestEnvironment(): boolean {
  return process.env.NODE_ENV === 'test' || process.env.VITEST === 'true';
}

export function getConnectionConfig(): ConnectionConfig {
  const connectionString = process.env.DATABASE_URL;
  const readReplicaUrl = process.env.READ_REPLICA_URL || null;
  const isLocal = isLocalDevelopment();
  const isTest = isTestEnvironment();

  if (!connectionString && isLocal && !isTest) {
    return {
      connectionString: 'postgres://postgres:password@localhost:5432/main',
      readReplicaUrl,
      isLocal,
      isTest,
    };
  }

  if (!connectionString) {
    throw new Error('DATABASE_URL environment variable is required');
  }

  return { connectionString, readReplicaUrl, isLocal, isTest };
}
