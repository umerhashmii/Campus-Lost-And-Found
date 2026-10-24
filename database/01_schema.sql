-- ========================================================
-- DBMS PROJECT: Campus Lost & Found Recovery System
-- Institution: Umaer Basha Institute of Information Technology (UBIT)
-- Authors: Syed Umer Hashmi, Maaz Malick, Muzammil Rizwan, Adan Kamran
-- File: 01_schema.sql (3NF Relational Schema & Constraints)
-- ========================================================

DROP DATABASE IF EXISTS campus_lost_and_found;
CREATE DATABASE campus_lost_and_found 
CHARACTER SET utf8mb4 
COLLATE utf8mb4_unicode_ci;

USE campus_lost_and_found;

-- 1. USERS TABLE
CREATE TABLE users (
    user_id INT AUTO_INCREMENT PRIMARY KEY,
    enrollment_no VARCHAR(20) UNIQUE NULL,
    full_name VARCHAR(100) NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    phone VARCHAR(20) NOT NULL,
    role ENUM('STUDENT', 'STAFF', 'SECURITY', 'ADMIN') NOT NULL DEFAULT 'STUDENT',
    password_hash VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- 2. CAMPUS LOCATIONS TABLE
CREATE TABLE locations (
    location_id INT AUTO_INCREMENT PRIMARY KEY,
    building_name VARCHAR(100) NOT NULL,
    room_floor VARCHAR(100) NOT NULL,
    zone_type ENUM('LAB', 'LIBRARY', 'CLASSROOM', 'CANTEEN', 'SPORTS_GROUND', 'ADMIN_BLOCK', 'PARKING', 'OTHER') NOT NULL,
    description VARCHAR(255)
) ENGINE=InnoDB;

-- 3. ITEM CATEGORIES TABLE
CREATE TABLE categories (
    category_id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(50) UNIQUE NOT NULL,
    description VARCHAR(255)
) ENGINE=InnoDB;

-- 4. LOST REPORTS TABLE
CREATE TABLE lost_reports (
    lost_id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    category_id INT NOT NULL,
    item_name VARCHAR(100) NOT NULL,
    description TEXT NOT NULL,
    image_url VARCHAR(255) NULL,
    color VARCHAR(40),
    brand VARCHAR(60),
    location_id INT NOT NULL,
    lost_date DATETIME NOT NULL,
    status ENUM('OPEN', 'MATCHED', 'CLAIMED', 'EXPIRED', 'CANCELLED') NOT NULL DEFAULT 'OPEN',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_lost_user FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
    CONSTRAINT fk_lost_category FOREIGN KEY (category_id) REFERENCES categories(category_id),
    CONSTRAINT fk_lost_location FOREIGN KEY (location_id) REFERENCES locations(location_id),
    INDEX idx_lost_search (category_id, location_id, lost_date),
    INDEX idx_lost_status (status)
) ENGINE=InnoDB;

-- 5. FOUND REPORTS TABLE
CREATE TABLE found_reports (
    found_id INT AUTO_INCREMENT PRIMARY KEY,
    finder_id INT NOT NULL,
    category_id INT NOT NULL,
    item_name VARCHAR(100) NOT NULL,
    description TEXT NOT NULL,
    image_url VARCHAR(255) NULL,
    color VARCHAR(40),
    brand VARCHAR(60),
    location_id INT NOT NULL,
    found_date DATETIME NOT NULL,
    custody_location VARCHAR(120) NOT NULL DEFAULT 'Campus Security Office (Admin Block)',
    status ENUM('AVAILABLE', 'UNDER_CLAIM', 'RESOLVED', 'EXPIRED', 'DISPOSED') NOT NULL DEFAULT 'AVAILABLE',
    disposal_type ENUM('DONATED_TO_WELFARE', 'E_WASTE', 'AUCTION', 'DESTROYED') NULL DEFAULT NULL,
    disposed_at DATETIME NULL DEFAULT NULL,
    disposed_by INT NULL DEFAULT NULL,
    disposal_notes TEXT NULL DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_found_finder FOREIGN KEY (finder_id) REFERENCES users(user_id) ON DELETE CASCADE,
    CONSTRAINT fk_found_category FOREIGN KEY (category_id) REFERENCES categories(category_id),
    CONSTRAINT fk_found_location FOREIGN KEY (location_id) REFERENCES locations(location_id),
    CONSTRAINT fk_found_disposed_by FOREIGN KEY (disposed_by) REFERENCES users(user_id) ON DELETE SET NULL,
    INDEX idx_found_search (category_id, location_id, found_date),
    INDEX idx_found_status (status)
) ENGINE=InnoDB;

-- 6. MATCHES TABLE (Cross-Correlation between Lost & Found)
CREATE TABLE matches (
    match_id INT AUTO_INCREMENT PRIMARY KEY,
    lost_id INT NOT NULL,
    found_id INT NOT NULL,
    match_score DECIMAL(5,2) NOT NULL CHECK (match_score >= 0 AND match_score <= 100),
    status ENUM('PROPOSED', 'DISMISSED', 'CLAIM_INITIATED', 'RESOLVED', 'EXPIRED') NOT NULL DEFAULT 'PROPOSED',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_match_lost FOREIGN KEY (lost_id) REFERENCES lost_reports(lost_id) ON DELETE CASCADE,
    CONSTRAINT fk_match_found FOREIGN KEY (found_id) REFERENCES found_reports(found_id) ON DELETE CASCADE,
    CONSTRAINT uq_lost_found UNIQUE (lost_id, found_id),
    INDEX idx_match_score (match_score DESC)
) ENGINE=InnoDB;

-- 7. CLAIMS TABLE (Ownership Claim Verification)
CREATE TABLE claims (
    claim_id INT AUTO_INCREMENT PRIMARY KEY,
    found_id INT NOT NULL,
    claimant_id INT NOT NULL,
    lost_id INT NULL,
    proof_details TEXT NOT NULL,
    claim_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    status ENUM('PENDING', 'UNDER_REVIEW', 'APPROVED', 'REJECTED', 'HANDED_OVER') NOT NULL DEFAULT 'PENDING',
    pickup_pin VARCHAR(12) NULL,
    reviewer_id INT NULL,
    review_notes TEXT,
    reviewed_at DATETIME NULL,
    CONSTRAINT fk_claim_found FOREIGN KEY (found_id) REFERENCES found_reports(found_id) ON DELETE CASCADE,
    CONSTRAINT fk_claim_claimant FOREIGN KEY (claimant_id) REFERENCES users(user_id) ON DELETE CASCADE,
    CONSTRAINT fk_claim_lost FOREIGN KEY (lost_id) REFERENCES lost_reports(lost_id) ON DELETE SET NULL,
    CONSTRAINT fk_claim_reviewer FOREIGN KEY (reviewer_id) REFERENCES users(user_id) ON DELETE SET NULL,
    INDEX idx_claim_status (status)
) ENGINE=InnoDB;

-- 8. CLAIM AUDIT LOG (Audit trail for status transitions)
CREATE TABLE claim_audit_log (
    log_id INT AUTO_INCREMENT PRIMARY KEY,
    claim_id INT NOT NULL,
    previous_status VARCHAR(30),
    new_status VARCHAR(30) NOT NULL,
    action_by INT NULL,
    action_timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    comments TEXT,
    CONSTRAINT fk_audit_claim FOREIGN KEY (claim_id) REFERENCES claims(claim_id) ON DELETE CASCADE,
    CONSTRAINT fk_audit_user FOREIGN KEY (action_by) REFERENCES users(user_id) ON DELETE SET NULL
) ENGINE=InnoDB;
