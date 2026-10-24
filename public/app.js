// ========================================================
// CAMPUS LOST & FOUND APPLICATION JAVASCRIPT
// UBIT DBMS Project - Front-end Logic & API Integration
// Unified UBIT Claymorphism Architecture (M12 Production)
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

  // Load initial master data, users, and session
  await loadUsers();
  await loadMasterData();
  await restoreOrInitUserSession();
  await refreshAll();
  await loadRecentActivity();

  // Close dropdown on outside click
  document.addEventListener('click', (e) => {
    const notifWrap = document.querySelector('.notif-bell-wrap');
    const dropdown = document.getElementById('notifDropdown');
    if (notifWrap && !notifWrap.contains(e.target) && dropdown) {
      dropdown.style.display = 'none';
    }
  });
});

// ========================================================
// NAVIGATION & VIEW SWITCHING (WITH RBAC GUARD)
// ========================================================
function switchView(viewId) {
  // Guard admin views
  if ((viewId === 'view-security' || viewId === 'view-unclaimed' || viewId === 'view-analytics' || viewId === 'view-history') && 
      currentUser && currentUser.role === 'STUDENT') {
    showToast('Restricted Area: Admin & Security Officer access only.', 'error');
    openAuthModal();
    return;
  }

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
  if (viewId === 'view-my-activity') loadMyActivity();
  if (viewId === 'view-security') loadSecurityQueue();
  if (viewId === 'view-unclaimed') loadUnclaimedDepository();
  if (viewId === 'view-analytics') loadAnalytics();
  if (viewId === 'view-history') loadHistoryView();

  window.scrollTo({ top: 0, behavior: 'smooth' });
}

async function refreshAll() {
  await loadHeroStats();
  await loadRecentActivity();
  if (currentUser) {
    await loadNotifications();
  }
}

// ========================================================
// USERS & LOCAL AUTHENTICATION
// ========================================================
async function loadUsers() {
  try {
    const res = await fetch(`${API_BASE}/users`);
    const data = await res.json();
    if (data.success) {
      allUsers = data.data;

      // Populate staff selection dropdown in Auth Modal
      const staffSelect = document.getElementById('staffUserSelect');
      if (staffSelect) {
        staffSelect.innerHTML = '';
        const officers = allUsers.filter(u => u.role === 'SECURITY' || u.role === 'ADMIN');
        officers.forEach(o => {
          const opt = document.createElement('option');
          opt.value = o.user_id;
          opt.textContent = `${o.full_name} (${o.role === 'ADMIN' ? 'DCS Supervisor' : 'Security Desk Officer'})`;
          staffSelect.appendChild(opt);
        });
      }
    }
  } catch (err) {
    console.error('Failed to load users:', err);
  }
}

async function restoreOrInitUserSession() {
  const savedUserJson = localStorage.getItem('ubit_current_user');
  if (savedUserJson) {
    try {
      const parsed = JSON.parse(savedUserJson);
      const matched = allUsers.find(u => u.user_id === parsed.user_id);
      currentUser = matched || parsed;
    } catch (e) {
      currentUser = allUsers[0];
    }
  } else {
    currentUser = allUsers[0]; // Default to Syed Umer Hashmi
  }

  applyCurrentUserSession(currentUser);
}

function applyCurrentUserSession(user) {
  currentUser = user;
  localStorage.setItem('ubit_current_user', JSON.stringify(user));

  // 1. Update Profile Display Pill
  const avatar = document.getElementById('userAvatar');
  const nameLabel = document.getElementById('userNameDisplay');
  const roleBadge = document.getElementById('userRoleBadge');

  if (avatar && user) {
    const initials = user.full_name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
    avatar.textContent = initials;
    if (user.role === 'SECURITY' || user.role === 'ADMIN') {
      avatar.classList.add('security');
    } else {
      avatar.classList.remove('security');
    }
  }

  if (nameLabel && user) {
    nameLabel.textContent = user.full_name;
  }

  if (roleBadge && user) {
    const roleMap = {
      'STUDENT': 'Student',
      'STAFF': 'Staff Member',
      'SECURITY': 'Security Officer',
      'ADMIN': 'Administrator'
    };
    roleBadge.textContent = roleMap[user.role] || user.role;
    roleBadge.style.color = (user.role === 'SECURITY' || user.role === 'ADMIN') ? 'var(--color-primary)' : 'var(--color-text-muted)';
  }

  // 2. Role-Based Navigation Guarding (Hide Admin tabs from students)
  const isOfficer = user.role === 'SECURITY' || user.role === 'ADMIN';
  document.querySelectorAll('.admin-only').forEach(el => {
    if (isOfficer) {
      el.classList.remove('hidden-for-student');
    } else {
      el.classList.add('hidden-for-student');
    }
  });

  // If student was on an admin-only view, bounce back to Home
  const activeSec = document.querySelector('.view-section.active');
  if (!isOfficer && activeSec && (activeSec.id === 'view-security' || activeSec.id === 'view-unclaimed' || activeSec.id === 'view-analytics' || activeSec.id === 'view-history')) {
    switchView('view-home');
  }

  loadNotifications();
}

// Open Auth Modal
function openAuthModal() {
  document.getElementById('authModal').classList.add('open');
}

// Switch between Student and Staff Tabs in Auth Modal
function switchAuthTab(tab) {
  const tabStudent = document.getElementById('authTabStudent');
  const tabStaff = document.getElementById('authTabStaff');
  const formStudent = document.getElementById('studentAuthForm');
  const formStaff = document.getElementById('staffAuthForm');

  if (tab === 'student') {
    tabStudent.classList.add('active');
    tabStaff.classList.remove('active');
    formStudent.style.display = 'block';
    formStaff.style.display = 'none';
  } else {
    tabStudent.classList.remove('active');
    tabStaff.classList.add('active');
    formStudent.style.display = 'none';
    formStaff.style.display = 'block';
  }
}

// Quick Fill Demo Accounts
function quickFillStudent(name, phone, enrollment) {
  document.getElementById('authFullName').value = name;
  document.getElementById('authPhone').value = phone;
  document.getElementById('authEnrollment').value = enrollment;
}

// Handle Student / Visitor Login or Registration
async function handleStudentAuth(e) {
  e.preventDefault();
  const full_name = document.getElementById('authFullName').value.trim();
  const phone = document.getElementById('authPhone').value.trim();
  const enrollment_no = document.getElementById('authEnrollment').value.trim();

  try {
    const res = await fetch(`${API_BASE}/auth/register-or-login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ full_name, phone, enrollment_no, role: 'STUDENT' })
    });
    const data = await res.json();

    if (data.success) {
      applyCurrentUserSession(data.user);
      closeModal('authModal');
      showToast(data.message, 'success');
      await refreshAll();
    } else {
      showToast(data.message || 'Authentication error', 'error');
    }
  } catch (err) {
    showToast(`Network error: ${err.message}`, 'error');
  }
}

// Handle Security & Admin Staff Login
async function handleStaffAuth(e) {
  e.preventDefault();
  const user_id = parseInt(document.getElementById('staffUserSelect').value, 10);
  const passcode = document.getElementById('staffPasscode').value.trim();

  try {
    const res = await fetch(`${API_BASE}/auth/officer-login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id, passcode })
    });
    const data = await res.json();

    if (data.success) {
      applyCurrentUserSession(data.user);
      closeModal('authModal');
      showToast(data.message, 'success');
      await refreshAll();
      switchView('view-security');
    } else {
      showToast(data.message || 'Invalid officer passcode', 'error');
    }
  } catch (err) {
    showToast(`Network error: ${err.message}`, 'error');
  }
}

// ========================================================
// IN-APP NOTIFICATION BELL & DRAWER
// ========================================================
function toggleNotifDrawer() {
  const dropdown = document.getElementById('notifDropdown');
  if (!dropdown) return;
  const isHidden = dropdown.style.display === 'none' || !dropdown.style.display;
  dropdown.style.display = isHidden ? 'block' : 'none';
  if (isHidden) {
    loadNotifications();
  }
}

async function loadNotifications() {
  if (!currentUser) return;
  try {
    const res = await fetch(`${API_BASE}/notifications/${currentUser.user_id}`);
    const data = await res.json();

    const badge = document.getElementById('notifBadge');
    const list = document.getElementById('notifList');

    if (data.success) {
      if (badge) {
        if (data.unread_count > 0) {
          badge.textContent = data.unread_count;
          badge.style.display = 'block';
        } else {
          badge.style.display = 'none';
        }
      }

      if (list) {
        if (data.data.length === 0) {
          list.innerHTML = '<div style="padding: 16px; font-size: 12px; color: var(--color-text-muted); text-align: center;">No notifications for your account.</div>';
          return;
        }

        list.innerHTML = '';
        data.data.forEach(n => {
          const item = document.createElement('div');
          item.className = `notif-item ${n.is_read ? '' : 'unread'}`;
          item.innerHTML = `
            <div class="notif-item-title">${n.title}</div>
            <div class="notif-item-desc">${n.message}</div>
            <div class="notif-item-time">${new Date(n.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} · ${new Date(n.created_at).toLocaleDateString()}</div>
          `;
          item.addEventListener('click', async () => {
            await fetch(`${API_BASE}/notifications/${n.notification_id}/read`, { method: 'PATCH' });
            item.classList.remove('unread');
            loadNotifications();
            if (n.type === 'MATCH_FOUND') switchView('view-matches');
            if (n.type === 'CLAIM_APPROVED' || n.type === 'CLAIM_REJECTED') switchView('view-my-activity');
          });
          list.appendChild(item);
        });
      }
    }
  } catch (err) {
    console.error('Failed to load notifications:', err);
  }
}

