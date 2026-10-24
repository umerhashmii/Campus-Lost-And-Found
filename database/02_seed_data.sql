-- ========================================================
-- DBMS PROJECT: Campus Lost & Found Recovery System
-- Institution: Umaer Basha Institute of Information Technology (UBIT)
-- Authors: Syed Umer Hashmi, Maaz Malick, Muzammil Rizwan, Adan Kamran
-- File: 02_seed_data.sql (Realistic Campus Seed Data)
-- ========================================================

USE campus_lost_and_found;

-- 1. SEED USERS
-- Password for all demo accounts is 'password123'
INSERT INTO users (enrollment_no, full_name, email, phone, role, password_hash) VALUES
('EB25210006105', 'Syed Umer Hashmi', 'umer.hashmi@ubit.edu.pk', '0300-1112233', 'STUDENT', '$2a$10$7R9rR61Qz.Jt5vUomJpP5uvW6hJgT84y3uB30gC6kcmwL7U6rN4O6'),
('EB25210006036', 'Maaz Malick', 'maaz.malick@ubit.edu.pk', '0311-2223344', 'STUDENT', '$2a$10$7R9rR61Qz.Jt5vUomJpP5uvW6hJgT84y3uB30gC6kcmwL7U6rN4O6'),
('EB25210006079', 'Muzammil Rizwan', 'muzammil.rizwan@ubit.edu.pk', '0322-3334455', 'STUDENT', '$2a$10$7R9rR61Qz.Jt5vUomJpP5uvW6hJgT84y3uB30gC6kcmwL7U6rN4O6'),
('EB25210006085', 'Adan Kamran', 'adan.kamran@ubit.edu.pk', '0366-7778899', 'STUDENT', '$2a$10$7R9rR61Qz.Jt5vUomJpP5uvW6hJgT84y3uB30gC6kcmwL7U6rN4O6'),
('SEC-2026-01', 'Tariq Farooq', 'security.ubit@uok.edu.pk', '0333-4445566', 'SECURITY', '$2a$10$7R9rR61Qz.Jt5vUomJpP5uvW6hJgT84y3uB30gC6kcmwL7U6rN4O6'),
('ADM-2026-01', 'Prof. DBMS Supervisor', 'admin.dbms@ubit.edu.pk', '0344-5556677', 'ADMIN', '$2a$10$7R9rR61Qz.Jt5vUomJpP5uvW6hJgT84y3uB30gC6kcmwL7U6rN4O6'),
('EB25210006120', 'Ayesha Khan', 'ayesha.khan@ubit.edu.pk', '0355-6667788', 'STUDENT', '$2a$10$7R9rR61Qz.Jt5vUomJpP5uvW6hJgT84y3uB30gC6kcmwL7U6rN4O6');

-- 2. SEED LOCATIONS (UBIT & University of Karachi Campus)
INSERT INTO locations (building_name, room_floor, zone_type, description) VALUES
('UBIT Main Building', 'Ground Floor - Software Lab 1', 'LAB', 'Computer Systems and Programming Lab near entrance'),
('UBIT Main Building', '1st Floor - Networks & Security Lab', 'LAB', 'Networking Lab room 104 with Cisco switch racks'),
('UBIT Main Building', 'Auditorium & Seminar Hall', 'CLASSROOM', 'Central auditorium used for seminars and lectures'),
('Dr. Mahmud Husain Central Library', '2nd Floor Reference Section', 'LIBRARY', 'Quiet study tables facing the east wing'),
('UBIT Campus Canteen', 'Main Seating Area', 'CANTEEN', 'Tables near the coffee corner and juice stall'),
('UBIT Admin Block', 'Student Affairs Window', 'ADMIN_BLOCK', 'Inquiry counters and verification office'),
('University Sports Gymnasium', 'Badminton Court Area', 'SPORTS_GROUND', 'Indoor sports facility near student pavilion'),
('UBIT Parking Area', 'Motorcycle Stand Gate 2', 'PARKING', 'Covered parking shed adjacent to main department gate');

-- 3. SEED CATEGORIES
INSERT INTO categories (name, description) VALUES
('Student ID Cards & RFID Badges', 'University smart cards, library cards, and RFID gate tags'),
('Electronics & Laptops', 'Laptops, chargers, calculators, earphones, and power banks'),
('Mobile Devices', 'Smartphones, feature phones, and smartwatches'),
('Wallets & Backpacks', 'Handbags, coin wallets, documents pouches, and backpacks'),
('USB Drives & Hard Disks', 'Flash drives, external hard disks, and project storage'),
('Books & Course Folders', 'Textbooks, handwritten lecture notebooks, and project reports'),
('Keys & Personal Belongings', 'Bike keys, car keys, locker keys, water bottles, and glasses');

-- 4. SEED LOST REPORTS
INSERT INTO lost_reports (user_id, category_id, item_name, description, color, brand, location_id, lost_date, status) VALUES
(1, 1, 'UBIT Student Smart Card', 'ID Card with enrollment EB25210006105 in a blue lanyard', 'Blue', 'UBIT RFID', 1, '2026-10-18 11:30:00', 'OPEN'),
(2, 2, 'Dell 65W Type-C Laptop Charger', 'Black Dell laptop charger left on lab desk 14', 'Black', 'Dell', 2, '2026-10-19 14:15:00', 'OPEN'),
(3, 4, 'Brown Leather Wallet', 'Contains CNIC, cash, and green metro bus card', 'Brown', 'J. Junaid Jamshed', 5, '2026-10-19 13:00:00', 'OPEN'),
(6, 5, 'SanDisk 64GB Red USB Flash Drive', 'Contains DBMS semester project slides and SQL dumps', 'Red/Black', 'SanDisk Ultra', 1, '2026-10-20 09:45:00', 'OPEN'),
(1, 7, 'Honda CD70 Bike Key with UBIT Keychain', 'Single motorcycle ignition key with a metal eagle keychain', 'Silver', 'Honda', 8, '2026-10-17 17:00:00', 'OPEN');

-- 5. SEED FOUND REPORTS
INSERT INTO found_reports (finder_id, category_id, item_name, description, color, brand, location_id, found_date, custody_location, status) VALUES
(4, 1, 'Blue Lanyard with UBIT Student ID', 'Found on desktop keyboard table in Lab 1. Shows BSCS 4th sem', 'Blue', 'UBIT RFID', 1, '2026-10-18 13:00:00', 'UBIT Security Desk (Admin Room 02)', 'AVAILABLE'),
(3, 2, 'Dell USB-C 65W Power Adapter', 'Found plugged into wall socket behind row 2 in Network Lab', 'Black', 'Dell', 2, '2026-10-19 16:30:00', 'Handed to Lab Attendant Brother Asif', 'AVAILABLE'),
(6, 4, 'Brown Men Wallet', 'Found under bench at UBIT Canteen table 4. Has CNIC inside', 'Brown', 'Leather', 5, '2026-10-19 13:30:00', 'UBIT Security Desk (Admin Room 02)', 'AVAILABLE'),
(4, 7, 'Silver Motorcycle Key', 'Found near parking gate 2 fence pole', 'Silver', 'Honda', 8, '2026-10-18 08:30:00', 'Security Main Gate Booth', 'AVAILABLE');
