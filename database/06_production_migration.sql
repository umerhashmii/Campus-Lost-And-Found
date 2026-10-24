-- ========================================================
-- DBMS PROJECT: Campus Lost & Found Recovery System
-- Institution: Umaer Basha Institute of Information Technology (UBIT)
-- Authors: Syed Umer Hashmi, Maaz Malick, Muzammil Rizwan, Adan Kamran
-- File: 06_production_migration.sql (Production Campus Enhancements)
-- ========================================================

USE campus_lost_and_found;

-- 1. Modify users: Make enrollment_no optional (NULL) for visitors, guests, and other KU depts
ALTER TABLE users MODIFY COLUMN enrollment_no VARCHAR(20) NULL;

-- 2. Add image_url to lost_reports and found_reports (Safe column check)
SET @exist_lost_img := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA='campus_lost_and_found' AND TABLE_NAME='lost_reports' AND COLUMN_NAME='image_url');
SET @sql_lost_img := IF(@exist_lost_img = 0, 'ALTER TABLE lost_reports ADD COLUMN image_url VARCHAR(255) NULL AFTER description;', 'SELECT 1;');
PREPARE stmt_lost FROM @sql_lost_img;
EXECUTE stmt_lost;
DEALLOCATE PREPARE stmt_lost;

SET @exist_found_img := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA='campus_lost_and_found' AND TABLE_NAME='found_reports' AND COLUMN_NAME='image_url');
SET @sql_found_img := IF(@exist_found_img = 0, 'ALTER TABLE found_reports ADD COLUMN image_url VARCHAR(255) NULL AFTER description;', 'SELECT 1;');
PREPARE stmt_found FROM @sql_found_img;
EXECUTE stmt_found;
DEALLOCATE PREPARE stmt_found;

-- 3. Add pickup_pin to claims
SET @exist_claim_pin := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA='campus_lost_and_found' AND TABLE_NAME='claims' AND COLUMN_NAME='pickup_pin');
SET @sql_claim_pin := IF(@exist_claim_pin = 0, 'ALTER TABLE claims ADD COLUMN pickup_pin VARCHAR(12) NULL AFTER status;', 'SELECT 1;');
PREPARE stmt_pin FROM @sql_claim_pin;
EXECUTE stmt_pin;
DEALLOCATE PREPARE stmt_pin;

-- 3b. Update claims status ENUM to include HANDED_OVER
ALTER TABLE claims MODIFY COLUMN status ENUM('PENDING', 'UNDER_REVIEW', 'APPROVED', 'REJECTED', 'HANDED_OVER') NOT NULL DEFAULT 'PENDING';

-- 3c. Safe add disposal columns to found_reports if not exist
SET @exist_found_disposal := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA='campus_lost_and_found' AND TABLE_NAME='found_reports' AND COLUMN_NAME='disposal_type');
SET @sql_found_disposal := IF(@exist_found_disposal = 0, 
    'ALTER TABLE found_reports ADD COLUMN disposal_type ENUM(\'DONATED_TO_WELFARE\', \'E_WASTE\', \'AUCTION\', \'DESTROYED\') NULL DEFAULT NULL AFTER status, ADD COLUMN disposed_at DATETIME NULL DEFAULT NULL AFTER disposal_type, ADD COLUMN disposed_by INT NULL DEFAULT NULL AFTER disposed_at, ADD COLUMN disposal_notes TEXT NULL DEFAULT NULL AFTER disposed_by, ADD CONSTRAINT fk_found_disposed_by FOREIGN KEY (disposed_by) REFERENCES users(user_id) ON DELETE SET NULL;', 
    'SELECT 1;');
PREPARE stmt_disposal FROM @sql_found_disposal;
EXECUTE stmt_disposal;
DEALLOCATE PREPARE stmt_disposal;

-- 4. Create notifications table
CREATE TABLE IF NOT EXISTS notifications (
    notification_id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    title VARCHAR(120) NOT NULL,
    message TEXT NOT NULL,
    type ENUM('MATCH_FOUND', 'CLAIM_APPROVED', 'CLAIM_REJECTED', 'SYSTEM') NOT NULL,
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_notif_user FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
    INDEX idx_notif_user (user_id, is_read)
) ENGINE=InnoDB;

DELIMITER $$