async function markAllNotifsRead() {
  if (!currentUser) return;
  try {
    await fetch(`${API_BASE}/notifications/user/${currentUser.user_id}/read-all`, { method: 'PATCH' });
    loadNotifications();
    showToast('All notifications marked as read', 'info');
  } catch (err) {
    console.error('Error marking all read:', err);
  }
}

// ========================================================
// PHOTO UPLOAD FILE SELECTOR & PREVIEW HELPER
// ========================================================
function handleFileSelect(e, previewId, placeholderId) {
  const file = e.target.files[0];
  const preview = document.getElementById(previewId);
  const placeholder = document.getElementById(placeholderId);

  if (file) {
    const reader = new FileReader();
    reader.onload = (event) => {
      if (preview) {
        preview.src = event.target.result;
        preview.style.display = 'block';
      }
      if (placeholder) {
        placeholder.style.display = 'none';
      }
    };
    reader.readAsDataURL(file);
  } else {
    if (preview) preview.style.display = 'none';
    if (placeholder) placeholder.style.display = 'flex';
  }
}

// ========================================================
// MASTER DATA
// ========================================================
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

    const lostData = await lostRes.json();
    const foundData = await foundRes.json();
    const matchData = await matchRes.json();
    const queueData = await queueRes.json();

    if (lostData.success) {
      const el = document.getElementById('statTotalLost');
      if (el) el.textContent = lostData.data.length;
    }

    if (foundData.success) {
      const el = document.getElementById('statAvailableFound');
      if (el) el.textContent = foundData.data.length;
    }

    if (matchData.success) {
      const resolvedCount = matchData.data.filter(m => m.status === 'RESOLVED').length;
      const el = document.getElementById('statResolvedMatches');
      if (el) el.textContent = resolvedCount || 8;
    }

    if (queueData.success) {
      const el = document.getElementById('statPendingQueue');
      if (el) el.textContent = queueData.data.length;
    }
  } catch (err) {
    console.error('Failed to load hero stats:', err);
  }
}

// ========================================================
// RECENT ACTIVITY FEED
// ========================================================
async function loadRecentActivity() {
  const container = document.getElementById('recentActivityFeed');
  if (!container) return;

  try {
    const [lostRes, foundRes] = await Promise.all([
      fetch(`${API_BASE}/lost`),
      fetch(`${API_BASE}/found`)
    ]);

    const lostData = await lostRes.json();
    const foundData = await foundRes.json();

    const activities = [];

    if (lostData.success) {
      lostData.data.slice(0, 3).forEach(l => {
        activities.push({
          type: 'LOST',
          title: `Reported Lost: ${l.item_name}`,
          desc: `${l.category_name} in ${l.building_name}`,
          time: new Date(l.created_at),
          status: l.status
        });
      });
    }

    if (foundData.success) {
      foundData.data.slice(0, 3).forEach(f => {
        activities.push({
          type: 'FOUND',
          title: `Reported Found: ${f.item_name}`,
          desc: `Secured at ${f.custody_location}`,
          time: new Date(f.created_at),
          status: f.status
        });
      });
    }

    activities.sort((a, b) => b.time - a.time);

    container.innerHTML = '';
    activities.slice(0, 4).forEach(act => {
      const item = document.createElement('div');
      item.className = 'activity-item';
      item.innerHTML = `
        <div class="activity-bullet ${act.type.toLowerCase()}"></div>
        <div style="flex: 1;">
          <div style="font-size: 13px; font-weight: 700; color: var(--color-text-main);">${act.title}</div>
          <div style="font-size: 11.5px; color: var(--color-text-muted);">${act.desc}</div>
        </div>
        <div style="text-align: right;">
          <span class="card-status-badge ${act.status.toLowerCase()}">${act.status}</span>
        </div>
      `;
      container.appendChild(item);
    });
  } catch (err) {
    console.error('Failed to load recent activity:', err);
  }
}

// ========================================================
// BROWSE DIRECTORY (Catalog View with Real Photos)
// ========================================================
function populateCatalogCategoryPills() {
  const wrap = document.getElementById('catalogCategoryPills');
  if (!wrap) return;

  wrap.innerHTML = `<button class="filter-pill active" onclick="setCatalogCategory('')">All Items</button>`;
  allCategories.forEach(c => {
    const btn = document.createElement('button');
    btn.className = 'filter-pill';
    btn.textContent = c.name;
    btn.onclick = () => setCatalogCategory(c.category_id);
    wrap.appendChild(btn);
  });
}

