import { execSync } from 'child_process';
import path from 'path';

export default async () => {
  console.log('\n[Jest Global Setup] Setting up test database & containers...');
  
  const dbUrl = 'postgresql://mongez_test:mongeztestpassword@localhost:5435/mongez_db_test?schema=public';
  process.env.DATABASE_URL = dbUrl;
  process.env.REDIS_URL = 'redis://localhost:6381';
  process.env.NODE_ENV = 'test';

  const composePath = path.resolve(__dirname, '../../docker-compose.test.yml');
  
  try {
    console.log('[Jest Global Setup] Spinning up Docker containers...');
    execSync(`docker compose -f "${composePath}" up -d`, { stdio: 'inherit' });
    
    // Wait for PostgreSQL to be ready
    console.log('[Jest Global Setup] Waiting for PostgreSQL to initialize...');
    await new Promise((resolve) => setTimeout(resolve, 3000));
    
    console.log('[Jest Global Setup] Pushing Prisma schema to test database...');
    const schemaPath = path.resolve(__dirname, '../../prisma/schema.prisma');
    execSync(`npx prisma db push --schema="${schemaPath}" --accept-data-loss --force-reset`, {
      stdio: 'inherit',
      env: { ...process.env, DATABASE_URL: dbUrl }
    });
    
    console.log('[Jest Global Setup] Ready for integration testing!');
  } catch (error) {
    console.error('[Jest Global Setup] Error setting up test environment:', error);
    throw error;
  }
};
