-- Drop the foreign key constraint on city_id if it exists
ALTER TABLE "demographics" DROP CONSTRAINT IF EXISTS "demographics_city_id_fkey";

-- Add city_name column to demographics table if it does not exist
ALTER TABLE "demographics" ADD COLUMN IF NOT EXISTS "city_name" VARCHAR(100);
