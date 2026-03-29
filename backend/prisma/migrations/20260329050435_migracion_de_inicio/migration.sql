/*
  Warnings:

  - A unique constraint covering the columns `[username]` on the table `User` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateEnum
CREATE TYPE "ClientType" AS ENUM ('CUSTOMER', 'SUPPLIER');

-- AlterTable
ALTER TABLE "Client" ADD COLUMN     "businessNumber" TEXT,
ADD COLUMN     "city" TEXT,
ADD COLUMN     "code" TEXT,
ADD COLUMN     "country" TEXT,
ADD COLUMN     "currency" TEXT NOT NULL DEFAULT 'USD',
ADD COLUMN     "displayName" TEXT,
ADD COLUMN     "groupId" TEXT,
ADD COLUMN     "ownerId" TEXT,
ADD COLUMN     "secondaryEmail" TEXT,
ADD COLUMN     "state" TEXT,
ADD COLUMN     "type" "ClientType" NOT NULL DEFAULT 'CUSTOMER',
ADD COLUMN     "zipCode" TEXT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "username" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");
