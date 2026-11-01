-- CreateEnum
CREATE TYPE "AnswerType" AS ENUM ('SINGLE', 'MULTI');

-- AlterTable
ALTER TABLE "questions" ADD COLUMN     "answer_type" "AnswerType" NOT NULL DEFAULT 'SINGLE';
