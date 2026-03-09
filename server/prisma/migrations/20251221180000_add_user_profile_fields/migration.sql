-- Add profile fields to User
ALTER TABLE "User" ADD COLUMN "displayName" TEXT;
ALTER TABLE "User" ADD COLUMN "location" TEXT;
ALTER TABLE "User" ADD COLUMN "bio" TEXT;
ALTER TABLE "User" ADD COLUMN "interests" TEXT;
