-- ========================================================
-- DBMS PROJECT: Campus Lost & Found Recovery System
-- Institution: Umaer Basha Institute of Information Technology (UBIT)
-- Authors: Syed Umer Hashmi, Maaz Malick, Muzammil Rizwan, Adan Kamran
-- File: 02_seed_data.sql (Renewed Realistic Campus Seed Data with Authentic Photos)
-- ========================================================

USE campus_lost_and_found;

-- 1. SEED USERS
-- Password for all demo accounts is 'password123'
INSERT INTO users (enrollment_no, full_name, email, phone, role, password_hash) VALUES
('EB25210006105', 'Syed Umer Hashmi', 'umer.hashmi@ubit.edu.pk', '0300-1112233', 'STUDENT', '$2a$10$7R9rR61Qz.Jt5vUomJpP5uvW6hJgT84y3uB30gC6kcmwL7U6rN4O6'),
('EB25210006036', 'Maaz Malick', 'maaz.malick@ubit.edu.pk', '0311-2223344', 'STUDENT', '$2a$10$7R9rR61Qz.Jt5vUomJpP5uvW6hJgT84y3uB30gC6kcmwL7U6rN4O6'),
('EB25210006079', 'Muzammil Rizwan', 'muzammil.rizwan@ubit.edu.pk', '0322-3334455', 'STUDENT', '$2a$10$7R9rR61Qz.Jt5vUomJpP5uvW6hJgT84y3uB30gC6kcmwL7U6rN4O6'),
('EB-24210006007', 'Adan Kamran', 'adan.kamran@ubit.edu.pk', '0366-7778899', 'STUDENT', '$2a$10$7R9rR61Qz.Jt5vUomJpP5uvW6hJgT84y3uB30gC6kcmwL7U6rN4O6'),
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

-- 4. SEED LOST REPORTS (With verified high-resolution item photos)
INSERT INTO lost_reports (user_id, category_id, item_name, description, image_url, color, brand, location_id, lost_date, status) VALUES
(1, 1, 'UBIT Student Smart Card', 'ID Card with enrollment EB25210006105 in a blue lanyard', 'uploads/seed-id-card.jpg', 'Blue', 'UBIT RFID', 1, '2026-10-20 10:15:00', 'CLAIMED'),
(2, 2, 'Dell 65W Type-C Laptop Charger', 'Black Dell laptop charger left on lab desk 14', 'uploads/seed-dell-charger.jpg', 'Black', 'Dell', 2, '2026-10-21 14:15:00', 'MATCHED'),
(3, 4, 'Brown Leather Wallet', 'Contains CNIC, cash, and green metro bus card', 'uploads/seed-leather-wallet.jpg', 'Brown', 'J. Junaid Jamshed', 4, '2026-10-22 13:00:00', 'MATCHED'),
(4, 7, 'Honda CD70 Bike Key with Ribbon', 'Single motorcycle ignition key with red woven Honda keychain tag', 'uploads/seed-bike-keys.jpg', 'Silver/Black', 'Honda', 8, '2026-10-23 08:30:00', 'MATCHED'),
(7, 2, 'Casio FX-991ES Plus Calculator', 'Scientific calculator with slide cover left in seminar hall', 'uploads/seed-casio-calc.jpg', 'Silver', 'Casio', 3, '2026-10-23 15:00:00', 'OPEN');

