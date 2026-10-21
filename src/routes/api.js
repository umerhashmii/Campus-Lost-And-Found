const express = require('express');
const router = express.Router();
const db = require('../config/db');

// ==========================================
// 1. MASTER DATA: Categories & Locations
// ==========================================

router.get('/categories', async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM categories ORDER BY name ASC');
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/locations', async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM locations ORDER BY building_name, room_floor ASC');
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ==========================================
// 2. USERS & DEMO AUTH
// ==========================================

router.get('/users', async (req, res) => {
  try {
    const [rows] = await db.query('SELECT user_id, enrollment_no, full_name, email, phone, role FROM users ORDER BY user_id ASC');
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/auth/login', async (req, res) => {
  try {
    const { email } = req.body;
    const [rows] = await db.query('SELECT user_id, enrollment_no, full_name, email, phone, role FROM users WHERE email = ?', [email]);
    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    res.json({ success: true, user: rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ==========================================
// 3. LOST REPORTS
// ==========================================

router.get('/lost', async (req, res) => {
  try {
    const { user_id, status } = req.query;
    let query = `
      SELECT l.*, c.name AS category_name, loc.building_name, loc.room_floor, u.full_name AS owner_name, u.email AS owner_email
      FROM lost_reports l
      JOIN categories c ON l.category_id = c.category_id
      JOIN locations loc ON l.location_id = loc.location_id
      JOIN users u ON l.user_id = u.user_id
      WHERE 1=1
    `;
    const params = [];
    if (user_id) {
      query += ' AND l.user_id = ?';
      params.push(user_id);
    }
    if (status) {
      query += ' AND l.status = ?';
      params.push(status);
    }
    query += ' ORDER BY l.created_at DESC';

    const [rows] = await db.query(query, params);
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/lost', async (req, res) => {
  const connection = await db.getConnection();
  try {
    const { user_id, category_id, item_name, description, color, brand, location_id, lost_date } = req.body;
    
    // 1. Insert Lost Report
    const [result] = await connection.query(
      `INSERT INTO lost_reports (user_id, category_id, item_name, description, color, brand, location_id, lost_date)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [user_id, category_id, item_name, description, color || null, brand || null, location_id, lost_date]
    );

    const lostId = result.insertId;

    // 2. Invoke Stored Procedure Matching Engine
    await connection.query('CALL sp_GenerateMatchesForLostReport(?)', [lostId]);

    // 3. Fetch any matches generated
    const [matches] = await connection.query(
      'SELECT m.*, f.item_name AS found_item_name FROM matches m JOIN found_reports f ON m.found_id = f.found_id WHERE m.lost_id = ?',
      [lostId]
    );

    res.json({
      success: true,
      message: 'Lost report filed successfully! Automated matching engine executed.',
      lost_id: lostId,
      matches_found: matches.length,
      matches
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  } finally {
    connection.release();
  }
});

router.patch('/lost/:id/cancel', async (req, res) => {
  try {
    const lostId = req.params.id;
    await db.query("UPDATE lost_reports SET status = 'CANCELLED' WHERE lost_id = ?", [lostId]);
    res.json({ success: true, message: 'Report cancelled. Associated matches dismissed.' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ==========================================
// 4. FOUND REPORTS
// ==========================================

router.get('/found', async (req, res) => {
  try {
    const { status, category_id } = req.query;
    let query = `
      SELECT f.*, c.name AS category_name, loc.building_name, loc.room_floor, u.full_name AS finder_name
      FROM found_reports f
      JOIN categories c ON f.category_id = c.category_id
      JOIN locations loc ON f.location_id = loc.location_id
      JOIN users u ON f.finder_id = u.user_id
      WHERE 1=1
    `;
    const params = [];
    if (status) {
      query += ' AND f.status = ?';
      params.push(status);
    }
    if (category_id) {
      query += ' AND f.category_id = ?';
      params.push(category_id);
    }
    query += ' ORDER BY f.created_at DESC';

    const [rows] = await db.query(query, params);
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/found', async (req, res) => {
  const connection = await db.getConnection();
  try {
    const { finder_id, category_id, item_name, description, color, brand, location_id, found_date, custody_location } = req.body;
    
    const [result] = await connection.query(
      `INSERT INTO found_reports (finder_id, category_id, item_name, description, color, brand, location_id, found_date, custody_location)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [finder_id, category_id, item_name, description, color || null, brand || null, location_id, found_date, custody_location || 'Campus Security Office (Admin Block)']
    );

    const foundId = result.insertId;

    // Run matching engine against all open lost reports for this category
    const [openLostReports] = await connection.query(
      "SELECT lost_id FROM lost_reports WHERE status IN ('OPEN', 'MATCHED') AND category_id = ?",
      [category_id]
    );

    for (const report of openLostReports) {
      await connection.query('CALL sp_GenerateMatchesForLostReport(?)', [report.lost_id]);
    }

    res.json({
      success: true,
      message: 'Found report recorded! Matching engine checked against open lost reports.',
      found_id: foundId
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  } finally {
    connection.release();
  }
});

// ==========================================
// 5. MATCH FEED (VIEW)
// ==========================================

router.get('/matches', async (req, res) => {
  try {
    const { lost_id } = req.query;
    let query = 'SELECT * FROM vw_active_match_feed';
    const params = [];
    if (lost_id) {
      query += ' WHERE lost_id = ?';
      params.push(lost_id);
    }
    const [rows] = await db.query(query, params);
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ==========================================
// 6. CLAIMS & ACID CONCURRENCY CONTROL
// ==========================================

router.post('/claims', async (req, res) => {
  const connection = await db.getConnection();
  try {
    const { found_id, claimant_id, lost_id, proof_details } = req.body;

    // Execute stored procedure with output variables
    await connection.query('SET @claim_id = 0, @res = "", @msg = "";');
    await connection.query(
      'CALL sp_SubmitClaim(?, ?, ?, ?, @claim_id, @res, @msg);',
      [found_id, claimant_id, lost_id || null, proof_details]
    );

    const [outRows] = await connection.query('SELECT @claim_id AS claim_id, @res AS result_code, @msg AS message;');
    const { claim_id, result_code, message } = outRows[0];

    if (result_code === 'SUCCESS') {
      res.json({ success: true, claim_id, message });
    } else {
      res.status(400).json({ success: false, code: result_code, message });
    }
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  } finally {
    connection.release();
  }
});

// ==========================================
// 6.1 ACID CONCURRENCY RACE-CONDITION SIMULATOR
// (Academic Demonstration Tool for Viva Defense)
// ==========================================
router.post('/claims/simulate-race', async (req, res) => {
  let { found_id, claimant_a_id, claimant_b_id } = req.body;
  found_id = found_id ? parseInt(found_id, 10) : 2; // Default to Dell Charger
  claimant_a_id = claimant_a_id ? parseInt(claimant_a_id, 10) : 2; // Maaz Malick
  claimant_b_id = claimant_b_id ? parseInt(claimant_b_id, 10) : 3; // Muzammil Rizwan

  // Ensure item is AVAILABLE before running the race condition test
  await db.query("UPDATE found_reports SET status = 'AVAILABLE' WHERE found_id = ?", [found_id]);
  await db.query("DELETE FROM claims WHERE found_id = ? AND claimant_id IN (?, ?)", [found_id, claimant_a_id, claimant_b_id]);

  // Helper to execute claim on a separate database connection
  const executeClaim = async (claimantId, threadName) => {
    const conn = await db.getConnection();
    const startTime = Date.now();
    try {
      await conn.query('SET @claim_id = 0, @res = "", @msg = "";');
      await conn.query(
        'CALL sp_SubmitClaim(?, ?, NULL, ?, @claim_id, @res, @msg);',
        [found_id, claimantId, `Simulated concurrent proof submission from ${threadName}`]
      );
      const [rows] = await conn.query('SELECT @claim_id AS claim_id, @res AS result_code, @msg AS message;');
      const elapsedMs = Date.now() - startTime;
      return {
        thread: threadName,
        claimant_id: claimantId,
        elapsed_ms: elapsedMs,
        ...rows[0]
      };
    } catch (err) {
      return {
        thread: threadName,
        claimant_id: claimantId,
        error: err.message,
        result_code: 'ERROR'
      };
    } finally {
      conn.release();
    }
  };

  // Launch both transactions at the exact same millisecond
  const [resultA, resultB] = await Promise.all([
    executeClaim(claimant_a_id, 'Thread A (Maaz Malick)'),
    executeClaim(claimant_b_id, 'Thread B (Muzammil Rizwan)')
  ]);

  // Fetch final item state from MySQL
  const [itemRows] = await db.query('SELECT found_id, item_name, status FROM found_reports WHERE found_id = ?', [found_id]);
  const [auditRows] = await db.query(
    'SELECT * FROM claim_audit_log WHERE claim_id IN (?, ?) ORDER BY action_timestamp DESC',
    [resultA.claim_id || 0, resultB.claim_id || 0]
  );

  res.json({
    success: true,
    target_item: itemRows[0],
    thread_a: resultA,
    thread_b: resultB,
    winner: resultA.result_code === 'SUCCESS' ? 'Thread A' : (resultB.result_code === 'SUCCESS' ? 'Thread B' : 'None'),
    explanation: 'MySQL InnoDB exclusive lock (SELECT ... FOR UPDATE) inside sp_SubmitClaim allowed the first arriving transaction to commit, while atomically blocking the second. When the second transaction acquired the lock, the item was already UNDER_CLAIM, preventing a double-claim race condition.',
    audit_trail: auditRows
  });
});

router.patch('/claims/:id/review', async (req, res) => {
  const connection = await db.getConnection();
  try {
    const claimId = req.params.id;
    const { reviewer_id, decision, review_notes } = req.body;

    if (!['APPROVED', 'REJECTED'].includes(decision)) {
      return res.status(400).json({ success: false, message: 'Decision must be APPROVED or REJECTED' });
    }

    await connection.query('SET @res = "", @msg = "";');
    await connection.query(
      'CALL sp_ProcessClaimReview(?, ?, ?, ?, @res, @msg);',
      [claimId, reviewer_id, decision, review_notes || '']
    );

    const [outRows] = await connection.query('SELECT @res AS result_code, @msg AS message;');
    const { result_code, message } = outRows[0];

    if (result_code === 'SUCCESS') {
      res.json({ success: true, message });
    } else {
      res.status(400).json({ success: false, code: result_code, message });
    }
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  } finally {
    connection.release();
  }
});

router.get('/claims/audit/:id', async (req, res) => {
  try {
    const claimId = req.params.id;
    const [rows] = await db.query(
      `SELECT a.*, u.full_name AS action_user_name, u.role AS action_user_role
       FROM claim_audit_log a
       LEFT JOIN users u ON a.action_by = u.user_id
       WHERE a.claim_id = ?
       ORDER BY a.action_timestamp ASC`,
      [claimId]
    );
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ==========================================
// 7. ANALYTICAL VIEWS FOR ADMIN & SECURITY
// ==========================================

router.get('/analytics/recovery-rate', async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM vw_campus_recovery_rate');
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/analytics/hotspots', async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM vw_location_hotspots');
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/analytics/security-queue', async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM vw_security_claims_queue');
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
