-- AlterTable
ALTER TABLE "spaces" ADD COLUMN     "prefix" TEXT NOT NULL DEFAULT 'PRJ';

-- CreateTable
CREATE TABLE "space_counters" (
    "spaceId" TEXT NOT NULL,
    "seq" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "space_counters_pkey" PRIMARY KEY ("spaceId")
);

-- AddForeignKey
ALTER TABLE "space_counters" ADD CONSTRAINT "space_counters_spaceId_fkey" FOREIGN KEY ("spaceId") REFERENCES "spaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
