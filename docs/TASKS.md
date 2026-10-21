# Implementation Task Checklist

## Phase 1: Planning & Design (Current)
- [x] Read and analyze project proposal spreadsheet
- [x] Verify local environment (Node.js LTS, Git, MySQL 8.0)
- [x] Initialize Git repository with `.gitignore` and `README.md`
- [x] Create 3NF Relational Database Schema (`01_schema.sql`)
- [x] Create Realistic UBIT Seed Data (`02_seed_data.sql`)
- [x] Implement Stored Procedures & Concurrency Locking (`03_procedures_and_concurrency.sql`)
- [x] Implement Triggers & Audit Logging (`04_triggers.sql`)
- [x] Implement Analytical & Operational Views (`05_views.sql`)
- [x] Test end-to-end database flow via `test_flow.sql`
- [x] Create `context.md` living state tracker
- [x] Create Product Requirements Document (`docs/PRD.md`)
- [x] Create System Architecture & Normalization Specification (`docs/design.md`)
- [x] Create REST API Specification (`docs/API.md`)
- [x] Adopt Clay Design System (`DESIGN.md`) for complete UI styling & token definitions

---

## Phase 2: Backend API Development
- [ ] Initialize Node.js project (`package.json`)
- [ ] Install dependencies (`express`, `mysql2`, `dotenv`, `cors`)
- [ ] Set up MySQL connection pool with promise support (`src/config/db.js`)
- [ ] Implement Categories & Locations routes (`/api/categories`, `/api/locations`)
- [ ] Implement Lost Reports routes (`POST /api/lost`, `GET /api/lost`)
- [ ] Implement Found Reports routes (`POST /api/found`, `GET /api/found`)
- [ ] Implement Match Feed route (`GET /api/matches`)
- [ ] Implement Claim Submission with ACID concurrency procedure (`POST /api/claims`)
- [ ] Implement Security Review & Resolution route (`PATCH /api/claims/:id/review`)
- [ ] Implement Analytics Views routes (`/api/analytics/*`)
- [ ] Test all API endpoints with automated test script

---

## Phase 3: Frontend Prototype Development
- [ ] Review User's UI specification file
- [ ] Build core design system tokens & modern styles (CSS)
- [ ] Build Navigation & Role Switcher (Student vs. Security/Admin)
- [ ] Build Student Portal:
  - [ ] Lost Report filing form
  - [ ] Found Report filing form
  - [ ] Active Matches feed with confidence score badge
  - [ ] Claim Submission modal with proof entry
- [ ] Build Campus Security / Admin Portal:
  - [ ] Live Security Queue with Approve / Reject action modal
  - [ ] Campus Recovery Rate metrics cards & charts
  - [ ] Location Hotspots table & map visualization
  - [ ] Immutable Claim Audit Log viewer
- [ ] Cross-browser testing and responsiveness verification

---

## Phase 4: Integration, GitHub Sync & Final Delivery
- [ ] Connect remote GitHub repository
- [ ] Push code and documentation to GitHub
- [ ] Verify complete end-to-end user journey live in browser
- [ ] Prepare University Defense / Viva talking points for the team
