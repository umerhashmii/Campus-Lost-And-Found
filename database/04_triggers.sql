-- ========================================================
-- DBMS PROJECT: Campus Lost & Found Recovery System
-- Institution: Umaer Basha Institute of Information Technology (UBIT)
-- Authors: Syed Umer Hashmi, Maaz Malick, Muzammil Rizwan
-- File: 04_triggers.sql (Database Triggers & Lifecycle Automation)
-- ========================================================

USE campus_lost_and_found;

DELIMITER $$

-- --------------------------------------------------------
-- TRIGGER 1: Audit Log on Claim Status Transition
-- Fires AFTER UPDATE on claims table whenever status changes
-- Ensures 100% transparent audit history for university security
-- --------------------------------------------------------
DROP TRIGGER IF EXISTS trg_after_claim_status_update$$
CREATE TRIGGER trg_after_claim_status_update
AFTER UPDATE ON claims
FOR EACH ROW
BEGIN
    IF OLD.status <> NEW.status THEN
        INSERT INTO claim_audit_log (
            claim_id, 
            previous_status, 
            new_status, 
            action_by, 
            action_timestamp, 
            comments
        ) VALUES (
            NEW.claim_id,
            OLD.status,
            NEW.status,
            NEW.reviewer_id,
            NOW(),
            COALESCE(NEW.review_notes, 'Status transitioned automatically')
        );
    END IF;
END$$

-- --------------------------------------------------------
-- TRIGGER 2: Initial Audit Log on New Claim
-- Fires AFTER INSERT on claims table
-- --------------------------------------------------------
DROP TRIGGER IF EXISTS trg_after_claim_insert$$
CREATE TRIGGER trg_after_claim_insert
AFTER INSERT ON claims
FOR EACH ROW
BEGIN
    INSERT INTO claim_audit_log (
        claim_id, 
        previous_status, 
        new_status, 
        action_by, 
        action_timestamp, 
        comments
    ) VALUES (
        NEW.claim_id,
        NULL,
        NEW.status,
        NEW.claimant_id,
        NOW(),
        'Claim filed by user with submitted verification proof'
    );
END$$

-- --------------------------------------------------------
-- TRIGGER 3: Auto-Dismiss Matches when Lost Report is Cancelled
-- Fires AFTER UPDATE on lost_reports
-- --------------------------------------------------------
DROP TRIGGER IF EXISTS trg_after_lost_report_cancelled$$
CREATE TRIGGER trg_after_lost_report_cancelled
AFTER UPDATE ON lost_reports
FOR EACH ROW
BEGIN
    IF NEW.status = 'CANCELLED' AND OLD.status <> 'CANCELLED' THEN
        UPDATE matches 
        SET status = 'DISMISSED'
        WHERE lost_id = NEW.lost_id AND status = 'PROPOSED';
    END IF;
END$$

DELIMITER ;
