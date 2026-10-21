// ========================================================
// CAMPUS LOST & FOUND APPLICATION JAVASCRIPT
// UBIT DBMS Project - Front-end Logic & API Integration
// ========================================================

const API_BASE = '/api';

let currentUser = null;
let allUsers = [];
let allCategories = [];
let allLocations = [];

// ========================================================
// INITIALIZATION
// ========================================================
document.addEventListener('DOMContentLoaded', async () => {
  // Navigation tabs listener
  document.querySelectorAll('.nav-tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const viewId = btn.getAttribute('data-view');
      switchView(viewId);
    });
  });

  // Pre-fill datetime inputs with current time
  const now = new Date();
  now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
  const nowStr = now.toISOString().slice(0, 16);
  if (document.getElementById('lostDateTime')) document.getElementById('lostDateTime').value = nowStr;
  if (document.getElementById('foundDateTime')) document.getElementById('foundDateTime').value = nowStr;

  // Load initial data
  await loadUsers();
  await loadMasterData();
  await refreshAll();
});

// ========================================================
// NAVIGATION & VIEW SWITCHING
// ========================================================
function switchView(viewId) {
  document.querySelectorAll('.view-section').forEach(sec => sec.classList.remove('active'));
  document.querySelectorAll('.nav-tab-btn').forEach(btn => btn.classList.remove('active'));

  const targetSec = document.getElementById(viewId);
  const targetBtn = document.querySelector(`[data-view="${viewId}"]`);

  if (targetSec) targetSec.classList.add('active');
  if (targetBtn) targetBtn.classList.add('active');

  // Trigger specific view loaders
  if (viewId === 'view-matches') loadMatches();
  if (viewId === 'view-security') loadSecurityQueue();
  if (viewId === 'view-analytics') loadAnalytics();
}

async function refreshAll() {
  await loadHeroStats();
  await loadMatches();
}

// ========================================================
// USERS & MASTER DATA
// ========================================================
async function loadUsers() {
  try {
    const res = await fetch(`${API_BASE}/users`);
    const data = await res.json();
    if (data.success) {
      allUsers = data.data;
      const selector = document.getElementById('userSelector');
      selector.innerHTML = '';
      allUsers.forEach(u => {
        const opt = document.createElement('option');
        opt.value = u.user_id;
        const roleLabel = u.role.charAt(0) + u.role.slice(1).toLowerCase();
        opt.textContent = `${u.full_name} (${roleLabel})`;
        selector.appendChild(opt);
      });

      // Default to Syed Umer Hashmi
      currentUser = allUsers[0];
      selector.value = currentUser.user_id;
      updateAvatar(currentUser);

      selector.addEventListener('change', (e) => {
        currentUser = allUsers.find(u => u.user_id == e.target.value);
        updateAvatar(currentUser);
        showToast(`Switched active user to ${currentUser.full_name}`, 'info');
      });
    }
  } catch (err) {
    console.error('Failed to load users:', err);
  }
}

function updateAvatar(user) {
  const avatar = document.getElementById('userAvatar');
  if (!avatar || !user) return;
  const initials = user.full_name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
  avatar.textContent = initials;
  if (user.role === 'SECURITY' || user.role === 'ADMIN') {
    avatar.classList.add('security');
  } else {
    avatar.classList.remove('security');
  }
}

