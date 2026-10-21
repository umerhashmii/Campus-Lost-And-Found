# REST API Specification

**Base URL:** `http://localhost:3000/api`  
**Data Format:** JSON (`application/json`)

---

## 1. Authentication & Users
* **`POST /api/auth/login`**
  * Body: `{ "email": "umer.hashmi@ubit.edu.pk", "password": "password123" }`
  * Response: `{ "success": true, "user": { "user_id": 1, "full_name": "Syed Umer Hashmi", "role": "STUDENT", "enrollment_no": "EB25210006105" } }`
* **`GET /api/users/me`**
  * Response: User profile details.

---

## 2. Master Data (Dropdowns & References)
* **`GET /api/categories`**
  * Response: Array of categories `[{ category_id, name, description }]`.
* **`GET /api/locations`**
  * Response: Array of campus locations `[{ location_id, building_name, room_floor, zone_type }]`.

---

## 3. Lost Reports
* **`GET /api/lost`**
  * Query params: `?status=OPEN&category_id=1&user_id=1`
  * Response: List of lost reports with category and location joins.
* **`POST /api/lost`**
  * Body: `{ "user_id": 1, "category_id": 1, "item_name": "...", "description": "...", "color": "Blue", "brand": "UBIT", "location_id": 1, "lost_date": "2026-10-18 11:30:00" }`
  * Action: Inserts into `lost_reports`, automatically invokes `sp_GenerateMatchesForLostReport(LAST_INSERT_ID())`.
  * Response: `{ "success": true, "lost_id": 12, "matches_generated": 2 }`
* **`PATCH /api/lost/:id/cancel`**
  * Action: Updates status to `CANCELLED` (triggers auto-dismiss of matches).

---

## 4. Found Reports
* **`GET /api/found`**
  * Query params: `?status=AVAILABLE&category_id=2`
  * Response: List of found reports with finder and custody location.
* **`POST /api/found`**
  * Body: `{ "finder_id": 4, "category_id": 1, "item_name": "...", "description": "...", "color": "Blue", "brand": "UBIT", "location_id": 1, "found_date": "2026-10-18 13:00:00", "custody_location": "Admin Desk" }`
  * Response: `{ "success": true, "found_id": 15 }`

---

## 5. Matches Feed
* **`GET /api/matches`**
  * Query params: `?lost_id=1` or `?user_id=1`
  * Response: Ranked matches from `vw_active_match_feed`.

---

## 6. Claims & Verification (ACID Concurrency)
* **`POST /api/claims`**
  * Body: `{ "found_id": 1, "claimant_id": 1, "lost_id": 1, "proof_details": "My student ID number is EB25210006105" }`
  * Action: Calls `sp_SubmitClaim` with row-level lock (`SELECT ... FOR UPDATE`).
  * Response (Success): `{ "success": true, "claim_id": 5, "message": "Claim submitted successfully under concurrency lock." }`
  * Response (Conflict): `{ "success": false, "code": "ALREADY_CLAIMED", "message": "You already have an active claim submitted for this item." }`

* **`PATCH /api/claims/:id/review`**
  * Role required: `SECURITY` or `ADMIN`
  * Body: `{ "reviewer_id": 4, "decision": "APPROVED" | "REJECTED", "review_notes": "ID Card verified with departmental register" }`
  * Action: Calls `sp_ProcessClaimReview`.
  * Response: `{ "success": true, "message": "Claim approved! Item resolved and conflicting claims closed." }`

* **`GET /api/claims/audit/:claim_id`**
  * Response: Complete audit history from `claim_audit_log`.

---

## 7. Admin & Security Analytics Views
* **`GET /api/analytics/recovery-rate`**
  * Source: `vw_campus_recovery_rate`
  * Response: Percentage and counts per category.
* **`GET /api/analytics/hotspots`**
  * Source: `vw_location_hotspots`
  * Response: Ranked locations with highest loss counts.
* **`GET /api/analytics/security-queue`**
  * Source: `vw_security_claims_queue`
  * Response: Pending items awaiting officer review.
