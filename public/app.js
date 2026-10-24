// ========================================================
// CAMPUS LOST & FOUND APPLICATION JAVASCRIPT
// UBIT DBMS Project - Front-end Logic & API Integration
// Unified UBIT Claymorphism Architecture
// ========================================================

const API_BASE = '/api';

let currentUser = null;
let allUsers = [];
let allCategories = [];
let allLocations = [];
let allCatalogItems = [];
let currentCatalogCategory = '';

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

  // Pre-fill datetime inputs with current local time
  const now = new Date();
  now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
  const nowStr = now.toISOString().slice(0, 16);
  if (document.getElementById('lostDateTime')) document.getElementById('lostDateTime').value = nowStr;
  if (document.getElementById('foundDateTime')) document.getElementById('foundDateTime').value = nowStr;

  // Load initial master data and default views
  await loadUsers();
  await loadMasterData();
  await refreshAll();
  await loadRecentActivity();
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
  if (viewId === 'view-home') loadRecentActivity();
  if (viewId === 'view-catalog') loadCatalog();
  if (viewId === 'view-matches') loadMatches();
  if (viewId === 'view-security') loadSecurityQueue();
  if (viewId === 'view-analytics') loadAnalytics();

  window.scrollTo({ top: 0, behavior: 'smooth' });
}

async function refreshAll() {
  await loadHeroStats();
  await loadRecentActivity();
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
      
      if (lostCat) lostCat.innerHTML = '<option value="">Select Category...</option>';
      if (foundCat) foundCat.innerHTML = '<option value="">Select Category...</option>';

      allCategories.forEach(c => {
        if (lostCat) {
          const opt1 = document.createElement('option');
          opt1.value = c.category_id;
          opt1.textContent = c.name;
          lostCat.appendChild(opt1);
        }

        if (foundCat) {
          const opt2 = document.createElement('option');
          opt2.value = c.category_id;
          opt2.textContent = c.name;
          foundCat.appendChild(opt2);
        }
      });

      // Populate Catalog filter pills
      populateCatalogCategoryPills();
    }

    if (locData.success) {
      allLocations = locData.data;
      const lostLoc = document.getElementById('lostLocation');
      const foundLoc = document.getElementById('foundLocation');
      const foundCustody = document.getElementById('foundCustody');

      if (lostLoc) lostLoc.innerHTML = '<option value="">Select Location...</option>';
      if (foundLoc) foundLoc.innerHTML = '<option value="">Select Location...</option>';
      if (foundCustody) foundCustody.innerHTML = '<option value="">Select Custody Desk...</option>';

      allLocations.forEach(l => {
        const text = `${l.building_name} (${l.room_floor})`;
        
        if (lostLoc) {
          const opt1 = document.createElement('option');
          opt1.value = l.location_id;
          opt1.textContent = text;
          lostLoc.appendChild(opt1);
        }

        if (foundLoc) {
          const opt2 = document.createElement('option');
          opt2.value = l.location_id;
          opt2.textContent = text;
          foundLoc.appendChild(opt2);
        }

        if (foundCustody) {
          const opt3 = document.createElement('option');
          opt3.value = text;
          opt3.textContent = text;
          foundCustody.appendChild(opt3);
        }
      });
    }
  } catch (err) {
    console.error('Failed to load master data:', err);
  }
}

// ========================================================
// HERO STATS & LIVE COUNTERS
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

    if (lost.success) {
      const el = document.getElementById('statTotalLost');
      if (el) el.textContent = lost.data.length;
    }
    if (found.success) {
      const el = document.getElementById('statAvailableFound');
      if (el) el.textContent = found.data.length;
    }
    if (matches.success) {
      const el = document.getElementById('statHighMatches');
      if (el) el.textContent = matches.data.length;
    }
    
    const resCount = queue.success ? queue.data.filter(c => c.claim_status === 'APPROVED').length : 0;
    const resolvedEl = document.getElementById('statResolvedClaims');
    if (resolvedEl) resolvedEl.textContent = resCount;
  } catch (err) {
    console.error('Failed to load hero stats:', err);
  }
}