-- 5. Enhanced Claim Review Procedure with 6-Digit Pickup PIN Generation
DROP PROCEDURE IF EXISTS sp_ProcessClaimReview$$
CREATE PROCEDURE sp_ProcessClaimReview(
    IN p_claim_id INT,
    IN p_reviewer_id INT,
    IN p_decision VARCHAR(20),
    IN p_review_notes TEXT,
    OUT p_result_code VARCHAR(30),
    OUT p_message VARCHAR(255),
    OUT p_generated_pin VARCHAR(12)
)
proc_label: BEGIN
    DECLARE v_found_id INT;
    DECLARE v_lost_id INT;
    DECLARE v_claimant_id INT;
    DECLARE v_current_claim_status VARCHAR(20);
    DECLARE v_pending_other_claims INT;
    DECLARE v_pin VARCHAR(12);

    DECLARE EXIT HANDLER FOR SQLEXCEPTION
    BEGIN
        ROLLBACK;
        SET p_result_code = 'ERROR';
        SET p_message = 'Database error occurred during claim review. Transaction rolled back.';
        SET p_generated_pin = NULL;
    END;

    START TRANSACTION;

    -- Lock the claim record
    SELECT found_id, lost_id, claimant_id, status 
    INTO v_found_id, v_lost_id, v_claimant_id, v_current_claim_status
    FROM claims
    WHERE claim_id = p_claim_id
    FOR UPDATE;

    IF v_current_claim_status IS NULL THEN
        ROLLBACK;
        SET p_result_code = 'NOT_FOUND';
        SET p_message = 'Claim record not found.';
        SET p_generated_pin = NULL;
        LEAVE proc_label;
    END IF;

    IF v_current_claim_status NOT IN ('PENDING', 'UNDER_REVIEW') THEN
        ROLLBACK;
        SET p_result_code = 'INVALID_STATE';
        SET p_message = CONCAT('Claim is already in final state: ', v_current_claim_status);
        SET p_generated_pin = NULL;
        LEAVE proc_label;
    END IF;

    -- Lock the corresponding found item
    SELECT found_id FROM found_reports WHERE found_id = v_found_id FOR UPDATE;

    -- Process Decision
    IF p_decision = 'APPROVED' THEN
        -- Generate random 6-digit pickup verification PIN
        SET v_pin = CONCAT('PIN-', LPAD(FLOOR(RAND() * 900000) + 100000, 6, '0'));

        -- Mark current claim as APPROVED and assign pickup PIN
        UPDATE claims
        SET status = 'APPROVED',
            pickup_pin = v_pin,
            reviewer_id = p_reviewer_id,
            review_notes = p_review_notes,
            reviewed_at = NOW()
        WHERE claim_id = p_claim_id;

        -- Auto-Reject all other competing claims for this found item
        UPDATE claims
        SET status = 'REJECTED',
            reviewer_id = p_reviewer_id,
            review_notes = 'Auto-rejected: Item ownership was verified for another claimant.',
            reviewed_at = NOW()
        WHERE found_id = v_found_id 
          AND claim_id <> p_claim_id 
          AND status IN ('PENDING', 'UNDER_REVIEW');

        -- Create in-app notification for the claimant
        INSERT INTO notifications (user_id, title, message, type)
        VALUES (
            v_claimant_id,
            'Claim Approved! Pickup Ready at Room 02',
            CONCAT('Your claim has been verified by campus security. Present your Pickup Code (', v_pin, ') at Admin Room 02 to retrieve your item.'),
            'CLAIM_APPROVED'
        );

        SET p_result_code = 'SUCCESS';
        SET p_message = CONCAT('Claim approved! Secure Pickup Code generated: ', v_pin);
        SET p_generated_pin = v_pin;

    ELSEIF p_decision = 'REJECTED' THEN
        -- Mark current claim as REJECTED
        UPDATE claims
        SET status = 'REJECTED',
            reviewer_id = p_reviewer_id,
            review_notes = p_review_notes,
            reviewed_at = NOW()
        WHERE claim_id = p_claim_id;

        -- Check if any other pending claims exist for this item
        SELECT COUNT(*) INTO v_pending_other_claims
        FROM claims
        WHERE found_id = v_found_id AND status IN ('PENDING', 'UNDER_REVIEW');

        -- If no more claims, return found item status to AVAILABLE
        IF v_pending_other_claims = 0 THEN
            UPDATE found_reports SET status = 'AVAILABLE' WHERE found_id = v_found_id;
        END IF;

        -- Create in-app notification for the claimant
        INSERT INTO notifications (user_id, title, message, type)
        VALUES (
            v_claimant_id,
            'Claim Status Update: Needs More Verification',
            CONCAT('Your claim was not approved: ', COALESCE(p_review_notes, 'Insufficient proof provided. Visit Admin Room 02 for in-person review.')),
            'CLAIM_REJECTED'
        );

        SET p_result_code = 'SUCCESS';
        SET p_message = 'Claim rejected. Item returned to pool if no other claims pending.';
        SET p_generated_pin = NULL;
    END IF;

    COMMIT;
