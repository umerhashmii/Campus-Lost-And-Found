# UBIT DBMS Viva Defense & Presentation Guide
## Campus Lost & Found Recovery and Claim Verification System

* **Institution:** Umaer Basha Institute of Information Technology (UBIT), University of Karachi
* **Course:** Database Management Systems (DBMS) — 4th Semester
* **Project Team:**
  1. **Syed Umer Hashmi** (`EB25210006105`) — Lead Full-Stack & Database Architect
  2. **Maaz Malick** (`EB25210006036`) — Database Schema & Concurrency Specialist
  3. **Muzammil Rizwan** (`EB25210006079`) — Backend API & Analytics Specialist

---

## 1. Quick Project Architecture Overview

```text
┌────────────────────────────────────────────────────────────────────────┐
│                          CLAY DESIGN SYSTEM UI                         │
│   (HTML5, Vanilla CSS tokens, ES6 JavaScript, Responsive Flex/Grid)    │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ HTTP REST / JSON
┌───────────────────────────────────▼────────────────────────────────────┐
│                       EXPRESS.JS BACKEND API                           │
│     (Connection Pooling via mysql2/promise, Port 3000, CORS enabled)   │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ SQL Queries, CALL sp_*, SELECT FROM vw_*
┌───────────────────────────────────▼────────────────────────────────────┐
│                    MYSQL 8.0 RELATIONAL DATABASE                       │
│  8 Normalized 3NF Tables | ACID Transactions | InnoDB Row-Level Locks  │
│  Stored Procedures (Scoring & Locks) | Event Triggers | Dynamic Views  │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Top 10 Viva Questions & Model Answers

### Question 1: How is your database normalized to Third Normal Form (3NF)? Show a specific example.
**Model Answer:**
> "Our database schema is in strict Third Normal Form (3NF).
> 
> * **1NF Compliance:** All attributes are atomic (no repeating groups, comma-separated values, or nested tables), and every table possesses a primary key.
> * **2NF Compliance:** It satisfies 1NF, and all non-key attributes are fully functionally dependent on the entire primary key (no partial dependencies on composite keys).
> * **3NF Compliance:** It satisfies 2NF, and no non-key attribute is transitively dependent on the primary key ($X \rightarrow Y \rightarrow Z$).
> 
> **Specific Example of 3NF Elimination:**
> In our initial design of `found_reports`, we could have stored `location_name`, `building`, and `floor_number` directly in the report table. However, `found_id -> location_id -> building` represents a transitive dependency. If the building name for a lab changed, we would suffer from **Update Anomalies**. We decomposed this by creating an independent `locations` entity (`location_id`, `location_name`, `building`, `floor_number`). `found_reports` references only the foreign key `location_id`. Similarly, `categories` was extracted out of `lost_reports` and `found_reports` to prevent redundancy and insertion anomalies."

---

### Question 2: What is the most critical concurrency challenge in your project, and how did you solve it?
**Model Answer:**
> "The most critical challenge is the **Double-Claim Race Condition**. Suppose a lost Dell 65W laptop charger is found in Software Lab 1. Two students simultaneously claim that charger at the exact same millisecond. If we used standard `SELECT status FROM found_reports` followed by an `UPDATE`, both transactions would read `status = 'AVAILABLE'` simultaneously, leading to two conflicting claims being approved—a classic Lost Update / Race Condition.
> 
> **Our Solution:** We implemented **Pessimistic Concurrency Control** inside stored procedure `sp_SubmitClaim` using MySQL InnoDB's exclusive row lock:
> ```sql
> START TRANSACTION;
> SELECT status INTO v_item_status 
> FROM found_reports 
> WHERE found_id = p_found_id 
> FOR UPDATE;
> 
> IF v_item_status <> 'AVAILABLE' THEN
>     ROLLBACK;
>     SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Item unavailable';
> ELSE
>     INSERT INTO claims (...);
>     UPDATE found_reports SET status = 'UNDER_CLAIM' WHERE found_id = p_found_id;
>     COMMIT;
> END IF;
> ```
> `SELECT ... FOR UPDATE` acquires an exclusive ($X$) lock at the InnoDB storage engine level. When Thread A arrives, it locks that row. Thread B is physically blocked by InnoDB until Thread A commits. Once Thread A commits, status is `'UNDER_CLAIM'`. Thread B wakes up, reads `'UNDER_CLAIM'`, and automatically aborts with a 409 Conflict rollback."

---

### Question 3: Why choose Pessimistic Locking over Optimistic Locking?
**Model Answer:**
> "Optimistic locking relies on version numbers (`WHERE version = 1`) and checks on commit. While lightweight for read-heavy systems, in a high-stakes physical property handover where items are unique and scarce, physical custody must be locked immediately to prevent conflicting campus security protocols. Pessimistic row locking guarantees strict serializability ($S$) under ACID Isolation without phantom claims or dirty reads."

---

### Question 4: How does your two-way matching algorithm work? Why is it implemented in SQL rather than Node.js?
**Model Answer:**
> "Our two-way matching engine is encapsulated inside stored procedure `sp_GenerateMatchesForLostReport`. It evaluates 4 distinct weighted parameters to compute a composite confidence score between $0\%$ and $100\%$:
> 1. **Category Match ($40\%$):** Does the found item category exactly match the lost item category?
> 2. **Location Match ($25\%$):** Did the item get found in the same campus facility (e.g. *Software Lab 1 vs. Software Lab 1*)?
> 3. **Temporal Proximity ($25\%$):** Was the item found on or after the lost date, and within 72 hours? (Linear decay: $\max(0, 25 - \text{hours} \times 0.25)$).
> 4. **Brand / Color Fuzzy Match ($10\%$):** Substring match between brand and color description.
> 
> **Why in SQL?**
> Executing this inside a MySQL stored procedure eliminates network roundtrips. Instead of fetching thousands of raw records into Node.js memory, the database engine filters and scores in-memory using indexed relational joins, directly inserting into the `matches` table and setting the lost report to `'MATCHED'` if confidence exceeds the $60\%$ threshold."

---

### Question 5: What is the role of Triggers in your database?
**Model Answer:**
> "We use triggers to enforce **Immutable Audit Logging** and **Autonomous State Cascading**:
> 1. **`trg_after_claim_insert`:** Automatically generates an initial audit entry in `claim_audit_log` when a claim is filed.
> 2. **`trg_after_claim_status_update`:** Watches for any change to `claim_status` (e.g., `PENDING` $\rightarrow$ `APPROVED` or `REJECTED`). It records the old status, new status, reviewer ID, timestamp, and comments into `claim_audit_log`. Because this is done at the database engine level, no backend developer or malicious client can bypass the audit trail.
> 3. **`trg_after_lost_report_cancelled`:** If a student cancels their lost report, this trigger automatically deletes or marks stale match recommendations."

---

### Question 6: What are the analytical Views you implemented and why?
**Model Answer:**
> "We created four dedicated SQL Views:
> 1. **`vw_campus_recovery_rate`:** Aggregates total lost, total claimed, and percentage recovery rate grouped by category.
> 2. **`vw_location_hotspots`:** Aggregates incident counts across campus zones to identify theft/misplacement hotspots (e.g. *Canteen vs. Library vs. Labs*).
> 3. **`vw_security_claims_queue`:** Pre-joins `claims`, `users`, `found_reports`, and `locations` for campus security officers, displaying claimant details and custody location in one optimized view.
> 4. **`vw_active_match_feed`:** Surfaces active pairings with confidence scores $\ge 60\%$.
> 
> Views provide **Data Security** (hiding sensitive columns like user passwords), **Query Simplification**, and enable MySQL's query optimizer to cache query execution plans."

---

### Question 7: Which storage engine did you use in MySQL and why?
**Model Answer:**
> "We explicitly used **InnoDB**. Unlike older engines like MyISAM or Memory, InnoDB provides:
> 1. Full **ACID Compliance** (Atomicity, Consistency, Isolation, Durability).
> 2. **Row-Level Locking** (`SELECT ... FOR UPDATE`), which allows high concurrency without locking the entire table.
> 3. Native **Foreign Key Constraints** (`ON DELETE RESTRICT`, `ON UPDATE CASCADE`) to maintain referential integrity.
> 4. Crash recovery via Write-Ahead Logging (Redo and Undo logs)."

---

### Question 8: How did you verify referential integrity?
**Model Answer:**
> "All foreign keys in our tables (`lost_reports.user_id`, `claims.found_id`, `claims.claimant_id`, etc.) have explicit foreign key constraints referencing the parent table's primary key. If an administrator attempts to delete a student who has an active claim or open lost report, MySQL rejects the query with error code `1451: Cannot delete or update a parent row: a foreign key constraint fails`."

---

### Question 9: What indexes were created to guarantee sub-10ms performance?
**Model Answer:**
> "Beyond primary keys, we created targeted composite and secondary indexes:
> * `idx_lost_user_status` ON `lost_reports(user_id, status)`: Accelerates student dashboard loading.
> * `idx_found_category_status` ON `found_reports(category_id, status)`: Speeds up the matching engine.
> * `idx_matches_score` ON `matches(match_score DESC)`: Allows high-confidence matches to be fetched instantly without sorting overhead.
> * `idx_claims_found` ON `claims(found_id, claim_status)`: Ensures instant lookup during concurrency checks."

---

### Question 10: What design system did you adopt for the frontend and why?
**Model Answer:**
> "We adopted the **Clay Design System** (`DESIGN.md`). Instead of using bloated external CSS frameworks or generic default themes, we implemented custom design tokens using pure Vanilla CSS:
> * Warm cream canvas (`#fffaf0`) with saturated accent borders.
> * Modern Inter typography with negative letter-spacing for sharp readability.
> * Tactile card elevations, pill-shaped filter badges, and an official printable handover voucher."

