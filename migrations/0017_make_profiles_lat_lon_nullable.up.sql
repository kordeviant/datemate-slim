ALTER TABLE "profiles" ALTER COLUMN "latitude" DROP NOT NULL;
ALTER TABLE "profiles" ALTER COLUMN "longitude" DROP NOT NULL;
ALTER TABLE "profiles" ALTER COLUMN "latitude" SET DEFAULT 0;
ALTER TABLE "profiles" ALTER COLUMN "longitude" SET DEFAULT 0;
ALTER TABLE "profiles" ALTER COLUMN "first_name" DROP NOT NULL;
ALTER TABLE "profiles" ALTER COLUMN "first_name" SET DEFAULT '';
ALTER TABLE "profiles" ALTER COLUMN "avatar_url" DROP NOT NULL;
ALTER TABLE "profiles" ALTER COLUMN "avatar_url" SET DEFAULT '';
