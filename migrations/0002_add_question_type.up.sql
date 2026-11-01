-- CreateEnum
CREATE TYPE "QuestionType" AS ENUM ('PERSONALITY', 'INTERESTS', 'LIFESTYLE', 'VALUES');

-- AlterTable
ALTER TABLE "questions" ADD COLUMN     "type" "QuestionType" NOT NULL DEFAULT 'PERSONALITY';