---

## 3. Live Viva Demonstration Script (Step-by-Step)

Follow this 5-step script during your presentation to guarantee top marks:

### Step 1: Show the Student Dashboard & Active Feed
1. Open `http://localhost:3000` in the browser.
2. Select **Syed Umer Hashmi** as the Active User.
3. Click on the **⚡ Matches** tab.
4. Point out the live cards showing match percentages (e.g. *100% Match*).
5. Click **"Why this score? 💡"** to open the **Match Score Breakdown Modal**, showing the exact 4-factor formula (Category: +40, Location: +25, Proximity: +25, Brand/Color: +10).

### Step 2: The Showstopper — Live Concurrency Race Test
1. Click the top button: **"⚡ Test Concurrency Lock"**.
2. Explain to the teacher: *"Sir, we have built a live concurrency simulator that fires two concurrent HTTP requests at the exact same millisecond to claim Found Item #2 (Dell 65W Power Adapter)."*
3. Click **"🚀 Re-Run Concurrent Race"**.
4. Show the live output:
   * **Thread A (Maaz Malick):** Status `200 OK` (Acquired `SELECT ... FOR UPDATE` row lock, committed to `UNDER_CLAIM`).
   * **Thread B (Muzammil Rizwan):** Status `409 Conflict` (Safely blocked by InnoDB lock, rolled back).
