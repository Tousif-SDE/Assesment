/*
  Warnings:

  - You are about to drop the column `name` on the `room` table. All the data in the column will be lost.
  - Added the required column `roomName` to the `Room` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE `room` DROP COLUMN `name`,
    ADD COLUMN `batchYear` VARCHAR(191) NULL,
    ADD COLUMN `code` VARCHAR(191) NULL,
    ADD COLUMN `college` VARCHAR(191) NULL,
    ADD COLUMN `roomName` VARCHAR(191) NOT NULL,
    ADD COLUMN `subject` VARCHAR(191) NULL,
    ADD COLUMN `totalDuration` INTEGER NULL,
    ADD COLUMN `totalStudents` INTEGER NULL;
