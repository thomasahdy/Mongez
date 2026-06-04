/*
  Warnings:

  - You are about to drop the column `userId` on the `comments` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[emailVerificationToken]` on the table `users` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `authorId` to the `comments` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "comments" DROP CONSTRAINT "comments_userId_fkey";

-- DropIndex
DROP INDEX "comments_userId_idx";

-- AlterTable
ALTER TABLE "comments" DROP COLUMN "userId",
ADD COLUMN     "authorId" TEXT NOT NULL,
ADD COLUMN     "deletedAt" TIMESTAMP(3),
ADD COLUMN     "isEdited" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "departments" ADD COLUMN     "description" TEXT;

-- AlterTable
ALTER TABLE "tasks" ADD COLUMN     "searchVector" tsvector;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "emailVerificationToken" TEXT,
ADD COLUMN     "emailVerifiedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "invitations" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "spaceId" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'MEMBER',
    "token" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "accepted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "invitations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "invitations_token_key" ON "invitations"("token");

-- CreateIndex
CREATE INDEX "invitations_email_spaceId_idx" ON "invitations"("email", "spaceId");

-- CreateIndex
CREATE INDEX "invitations_token_idx" ON "invitations"("token");

-- CreateIndex
CREATE INDEX "comments_authorId_idx" ON "comments"("authorId");

-- CreateIndex
CREATE INDEX "tasks_searchVector_idx" ON "tasks" USING GIN ("searchVector");

-- CreateIndex
CREATE UNIQUE INDEX "users_emailVerificationToken_key" ON "users"("emailVerificationToken");

-- AddForeignKey
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_spaceId_fkey" FOREIGN KEY ("spaceId") REFERENCES "spaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comments" ADD CONSTRAINT "comments_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
