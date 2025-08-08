/*
  Warnings:

  - You are about to drop the `roomparticipant` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE `roomparticipant` DROP FOREIGN KEY `RoomParticipant_roomId_fkey`;

-- DropForeignKey
ALTER TABLE `roomparticipant` DROP FOREIGN KEY `RoomParticipant_userId_fkey`;

-- DropTable
DROP TABLE `roomparticipant`;
