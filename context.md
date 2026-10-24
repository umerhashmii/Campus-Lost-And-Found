# Project Context & Living State Tracker

> **Notice for Future AI Sessions / Antigravity:**  
> This file is the single source of truth for the project. Always read this file first upon starting any new session to restore full context of the environment, schema, decisions, and current progress.

---

## 1. Project Metadata
* **Project Title:** Campus Lost & Found Recovery and Claim Verification System
* **Course:** Database Management Systems (DBMS) — 4th Semester
* **Institution:** Umaer Basha Institute of Information Technology (UBIT), University of Karachi
* **Academic Submission Date:** 02-Sep-2026
* **Team Members:**
  1. **Syed Umer Hashmi** (`EB25210006105`) — Lead Developer / Team Member
  2. **Maaz Malick** (`EB25210006036`) — Team Member
  3. **Muzammil Rizwan** (`EB25210006079`) — Team Member
  4. **Adan Kamran** (`EB25210006085`) — Team Member
* **Original Proposal File:** `DBMS_Project_Proposal_LostAndFound.xlsx`

---

## 2. Local Environment & Infrastructure Status
* **OS:** Windows 10/11 x64
* **Node.js:** `v24.20.0` (Installed via winget, PATH configured)
* **npm:** `v11.19.0` (PowerShell execution policy configured to `RemoteSigned`)
* **Git:** `v2.55.0.windows.5` (Initialized repository on branch `main`)
* **RDBMS:** MySQL Community Server `v8.0.46` (Windows Service: `MySQL80`, running automatically on port `3306`)
* **MySQL Credentials:**
  * Host: `localhost`
  * Port: `3306`
  * User: `root`
  * Password: `admin123`
  * Database Name: `campus_lost_and_found`
* **MySQL CLI Location:** `C:\Program Files\MySQL\MySQL Server 8.0\bin\mysql.exe` (Added to User PATH)

---

## 3. Database Architecture (3NF Relational Core)

The database `campus_lost_and_found` has been completely created, seeded, and verified on the local MySQL server.

### A. Tables Overview
1. `users`: Stores students, staff, security officers, and administrators with role-based attributes and password hashes.
2. `locations`: Campus locations across UBIT and UoK (e.g., Software Lab 1, Networks Lab, Central Library, UBIT Canteen, Admin Block).
3. `categories`: Item categories (ID cards, Electronics, Mobile devices, Wallets, USBs, Books, Keys).
4. `lost_reports`: Reports filed by owners (`OPEN`, `MATCHED`, `CLAIMED`, `EXPIRED`, `CANCELLED`).
5. `found_reports`: Reports filed by finders with custody office tracking (`AVAILABLE`, `UNDER_CLAIM`, `RESOLVED`, `EXPIRED`, `DISPOSED`).
6. `matches`: Cross-correlation pairings computed by the matching algorithm with confidence score (0–100%).
7. `claims`: Ownership claim filings with evidence description, reviewer status (`PENDING`, `UNDER_REVIEW`, `APPROVED`, `REJECTED`).
8. `claim_audit_log`: Immutable audit log tracking all status transitions, timestamps, and reviewers.

### B. Core Stored Procedures & ACID Concurrency
* **`sp_GenerateMatchesForLostReport(p_lost_id)`**:
  * Calculates weighted match confidence: Category (40%), Location (25%), Proximity (25%), Color/Brand (10%).
  * Automatically sets lost report status to `MATCHED` if match confidence >= 60%.
* **`sp_SubmitClaim(found_id, claimant_id, lost_id, proof, ...)`**:
  * **Pessimistic Concurrency Control:** Executes `SELECT status FROM found_reports WHERE found_id = ... FOR UPDATE` inside a `START TRANSACTION` block.
  * Guarantees that two students claiming the exact same found item simultaneously will not result in a race condition.
  * Transitions found item status to `UNDER_CLAIM`.
* **`sp_ProcessClaimReview(claim_id, reviewer_id, decision, notes, ...)`**:
  * Transactionally approves or rejects a claim.
  * On approval, automatically transitions found report to `RESOLVED`, marks lost report as `CLAIMED`, and automatically rejects all other competing claims for that found item.

### C. Triggers
* **`trg_after_claim_insert`**: Logs initial claim creation into `claim_audit_log`.
* **`trg_after_claim_status_update`**: Automatically records any status transition into `claim_audit_log`.
* **`trg_after_lost_report_cancelled`**: Auto-dismisses pending match proposals when a lost report is cancelled.

### D. Views
* **`vw_campus_recovery_rate`**: Aggregate recovery rate percentage by category.
* **`vw_location_hotspots`**: Frequency of lost vs found items across campus locations.
* **`vw_security_claims_queue`**: Real-time review queue for campus security officers.
* **`vw_active_match_feed`**: Live feed showing matched items and confidence scores.

---

## 4. Project File Map
```text
c:\University\DBMS Project 4th Semester\
├── .gitignore                          # Git ignore rules for node_modules, .env, build files
├── README.md                           # University project description & team details
├── context.md                          # Living state tracker (THIS FILE)
├── DESIGN.md                           # Clay Design System specification for UI
├── DBMS_Project_Proposal_LostAndFound.xlsx # Original submitted university proposal
├── database/
│   ├── 01_schema.sql                   # 3NF table definitions, constraints, and indexes
│   ├── 02_seed_data.sql                # Realistic UBIT campus seed data
│   ├── 03_procedures_and_concurrency.sql # Matching engine & pessimistic locking transaction
│   ├── 04_triggers.sql                 # Status change audit triggers
│   ├── 05_views.sql                    # Reporting and analytics views
│   ├── setup_database.ps1              # PowerShell script to deploy all SQL files to MySQL
│   └── test_flow.sql                   # SQL verification test script
└── docs/
    ├── PRD.md                          # Product Requirements Document
    ├── design.md                       # System Architecture & Normalization Proofs
    ├── API.md                          # Backend REST API Specification
    └── TASKS.md                        # Implementation Task Checklist
```

