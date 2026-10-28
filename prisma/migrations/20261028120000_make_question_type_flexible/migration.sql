-- AlterTable: convert question.type from QuestionType enum to VARCHAR(100)
ALTER TABLE "questions" ALTER COLUMN "type" DROP DEFAULT;
ALTER TABLE "questions" ALTER COLUMN "type" TYPE VARCHAR(100) USING "type"::text;
ALTER TABLE "questions" ALTER COLUMN "type" SET DEFAULT 'PERSONALITY';
