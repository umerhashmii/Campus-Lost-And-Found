const express = require('express');
const router = express.Router();
const path = require('path');
const multer = require('multer');
const db = require('../config/db');

// ==========================================
// FILE UPLOAD CONFIGURATION (MULTER)
// ==========================================
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, '../../public/uploads'));
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, 'item-' + uniqueSuffix + ext);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB max
  fileFilter: (req, file, cb) => {
    const allowed = /jpeg|jpg|png|webp|gif/;
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.test(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Only image files (.jpg, .png, .webp) are supported!'));
    }
  }
});

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
// 2. USERS & LOCAL AUTHENTICATION
// ==========================================

router.get('/users', async (req, res) => {
  try {
    const [rows] = await db.query('SELECT user_id, enrollment_no, full_name, email, phone, role FROM users ORDER BY user_id ASC');
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Smart Register or Login for Students & Campus Visitors
router.post('/auth/register-or-login', async (req, res) => {
  try {
    let { full_name, phone, enrollment_no, department, role } = req.body;
    if (!phone || !phone.trim()) {
      return res.status(400).json({ success: false, message: 'Phone number is mandatory for contact.' });
    }
    phone = phone.trim();
    enrollment_no = enrollment_no && enrollment_no.trim() ? enrollment_no.trim() : null;
    full_name = full_name && full_name.trim() ? full_name.trim() : 'Campus Visitor';
    role = role || 'STUDENT';

    // Check if user already exists by phone
    const [existing] = await db.query('SELECT * FROM users WHERE phone = ?', [phone]);

    if (existing.length > 0) {
      const user = existing[0];
      // Update enrollment or name if newly provided
      if (enrollment_no && !user.enrollment_no) {
        await db.query('UPDATE users SET enrollment_no = ? WHERE user_id = ?', [enrollment_no, user.user_id]);
        user.enrollment_no = enrollment_no;
      }
      return res.json({ success: true, user, isNew: false, message: `Welcome back, ${user.full_name}!` });
    }

    // Auto-generate local email for identity if not supplied
    const cleanPhone = phone.replace(/\D/g, '');
    const cleanEnroll = enrollment_no ? enrollment_no.toLowerCase().replace(/\s+/g, '') : null;
    const email = cleanEnroll ? `${cleanEnroll}@ubit.edu.pk` : `guest.${cleanPhone}@uok.edu.pk`;

    const [result] = await db.query(
      `INSERT INTO users (enrollment_no, full_name, email, phone, role, password_hash)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [enrollment_no, full_name, email, phone, role, '$2a$10$localHashForDemoOffline']
    );

    const [newUserRows] = await db.query('SELECT user_id, enrollment_no, full_name, email, phone, role FROM users WHERE user_id = ?', [result.insertId]);
    res.json({ success: true, user: newUserRows[0], isNew: true, message: `Account created! Welcome to UBIT Lost & Found, ${full_name}.` });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Officer Staff Sign-In
router.post('/auth/officer-login', async (req, res) => {
  try {
    const { user_id, passcode } = req.body;
    if (passcode !== 'admin123' && passcode !== 'security123') {
      return res.status(401).json({ success: false, message: 'Invalid Officer Passcode! Contact DCS Admin for authorization.' });
    }
    const [rows] = await db.query('SELECT user_id, enrollment_no, full_name, email, phone, role FROM users WHERE user_id = ? AND role IN (\'SECURITY\', \'ADMIN\')', [user_id]);
    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Security officer record not found.' });
    }
    res.json({ success: true, user: rows[0], message: `Officer ${rows[0].full_name} authenticated for Admin Room 02.` });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Legacy email login compatibility
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
// 3. LOST REPORTS (WITH IMAGE UPLOAD)
// ==========================================

router.get('/lost', async (req, res) => {
  try {
    const { user_id, status } = req.query;
    let query = `
      SELECT l.*, c.name AS category_name, loc.building_name, loc.room_floor, u.full_name AS owner_name, u.phone AS owner_phone, u.email AS owner_email
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

router.post('/lost', upload.single('image'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ success: false, error: 'Item photograph is mandatory for campus recovery records. Please attach a photo.' });
  }

  const connection = await db.getConnection();
  try {
    const { user_id, category_id, item_name, description, color, brand, location_id, lost_date } = req.body;
    const imageUrl = `uploads/${req.file.filename}`;
    
    // 1. Insert Lost Report
    const [result] = await connection.query(
      `INSERT INTO lost_reports (user_id, category_id, item_name, description, image_url, color, brand, location_id, lost_date)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [user_id, category_id, item_name, description, imageUrl, color || null, brand || null, location_id, lost_date]
    );

    const lostId = result.insertId;

    // 2. Invoke Stored Procedure Matching Engine
    await connection.query('CALL sp_GenerateMatchesForLostReport(?)', [lostId]);

    // 3. Fetch any matches generated
    const [matches] = await connection.query(
      'SELECT m.*, f.item_name AS found_item_name FROM matches m JOIN found_reports f ON m.found_id = f.found_id WHERE m.lost_id = ?',
      [lostId]
    );

    // 4. Create in-app notification if high-confidence match found
    if (matches.length > 0) {
      const topMatch = matches[0];
      if (topMatch.match_score >= 60) {
        await connection.query(
          `INSERT INTO notifications (user_id, title, message, type)
           VALUES (?, ?, ?, ?)`,
          [
            user_id,
            'Potential Match Discovered!',
            `A found item matching "${item_name}" was identified with ${topMatch.match_score}% confidence. Check the Matches tab to review.`,
            'MATCH_FOUND'
          ]
        );
      }
    }

    res.json({
      success: true,
      message: 'Lost report filed successfully! Automated matching engine executed.',
      lost_id: lostId,
      image_url: imageUrl,
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
// 4. FOUND REPORTS (WITH IMAGE UPLOAD)
// ==========================================

router.get('/found', async (req, res) => {
  try {
    const { status, category_id } = req.query;
    let query = `
      SELECT f.*, c.name AS category_name, loc.building_name, loc.room_floor, u.full_name AS finder_name, u.phone AS finder_phone
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

router.post('/found', upload.single('image'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ success: false, error: 'Item photograph is mandatory for custody verification. Please attach a photo.' });
  }

  const connection = await db.getConnection();
  try {
    const { finder_id, category_id, item_name, description, color, brand, location_id, found_date, custody_location } = req.body;
    const imageUrl = `uploads/${req.file.filename}`;

    const [result] = await connection.query(
      `INSERT INTO found_reports (finder_id, category_id, item_name, description, image_url, color, brand, location_id, found_date, custody_location)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [finder_id, category_id, item_name, description, imageUrl, color || null, brand || null, location_id, found_date, custody_location || 'Campus Security Office (Admin Block)']
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
      found_id: foundId,
      image_url: imageUrl
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
// 6. CLAIMS & 2-FACTOR SECURE PIN WORKFLOW
// ==========================================

router.post('/claims', async (req, res) => {
  const connection = await db.getConnection();
  try {
    const { found_id, claimant_id, lost_id, proof_details } = req.body;

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

// Review Claim: Generates 6-Digit PIN on Approval
router.patch('/claims/:id/review', async (req, res) => {
  const connection = await db.getConnection();
  try {
    const claimId = req.params.id;
    const { reviewer_id, decision, review_notes } = req.body;

    if (!['APPROVED', 'REJECTED'].includes(decision)) {
      return res.status(400).json({ success: false, message: 'Decision must be APPROVED or REJECTED' });
    }

    await connection.query('SET @res = "", @msg = "", @pin = "";');
    await connection.query(
      'CALL sp_ProcessClaimReview(?, ?, ?, ?, @res, @msg, @pin);',
      [claimId, reviewer_id, decision, review_notes || '']
    );

    const [outRows] = await connection.query('SELECT @res AS result_code, @msg AS message, @pin AS pickup_pin;');
    const { result_code, message, pickup_pin } = outRows[0];

    if (result_code === 'SUCCESS') {
      res.json({ success: true, message, pickup_pin });
    } else {
      res.status(400).json({ success: false, code: result_code, message });
    }
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  } finally {
    connection.release();
  }
});

// Two-Factor Pickup PIN Verification at Admin Room 02
router.post('/claims/:id/verify-pin', async (req, res) => {
  const connection = await db.getConnection();
  try {
    const claimId = req.params.id;
    const { entered_pin, officer_id } = req.body;

    if (!entered_pin) {
      return res.status(400).json({ success: false, message: 'Please enter the 6-digit student verification PIN.' });
    }

    await connection.query('SET @res = "", @msg = "";');
    await connection.query(
      'CALL sp_VerifyHandoverPIN(?, ?, ?, @res, @msg);',
      [claimId, entered_pin, officer_id || 4]
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

// ACID Concurrency Race Simulator
router.post('/claims/simulate-race', async (req, res) => {
  let { found_id, claimant_a_id, claimant_b_id } = req.body;
  found_id = found_id ? parseInt(found_id, 10) : 2;
  claimant_a_id = claimant_a_id ? parseInt(claimant_a_id, 10) : 2;
  claimant_b_id = claimant_b_id ? parseInt(claimant_b_id, 10) : 3;

  await db.query("UPDATE found_reports SET status = 'AVAILABLE' WHERE found_id = ?", [found_id]);
  await db.query("DELETE FROM claims WHERE found_id = ? AND claimant_id IN (?, ?)", [found_id, claimant_a_id, claimant_b_id]);

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

  const [resultA, resultB] = await Promise.all([
    executeClaim(claimant_a_id, 'Thread A (Maaz Malick)'),
    executeClaim(claimant_b_id, 'Thread B (Muzammil Rizwan)')
  ]);

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
// 7. STUDENT ACTIVITY DASHBOARD
// ==========================================

router.get('/users/:id/activity', async (req, res) => {
  try {
    const userId = req.params.id;

    // 1. User profile
    const [userRows] = await db.query('SELECT user_id, enrollment_no, full_name, email, phone, role FROM users WHERE user_id = ?', [userId]);
    if (userRows.length === 0) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    // 2. User's lost reports with match count
    const [lostReports] = await db.query(
      `SELECT l.*, c.name AS category_name, loc.building_name, loc.room_floor,
              (SELECT COUNT(*) FROM matches m WHERE m.lost_id = l.lost_id) AS total_matches,
              (SELECT MAX(match_score) FROM matches m WHERE m.lost_id = l.lost_id) AS best_match_score
       FROM lost_reports l
       JOIN categories c ON l.category_id = c.category_id
       JOIN locations loc ON l.location_id = loc.location_id
       WHERE l.user_id = ?
       ORDER BY l.created_at DESC`,
      [userId]
    );

    // 3. User's claims with found item details & pickup PIN
    const [claims] = await db.query(
      `SELECT cl.*, f.item_name AS found_item_name, f.custody_location, f.image_url AS found_image_url,
              c.name AS category_name, loc.building_name, u_rev.full_name AS reviewer_name
       FROM claims cl
       JOIN found_reports f ON cl.found_id = f.found_id
       JOIN categories c ON f.category_id = c.category_id
       JOIN locations loc ON f.location_id = loc.location_id
       LEFT JOIN users u_rev ON cl.reviewer_id = u_rev.user_id
       WHERE cl.claimant_id = ?
       ORDER BY cl.claim_date DESC`,
      [userId]
    );

    // 4. Notifications
    const [notifications] = await db.query(
      'SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 15',
      [userId]
    );

    res.json({
      success: true,
      user: userRows[0],
      lost_reports: lostReports,
      claims,
      notifications
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ==========================================
// 8. 90-DAY UNCLAIMED DEPOSITORY & DISPOSALS
// ==========================================

router.get('/admin/unclaimed', async (req, res) => {
  try {
    const daysThreshold = parseInt(req.query.days || '30', 10);
    const [rows] = await db.query(
      `SELECT f.*, c.name AS category_name, loc.building_name, loc.room_floor,
              DATEDIFF(NOW(), f.found_date) AS days_in_custody,
              u.full_name AS finder_name
       FROM found_reports f
       JOIN categories c ON f.category_id = c.category_id
       JOIN locations loc ON f.location_id = loc.location_id
       JOIN users u ON f.finder_id = u.user_id
       WHERE f.status = 'AVAILABLE' AND DATEDIFF(NOW(), f.found_date) >= ?
       ORDER BY f.found_date ASC`,
      [daysThreshold]
    );
    res.json({ success: true, count: rows.length, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/admin/unclaimed/process', async (req, res) => {
  const connection = await db.getConnection();
  try {
    const { days_threshold, action_type, officer_id } = req.body;
    const days = parseInt(days_threshold || '90', 10);
    const action = action_type || 'DONATED_TO_UBIT_WELFARE';
    const officer = parseInt(officer_id || '4', 10);

    await connection.query('SET @cnt = 0, @res = "", @msg = "";');
    await connection.query(
      'CALL sp_ProcessUnclaimedDisposals(?, ?, ?, @cnt, @res, @msg);',
      [days, action, officer]
    );

    const [outRows] = await connection.query('SELECT @cnt AS processed_count, @res AS result_code, @msg AS message;');
    const { processed_count, result_code, message } = outRows[0];

    if (result_code === 'SUCCESS') {
      res.json({ success: true, processed_count, message });
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
// 9. NOTIFICATIONS MANAGEMENT
// ==========================================

router.get('/notifications/:user_id', async (req, res) => {
  try {
    const userId = req.params.user_id;
    const [rows] = await db.query(
      'SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 20',
      [userId]
    );
    const [unread] = await db.query(
      'SELECT COUNT(*) AS unread_count FROM notifications WHERE user_id = ? AND is_read = FALSE',
      [userId]
    );
    res.json({ success: true, unread_count: unread[0].unread_count, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.patch('/notifications/:id/read', async (req, res) => {
  try {
    const notifId = req.params.id;
    await db.query('UPDATE notifications SET is_read = TRUE WHERE notification_id = ?', [notifId]);
    res.json({ success: true, message: 'Notification marked as read.' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.patch('/notifications/user/:user_id/read-all', async (req, res) => {
  try {
    const userId = req.params.user_id;
    await db.query('UPDATE notifications SET is_read = TRUE WHERE user_id = ?', [userId]);
    res.json({ success: true, message: 'All notifications marked as read.' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ==========================================
// 10. ANALYTICAL VIEWS FOR ADMIN & SECURITY
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