---

## 5. Progress & Milestones

| Milestone | Status | Details |
| :--- | :---: | :--- |
| **M1: Development Environment Setup** | DONE | Node.js LTS, Git, MySQL 8.0 running and verified. |
| **M2: Database Core & Schema (3NF)** | DONE | 8 tables, constraints, seed data, stored procedures, triggers, views deployed to MySQL. |
| **M3: Documentation & Planning** | DONE | Created PRD.md, design.md, API.md, TASKS.md, context.md, and adopted Clay DESIGN.md. |
| **M4: Backend API Development** | DONE | Express REST API connected to MySQL pool, running live on port 3000. |
| **M5: Frontend Prototype UI (Phase 1)** | DONE | Precision rebuilt navbar with Clay pill tabs, brand cluster, and avatar profile pill. |
| **M6: Advanced Academic Features (Phase 2-4)** | DONE | Live concurrency race simulator, match score explainer, campus hotspot map, custody handover voucher. |
| **M7: GitHub Sync & Viva Defense (Phase 5)** | DONE | Complete VIVA_PREP.md guide, finalize README.md, local Git commits clean on main (user will push remote later). |
| **M8: Official Campus App Overhaul** | DONE | Pulled TypeUI claymorphism skill, blended with UBIT official logo/maroon/gold branding in DESIGN.md, launched complete multi-page portal with Home Hub & Browse Catalog. |
| **M9: Vector Icon Standard & Navbar Layout Fix** | DONE | Replaced emojis with crisp inline SVG vector icons across navbar, quick cards, buttons, and tables. Resolved navbar horizontal clipping. Replaced match score gradient with solid official UBIT Academic Maroon (`#7A1521`) badge and gold accent. |
| **M10: Authentic Campus Image & Ambient 2D Integration** | DONE | Created Git restore point tag (`restore-point`) and backup branch (`restore-point-backup`). Integrated real UBIT campus building photos into Spatial Analytics facility spotlight, paired with soft floating ambient clay glow animations. |
| **M11: Hero Showcase Card & Spatial Facility Spotlight** | DONE | Reverted hero section back to the authentic photo showcase card (`images/ubit-1.jpg` with frosted glass label & live custody badge) per user preference. Retained the approved official campus facility spotlight card and spatial floor zone directory on the Analytics tab. |
| **M12: Production Campus Readiness & 2FA Handover** | DONE | Built local authentication with dual-pill toggle (mandatory phone, optional EB number for campus visitors), dynamic role-based navigation guards (hiding security/admin tools from students), "My Activity" personal tracking dashboard with 4-step stepper, two-factor 6-digit pickup PIN verification at Admin Room 02, real photo uploads via multer, 90-day unclaimed property depository with student welfare donation procedure, and in-app notification center. |

---

## 6. Official Campus Application Strategy (Pragmatic Scope)

Per user directive, the scope is strictly grounded in real UBIT operational constraints:

* **Pruned Out (Not needed / No hardware at UBIT):**
  * ❌ No barcode / RFID scanners.
  * ❌ No WhatsApp / SMS gateway APIs.
  * ❌ No complex storage bin / cabinet matrix (Admin Officer simply keeps items safely in the office).
  * ❌ No in-app secret challenge questions (Admin Officer investigates verbally face-to-face).
  * ❌ Internal map shelved for now.
* **Approved Core Scope Deployed:**
  * ✅ **Official Department Branding:** DCS UBIT Circular Seal (`ubit-logo.jpg`), Academic Maroon (`#7A1521`), Prestige Gold (`#D4AF37`), Poppins & Montserrat typography.
  * ✅ **Flagship Home Hub Landing Page:** Welcome hero, real-time campus counters, 4 quick-action clay cards, 3-step guided student journey, live recent activity ticker, institutional notice banner.
  * ✅ **Browse Property Directory:** Search-as-you-type filter with category pills (`ID Cards`, `Electronics`, `Bags`, `Books`, `Keys`), status badges, and claim initiation.
  * ✅ **90-Day Unclaimed Item Charity & Disposal Lifecycle:** Database-driven tracking with administrative sign-off report.
  * ✅ **In-Person Admin Officer Verification Workflow:** Simple, clean queue with official handover voucher printing with UBIT crest.
  * ✅ **ACID Concurrency Locking:** Live simulation proving pessimistic row locks (`SELECT ... FOR UPDATE`).

---

## 7. How to Resume Work (For Future AI Sessions)
1. Read this `context.md` file completely to restore full project state.
2. Review [`DESIGN.md`](file:///c:/University/DBMS%20Project%204th%20Semester/DESIGN.md) for the unified UBIT Claymorphism tokens.
3. Verify MySQL service is active: `mysql -u root -padmin123 campus_lost_and_found -e "SELECT COUNT(*) FROM users;"`
4. Verify Node server is running on `http://localhost:3000`.