5. Explain: *"This physically demonstrates ACID Isolation level and pessimistic row locking in MySQL InnoDB."*

### Step 3: Security Review & Official Handover Voucher
1. Switch active user to **Officer Farhan Akhtar (Campus Security)**.
2. Click on the **🛡️ Security** tab.
3. Review the pending claims queue.
4. For an approved claim, click **"Voucher 📄"**.
5. Show the **Campus Property Verification & Handover Voucher** complete with UBIT seal, voucher number, claimant details, item details, and physical officer signature line. Click Print to demonstrate PDF generation.

### Step 4: Show the Immutable Audit Log
1. In the Security Queue, click **"Audit"** on any claim.
2. Show the modal populated by database trigger `trg_after_claim_status_update`, tracking timestamps, previous status, new status, and the user who took action.

### Step 5: Campus Analytics & Hotspots
1. Click on the **📊 Analytics** tab.
2. Show:
   * **Campus Recovery Rate by Category** (computed by `vw_campus_recovery_rate`).
   * **UBIT Location Hotspots Grid** (Software Lab 1, Library, Canteen, Networks Lab color-coded by incident frequency).

---

## 4. Team Member Speaking Role Distribution

| Team Member | Presentation Topics |
| :--- | :--- |
| **Syed Umer Hashmi** (`EB25210006105`) | Introduction, Problem Statement, Clay Design Architecture, Live User Journey & Official Voucher demo. |
| **Maaz Malick** (`EB25210006036`) | 3NF Relational Schema Normalization, Functional Dependencies, Pessimistic Row Locking (`SELECT ... FOR UPDATE`), and the Live Concurrency Race Demo. |
| **Muzammil Rizwan** (`EB25210006079`) | 4-Factor Stored Procedure Matching Engine, Database Triggers & Audit Logging, and Analytics Views (`vw_recovery_rate`, `vw_hotspots`). |