async function loadMasterData() {
  try {
    const [catRes, locRes] = await Promise.all([
      fetch(`${API_BASE}/categories`),
      fetch(`${API_BASE}/locations`)
    ]);

    const catData = await catRes.json();
    const locData = await locRes.json();

    if (catData.success) {
      allCategories = catData.data;
      const lostCat = document.getElementById('lostCategory');
      const foundCat = document.getElementById('foundCategory');
      lostCat.innerHTML = '<option value="">Select Category...</option>';
      foundCat.innerHTML = '<option value="">Select Category...</option>';

      allCategories.forEach(c => {
        const opt1 = document.createElement('option');
        opt1.value = c.category_id;
        opt1.textContent = c.name;
        lostCat.appendChild(opt1);

        const opt2 = document.createElement('option');
        opt2.value = c.category_id;
        opt2.textContent = c.name;
        foundCat.appendChild(opt2);
      });
    }

    if (locData.success) {
      allLocations = locData.data;
      const lostLoc = document.getElementById('lostLocation');
      const foundLoc = document.getElementById('foundLocation');
      lostLoc.innerHTML = '<option value="">Select Location...</option>';
      foundLoc.innerHTML = '<option value="">Select Location...</option>';

      allLocations.forEach(l => {
        const text = `${l.building_name} (${l.room_floor})`;
        const opt1 = document.createElement('option');
        opt1.value = l.location_id;
        opt1.textContent = text;
        lostLoc.appendChild(opt1);

        const opt2 = document.createElement('option');
        opt2.value = l.location_id;
        opt2.textContent = text;
        foundLoc.appendChild(opt2);
      });
    }
  } catch (err) {
    console.error('Failed to load master data:', err);
  }
}

// ========================================================
// HERO STATS
// ========================================================
async function loadHeroStats() {
  try {
    const [lostRes, foundRes, matchRes, queueRes] = await Promise.all([
      fetch(`${API_BASE}/lost`),
      fetch(`${API_BASE}/found?status=AVAILABLE`),
      fetch(`${API_BASE}/matches`),
      fetch(`${API_BASE}/analytics/security-queue`)
    ]);

    const lost = await lostRes.json();
    const found = await foundRes.json();
    const matches = await matchRes.json();
    const queue = await queueRes.json();

    if (lost.success) document.getElementById('statTotalLost').textContent = lost.data.length;
    if (found.success) document.getElementById('statAvailableFound').textContent = found.data.length;
    if (matches.success) document.getElementById('statHighMatches').textContent = matches.data.length;
    
    // Count resolved claims
    const resCount = queue.success ? queue.data.filter(c => c.claim_status === 'APPROVED').length : 0;
    document.getElementById('statResolvedClaims').textContent = resCount;
  } catch (err) {
    console.error('Failed to load hero stats:', err);
  }
}

// ========================================================
// VIEW 1: MATCH FEED
// ========================================================
async function loadMatches() {
  const container = document.getElementById('matchesContainer');
  container.innerHTML = '<div style="color: var(--color-muted);">Loading live matches...</div>';

  try {
    const res = await fetch(`${API_BASE}/matches`);
    const data = await res.json();

    if (!data.success || data.data.length === 0) {
      container.innerHTML = `
        <div style="grid-column: 1 / -1; padding: 48px; text-align: center; background-color: var(--color-surface-soft); border-radius: var(--radius-xl);">
          <h4>No Active Match Proposals</h4>
          <p style="color: var(--color-muted); margin-top: 6px;">Submit a new Lost or Found report to run the stored procedure matching engine.</p>
        </div>
      `;
      return;
    }

    container.innerHTML = '';
    data.data.forEach(m => {
      const isHigh = m.match_score >= 80;
      const scoreClass = m.match_score >= 95 ? 'score-badge perfect' : 'score-badge';

      const card = document.createElement('div');
      card.className = `match-card ${isHigh ? 'high-match' : ''}`;
      card.innerHTML = `
        <div>
          <div class="match-card-header">
            <span class="${scoreClass}">${m.match_score}% Match Score</span>
            <span class="category-tag">${m.category_name}</span>
          </div>

          <h4>${m.lost_item_name}</h4>
          <p style="font-size: 13px; color: var(--color-muted); margin-bottom: 8px;">
            Reported lost by <strong>${m.owner_name}</strong>
          </p>

          <div class="item-vs-container">
            <div class="vs-row">
              <span class="vs-label">Found Item:</span>
              <span class="vs-value"><strong>${m.found_item_name}</strong></span>
            </div>
            <div class="vs-row">
              <span class="vs-label">Found Spot:</span>
              <span class="vs-value">${m.found_room}</span>
            </div>
            <div class="vs-row">
              <span class="vs-label">Lost Spot:</span>
              <span class="vs-value">${m.lost_room}</span>
            </div>
            <div class="vs-row">
              <span class="vs-label">Custody:</span>
              <span class="vs-value">${m.custody_location}</span>
            </div>
          </div>
        </div>

        <div style="display: flex; gap: 8px; margin-top: 16px;">
          <button class="btn-primary" style="flex: 1;" onclick="openClaimModal(${m.found_id}, ${m.lost_id}, '${escapeQuotes(m.found_item_name)}')">
            File Claim 🔒
          </button>
          <button class="btn-secondary" onclick="openScoreExplainer('${escapeQuotes(m.lost_item_name)}', '${m.match_score}', '${escapeQuotes(m.category_name)}')">
            Explain 💡
          </button>
        </div>
      `;
      container.appendChild(card);
    });
  } catch (err) {
    container.innerHTML = `<div style="color: var(--color-error);">Error loading matches: ${err.message}</div>`;
  }
}

