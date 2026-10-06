-- SQL script for InfinityFree (Database created via Control Panel)


-- Drop existing tables if re-importing
DROP TABLE IF EXISTS `order_items`;
DROP TABLE IF EXISTS `orders`;
DROP TABLE IF EXISTS `parts`;
DROP TABLE IF EXISTS `users`;

-- 1. Table: users
CREATE TABLE `users` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `fname` VARCHAR(100) NOT NULL,
  `lname` VARCHAR(100) NOT NULL,
  `phone` VARCHAR(20) NOT NULL UNIQUE,
  `email` VARCHAR(255) NULL UNIQUE,
  `google_id` VARCHAR(255) NULL UNIQUE,
  `address` TEXT NOT NULL,
  `role` ENUM('admin', 'customer') NOT NULL DEFAULT 'customer',
  `order_count` INT NOT NULL DEFAULT 0,
  `password` VARCHAR(255) NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table: settings (For Bot & AI Configuration)
CREATE TABLE IF NOT EXISTS `settings` (
  `key` VARCHAR(100) PRIMARY KEY,
  `value` TEXT NOT NULL,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. Table: parts
CREATE TABLE `parts` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `part_no` VARCHAR(50) NOT NULL UNIQUE,
  `name` VARCHAR(255) NOT NULL,
  `price` DECIMAL(10,2) NOT NULL,
  `category` ENUM('car', 'motorcycle') NOT NULL DEFAULT 'car',
  `image_url` VARCHAR(255) NOT NULL DEFAULT 'assets/images/default_part.jpg',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. Table: orders
CREATE TABLE `orders` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `user_id` INT NOT NULL,
  `order_date` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `subtotal` DECIMAL(10,2) NOT NULL,
  `discount` DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  `net_total` DECIMAL(10,2) NOT NULL,
  FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4. Table: order_items
CREATE TABLE `order_items` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `order_id` INT NOT NULL,
  `part_id` INT NOT NULL,
  `quantity` INT NOT NULL DEFAULT 1,
  `price_at_buy` DECIMAL(10,2) NOT NULL,
  FOREIGN KEY (`order_id`) REFERENCES `orders` (`id`) ON DELETE CASCADE,
  FOREIGN KEY (`part_id`) REFERENCES `parts` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Seed Data: Users
INSERT INTO `users` (`fname`, `lname`, `phone`, `email`, `address`, `role`, `order_count`, `password`) VALUES
('Admin', 'Honda', '0800000000', 'admin@honda.com', 'ศูนย์บริการ HONDA GENUINE PARTS กรุงเทพฯ', 'admin', 0, '$2y$10$wT3WfJc9wX.eYh6Z4P8/2uK7yPz9qV8bL1K6N0e5J4g3H2f1e0d9c'),
('สมชาย', 'ใจดี', '0812345678', NULL, '123/45 ถนนสุขุมวิท แขวงคลองเตย เขตคลองเตย กรุงเทพมหานคร 10110', 'customer', 9, '$2y$10$e8c1Q0Fz.4PzY6X9vW0eUu3A8J2K1L0M9N8O7P6Q5R4S3T2U1V0W'),
('Seree', 'Admin', '0899999999', 'seree999@gmail.com', 'ศูนย์บริหารจัดการ HONDA GENUINE PARTS', 'admin', 0, NULL),
('Asnawee', 'Admin', '0888888888', 'asnawee211248@gmail.com', 'ศูนย์บริหารจัดการ HONDA GENUINE PARTS', 'admin', 0, NULL);

-- Seed Data: Car Spare Parts (อะไหล่รถยนต์)
INSERT INTO `parts` (`part_no`, `name`, `price`, `category`, `image_url`) VALUES
('08234-P99K1NT1', 'น้ำมันเครื่องสังเคราะห์แท้ HONDA Full Synthetic 0W-20 (4 ลิตร)', 1250.00, 'car', 'assets/images/oil_0w20.jpg'),
('15400-RAF-T01', 'กรองน้ำมันเครื่องแท้ HONDA Engine Oil Filter (Civic/City/Jazz/CR-V)', 220.00, 'car', 'assets/images/oil_filter.jpg'),
('17220-5AA-A00', 'กรองอากาศเครื่องยนต์แท้ HONDA Air Filter (Civic FC/FK)', 480.00, 'car', 'assets/images/air_filter.jpg'),
('80291-T5A-J01', 'กรองแอร์แท้ HONDA Cabin Air Filter (City/Jazz/HR-V)', 350.00, 'car', 'assets/images/cabin_filter.jpg'),
('45022-TGN-G00', 'ผ้าเบรกหน้าแท้ HONDA Front Brake Pads (Civic Turbo)', 2450.00, 'car', 'assets/images/brake_pads_front.jpg'),
('43022-T4N-H00', 'ผ้าเบรกหลังแท้ HONDA Rear Brake Pads (HR-V / Jazz / City)', 1950.00, 'car', 'assets/images/brake_pads_rear.jpg'),
('9807B-561CW', 'หัวเทียนอิริเดียมแท้ HONDA Iridium Spark Plug (ชุด 4 หัว)', 1800.00, 'car', 'assets/images/spark_plug.jpg'),
('31110-5AY-H01', 'สายพานหน้าเครื่องแท้ HONDA Serpentine Belt', 650.00, 'car', 'assets/images/belt.jpg'),
('08268-P9917ZT1', 'น้ำมันเกียร์ CVT แท้ HONDA HCF-2 (4 ลิตร)', 1450.00, 'car', 'assets/images/cvt_fluid.jpg'),
('19045-PAA-A01', 'ฝาหม้อน้ำแท้ HONDA Radiator Cap 1.1 Bar', 290.00, 'car', 'assets/images/radiator_cap.jpg');

-- Seed Data: Motorcycle Spare Parts (อะไหล่รถจักรยานยนต์)
INSERT INTO `parts` (`part_no`, `name`, `price`, `category`, `image_url`) VALUES
('08234-2MA-K1NT1', 'น้ำมันเครื่องแท้ HONDA Protech Gold 4T 10W-30 (0.8 ลิตร รถเกียร์)', 145.00, 'motorcycle', 'assets/images/mc_oil_4t.jpg'),
('08234-2MA-P1NT1', 'น้ำมันเครื่องแท้ HONDA Protech AT 4T 10W-30 (0.8 ลิตร รถออโตเมติก)', 155.00, 'motorcycle', 'assets/images/mc_oil_at.jpg'),
('17210-K0W-900', 'กรองอากาศแท้ HONDA Air Filter (ADV150 / PCX150)', 210.00, 'motorcycle', 'assets/images/mc_air_filter.jpg'),
('17210-K26-900', 'กรองอากาศแท้ HONDA Air Filter (MSX125 / Wave125i)', 160.00, 'motorcycle', 'assets/images/mc_air_filter_wave.jpg'),
('06455-KWB-601', 'ผ้าเบรกหน้าแท้ HONDA Front Brake Pads (Wave110i / Wave125i / Click125i)', 230.00, 'motorcycle', 'assets/images/mc_brake_pads.jpg'),
('06430-KWN-900', 'ก้ามเบรกหลังแท้ HONDA Rear Brake Shoes (PCX150 / Click / Scoopy i)', 190.00, 'motorcycle', 'assets/images/mc_brake_shoe.jpg'),
('31916-KRM-841', 'หัวเทียนแท้ HONDA Spark Plug CPR7EA-9 (Wave110i / Wave125i)', 120.00, 'motorcycle', 'assets/images/mc_spark_plug.jpg'),
('23100-KZR-601', 'สายพานขับเคลื่อนแท้ HONDA Drive Belt (Click125i / PCX150)', 450.00, 'motorcycle', 'assets/images/mc_drive_belt.jpg'),
('22123-KWN-900', 'ชุดเม็ดชามขับแท้ HONDA Weight Roller Set (ชุด 6 ลูก for PCX/Click)', 280.00, 'motorcycle', 'assets/images/mc_weight_roller.jpg'),
('41201-K58-TC0', 'ชุดโซ่และสเตอร์แท้ HONDA Drive Chain & Sprocket Set (Wave110i / Super Cub)', 590.00, 'motorcycle', 'assets/images/mc_chain_kit.jpg');