// ========================================================
// HOME: RECENT ACTIVITY TICKER
// ========================================================
async function loadRecentActivity() {
  const ticker = document.getElementById('recentActivityTicker');
  if (!ticker) return;

  try {
    const [lostRes, foundRes] = await Promise.all([
      fetch(`${API_BASE}/lost`),
      fetch(`${API_BASE}/found`)
    ]);

    const lost = await lostRes.json();
    const found = await foundRes.json();

    const items = [];
    if (lost.success) {
      lost.data.slice(0, 4).forEach(item => items.push({ ...item, reportType: 'LOST' }));
    }
    if (found.success) {
      found.data.slice(0, 4).forEach(item => items.push({ ...item, reportType: 'FOUND' }));
    }

    // Sort by created_at descending
    items.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    if (items.length === 0) {
      ticker.innerHTML = '<div style="color: var(--color-text-muted); font-size: 13px;">No recent campus activity recorded yet.</div>';
      return;
    }

    ticker.innerHTML = '';
    items.slice(0, 6).forEach(item => {
      const isLost = item.reportType === 'LOST';
      const div = document.createElement('div');
      div.className = 'ticker-item';
      div.onclick = () => switchView('view-catalog');
      div.style.cursor = 'pointer';
      div.innerHTML = `
        <div class="ticker-type-icon ${isLost ? '' : 'found'}">
          ${isLost ? '🔍' : '📦'}
        </div>
        <div class="ticker-content">
          <div class="ticker-title">${item.item_name}</div>
          <div class="ticker-meta">
            ${isLost ? 'Lost at' : 'Found at'} ${item.room_floor || item.building_name} · ${new Date(item.created_at).toLocaleDateString()}
          </div>
        </div>
      `;
      ticker.appendChild(div);
    });
  } catch (err) {
    console.error('Failed to load recent activity:', err);
  }
}

// ========================================================
// BROWSE DIRECTORY (Catalog View)
// ========================================================
function populateCatalogCategoryPills() {
  const container = document.getElementById('catalogCategoryPills');
  if (!container) return;

  container.innerHTML = '<button class="filter-pill active" onclick="setCatalogCategory(\'\')">All Items</button>';
  allCategories.forEach(c => {
    const btn = document.createElement('button');
    btn.className = 'filter-pill';
    btn.textContent = c.name;
    btn.onclick = () => setCatalogCategory(c.category_id);
    container.appendChild(btn);
  });
}

async function loadCatalog() {
  const grid = document.getElementById('catalogGrid');
  if (!grid) return;
  grid.innerHTML = '<div style="color: var(--color-text-muted);">Loading campus property directory...</div>';

  try {
    const [lostRes, foundRes] = await Promise.all([
      fetch(`${API_BASE}/lost`),
      fetch(`${API_BASE}/found`)
    ]);

    const lost = await lostRes.json();
    const found = await foundRes.json();

    allCatalogItems = [];

    if (lost.success) {
      lost.data.forEach(item => {
        allCatalogItems.push({
          id: item.lost_id,
          type: 'LOST',
          item_name: item.item_name,
          category_name: item.category_name,
          category_id: item.category_id,
          location: `${item.building_name} (${item.room_floor})`,
          date: item.lost_date,
          status: item.status,
          brand: item.brand,
          color: item.color,
          description: item.description,
          reporter: item.owner_name
        });
      });
    }

    if (found.success) {
      found.data.forEach(item => {
        allCatalogItems.push({
          id: item.found_id,
          type: 'FOUND',
          item_name: item.item_name,
          category_name: item.category_name,
          category_id: item.category_id,
          location: `${item.building_name} (${item.room_floor})`,
          date: item.found_date,
          status: item.status,
          brand: item.brand,
          color: item.color,
          description: item.description,
          reporter: item.finder_name
        });
      });
    }

    // Sort newest first
    allCatalogItems.sort((a, b) => new Date(b.date) - new Date(a.date));
    filterCatalog();
  } catch (err) {
    grid.innerHTML = `<div style="color: var(--color-danger);">Failed to load directory: ${err.message}</div>`;
  }
}

function setCatalogCategory(catId) {
  currentCatalogCategory = catId ? String(catId) : '';
  const pills = document.querySelectorAll('#catalogCategoryPills .filter-pill');
  pills.forEach((p, index) => {
    if (catId === '' && index === 0) p.classList.add('active');
    else if (p.textContent === (allCategories.find(c => c.category_id == catId)?.name || '')) p.classList.add('active');
    else p.classList.remove('active');
  });
  filterCatalog();
}

