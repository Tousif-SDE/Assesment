/*
  Warnings:

  - The primary key for the `room` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to alter the column `id` on the `room` table. The data in that column could be lost. The data in that column will be cast from `VarChar(191)` to `Int`.
  - You are about to alter the column `roomId` on the `roomstudent` table. The data in that column could be lost. The data in that column will be cast from `VarChar(191)` to `Int`.
  - You are about to alter the column `roomId` on the `testcase` table. The data in that column could be lost. The data in that column will be cast from `VarChar(191)` to `Int`.

*/
-- DropForeignKey
ALTER TABLE `roomstudent` DROP FOREIGN KEY `RoomStudent_roomId_fkey`;

-- DropForeignKey
ALTER TABLE `testcase` DROP FOREIGN KEY `TestCase_roomId_fkey`;

-- AlterTable
ALTER TABLE `room` DROP PRIMARY KEY,
    MODIFY `id` INTEGER NOT NULL AUTO_INCREMENT,
    ADD PRIMARY KEY (`id`);

-- AlterTable
ALTER TABLE `roomstudent` MODIFY `roomId` INTEGER NOT NULL;

-- AlterTable
ALTER TABLE `testcase` MODIFY `roomId` INTEGER NOT NULL;

-- CreateTable
CREATE TABLE `RoomParticipant` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `roomId` INTEGER NOT NULL,
    `joinedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `RoomParticipant_userId_roomId_key`(`userId`, `roomId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `RoomStudent` ADD CONSTRAINT `RoomStudent_roomId_fkey` FOREIGN KEY (`roomId`) REFERENCES `Room`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TestCase` ADD CONSTRAINT `TestCase_roomId_fkey` FOREIGN KEY (`roomId`) REFERENCES `Room`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `RoomParticipant` ADD CONSTRAINT `RoomParticipant_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `RoomParticipant` ADD CONSTRAINT `RoomParticipant_roomId_fkey` FOREIGN KEY (`roomId`) REFERENCES `Room`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
