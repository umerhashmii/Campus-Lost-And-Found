-- ========================================================
-- DBMS PROJECT: Campus Lost & Found Recovery System
-- Institution: Umaer Basha Institute of Information Technology (UBIT)
-- Authors: Syed Umer Hashmi, Maaz Malick, Muzammil Rizwan
-- File: 05_views.sql (Analytical & Operational Views)
-- ========================================================

USE campus_lost_and_found;

-- --------------------------------------------------------
-- VIEW 1: Campus Recovery Rate by Category
-- Measures recovery efficiency per item category
-- --------------------------------------------------------
CREATE OR REPLACE VIEW vw_campus_recovery_rate AS
SELECT 
    c.category_id,
    c.name AS category_name,
    COUNT(DISTINCT l.lost_id) AS total_lost_reports,
    COUNT(DISTINCT CASE WHEN l.status = 'CLAIMED' THEN l.lost_id END) AS successfully_recovered,
    ROUND(
        (COUNT(DISTINCT CASE WHEN l.status = 'CLAIMED' THEN l.lost_id END) * 100.0) / 
        NULLIF(COUNT(DISTINCT l.lost_id), 0), 
        1
    ) AS recovery_rate_percentage
FROM categories c
LEFT JOIN lost_reports l ON c.category_id = l.category_id
GROUP BY c.category_id, c.name;

-- --------------------------------------------------------
-- VIEW 2: Location Loss Hotspots
-- Surfaces the campus locations with the highest misplacement frequencies
-- --------------------------------------------------------
CREATE OR REPLACE VIEW vw_location_hotspots AS
SELECT 
    loc.location_id,
    loc.building_name,
    loc.room_floor,
    loc.zone_type,
    COUNT(DISTINCT l.lost_id) AS lost_items_count,
    COUNT(DISTINCT f.found_id) AS found_items_count,
    COUNT(DISTINCT CASE WHEN f.status = 'RESOLVED' THEN f.found_id END) AS resolved_items_count
FROM locations loc
LEFT JOIN lost_reports l ON loc.location_id = l.location_id
LEFT JOIN found_reports f ON loc.location_id = f.location_id
GROUP BY loc.location_id, loc.building_name, loc.room_floor, loc.zone_type
ORDER BY lost_items_count DESC;

-- --------------------------------------------------------
-- VIEW 3: Security Claims Review Queue
-- Live actionable queue for campus security officers
-- --------------------------------------------------------
CREATE OR REPLACE VIEW vw_security_claims_queue AS
SELECT 
    cl.claim_id,
    cl.claim_date,
    cl.status AS claim_status,
    cl.proof_details,
    u.full_name AS claimant_name,
    u.enrollment_no AS claimant_enrollment,
    u.phone AS claimant_phone,
    u.email AS claimant_email,
    f.found_id,
    f.item_name AS found_item_name,
    f.description AS found_description,
    f.custody_location,
    cat.name AS category_name,
    loc.building_name AS found_building,
    loc.room_floor AS found_room,
    m.match_score
FROM claims cl
JOIN users u ON cl.claimant_id = u.user_id
JOIN found_reports f ON cl.found_id = f.found_id
JOIN categories cat ON f.category_id = cat.category_id
JOIN locations loc ON f.location_id = loc.location_id
LEFT JOIN matches m ON (m.found_id = cl.found_id AND m.lost_id = cl.lost_id)
ORDER BY cl.claim_date ASC;

-- --------------------------------------------------------
-- VIEW 4: Active Lost & Found Match Feed
-- Displays ranked possible matches for students & staff
-- --------------------------------------------------------
CREATE OR REPLACE VIEW vw_active_match_feed AS
SELECT 
    m.match_id,
    m.match_score,
    m.status AS match_status,
    m.created_at AS matched_at,
    -- Lost item details
    l.lost_id,
    l.item_name AS lost_item_name,
    l.lost_date,
    u_lost.full_name AS owner_name,
    u_lost.email AS owner_email,
    -- Found item details
    f.found_id,
    f.item_name AS found_item_name,
    f.found_date,
    f.custody_location,
    cat.name AS category_name,
    loc_lost.room_floor AS lost_room,
    loc_found.room_floor AS found_room
FROM matches m
JOIN lost_reports l ON m.lost_id = l.lost_id
JOIN found_reports f ON m.found_id = f.found_id
JOIN users u_lost ON l.user_id = u_lost.user_id
JOIN categories cat ON l.category_id = cat.category_id
JOIN locations loc_lost ON l.location_id = loc_lost.location_id
JOIN locations loc_found ON f.location_id = loc_found.location_id
WHERE m.status IN ('PROPOSED', 'CLAIM_INITIATED')
ORDER BY m.match_score DESC;