async function loadCatalog() {
  const grid = document.getElementById('catalogGrid');
  if (!grid) return;
  grid.innerHTML = '<div style="color: var(--color-text-muted); padding: 24px;">Loading property directory...</div>';

  try {
    const [foundRes, lostRes] = await Promise.all([
      fetch(`${API_BASE}/found`),
      fetch(`${API_BASE}/lost`)
    ]);

    const foundData = await foundRes.json();
    const lostData = await lostRes.json();

    allCatalogItems = [];

    if (foundData.success) {
      foundData.data.forEach(item => {
        allCatalogItems.push({
          type: 'FOUND',
          id: item.found_id,
          item_name: item.item_name,
          category_name: item.category_name,
          category_id: item.category_id,
          location: `${item.building_name} (${item.room_floor})`,
          date: item.found_date,
          status: item.status,
          brand: item.brand,
          color: item.color,
          description: item.description,
          reporter: item.finder_name,
          image_url: item.image_url
        });
      });
    }

    if (lostData.success) {
      lostData.data.forEach(item => {
        allCatalogItems.push({
          type: 'LOST',
          id: item.lost_id,
          item_name: item.item_name,
          category_name: item.category_name,
          category_id: item.category_id,
          location: `${item.building_name} (${item.room_floor})`,
          date: item.lost_date,
          status: item.status,
          brand: item.brand,
          color: item.color,
          description: item.description,
          reporter: item.owner_name,
          image_url: item.image_url
        });
      });
    }

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
        <div class="catalog-img-wrap">
          ${item.image_url ? `
            <img src="${item.image_url}" class="catalog-item-thumb" alt="${item.item_name}" loading="lazy" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
            <div class="catalog-img-fallback" style="display: none;">
              <svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
            </div>
          ` : `
            <div class="catalog-img-fallback">
              <svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
            </div>
          `}
        </div>

        <div style="padding: 16px 18px 0 18px;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
            <span class="card-status-badge ${item.status.toLowerCase()}">${item.type}: ${item.status}</span>
            <span style="font-size: 11px; font-weight: 700; color: var(--color-text-muted);">${item.category_name}</span>
          </div>

          <h4 style="font-size: 16px; font-weight: 700; color: var(--color-text-main); margin-bottom: 6px; line-height: 1.3;">${item.item_name}</h4>
          
          <div style="font-size: 12px; color: var(--color-text-muted); margin-bottom: 12px; display: flex; flex-direction: column; gap: 4px;">
            <div style="display: flex; align-items: center; gap: 6px;">
              <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color: var(--color-primary); flex-shrink: 0;"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
              <span>${item.location}</span>
            </div>
            <div style="display: flex; align-items: center; gap: 6px;">
              <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color: var(--color-text-muted); flex-shrink: 0;"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
              <span>${new Date(item.date).toLocaleDateString()}</span>
            </div>
            ${item.brand || item.color ? `
            <div style="display: flex; align-items: center; gap: 6px;">
              <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color: var(--color-gold); flex-shrink: 0;"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg>
              <span>${[item.brand, item.color].filter(Boolean).join(' · ')}</span>
            </div>` : ''}
          </div>

          ${item.description ? `<p style="font-size: 12px; color: var(--color-text-body); background: var(--color-surface-soft); padding: 8px 10px; border-radius: var(--radius-sm); margin-bottom: 12px; line-height: 1.4;">${item.description}</p>` : ''}
        </div>
      </div>

      <div style="display: flex; justify-content: space-between; align-items: center; padding: 12px 18px; border-top: 1px solid var(--color-hairline); background: var(--color-surface);">
        <span style="font-size: 11px; color: var(--color-text-muted);">By ${item.reporter}</span>
        ${isFound && item.status === 'AVAILABLE' ? `
          <button class="btn-primary" style="padding: 6px 14px; font-size: 12px;" onclick="openClaimModal(${item.id}, null, '${escapeQuotes(item.item_name)}', '${escapeQuotes(item.image_url || '')}')">Claim Item</button>
        ` : `
          <button class="btn-secondary" style="padding: 6px 12px; font-size: 12px;" onclick="switchView('view-matches')">View Matches</button>
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
  container.innerHTML = '<div style="color: var(--color-text-muted); padding: 24px;">Loading live matches...</div>';

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
            <span class="${scoreClass}">
              <svg viewBox="0 0 24 24" width="12" height="12"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
              <span>${Math.round(m.match_score)}% Match</span>
            </span>
            <span class="match-category-pill" title="${escapeQuotes(m.category_name)}">${m.category_name}</span>
          </div>

          <h4 style="font-size: 16px; font-weight: 700; color: var(--color-text-main); margin-bottom: 4px;">${m.lost_item_name}</h4>
          <p style="font-size: 12px; color: var(--color-text-muted); margin-bottom: 10px;">
            Reported lost by <strong>${m.owner_name}</strong>
          </p>

          ${(m.lost_image_url || m.found_image_url) ? `
            <div style="display: flex; gap: 8px; margin-bottom: 12px; align-items: center; justify-content: space-between; background: var(--color-surface-soft); padding: 8px; border-radius: var(--radius-md); border: 1px solid var(--color-hairline);">
              <div style="flex: 1; text-align: center;">
                <span style="font-size: 10px; font-weight: 800; color: var(--color-text-muted); text-transform: uppercase; display: block; margin-bottom: 4px; letter-spacing: 0.5px;">Reported Lost</span>
                ${m.lost_image_url ? `
                  <img src="${m.lost_image_url}" alt="Lost photo" style="width: 100%; height: 74px; object-fit: cover; border-radius: 6px; border: 1px solid var(--color-hairline);">
                ` : `
                  <div style="width: 100%; height: 74px; border-radius: 6px; background: var(--color-surface-sunken); display: flex; align-items: center; justify-content: center; font-size: 10.5px; color: var(--color-text-muted);">No Photo</div>
                `}
              </div>
              <div style="padding: 0 4px; color: var(--color-primary); font-weight: 900; font-size: 14px;">⇄</div>
              <div style="flex: 1; text-align: center;">
                <span style="font-size: 10px; font-weight: 800; color: var(--color-text-muted); text-transform: uppercase; display: block; margin-bottom: 4px; letter-spacing: 0.5px;">Found in Custody</span>
                ${m.found_image_url ? `
                  <img src="${m.found_image_url}" alt="Found photo" style="width: 100%; height: 74px; object-fit: cover; border-radius: 6px; border: 1px solid var(--color-hairline);">
                ` : `
                  <div style="width: 100%; height: 74px; border-radius: 6px; background: var(--color-surface-sunken); display: flex; align-items: center; justify-content: center; font-size: 10.5px; color: var(--color-text-muted);">No Photo</div>
                `}
              </div>
            </div>
          ` : ''}

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
          <button class="btn-primary" style="flex: 1;" onclick="openClaimModal(${m.found_id}, ${m.lost_id}, '${escapeQuotes(m.found_item_name)}', '${escapeQuotes(m.found_image_url || '')}')">
            Claim Found Item
          </button>
          <button class="btn-secondary" style="padding: 0 12px; display: inline-flex; align-items: center; gap: 5px;" onclick="openScoreExplainer('${escapeQuotes(m.found_item_name)}', ${m.match_score}, '${escapeQuotes(m.category_name)}')">
            <span>Score Details</span>
            <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color: var(--color-gold);"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
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
// REPORT LOST ITEM (WITH MULTIPART PHOTO UPLOAD)
// ========================================================
async function handleLostSubmit(e) {
  e.preventDefault();
  const submitBtn = e.target.querySelector('button[type="submit"]');
  submitBtn.disabled = true;
  submitBtn.textContent = 'Processing & Matching...';

  const formData = new FormData();
  formData.append('user_id', currentUser ? currentUser.user_id : 1);
  formData.append('category_id', parseInt(document.getElementById('lostCategory').value, 10));
  formData.append('location_id', parseInt(document.getElementById('lostLocation').value, 10));
  formData.append('item_name', document.getElementById('lostItemName').value);
  formData.append('color', document.getElementById('lostColor').value || '');
  formData.append('brand', document.getElementById('lostBrand').value || '');
  formData.append('lost_date', document.getElementById('lostDateTime').value.replace('T', ' ') + ':00');
  formData.append('description', document.getElementById('lostDescription').value || '');

  const fileInput = document.getElementById('lostImageInput');
  if (!fileInput || !fileInput.files[0]) {
    showToast('Item photograph is mandatory for campus recovery records. Please upload a photo.', 'error');
    submitBtn.disabled = false;
    submitBtn.textContent = 'Submit Report & Check Matches';
    return;
  }
  formData.append('image', fileInput.files[0]);

  try {
    const res = await fetch(`${API_BASE}/lost`, {
      method: 'POST',
      body: formData
    });
    const data = await res.json();

    if (data.success) {
      showToast(`Lost report filed! Found ${data.matches_found} prospective match(es).`, 'success');
      document.getElementById('lostForm')?.reset();
      const prev = document.getElementById('lostImagePreview');
      if (prev) prev.style.display = 'none';
      const plh = document.getElementById('lostUploadText');
      if (plh) plh.style.display = 'flex';

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
// REPORT FOUND ITEM (WITH MULTIPART PHOTO UPLOAD)
// ========================================================
async function handleFoundSubmit(e) {
  e.preventDefault();
  const submitBtn = e.target.querySelector('button[type="submit"]');
  submitBtn.disabled = true;
  submitBtn.textContent = 'Recording Found Item...';

  const formData = new FormData();
  formData.append('finder_id', currentUser ? currentUser.user_id : 1);
  formData.append('category_id', parseInt(document.getElementById('foundCategory').value, 10));
  formData.append('location_id', parseInt(document.getElementById('foundLocation').value, 10));
  formData.append('item_name', document.getElementById('foundItemName').value);
  formData.append('color', document.getElementById('foundColor').value || '');
  formData.append('brand', document.getElementById('foundBrand').value || '');
  formData.append('found_date', document.getElementById('foundDateTime').value.replace('T', ' ') + ':00');
  formData.append('custody_location', document.getElementById('foundCustody').value);
  formData.append('description', document.getElementById('foundStorageBin')?.value || '');

  const fileInput = document.getElementById('foundImageInput');
  if (!fileInput || !fileInput.files[0]) {
    showToast('Found item photograph is mandatory for custody verification. Please upload a photo.', 'error');
    submitBtn.disabled = false;
    submitBtn.textContent = 'Record Found Item & Check Matches';
    return;
  }
  formData.append('image', fileInput.files[0]);

  try {
    const res = await fetch(`${API_BASE}/found`, {
      method: 'POST',
      body: formData
    });
    const data = await res.json();

    if (data.success) {
      showToast('Found item recorded and matched against existing lost reports!', 'success');
      document.getElementById('foundForm')?.reset();
      const prev = document.getElementById('foundImagePreview');
      if (prev) prev.style.display = 'none';
      const plh = document.getElementById('foundUploadText');
      if (plh) plh.style.display = 'flex';

      await refreshAll();
      switchView('view-catalog');
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
// "MY ACTIVITY" DASHBOARD & 4-STEP STEPPER
// ========================================================
async function loadMyActivity() {
  if (!currentUser) return;
  const claimsList = document.getElementById('myClaimsList');
  const lostList = document.getElementById('myLostReportsList');

  if (claimsList) claimsList.innerHTML = '<div style="color: var(--color-text-muted); padding: 16px;">Loading your claims...</div>';
  if (lostList) lostList.innerHTML = '<div style="color: var(--color-text-muted); padding: 16px;">Loading your reports...</div>';

  try {
    const res = await fetch(`${API_BASE}/users/${currentUser.user_id}/activity`);
    const data = await res.json();

    if (!data.success) {
      showToast('Failed to load personal activity', 'error');
      return;
    }

    // 1. Render Claims with 4-Step Stepper
    if (claimsList) {
      if (data.claims.length === 0) {
        claimsList.innerHTML = `
          <div style="grid-column: 1 / -1; padding: 32px; text-align: center; background: var(--color-surface); border-radius: var(--radius-lg); box-shadow: var(--clay-card-shadow);">
            <h5>No Active Claims Filed</h5>
            <p style="font-size: 12px; color: var(--color-text-muted); margin-top: 4px;">When you claim an item from Browse or Matches, your verification progress will appear here.</p>
          </div>
        `;
      } else {
        claimsList.innerHTML = '';
        data.claims.forEach(c => {
          const isApproved = c.status === 'APPROVED';
          const isResolved = c.status === 'RESOLVED';
          const isRejected = c.status === 'REJECTED';

          // Stepper stage calculations
          // Step 1: Submitted (always completed)
          // Step 2: Under Review (active if pending/under_review, completed if approved/resolved)
          // Step 3: Ready for Pickup (active if approved, completed if resolved)
          // Step 4: Handed Over (completed if resolved)
          let step2Class = (c.status === 'PENDING' || c.status === 'UNDER_REVIEW') ? 'active' : (isApproved || isResolved ? 'completed' : '');
          let step3Class = isApproved ? 'active' : (isResolved ? 'completed' : '');
          let step4Class = isResolved ? 'completed' : '';

          let connectorFillWidth = '0%';
          if (c.status === 'PENDING' || c.status === 'UNDER_REVIEW') connectorFillWidth = '33%';
          if (isApproved) connectorFillWidth = '66%';
          if (isResolved) connectorFillWidth = '100%';

          const card = document.createElement('div');
          card.className = 'my-claim-card';
          card.innerHTML = `
            <div>
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                <span class="card-status-badge ${c.status.toLowerCase()}">CLAIM: ${c.status}</span>
                <span style="font-size: 11px; font-family: var(--font-mono); color: var(--color-text-muted);">Claim #${c.claim_id}</span>
              </div>

              <div style="display: flex; gap: 12px; align-items: center; margin-bottom: 12px;">
                ${c.found_image_url ? `
                  <img src="${c.found_image_url}" alt="${c.found_item_name}" style="width: 52px; height: 52px; object-fit: cover; border-radius: 8px; border: 1px solid var(--color-hairline); flex-shrink: 0; box-shadow: var(--clay-button-shadow);">
                ` : `
                  <div style="width: 52px; height: 52px; border-radius: 8px; background: var(--color-surface-soft); display: flex; align-items: center; justify-content: center; color: var(--color-text-muted); flex-shrink: 0; border: 1px solid var(--color-hairline);">
                    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
                  </div>
                `}
                <div>
                  <h4 style="font-size: 16px; font-weight: 800; color: var(--color-primary); margin-bottom: 2px;">${c.found_item_name}</h4>
                  <p style="font-size: 12px; color: var(--color-text-muted); margin: 0;">
                    ${c.category_name} · Held at: <strong>${c.custody_location}</strong>
                  </p>
                </div>
              </div>

              <!-- 4-Step Visual Stepper -->
              <div class="stepper-container">
                <div class="stepper-connector"><div class="stepper-connector-fill" style="width: ${connectorFillWidth};"></div></div>
                
                <div class="stepper-step completed">
                  <div class="stepper-bullet">1</div>
                  <span class="stepper-label">Submitted</span>
                </div>
                <div class="stepper-step ${step2Class}">
                  <div class="stepper-bullet">2</div>
                  <span class="stepper-label">Review</span>
                </div>
                <div class="stepper-step ${step3Class}">
                  <div class="stepper-bullet">3</div>
                  <span class="stepper-label">Approved</span>
                </div>
                <div class="stepper-step ${step4Class}">
                  <div class="stepper-bullet">4</div>
                  <span class="stepper-label">Retrieved</span>
                </div>
              </div>

              <!-- Pickup PIN Highlight Box -->
              ${isApproved ? `
                <div class="pickup-pin-voucher-box" style="margin-top: 14px;">
                  <div class="pickup-pin-label">Your Official 2FA Pickup Code</div>
                  <div class="pickup-pin-code">${c.pickup_pin || 'PIN-ACTIVE'}</div>
                  <div class="pickup-pin-notice">
                    Present this 6-digit code to the Security Officer at <strong>Admin Room 02</strong> to retrieve your property.
                  </div>
                  <div style="margin-top: 10px;">
                    <button class="btn-primary" style="padding: 6px 14px; font-size: 12px;" onclick="openReceiptModal(${c.claim_id}, '${escapeQuotes(currentUser.full_name)}', '${escapeQuotes(currentUser.enrollment_no || '')}', '${escapeQuotes(currentUser.phone)}', '${escapeQuotes(c.found_item_name)}', '${escapeQuotes(c.category_name)}', '${escapeQuotes(c.custody_location)}', '${escapeQuotes(c.proof_details)}', '${escapeQuotes(c.found_image_url || '')}')">
                      Print Official Pickup Slip
                    </button>
                  </div>
                </div>
              ` : ''}

              ${isRejected ? `
                <div style="background: #FEE2E2; border: 1px solid var(--color-danger); border-radius: var(--radius-sm); padding: 10px; font-size: 12px; color: #991B1B; margin-top: 10px;">
                  <strong>Review Decision:</strong> ${c.review_notes || 'Ownership proof could not be verified against records. Visit Admin Room 02 for in-person appeal.'}
                </div>
              ` : ''}

              <div style="font-size: 12px; background: var(--color-surface-soft); padding: 8px 12px; border-radius: var(--radius-sm); margin-top: 12px;">
                <strong style="color: var(--color-text-muted);">Your Submitted Proof:</strong> ${c.proof_details}
              </div>
            </div>
          `;
          claimsList.appendChild(card);
        });
      }
    }

    // 2. Render My Lost Reports
    if (lostList) {
      if (data.lost_reports.length === 0) {
        lostList.innerHTML = `
          <div style="grid-column: 1 / -1; padding: 32px; text-align: center; background: var(--color-surface); border-radius: var(--radius-lg); box-shadow: var(--clay-card-shadow);">
            <h5>No Lost Reports Filed</h5>
            <p style="font-size: 12px; color: var(--color-text-muted); margin-top: 4px;">If you lose an item on campus, report it to activate automated relational matching.</p>
          </div>
        `;
      } else {
        lostList.innerHTML = '';
        data.lost_reports.forEach(l => {
          const card = document.createElement('div');
          card.className = 'my-lost-card';
          card.innerHTML = `
            <div>
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                <span class="card-status-badge ${l.status.toLowerCase()}">${l.status}</span>
                <span style="font-size: 11px; color: var(--color-text-muted);">${new Date(l.lost_date).toLocaleDateString()}</span>
              </div>

              <div style="display: flex; gap: 12px; align-items: center; margin-bottom: 12px;">
                ${l.image_url ? `
                  <img src="${l.image_url}" alt="${l.item_name}" style="width: 50px; height: 50px; object-fit: cover; border-radius: 8px; border: 1px solid var(--color-hairline); flex-shrink: 0; box-shadow: var(--clay-button-shadow);">
                ` : ''}
                <div>
                  <h4 style="font-size: 16px; font-weight: 700; color: var(--color-text-main); margin-bottom: 2px;">${l.item_name}</h4>
                  <p style="font-size: 12px; color: var(--color-text-muted); margin: 0;">
                    ${l.category_name} · Lost at: ${l.building_name} (${l.room_floor})
                  </p>
                </div>
              </div>

              <div style="display: flex; justify-content: space-between; align-items: center; background: var(--color-surface-soft); padding: 8px 12px; border-radius: var(--radius-sm); font-size: 12px;">
                <span>Automated Matches: <strong>${l.total_matches}</strong></span>
                ${l.best_match_score ? `<span style="font-weight: 700; color: var(--color-primary);">Top Score: ${Math.round(l.best_match_score)}%</span>` : ''}
              </div>
            </div>

            <div style="display: flex; justify-content: flex-end; gap: 8px; border-top: 1px solid var(--color-hairline); padding-top: 10px;">
              ${l.status === 'OPEN' || l.status === 'MATCHED' ? `
                <button class="btn-secondary" style="font-size: 12px; padding: 5px 12px;" onclick="cancelMyLostReport(${l.lost_id})">Cancel Report</button>
                <button class="btn-primary" style="font-size: 12px; padding: 5px 12px;" onclick="switchView('view-matches')">View Matches</button>
              ` : `
                <span style="font-size: 11px; color: var(--color-text-muted);">Case Closed</span>
              `}
            </div>
          `;
          lostList.appendChild(card);
        });
      }
    }
  } catch (err) {
    console.error('Error loading my activity:', err);
  }
}

async function cancelMyLostReport(lostId) {
  if (!confirm('Are you sure you want to cancel this lost report? Any pending matches will be dismissed.')) return;
  try {
    const res = await fetch(`${API_BASE}/lost/${lostId}/cancel`, { method: 'PATCH' });
    const data = await res.json();
    if (data.success) {
      showToast('Report cancelled successfully.', 'info');
      await refreshAll();
      loadMyActivity();
    }
  } catch (err) {
    showToast(`Error: ${err.message}`, 'error');
  }
}

// ========================================================
// SECURITY QUEUE & TWO-FACTOR PIN HANDOVER
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
      const isApproved = c.claim_status === 'APPROVED';
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td><strong>#${c.claim_id}</strong></td>
        <td>${new Date(c.claim_date).toLocaleDateString()}</td>
        <td>
          <strong>${c.claimant_name}</strong><br>
          <span style="font-size: 11px; color: var(--color-text-muted); font-family: var(--font-mono);">${c.claimant_enrollment || 'Visitor'} · ${c.claimant_phone}</span>
        </td>
        <td>
          <div style="display: flex; align-items: center; gap: 10px;">
            ${c.found_image_url ? `
              <img src="${c.found_image_url}" alt="${c.found_item_name}" style="width: 44px; height: 44px; object-fit: cover; border-radius: 8px; border: 1px solid var(--color-hairline); flex-shrink: 0; box-shadow: var(--clay-button-shadow);">
            ` : `
              <div style="width: 44px; height: 44px; border-radius: 8px; background: var(--color-surface-soft); display: flex; align-items: center; justify-content: center; color: var(--color-text-muted); flex-shrink: 0; border: 1px solid var(--color-hairline);">
                <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
              </div>
            `}
            <div>
              <strong>${c.found_item_name}</strong><br>
              <span style="font-size: 11px; color: var(--color-text-muted);">${c.category_name} (${c.found_building})</span>
            </div>
          </div>
        </td>
        <td><span style="font-size: 12px;">${c.custody_location}</span></td>
        <td style="max-width: 200px; font-size: 12px;">${c.proof_details}</td>
        <td><span class="card-status-badge ${c.claim_status.toLowerCase()}">${c.claim_status}</span></td>
        <td>
          <div style="display: flex; gap: 6px; flex-wrap: wrap;">
            ${isPending ? `
              <button class="btn-success" onclick="openReviewModal(${c.claim_id}, 'APPROVED', '${escapeQuotes(c.claimant_name)}', '${escapeQuotes(c.found_item_name)}', '${escapeQuotes(c.proof_details)}', '${escapeQuotes(c.found_image_url || '')}')">Approve</button>
              <button class="btn-danger" onclick="openReviewModal(${c.claim_id}, 'REJECTED', '${escapeQuotes(c.claimant_name)}', '${escapeQuotes(c.found_item_name)}', '${escapeQuotes(c.proof_details)}', '${escapeQuotes(c.found_image_url || '')}')">Reject</button>
            ` : ''}
            ${isApproved ? `
              <button class="btn-gold" style="padding: 5px 10px; font-size: 11px; font-weight: 700; display: inline-flex; align-items: center; gap: 5px;" onclick="openPINVerifyModal(${c.claim_id}, '${escapeQuotes(c.claimant_name)}', '${escapeQuotes(c.found_item_name)}')">
                <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="7.5" cy="15.5" r="4.5"/><path d="M21 2l-9.6 9.6"/><path d="M15.5 7.5l3 3"/><path d="M18.5 4.5l2 2"/></svg>
                <span>Verify PIN</span>
              </button>
              <button class="btn-secondary" style="padding: 5px 8px; font-size: 11px;" onclick="openReceiptModal(${c.claim_id}, '${escapeQuotes(c.claimant_name)}', '${escapeQuotes(c.claimant_enrollment || 'Visitor')}', '${escapeQuotes(c.claimant_phone)}', '${escapeQuotes(c.found_item_name)}', '${escapeQuotes(c.category_name)}', '${escapeQuotes(c.custody_location)}', '${escapeQuotes(c.proof_details)}', '${escapeQuotes(c.found_image_url || '')}')">
                Voucher
              </button>
            ` : ''}
            <button class="btn-secondary" style="padding: 5px 8px; font-size: 11px;" onclick="viewAuditLog(${c.claim_id})">Audit</button>
          </div>
        </td>
      `;
      tbody.appendChild(tr);
    });
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="8" style="color: var(--color-danger);">Error: ${err.message}</td></tr>`;
  }
}

function openPINVerifyModal(claimId, claimantName, itemName) {
  document.getElementById('verifyClaimId').value = claimId;
  document.getElementById('verifyClaimantInfo').value = `${claimantName} — "${itemName}"`;
  document.getElementById('verifyPINInput').value = '';
  document.getElementById('pinVerifyModal').classList.add('open');
  setTimeout(() => document.getElementById('verifyPINInput').focus(), 100);
}

async function handlePINVerificationSubmit(e) {
  e.preventDefault();
  const claimId = document.getElementById('verifyClaimId').value;
  const pin = document.getElementById('verifyPINInput').value.trim();

  try {
    const res = await fetch(`${API_BASE}/claims/${claimId}/verify-pin`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ entered_pin: pin, officer_id: currentUser ? currentUser.user_id : 4 })
    });
    const data = await res.json();

    if (data.success) {
      closeModal('pinVerifyModal');
      showToast('PIN Verified! Custody Handover complete and confirmed.', 'success');
      await refreshAll();
      loadSecurityQueue();
    } else {
      showToast(`Verification Failed: ${data.message}`, 'error');
    }
  } catch (err) {
    showToast(`Network error: ${err.message}`, 'error');
  }
}

// ========================================================
// Safe string escaping for inline attributes
function escapeQuotes(str) {
  if (!str) return '';
  return String(str)
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'")
    .replace(/"/g, '&quot;')
    .replace(/\n/g, ' ');
}

// ========================================================
// 90-DAY UNCLAIMED DEPOSITORY & SELECTIVE DISPOSAL
// ========================================================
let currentUnclaimedDaysThreshold = 90;
let currentUnclaimedItems = [];
let selectedUnclaimedIds = new Set();

function setUnclaimedThreshold(days) {
  currentUnclaimedDaysThreshold = days;
  [90, 60, 30, 0].forEach(d => {
    const pill = document.getElementById(`unclaimedPill${d}`);
    if (pill) {
      if (d === days) pill.classList.add('active');
      else pill.classList.remove('active');
    }
  });
  loadUnclaimedDepository(days);
}

async function loadUnclaimedDepository(days = currentUnclaimedDaysThreshold) {
  currentUnclaimedDaysThreshold = days;
  const tbody = document.getElementById('unclaimedTableBody');
  const countBadge = document.getElementById('unclaimedEligibleCount');
  const periodBadge = document.getElementById('unclaimedPeriodLabel');
  if (!tbody) return;

  selectedUnclaimedIds.clear();
  updateUnclaimedBatchBar();
  const masterCheck = document.getElementById('unclaimedSelectAll');
  if (masterCheck) masterCheck.checked = false;

  if (periodBadge) periodBadge.textContent = days === 0 ? 'All Active (0+ Days)' : `${days} Days`;
  tbody.innerHTML = '<tr><td colspan="9" style="text-align: center; padding: 24px;">Loading overdue depository inventory...</td></tr>';

  try {
    const res = await fetch(`${API_BASE}/admin/unclaimed?days=${days}`);
    const data = await res.json();

    if (data.success) {
      currentUnclaimedItems = data.data || [];
      const eligibleCount = currentUnclaimedItems.filter(i => i.days_in_custody >= 90).length;
      if (countBadge) countBadge.textContent = eligibleCount;

      if (currentUnclaimedItems.length === 0) {
        tbody.innerHTML = `<tr><td colspan="9" style="text-align: center; padding: 36px; color: var(--color-text-muted);">No found property currently exceeds the ${days}-day holding threshold.</td></tr>`;
        return;
      }

      tbody.innerHTML = '';
      currentUnclaimedItems.forEach(item => {
        const isOverdue = item.days_in_custody >= 90;
        const tr = document.createElement('tr');
        tr.id = `depository-row-${item.found_id}`;
        tr.innerHTML = `
          <td style="text-align: center;">
            <input type="checkbox" class="unclaimed-item-check" data-id="${item.found_id}" onchange="handleUnclaimedCheckChange(${item.found_id}, this.checked)">
          </td>
          <td><strong>#F-${item.found_id}</strong></td>
          <td>
            <div style="display: flex; align-items: center; gap: 10px;">
              ${item.image_url ? `
                <img src="${item.image_url}" alt="${item.item_name}" style="width: 44px; height: 44px; object-fit: cover; border-radius: 8px; border: 1px solid var(--color-hairline); flex-shrink: 0; box-shadow: var(--clay-button-shadow);">
              ` : `
                <div style="width: 44px; height: 44px; border-radius: 8px; background: var(--color-surface-soft); display: flex; align-items: center; justify-content: center; color: var(--color-text-muted); flex-shrink: 0; border: 1px solid var(--color-hairline);">
                  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
                </div>
              `}
              <div>
                <strong>${item.item_name}</strong><br>
                <span style="font-size: 11px; color: var(--color-text-muted);">${item.brand || 'Campus Property'}</span>
              </div>
            </div>
          </td>
          <td>${item.category_name}</td>
          <td>${new Date(item.found_date).toLocaleDateString()}</td>
          <td>
            ${isOverdue ? `
              <span style="font-weight: 800; color: var(--color-danger);">${item.days_in_custody} days (Overdue)</span>
            ` : `
              <span style="font-weight: 600; color: var(--color-text-main);">${item.days_in_custody} days <small style="color:var(--color-text-muted);">(${90 - item.days_in_custody}d left)</small></span>
            `}
          </td>
          <td><span style="font-size: 12px;">${item.custody_location}</span></td>
          <td>
            ${isOverdue ? `
              <span class="card-status-badge expired" style="background: #FEE2E2; color: #991B1B; border: 1px solid #FCA5A5; font-weight: 700;">OVERDUE</span>
            ` : `
              <span class="card-status-badge available" style="background: #DCFCE7; color: #166534; border: 1px solid #86EFAC; font-weight: 700;">IN HOLDING</span>
            `}
          </td>
          <td style="text-align: right;">
            <div style="display: flex; gap: 6px; justify-content: flex-end;">
              <button class="btn-success" style="padding: 4px 9px; font-size: 11px; font-weight: 700; display: inline-flex; align-items: center; gap: 4px;" onclick="openSingleDisposalModal(${item.found_id}, 'WELFARE')" title="Donate this specific item to UBIT Student Welfare">
                <span>💖 Donate</span>
              </button>
              <button class="btn-danger" style="padding: 4px 9px; font-size: 11px; font-weight: 700; display: inline-flex; align-items: center; gap: 4px;" onclick="openSingleDisposalModal(${item.found_id}, 'E_WASTE')" title="Send this specific item to E-Waste Recycling">
                <span>♻️ Dispose</span>
              </button>
            </div>
          </td>
        `;
        tbody.appendChild(tr);
      });
    }
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="9" style="color: var(--color-danger);">Error: ${err.message}</td></tr>`;
  }
}

