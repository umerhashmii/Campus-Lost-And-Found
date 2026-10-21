# Campus Lost & Found Recovery and Claim Verification System

**Course:** Database Management Systems (DBMS) - 4th Semester  
**Institution:** Umaer Basha Institute of Information Technology (UBIT), University of Karachi  
**Team Members:**
- Syed Umer Hashmi (`EB25210006105`)
- Maaz Malick (`EB25210006036`)
- Muzammil Rizwan (`EB25210006079`)

---

## 📌 Project Overview
A DBMS-driven platform engineered to solve campus item misplacement (student ID cards, bags, electronics, keys, books) with automated matching, ACID-compliant claim verification, and administrative lifecycle management.

### Key Highlights
- **Automated Matching Engine:** Scored correlation between Lost and Found reports using category, location proximity, and time window.
- **ACID Concurrency Control:** Safe state transitions (`OPEN` → `UNDER_REVIEW` → `RESOLVED`) using transaction locking to prevent duplicate claims.
- **Database Triggers:** Automatic report expiry and status synchronization.
- **Analytical Views:** Hotspot recovery rates and loss distribution across campus departments.

---

## 🛠️ Tech Stack & Prerequisites
- **Database:** MySQL Community Server 8.0+ / MySQL Workbench
- **Backend:** Node.js (LTS) & Express
- **Frontend:** Modern Vanilla HTML5, CSS3, JavaScript (Glassmorphism & Responsive)
- **Version Control:** Git & GitHub
