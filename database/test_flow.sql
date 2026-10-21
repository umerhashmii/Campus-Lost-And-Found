USE campus_lost_and_found;

-- 1. Test Claim Submission (ACID Transaction with Row Locking)
CALL sp_SubmitClaim(
    1, 
    1, 
    1, 
    'My enrollment number EB25210006105 is printed on the front and back of the smart card.', 
    @claim_id, 
    @res, 
    @msg
);

SELECT @claim_id AS new_claim_id, @res AS result_code, @msg AS result_message;

-- 2. Verify found item status transitioned to UNDER_CLAIM
SELECT found_id, item_name, status AS found_item_status FROM found_reports WHERE found_id = 1;

-- 3. Verify Trigger recorded the new claim in claim_audit_log
SELECT log_id, claim_id, previous_status, new_status, comments FROM claim_audit_log;

-- 4. Preview Security Queue View
SELECT claim_id, claimant_name, claimant_enrollment, found_item_name, custody_location, claim_status 
FROM vw_security_claims_queue;