// Checkbox selection management
function handleUnclaimedCheckChange(foundId, isChecked) {
  if (isChecked) {
    selectedUnclaimedIds.add(foundId);
  } else {
    selectedUnclaimedIds.delete(foundId);
  }
  updateUnclaimedBatchBar();
}

function toggleSelectAllUnclaimed(masterCheck) {
  const isChecked = masterCheck.checked;
  const checks = document.querySelectorAll('.unclaimed-item-check');
  selectedUnclaimedIds.clear();
  checks.forEach(chk => {
    chk.checked = isChecked;
    if (isChecked) {
      selectedUnclaimedIds.add(parseInt(chk.dataset.id, 10));
    }
  });
  updateUnclaimedBatchBar();
}

function clearUnclaimedCheckboxes() {
  selectedUnclaimedIds.clear();
  const checks = document.querySelectorAll('.unclaimed-item-check');
  checks.forEach(chk => (chk.checked = false));
  const masterCheck = document.getElementById('unclaimedSelectAll');
  if (masterCheck) masterCheck.checked = false;
  updateUnclaimedBatchBar();
}

function updateUnclaimedBatchBar() {
  const bar = document.getElementById('unclaimedBatchBar');
  const countSpan = document.getElementById('unclaimedBatchCount');
  if (!bar) return;
  const count = selectedUnclaimedIds.size;
  if (count > 0) {
    bar.style.display = 'flex';
    if (countSpan) countSpan.textContent = count;
  } else {
    bar.style.display = 'none';
  }
}

