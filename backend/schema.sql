-- ==========================================================================
-- GUARDIA — Smart Security System Database Schema
-- Database Name: guardia_db
-- Target: MySQL 8.0+ / MariaDB
-- ==========================================================================

CREATE DATABASE IF NOT EXISTS `guardia_db` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE `guardia_db`;

-- Disable Foreign Key checks temporarily for clean setup
SET FOREIGN_KEY_CHECKS = 0;
DROP TABLE IF EXISTS `access_credentials`;
DROP TABLE IF EXISTS `access_logs`;
DROP TABLE IF EXISTS `doors`;
DROP TABLE IF EXISTS `users`;
SET FOREIGN_KEY_CHECKS = 1;

-- 1. USERS TABLE
CREATE TABLE `users` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `name` VARCHAR(100) NOT NULL,
  `email` VARCHAR(150) NOT NULL UNIQUE,
  `password_hash` VARCHAR(255) NOT NULL,
  `pin_code` VARCHAR(10) DEFAULT '1234',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_email` (`email`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 2. DOORS TABLE
CREATE TABLE `doors` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `user_id` INT NOT NULL,
  `door_name` VARCHAR(100) DEFAULT 'Main Entrance Door',
  `status` ENUM('LOCKED', 'UNLOCKED', 'OPEN') DEFAULT 'LOCKED',
  `security_mode` ENUM('NORMAL', 'PRIVACY', 'EMERGENCY') DEFAULT 'NORMAL',
  `power_status` ENUM('AC', 'BATTERY') DEFAULT 'AC',
  `battery_level` INT DEFAULT 100,
  `alarm_status` TINYINT(1) DEFAULT 0,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 3. ACCESS CREDENTIALS TABLE (PIN, Fingerprint, RFID, etc.)
CREATE TABLE `access_credentials` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `user_id` INT NOT NULL,
  `door_id` INT NOT NULL,
  `method` VARCHAR(50) NOT NULL DEFAULT 'PIN',
  `credential_hash` VARCHAR(255) NOT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY `unique_user_door_cred` (`user_id`, `door_id`, `method`, `credential_hash`),
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`door_id`) REFERENCES `doors`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 4. ACCESS LOGS TABLE
CREATE TABLE `access_logs` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `user_id` INT NOT NULL,
  `door_id` INT NOT NULL,
  `access_method` VARCHAR(50) NOT NULL,
  `status` ENUM('granted', 'denied', 'system') NOT NULL,
  `description` VARCHAR(255) NOT NULL,
  `timestamp` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_user_time` (`user_id`, `timestamp`),
  INDEX `idx_user_method` (`user_id`, `access_method`),
  INDEX `idx_user_status` (`user_id`, `status`),
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`door_id`) REFERENCES `doors`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Seed Data (Default Admin User: alex@guardia.com / password: password123 / PIN: 1234)
-- Bcrypt hash below for password 'password123' and PIN '1234'
INSERT INTO `users` (`id`, `name`, `email`, `password_hash`, `pin_code`) 
VALUES (1, 'Alex Mercer', 'alex@guardia.com', '$2a$10$w8T0i/EaU6hYpTjG/rXvXeY6vSgWvKzGqR9oQeF9w4q6r7t8y9z0a', '1234')
ON DUPLICATE KEY UPDATE `id`=`id`;

INSERT INTO `doors` (`id`, `user_id`, `door_name`, `status`, `security_mode`, `power_status`, `battery_level`, `alarm_status`)
VALUES (1, 1, 'Alex\'s Smart Door', 'LOCKED', 'NORMAL', 'AC', 100, 0)
ON DUPLICATE KEY UPDATE `id`=`id`;

INSERT INTO `access_credentials` (`user_id`, `door_id`, `method`, `credential_hash`)
VALUES (1, 1, 'PIN', '$2a$10$eE61K7YJ4y3l2v7e8r9t0u1v2w3x4y5z6a7b8c9d0e1f2g3h4i5j6')
ON DUPLICATE KEY UPDATE `credential_hash`=VALUES(`credential_hash`);

INSERT INTO `access_logs` (`user_id`, `door_id`, `access_method`, `status`, `description`)
VALUES (1, 1, 'System Init', 'system', 'GUARDIA Database & User Account Online');
