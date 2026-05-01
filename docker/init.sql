-- Configure PostgreSQL for external access
-- This will be run when the container starts

-- Create the database if it doesn't exist
-- CREATE DATABASE mongez_db;

-- Allow remote connections with password authentication
-- This is needed for Prisma to connect from the host machine

-- Update pg_hba.conf to allow remote connections with md5 authentication
-- This is more compatible with Prisma than scram-sha-256

-- Note: In a real production environment, you would want to use
-- more secure authentication methods and specific IP ranges