END$$

-- 6. Stored Procedure for Two-Factor Handover Verification via 6-Digit PIN
DROP PROCEDURE IF EXISTS sp_VerifyHandoverPIN$$
CREATE PROCEDURE sp_VerifyHandoverPIN(
    IN p_claim_id INT,
    IN p_entered_pin VARCHAR(12),
    IN p_officer_id INT,
    OUT p_result_code VARCHAR(30),
    OUT p_message VARCHAR(255)
)
proc_label: BEGIN
    DECLARE v_found_id INT;
    DECLARE v_lost_id INT;
    DECLARE v_claimant_id INT;
    DECLARE v_stored_pin VARCHAR(12);
    DECLARE v_status VARCHAR(20);

    DECLARE EXIT HANDLER FOR SQLEXCEPTION
    BEGIN
        ROLLBACK;
        SET p_result_code = 'ERROR';
        SET p_message = 'Database error occurred during PIN verification. Transaction rolled back.';
    END;

    START TRANSACTION;

    SELECT found_id, lost_id, claimant_id, pickup_pin, status
    INTO v_found_id, v_lost_id, v_claimant_id, v_stored_pin, v_status
    FROM claims
    WHERE claim_id = p_claim_id
    FOR UPDATE;

    IF v_status IS NULL THEN
        ROLLBACK;
        SET p_result_code = 'NOT_FOUND';
        SET p_message = 'Claim record not found.';
        LEAVE proc_label;
    END IF;

    IF v_status <> 'APPROVED' THEN
        ROLLBACK;
        SET p_result_code = 'INVALID_STATUS';
        SET p_message = CONCAT('Cannot verify PIN. Claim status is: ', v_status);
        LEAVE proc_label;
    END IF;

    -- Clean PIN format comparison (case-insensitive and trimmed)
    IF UPPER(TRIM(p_entered_pin)) <> UPPER(TRIM(v_stored_pin)) AND 
       UPPER(TRIM(CONCAT('PIN-', p_entered_pin))) <> UPPER(TRIM(v_stored_pin)) THEN
        ROLLBACK;
        SET p_result_code = 'INVALID_PIN';
        SET p_message = 'Invalid verification PIN entered. Please confirm code on student screen.';
        LEAVE proc_label;
    END IF;

    -- Lock and resolve the found item
    UPDATE found_reports SET status = 'RESOLVED' WHERE found_id = v_found_id;

    -- Update claim record to HANDED_OVER
    UPDATE claims SET status = 'HANDED_OVER' WHERE claim_id = p_claim_id;

    -- If linked to a Lost Report, mark it as CLAIMED
    IF v_lost_id IS NOT NULL THEN
        UPDATE lost_reports SET status = 'CLAIMED' WHERE lost_id = v_lost_id;
        UPDATE matches SET status = 'RESOLVED' WHERE lost_id = v_lost_id AND found_id = v_found_id;
    END IF;

    -- Log handover confirmation in claim audit log
    INSERT INTO claim_audit_log (claim_id, previous_status, new_status, action_by, comments)
    VALUES (
        p_claim_id,
        'APPROVED',
        'HANDED_OVER',
        p_officer_id,
        CONCAT('Physical custody handover completed at Admin Room 02. Verified using 2FA PIN (', v_stored_pin, ').')
    );

    -- Create final confirmation notification
    INSERT INTO notifications (user_id, title, message, type)
    VALUES (
        v_claimant_id,
        'Item Successfully Retrieved!',
        'Your physical property has been handed over at Admin Room 02. Custody case is now formally closed.',
        'SYSTEM'
    );

    COMMIT;

    SET p_result_code = 'SUCCESS';
    SET p_message = 'PIN verified successfully! Custody handover completed and item resolved.';
END$$

