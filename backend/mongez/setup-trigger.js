const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('Creating full-text search trigger...');
  
  await prisma.$executeRawUnsafe(`
    CREATE OR REPLACE FUNCTION tasks_search_update() RETURNS trigger AS $$
    BEGIN
      NEW."searchVector" :=
        setweight(to_tsvector('english', COALESCE(NEW.title, '')), 'A') ||
        setweight(to_tsvector('english', COALESCE(NEW.description, '')), 'B');
      RETURN NEW;
    END
    $$ LANGUAGE plpgsql;
  `);

  await prisma.$executeRawUnsafe(`
    DROP TRIGGER IF EXISTS tasks_search_vector_update ON "tasks";
  `);

  await prisma.$executeRawUnsafe(`
    CREATE TRIGGER tasks_search_vector_update
      BEFORE INSERT OR UPDATE ON "tasks"
      FOR EACH ROW EXECUTE FUNCTION tasks_search_update();
  `);

  console.log('Trigger created successfully.');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