-- 5. SEED FOUND REPORTS (With custody details, authentic photos, and historical disposal)
INSERT INTO found_reports (found_id, finder_id, category_id, item_name, description, image_url, color, brand, location_id, found_date, custody_location, status, disposal_type, disposed_at, disposed_by, disposal_notes) VALUES
(1, 5, 1, 'Blue Lanyard with UBIT Student ID', 'Recovered from desktop keyboard table in Lab 1. Shows EB25210006105', 'uploads/seed-id-card.jpg', 'Blue', 'UBIT RFID', 1, '2026-10-20 11:30:00', 'UBIT Security Desk (Admin Room 02)', 'RESOLVED', NULL, NULL, NULL, NULL),
(2, 6, 2, 'Dell USB-C 65W Power Adapter', 'Found plugged into wall socket behind row 2 in Network Lab', 'uploads/seed-dell-charger.jpg', 'Black', 'Dell', 2, '2026-10-21 16:30:00', 'Handed to Lab Attendant Brother Asif', 'AVAILABLE', NULL, NULL, NULL, NULL),
(3, 7, 4, 'Brown Men Leather Wallet', 'Found on quiet study table at Central Library 2nd floor. Has CNIC inside', 'uploads/seed-leather-wallet.jpg', 'Brown', 'Leather', 4, '2026-10-22 13:30:00', 'UBIT Security Desk (Admin Room 02)', 'UNDER_CLAIM', NULL, NULL, NULL, NULL),
(4, 5, 7, 'Silver Motorcycle Key with Honda Tag', 'Found near parking gate 2 fence pole with red woven Honda tag', 'uploads/seed-bike-keys.jpg', 'Silver/Black', 'Honda', 8, '2026-10-23 09:15:00', 'Security Main Gate Booth', 'UNDER_CLAIM', NULL, NULL, NULL, NULL),
(5, 2, 2, 'Casio Scientific Calculator FX-991ES', 'Found left on podium chair in CS Seminar Hall', 'uploads/seed-casio-calc.jpg', 'Silver', 'Casio', 3, '2026-10-23 16:15:00', 'UBIT Security Desk (Admin Room 02)', 'AVAILABLE', NULL, NULL, NULL, NULL),
(6, 3, 5, 'Kingston 64GB DataTraveler USB Drive', 'Metal flash drive with red strap found on computer lab desk', 'uploads/seed-usb-drive.jpg', 'Silver/Red', 'Kingston', 1, '2026-10-24 10:00:00', 'UBIT Security Desk (Admin Room 02)', 'AVAILABLE', NULL, NULL, NULL, NULL),
(7, 5, 4, 'HP Stream 14 Padded Laptop Sleeve & Notebook', 'Found in CS Seminar Hall back row, contains spiral lecture notebook. Held past statutory custody period.', 'uploads/seed-hp-sleeve.jpg', 'Black/Blue', 'HP', 3, '2026-06-12 11:00:00', 'Admin Room 02 Depository Shelf B3', 'AVAILABLE', NULL, NULL, NULL, NULL),
(8, 5, 7, 'Stainless Steel Campus Water Bottle', 'Blue insulated sports flask with university stickers left on gym bleachers. Held past 90 days.', 'uploads/seed-water-bottle.jpg', 'Blue', 'HydroFlask', 7, '2026-07-05 17:30:00', 'Security Main Gate Depot (Locker 04)', 'AVAILABLE', NULL, NULL, NULL, NULL),
(9, 5, 2, 'Texas Instruments TI-84 Plus Graphic Calculator', 'Found in CS Lab 2 during Spring semester exams. Exceeded 120-day holding window.', 'uploads/seed-casio-calc.jpg', 'Silver/Black', 'Texas Instruments', 2, '2026-05-10 09:00:00', 'UBIT Depository Room 02', 'DISPOSED', 'DONATED_TO_WELFARE', '2026-10-10 11:30:00', 5, 'Officially transferred to UBIT Student Welfare Committee for semester book bank distribution.');

-- 6. SEED CLAIMS (Realistic verification queue records)
INSERT INTO claims (claim_id, found_id, claimant_id, lost_id, proof_details, claim_date, status, pickup_pin, reviewer_id, review_notes, reviewed_at) VALUES
(1, 1, 1, 1, 'My university enrollment number EB25210006105 is embossed on the smart card with BSCS seal.', '2026-10-20 12:00:00', 'HANDED_OVER', '482910', 5, 'Card enrollment verified against DCS student register. 2FA PIN generated.', '2026-10-20 14:00:00'),
(2, 3, 3, 3, 'Brown leather wallet contains my CNIC ending in 4455, green Metro card, and ATM card under name Muzammil Rizwan.', '2026-10-22 14:30:00', 'PENDING', NULL, NULL, NULL, NULL),
(3, 4, 4, 4, 'Original CD70 ignition key with red woven Honda flight tag. Small scratch near top ring.', '2026-10-23 10:00:00', 'PENDING', NULL, NULL, NULL, NULL);

-- 7. SEED AUDIT LOG FOR CLAIM #1 (Full verification and handover trail)
INSERT INTO claim_audit_log (claim_id, previous_status, new_status, action_by, action_timestamp, comments) VALUES
(1, 'PENDING', 'APPROVED', 5, '2026-10-20 14:00:00', 'Identity verified against DCS database. 2FA Pickup PIN issued.'),
(1, 'APPROVED', 'HANDED_OVER', 5, '2026-10-20 14:15:00', 'Physical custody handover completed at Admin Room 02. Verified using 2FA PIN (482910).');
