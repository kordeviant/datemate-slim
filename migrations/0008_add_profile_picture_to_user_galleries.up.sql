-- Add the profile-picture flag expected by the Prisma UserGallery model.
ALTER TABLE "user_galleries"
ADD COLUMN "is_profile_picture" BOOLEAN NOT NULL DEFAULT false;