// ========================================================
// VIEW 2: SUBMIT LOST REPORT
// ========================================================
async function handleLostSubmit(e) {
  e.preventDefault();
  const submitBtn = e.target.querySelector('button[type="submit"]');
  submitBtn.disabled = true;
  submitBtn.textContent = 'Processing & Matching...';

  const payload = {
    user_id: currentUser ? currentUser.user_id : 1,
    category_id: parseInt(document.getElementById('lostCategory').value),
    location_id: parseInt(document.getElementById('lostLocation').value),
    item_name: document.getElementById('lostItemName').value,
    color: document.getElementById('lostColor').value,
    brand: document.getElementById('lostBrand').value,
    lost_date: document.getElementById('lostDateTime').value.replace('T', ' ') + ':00',
    description: document.getElementById('lostDescription').value
  };

  try {
    const res = await fetch(`${API_BASE}/lost`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();

    if (data.success) {
      showToast(`Lost report filed! Found ${data.matches_found} prospective match(es).`, 'success');
      document.getElementById('lostItemForm').reset();
      await refreshAll();
      switchView('view-matches');
    } else {
      showToast(`Error: ${data.error}`, 'error');
    }
  } catch (err) {
    showToast(`Network error: ${err.message}`, 'error');
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = 'Submit Report & Run Matcher ⚡';
  }
}

// ========================================================
// VIEW 3: SUBMIT FOUND REPORT
// ========================================================
async function handleFoundSubmit(e) {
  e.preventDefault();
  const submitBtn = e.target.querySelector('button[type="submit"]');
  submitBtn.disabled = true;
  submitBtn.textContent = 'Recording Found Item...';

  const payload = {
    finder_id: currentUser ? currentUser.user_id : 1,
    category_id: parseInt(document.getElementById('foundCategory').value),
    location_id: parseInt(document.getElementById('foundLocation').value),
    item_name: document.getElementById('foundItemName').value,
    color: document.getElementById('foundColor').value,
    brand: document.getElementById('foundBrand').value,
    found_date: document.getElementById('foundDateTime').value.replace('T', ' ') + ':00',
    custody_location: document.getElementById('foundCustody').value,
    description: document.getElementById('foundDescription').value
  };

  try {
    const res = await fetch(`${API_BASE}/found`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();

    if (data.success) {
      showToast('Found item recorded and matched against existing lost reports!', 'success');
      document.getElementById('foundItemForm').reset();
      await refreshAll();
      switchView('view-matches');
    } else {
      showToast(`Error: ${data.error}`, 'error');
    }
  } catch (err) {
    showToast(`Network error: ${err.message}`, 'error');
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = 'Record Found Item 📦';
  }
}

// ========================================================
// VIEW 4: SECURITY CLAIMS QUEUE
// ========================================================
async function loadSecurityQueue() {
  const tbody = document.getElementById('securityQueueTableBody');
  tbody.innerHTML = '<tr><td colspan="8" style="text-align: center; color: var(--color-muted);">Loading security queue...</td></tr>';

  try {
    const res = await fetch(`${API_BASE}/analytics/security-queue`);
    const data = await res.json();

    if (!data.success || data.data.length === 0) {
      tbody.innerHTML = '<tr><td colspan="8" style="text-align: center; color: var(--color-muted); padding: 32px;">No claims currently awaiting verification.</td></tr>';
      return;
    }

    tbody.innerHTML = '';
    data.data.forEach(c => {
      const tr = document.createElement('tr');
      const isPending = c.claim_status === 'PENDING' || c.claim_status === 'UNDER_REVIEW';

      tr.innerHTML = `
        <td><strong>#${c.claim_id}</strong></td>
        <td>${new Date(c.claim_date).toLocaleDateString()}</td>
        <td>
          <strong>${c.claimant_name}</strong><br>
          <span style="font-size: 12px; color: var(--color-muted);">${c.claimant_enrollment} · ${c.claimant_phone}</span>
        </td>
        <td>
          <strong>${c.found_item_name}</strong><br>
          <span style="font-size: 12px; color: var(--color-muted);">${c.category_name} (${c.found_building})</span>
        </td>
        <td><span style="font-size: 13px;">${c.custody_location}</span></td>
        <td style="max-width: 220px; font-size: 13px;">${c.proof_details}</td>
        <td><span class="badge-status ${c.claim_status}">${c.claim_status}</span></td>
        <td>
          <div style="display: flex; gap: 6px;">
            ${isPending ? `
              <button class="btn-success" onclick="openReviewModal(${c.claim_id}, 'APPROVED', '${escapeQuotes(c.claimant_name)}', '${escapeQuotes(c.found_item_name)}', '${escapeQuotes(c.proof_details)}')">Approve</button>
              <button class="btn-danger" onclick="openReviewModal(${c.claim_id}, 'REJECTED', '${escapeQuotes(c.claimant_name)}', '${escapeQuotes(c.found_item_name)}', '${escapeQuotes(c.proof_details)}')">Reject</button>
            ` : ''}
            ${c.claim_status === 'APPROVED' ? `
              <button class="btn-primary" style="height: 38px; padding: 0 10px; background-color: var(--brand-teal);" onclick="openReceiptModal(${c.claim_id}, '${escapeQuotes(c.claimant_name)}', '${escapeQuotes(c.claimant_enrollment)}', '${escapeQuotes(c.claimant_phone)}', '${escapeQuotes(c.found_item_name)}', '${escapeQuotes(c.category_name)}', '${escapeQuotes(c.custody_location)}', '${escapeQuotes(c.proof_details)}')">Voucher 📄</button>
            ` : ''}
            <button class="btn-secondary" style="height: 38px; padding: 0 10px;" onclick="viewAuditLog(${c.claim_id})">Audit</button>
          </div>
        </td>
      `;
      tbody.appendChild(tr);
    });
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="8" style="color: var(--color-error);">Error: ${err.message}</td></tr>`;
  }
}

// ==========================================
// VIEW 5: ANALYTICS (RECOVERY RATES & HOTSPOTS)
// ==========================================
async function loadAnalytics() {
  try {
    const [rateRes, spotRes] = await Promise.all([
      fetch(`${API_BASE}/analytics/recovery-rate`),
      fetch(`${API_BASE}/analytics/hotspots`)
    ]);

    const rateData = await rateRes.json();
    const spotData = await spotRes.json();

    // Render Recovery Rates
    const rateBody = document.getElementById('recoveryRateTableBody');
    rateBody.innerHTML = '';
    if (rateData.success) {
      rateData.data.forEach(r => {
        const tr = document.createElement('tr');
        const rate = r.recovery_rate_percentage || 0;
        tr.innerHTML = `
          <td><strong>${r.category_name}</strong></td>
          <td>${r.total_lost_reports}</td>
          <td>${r.successfully_recovered}</td>
          <td>
            <strong>${rate}%</strong>
            <div style="background-color: var(--color-hairline); border-radius: var(--radius-pill); height: 6px; width: 80px; margin-top: 4px; overflow: hidden;">
              <div style="background-color: var(--brand-teal); height: 100%; width: ${Math.min(rate, 100)}%;"></div>
            </div>
          </td>
        `;
        rateBody.appendChild(tr);
      });
    }

    // Render Hotspots Table & Visual Grid
    const spotBody = document.getElementById('hotspotsTableBody');
    const zoneGrid = document.getElementById('hotspotZoneGrid');
    spotBody.innerHTML = '';
    if (zoneGrid) zoneGrid.innerHTML = '';

    if (spotData.success) {
      spotData.data.forEach(s => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td>
            <strong>${s.building_name}</strong><br>
            <span style="font-size: 12px; color: var(--color-muted);">${s.room_floor}</span>
          </td>
          <td><span class="category-tag">${s.zone_type}</span></td>
          <td><strong style="color: var(--color-error);">${s.lost_items_count}</strong></td>
          <td><strong style="color: var(--color-success);">${s.found_items_count}</strong></td>
        `;
        spotBody.appendChild(tr);

        // Visual Zone Intensity Card
        if (zoneGrid) {
          const zoneCard = document.createElement('div');
          const isHigh = s.lost_items_count >= 2;
          const isMed = s.lost_items_count === 1;
          const statusText = isHigh ? 'High Loss Activity' : (isMed ? 'Moderate Activity' : 'Low Activity');
          const statusColor = isHigh ? 'var(--color-error)' : (isMed ? 'var(--color-warning)' : 'var(--color-success)');

          zoneCard.className = 'stat-card';
          zoneCard.style.backgroundColor = 'var(--color-surface-card)';
          zoneCard.style.border = '1px solid var(--color-hairline)';
          zoneCard.innerHTML = `
            <div>
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                <span class="category-tag">${s.zone_type}</span>
                <span style="font-size: 11px; font-weight: 700; color: ${statusColor};">${statusText}</span>
              </div>
              <h5 style="font-size: 15px; font-weight: 700; color: var(--color-ink); margin-bottom: 2px;">${s.building_name}</h5>
              <p style="font-size: 12px; color: var(--color-muted);">${s.room_floor}</p>
            </div>
            <div style="display: flex; justify-content: space-between; font-size: 12px; margin-top: 14px; border-top: 1px solid var(--color-hairline); padding-top: 8px;">
              <span>Lost: <strong style="color: var(--color-error);">${s.lost_items_count}</strong></span>
              <span>Found: <strong style="color: var(--color-success);">${s.found_items_count}</strong></span>
              <span>Resolved: <strong>${s.resolved_items_count}</strong></span>
            </div>
          `;
          zoneGrid.appendChild(zoneCard);
        }
      });
    }
  } catch (err) {
    console.error('Failed to load analytics:', err);
  }
}