-- 7. Stored Procedure for Bulk Statutory Unclaimed Property & Student Welfare Donation
DROP PROCEDURE IF EXISTS sp_ProcessUnclaimedDisposals$$
CREATE PROCEDURE sp_ProcessUnclaimedDisposals(
    IN p_days_threshold INT,
    IN p_action VARCHAR(50),
    IN p_authorized_by INT,
    OUT p_processed_count INT,
    OUT p_result_code VARCHAR(30),
    OUT p_message VARCHAR(255)
)
proc_label: BEGIN
    DECLARE v_count INT DEFAULT 0;

    DECLARE EXIT HANDLER FOR SQLEXCEPTION
    BEGIN
        ROLLBACK;
        SET p_result_code = 'ERROR';
        SET p_message = 'Database error during unclaimed property processing. Transaction rolled back.';
        SET p_processed_count = 0;
    END;

    START TRANSACTION;

    -- Count eligible overdue items
    SELECT COUNT(*) INTO v_count
    FROM found_reports
    WHERE status = 'AVAILABLE'
      AND DATEDIFF(NOW(), found_date) >= p_days_threshold;

    IF v_count = 0 THEN
        ROLLBACK;
        SET p_result_code = 'NO_ITEMS';
        SET p_message = CONCAT('No items found in custody exceeding ', p_days_threshold, ' days.');
        SET p_processed_count = 0;
        LEAVE proc_label;
    END IF;

    -- Update eligible found reports status to DISPOSED with audit metadata
    UPDATE found_reports
    SET status = 'DISPOSED',
        disposal_type = p_action,
        disposed_at = NOW(),
        disposed_by = p_authorized_by,
        disposal_notes = CONCAT('Bulk statutory disposal executed for threshold ', p_days_threshold, '+ days.')
    WHERE status = 'AVAILABLE'
      AND DATEDIFF(NOW(), found_date) >= p_days_threshold;

    -- Auto-expire any pending match proposals linked to these found reports
    UPDATE matches m
    JOIN found_reports f ON m.found_id = f.found_id
    SET m.status = 'EXPIRED'
    WHERE f.status = 'DISPOSED' AND m.status = 'PROPOSED';

    COMMIT;

    SET p_processed_count = v_count;
    SET p_result_code = 'SUCCESS';
    SET p_message = CONCAT(v_count, ' item(s) processed for: ', p_action, ' under authorization of Officer #', p_authorized_by);
END$$

-- 8. Stored Procedure for Single-Item Selective Disposal / Donation
DROP PROCEDURE IF EXISTS sp_ProcessSingleItemDisposal$$
CREATE PROCEDURE sp_ProcessSingleItemDisposal(
    IN p_found_id INT,
    IN p_action_type VARCHAR(50),
    IN p_notes TEXT,
    IN p_officer_id INT,
    OUT p_result_code VARCHAR(30),
    OUT p_message VARCHAR(255)
)
proc_label: BEGIN
    DECLARE v_status VARCHAR(20);
    DECLARE v_item_name VARCHAR(100);

    DECLARE EXIT HANDLER FOR SQLEXCEPTION
    BEGIN
        ROLLBACK;
        SET p_result_code = 'ERROR';
        SET p_message = 'Database error during single item disposal. Transaction rolled back.';
    END;

    START TRANSACTION;

    SELECT status, item_name INTO v_status, v_item_name
    FROM found_reports
    WHERE found_id = p_found_id
    FOR UPDATE;

    IF v_status IS NULL THEN
        ROLLBACK;
        SET p_result_code = 'NOT_FOUND';
        SET p_message = 'Found report record not found.';
        LEAVE proc_label;
    END IF;

    IF v_status <> 'AVAILABLE' THEN
        ROLLBACK;
        SET p_result_code = 'INVALID_STATUS';
        SET p_message = CONCAT('Cannot dispose item. Current status is: ', v_status);
        LEAVE proc_label;
    END IF;

    -- Update found report with disposal record
    UPDATE found_reports
    SET status = 'DISPOSED',
        disposal_type = p_action_type,
        disposed_at = NOW(),
        disposed_by = p_officer_id,
        disposal_notes = p_notes
    WHERE found_id = p_found_id;

    -- Expire any pending match proposals
    UPDATE matches
    SET status = 'EXPIRED'
    WHERE found_id = p_found_id AND status = 'PROPOSED';

    COMMIT;

    SET p_result_code = 'SUCCESS';
    SET p_message = CONCAT('Item #', p_found_id, ' ("', v_item_name, '") successfully processed for ', p_action_type, '.');
END$$

DELIMITER ;

DELIMITER ;
