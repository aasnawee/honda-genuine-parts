-- Cloudflare D1 (SQLite) Schema for HONDA GENUINE PARTS

DROP TABLE IF EXISTS `order_items`;
DROP TABLE IF EXISTS `orders`;
DROP TABLE IF EXISTS `parts`;
DROP TABLE IF EXISTS `users`;

-- 1. Table: users
CREATE TABLE `users` (
  `id` INTEGER PRIMARY KEY AUTOINCREMENT,
  `fname` TEXT NOT NULL,
  `lname` TEXT NOT NULL,
  `phone` TEXT NOT NULL UNIQUE,
  `email` TEXT NULL UNIQUE,
  `google_id` TEXT NULL UNIQUE,
  `address` TEXT NOT NULL,
  `role` TEXT CHECK(role IN ('admin', 'customer')) NOT NULL DEFAULT 'customer',
  `order_count` INTEGER NOT NULL DEFAULT 0,
  `password` TEXT NULL,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Table: settings (For Bot & AI Configuration)
CREATE TABLE IF NOT EXISTS `settings` (
  `key` TEXT PRIMARY KEY,
  `value` TEXT NOT NULL DEFAULT '',
  `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 2. Table: parts
CREATE TABLE `parts` (
  `id` INTEGER PRIMARY KEY AUTOINCREMENT,
  `part_no` TEXT NOT NULL UNIQUE,
  `name` TEXT NOT NULL,
  `price` REAL NOT NULL,
  `category` TEXT CHECK(category IN ('car', 'motorcycle')) NOT NULL DEFAULT 'car',
  `image_url` TEXT NOT NULL DEFAULT 'assets/images/default_part.jpg',
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 3. Table: orders
CREATE TABLE `orders` (
  `id` INTEGER PRIMARY KEY AUTOINCREMENT,
  `user_id` INTEGER NOT NULL,
  `order_date` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `subtotal` REAL NOT NULL,
  `discount` REAL NOT NULL DEFAULT 0.00,
  `net_total` REAL NOT NULL,
  FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
);

-- 4. Table: order_items
CREATE TABLE `order_items` (
  `id` INTEGER PRIMARY KEY AUTOINCREMENT,
  `order_id` INTEGER NOT NULL,
  `part_id` INTEGER NOT NULL,
  `quantity` INTEGER NOT NULL DEFAULT 1,
  `price_at_buy` REAL NOT NULL,
  FOREIGN KEY (`order_id`) REFERENCES `orders` (`id`) ON DELETE CASCADE,
  FOREIGN KEY (`part_id`) REFERENCES `parts` (`id`) ON DELETE CASCADE
);

-- Seed Data: Users
-- Admin: 0800000000 / admin123
-- Somchai: 0812345678 / 123456 (order_count = 9 for test promotion)
INSERT INTO `users` (`id`, `fname`, `lname`, `phone`, `email`, `google_id`, `address`, `role`, `order_count`, `password`) VALUES
(1, 'Admin', 'Honda', '0800000000', NULL, NULL, 'ศูนย์บริการ HONDA GENUINE PARTS กรุงเทพฯ', 'admin', 0, '$2a$10$wN9vj9M.sN3T2O6J6A5y.eWf7oK1J6H4F3D2S1A0Z9X8C7V6B5N4M'),
(2, 'สมชาย', 'ใจดี', '0812345678', NULL, NULL, '123/45 ถนนสุขุมวิท แขวงคลองเตย เขตคลองเตย กรุงเทพมหานคร 10110', 'customer', 9, '$2a$10$wN9vj9M.sN3T2O6J6A5y.eWf7oK1J6H4F3D2S1A0Z9X8C7V6B5N4M');

-- Seed Data: Car Spare Parts (อะไหล่รถยนต์)
INSERT INTO `parts` (`id`, `part_no`, `name`, `price`, `category`, `image_url`) VALUES
(1, '08234-P99K1NT1', 'น้ำมันเครื่องสังเคราะห์แท้ HONDA Full Synthetic 0W-20 (4 ลิตร)', 1250.00, 'car', 'assets/images/oil_0w20.jpg'),
(2, '15400-RAF-T01', 'กรองน้ำมันเครื่องแท้ HONDA Engine Oil Filter (Civic/City/Jazz/CR-V)', 220.00, 'car', 'assets/images/oil_filter.jpg'),
(3, '17220-5AA-A00', 'กรองอากาศเครื่องยนต์แท้ HONDA Air Filter (Civic FC/FK)', 480.00, 'car', 'assets/images/air_filter.jpg'),
(4, '80291-T5A-J01', 'กรองแอร์แท้ HONDA Cabin Air Filter (City/Jazz/HR-V)', 350.00, 'car', 'assets/images/cabin_filter.jpg'),
(5, '45022-TGN-G00', 'ผ้าเบรกหน้าแท้ HONDA Front Brake Pads (Civic Turbo)', 2450.00, 'car', 'assets/images/brake_pads_front.jpg'),
(6, '43022-T4N-H00', 'ผ้าเบรกหลังแท้ HONDA Rear Brake Pads (HR-V / Jazz / City)', 1950.00, 'car', 'assets/images/brake_pads_rear.jpg'),
(7, '9807B-561CW', 'หัวเทียนอิริเดียมแท้ HONDA Iridium Spark Plug (ชุด 4 หัว)', 1800.00, 'car', 'assets/images/spark_plug.jpg'),
(8, '31110-5AY-H01', 'สายพานหน้าเครื่องแท้ HONDA Serpentine Belt', 650.00, 'car', 'assets/images/belt.jpg'),
(9, '08268-P9917ZT1', 'น้ำมันเกียร์ CVT แท้ HONDA HCF-2 (4 ลิตร)', 1450.00, 'car', 'assets/images/cvt_fluid.jpg'),
(10, '19045-PAA-A01', 'ฝาหม้อน้ำแท้ HONDA Radiator Cap 1.1 Bar', 290.00, 'car', 'assets/images/radiator_cap.jpg');

-- Seed Data: Motorcycle Spare Parts (อะไหล่รถจักรยานยนต์)
INSERT INTO `parts` (`id`, `part_no`, `name`, `price`, `category`, `image_url`) VALUES
(11, '08234-2MA-K1NT1', 'น้ำมันเครื่องแท้ HONDA Protech Gold 4T 10W-30 (0.8 ลิตร รถเกียร์)', 145.00, 'motorcycle', 'assets/images/mc_oil_4t.jpg'),
(12, '08234-2MA-P1NT1', 'น้ำมันเครื่องแท้ HONDA Protech AT 4T 10W-30 (0.8 ลิตร รถออโตเมติก)', 155.00, 'motorcycle', 'assets/images/mc_oil_at.jpg'),
(13, '17210-K0W-900', 'กรองอากาศแท้ HONDA Air Filter (ADV150 / PCX150)', 210.00, 'motorcycle', 'assets/images/mc_air_filter.jpg'),
(14, '17210-K26-900', 'กรองอากาศแท้ HONDA Air Filter (MSX125 / Wave125i)', 160.00, 'motorcycle', 'assets/images/mc_air_filter_wave.jpg'),
(15, '06455-KWB-601', 'ผ้าเบรกหน้าแท้ HONDA Front Brake Pads (Wave110i / Wave125i / Click125i)', 230.00, 'motorcycle', 'assets/images/mc_brake_pads.jpg'),
(16, '06430-KWN-900', 'ก้ามเบรกหลังแท้ HONDA Rear Brake Shoes (PCX150 / Click / Scoopy i)', 190.00, 'motorcycle', 'assets/images/mc_brake_shoe.jpg'),
(17, '31916-KRM-841', 'หัวเทียนแท้ HONDA Spark Plug CPR7EA-9 (Wave110i / Wave125i)', 120.00, 'motorcycle', 'assets/images/mc_spark_plug.jpg'),
(18, '23100-KZR-601', 'สายพานขับเคลื่อนแท้ HONDA Drive Belt (Click125i / PCX150)', 450.00, 'motorcycle', 'assets/images/mc_drive_belt.jpg'),
(19, '22123-KWN-900', 'ชุดเม็ดชามขับแท้ HONDA Weight Roller Set (ชุด 6 ลูก for PCX/Click)', 280.00, 'motorcycle', 'assets/images/mc_weight_roller.jpg'),
(20, '41201-K58-TC0', 'ชุดโซ่และสเตอร์แท้ HONDA Drive Chain & Sprocket Set (Wave110i / Super Cub)', 590.00, 'motorcycle', 'assets/images/mc_chain_kit.jpg');
