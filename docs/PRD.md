# Product Requirements Document (PRD)

## Project Title
**Campus Lost & Found Recovery and Claim Verification System**

* **Academic Institution:** Umaer Basha Institute of Information Technology (UBIT), University of Karachi  
* **Course:** Database Management Systems (DBMS) — 4th Semester  
* **Authors:** Syed Umer Hashmi (`EB25210006105`), Maaz Malick (`EB25210006036`), Muzammil Rizwan (`EB25210006079`), Adan Kamran (`EB25210006085`)  
* **Version:** 1.0.0  
* **Date:** October 2026  

---

## 1. Problem Statement & Background
Across academic institutions like the University of Karachi, students and faculty routinely misplace vital belongings (student ID smart cards, laptops, USB flash drives containing semester projects, bags, and keys). Currently, lost-and-found management is informal, fragmented across unofficial WhatsApp groups or physical notice boards. These channels suffer from:
1. **Lack of Structure:** Details (location, color, brand, timestamp) are buried in unstructured chats.
2. **No Automated Matching:** Owners must manually sift through hundreds of messages to find their item.
3. **No Ownership Verification:** Fraudulent or mistaken claims occur frequently because there is no mechanism to verify ownership before hand-off.
4. **Zero Administrative Oversight:** Campus security and administration have no visibility into recovery rates or campus loss hotspots.

---

## 2. Product Objectives
1. **Automated Cross-Correlation:** Eliminate manual search by automatically matching new lost reports with available found reports based on multi-factor weighted scoring.
2. **Race-Condition Free Claims:** Implement ACID-compliant pessimistic locking (`SELECT ... FOR UPDATE`) to prevent two users from claiming the same found item simultaneously.
3. **Complete Lifecycle Transparency:** Provide an immutable audit trail (`claim_audit_log`) of every state transition from discovery to verification.
4. **Campus Security Analytics:** Equip university administration with real-time views of department recovery rates and loss hotspots.

---

## 3. User Personas & Roles

### 3.1 Student / Staff (Standard User)
* **Needs:** Quickly file a lost item report, file a found item report, view suggested matches, and submit a claim with proof of ownership.
* **Permissions:** Can create reports, view their own reports and suggested matches, and file claims. Cannot approve claims or access administrative views.

### 3.2 Campus Security Officer
* **Needs:** Manage physical item custody, review pending claims, verify claimant proofs, approve/reject hand-overs, and inspect match feeds.
* **Permissions:** Access to the Security Claims Review Queue, custody location updates, and claim decision processing (`APPROVED` / `REJECTED`).

### 3.3 System Administrator / Department Head
* **Needs:** View macro-level recovery metrics, identify campus loss hotspots, manage campus locations and categories, and review system audit logs.
* **Permissions:** Full access to all tables, analytical views, and configuration settings.

---

## 4. User Journeys

```mermaid
sequenceDiagram
    autonumber
    actor Owner as Student A (Owner)
    actor Finder as Student B (Finder)
    actor Security as Campus Security Officer
    participant DB as MySQL Relational Core

    Finder->>DB: Files Found Report (e.g. ID Card in Lab 1)
    DB->>DB: Stores item as AVAILABLE in custody
    Owner->>DB: Files Lost Report (e.g. ID Card in Lab 1)
    DB->>DB: Stored Procedure sp_GenerateMatches calculates Score (e.g. 100%)
    DB-->>Owner: Displays Ranked Match Notification
    Owner->>DB: Submits Claim with Proof (Calls sp_SubmitClaim with Row Lock)
    DB->>DB: Atomically locks item, marks UNDER_CLAIM, records trigger audit log
    Security->>DB: Inspects vw_security_claims_queue
    Security->>DB: Calls sp_ProcessClaimReview(APPROVED)
    DB->>DB: Marks item RESOLVED, marks lost report CLAIMED, rejects conflicting claims
    DB-->>Owner: Notifies resolution; item ready for pickup at Admin Desk
```

---

## 5. Functional Requirements

### 5.1 User Management Module
* **FR-1.1:** System shall store user credentials, university enrollment number, phone number, and assign one of four roles (`STUDENT`, `STAFF`, `SECURITY`, `ADMIN`).
* **FR-1.2:** Passwords must be hashed (BCrypt) before persistence.

### 5.2 Reporting Module
* **FR-2.1:** **Lost Report:** Allows users to record item name, category, campus location, date/time lost, description, color, and brand.
* **FR-2.2:** **Found Report:** Allows finders to record item details, campus location found, date/time found, and designated physical custody location (e.g., Security Desk).

### 5.3 Automated Matching Engine
* **FR-3.1:** Triggered automatically upon report submission or on demand.
* **FR-3.2:** Scores potential pairs using weighted attributes:
  * Category Match: 40%
  * Location Match: 25% (Exact) / 15% (Same building)
  * Date Proximity: 25% ($\le 24$h: 25%, $\le 3$d: 18%, $\le 7$d: 10%)
  * Color/Brand Match: 10%
* **FR-3.3:** Pairs with score $\ge 40\%$ are recorded in `matches`. Lost reports with matches $\ge 60\%$ transition to `MATCHED`.

### 5.4 Claim Verification & Concurrency Control (ACID)
* **FR-4.1:** Claimants can file a claim against an available found item by supplying unique proof (e.g., card number, phone serial number, distinguishing mark).
* **FR-4.2:** Must use pessimistic row-level locking (`SELECT ... FOR UPDATE`) in an isolated transaction to prevent race conditions from concurrent claimants.
* **FR-4.3:** Found item transitions to `UNDER_CLAIM` while pending.

### 5.5 Resolution & Administrative Review
* **FR-5.1:** Security officers can approve or reject claims.
* **FR-5.2:** Approving a claim sets found item to `RESOLVED`, sets lost report to `CLAIMED`, and automatically rejects all conflicting pending claims.
* **FR-5.3:** Rejecting a claim returns the item to `AVAILABLE` (if no other claims exist).

### 5.6 Automated Triggers & Audit Logging
* **FR-6.1:** Any insertion or status transition on claims automatically inserts a record into `claim_audit_log`.
* **FR-6.2:** If a lost report is cancelled, associated proposed matches are automatically dismissed.

### 5.7 Analytical & Security Reporting (Views)
* **FR-7.1:** `vw_campus_recovery_rate`: Recovery percentage across all categories.
* **FR-7.2:** `vw_location_hotspots`: Ranked list of campus locations by loss incident count.
* **FR-7.3:** `vw_security_claims_queue`: Real-time queue of pending claims with claimant details.

---

## 6. Non-Functional Requirements
* **Data Integrity:** 100% 3NF compliance with explicit foreign keys and check constraints.
* **Concurrency Safety:** Zero duplicate approvals under concurrent access.
* **Query Latency:** Matching procedure execution $< 50$ms for active campus records.
* **Auditability:** Complete, append-only history of claim decisions with officer timestamps.
