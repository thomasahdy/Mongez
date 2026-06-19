process.env.DATABASE_URL = 'postgresql://mongez_test:mongeztestpassword@localhost:5435/mongez_db_test?schema=public';
process.env.REDIS_URL = 'redis://localhost:6381';
process.env.REDIS_HOST = 'localhost';
process.env.REDIS_PORT = '6381';
process.env.JWT_ACCESS_TOKEN_SECRET = 'test-access-secret';
process.env.JWT_REFRESH_TOKEN_SECRET = 'test-refresh-secret';
process.env.BCRYPT_SALT_OR_ROUNDS = '4';
process.env.NODE_ENV = 'test';
process.env.MAX_LOGIN_ATTEMPTS = '5';
process.env.LOCKOUT_DURATION_MINUTES = '15';
process.env.AI_SERVICE_URL = 'http://localhost:8001'; // Use a different port for mock AI service
process.env.AI_SERVICE_API_KEY = 'test-key';
process.env.AI_RATE_LIMIT = '30';
