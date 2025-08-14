-- AlterTable
ALTER TABLE `submission` ADD COLUMN `errorDetails` VARCHAR(191) NULL,
    ADD COLUMN `executionTime` DOUBLE NULL,
    ADD COLUMN `memoryUsed` INTEGER NULL;
