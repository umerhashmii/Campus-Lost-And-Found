-- ========================================================
-- DBMS PROJECT: Campus Lost & Found Recovery System
-- Institution: Umaer Basha Institute of Information Technology (UBIT)
-- Authors: Syed Umer Hashmi, Maaz Malick, Muzammil Rizwan
-- File: 03_procedures_and_concurrency.sql (Stored Procedures & Concurrency Control)
-- ========================================================

USE campus_lost_and_found;

DELIMITER $$

-- --------------------------------------------------------
-- PROCEDURE 1: Automated Matching Engine
-- Compares a newly submitted Lost or Found report against open opposite reports
-- Calculates match confidence (0 - 100%) based on Category, Location, Date Proximity, and Color/Brand
-- --------------------------------------------------------
DROP PROCEDURE IF EXISTS sp_GenerateMatchesForLostReport$$
CREATE PROCEDURE sp_GenerateMatchesForLostReport(IN p_lost_id INT)
BEGIN
    DECLARE v_category_id INT;
    DECLARE v_location_id INT;
    DECLARE v_lost_date DATETIME;
    DECLARE v_color VARCHAR(40);
    DECLARE v_brand VARCHAR(60);

    -- Retrieve lost report details
    SELECT category_id, location_id, lost_date, color, brand
    INTO v_category_id, v_location_id, v_lost_date, v_color, v_brand
    FROM lost_reports
    WHERE lost_id = p_lost_id AND status IN ('OPEN', 'MATCHED');

    -- Insert or update matches against available found reports
    INSERT INTO matches (lost_id, found_id, match_score, status)
    SELECT 
        p_lost_id AS lost_id,
        f.found_id,
        (
            -- Category match (40 pts)
            (CASE WHEN f.category_id = v_category_id THEN 40.0 ELSE 0.0 END) +
            -- Exact Location match (25 pts) or Same Building match (15 pts)
            (CASE 
                WHEN f.location_id = v_location_id THEN 25.0 
                WHEN loc_f.building_name = loc_l.building_name THEN 15.0
                ELSE 0.0 
             END) +
            -- Date proximity (up to 25 pts)
            (CASE 
                WHEN ABS(TIMESTAMPDIFF(HOUR, v_lost_date, f.found_date)) <= 24 THEN 25.0
                WHEN ABS(TIMESTAMPDIFF(DAY, v_lost_date, f.found_date)) <= 3 THEN 18.0
                WHEN ABS(TIMESTAMPDIFF(DAY, v_lost_date, f.found_date)) <= 7 THEN 10.0
                ELSE 0.0 
             END) +
            -- Color or Brand match (10 pts)
            (CASE 
                WHEN (v_color IS NOT NULL AND LOWER(f.color) = LOWER(v_color)) 
                  OR (v_brand IS NOT NULL AND LOWER(f.brand) = LOWER(v_brand)) THEN 10.0
                ELSE 0.0 
             END)
        ) AS calculated_score,
        'PROPOSED' AS status
    FROM found_reports f
    JOIN locations loc_f ON f.location_id = loc_f.location_id
    JOIN locations loc_l ON loc_l.location_id = v_location_id
    WHERE f.status = 'AVAILABLE'
      AND f.category_id = v_category_id
      AND ABS(TIMESTAMPDIFF(DAY, v_lost_date, f.found_date)) <= 14
    HAVING calculated_score >= 40.0
    ON DUPLICATE KEY UPDATE 
        match_score = VALUES(match_score);

    -- Update lost report status to MATCHED if any match score >= 60
    IF EXISTS (SELECT 1 FROM matches WHERE lost_id = p_lost_id AND match_score >= 60.0) THEN
        UPDATE lost_reports SET status = 'MATCHED' WHERE lost_id = p_lost_id AND status = 'OPEN';
    END IF;
END$$


