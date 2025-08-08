/*
  Warnings:

  - The primary key for the `room` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `batchYear` on the `room` table. All the data in the column will be lost.
  - You are about to drop the column `code` on the `room` table. All the data in the column will be lost.
  - You are about to drop the column `college` on the `room` table. All the data in the column will be lost.
  - You are about to drop the column `createdBy` on the `room` table. All the data in the column will be lost.
  - You are about to drop the column `roomName` on the `room` table. All the data in the column will be lost.
  - You are about to drop the column `subject` on the `room` table. All the data in the column will be lost.
  - You are about to drop the column `totalDuration` on the `room` table. All the data in the column will be lost.
  - You are about to drop the column `totalStudents` on the `room` table. All the data in the column will be lost.
  - You are about to drop the column `output` on the `submission` table. All the data in the column will be lost.
  - You are about to drop the column `status` on the `submission` table. All the data in the column will be lost.
  - You are about to drop the column `studentId` on the `submission` table. All the data in the column will be lost.
  - You are about to drop the column `createdBy` on the `testcase` table. All the data in the column will be lost.
  - You are about to drop the `roomstudent` table. If the table is not empty, all the data it contains will be lost.
  - Added the required column `name` to the `Room` table without a default value. This is not possible if the table is not empty.
  - Added the required column `teacherId` to the `Room` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `Room` table without a default value. This is not possible if the table is not empty.
  - Added the required column `language` to the `Submission` table without a default value. This is not possible if the table is not empty.
  - Added the required column `userId` to the `Submission` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE `room` DROP FOREIGN KEY `Room_createdBy_fkey`;

-- DropForeignKey
ALTER TABLE `roomstudent` DROP FOREIGN KEY `RoomStudent_roomId_fkey`;

-- DropForeignKey
ALTER TABLE `roomstudent` DROP FOREIGN KEY `RoomStudent_studentId_fkey`;

-- DropForeignKey
ALTER TABLE `submission` DROP FOREIGN KEY `Submission_studentId_fkey`;

-- DropForeignKey
ALTER TABLE `testcase` DROP FOREIGN KEY `TestCase_createdBy_fkey`;

-- DropForeignKey
ALTER TABLE `testcase` DROP FOREIGN KEY `TestCase_roomId_fkey`;

-- DropIndex
DROP INDEX `Room_code_key` ON `room`;

-- AlterTable
ALTER TABLE `room` DROP PRIMARY KEY,
    DROP COLUMN `batchYear`,
    DROP COLUMN `code`,
    DROP COLUMN `college`,
    DROP COLUMN `createdBy`,
    DROP COLUMN `roomName`,
    DROP COLUMN `subject`,
    DROP COLUMN `totalDuration`,
    DROP COLUMN `totalStudents`,
    ADD COLUMN `name` VARCHAR(191) NOT NULL,
    ADD COLUMN `teacherId` VARCHAR(191) NOT NULL,
    ADD COLUMN `updatedAt` DATETIME(3) NOT NULL,
    MODIFY `id` VARCHAR(191) NOT NULL,
    ADD PRIMARY KEY (`id`);

-- AlterTable
ALTER TABLE `submission` DROP COLUMN `output`,
    DROP COLUMN `status`,
    DROP COLUMN `studentId`,
    ADD COLUMN `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    ADD COLUMN `language` VARCHAR(191) NOT NULL,
    ADD COLUMN `userId` VARCHAR(191) NOT NULL;

-- AlterTable
ALTER TABLE `testcase` DROP COLUMN `createdBy`,
    ADD COLUMN `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    MODIFY `roomId` VARCHAR(191) NOT NULL;

-- DropTable
DROP TABLE `roomstudent`;

-- CreateTable
CREATE TABLE `RoomParticipant` (
    `id` VARCHAR(191) NOT NULL,
    `roomId` VARCHAR(191) NOT NULL,
    `studentId` VARCHAR(191) NOT NULL,
    `joinedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `Room` ADD CONSTRAINT `Room_teacherId_fkey` FOREIGN KEY (`teacherId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `RoomParticipant` ADD CONSTRAINT `RoomParticipant_roomId_fkey` FOREIGN KEY (`roomId`) REFERENCES `Room`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `RoomParticipant` ADD CONSTRAINT `RoomParticipant_studentId_fkey` FOREIGN KEY (`studentId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TestCase` ADD CONSTRAINT `TestCase_roomId_fkey` FOREIGN KEY (`roomId`) REFERENCES `Room`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Submission` ADD CONSTRAINT `Submission_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