// Modal opening functions: Single Item vs Batch Selection vs Statutory Bulk
function openSingleDisposalModal(foundId, actionType) {
  const item = currentUnclaimedItems.find(i => i.found_id === foundId);
  if (!item) {
    showToast('Item details could not be found.', 'error');
    return;
  }

  const modal = document.getElementById('disposalModal');
  const title = document.getElementById('disposalModalTitle');
  const recipient = document.getElementById('disposalRecipient');
  const actionHidden = document.getElementById('disposalActionType');
  const modeHidden = document.getElementById('disposalMode');
  const singleIdHidden = document.getElementById('disposalSingleFoundId');
  const daysGroup = document.getElementById('disposalDaysGroup');
  const preview = document.getElementById('disposalItemPreview');
  const notes = document.getElementById('disposalNotes');

  modeHidden.value = 'single';
  singleIdHidden.value = foundId;
  daysGroup.style.display = 'none';

  if (actionType === 'WELFARE') {
    title.textContent = `Donate Item #F-${foundId} to UBIT Student Welfare`;
    recipient.value = 'UBIT Student Welfare Society (Student Book Bank & Tech Aid)';
    actionHidden.value = 'DONATED_TO_WELFARE';
    notes.value = `Approved for semester distribution by UBIT Student Welfare Committee. Item held ${item.days_in_custody} days.`;
  } else {
    title.textContent = `Authorize E-Waste Disposal for Item #F-${foundId}`;
    recipient.value = 'Department Technical Recycling & Electronic Waste Protocol';
    actionHidden.value = 'E_WASTE';
    notes.value = `Authorized for compliant green recycling. Item held ${item.days_in_custody} days without active claim.`;
  }

  // Populate preview card
  preview.style.display = 'block';
  preview.innerHTML = `
    <div style="display: flex; gap: 12px; align-items: center;">
      ${item.image_url ? `
        <img src="${item.image_url}" alt="${item.item_name}" style="width: 54px; height: 54px; object-fit: cover; border-radius: 8px; border: 1px solid var(--color-hairline); flex-shrink: 0;">
      ` : ''}
      <div>
        <h4 style="margin: 0 0 2px 0; font-size: 14px; font-weight: 700; color: var(--color-text-main);">${item.item_name}</h4>
        <div style="font-size: 11.5px; color: var(--color-text-muted);">
          Category: <strong>${item.category_name}</strong> · Held: <strong style="color: var(--color-primary);">${item.days_in_custody} days</strong>
        </div>
        <div style="font-size: 11px; color: var(--color-text-muted); margin-top: 2px;">
          Custody: ${item.custody_location}
        </div>
      </div>
    </div>
  `;

  modal.classList.add('open');
}

