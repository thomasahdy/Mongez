CREATE OR REPLACE FUNCTION tasks_search_update() RETURNS trigger AS $$
BEGIN
  NEW."searchVector" :=
    setweight(to_tsvector('english', COALESCE(NEW.title, '')), 'A') ||
    setweight(to_tsvector('english', COALESCE(NEW.description, '')), 'B');
  RETURN NEW;
END
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tasks_search_vector_update ON "tasks";

CREATE TRIGGER tasks_search_vector_update
  BEFORE INSERT OR UPDATE ON "tasks"
  FOR EACH ROW EXECUTE FUNCTION tasks_search_update();
