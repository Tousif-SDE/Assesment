/*
  Warnings:

  - Added the required column `code` to the `Submission` table without a default value. This is not possible if the table is not empty.
  - Added the required column `output` to the `Submission` table without a default value. This is not possible if the table is not empty.
  - Added the required column `status` to the `Submission` table without a default value. This is not possible if the table is not empty.
  - Added the required column `studentId` to the `Submission` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE `submission` DROP FOREIGN KEY `Submission_userId_fkey`;

-- AlterTable
ALTER TABLE `submission` ADD COLUMN `code` VARCHAR(191) NOT NULL,
    ADD COLUMN `output` VARCHAR(191) NOT NULL,
    ADD COLUMN `status` VARCHAR(191) NOT NULL,
    ADD COLUMN `studentId` VARCHAR(191) NOT NULL,
    MODIFY `userId` VARCHAR(191) NULL;

-- AddForeignKey
ALTER TABLE `Submission` ADD CONSTRAINT `Submission_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