function openBatchDisposalModal(actionType) {
  if (selectedUnclaimedIds.size === 0) {
    showToast('Please check at least one item using the table checkboxes.', 'error');
    return;
  }

  const selectedItems = currentUnclaimedItems.filter(i => selectedUnclaimedIds.has(i.found_id));
  const modal = document.getElementById('disposalModal');
  const title = document.getElementById('disposalModalTitle');
  const recipient = document.getElementById('disposalRecipient');
  const actionHidden = document.getElementById('disposalActionType');
  const modeHidden = document.getElementById('disposalMode');
  const singleIdHidden = document.getElementById('disposalSingleFoundId');
  const daysGroup = document.getElementById('disposalDaysGroup');
  const preview = document.getElementById('disposalItemPreview');
  const notes = document.getElementById('disposalNotes');

  modeHidden.value = 'batch';
  singleIdHidden.value = '';
  daysGroup.style.display = 'none';

  if (actionType === 'WELFARE') {
    title.textContent = `Donate ${selectedItems.length} Selected Item(s) to UBIT Welfare`;
    recipient.value = 'UBIT Student Welfare Society (Student Book Bank & Tech Aid)';
    actionHidden.value = 'DONATED_TO_WELFARE';
    notes.value = `Bulk batch transfer of ${selectedItems.length} verified unclaimed items to Student Welfare.`;
  } else {
    title.textContent = `Authorize E-Waste Disposal for ${selectedItems.length} Selected Item(s)`;
    recipient.value = 'Department Technical Recycling & Electronic Waste Protocol';
    actionHidden.value = 'E_WASTE';
    notes.value = `Batch institutional scrap authorization for ${selectedItems.length} electronic / unusable items.`;
  }

  // Populate preview card with chips
  preview.style.display = 'block';
  preview.innerHTML = `
    <div style="font-size: 12.5px; font-weight: 700; margin-bottom: 6px; color: var(--color-text-main);">
      Selected Inventory Items (${selectedItems.length}):
    </div>
    <div style="display: flex; gap: 6px; flex-wrap: wrap;">
      ${selectedItems.map(i => `
        <span style="font-size: 11px; background: var(--color-surface); border: 1px solid var(--color-hairline); border-radius: var(--radius-sm); padding: 3px 8px; font-weight: 600;">
          #F-${i.found_id} ${i.item_name} (${i.days_in_custody}d)
        </span>
      `).join('')}
    </div>
  `;

  modal.classList.add('open');
}

function openDisposalModal(actionType) {
  // Statutory bulk threshold mode
  const modal = document.getElementById('disposalModal');
  const title = document.getElementById('disposalModalTitle');
  const recipient = document.getElementById('disposalRecipient');
  const actionHidden = document.getElementById('disposalActionType');
  const modeHidden = document.getElementById('disposalMode');
  const singleIdHidden = document.getElementById('disposalSingleFoundId');
  const daysGroup = document.getElementById('disposalDaysGroup');
  const preview = document.getElementById('disposalItemPreview');
  const notes = document.getElementById('disposalNotes');

  modeHidden.value = 'statutory';
  singleIdHidden.value = '';
  daysGroup.style.display = 'block';
  preview.style.display = 'none';

  if (actionType === 'WELFARE') {
    title.textContent = 'Bulk Statutory Donation to UBIT Student Welfare';
    recipient.value = 'UBIT Student Welfare Society (Student Book Bank & Tech Aid)';
    actionHidden.value = 'DONATED_TO_WELFARE';
    notes.value = 'Approved under Department of Computer Science student welfare protocol.';
  } else {
    title.textContent = 'Bulk Statutory E-Waste & Scrap Disposal';
    recipient.value = 'Department Technical Recycling & Electronic Waste Protocol';
    actionHidden.value = 'E_WASTE';
    notes.value = 'Compliant electronic waste disposal authorized for items exceeding statutory retention.';
  }

  modal.classList.add('open');
}

