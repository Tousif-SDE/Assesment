/*
  Warnings:

  - You are about to drop the column `code` on the `submission` table. All the data in the column will be lost.
  - You are about to drop the column `createdAt` on the `submission` table. All the data in the column will be lost.
  - You are about to drop the column `language` on the `submission` table. All the data in the column will be lost.
  - Added the required column `createdBy` to the `TestCase` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE `testcase` DROP FOREIGN KEY `TestCase_roomId_fkey`;

-- AlterTable
ALTER TABLE `submission` DROP COLUMN `code`,
    DROP COLUMN `createdAt`,
    DROP COLUMN `language`;

-- AlterTable
ALTER TABLE `testcase` ADD COLUMN `createdBy` VARCHAR(191) NOT NULL;

-- AddForeignKey
ALTER TABLE `TestCase` ADD CONSTRAINT `TestCase_roomId_fkey` FOREIGN KEY (`roomId`) REFERENCES `Room`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