function filterCatalog() {
  const query = (document.getElementById('catalogSearchInput')?.value || '').toLowerCase().trim();
  const grid = document.getElementById('catalogGrid');
  if (!grid) return;

  const filtered = allCatalogItems.filter(item => {
    const matchesCat = !currentCatalogCategory || String(item.category_id) === currentCatalogCategory;
    const matchesSearch = !query || 
      item.item_name.toLowerCase().includes(query) ||
      (item.brand && item.brand.toLowerCase().includes(query)) ||
      (item.color && item.color.toLowerCase().includes(query)) ||
      item.location.toLowerCase().includes(query) ||
      (item.description && item.description.toLowerCase().includes(query));
    return matchesCat && matchesSearch;
  });

  if (filtered.length === 0) {
    grid.innerHTML = `
      <div style="grid-column: 1 / -1; padding: 48px; text-align: center; background: var(--color-surface); border-radius: var(--radius-xl); box-shadow: var(--clay-card-shadow);">
        <h4>No Items Found Matching Your Search</h4>
        <p style="color: var(--color-text-muted); margin-top: 6px;">Try adjusting your search terms or category filters.</p>
      </div>
    `;
    return;
  }

  grid.innerHTML = '';
  filtered.forEach(item => {
    const isFound = item.type === 'FOUND';
    const card = document.createElement('div');
    card.className = 'catalog-card';
    card.innerHTML = `
      <div>
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
          <span class="card-status-badge ${item.status.toLowerCase()}">${item.type}: ${item.status}</span>
          <span style="font-size: 11px; font-weight: 600; color: var(--color-text-muted);">${item.category_name}</span>
        </div>

        <h4 style="font-size: 16px; font-weight: 700; color: var(--color-text-main); margin-bottom: 6px;">${item.item_name}</h4>
        
        <div style="font-size: 12px; color: var(--color-text-muted); margin-bottom: 12px;">
          <div>📍 ${item.location}</div>
          <div>📅 ${new Date(item.date).toLocaleDateString()}</div>
          ${item.brand || item.color ? `<div>🏷️ ${[item.brand, item.color].filter(Boolean).join(' · ')}</div>` : ''}
        </div>

        ${item.description ? `<p style="font-size: 12px; color: var(--color-text-body); background: var(--color-surface-soft); padding: 8px 12px; border-radius: var(--radius-sm); margin-bottom: 14px;">${item.description}</p>` : ''}
      </div>

      <div style="display: flex; justify-content: space-between; align-items: center; padding-top: 12px; border-top: 1px solid var(--color-hairline);">
        <span style="font-size: 11px; color: var(--color-text-muted);">Reported by ${item.reporter}</span>
        ${isFound && item.status === 'AVAILABLE' ? `
          <button class="btn-primary" style="padding: 6px 14px; font-size: 12px;" onclick="openClaimModal(${item.id}, null, '${escapeQuotes(item.item_name)}')">Claim Item</button>
        ` : `
          <button class="btn-secondary" style="padding: 6px 12px; font-size: 12px;" onclick="switchView('view-matches')">View Details</button>
        `}
      </div>
    `;
    grid.appendChild(card);
  });
}

// ========================================================
// SMART MATCHES FEED
// ========================================================
async function loadMatches() {
  const container = document.getElementById('matchesContainer');
  if (!container) return;
  container.innerHTML = '<div style="color: var(--color-text-muted);">Loading live matches...</div>';

  try {
    const res = await fetch(`${API_BASE}/matches`);
    const data = await res.json();

    if (!data.success || data.data.length === 0) {
      container.innerHTML = `
        <div style="grid-column: 1 / -1; padding: 48px; text-align: center; background-color: var(--color-surface); border-radius: var(--radius-xl); box-shadow: var(--clay-card-shadow);">
          <h4>No Active Match Proposals</h4>
          <p style="color: var(--color-text-muted); margin-top: 6px;">Submit a new Lost or Found report to run the stored procedure matching engine.</p>
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
            <span class="${scoreClass}">⚡ ${m.match_score}% Match Score</span>
            <span style="font-size: 11px; font-weight: 700; color: var(--color-primary);">${m.category_name}</span>
          </div>

          <h4 style="font-size: 16px; font-weight: 700; color: var(--color-text-main); margin-bottom: 4px;">${m.lost_item_name}</h4>
          <p style="font-size: 12px; color: var(--color-text-muted); margin-bottom: 8px;">
            Reported lost by <strong>${m.owner_name}</strong>
          </p>

          <div class="item-vs-container">
            <div class="vs-row">
              <span class="vs-label">Found Item:</span>
              <span class="vs-value">${m.found_item_name}</span>
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
              <span class="vs-label">Custody Desk:</span>
              <span class="vs-value">${m.custody_location}</span>
            </div>
          </div>
        </div>

        <div style="display: flex; gap: 8px; margin-top: 14px;">
          <button class="btn-primary" style="flex: 1;" onclick="openClaimModal(${m.found_id}, ${m.lost_id}, '${escapeQuotes(m.found_item_name)}')">
            Claim Found Item
          </button>
          <button class="btn-secondary" style="padding: 0 12px;" onclick="openScoreExplainer('${escapeQuotes(m.found_item_name)}', ${m.match_score}, '${escapeQuotes(m.category_name)}')">
            Why this score? 💡
          </button>
        </div>
      `;
      container.appendChild(card);
    });
  } catch (err) {
    container.innerHTML = `<div style="color: var(--color-danger);">Failed to load matches: ${err.message}</div>`;
  }
}