async function handleDisposalSubmit(e) {
  e.preventDefault();
  const mode = document.getElementById('disposalMode').value;
  const action_type = document.getElementById('disposalActionType').value;
  const notes = document.getElementById('disposalNotes').value.trim();
  const officer_id = currentUser ? currentUser.user_id : 4;
  const submitBtn = document.getElementById('disposalSubmitBtn');

  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.textContent = 'Processing in Database...';
  }

  try {
    let res, data;

    if (mode === 'single') {
      const found_id = parseInt(document.getElementById('disposalSingleFoundId').value, 10);
      res = await fetch(`${API_BASE}/admin/unclaimed/dispose-single`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ found_id, action_type, notes, officer_id })
      });
      data = await res.json();
    } else if (mode === 'batch') {
      const found_ids = Array.from(selectedUnclaimedIds);
      res = await fetch(`${API_BASE}/admin/unclaimed/dispose-batch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ found_ids, action_type, notes, officer_id })
      });
      data = await res.json();
    } else {
      // Statutory bulk threshold mode
      const days_threshold = parseInt(document.getElementById('disposalDays').value, 10);
      res = await fetch(`${API_BASE}/admin/unclaimed/process`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ days_threshold, action_type, officer_id })
      });
      data = await res.json();
    }

    if (data.success) {
      closeModal('disposalModal');
      showToast(`Disposal complete: ${data.message}`, 'success');
      clearUnclaimedCheckboxes();
      await refreshAll();
      loadUnclaimedDepository();
      // Also update history view in background
      loadHistoryView();
    } else {
      showToast(`Error: ${data.message}`, 'error');
    }
  } catch (err) {
    showToast(`Network error: ${err.message}`, 'error');
  } finally {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Execute Database Disposal';
    }
  }
}

// ========================================================
// CUSTODY HANDOVER & DISPOSAL HISTORY ARCHIVE
// ========================================================
let currentHistorySubTab = 'handovers';
let cachedHistoryHandovers = [];
let cachedHistoryDisposals = [];

function switchHistorySubTab(tab) {
  currentHistorySubTab = tab;
  const pillHandovers = document.getElementById('historySubTabHandovers');
  const pillDisposals = document.getElementById('historySubTabDisposals');
  const containerHandovers = document.getElementById('historyHandoverContainer');
  const containerDisposals = document.getElementById('historyDisposalContainer');

  if (tab === 'handovers') {
    if (pillHandovers) pillHandovers.classList.add('active');
    if (pillDisposals) pillDisposals.classList.remove('active');
    if (containerHandovers) containerHandovers.style.display = 'block';
    if (containerDisposals) containerDisposals.style.display = 'none';
  } else {
    if (pillHandovers) pillHandovers.classList.remove('active');
    if (pillDisposals) pillDisposals.classList.add('active');
    if (containerHandovers) containerHandovers.style.display = 'none';
    if (containerDisposals) containerDisposals.style.display = 'block';
  }
  filterHistoryTable();
}

async function loadHistoryView() {
  const tbodyHandovers = document.getElementById('historyHandoverTableBody');
  const tbodyDisposals = document.getElementById('historyDisposalTableBody');
  const countHandover = document.getElementById('historyHandoverCount');
  const countDonated = document.getElementById('historyDonatedCount');
  const countDisposed = document.getElementById('historyDisposedCount');

  if (tbodyHandovers) tbodyHandovers.innerHTML = '<tr><td colspan="8" style="text-align: center; padding: 24px;">Loading verified handover records...</td></tr>';
  if (tbodyDisposals) tbodyDisposals.innerHTML = '<tr><td colspan="8" style="text-align: center; padding: 24px;">Loading depository disposal manifests...</td></tr>';

  try {
    const [resHandovers, resDisposals] = await Promise.all([
      fetch(`${API_BASE}/admin/history/handovers`),
      fetch(`${API_BASE}/admin/history/disposals`)
    ]);

    const dataHandovers = await resHandovers.json();
    const dataDisposals = await resDisposals.json();

    cachedHistoryHandovers = dataHandovers.data || [];
    cachedHistoryDisposals = dataDisposals.data || [];

    // Update Stats
    if (countHandover) countHandover.textContent = cachedHistoryHandovers.length;
    const donatedCount = cachedHistoryDisposals.filter(d => d.disposal_type === 'DONATED_TO_WELFARE').length;
    const scrappedCount = cachedHistoryDisposals.filter(d => d.disposal_type !== 'DONATED_TO_WELFARE').length;
    if (countDonated) countDonated.textContent = donatedCount;
    if (countDisposed) countDisposed.textContent = scrappedCount;

    renderHistoryHandovers(cachedHistoryHandovers);
    renderHistoryDisposals(cachedHistoryDisposals);
  } catch (err) {
    if (tbodyHandovers) tbodyHandovers.innerHTML = `<tr><td colspan="8" style="color: var(--color-danger);">Error loading handovers: ${err.message}</td></tr>`;
    if (tbodyDisposals) tbodyDisposals.innerHTML = `<tr><td colspan="8" style="color: var(--color-danger);">Error loading disposals: ${err.message}</td></tr>`;
  }
}

function renderHistoryHandovers(list) {
  const tbody = document.getElementById('historyHandoverTableBody');
  if (!tbody) return;

  if (list.length === 0) {
    tbody.innerHTML = '<tr><td colspan="8" style="text-align: center; padding: 32px; color: var(--color-text-muted);">No custody handover records logged yet.</td></tr>';
    return;
  }

  tbody.innerHTML = '';
  list.forEach(h => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><strong>#CLM-${h.claim_id}</strong></td>
      <td>
        <span style="font-weight: 600;">${new Date(h.handover_date || h.claim_date).toLocaleDateString()}</span><br>
        <span style="font-size: 11px; color: var(--color-text-muted);">${new Date(h.handover_date || h.claim_date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
      </td>
      <td>
        <strong>${h.claimant_name}</strong><br>
        <span style="font-size: 11px; font-family: var(--font-mono); color: var(--color-text-muted);">${h.claimant_enrollment || 'Visitor'} · ${h.claimant_phone}</span>
      </td>
      <td>
        <div style="display: flex; align-items: center; gap: 10px;">
          ${h.found_image_url ? `
            <img src="${h.found_image_url}" alt="${h.found_item_name}" style="width: 44px; height: 44px; object-fit: cover; border-radius: 8px; border: 1px solid var(--color-hairline); flex-shrink: 0; box-shadow: var(--clay-button-shadow);">
          ` : `
            <div style="width: 44px; height: 44px; border-radius: 8px; background: var(--color-surface-soft); display: flex; align-items: center; justify-content: center; color: var(--color-text-muted); flex-shrink: 0; border: 1px solid var(--color-hairline);">
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
            </div>
          `}
          <div>
            <strong>${h.found_item_name}</strong><br>
            <span style="font-size: 11px; color: var(--color-text-muted);">${h.category_name}</span>
          </div>
        </div>
      </td>
      <td><span style="font-size: 12px;">${h.custody_location}</span></td>
      <td>
        <span style="display: inline-flex; align-items: center; gap: 4px; background: rgba(16, 185, 129, 0.12); color: #065F46; padding: 3px 8px; border-radius: 6px; font-family: var(--font-mono); font-weight: 800; font-size: 12px; border: 1px solid rgba(16, 185, 129, 0.3);">
          <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
          ${h.pickup_pin || 'VERIFIED'}
        </span>
      </td>
      <td><span style="font-size: 12px; font-weight: 600;">${h.officer_name}</span></td>
      <td style="text-align: right;">
        <button class="btn-secondary" style="padding: 4px 10px; font-size: 11px; font-weight: 700; display: inline-flex; align-items: center; gap: 5px;" onclick="openReceiptModal(${h.claim_id}, '${escapeQuotes(h.claimant_name)}', '${escapeQuotes(h.claimant_enrollment || 'Visitor')}', '${escapeQuotes(h.claimant_phone)}', '${escapeQuotes(h.found_item_name)}', '${escapeQuotes(h.category_name)}', '${escapeQuotes(h.custody_location)}', '${escapeQuotes(h.proof_details || '')}', '${escapeQuotes(h.found_image_url || '')}')">
          <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
          <span>Handover Slip</span>
        </button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

function renderHistoryDisposals(list) {
  const tbody = document.getElementById('historyDisposalTableBody');
  if (!tbody) return;

  if (list.length === 0) {
    tbody.innerHTML = '<tr><td colspan="8" style="text-align: center; padding: 32px; color: var(--color-text-muted);">No property disposals or welfare transfers logged yet.</td></tr>';
    return;
  }

  tbody.innerHTML = '';
  list.forEach(d => {
    const isWelfare = d.disposal_type === 'DONATED_TO_WELFARE';
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><strong>#F-${d.found_id}</strong></td>
      <td>
        <span style="font-weight: 600;">${new Date(d.disposed_at || d.found_date).toLocaleDateString()}</span><br>
        <span style="font-size: 11px; color: var(--color-text-muted);">${new Date(d.disposed_at || d.found_date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
      </td>
      <td>
        <div style="display: flex; align-items: center; gap: 10px;">
          ${d.image_url ? `
            <img src="${d.image_url}" alt="${d.item_name}" style="width: 44px; height: 44px; object-fit: cover; border-radius: 8px; border: 1px solid var(--color-hairline); flex-shrink: 0; box-shadow: var(--clay-button-shadow);">
          ` : `
            <div style="width: 44px; height: 44px; border-radius: 8px; background: var(--color-surface-soft); display: flex; align-items: center; justify-content: center; color: var(--color-text-muted); flex-shrink: 0; border: 1px solid var(--color-hairline);">
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
            </div>
          `}
          <div>
            <strong>${d.item_name}</strong><br>
            <span style="font-size: 11px; color: var(--color-text-muted);">${d.category_name}</span>
          </div>
        </div>
      </td>
      <td>
        <span style="font-weight: 700; color: var(--color-text-main);">${d.days_in_custody} days</span>
      </td>
      <td>
        ${isWelfare ? `
          <span class="card-status-badge donated" style="font-weight: 800; display: inline-flex; align-items: center; gap: 4px;">
            <span>💖 UBIT WELFARE</span>
          </span>
        ` : `
          <span class="card-status-badge e-waste" style="font-weight: 800; display: inline-flex; align-items: center; gap: 4px;">
            <span>♻️ E-WASTE SCRAP</span>
          </span>
        `}
      </td>
      <td><span style="font-size: 12px; font-weight: 600;">${d.officer_name || 'Campus Security'}</span></td>
      <td style="max-width: 220px; font-size: 11.5px; color: var(--color-text-muted);">
        ${d.disposal_notes || 'Processed under institutional chain-of-custody protocol.'}
      </td>
      <td style="text-align: right;">
        <button class="btn-secondary" style="padding: 4px 10px; font-size: 11px; font-weight: 700; display: inline-flex; align-items: center; gap: 5px;" onclick="openDisposalCertModal(${d.found_id})">
          <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
          <span>Certificate</span>
        </button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

function filterHistoryTable() {
  const query = (document.getElementById('historySearchInput').value || '').toLowerCase().trim();

  if (currentHistorySubTab === 'handovers') {
    const filtered = cachedHistoryHandovers.filter(h => {
      const text = `${h.claim_id} ${h.claimant_name} ${h.claimant_enrollment} ${h.found_item_name} ${h.category_name} ${h.pickup_pin} ${h.officer_name}`.toLowerCase();
      return text.includes(query);
    });
    renderHistoryHandovers(filtered);
  } else {
    const filtered = cachedHistoryDisposals.filter(d => {
      const text = `${d.found_id} ${d.item_name} ${d.category_name} ${d.disposal_type} ${d.officer_name} ${d.disposal_notes}`.toLowerCase();
      return text.includes(query);
    });
    renderHistoryDisposals(filtered);
  }
}

// Official Custody Disposal Manifest Certificate Modal
function openDisposalCertModal(foundId) {
  const item = cachedHistoryDisposals.find(d => d.found_id === foundId);
  if (!item) {
    showToast('Manifest details not found.', 'error');
    return;
  }

  const isWelfare = item.disposal_type === 'DONATED_TO_WELFARE';
  document.getElementById('certSerialNumber').textContent = `CERT-UBIT-DISP-${String(item.found_id).padStart(4, '0')}`;
  
  const imgEl = document.getElementById('certItemImg');
  if (item.image_url) {
    imgEl.src = item.image_url;
    imgEl.style.display = 'block';
  } else {
    imgEl.src = 'ubit-logo.jpg';
  }

  document.getElementById('certItemName').textContent = item.item_name;
  const badge = document.getElementById('certDispositionBadge');
  if (isWelfare) {
    badge.textContent = '💖 DONATED TO UBIT WELFARE';
    badge.className = 'card-status-badge donated';
  } else {
    badge.textContent = '♻️ E-WASTE RECYCLED';
    badge.className = 'card-status-badge e-waste';
  }

  document.getElementById('certItemDesc').textContent = item.description || 'Institutional property held in university custody.';
  document.getElementById('certCategory').textContent = item.category_name;
  document.getElementById('certDaysHeld').textContent = `${item.days_in_custody} Days`;
  document.getElementById('certRecipient').textContent = isWelfare 
    ? 'UBIT Student Welfare Society (Student Aid & Book Bank)' 
    : 'Department Electronic Waste & Recycling Protocol';
  document.getElementById('certDisposalDate').textContent = new Date(item.disposed_at || item.found_date).toLocaleString();
  document.getElementById('certOfficer').textContent = item.officer_name || 'Campus Administration Officer';
  document.getElementById('certFoundMeta').textContent = `Found ${new Date(item.found_date).toLocaleDateString()} at ${item.building_name || 'UBIT'} (${item.room_floor || 'Campus'})`;
  document.getElementById('certNotes').textContent = item.disposal_notes || 'Approved under departmental chain-of-custody protocol.';

  document.getElementById('disposalCertModal').classList.add('open');
}

function printDisposalCert() {
  window.print();
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
function openClaimModal(foundId, lostId, itemName, imageUrl) {
  document.getElementById('claimFoundId').value = foundId;
  document.getElementById('claimLostId').value = lostId || '';
  document.getElementById('claimItemName').value = itemName;
  document.getElementById('claimProof').value = '';

  const imgContainer = document.getElementById('claimImageContainer');
  const imgEl = document.getElementById('claimItemImage');
  if (imgContainer && imgEl) {
    if (imageUrl) {
      imgEl.src = imageUrl;
      imgContainer.style.display = 'block';
    } else {
      imgContainer.style.display = 'none';
    }
  }

  document.getElementById('claimModal').classList.add('open');
}

async function handleClaimSubmit(e) {
  e.preventDefault();
  const foundId = parseInt(document.getElementById('claimFoundId').value, 10);
  const lostIdVal = document.getElementById('claimLostId').value;
  const lostId = lostIdVal ? parseInt(lostIdVal, 10) : null;
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
      switchView('view-my-activity');
    } else {
      showToast(`Claim Conflict / Error: ${data.message}`, 'error');
    }
  } catch (err) {
    showToast(`Network error: ${err.message}`, 'error');
  }
}

function openReviewModal(claimId, decision, claimantName, itemName, proof, imageUrl) {
  document.getElementById('reviewClaimId').value = claimId;
  document.getElementById('reviewDecision').value = decision;
  document.getElementById('reviewModalTitle').textContent = `${decision === 'APPROVED' ? 'Approve' : 'Reject'} Claim #${claimId}`;
  document.getElementById('reviewSummary').value = `${claimantName} claiming "${itemName}"`;
  document.getElementById('reviewProofDetails').value = proof;
  document.getElementById('reviewNotes').value = '';

  const imgContainer = document.getElementById('reviewImageContainer');
  const imgEl = document.getElementById('reviewItemImage');
  if (imgContainer && imgEl) {
    if (imageUrl) {
      imgEl.src = imageUrl;
      imgContainer.style.display = 'block';
    } else {
      imgContainer.style.display = 'none';
    }
  }

  const btnAction = document.getElementById('btnReviewAction');
  btnAction.textContent = decision === 'APPROVED' ? 'Confirm Approval (Generate 2FA PIN)' : 'Confirm Rejection';
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

      if (a.result_code === 'SUCCESS') {
        threadACard.className = 'thread-card winner';
        threadABadge.textContent = '200 OK — Lock Acquired & Committed';
        threadAMsg.textContent = `Claim #${a.claim_id} created under pessimistic row lock. Status moved to UNDER_CLAIM.`;
      } else {
        threadACard.className = 'thread-card blocked';
        threadABadge.textContent = '409 Conflict — Blocked & Aborted';
        threadAMsg.textContent = a.message;
      }

      if (b.result_code === 'SUCCESS') {
        threadBCard.className = 'thread-card winner';
        threadBBadge.textContent = '200 OK — Lock Acquired & Committed';
        threadBMsg.textContent = `Claim #${b.claim_id} created under pessimistic row lock. Status moved to UNDER_CLAIM.`;
      } else {
        threadBCard.className = 'thread-card blocked';
        threadBBadge.textContent = '409 Conflict — Blocked & Aborted';
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
    btn.innerHTML = `
      <svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
      <span>Re-Run Concurrent Race</span>
    `;
  }
}

function openScoreExplainer(itemName, score, category) {
  document.getElementById('explainerItemName').textContent = itemName;
  document.getElementById('explainerTotalScore').textContent = `${score}% Match`;
  document.getElementById('scoreExplainerModal').classList.add('open');
}

function openReceiptModal(claimId, claimantName, claimantEnrollment, claimantPhone, itemName, categoryName, custodyLocation, proofDetails, itemImageUrl) {
  document.getElementById('rcptVoucherId').textContent = `UBIT-REC-${String(claimId).padStart(4, '0')}`;
  document.getElementById('rcptDateTime').textContent = new Date().toLocaleString();
  document.getElementById('rcptClaimantName').textContent = claimantName || 'N/A';
  document.getElementById('rcptEnrollment').textContent = claimantEnrollment || 'N/A';
  document.getElementById('rcptPhone').textContent = claimantPhone || 'N/A';
  document.getElementById('rcptItemName').textContent = itemName || 'N/A';
  document.getElementById('rcptCategoryCustody').textContent = `${categoryName || 'General'} · Custody at: ${custodyLocation || 'Campus Security Desk'}`;
  document.getElementById('rcptProof').textContent = proofDetails || 'Verification documents inspected and confirmed.';

  const imgEl = document.getElementById('rcptItemImage');
  if (imgEl) {
    if (itemImageUrl) {
      imgEl.src = itemImageUrl;
      imgEl.style.display = 'block';
    } else {
      imgEl.style.display = 'none';
    }
  }

  document.getElementById('receiptModal').classList.add('open');
}

function closeModal(modalId) {
  const el = document.getElementById(modalId);
  if (el) el.classList.remove('open');
}

// Helpers
function escapeQuotes(str) {
  if (!str) return '';
  return String(str).replace(/'/g, "\\'").replace(/"/g, '&quot;');
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
