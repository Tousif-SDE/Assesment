-- AlterTable
ALTER TABLE `room` ADD COLUMN `description` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `submission` ADD COLUMN `timeTaken` INTEGER NULL;

-- AlterTable
ALTER TABLE `testcase` ADD COLUMN `description` VARCHAR(191) NULL;