-- --------------------------------------------------------
-- PROCEDURE 2: Claim Submission with Pessimistic Locking
-- Concurrency Control: Prevents race conditions where two users attempt
-- to claim the exact same found item simultaneously.
-- Uses `SELECT ... FOR UPDATE` inside an ACID transaction.
-- --------------------------------------------------------
DROP PROCEDURE IF EXISTS sp_SubmitClaim$$
CREATE PROCEDURE sp_SubmitClaim(
    IN p_found_id INT,
    IN p_claimant_id INT,
    IN p_lost_id INT,
    IN p_proof_details TEXT,
    OUT p_claim_id INT,
    OUT p_result_code VARCHAR(30),
    OUT p_message VARCHAR(255)
)
proc_label: BEGIN
    DECLARE v_item_status VARCHAR(20);
    DECLARE v_existing_claim_count INT;

    -- Exit handler for SQL exceptions: Automatically Rollback
    DECLARE EXIT HANDLER FOR SQLEXCEPTION
    BEGIN
        ROLLBACK;
        SET p_result_code = 'ERROR';
        SET p_message = 'Database error occurred during claim processing. Transaction rolled back.';
    END;

    -- START ACID TRANSACTION
    START TRANSACTION;

    -- 1. PESSIMISTIC ROW-LEVEL LOCK: Lock the target found item
    SELECT status INTO v_item_status
    FROM found_reports
    WHERE found_id = p_found_id
    FOR UPDATE;

    -- 2. Verify existence and availability
    IF v_item_status IS NULL THEN
        ROLLBACK;
        SET p_result_code = 'NOT_FOUND';
        SET p_message = 'Found item does not exist.';
        LEAVE proc_label;
    END IF;

    IF v_item_status <> 'AVAILABLE' THEN
        ROLLBACK;
        SET p_result_code = 'UNAVAILABLE';
        SET p_message = CONCAT('Item is no longer available for claim. Current status: ', v_item_status, ' (held under lock).');
        LEAVE proc_label;
    END IF;

    -- 3. Check if this claimant already has a pending claim on this item
    SELECT COUNT(*) INTO v_existing_claim_count
    FROM claims
    WHERE found_id = p_found_id 
      AND claimant_id = p_claimant_id 
      AND status IN ('PENDING', 'UNDER_REVIEW');

    IF v_existing_claim_count > 0 THEN
        ROLLBACK;
        SET p_result_code = 'ALREADY_CLAIMED';
        SET p_message = 'You already have an active claim submitted for this item.';
        LEAVE proc_label;
    END IF;

    -- 4. Insert the new claim
    INSERT INTO claims (found_id, claimant_id, lost_id, proof_details, status)
    VALUES (p_found_id, p_claimant_id, p_lost_id, p_proof_details, 'PENDING');
    
    SET p_claim_id = LAST_INSERT_ID();

    -- 5. Transition found item to UNDER_CLAIM
    UPDATE found_reports
    SET status = 'UNDER_CLAIM'
    WHERE found_id = p_found_id;

    -- 6. Update match record status if linked
    IF p_lost_id IS NOT NULL THEN
        UPDATE matches 
        SET status = 'CLAIM_INITIATED' 
        WHERE lost_id = p_lost_id AND found_id = p_found_id;
    END IF;

    -- COMMIT TRANSACTION
    COMMIT;
    SET p_result_code = 'SUCCESS';
    SET p_message = 'Claim submitted successfully under concurrency lock.';
END$$


-- --------------------------------------------------------
-- PROCEDURE 3: Admin / Security Claim Review & Resolution
-- Safely approves or rejects a claim in an ACID transaction
-- --------------------------------------------------------
DROP PROCEDURE IF EXISTS sp_ProcessClaimReview$$
CREATE PROCEDURE sp_ProcessClaimReview(
    IN p_claim_id INT,
    IN p_reviewer_id INT,
    IN p_decision ENUM('APPROVED', 'REJECTED'),
    IN p_review_notes TEXT,
    OUT p_result_code VARCHAR(30),
    OUT p_message VARCHAR(255)
)
proc_label: BEGIN
    DECLARE v_found_id INT;
    DECLARE v_lost_id INT;
    DECLARE v_current_claim_status VARCHAR(20);
    DECLARE v_pending_other_claims INT;

    DECLARE EXIT HANDLER FOR SQLEXCEPTION
    BEGIN
        ROLLBACK;
        SET p_result_code = 'ERROR';
        SET p_message = 'Database error occurred during claim review. Transaction rolled back.';
    END;

    START TRANSACTION;

    -- Lock the claim record
    SELECT found_id, lost_id, status 
    INTO v_found_id, v_lost_id, v_current_claim_status
    FROM claims
    WHERE claim_id = p_claim_id
    FOR UPDATE;

    IF v_current_claim_status IS NULL THEN
        ROLLBACK;
        SET p_result_code = 'NOT_FOUND';
        SET p_message = 'Claim record not found.';
        LEAVE proc_label;
    END IF;

    IF v_current_claim_status NOT IN ('PENDING', 'UNDER_REVIEW') THEN
        ROLLBACK;
        SET p_result_code = 'INVALID_STATE';
        SET p_message = CONCAT('Claim is already in final state: ', v_current_claim_status);
        LEAVE proc_label;
    END IF;

    -- Lock the corresponding found item
    SELECT found_id FROM found_reports WHERE found_id = v_found_id FOR UPDATE;

    -- Process Decision
    IF p_decision = 'APPROVED' THEN
        -- Mark current claim as APPROVED
        UPDATE claims
        SET status = 'APPROVED',
            reviewer_id = p_reviewer_id,
            review_notes = p_review_notes,
            reviewed_at = NOW()
        WHERE claim_id = p_claim_id;

        -- Mark Found item as RESOLVED
        UPDATE found_reports
        SET status = 'RESOLVED'
        WHERE found_id = v_found_id;

        -- If linked to a Lost Report, mark it as CLAIMED
        IF v_lost_id IS NOT NULL THEN
            UPDATE lost_reports SET status = 'CLAIMED' WHERE lost_id = v_lost_id;
            UPDATE matches SET status = 'RESOLVED' WHERE lost_id = v_lost_id AND found_id = v_found_id;
        END IF;

        -- Auto-Reject all other competing claims for this found item
        UPDATE claims
        SET status = 'REJECTED',
            reviewer_id = p_reviewer_id,
            review_notes = 'Auto-rejected: Item was verified and returned to another rightful claimant.',
            reviewed_at = NOW()
        WHERE found_id = v_found_id 
          AND claim_id <> p_claim_id 
          AND status IN ('PENDING', 'UNDER_REVIEW');

        SET p_result_code = 'SUCCESS';
        SET p_message = 'Claim approved! Item resolved and conflicting claims closed.';

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

        SET p_result_code = 'SUCCESS';
        SET p_message = 'Claim rejected. Item returned to pool if no other claims pending.';
    END IF;

    COMMIT;
END$$

DELIMITER ;