// ========================================================
// REPORT LOST ITEM
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
      (document.getElementById('lostForm') || document.getElementById('lostItemForm'))?.reset();
      await refreshAll();
      switchView('view-matches');
    } else {
      showToast(`Error: ${data.error}`, 'error');
    }
  } catch (err) {
    showToast(`Network error: ${err.message}`, 'error');
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = 'Submit Report & Check Matches';
  }
}

// ========================================================
// REPORT FOUND ITEM
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
    description: document.getElementById('foundStorageBin')?.value || ''
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
      (document.getElementById('foundForm') || document.getElementById('foundItemForm'))?.reset();
      await refreshAll();
      switchView('view-matches');
    } else {
      showToast(`Error: ${data.error}`, 'error');
    }
  } catch (err) {
    showToast(`Network error: ${err.message}`, 'error');
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = 'Record Found Item & Check Matches';
  }
}

// ========================================================
// SECURITY QUEUE & AUDIT LOG
// ========================================================
async function loadSecurityQueue() {
  const tbody = document.getElementById('securityQueueTableBody');
  if (!tbody) return;
  tbody.innerHTML = '<tr><td colspan="8">Loading claims review queue...</td></tr>';

  try {
    const res = await fetch(`${API_BASE}/analytics/security-queue`);
    const data = await res.json();

    if (!data.success || data.data.length === 0) {
      tbody.innerHTML = '<tr><td colspan="8" style="text-align: center; padding: 32px;">No claims currently in verification queue.</td></tr>';
      return;
    }

    tbody.innerHTML = '';
    data.data.forEach(c => {
      const isPending = c.claim_status === 'PENDING' || c.claim_status === 'UNDER_REVIEW';
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td><strong>#${c.claim_id}</strong></td>
        <td>${new Date(c.claim_date).toLocaleDateString()}</td>
        <td>
          <strong>${c.claimant_name}</strong><br>
          <span style="font-size: 11px; color: var(--color-text-muted); font-family: var(--font-mono);">${c.claimant_enrollment} · ${c.claimant_phone}</span>
        </td>
        <td>
          <strong>${c.found_item_name}</strong><br>
          <span style="font-size: 11px; color: var(--color-text-muted);">${c.category_name} (${c.found_building})</span>
        </td>
        <td><span style="font-size: 12px;">${c.custody_location}</span></td>
        <td style="max-width: 200px; font-size: 12px;">${c.proof_details}</td>
        <td><span class="card-status-badge ${c.claim_status.toLowerCase()}">${c.claim_status}</span></td>
        <td>
          <div style="display: flex; gap: 6px;">
            ${isPending ? `
              <button class="btn-success" onclick="openReviewModal(${c.claim_id}, 'APPROVED', '${escapeQuotes(c.claimant_name)}', '${escapeQuotes(c.found_item_name)}', '${escapeQuotes(c.proof_details)}')">Approve</button>
              <button class="btn-danger" onclick="openReviewModal(${c.claim_id}, 'REJECTED', '${escapeQuotes(c.claimant_name)}', '${escapeQuotes(c.found_item_name)}', '${escapeQuotes(c.proof_details)}')">Reject</button>
            ` : ''}
            ${c.claim_status === 'APPROVED' ? `
              <button class="btn-gold" style="padding: 6px 10px; font-size: 12px;" onclick="openReceiptModal(${c.claim_id}, '${escapeQuotes(c.claimant_name)}', '${escapeQuotes(c.claimant_enrollment)}', '${escapeQuotes(c.claimant_phone)}', '${escapeQuotes(c.found_item_name)}', '${escapeQuotes(c.category_name)}', '${escapeQuotes(c.custody_location)}', '${escapeQuotes(c.proof_details)}')">Voucher 📄</button>
            ` : ''}
            <button class="btn-secondary" style="padding: 6px 10px; font-size: 12px;" onclick="viewAuditLog(${c.claim_id})">Audit</button>
          </div>
        </td>
      `;
      tbody.appendChild(tr);
    });
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="8" style="color: var(--color-danger);">Error: ${err.message}</td></tr>`;
  }
}

// ========================================================
// ANALYTICS & SPATIAL HOTSPOTS
// ========================================================
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
    if (rateBody) {
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
                <div style="background-color: var(--color-primary); height: 100%; width: ${Math.min(rate, 100)}%;"></div>
              </div>
            </td>
          `;
          rateBody.appendChild(tr);
        });
      }
    }

    // Render Hotspots Table & Visual Grid
    const spotBody = document.getElementById('hotspotsTableBody');
    const zoneGrid = document.getElementById('hotspotZoneGrid');
    if (spotBody) spotBody.innerHTML = '';
    if (zoneGrid) zoneGrid.innerHTML = '';

    if (spotData.success) {
      spotData.data.forEach(s => {
        if (spotBody) {
          const tr = document.createElement('tr');
          tr.innerHTML = `
            <td>
              <strong>${s.building_name}</strong><br>
              <span style="font-size: 11px; color: var(--color-text-muted);">${s.room_floor}</span>
            </td>
            <td><span class="card-status-badge available">${s.zone_type}</span></td>
            <td><strong style="color: var(--color-danger);">${s.lost_items_count}</strong></td>
            <td><strong style="color: var(--color-success);">${s.found_items_count}</strong></td>
          `;
          spotBody.appendChild(tr);
        }

        if (zoneGrid) {
          const zoneCard = document.createElement('div');
          const isHigh = s.lost_items_count >= 2;
          const statusText = isHigh ? 'High Loss Activity' : 'Standard Activity';
          const statusColor = isHigh ? 'var(--color-danger)' : 'var(--color-success)';

          zoneCard.className = 'clay-stat-card';
          zoneCard.innerHTML = `
            <div>
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
                <span class="card-status-badge open">${s.zone_type}</span>
                <span style="font-size: 11px; font-weight: 700; color: ${statusColor};">${statusText}</span>
              </div>
              <h5 style="font-size: 14px; font-weight: 700; color: var(--color-text-main); margin-bottom: 2px;">${s.building_name}</h5>
              <p style="font-size: 11px; color: var(--color-text-muted);">${s.room_floor}</p>
            </div>
            <div style="display: flex; justify-content: space-between; font-size: 12px; margin-top: 12px; border-top: 1px solid var(--color-hairline); padding-top: 6px;">
              <span>Lost: <strong style="color: var(--color-danger);">${s.lost_items_count}</strong></span>
              <span>Found: <strong style="color: var(--color-success);">${s.found_items_count}</strong></span>
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
// MODALS: CLAIM & CONCURRENCY
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
    reviewer_id: currentUser ? currentUser.user_id : 4,
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
        <td style="font-size: 12px; font-family: var(--font-mono);">${new Date(a.action_timestamp).toLocaleTimeString()}</td>
        <td>
          <span class="card-status-badge ${a.previous_status ? a.previous_status.toLowerCase() : 'open'}">${a.previous_status || 'NEW'}</span>
          &rarr;
          <span class="card-status-badge ${a.new_status.toLowerCase()}">${a.new_status}</span>
        </td>
        <td style="font-size: 12px;">${a.action_user_name || 'System / Auto'} (${a.action_user_role || 'BOT'})</td>
        <td style="font-size: 12px;">${a.comments}</td>
      `;
      tbody.appendChild(tr);
    });
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="4" style="color: var(--color-danger);">Error: ${err.message}</td></tr>`;
  }
}

// ========================================================
// CONCURRENCY RACE & SCORE EXPLAINER
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
        threadABadge.textContent = '🏆 200 OK - Lock Acquired & Committed';
        threadAMsg.textContent = `Claim #${a.claim_id} created under pessimistic row lock. Status moved to UNDER_CLAIM.`;
      } else {
        threadACard.className = 'thread-card blocked';
        threadABadge.textContent = `🚫 409 Conflict - Blocked & Aborted`;
        threadAMsg.textContent = a.message;
      }

      // Thread B render
      if (b.result_code === 'SUCCESS') {
        threadBCard.className = 'thread-card winner';
        threadBBadge.textContent = '🏆 200 OK - Lock Acquired & Committed';
        threadBMsg.textContent = `Claim #${b.claim_id} created under pessimistic row lock. Status moved to UNDER_CLAIM.`;
      } else {
        threadBCard.className = 'thread-card blocked';
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
  if (!container) return;
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
