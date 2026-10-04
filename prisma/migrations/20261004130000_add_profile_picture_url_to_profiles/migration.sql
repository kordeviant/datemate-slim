-- Persist the public swipe-profile picture separately from the verification avatar.
ALTER TABLE "profiles"
ADD COLUMN "profile_picture_url" VARCHAR(512);