// ========================================================
// MODALS: CLAIM & CONCURRENCY SUBMISSION
// ========================================================
function openClaimModal(foundId, lostId, itemName) {
  document.getElementById('claimFoundId').value = foundId;
  document.getElementById('claimLostId').value = lostId || '';
  document.getElementById('claimItemName').value = itemName;
  document.getElementById('claimProof').value = '';
  document.getElementById('claimModal').classList.add('open');
}

async function handleClaimSubmit(e) {
  e.preventDefault();
  const foundId = parseInt(document.getElementById('claimFoundId').value);
  const lostIdVal = document.getElementById('claimLostId').value;
  const lostId = lostIdVal ? parseInt(lostIdVal) : null;
  const proof = document.getElementById('claimProof').value;

  const payload = {
    found_id: foundId,
    claimant_id: currentUser ? currentUser.user_id : 1,
    lost_id: lostId,
    proof_details: proof
  };

  try {
    const res = await fetch(`${API_BASE}/claims`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();

    if (data.success) {
      closeModal('claimModal');
      showToast(`Success: ${data.message}`, 'success');
      await refreshAll();
      switchView('view-security');
    } else {
      showToast(`Claim Conflict / Error: ${data.message}`, 'error');
    }
  } catch (err) {
    showToast(`Network error: ${err.message}`, 'error');
  }
}

// ========================================================
// MODALS: SECURITY REVIEW & AUDIT LOG
// ========================================================
function openReviewModal(claimId, decision, claimantName, itemName, proof) {
  document.getElementById('reviewClaimId').value = claimId;
  document.getElementById('reviewDecision').value = decision;
  document.getElementById('reviewModalTitle').textContent = `${decision === 'APPROVED' ? 'Approve' : 'Reject'} Claim #${claimId}`;
  document.getElementById('reviewSummary').value = `${claimantName} claiming "${itemName}"`;
  document.getElementById('reviewProofDetails').value = proof;
  document.getElementById('reviewNotes').value = '';

  const btnAction = document.getElementById('btnReviewAction');
  btnAction.textContent = decision === 'APPROVED' ? 'Confirm Approval' : 'Confirm Rejection';
  btnAction.className = decision === 'APPROVED' ? 'btn-success' : 'btn-danger';

  document.getElementById('reviewModal').classList.add('open');
}

async function handleReviewSubmit(e) {
  e.preventDefault();
  const claimId = document.getElementById('reviewClaimId').value;
  const decision = document.getElementById('reviewDecision').value;
  const notes = document.getElementById('reviewNotes').value;

  const payload = {
    reviewer_id: currentUser ? currentUser.user_id : 4, // Security Officer
    decision,
    review_notes: notes
  };

  try {
    const res = await fetch(`${API_BASE}/claims/${claimId}/review`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();

    if (data.success) {
      closeModal('reviewModal');
      showToast(`Decision recorded: ${data.message}`, 'success');
      await refreshAll();
      loadSecurityQueue();
    } else {
      showToast(`Error: ${data.message}`, 'error');
    }
  } catch (err) {
    showToast(`Network error: ${err.message}`, 'error');
  }
}

async function viewAuditLog(claimId) {
  const tbody = document.getElementById('auditTableBody');
  tbody.innerHTML = '<tr><td colspan="4">Loading audit entries...</td></tr>';
  document.getElementById('auditModal').classList.add('open');

  try {
    const res = await fetch(`${API_BASE}/claims/audit/${claimId}`);
    const data = await res.json();

    if (!data.success || data.data.length === 0) {
      tbody.innerHTML = '<tr><td colspan="4">No audit entries found.</td></tr>';
      return;
    }

    tbody.innerHTML = '';
    data.data.forEach(a => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td style="font-size: 13px;">${new Date(a.action_timestamp).toLocaleTimeString()}</td>
        <td>
          <span class="badge-status ${a.previous_status || 'OPEN'}">${a.previous_status || 'NEW'}</span>
          &rarr;
          <span class="badge-status ${a.new_status}">${a.new_status}</span>
        </td>
        <td style="font-size: 13px;">${a.action_user_name || 'System / Auto'} (${a.action_user_role || 'BOT'})</td>
        <td style="font-size: 13px;">${a.comments}</td>
      `;
      tbody.appendChild(tr);
    });
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="4" style="color: var(--color-error);">Error: ${err.message}</td></tr>`;
  }
}

// ========================================================
// PHASE 2 & 3: CONCURRENCY RACE & SCORE EXPLAINER
// ========================================================
function openConcurrencyModal() {
  document.getElementById('concurrencyModal').classList.add('open');
}

async function runConcurrencyRace() {
  const btn = document.getElementById('btnRunRace');
  const threadACard = document.getElementById('threadACard');
  const threadBCard = document.getElementById('threadBCard');
  const threadABadge = document.getElementById('threadABadge');
  const threadBBadge = document.getElementById('threadBBadge');
  const threadAMsg = document.getElementById('threadAMsg');
  const threadBMsg = document.getElementById('threadBMsg');
  const threadATime = document.getElementById('threadATime');
  const threadBTime = document.getElementById('threadBTime');

  btn.disabled = true;
  btn.textContent = 'Acquiring Row Locks...';

  threadACard.className = 'thread-card';
  threadBCard.className = 'thread-card';
  threadABadge.className = 'thread-status-badge';
  threadBBadge.className = 'thread-status-badge';
  threadABadge.textContent = 'Executing SELECT FOR UPDATE...';
  threadBBadge.textContent = 'Executing SELECT FOR UPDATE...';

  try {
    const res = await fetch(`${API_BASE}/claims/simulate-race`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ found_id: 2, claimant_a_id: 2, claimant_b_id: 3 })
    });
    const data = await res.json();

    if (data.success) {
      const a = data.thread_a;
      const b = data.thread_b;

      threadATime.textContent = `T+${a.elapsed_ms}ms`;
      threadBTime.textContent = `T+${b.elapsed_ms}ms`;

      // Thread A render
      if (a.result_code === 'SUCCESS') {
        threadACard.className = 'thread-card winner';
        threadABadge.className = 'thread-status-badge success';
        threadABadge.textContent = '🏆 200 OK - Lock Acquired & Committed';
        threadAMsg.textContent = `Claim #${a.claim_id} created under pessimistic row lock. Status moved to UNDER_CLAIM.`;
      } else {
        threadACard.className = 'thread-card blocked';
        threadABadge.className = 'thread-status-badge blocked';
        threadABadge.textContent = `🚫 409 Conflict - Blocked & Aborted`;
        threadAMsg.textContent = a.message;
      }

      // Thread B render
      if (b.result_code === 'SUCCESS') {
        threadBCard.className = 'thread-card winner';
        threadBBadge.className = 'thread-status-badge success';
        threadBBadge.textContent = '🏆 200 OK - Lock Acquired & Committed';
        threadBMsg.textContent = `Claim #${b.claim_id} created under pessimistic row lock. Status moved to UNDER_CLAIM.`;
      } else {
        threadBCard.className = 'thread-card blocked';
        threadBBadge.className = 'thread-status-badge blocked';
        threadBBadge.textContent = `🚫 409 Conflict - Blocked & Aborted`;
        threadBMsg.textContent = b.message;
      }

      showToast(`Race complete! ${data.winner} won the row lock; competing thread was safely blocked.`, 'info');
      await refreshAll();
    } else {
      showToast('Error running simulation: ' + data.error, 'error');
    }
  } catch (err) {
    showToast('Network error running simulation: ' + err.message, 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = '🚀 Re-Run Concurrent Race';
  }
}

function openScoreExplainer(itemName, score, category) {
  document.getElementById('explainerItemName').textContent = itemName;
  document.getElementById('explainerTotalScore').textContent = `${score}% Match`;
  document.getElementById('scoreExplainerModal').classList.add('open');
}

function closeModal(modalId) {
  document.getElementById(modalId).classList.remove('open');
}

// Helpers
function escapeQuotes(str) {
  if (!str) return '';
  return str.replace(/'/g, "\\'").replace(/"/g, '&quot;');
}

function showToast(message, type = 'info') {
  const container = document.getElementById('toastContainer');
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `<span>${type === 'success' ? '✓' : type === 'error' ? '✕' : 'ℹ'}</span> <span>${message}</span>`;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(10px)';
    toast.style.transition = 'all 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}

function openReceiptModal(claimId, claimantName, claimantEnrollment, claimantPhone, itemName, categoryName, custodyLocation, proofDetails) {
  document.getElementById('rcptVoucherId').textContent = `UBIT-REC-${String(claimId).padStart(4, '0')}`;
  document.getElementById('rcptDateTime').textContent = new Date().toLocaleString();
  document.getElementById('rcptClaimantName').textContent = claimantName || 'N/A';
  document.getElementById('rcptEnrollment').textContent = claimantEnrollment || 'N/A';
  document.getElementById('rcptPhone').textContent = claimantPhone || 'N/A';
  document.getElementById('rcptItemName').textContent = itemName || 'N/A';
  document.getElementById('rcptCategoryCustody').textContent = `${categoryName || 'General'} · Custody at: ${custodyLocation || 'Campus Security Desk'}`;
  document.getElementById('rcptProof').textContent = proofDetails || 'Verification documents inspected and confirmed.';
  document.getElementById('receiptModal').classList.add('open');
}

