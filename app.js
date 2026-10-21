// --- Helper Functions ---
function formatIndiaPhone(phone) {
    if (!phone) return '';
    const digits = String(phone).replace(/\D/g, '');
    if (digits.length === 10) {
        return '91' + digits;
    } else if (digits.length > 10) {
        return '91' + digits.slice(-10);
    }
    return digits;
}

function formatDisplayPhone(phone) {
    const formatted = formatIndiaPhone(phone);
    if (formatted.length === 12 && formatted.startsWith('91')) {
        return `+91 ${formatted.slice(2, 7)} ${formatted.slice(7)}`;
    }
    return '+' + formatted;
}

function getInitial(name) {
    if (!name) return '?';
    return name.trim().charAt(0).toUpperCase();
}

function formatTime(dateStr) {
    if (!dateStr) return '';
    try {
        const d = new Date(dateStr);
        if (isNaN(d.getTime())) return '';
        return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch (e) {
        return '';
    }
}

// --- Thumbnail & Media Preview Helpers ---
function generateImageThumbnail(file, maxWidth = 380) {
    return new Promise((resolve) => {
        if (!file || !file.type || !file.type.startsWith('image')) return resolve(null);
        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const scale = maxWidth / Math.max(img.width, maxWidth);
                canvas.width = Math.round(img.width * scale);
                canvas.height = Math.round(img.height * scale);
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                resolve(canvas.toDataURL('image/jpeg', 0.75));
            };
            img.onerror = () => resolve(e.target.result);
            img.src = e.target.result;
        };
        reader.onerror = () => resolve(null);
        reader.readAsDataURL(file);
    });
}

function generateVideoThumbnail(file, maxWidth = 380) {
    return new Promise((resolve) => {
        try {
            const url = URL.createObjectURL(file);
            const video = document.createElement('video');
            video.src = url;
            video.currentTime = 0.5;
            video.muted = true;
            video.playsInline = true;
            video.onloadeddata = () => {
                const canvas = document.createElement('canvas');
                const scale = maxWidth / Math.max(video.videoWidth || 380, maxWidth);
                canvas.width = Math.round((video.videoWidth || 380) * scale);
                canvas.height = Math.round((video.videoHeight || 240) * scale);
                const ctx = canvas.getContext('2d');
                ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                URL.revokeObjectURL(url);
                resolve(canvas.toDataURL('image/jpeg', 0.75));
            };
            video.onerror = () => {
                URL.revokeObjectURL(url);
                resolve(null);
            };
        } catch(e) {
            resolve(null);
        }
    });
}

window.openMediaPreview = function openMediaPreview(url, isVideo, title) {
    const modal = document.getElementById('media-preview-modal');
    const titleEl = document.getElementById('media-preview-title');
    const bodyEl = document.getElementById('media-preview-body');
    if (!modal || !bodyEl) return;

    if (titleEl) titleEl.textContent = title || 'Media Preview';

    if (url) {
        if (isVideo) {
            bodyEl.innerHTML = `<video src="${url}" controls autoplay style="max-width:100%; max-height:65vh; border-radius:8px; display:block; margin:0 auto;"></video>`;
        } else {
            bodyEl.innerHTML = `<img src="${url}" alt="${title}" style="max-width:100%; max-height:65vh; object-fit:contain; border-radius:8px; display:block; margin:0 auto;">`;
        }
    } else {
        bodyEl.innerHTML = `<div style="padding:2rem; color:var(--text-muted); text-align:center;">No direct media preview stream available for this file.<br><span style="font-size:0.8rem; margin-top:0.5rem; display:block;">Meta Cloud ID is active & ready for broadcasting.</span></div>`;
    }

    modal.classList.remove('hidden');
    modal.style.display = 'flex';
};

window.closeMediaPreview = function closeMediaPreview() {
    const modal = document.getElementById('media-preview-modal');
    if (modal) {
        const bodyEl = document.getElementById('media-preview-body');
        if (bodyEl) bodyEl.innerHTML = '';
        modal.classList.add('hidden');
        modal.style.display = 'none';
    }
};

// --- Globals ---
let templatesCache = [];
let selectedCustomerIds = [];
let activeInboxCustomer = null;

window.openChangePass = function openChangePass() {
    const modal = document.getElementById('change-password-modal');
    if (modal) {
        const errB = document.getElementById('change-pass-error-banner');
        const succB = document.getElementById('change-pass-success-banner');
        if (errB) errB.style.display = 'none';
        if (succB) succB.style.display = 'none';
        document.getElementById('change-password-form')?.reset();
        modal.classList.remove('hidden');
        modal.style.display = 'flex';
    }
};

window.closeChangePass = function closeChangePass() {
    const modal = document.getElementById('change-password-modal');
    if (modal) {
        modal.classList.add('hidden');
        modal.style.display = 'none';
    }
};

window.submitChangePass = async function submitChangePass(e) {
    if (e) e.preventDefault();
    const currentPassword = document.getElementById('change-pass-current')?.value || '';
    const newPassword = document.getElementById('change-pass-new')?.value || '';
    const confirmPassword = document.getElementById('change-pass-confirm')?.value || '';

    const errorBanner = document.getElementById('change-pass-error-banner');
    const successBanner = document.getElementById('change-pass-success-banner');
    const submitBtn = document.getElementById('btn-submit-change-pass');

    if (errorBanner) errorBanner.style.display = 'none';
    if (successBanner) successBanner.style.display = 'none';

    if (!newPassword) {
        if (errorBanner) {
            errorBanner.textContent = '⚠️ New password is required!';
            errorBanner.style.display = 'block';
        }
        return;
    }

    if (newPassword !== confirmPassword) {
        if (errorBanner) {
            errorBanner.textContent = '⚠️ New passwords do not match!';
            errorBanner.style.display = 'block';
        }
        return;
    }

    if (newPassword.length < 6) {
        if (errorBanner) {
            errorBanner.textContent = '⚠️ New password must be at least 6 characters long!';
            errorBanner.style.display = 'block';
        }
        return;
    }

    let username = 'admin';
    try {
        const storedUser = JSON.parse(localStorage.getItem('induio_user') || '{}');
        if (storedUser.username) username = storedUser.username;
    } catch(err) {}

    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<span class="spinner"></span> Updating...';
    }

    try {
        const res = await fetch('/api/auth?action=change-password', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, currentPassword, newPassword })
        });
        const data = await res.json();

        if (data.success) {
            if (successBanner) {
                successBanner.textContent = '✅ Password updated successfully!';
                successBanner.style.display = 'block';
            }
            document.getElementById('change-password-form')?.reset();
            setTimeout(() => {
                window.closeChangePass();
            }, 1800);
        } else {
            if (errorBanner) {
                errorBanner.textContent = `⚠️ ${data.error || 'Failed to change password'}`;
                errorBanner.style.display = 'block';
            }
        }
    } catch (err) {
        if (errorBanner) {
            errorBanner.textContent = `⚠️ Error: ${err.message}`;
            errorBanner.style.display = 'block';
        }
    } finally {
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerHTML = 'Update Password';
        }
    }
};
let activeCustomerData = null;
let inboxPollInterval = null;
let allCustomers = [];
let filteredCustomers = [];
let inboxCustomersList = [];
let currentCustomersPage = 1;
const CUSTOMERS_PER_PAGE = 10;

// --- Modal Logic ---
function showModal(title, message, type = 'info', onConfirm = null, confirmText = 'OK', confirmClass = null) {
    const overlay = document.getElementById('app-modal');
    if (!overlay) return;
    document.getElementById('modal-title').textContent = title;
    document.getElementById('modal-message').textContent = message;
    
    const confirmBtn = document.getElementById('modal-confirm-btn');
    const cancelBtn = document.getElementById('modal-cancel-btn');
    
    const newConfirm = confirmBtn.cloneNode(true);
    confirmBtn.parentNode.replaceChild(newConfirm, confirmBtn);
    const newCancel = cancelBtn.cloneNode(true);
    cancelBtn.parentNode.replaceChild(newCancel, cancelBtn);

    if (type === 'confirm') {
        newCancel.style.display = 'inline-block';
        newConfirm.textContent = confirmText || 'Yes, Proceed';
        newConfirm.className = confirmClass || 'btn primary';
    } else {
        newCancel.style.display = 'none';
        newConfirm.textContent = 'OK';
        newConfirm.className = 'btn primary';
    }

    newCancel.addEventListener('click', () => {
        overlay.classList.add('hidden');
        overlay.style.display = 'none';
    });
    newConfirm.addEventListener('click', async () => {
        if (onConfirm) {
            newConfirm.innerHTML = '<span class="spinner"></span> Processing...';
            newConfirm.disabled = true;
            try { await onConfirm(); } catch(e) { console.error(e); }
            newConfirm.disabled = false;
        }
        overlay.classList.add('hidden');
        overlay.style.display = 'none';
    });

    overlay.style.zIndex = '999999';
    overlay.style.display = 'flex';
    overlay.classList.remove('hidden');
}

// --- Theme & Navigation & UI Logic ---
const themeToggle = document.getElementById('theme-toggle');
const currentTheme = localStorage.getItem('theme') || 'dark';
document.documentElement.setAttribute('data-theme', currentTheme);

themeToggle?.addEventListener('click', () => {
    let theme = document.documentElement.getAttribute('data-theme');
    theme = theme === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
});

// Mobile menu
const mobileMenuBtn = document.getElementById('mobile-menu-btn');
const sidebarNav = document.getElementById('sidebar-nav');

mobileMenuBtn?.addEventListener('click', () => {
    sidebarNav?.classList.toggle('active');
});

// Close mobile nav on click outside
document.addEventListener('click', (e) => {
    if (window.innerWidth <= 768 && sidebarNav?.classList.contains('active')) {
        if (!sidebarNav.contains(e.target) && !mobileMenuBtn?.contains(e.target)) {
            sidebarNav.classList.remove('active');
        }
    }
});

window.switchView = function switchView(target, pushHistory = true) {
    if (!target) return;
    document.querySelectorAll('#sidebar-nav a[data-view]').forEach(a => a.classList.remove('active'));
    const link = document.querySelector(`[data-view="${target}"]`);
    if(link) link.classList.add('active');
    
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    document.getElementById(`view-${target}`)?.classList.add('active');

    localStorage.setItem('activeView', target);
    document.getElementById('sidebar-nav')?.classList.remove('active');

    if (target !== 'inbox') closeChat();

    if (target === 'dashboard') loadDashboard();
    if (target === 'customers') loadCustomers();
    if (target === 'templates') loadTemplates();
    if (target === 'send') { loadCustomersForSelect(); loadTemplatesForSelect(); }
    if (target === 'inbox') loadInboxSidebar();
    if (target === 'media') loadMedia();

    if (pushHistory && history.pushState) {
        history.pushState({ view: target }, '', `#${target}`);
    }
}

// Global navigation click handler via event delegation
document.addEventListener('click', (e) => {
    const viewLink = e.target.closest('#sidebar-nav a[data-view]');
    if (viewLink) {
        e.preventDefault();
        const targetView = viewLink.getAttribute('data-view');
        if (targetView) {
            switchView(targetView);
        }
        return;
    }

    const changePassBtn = e.target.closest('#btn-open-reset-pass, #btn-change-pass-nav');
    if (changePassBtn) {
        e.preventDefault();
        document.getElementById('sidebar-nav')?.classList.remove('active');
        window.openChangePass?.();
        return;
    }

    const logoutBtn = e.target.closest('#btn-logout-nav');
    if (logoutBtn) {
        e.preventDefault();
        localStorage.removeItem('induio_token');
        localStorage.removeItem('induio_user');
        window.location.href = '/login.html';
        return;
    }
});

// SPA Browser Back/Forward Navigation & History Management
window.addEventListener('popstate', (e) => {
    // 1. If any modal is currently visible, close it on back
    const visibleModal = document.querySelector('.modal-overlay:not(.hidden)');
    if (visibleModal) {
        visibleModal.classList.add('hidden');
        return;
    }

    // 2. If inside active chat in Inbox, close chat view and return to contact list
    if (activeInboxCustomer) {
        closeChat();
        if (window.innerWidth <= 768) {
            document.getElementById('inbox-customers-panel')?.classList.remove('hidden');
            document.getElementById('inbox-chat-area')?.classList.add('hidden');
        }
        return;
    }

    // 3. Restore view from history state or hash
    const state = e.state;
    if (state && state.view) {
        switchView(state.view, false);
    } else {
        const hash = window.location.hash.replace('#', '').split('-')[0];
        if (hash && document.getElementById(`view-${hash}`)) {
            switchView(hash, false);
        } else {
            switchView('dashboard', false);
        }
    }
});

window.addEventListener('hashchange', () => {
    const hash = window.location.hash.replace('#', '').trim();
    if (hash && document.getElementById(`view-${hash}`)) {
        switchView(hash, false);
    }
});

const initialHash = window.location.hash.replace('#', '').trim();
const savedView = (initialHash && document.getElementById(`view-${initialHash}`)) 
    ? initialHash 
    : (localStorage.getItem('activeView') || 'dashboard');

if (history.replaceState) {
    history.replaceState({ view: savedView }, '', `#${savedView}`);
}
switchView(savedView, false);


// --- Lead Status Helpers ---
function getStatusKey(status) {
    if (!status) return 'open';
    const s = String(status).toLowerCase();
    if (s.includes('working')) return 'working';
    if (s.includes('closed')) return 'closed';
    if (s.includes('converted')) return 'converted';
    return 'open';
}

function getStatusShort(status) {
    if (!status) return 'Open';
    const s = String(status).toLowerCase();
    if (s.includes('working')) return 'Working';
    if (s.includes('closed')) return 'Closed';
    if (s.includes('converted')) return 'Converted';
    return 'Open';
}

window.updateCustomerStatus = async function updateCustomerStatus(id, newStatus, selectEl = null) {
    if (!id || !newStatus) return;

    const numId = parseInt(id, 10);
    const key = getStatusKey(newStatus);

    if (selectEl) {
        selectEl.className = selectEl.classList.contains('chat-header-status-select')
            ? `chat-header-status-select status-${key}`
            : `status-select-badge status-${key}`;
    }

    // Optimistic local state updates
    const targetCust = (allCustomers || []).find(c => c.id === numId || c.id === id);
    if (targetCust) targetCust.status = newStatus;

    const targetFiltered = (filteredCustomers || []).find(c => c.id === numId || c.id === id);
    if (targetFiltered) targetFiltered.status = newStatus;

    const inboxCust = (inboxCustomersList || []).find(c => c.id === numId || c.id === id);
    if (inboxCust) inboxCust.status = newStatus;

    if (activeCustomerData && (activeCustomerData.id === numId || activeCustomerData.id === id)) {
        activeCustomerData.status = newStatus;
        const chatHeaderSelect = document.getElementById('chat-header-status-select');
        if (chatHeaderSelect && chatHeaderSelect !== selectEl) {
            chatHeaderSelect.value = newStatus;
            chatHeaderSelect.className = `chat-header-status-select status-${key}`;
        }
    }

    // Refresh inbox contacts list and sidebar cards
    if (typeof filterAndRenderInboxContacts === 'function') {
        filterAndRenderInboxContacts();
    }

    try {
        const res = await fetch('/api/customers', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: numId || id, status: newStatus })
        });
        const data = await res.json();
        if (data.error) {
            throw new Error(data.error);
        }
    } catch (err) {
        console.error('Failed to update status:', err);
        showModal('Status Update Error', 'Could not update customer status: ' + err.message);
    }
};

// --- Customers Logic ---
async function loadCustomers() {
    const tbody = document.getElementById('customers-table-body');
    if (tbody) {
        tbody.innerHTML = `<tr><td colspan="5"><div class="loading-spinner-container"><div class="spinner-icon"></div><span>Loading customer directory...</span></div></td></tr>`;
    }
    try {
        const res = await fetch('/api/customers');
        const customers = await res.json();
        
        if (customers.error) {
            console.error('API Error:', customers.error);
            if (tbody) tbody.innerHTML = `<tr><td colspan="5" class="empty-state" style="height:100px;">Failed to load customers.</td></tr>`;
            return;
        }
        
        allCustomers = Array.isArray(customers) ? customers : [];
        applyCustomerFilters();
        
        const statEl = document.getElementById('dash-stat-customers');
        if(statEl) statEl.textContent = allCustomers.length;
    } catch (e) { 
        console.error('Error loading customers:', e);
        if (tbody) tbody.innerHTML = `<tr><td colspan="5" class="empty-state" style="height:100px;">Error loading data.</td></tr>`;
    }
}

function applyCustomerFilters() {
    const query = document.getElementById('customers-search')?.value.toLowerCase().trim() || '';
    const statusFilter = document.getElementById('customers-status-filter')?.value || 'all';

    filteredCustomers = allCustomers.filter(c => {
        const matchesQuery = (!query) ||
            (c.name && c.name.toLowerCase().includes(query)) || 
            (c.phone && c.phone.toLowerCase().includes(query));
        if (!matchesQuery) return false;

        if (statusFilter !== 'all') {
            const custStatus = c.status || 'Open - Not Contacted';
            if (custStatus !== statusFilter) return false;
        }
        return true;
    });

    currentCustomersPage = 1;
    renderCustomersTable();

    // Dynamically update Export button label with filtered count
    const exportLabel = document.getElementById('btn-export-customers-label');
    if (exportLabel) {
        const isFiltered = (statusFilter !== 'all') || Boolean(query);
        exportLabel.textContent = isFiltered 
            ? `Export Filtered (${filteredCustomers.length})` 
            : `Export All (${filteredCustomers.length})`;
    }
}

function renderCustomersTable() {
    const tbody = document.getElementById('customers-table-body');
    const pageInfo = document.getElementById('customers-pagination-info');
    const btnPrev = document.getElementById('btn-prev-page');
    const btnNext = document.getElementById('btn-next-page');

    if (!tbody) return;

    const totalItems = filteredCustomers.length;
    const totalPages = Math.ceil(totalItems / CUSTOMERS_PER_PAGE) || 1;
    
    if (currentCustomersPage > totalPages) currentCustomersPage = totalPages;
    if (currentCustomersPage < 1) currentCustomersPage = 1;

    const startIndex = (currentCustomersPage - 1) * CUSTOMERS_PER_PAGE;
    const endIndex = Math.min(startIndex + CUSTOMERS_PER_PAGE, totalItems);

    const pageData = filteredCustomers.slice(startIndex, endIndex);

    tbody.innerHTML = '';
    pageData.forEach(c => {
        const tr = document.createElement('tr');
        const custStatus = c.status || 'Open - Not Contacted';
        const statusKey = getStatusKey(custStatus);
        const safeName = (c.name || 'Customer').replace(/'/g, "\\'");
        const safePhone = (c.phone || '').replace(/'/g, "\\'");
        const safeStatus = custStatus.replace(/'/g, "\\'");

        tr.innerHTML = `
            <td>
                <div class="user-cell">
                    <div class="user-avatar">${getInitial(c.name)}</div>
                    <div>
                        <strong style="color:var(--text-main);display:block;">${escapeHtml(c.name)}</strong>
                    </div>
                </div>
            </td>
            <td><code style="font-size:0.85rem;color:var(--primary);">${c.phone}</code></td>
            <td>
                <select class="status-select-badge status-${statusKey}" 
                        onchange="updateCustomerStatus(${c.id}, this.value, this)" 
                        title="Click to update status">
                    <option value="Open - Not Contacted" ${custStatus === 'Open - Not Contacted' ? 'selected' : ''}>🔵 Open - Not Contacted</option>
                    <option value="Working - Contacted" ${custStatus === 'Working - Contacted' ? 'selected' : ''}>🟡 Working - Contacted</option>
                    <option value="Closed - Not Converted" ${custStatus === 'Closed - Not Converted' ? 'selected' : ''}>⚪ Closed - Not Converted</option>
                    <option value="Converted" ${custStatus === 'Converted' ? 'selected' : ''}>🟢 Converted</option>
                </select>
            </td>
            <td><span class="window-badge" style="background:var(--primary-light);color:var(--primary);">${c.message_count || 0} messages</span></td>
            <td style="text-align: right;">
                <button class="btn secondary sm" onclick="editCustomer(${c.id}, '${safeName}', '${safePhone}', '${safeStatus}')">Edit</button>
                <button class="btn danger sm" onclick="deleteCustomer(${c.id})">Delete</button>
            </td>
        `;
        tbody.appendChild(tr);
    });

    if (totalItems === 0) {
        tbody.innerHTML = `<tr><td colspan="5" class="empty-state" style="height: 100px;">No matching customers found.</td></tr>`;
    }

    if (pageInfo) {
        pageInfo.textContent = `Showing ${totalItems === 0 ? 0 : startIndex + 1} to ${endIndex} of ${totalItems}`;
    }

    if (btnPrev) btnPrev.disabled = currentCustomersPage === 1;
    if (btnNext) btnNext.disabled = currentCustomersPage === totalPages || totalItems === 0;
}

document.getElementById('customers-search')?.addEventListener('input', applyCustomerFilters);
document.getElementById('customers-status-filter')?.addEventListener('change', applyCustomerFilters);

document.getElementById('btn-prev-page')?.addEventListener('click', () => {
    if (currentCustomersPage > 1) {
        currentCustomersPage--;
        renderCustomersTable();
    }
});

document.getElementById('btn-next-page')?.addEventListener('click', () => {
    const totalPages = Math.ceil(filteredCustomers.length / CUSTOMERS_PER_PAGE);
    if (currentCustomersPage < totalPages) {
        currentCustomersPage++;
        renderCustomersTable();
    }
});

window.deleteCustomer = (id) => {
    showModal('Delete Customer', 'Are you sure you want to delete this customer? This action cannot be undone.', 'confirm', async () => {
        await fetch(`/api/customers?id=${id}`, { method: 'DELETE' });
        loadCustomers();
    });
};

window.editCustomer = (id, name, phone, status) => {
    document.getElementById('cust-id').value = id;
    document.getElementById('cust-name').value = name;
    document.getElementById('cust-phone').value = phone;
    const statusSelect = document.getElementById('cust-status');
    if (statusSelect && status) {
        statusSelect.value = status;
    }
    document.getElementById('btn-save-cust').innerHTML = `<span>Update Customer</span>`;
    document.getElementById('btn-cancel-edit').style.display = 'inline-flex';
};

document.getElementById('btn-cancel-edit')?.addEventListener('click', () => {
    document.getElementById('add-customer-form').reset();
    document.getElementById('cust-id').value = '';
    const statusSelect = document.getElementById('cust-status');
    if (statusSelect) statusSelect.value = 'Open - Not Contacted';
    document.getElementById('btn-save-cust').innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:16px;height:16px;"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg><span>Add Customer</span>`;
    document.getElementById('btn-cancel-edit').style.display = 'none';
});

document.getElementById('add-customer-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const custId = document.getElementById('cust-id').value;
    const name = document.getElementById('cust-name').value;
    const phone = formatIndiaPhone(document.getElementById('cust-phone').value);
    const status = document.getElementById('cust-status')?.value || 'Open - Not Contacted';
    
    const performSave = async () => {
        await fetch('/api/customers', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ id: custId || undefined, name, phone, status })
        });
        document.getElementById('btn-cancel-edit').click();
        loadCustomers();
    };

    if (custId) {
        // Direct update for edit mode
        await performSave();
    } else {
        // Show Privacy & Consent Opt-in Modal for new customer
        showModal(
            'Customer Opt-In Consent Confirmation',
            `By adding ${name} (${phone}) with status "${status}", you certify that this customer has agreed: "I agree to receive WhatsApp updates, offers and promotional messages from Manaswini Enterprises and Geetha Enterprises".`,
            'confirm',
            performSave,
            'I Confirm & Agree',
            'btn primary'
        );
    }
});

// --- Dashboard Logic ---
async function loadDashboard() {
    const statCust = document.getElementById('dash-stat-customers');
    const statMsgs = document.getElementById('dash-stat-messages');
    const statChats = document.getElementById('dash-stat-chats');
    
    if(statCust) statCust.textContent = '...';
    if(statMsgs) statMsgs.textContent = '...';
    if(statChats) statChats.textContent = '...';

    try {
        const res = await fetch('/api/analytics');
        const analytics = await res.json();
        
        if (!analytics.error) {
            if(statCust) statCust.textContent = analytics.total_customers || 0;
            if(statMsgs) statMsgs.textContent = analytics.messages_sent || 0;
            if(statChats) statChats.textContent = (analytics.recent_inbound && analytics.recent_inbound.length) || 0;
            
            const inboxList = document.getElementById('dash-inbox-list');
            if (inboxList) {
                if (analytics.recent_inbound && analytics.recent_inbound.length > 0) {
                    inboxList.innerHTML = '';
                    analytics.recent_inbound.forEach(msg => {
                        inboxList.innerHTML += `
                            <div class="dash-list-item" onclick="switchView('inbox')">
                                <div class="avatar-mini">${getInitial(msg.name)}</div>
                                <div class="dash-list-item-content">
                                    <strong>${msg.name} (${msg.phone})</strong>
                                    <p>${msg.content.substring(0, 60)}${msg.content.length > 60 ? '...' : ''}</p>
                                </div>
                            </div>
                        `;
                    });
                } else {
                    inboxList.innerHTML = '<div class="empty-state">No recent inbound messages</div>';
                }
            }
        }

        const mediaGrid = document.getElementById('dash-media-grid');
        if (mediaGrid) {
            const mediaRes = await fetch('/api/media');
            const mediaList = await mediaRes.json();
            
            if (!Array.isArray(mediaList) || mediaList.length === 0) {
                mediaGrid.innerHTML = '<div class="empty-state" style="grid-column: span 2;">No media uploaded yet.</div>';
            } else {
                mediaGrid.innerHTML = '';
                const recentFiles = mediaList.slice(0, 4);
                recentFiles.forEach(m => {
                    const isVideo = m.type === 'video' || (m.name && m.name.endsWith('.mp4'));
                    const mediaHtml = isVideo 
                        ? (m.file_url ? `<video src="${m.file_url}" muted></video>` : `<div style="font-size:0.75rem;padding:0.5rem;text-align:center;">🎥 ${m.name}</div>`)
                        : (m.file_url ? `<img src="${m.file_url}" alt="${m.name}">` : `<div style="font-size:0.75rem;padding:0.5rem;text-align:center;">🖼️ ${m.name}</div>`);
                    
                    mediaGrid.innerHTML += `
                        <div class="dash-media-card">
                            ${mediaHtml}
                        </div>
                    `;
                });
            }
        }
    } catch (e) {
        console.error('Error loading dashboard:', e);
    }
}

// Excel Import
document.getElementById('excel-upload')?.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    showModal(
        'Bulk Contact Consent Certification',
        `By importing contacts from "${file.name}", you certify that all contacts have agreed: "I agree to receive WhatsApp updates, offers and promotional messages from Manaswini Enterprises and Geetha Enterprises".`,
        'confirm',
        async () => {
            const importBtn = document.getElementById('btn-import-excel');
            const originalBtnText = importBtn ? importBtn.innerHTML : '';
            
            if (importBtn) {
                importBtn.disabled = true;
                importBtn.innerHTML = '<span class="spinner"></span> Importing...';
            }

            const reader = new FileReader();
            reader.onload = async (e) => {
                try {
                    const data = new Uint8Array(e.target.result);
                    const workbook = XLSX.read(data, {type: 'array'});
                    const sheetName = workbook.SheetNames[0];
                    const worksheet = workbook.Sheets[sheetName];
                    const json = XLSX.utils.sheet_to_json(worksheet);

                    const customers = json.map(row => {
                        const keys = Object.keys(row);
                        const nameKey = keys.find(k => k.toLowerCase().includes('name')) || keys[0];
                        const phoneKey = keys.find(k => k.toLowerCase().includes('phone') || k.toLowerCase().includes('mobile')) || keys[1];
                        const rawPhone = row[phoneKey];
                        const formattedPhone = formatIndiaPhone(rawPhone);
                        return { 
                            name: row[nameKey] ? String(row[nameKey]).trim() : 'Customer', 
                            phone: formattedPhone 
                        };
                    }).filter(c => c.phone && c.phone.length >= 10);

                    if(customers.length > 0) {
                        await fetch('/api/customers-import', {
                            method: 'POST',
                            headers: {'Content-Type': 'application/json'},
                            body: JSON.stringify({ customers })
                        });
                        showModal('Success', `Imported ${customers.length} customers successfully after consent certification.`);
                        loadCustomers();
                    } else {
                        showModal('Error', 'Could not find valid Phone column in Excel file.');
                    }
                } catch (err) {
                    console.error('Excel processing error:', err);
                    showModal('Error', 'Error processing Excel file.');
                } finally {
                    if (importBtn) {
                        importBtn.disabled = false;
                        importBtn.innerHTML = originalBtnText;
                    }
                    document.getElementById('excel-upload').value = '';
                }
            };
            reader.readAsArrayBuffer(file);
        },
        'I Certify & Import',
        'btn primary'
    );
});

// Download Excel Template for Customer Import
document.getElementById('btn-download-template')?.addEventListener('click', () => {
    const templateData = [
        { Name: "John Doe", Phone: "919876543210" },
        { Name: "Jane Smith", Phone: "919876543211" }
    ];
    
    const worksheet = XLSX.utils.json_to_sheet(templateData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Customers");
    
    // Set column widths
    worksheet['!cols'] = [{ wch: 20 }, { wch: 20 }];
    
    XLSX.writeFile(workbook, "Manageetha_customers_template.xlsx");
});

// --- Export Customers Based on Active Filter ---
function exportFilteredCustomers() {
    if (!filteredCustomers || filteredCustomers.length === 0) {
        showModal('No Customers to Export', 'There are no customers matching your current filter criteria to export.');
        return;
    }

    const statusFilter = document.getElementById('customers-status-filter')?.value || 'all';
    const searchQuery = document.getElementById('customers-search')?.value.trim() || '';

    // Prepare rows for Excel
    const exportRows = filteredCustomers.map((c, index) => {
        const cleanPhone = formatIndiaPhone(c.phone);
        const createdDate = c.created_at ? new Date(c.created_at).toLocaleDateString() : '';
        const lastMsgTime = c.last_message_at ? new Date(c.last_message_at).toLocaleString() : 'No messages';

        return {
            "Sr No": index + 1,
            "Customer Name": c.name || "Customer",
            "Phone Number": cleanPhone,
            "Display Phone": formatDisplayPhone(c.phone),
            "Status": c.status || "Open - Not Contacted",
            "Messages Count": parseInt(c.message_count, 10) || 0,
            "Unread Messages": parseInt(c.unread_count, 10) || 0,
            "Date Added": createdDate,
            "Last Conversation Activity": lastMsgTime
        };
    });

    const worksheet = XLSX.utils.json_to_sheet(exportRows);
    const workbook = XLSX.utils.book_new();

    // Sheet name (max 31 characters supported by Excel)
    let sheetName = "Filtered Customers";
    if (statusFilter !== 'all') {
        sheetName = statusFilter.slice(0, 31);
    }
    XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);

    // Set auto column widths
    worksheet['!cols'] = [
        { wch: 8 },  // Sr No
        { wch: 24 }, // Customer Name
        { wch: 16 }, // Phone Number
        { wch: 18 }, // Display Phone
        { wch: 24 }, // Status
        { wch: 16 }, // Messages Count
        { wch: 16 }, // Unread Messages
        { wch: 14 }, // Date Added
        { wch: 26 }  // Last Conversation Activity
    ];

    // Build descriptive filename based on active filters
    const nowStr = new Date().toISOString().slice(0, 10);
    let filterSlug = 'all';
    if (statusFilter !== 'all') {
        filterSlug = statusFilter.toLowerCase().replace(/[^a-z0-9]+/g, '_');
    } else if (searchQuery) {
        filterSlug = 'search_' + searchQuery.toLowerCase().replace(/[^a-z0-9]+/g, '_').slice(0, 15);
    }

    const filename = `Manageetha_Customers_${filterSlug}_${exportRows.length}_contacts_${nowStr}.xlsx`;
    XLSX.writeFile(workbook, filename);

    // Provide friendly confirmation
    const filterDesc = statusFilter !== 'all' ? `status "${statusFilter}"` : (searchQuery ? `search "${searchQuery}"` : 'all contacts');
    showModal('Export Successful', `Successfully exported ${exportRows.length} customer(s) based on ${filterDesc} to <strong>${filename}</strong>.`);
}

document.getElementById('btn-export-customers')?.addEventListener('click', exportFilteredCustomers);
document.getElementById('btn-export-customers-toolbar')?.addEventListener('click', exportFilteredCustomers);



// --- Templates Logic & Meta Template Builder ---
let editingTemplateId = null;

async function loadTemplates() {
    const grid = document.getElementById('templates-grid');
    if (grid) {
        grid.innerHTML = `<div style="grid-column: 1 / -1;"><div class="loading-spinner-container"><div class="spinner-icon"></div><span>Loading WhatsApp message templates...</span></div></div>`;
    }
    try {
        const res = await fetch('/api/templates');
        templatesCache = await res.json();
        
        if (templatesCache.error) {
            templatesCache = [];
            if (grid) grid.innerHTML = '<div class="empty-state" style="grid-column: 1 / -1;">Failed to load templates.</div>';
            return;
        }
        
        if (grid) {
            grid.innerHTML = '';
            if (Array.isArray(templatesCache) && templatesCache.length > 0) {
                templatesCache.forEach(t => {
                    const statusClass = t.status === 'APPROVED' ? 'badge-approved' : t.status === 'PENDING' ? 'badge-pending' : 'badge-rejected';
                    const bodyComponent = t.components ? t.components.find(c => c.type === 'BODY') : null;
                    const bodySnippet = bodyComponent ? bodyComponent.text : 'Official Meta Message Template for WhatsApp broadcasts.';
                    const safeName = (t.name || '').replace(/'/g, "\\'");
                    const safeId = (t.id || '').replace(/'/g, "\\'");
                    
                    grid.innerHTML += `
                        <div class="template-card">
                            <div>
                                <div class="template-card-header">
                                    <h4 class="template-card-title" title="${t.name}">${t.name}</h4>
                                    <span class="badge-status ${statusClass}">${t.status || 'APPROVED'}</span>
                                </div>
                                <span class="template-card-meta">${t.language} • ${t.category || 'UTILITY'}</span>
                                <p class="template-card-body">${bodySnippet}</p>
                            </div>
                            <div class="tpl-actions-row">
                                <div class="tpl-action-group">
                                    <button class="tpl-action-btn copy" onclick="navigator.clipboard.writeText('${safeName}'); showModal('Copied', 'Template name copied to clipboard!');" title="Copy template name">
                                        <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
                                        <span>Copy</span>
                                    </button>
                                    <button class="tpl-action-btn edit" onclick="editTemplate('${safeId || safeName}')" title="Edit Meta template">
                                        <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                                        <span>Edit</span>
                                    </button>
                                    <button class="tpl-action-btn delete" onclick="deleteTemplate('${safeName}', '${safeId}')" title="Delete template">
                                        <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                                        <span>Delete</span>
                                    </button>
                                </div>
                                <span class="template-id-tag" title="Template ID">${t.id || ''}</span>
                            </div>
                        </div>
                    `;
                });
            } else {
                grid.innerHTML = '<div class="empty-state" style="grid-column: 1 / -1;">No templates found. Click "+ Create Template" above to build your first template.</div>';
            }
        }
    } catch (e) { console.error('Templates fetch error', e); }
}

window.loadTemplates = loadTemplates;

function updateBannerTitle() {
    const titleEl = document.getElementById('tpl-banner-title');
    if (!titleEl) return;
    const name = document.getElementById('tpl-name')?.value || 'your_template_name';
    const langSelect = document.getElementById('tpl-lang');
    let langLabel = 'English';
    if (langSelect && langSelect.selectedIndex >= 0) {
        const selectedOpt = langSelect.options[langSelect.selectedIndex];
        langLabel = selectedOpt ? selectedOpt.textContent.split('(')[0].trim() : langSelect.value;
    }
    titleEl.textContent = `${name} • ${langLabel}`;
}
window.updateBannerTitle = updateBannerTitle;

window.editTemplate = async function editTemplate(id) {
    if (!templatesCache || !Array.isArray(templatesCache) || templatesCache.length === 0) {
        showModal('Error', 'Templates data is loading. Please try clicking "Refresh Statuses" to sync templates.');
        return;
    }

    const targetIdStr = String(id || '').trim();
    const tpl = templatesCache.find(t => String(t.id || '').trim() === targetIdStr || String(t.name || '').trim() === targetIdStr);

    if (!tpl) {
        showModal('Error', `Template "${id}" details not found in cache. Please click "Refresh Statuses" to reload.`);
        return;
    }

    editingTemplateId = tpl.id || tpl.name;
    currentSelectedCategory = (tpl.category || 'MARKETING').toUpperCase();
    currentSelectedSubtype = 'custom';

    const modal = document.getElementById('template-create-modal');
    if (!modal) return;

    modal.classList.remove('hidden');
    modal.style.display = 'flex';

    // 1. Switch to Step 2 and build form DOM
    if (typeof goToStep === 'function') goToStep(2);
    if (typeof renderStep2Form === 'function') {
        renderStep2Form(currentSelectedCategory, currentSelectedSubtype);
    }

    // 2. Select Step 2 Form Elements
    const nameInput = document.getElementById('tpl-name');
    const langSelect = document.getElementById('tpl-lang');
    const headerTypeSelect = document.getElementById('tpl-header-type');
    const headerTextInput = document.getElementById('tpl-header-text');
    const headerTextGroup = document.getElementById('tpl-header-text-group');
    const mediaGroup = document.getElementById('tpl-media-dropzone-wrapper');
    const bodyInput = document.getElementById('tpl-body');
    const footerInput = document.getElementById('tpl-footer');
    const buttonTypeSelect = document.getElementById('tpl-button-type');

    // Populate Name (Locked on edit per Meta guidelines)
    if (nameInput) {
        nameInput.value = tpl.name || '';
        nameInput.disabled = true;
    }

    // Populate Language (Add dynamic option if 'en' or other code is missing)
    if (langSelect && tpl.language) {
        let opt = Array.from(langSelect.options).find(o => o.value === tpl.language);
        if (!opt) {
            const newOpt = document.createElement('option');
            newOpt.value = tpl.language;
            newOpt.textContent = `Language (${tpl.language})`;
            langSelect.appendChild(newOpt);
        }
        langSelect.value = tpl.language;
    }

    // Update banner using the helper which reads display text from the select option
    updateBannerTitle();

    const comps = tpl.components || [];
    const headerComp = comps.find(c => c.type === 'HEADER');
    const bodyComp = comps.find(c => c.type === 'BODY');
    const footerComp = comps.find(c => c.type === 'FOOTER');
    const buttonsComp = comps.find(c => c.type === 'BUTTONS');

    // Populate Header Component
    if (headerComp) {
        const fmt = (headerComp.format || (headerComp.text ? 'TEXT' : 'NONE')).toUpperCase();
        if (headerTypeSelect) headerTypeSelect.value = fmt;
        if (fmt === 'TEXT' && headerTextInput) {
            headerTextInput.value = headerComp.text || '';
            if (headerTextGroup) headerTextGroup.style.display = 'block';
            if (mediaGroup) mediaGroup.style.display = 'none';
        } else if (['IMAGE', 'VIDEO', 'DOCUMENT'].includes(fmt)) {
            if (headerTextGroup) headerTextGroup.style.display = 'none';
            if (mediaGroup) mediaGroup.style.display = 'block';

            // Extract sample media URL from Meta template component example
            let sampleUrl = null;
            if (headerComp.example) {
                if (Array.isArray(headerComp.example.header_url) && headerComp.example.header_url[0]) {
                    sampleUrl = headerComp.example.header_url[0];
                } else if (Array.isArray(headerComp.example.header_handle) && headerComp.example.header_handle[0]) {
                    const h = headerComp.example.header_handle[0];
                    if (h.startsWith('http://') || h.startsWith('https://') || h.startsWith('data:')) {
                        sampleUrl = h;
                    }
                }
            }

            // Fallback: Check local Media Library for matching file asset
            if (!sampleUrl) {
                try {
                    const mediaRes = await fetch('/api/media');
                    const mediaList = await mediaRes.json();
                    if (Array.isArray(mediaList) && mediaList.length > 0) {
                        const fmtLower = fmt.toLowerCase();
                        const matched = mediaList.find(m => (m.type === fmtLower || (m.mime_type && m.mime_type.startsWith(fmtLower))) && m.file_url);
                        if (matched) sampleUrl = matched.file_url;
                    }
                } catch (e) {
                    console.warn('Error matching media for edit preview:', e);
                }
            }

            if (sampleUrl) {
                currentMediaSampleUrl = sampleUrl;

                const fileCardEl = document.getElementById('tpl-media-file-card');
                const dropzoneEl = document.getElementById('tpl-media-dropzone');
                const fileNameTextEl = document.getElementById('tpl-media-file-name-text');
                const fileSizeTextEl = document.getElementById('tpl-media-file-size-text');
                const mediaThumbEl = document.getElementById('tpl-media-file-thumb');
                const mediaIconEl = document.getElementById('tpl-media-file-icon');

                if (dropzoneEl) dropzoneEl.style.display = 'none';
                if (fileCardEl) fileCardEl.style.display = 'flex';
                if (fileNameTextEl) fileNameTextEl.textContent = `Meta Sample ${fmt.toLowerCase()}`;
                if (fileSizeTextEl) fileSizeTextEl.textContent = `(Synced from Meta)`;

                if (fmt === 'IMAGE') {
                    if (mediaThumbEl) {
                        mediaThumbEl.src = sampleUrl;
                        mediaThumbEl.style.display = 'block';
                    }
                    if (mediaIconEl) mediaIconEl.style.display = 'none';
                } else if (fmt === 'VIDEO') {
                    if (mediaThumbEl) mediaThumbEl.style.display = 'none';
                    if (mediaIconEl) {
                        mediaIconEl.textContent = '🎥';
                        mediaIconEl.style.display = 'inline-block';
                    }
                } else {
                    if (mediaThumbEl) mediaThumbEl.style.display = 'none';
                    if (mediaIconEl) {
                        mediaIconEl.textContent = '📄';
                        mediaIconEl.style.display = 'inline-block';
                    }
                }
            }
        } else {
            if (headerTextGroup) headerTextGroup.style.display = 'none';
            if (mediaGroup) mediaGroup.style.display = 'none';
        }
    } else {
        if (headerTypeSelect) headerTypeSelect.value = 'NONE';
        if (headerTextGroup) headerTextGroup.style.display = 'none';
        if (mediaGroup) mediaGroup.style.display = 'none';
    }

    // Populate Body Component
    if (bodyInput && bodyComp) {
        bodyInput.value = bodyComp.text || '';
    }

    // Populate Footer Component
    if (footerInput && footerComp) {
        footerInput.value = footerComp.text || '';
    }

    // Populate Buttons Component
    const listContainer = document.getElementById('tpl-buttons-list');
    if (listContainer) listContainer.innerHTML = '';

    if (buttonsComp && Array.isArray(buttonsComp.buttons) && buttonsComp.buttons.length > 0) {
        buttonsComp.buttons.forEach(btn => {
            const bType = (btn.type || '').toUpperCase();
            if (bType === 'QUICK_REPLY') {
                addTemplateButton('QUICK_REPLY', { text: btn.text || '' });
            } else if (bType === 'URL') {
                addTemplateButton('URL', { text: btn.text || '', url: btn.url || '' });
            } else if (bType === 'PHONE_NUMBER') {
                addTemplateButton('PHONE_NUMBER', { text: btn.text || '', phone: btn.phone_number || '' });
            } else if (bType === 'COPY_CODE') {
                addTemplateButton('COPY_CODE', { code: btn.example || btn.text || '' });
            }
        });
    }

    const submitBtn = document.getElementById('btn-submit-tpl');
    if (submitBtn) submitBtn.innerHTML = '✏️ Update Template';

    if (typeof updateLivePreview === 'function') updateLivePreview();
};

window.deleteTemplate = function deleteTemplate(name, id) {
    if (name && name.toLowerCase().startsWith('hello_world')) {
        showModal('System Template Locked', 'Meta Cloud API Notice: "hello_world" is a default system sample template pre-provisioned and locked by Meta. It cannot be deleted from your account. Any custom templates you create can be deleted freely.');
        return;
    }

    showModal('Delete Template', `Are you sure you want to permanently delete template "${name}" from your Meta WhatsApp Business Account? This action cannot be undone.`, 'confirm', async () => {
        try {
            const res = await fetch(`/api/templates?name=${encodeURIComponent(name)}&id=${id || ''}`, {
                method: 'DELETE'
            });
            const data = await res.json();

            if (data.error) {
                showModal('Meta Delete Notice', data.error);
            } else {
                showModal('Deleted', `Template "${name}" has been deleted from Meta Cloud API.`);
                loadTemplates();
                loadTemplatesForSelect();
            }
        } catch (err) {
            showModal('Error', 'Failed to delete template: ' + err.message);
        }
    });
};

async function loadTemplatesForSelect() {
    if(templatesCache.length === 0) await loadTemplates();
    const select = document.getElementById('bc-template');
    if (select) {
        select.innerHTML = '';
        const approvedOnly = Array.isArray(templatesCache) ? templatesCache.filter(t => t.status === 'APPROVED' || !t.status) : [];
        if (approvedOnly.length === 0) {
            select.innerHTML = '<option value="">No approved templates available</option>';
        } else {
            approvedOnly.forEach(t => {
                select.innerHTML += `<option value="${t.name}" data-lang="${t.language}">${t.name} (${t.language})</option>`;
            });
        }
        if (typeof checkSelectedTemplateMediaRequirement === 'function') {
            checkSelectedTemplateMediaRequirement();
        }
    }
}

// Meta Template Modal Setup & Logic

let currentStep = 1;
let currentSelectedSubtype = 'default';
let currentSelectedCategory = 'MARKETING';

const subTypesMap = {
    MARKETING: [
        { id: 'default', title: 'Default', desc: 'Send messages with media and customised buttons to engage your customers.' },
        { id: 'catalogue', title: 'Catalogue', desc: 'Send messages that drive sales by connecting your product catalogue.' },
        { id: 'calling_permissions', title: 'Calling permissions request', desc: 'Ask customers if you can call them on WhatsApp.' }
    ],
    UTILITY: [
        { id: 'default', title: 'Default', desc: 'Send messages about an existing order or account.' },
        { id: 'calling_permissions', title: 'Calling permissions request', desc: 'Ask customers if you can call them on WhatsApp.' }
    ],
    AUTHENTICATION: [
        { id: 'otp', title: 'One-time passcode', desc: 'Send codes to verify a transaction or login.' }
    ]
};


function renderSubtypes(category) {
    const container = document.getElementById('meta-subtypes-container');
    if (!container) return;

    const list = subTypesMap[category] || subTypesMap.MARKETING;
    currentSelectedSubtype = list[0].id;

    container.innerHTML = list.map((item, index) => `
        <label class="subtype-card ${index === 0 ? 'active' : ''}">
            <input type="radio" name="meta-subtype" value="${item.id}" ${index === 0 ? 'checked' : ''}>
            <div>
                <div class="subtype-title">${item.title}</div>
                <div class="subtype-desc">${item.desc}</div>
            </div>
        </label>
    `).join('');

    container.querySelectorAll('.subtype-card').forEach(card => {
        card.addEventListener('click', () => {
            container.querySelectorAll('.subtype-card').forEach(c => c.classList.remove('active'));
            card.classList.add('active');
            const radio = card.querySelector('input[type="radio"]');
            if (radio) {
                radio.checked = true;
                currentSelectedSubtype = radio.value;
            }
            updateLivePreview();
        });
    });
}

function goToStep(step) {
    currentStep = step;
    const step1Container = document.getElementById('meta-step-1-container');
    const step2Container = document.getElementById('meta-step-2-container');
    const dot1 = document.getElementById('step-dot-1');
    const dot2 = document.getElementById('step-dot-2');
    const btnDiscard = document.getElementById('btn-discard-tpl');
    const btnPrev = document.getElementById('btn-prev-step');
    const btnNext = document.getElementById('btn-next-step');
    const btnSubmit = document.getElementById('btn-submit-tpl');

    if (step === 1) {
        if (step1Container) step1Container.style.display = 'block';
        if (step2Container) step2Container.style.display = 'none';
        dot1?.classList.add('active');
        dot2?.classList.remove('active');
        if (btnDiscard) btnDiscard.style.display = 'block';
        if (btnPrev) btnPrev.style.display = 'none';
        if (btnNext) btnNext.style.display = 'block';
        if (btnSubmit) btnSubmit.style.display = 'none';
    } else {
        if (step1Container) step1Container.style.display = 'none';
        if (step2Container) step2Container.style.display = 'block';
        dot1?.classList.remove('active');
        dot2?.classList.add('active');
        if (btnDiscard) btnDiscard.style.display = 'none';
        if (btnPrev) btnPrev.style.display = 'block';
        if (btnNext) btnNext.style.display = 'none';
        if (btnSubmit) btnSubmit.style.display = 'block';
        
        renderStep2Form(currentSelectedCategory, currentSelectedSubtype);
    }
}
window.goToStep = goToStep;

function renderStep2Form(category, subtype) {
    const form = document.getElementById('template-builder-form');
    const bannerTitle = document.getElementById('tpl-banner-title');
    const bannerSubtitle = document.getElementById('tpl-banner-subtitle');
    const bannerIcon = document.querySelector('.tpl-banner-icon');
    
    if (!form) return;

    // Update Banner Info
    const catIcons = { MARKETING: '📢', UTILITY: '🔔', AUTHENTICATION: '🔑' };
    const icon = catIcons[category] || '📢';
    const subTitleText = `${category.charAt(0) + category.slice(1).toLowerCase()} • ${subtype.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase())}`;

    if (bannerIcon) bannerIcon.textContent = icon;
    if (bannerTitle) bannerTitle.textContent = `your_template_name • English`;
    if (bannerSubtitle) bannerSubtitle.textContent = subTitleText;

    // Build Relevant Form Cards HTML
    let html = '';

    // Card 1: Template Name and Language (Always Present)
    html += `
        <div class="card" style="padding:1rem; border:1px solid var(--border); background:var(--bg-sidebar); border-radius:8px;">
            <h4 style="font-size:0.9rem; margin-bottom:0.75rem; color:var(--text-main);">Template name and language</h4>
            <div style="display:flex; gap:0.75rem; flex-wrap:wrap;">
                <div class="form-group" style="flex:2; min-width:200px;">
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.25rem;">
                        <label for="tpl-name">Name your template <span style="color:var(--danger)">*</span></label>
                        <span id="tpl-name-count" style="font-size:0.725rem; color:var(--text-muted)">0/512</span>
                    </div>
                    <input type="text" id="tpl-name" placeholder="Enter a template name" required pattern="[a-z0-9_]+" maxlength="512" style="font-family:monospace;">
                    <small style="font-size:0.725rem; color:var(--text-muted)">Lowercase letters, numbers, and underscores only.</small>
                </div>
                <div class="form-group" style="flex:1; min-width:140px;">
                    <label for="tpl-lang">Select language <span style="color:var(--danger)">*</span></label>
                    <select id="tpl-lang" required>
                        <option value="en" selected>English (en)</option>
                        <option value="en_US">English (US) (en_US)</option>
                        <option value="en_GB">English (UK) (en_GB)</option>
                        <option value="hi">Hindi (hi)</option>
                        <option value="te">Telugu (te)</option>
                        <option value="ta">Tamil (ta)</option>
                        <option value="kn">Kannada (kn)</option>
                        <option value="mr">Marathi (mr)</option>
                        <option value="gu">Gujarati (gu)</option>
                        <option value="bn">Bengali (bn)</option>
                        <option value="ml">Malayalam (ml)</option>
                        <option value="pa">Punjabi (pa)</option>
                        <option value="ur">Urdu (ur)</option>
                        <option value="ar">Arabic (ar)</option>
                        <option value="es">Spanish (es)</option>
                        <option value="es_ES">Spanish (Spain) (es_ES)</option>
                        <option value="pt_BR">Portuguese (BR) (pt_BR)</option>
                        <option value="fr">French (fr)</option>
                        <option value="de">German (de)</option>
                        <option value="id">Indonesian (id)</option>
                        <option value="it">Italian (it)</option>
                        <option value="ja">Japanese (ja)</option>
                        <option value="ko">Korean (ko)</option>
                        <option value="ru">Russian (ru)</option>
                        <option value="zh_CN">Chinese (CN) (zh_CN)</option>
                        <option value="zh_TW">Chinese (TW) (zh_TW)</option>
                        <option value="tr">Turkish (tr)</option>
                    </select>
                </div>
            </div>
        </div>
    `;

    if (category === 'AUTHENTICATION') {
        // Variant D: Authentication • One-time passcode
        html += `
            <div class="card" style="padding:1rem; border:1px solid var(--border); background:var(--bg-sidebar); border-radius:8px;">
                <h4 style="font-size:0.9rem; margin-bottom:0.35rem; color:var(--text-main);">Code delivery setup</h4>
                <p style="font-size:0.775rem; color:var(--text-muted); margin-bottom:0.85rem; line-height:1.35;">Choose how customers send the code from WhatsApp to your app.</p>
                <div style="display:flex; flex-direction:column; gap:0.75rem;">
                    <label class="option-radio-label">
                        <input type="radio" name="otp-type" value="zero_tap" checked>
                        <div>
                            <strong style="font-size:0.85rem; display:block;">Zero-tap auto-fill</strong>
                            <span style="font-size:0.75rem; color:var(--text-muted);">Recommended. Automatically sends code without requiring customer to tap a button.</span>
                        </div>
                    </label>
                    <div style="margin-left: 1.6rem; background:var(--primary-light); padding:0.75rem 0.85rem; border-radius:6px; font-size:0.75rem; color:var(--text-main); border:1px solid rgba(0, 168, 132, 0.3);">
                        <label style="display:flex; align-items:flex-start; gap:0.5rem; cursor:pointer; margin:0;">
                            <input type="checkbox" id="zt-consent-cb" checked>
                            <span style="font-size:0.75rem; line-height:1.4; color:var(--text-main);">
                                By selecting zero-tap, I understand that use of zero-tap authentication is subject to the <a href="https://www.whatsapp.com/legal/business-terms/?lang=en_GB" target="_blank" rel="noopener noreferrer" style="color:var(--primary);text-decoration:underline;font-weight:600;">WhatsApp Business Terms of Service</a>. It's your responsibility to ensure that customers expect that the code will be automatically filled in on their behalf when they choose to receive the zero-tap code through WhatsApp.
                            </span>
                        </label>
                        <div style="margin-top:0.35rem; padding-left:1.65rem;">
                            <a href="https://business.facebook.com/business/help/285737223876109" target="_blank" rel="noopener noreferrer" style="color:var(--primary);text-decoration:underline;font-size:0.725rem;font-weight:600;">Learn more and review best practices.</a>
                        </div>
                        <div id="zt-consent-error" class="zero-tap-error-banner" style="display:none;">
                            🚫 This box must be ticked to submit this template.
                        </div>
                    </div>
                    <label class="option-radio-label">
                        <input type="radio" name="otp-type" value="one_tap">
                        <div>
                            <strong style="font-size:0.85rem; display:block;">One-tap auto-fill</strong>
                            <span style="font-size:0.75rem; color:var(--text-muted);">Code sends to your app when customers tap the button.</span>
                        </div>
                    </label>
                    <label class="option-radio-label">
                        <input type="radio" name="otp-type" value="copy_code">
                        <div>
                            <strong style="font-size:0.85rem; display:block;">Copy code</strong>
                            <span style="font-size:0.75rem; color:var(--text-muted);">Customers copy and paste the code into your app.</span>
                        </div>
                    </label>
                </div>
            </div>

            <div class="card" style="padding:1rem; border:1px solid var(--border); background:var(--bg-sidebar); border-radius:8px;">
                <h4 style="font-size:0.9rem; margin-bottom:0.35rem; color:var(--text-main);">App setup</h4>
                <p style="font-size:0.775rem; color:var(--text-muted); margin-bottom:0.85rem;">You can add up to 5 apps.</p>
                <div style="display:flex; gap:0.75rem; flex-wrap:wrap;">
                    <div class="form-group" style="flex:1; min-width:180px;">
                        <label>Package name</label>
                        <input type="text" placeholder="com.example.myapplication" style="font-family:monospace;">
                    </div>
                    <div class="form-group" style="flex:1; min-width:140px;">
                        <label>App signature hash</label>
                        <input type="text" placeholder="Enter 11-char hash" maxlength="11" style="font-family:monospace;">
                    </div>
                </div>
                <button type="button" class="btn secondary sm" style="margin-top:0.75rem;">+ Add another app</button>
            </div>

            <div class="card" style="padding:1rem; border:1px solid var(--border); background:var(--bg-sidebar); border-radius:8px;">
                <h4 style="font-size:0.9rem; margin-bottom:0.35rem; color:var(--text-main);">Content</h4>
                <div class="form-group">
                    <label for="tpl-body">Body <span style="color:var(--danger)">*</span></label>
                    <textarea id="tpl-body" rows="3" required maxlength="1024">{{1}} is your verification code. For your security, do not share this code.</textarea>
                </div>
            </div>
        `;
    } else if (subtype === 'catalogue') {
        // Variant B: Marketing • Catalogue
        html += `
            <div class="card" style="padding:1rem; border:1px solid var(--border); background:var(--bg-sidebar); border-radius:8px;">
                <h4 style="font-size:0.9rem; margin-bottom:0.35rem; color:var(--text-main);">Catalogue format</h4>
                <p style="font-size:0.775rem; color:var(--text-muted); margin-bottom:0.75rem;">Choose the message format that best fits your needs.</p>
                <div style="display:flex; flex-direction:column; gap:0.6rem;">
                    <label class="option-radio-label">
                        <input type="radio" name="cat-format" value="single" checked>
                        <div>
                            <strong style="font-size:0.85rem; display:block;">Catalogue message</strong>
                            <span style="font-size:0.75rem; color:var(--text-muted);">Include the entire catalogue to give your users a comprehensive view of all your products.</span>
                        </div>
                    </label>
                    <label class="option-radio-label">
                        <input type="radio" name="cat-format" value="multi">
                        <div>
                            <strong style="font-size:0.85rem; display:block;">Multi product message</strong>
                            <span style="font-size:0.75rem; color:var(--text-muted);">Include up to 30 products from the catalogue.</span>
                        </div>
                    </label>
                </div>
            </div>

            <div class="card" style="padding:1rem; border:1px solid var(--border); background:var(--bg-sidebar); border-radius:8px;">
                <h4 style="font-size:0.9rem; margin-bottom:0.35rem; color:var(--text-main);">Catalogue setup</h4>
                <p style="font-size:0.775rem; color:var(--text-muted); margin-bottom:0.75rem;">Connecting a catalogue will allow customers to view, message and send carts containing your products and services via WhatsApp.</p>
                <button type="button" class="btn primary sm" onclick="showModal('Catalogue Info', 'Catalogue connects via Meta Commerce Manager API.')">Connect catalogue</button>
            </div>

            <div class="card" style="padding:1rem; border:1px solid var(--border); background:var(--bg-sidebar); border-radius:8px;">
                <h4 style="font-size:0.9rem; margin-bottom:0.35rem; color:var(--text-main);">Content</h4>
                <div class="form-group" style="margin-bottom:0.85rem;">
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.25rem;">
                        <label for="tpl-body">Body <span style="color:var(--danger)">*</span></label>
                        <span id="tpl-body-count" style="font-size:0.725rem; color:var(--text-muted)">0/1024</span>
                    </div>
                    <textarea id="tpl-body" rows="4" required maxlength="1024">Discover our latest products and bestsellers in our catalog. Browse and shop with ease on WhatsApp #happyshopping!</textarea>
                    <div class="meta-editor-toolbar" style="display:flex; gap:0.35rem; align-items:center; margin-top:0.35rem;">
                        <button type="button" class="btn secondary sm" id="btn-fmt-bold"><b>B</b></button>
                        <button type="button" class="btn secondary sm" id="btn-fmt-italic"><i>I</i></button>
                        <button type="button" class="btn secondary sm" id="btn-fmt-strike"><s>S</s></button>
                        <button type="button" class="btn secondary sm" id="btn-fmt-code">&lt;/&gt;</button>
                        <button type="button" id="btn-add-var" class="btn secondary sm" style="margin-left:auto; font-size:0.75rem;">+ Add variable</button>
                    </div>
                </div>
                <div class="form-group">
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.25rem;">
                        <label for="tpl-footer">Footer - Optional</label>
                        <span id="tpl-footer-count" style="font-size:0.725rem; color:var(--text-muted)">0/60</span>
                    </div>
                    <input type="text" id="tpl-footer" placeholder="Add a short line of text to the bottom" maxlength="60">
                </div>
            </div>

            <div class="card" style="padding:1rem; border:1px solid var(--border); background:var(--bg-sidebar); border-radius:8px;">
                <h4 style="font-size:0.9rem; margin-bottom:0.35rem; color:var(--text-main);">Button</h4>
                <p style="font-size:0.775rem; color:var(--text-muted);">ⓘ Only one button is supported for this type of template. The button text is not editable (<code>View catalog</code>).</p>
            </div>
        `;
    } else if (subtype === 'calling_permissions') {
        // Variant C: Calling permissions request
        html += `
            <div class="card" style="padding:1rem; border:1px solid var(--border); background:var(--bg-sidebar); border-radius:8px;">
                <h4 style="font-size:0.9rem; margin-bottom:0.35rem; color:var(--text-main);">Content</h4>
                <p style="font-size:0.775rem; color:var(--text-muted); margin-bottom:0.85rem;">Add a header, body and footer for your template.</p>
                <div class="form-group" style="margin-bottom:0.85rem;">
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.25rem;">
                        <label for="tpl-body">Body <span style="color:var(--danger)">*</span></label>
                        <span id="tpl-body-count" style="font-size:0.725rem; color:var(--text-muted)">0/1024</span>
                    </div>
                    <textarea id="tpl-body" rows="4" required maxlength="1024">Can Jasper's Market call you? You can update your preference anytime in the business profile.</textarea>
                    <div class="meta-editor-toolbar" style="display:flex; gap:0.35rem; align-items:center; margin-top:0.35rem;">
                        <button type="button" class="btn secondary sm" id="btn-fmt-bold"><b>B</b></button>
                        <button type="button" class="btn secondary sm" id="btn-fmt-italic"><i>I</i></button>
                        <button type="button" class="btn secondary sm" id="btn-fmt-strike"><s>S</s></button>
                        <button type="button" class="btn secondary sm" id="btn-fmt-code">&lt;/&gt;</button>
                        <button type="button" id="btn-add-var" class="btn secondary sm" style="margin-left:auto; font-size:0.75rem;">+ Add variable</button>
                    </div>
                </div>
            </div>

            <div class="card" style="padding:1rem; border:1px solid var(--border); background:var(--bg-sidebar); border-radius:8px;">
                <h4 style="font-size:0.9rem; margin-bottom:0.35rem; color:var(--text-main);">Buttons</h4>
                <p style="font-size:0.775rem; color:var(--text-muted);">ⓘ Only one button is supported for this type of template and the button text is not editable (<code>Choose preference ˅</code>).</p>
            </div>
        `;
    } else {
        // Variant A: Default (Marketing or Utility)
        html += `
            <div class="card" style="padding:1rem; border:1px solid var(--border); background:var(--bg-sidebar); border-radius:8px;">
                <h4 style="font-size:0.9rem; margin-bottom:0.35rem; color:var(--text-main);">Content</h4>
                <p style="font-size:0.775rem; color:var(--text-muted); margin-bottom:0.85rem; line-height:1.35;">Add a header, body and footer for your template. Cloud API hosted by Meta will review template content.</p>

                <div style="display:flex; gap:0.75rem; flex-wrap:wrap; margin-bottom:0.85rem;">
                    <div class="form-group" style="flex:1; min-width:140px;">
                        <label for="tpl-var-type">Type of variable <span title="Choose whether variables are numbers or text/strings">ℹ</span></label>
                        <select id="tpl-var-type">
                            <option value="TEXT">Text / String</option>
                            <option value="NUMBER">Number</option>
                        </select>
                    </div>
                    <div class="form-group" style="flex:1; min-width:140px;">
                        <label for="tpl-header-type">Media sample · Optional</label>
                        <select id="tpl-header-type">
                            <option value="NONE">None</option>
                            <option value="TEXT">Text Header</option>
                            <option value="IMAGE">📷 Image</option>
                            <option value="VIDEO">🎥 Video</option>
                            <option value="DOCUMENT">📄 Document</option>
                            <option value="LOCATION">📍 Location</option>
                        </select>
                    </div>
                </div>

                <!-- Media Upload Dropzone & File Card -->
                <div id="tpl-media-dropzone-wrapper" style="display:none; margin-bottom:0.85rem;">
                    <label style="font-size:0.775rem; color:var(--text-muted); margin-bottom:0.35rem; display:block;">Upload sample media file</label>
                    
                    <div id="tpl-media-dropzone" class="file-dropzone">
                        <svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="var(--primary)" stroke-width="1.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>
                        <div style="font-size:0.85rem; color:var(--text-main); font-weight:600; margin-top:0.4rem;">Drag and drop to upload</div>
                        <div style="font-size:0.75rem; color:var(--primary); font-weight:500;">Or choose files on your device</div>
                        <input type="file" id="tpl-media-file-input" style="display:none;" accept="image/*,video/*,.pdf,.doc,.docx">
                    </div>

                    <!-- Uploaded Media File Bar with Thumbnail & Cross Remove Button -->
                    <div id="tpl-media-file-card" style="display:none; background:#e9eef6; border:1px solid #d3e3fd; padding:0.6rem 0.85rem; border-radius:8px; margin-top:0.5rem; align-items:center; justify-content:space-between; gap:0.5rem;">
                        <div style="display:flex; align-items:center; gap:0.6rem; overflow:hidden;">
                            <img id="tpl-media-file-thumb" style="width:28px; height:28px; object-fit:cover; border-radius:4px; display:none;" src="">
                            <span id="tpl-media-file-icon" style="font-size:1.1rem; display:inline-block;">📁</span>
                            <span id="tpl-media-file-name-text" style="font-weight:700; color:#1a73e8; font-size:0.825rem; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">filename.mp4</span>
                            <span id="tpl-media-file-size-text" style="font-size:0.75rem; color:#5f6368; white-space:nowrap;">(14,463K)</span>
                        </div>
                        <button type="button" id="btn-remove-media-file" style="background:none; border:none; cursor:pointer; font-size:1.25rem; color:#5f6368; padding:0 0.3rem; line-height:1; font-weight:bold;" title="Remove media file">&times;</button>
                    </div>
                </div>

                <!-- Header Text Group -->
                <div class="form-group" id="tpl-header-text-group" style="display:none; margin-bottom:0.85rem;">
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.25rem;">
                        <label for="tpl-header-text">Header · Optional</label>
                        <span id="tpl-header-count" style="font-size:0.725rem; color:var(--text-muted)">0/60</span>
                    </div>
                    <input type="text" id="tpl-header-text" placeholder="Add a short line of text to the header of your message" maxlength="60">
                    <div style="display:flex; justify-content:flex-end; margin-top:0.25rem;">
                        <button type="button" id="btn-add-header-var" class="btn secondary sm" style="font-size:0.725rem;">+ Add variable</button>
                    </div>
                </div>

                <!-- Body Group -->
                <div class="form-group" style="margin-bottom:0.85rem; position:relative;">
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.25rem;">
                        <label for="tpl-body">Body <span style="color:var(--danger)">*</span></label>
                        <span id="tpl-body-count" style="font-size:0.725rem; color:var(--text-muted)">0/1024</span>
                    </div>
                    <textarea id="tpl-body" rows="4" placeholder="${category === 'UTILITY' ? "Good news! Your order {{1}} has shipped! Here's your tracking information." : "Hello {{1}}, check out our fresh groceries now! Use code HEALTH to get 10% off."}" required maxlength="1024"></textarea>
                    
                    <div class="meta-editor-toolbar" style="display:flex; gap:0.35rem; align-items:center; margin-top:0.35rem; position:relative;">
                        <button type="button" class="btn secondary sm" id="btn-fmt-emoji" title="Add Emoji">😃</button>
                        <button type="button" class="btn secondary sm" id="btn-fmt-bold" title="Bold"><b>B</b></button>
                        <button type="button" class="btn secondary sm" id="btn-fmt-italic" title="Italic"><i>I</i></button>
                        <button type="button" class="btn secondary sm" id="btn-fmt-strike" title="Strikethrough"><s>S</s></button>
                        <button type="button" class="btn secondary sm" id="btn-fmt-code" title="Monospace">&lt;/&gt;</button>
                        <button type="button" id="btn-add-var" class="btn secondary sm" style="margin-left:auto; font-size:0.75rem;">+ Add variable ℹ</button>
                        
                        <!-- Emoji Popover -->
                        <div id="tpl-emoji-picker" class="emoji-picker-popover" style="display:none;">
                            <span class="emoji-picker-item">😊</span>
                            <span class="emoji-picker-item">👍</span>
                            <span class="emoji-picker-item">🛍️</span>
                            <span class="emoji-picker-item">🛒</span>
                            <span class="emoji-picker-item">📦</span>
                            <span class="emoji-picker-item">🔥</span>
                            <span class="emoji-picker-item">⚡</span>
                            <span class="emoji-picker-item">🎁</span>
                            <span class="emoji-picker-item">🚀</span>
                            <span class="emoji-picker-item">🎉</span>
                            <span class="emoji-picker-item">💯</span>
                            <span class="emoji-picker-item">📌</span>
                            <span class="emoji-picker-item">📢</span>
                            <span class="emoji-picker-item">🔑</span>
                            <span class="emoji-picker-item">💬</span>
                            <span class="emoji-picker-item">📞</span>
                            <span class="emoji-picker-item">📍</span>
                            <span class="emoji-picker-item">⭐</span>
                        </div>
                    </div>
                </div>

                <!-- Variable Samples Container -->
                <div id="tpl-samples-container" style="margin-bottom:0.85rem;"></div>

                <!-- Footer Group -->
                <div class="form-group">
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.25rem;">
                        <label for="tpl-footer">Footer · Optional</label>
                        <span id="tpl-footer-count" style="font-size:0.725rem; color:var(--text-muted)">0/60</span>
                    </div>
                    <input type="text" id="tpl-footer" placeholder="Add a short line of text to the bottom of your message" maxlength="60">
                </div>
            </div>

            <!-- Buttons Card -->
            <div class="card" style="padding:1rem; border:1px solid var(--border); background:var(--bg-sidebar); border-radius:8px; margin-top:1rem;">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.4rem;">
                    <div>
                        <h4 style="font-size:0.9rem; margin:0; color:var(--text-main);">Buttons · Optional</h4>
                        <p style="font-size:0.75rem; color:var(--text-muted); margin:0.2rem 0 0 0;">Create buttons that let customers respond to your message or take action (up to 10 total).</p>
                    </div>
                </div>
                
                <div class="tpl-btn-add-dropdown" style="margin-top:0.6rem; margin-bottom:0.75rem;">
                    <button type="button" id="btn-add-tpl-button-trigger" class="btn secondary sm" style="gap:0.4rem; font-weight:600;">
                        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                        <span>Add button ▾</span>
                    </button>
                    <div id="tpl-btn-add-menu" class="tpl-btn-add-menu">
                        <div class="tpl-btn-add-menu-item" data-type="QUICK_REPLY">
                            <span>💬 Custom (Quick reply)</span>
                            <span style="font-size:0.7rem; color:var(--text-muted);">Up to 10</span>
                        </div>
                        <div class="tpl-btn-add-menu-item" data-type="URL">
                            <span>🔗 Visit website</span>
                            <span style="font-size:0.7rem; color:var(--primary); font-weight:600;">Max 2</span>
                        </div>
                        <div class="tpl-btn-add-menu-item" data-type="PHONE_NUMBER">
                            <span>📞 Call Phone Number</span>
                            <span style="font-size:0.7rem; color:var(--text-muted);">Max 1</span>
                        </div>
                        <div class="tpl-btn-add-menu-item" data-type="COPY_CODE">
                            <span>📋 Copy offer code</span>
                            <span style="font-size:0.7rem; color:var(--text-muted);">Max 1</span>
                        </div>
                    </div>
                </div>

                <div id="tpl-buttons-list" class="tpl-buttons-container"></div>
            </div>

            <!-- Message Validity Period Card (Utility templates only) -->
            ${category === 'UTILITY' ? `
            <div class="card" style="padding:1rem; border:1px solid var(--border); background:var(--bg-sidebar); border-radius:8px; margin-top:1rem;">
                <h4 style="font-size:0.9rem; margin-bottom:0.35rem; color:var(--text-main);">Message validity period</h4>
                <p style="font-size:0.775rem; color:var(--text-muted); margin-bottom:0.85rem; line-height:1.4;">
                    You can set a custom validity period that your utility message must be delivered by before it expires. If a message has not been delivered within this time frame, you will not be charged and your customer will not see the message.
                </p>
                <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:0.85rem; padding:0.6rem 0.85rem; background:var(--bg-card); border-radius:6px; border:1px solid var(--border);">
                    <span style="font-size:0.8rem; font-weight:600; color:var(--text-main);">Set custom validity period for your message</span>
                    <label class="switch-toggle" style="margin:0;">
                        <input type="checkbox" id="tpl-validity-toggle">
                        <span class="slider round"></span>
                    </label>
                </div>
                <div id="tpl-validity-select-group" class="form-group" style="display:none;">
                    <label for="tpl-validity-period" style="font-size:0.8rem;">Validity period <span title="Message expiration time limit">ℹ</span></label>
                    <select id="tpl-validity-period">
                        <option value="10_mins">10 minutes</option>
                        <option value="30_mins">30 minutes</option>
                        <option value="1_hour">1 hour</option>
                        <option value="3_hours">3 hours</option>
                        <option value="6_hours">6 hours</option>
                        <option value="12_hours" selected>12 hours</option>
                    </select>
                </div>
            </div>
            ` : ''}
        `;
    }

    form.innerHTML = html;

    // Attach Event Listeners to New Elements
    attachStep2FormListeners();
    updateLivePreview();
}

// Global Dynamic Button Builder Helpers
function addTemplateButton(type, data = {}) {
    const list = document.getElementById('tpl-buttons-list');
    if (!list) return;

    const rows = list.querySelectorAll('.tpl-btn-row');
    if (rows.length >= 10) {
        showModal('Button Limit Reached', 'WhatsApp templates support up to 10 buttons maximum.');
        return;
    }

    const typeCounts = { QUICK_REPLY: 0, URL: 0, PHONE_NUMBER: 0, COPY_CODE: 0 };
    rows.forEach(r => {
        const t = r.dataset.type;
        if (typeCounts[t] !== undefined) typeCounts[t]++;
    });

    if (type === 'URL' && typeCounts.URL >= 2) {
        showModal('Limit Reached', 'WhatsApp templates support a maximum of 2 "Visit website" buttons.');
        return;
    }
    if (type === 'PHONE_NUMBER' && typeCounts.PHONE_NUMBER >= 1) {
        showModal('Limit Reached', 'WhatsApp templates support a maximum of 1 "Call Phone Number" button.');
        return;
    }
    if (type === 'COPY_CODE' && typeCounts.COPY_CODE >= 1) {
        showModal('Limit Reached', 'WhatsApp templates support a maximum of 1 "Copy offer code" button.');
        return;
    }

    const rowId = 'btn-row-' + Date.now() + '-' + Math.floor(Math.random() * 1000);
    const row = document.createElement('div');
    row.className = 'tpl-btn-row';
    row.dataset.type = type;
    row.id = rowId;
    row.style.cssText = 'background:var(--bg-card); border:1px solid var(--border); padding:0.75rem; border-radius:8px; margin-bottom:0.6rem; position:relative;';

    let title = '💬 Custom Quick Reply';
    let fieldsHtml = '';

    if (type === 'QUICK_REPLY') {
        title = '💬 Custom Quick Reply';
        const val = data.text || '';
        fieldsHtml = `
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.4rem;">
                <span style="font-size:0.8rem; font-weight:600; color:var(--text-main);">${title}</span>
                <button type="button" class="btn danger sm" onclick="removeTemplateButton('${rowId}')" style="padding:0.2rem 0.4rem; font-size:0.7rem;">Remove</button>
            </div>
            <input type="text" class="btn-text-input" value="${val.replace(/"/g, '&quot;')}" placeholder="Button text (e.g. Stop promotions)" maxlength="25" style="width:100%;">
        `;
    } else if (type === 'URL') {
        title = '🔗 Visit website (Max 2)';
        const valText = data.text || '';
        const valUrl = data.url || '';
        fieldsHtml = `
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.4rem;">
                <span style="font-size:0.8rem; font-weight:600; color:var(--text-main);">${title}</span>
                <button type="button" class="btn danger sm" onclick="removeTemplateButton('${rowId}')" style="padding:0.2rem 0.4rem; font-size:0.7rem;">Remove</button>
            </div>
            <div style="display:flex; gap:0.5rem; flex-wrap:wrap;">
                <input type="text" class="btn-text-input" value="${valText.replace(/"/g, '&quot;')}" placeholder="Button text (e.g. Shop Now)" maxlength="25" style="flex:1; min-width:130px;">
                <input type="url" class="btn-url-input" value="${valUrl.replace(/"/g, '&quot;')}" placeholder="https://example.com/offer" style="flex:2; min-width:180px;">
            </div>
        `;
    } else if (type === 'PHONE_NUMBER') {
        title = '📞 Call Phone Number';
        const valText = data.text || '';
        const valPhone = data.phone || data.phone_number || '';
        fieldsHtml = `
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.4rem;">
                <span style="font-size:0.8rem; font-weight:600; color:var(--text-main);">${title}</span>
                <button type="button" class="btn danger sm" onclick="removeTemplateButton('${rowId}')" style="padding:0.2rem 0.4rem; font-size:0.7rem;">Remove</button>
            </div>
            <div style="display:flex; gap:0.5rem; flex-wrap:wrap;">
                <input type="text" class="btn-text-input" value="${valText.replace(/"/g, '&quot;')}" placeholder="Button text (e.g. Call Us)" maxlength="25" style="flex:1; min-width:130px;">
                <input type="tel" class="btn-phone-input" value="${valPhone.replace(/"/g, '&quot;')}" placeholder="+919876543210" style="flex:1; min-width:140px;">
            </div>
        `;
    } else if (type === 'COPY_CODE') {
        title = '📋 Copy offer code';
        const valCode = data.code || data.example || '';
        fieldsHtml = `
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.4rem;">
                <span style="font-size:0.8rem; font-weight:600; color:var(--text-main);">${title}</span>
                <button type="button" class="btn danger sm" onclick="removeTemplateButton('${rowId}')" style="padding:0.2rem 0.4rem; font-size:0.7rem;">Remove</button>
            </div>
            <div style="display:flex; gap:0.5rem; flex-wrap:wrap;">
                <input type="text" class="btn-text-input" value="Copy code" placeholder="Button label (e.g. Copy Code)" maxlength="25" style="flex:1; min-width:130px;">
                <input type="text" class="btn-code-input" value="${valCode.replace(/"/g, '&quot;')}" placeholder="Sample coupon (e.g. OFFER25)" maxlength="15" style="flex:1; min-width:130px;">
            </div>
        `;
    }

    row.innerHTML = fieldsHtml;
    list.appendChild(row);

    row.querySelectorAll('input').forEach(input => {
        input.addEventListener('input', updateLivePreview);
    });

    updateLivePreview();
}

function removeTemplateButton(id) {
    const row = document.getElementById(id);
    if (row) {
        row.remove();
        updateLivePreview();
    }
}
window.addTemplateButton = addTemplateButton;
window.removeTemplateButton = removeTemplateButton;

// Global Media & Variable State
let currentMediaSampleFile = null;
let currentMediaSampleUrl = null;

function attachStep2FormListeners() {
    const nameInput = document.getElementById('tpl-name');
    nameInput?.addEventListener('input', (e) => {
        e.target.value = e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '_');
        updateBannerTitle();
        updateLivePreview();
    });

    // Language change listener
    document.getElementById('tpl-lang')?.addEventListener('change', () => {
        updateBannerTitle();
        updateLivePreview();
    });

    // Type of variable listener
    document.getElementById('tpl-var-type')?.addEventListener('change', () => {
        updateLivePreview();
    });

    // Media sample / Header type dropdown listener
    document.getElementById('tpl-header-type')?.addEventListener('change', (e) => {
        const val = e.target.value;
        const textGroup = document.getElementById('tpl-header-text-group');
        const mediaGroup = document.getElementById('tpl-media-dropzone-wrapper');

        if (textGroup) textGroup.style.display = val === 'TEXT' ? 'block' : 'none';
        if (mediaGroup) mediaGroup.style.display = ['IMAGE', 'VIDEO', 'DOCUMENT'].includes(val) ? 'block' : 'none';

        updateLivePreview();
    });

    // Media Dropzone & File Input listeners
    const dropzone = document.getElementById('tpl-media-dropzone');
    const fileInput = document.getElementById('tpl-media-file-input');
    const fileCardEl = document.getElementById('tpl-media-file-card');
    const fileNameTextEl = document.getElementById('tpl-media-file-name-text');
    const fileSizeTextEl = document.getElementById('tpl-media-file-size-text');

    if (dropzone && fileInput) {
        dropzone.addEventListener('click', () => fileInput.click());

        dropzone.addEventListener('dragover', (e) => {
            e.preventDefault();
            dropzone.classList.add('dragover');
        });

        dropzone.addEventListener('dragleave', () => {
            dropzone.classList.remove('dragover');
        });

        dropzone.addEventListener('drop', (e) => {
            e.preventDefault();
            dropzone.classList.remove('dragover');
            if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                handleMediaFileSelected(e.dataTransfer.files[0]);
            }
        });

        fileInput.addEventListener('change', (e) => {
            if (e.target.files && e.target.files[0]) {
                handleMediaFileSelected(e.target.files[0]);
            }
        });
    }

    document.getElementById('btn-remove-media-file')?.addEventListener('click', (e) => {
        e.stopPropagation();
        removeMediaFile();
    });

    function handleMediaFileSelected(file) {
        currentMediaSampleFile = file;
        currentMediaSampleUrl = URL.createObjectURL(file);
        
        const mediaThumbEl = document.getElementById('tpl-media-file-thumb');
        const mediaIconEl = document.getElementById('tpl-media-file-icon');

        if (fileNameTextEl) fileNameTextEl.textContent = file.name;
        if (fileSizeTextEl) fileSizeTextEl.textContent = `(${(file.size / 1024).toFixed(0)}K)`;

        if (file.type.startsWith('image/')) {
            if (mediaThumbEl) {
                mediaThumbEl.src = currentMediaSampleUrl;
                mediaThumbEl.style.display = 'block';
            }
            if (mediaIconEl) mediaIconEl.style.display = 'none';
        } else if (file.type.startsWith('video/')) {
            if (mediaThumbEl) mediaThumbEl.style.display = 'none';
            if (mediaIconEl) {
                mediaIconEl.textContent = '🎥';
                mediaIconEl.style.display = 'inline-block';
            }
        } else {
            if (mediaThumbEl) mediaThumbEl.style.display = 'none';
            if (mediaIconEl) {
                mediaIconEl.textContent = '📄';
                mediaIconEl.style.display = 'inline-block';
            }
        }

        if (dropzone) dropzone.style.display = 'none';
        if (fileCardEl) fileCardEl.style.display = 'flex';

        updateLivePreview();
    }

    function removeMediaFile() {
        currentMediaSampleFile = null;
        if (currentMediaSampleUrl) {
            URL.revokeObjectURL(currentMediaSampleUrl);
            currentMediaSampleUrl = null;
        }

        if (fileInput) fileInput.value = '';

        if (fileCardEl) fileCardEl.style.display = 'none';
        if (dropzone) dropzone.style.display = 'block';

        updateLivePreview();
    }

    // Header Text variable button
    document.getElementById('btn-add-header-var')?.addEventListener('click', () => {
        const headerEl = document.getElementById('tpl-header-text');
        if (!headerEl) return;
        const text = headerEl.value;
        if (text.includes('{{1}}')) {
            alert('Meta only allows 1 variable in the header text.');
            return;
        }
        const start = headerEl.selectionStart || text.length;
        const end = headerEl.selectionEnd || text.length;
        headerEl.value = text.substring(0, start) + '{{1}}' + text.substring(end);
        headerEl.focus();
        updateLivePreview();
    });

    // Utility validity period toggle listener
    document.getElementById('tpl-validity-toggle')?.addEventListener('change', (e) => {
        const selectGroup = document.getElementById('tpl-validity-select-group');
        if (selectGroup) selectGroup.style.display = e.target.checked ? 'block' : 'none';
    });

    // Inputs listeners for live preview & sample inputs refresh
    document.getElementById('tpl-header-text')?.addEventListener('input', updateLivePreview);
    document.getElementById('tpl-body')?.addEventListener('input', updateLivePreview);
    document.getElementById('tpl-footer')?.addEventListener('input', updateLivePreview);

    // Emoji Picker Trigger
    const emojiBtn = document.getElementById('btn-fmt-emoji');
    const emojiPicker = document.getElementById('tpl-emoji-picker');

    emojiBtn?.addEventListener('click', (e) => {
        e.stopPropagation();
        if (emojiPicker) {
            emojiPicker.style.display = emojiPicker.style.display === 'none' ? 'grid' : 'none';
        }
    });

    document.addEventListener('click', (e) => {
        if (emojiPicker && !emojiPicker.contains(e.target) && e.target !== emojiBtn) {
            emojiPicker.style.display = 'none';
        }
    });

    emojiPicker?.querySelectorAll('.emoji-picker-item').forEach(item => {
        item.addEventListener('click', (e) => {
            e.stopPropagation();
            const emoji = item.textContent;
            const bodyEl = document.getElementById('tpl-body');
            if (bodyEl) {
                const start = bodyEl.selectionStart || bodyEl.value.length;
                const end = bodyEl.selectionEnd || bodyEl.value.length;
                bodyEl.value = bodyEl.value.substring(0, start) + emoji + bodyEl.value.substring(end);
                bodyEl.focus();
                bodyEl.setSelectionRange(start + emoji.length, start + emoji.length);
                updateLivePreview();
            }
            emojiPicker.style.display = 'none';
        });
    });

    // Button Add Dropdown Trigger
    const triggerBtn = document.getElementById('btn-add-tpl-button-trigger');
    const menu = document.getElementById('tpl-btn-add-menu');

    triggerBtn?.addEventListener('click', (e) => {
        e.stopPropagation();
        menu?.classList.toggle('active');
    });

    document.addEventListener('click', () => {
        menu?.classList.remove('active');
    });

    menu?.querySelectorAll('.tpl-btn-add-menu-item').forEach(item => {
        item.addEventListener('click', (e) => {
            e.stopPropagation();
            if (item.classList.contains('disabled')) return;
            const type = item.dataset.type;
            menu.classList.remove('active');
            addTemplateButton(type);
        });
    });

    const applyFormat = (wrapChar, doubleWrap = false) => {
        const bodyEl = document.getElementById('tpl-body');
        if (!bodyEl) return;
        const start = bodyEl.selectionStart;
        const end = bodyEl.selectionEnd;
        const text = bodyEl.value;
        const selected = text.substring(start, end) || 'text';
        const wrapper = doubleWrap ? `${wrapChar}${wrapChar}${wrapChar}` : wrapChar;
        const replacement = `${wrapper}${selected}${wrapper}`;
        bodyEl.value = text.substring(0, start) + replacement + text.substring(end);
        bodyEl.focus();
        bodyEl.setSelectionRange(start + wrapper.length, start + wrapper.length + selected.length);
        updateLivePreview();
    };

    document.getElementById('btn-fmt-bold')?.addEventListener('click', () => applyFormat('*'));
    document.getElementById('btn-fmt-italic')?.addEventListener('click', () => applyFormat('_'));
    document.getElementById('btn-fmt-strike')?.addEventListener('click', () => applyFormat('~'));
    document.getElementById('btn-fmt-code')?.addEventListener('click', () => applyFormat('`', true));

    document.getElementById('btn-add-var')?.addEventListener('click', () => {
        const bodyEl = document.getElementById('tpl-body');
        if (!bodyEl) return;
        const text = bodyEl.value;
        const matches = text.match(/\{\{(\d+)\}\}/g) || [];
        const nextNum = matches.length + 1;
        const start = bodyEl.selectionStart || text.length;
        const end = bodyEl.selectionEnd || text.length;
        bodyEl.value = text.substring(0, start) + `{{${nextNum}}}` + text.substring(end);
        bodyEl.focus();
        updateLivePreview();
    });
}

function updateLivePreview() {
    const nameVal = document.getElementById('tpl-name')?.value || '';
    const varType = document.getElementById('tpl-var-type')?.value || 'TEXT';
    const headerType = document.getElementById('tpl-header-type')?.value || 'NONE';
    const headerTextVal = document.getElementById('tpl-header-text')?.value || '';
    const bodyVal = document.getElementById('tpl-body')?.value || '';
    const footerVal = document.getElementById('tpl-footer')?.value || '';

    // Update Counters
    const nameCountEl = document.getElementById('tpl-name-count');
    if (nameCountEl) nameCountEl.textContent = `${nameVal.length}/512`;

    const headerCountEl = document.getElementById('tpl-header-count');
    if (headerCountEl) headerCountEl.textContent = `${headerTextVal.length}/60`;

    const bodyCountEl = document.getElementById('tpl-body-count');
    if (bodyCountEl) bodyCountEl.textContent = `${bodyVal.length}/1024`;

    const footerCountEl = document.getElementById('tpl-footer-count');
    if (footerCountEl) footerCountEl.textContent = `${footerVal.length}/60`;

    // Refresh Variable Samples Input Box
    refreshVariableSampleFields(varType);

    // Collect Variable Samples Values
    const sampleValues = {};
    document.querySelectorAll('.tpl-var-sample-input').forEach(inp => {
        sampleValues[inp.dataset.varKey] = inp.value;
    });

    // Header Element
    const headerEl = document.getElementById('wa-preview-header');
    if (headerEl) {
        if (currentSelectedSubtype === 'catalogue') {
            headerEl.style.display = 'block';
            headerEl.innerHTML = `
                <div style="background:#f0f2f5; padding:0.6rem; border-radius:8px; display:flex; gap:0.5rem; align-items:center; margin-bottom:0.35rem;">
                    <div style="font-size:1.5rem;">🛍️</div>
                    <div style="font-size:0.75rem; text-align:left;">
                        <strong style="display:block; color:#111b21;">View Catalog on WhatsApp</strong>
                        <span style="color:#667781; font-size:0.68rem;">Browse pictures and details of our offerings.</span>
                    </div>
                </div>
            `;
        } else if (headerType === 'TEXT' && headerTextVal.trim()) {
            headerEl.style.display = 'block';
            let formattedHeader = headerTextVal;
            const headerSample = sampleValues['header_1'] || (varType === 'NUMBER' ? '123' : 'Sample Header');
            formattedHeader = formattedHeader.replace(/\{\{1\}\}/g, `<span style="background:rgba(0,168,132,0.15);color:#00a884;padding:0.1rem 0.35rem;border-radius:4px;font-weight:700;">${headerSample}</span>`);
            headerEl.innerHTML = formattedHeader;
        } else if (headerType === 'IMAGE') {
            headerEl.style.display = 'block';
            if (currentMediaSampleUrl) {
                headerEl.innerHTML = `<img src="${currentMediaSampleUrl}" style="width:100%; border-radius:10px; max-height:160px; object-fit:cover; margin-bottom:0.4rem; display:block;">`;
            } else {
                headerEl.innerHTML = `
                    <div style="background:#8f9ca8; border-radius:10px; height:140px; display:flex; align-items:center; justify-content:center; margin-bottom:0.4rem;">
                        <svg viewBox="0 0 24 24" width="56" height="56" fill="#ffffff"><path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z"/></svg>
                    </div>
                `;
            }
        } else if (headerType === 'VIDEO') {
            headerEl.style.display = 'block';
            if (currentMediaSampleUrl) {
                headerEl.innerHTML = `<video src="${currentMediaSampleUrl}" controls autoplay muted loop style="width:100%; border-radius:10px; max-height:160px; object-fit:cover; margin-bottom:0.4rem; display:block;"></video>`;
            } else {
                headerEl.innerHTML = `
                    <div style="background:#8f9ca8; border-radius:10px; height:140px; display:flex; align-items:center; justify-content:center; margin-bottom:0.4rem;">
                        <svg viewBox="0 0 24 24" width="64" height="64" fill="#ffffff"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 14.5v-9l6 4.5-6 4.5z"/></svg>
                    </div>
                `;
            }
        } else if (headerType === 'DOCUMENT') {
            headerEl.style.display = 'block';
            if (currentMediaSampleUrl) {
                headerEl.innerHTML = `
                    <div style="background:#f0f2f5; padding:0.75rem; border-radius:8px; display:flex; align-items:center; gap:0.6rem; margin-bottom:0.4rem; border:1px solid var(--border);">
                        <span style="font-size:1.5rem;">📄</span>
                        <div style="font-size:0.75rem; overflow:hidden;">
                            <strong style="display:block; color:#111b21; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${currentMediaSampleFile ? currentMediaSampleFile.name : 'Document.pdf'}</strong>
                            <span style="color:#667781; font-size:0.68rem;">PDF Document</span>
                        </div>
                    </div>
                `;
            } else {
                headerEl.innerHTML = `
                    <div style="background:#8f9ca8; border-radius:10px; height:100px; display:flex; align-items:center; justify-content:center; margin-bottom:0.4rem;">
                        <svg viewBox="0 0 24 24" width="48" height="48" fill="#ffffff"><path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z"/></svg>
                    </div>
                `;
            }
        } else if (headerType === 'LOCATION') {
            headerEl.style.display = 'block';
            headerEl.innerHTML = `
                <div style="background:#9ca3af; color:#ffffff; border-radius:10px; padding:1.25rem 0.85rem 0.75rem 0.85rem; text-align:center; position:relative; overflow:hidden; margin-bottom:0.4rem; box-shadow:0 1px 3px rgba(0,0,0,0.12);">
                    <div style="display:flex; justify-content:center; align-items:center; margin-bottom:0.6rem;">
                        <svg viewBox="0 0 24 24" width="52" height="52" fill="currentColor"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg>
                    </div>
                    <div style="text-align:left; background:rgba(0,0,0,0.22); padding:0.45rem 0.65rem; border-radius:6px; font-size:0.725rem; line-height:1.35;">
                        <div style="font-weight:700; color:#ffffff;">{{Location name}}</div>
                        <div style="font-size:0.68rem; color:rgba(255,255,255,0.85);">{{Address}}</div>
                    </div>
                </div>
            `;
        } else {
            headerEl.style.display = 'none';
        }
    }

    // Body Text Element
    const bodyEl = document.getElementById('wa-preview-body');
    if (bodyEl) {
        let textToDisplay = bodyVal.trim();
        
        if (!textToDisplay) {
            if (currentSelectedCategory === 'MARKETING') {
                if (currentSelectedSubtype === 'catalogue') {
                    textToDisplay = "Discover our latest products and bestsellers in our catalog. Browse and shop with ease on WhatsApp #happyshopping!";
                } else if (currentSelectedSubtype === 'calling_permissions') {
                    textToDisplay = "Can Jasper's Market call you?\n\nYou can update your preference anytime in the business profile.";
                } else {
                    textToDisplay = "Hey there! Check out our fresh groceries now!\n\nUse code HEALTH to get additional 10% off on your entire purchase.";
                }
            } else if (currentSelectedCategory === 'UTILITY') {
                if (currentSelectedSubtype === 'calling_permissions') {
                    textToDisplay = "Can Jasper's Market call you?\n\nYou can update your preference anytime in the business profile.";
                } else {
                    textToDisplay = "Good news! Your order {{1}} has shipped!\n\nHere's your tracking information, please check link below.";
                }
            } else if (currentSelectedCategory === 'AUTHENTICATION') {
                textToDisplay = "{{1}} is your verification code. For your security, do not share this code.";
            }
        }

        let formatted = textToDisplay.replace(/\{\{(\d+)\}\}/g, (match, p1) => {
            const sample = sampleValues[`body_${p1}`] || (varType === 'NUMBER' ? `{{${p1}}}` : `{{${p1}}}`);
            return `<span style="background:rgba(0,168,132,0.15);color:#00a884;padding:0.1rem 0.35rem;border-radius:4px;font-weight:700;">${sample}</span>`;
        });

        formatted = formatted
            .replace(/\*(.*?)\*/g, '<strong>$1</strong>')
            .replace(/_(.*?)_/g, '<em>$1</em>')
            .replace(/~(.*?)~/g, '<del>$1</del>')
            .replace(/```(.*?)```/g, '<code style="font-family:monospace;background:#f0f2f5;padding:0.1rem 0.3rem;border-radius:3px;">$1</code>');
        
        bodyEl.innerHTML = formatted;
    }

    // Footer Text Element
    const footerEl = document.getElementById('wa-preview-footer');
    if (footerEl) {
        if (footerVal.trim()) {
            footerEl.style.display = 'block';
            footerEl.textContent = footerVal;
        } else {
            footerEl.style.display = 'none';
        }
    }

    // Buttons Element Preview
    const buttonsEl = document.getElementById('wa-preview-buttons');
    if (buttonsEl) {
        if (currentSelectedSubtype === 'catalogue') {
            buttonsEl.style.display = 'flex';
            buttonsEl.innerHTML = `<div class="wa-btn-item">🛒 View catalog</div>`;
        } else if (currentSelectedSubtype === 'calling_permissions') {
            buttonsEl.style.display = 'flex';
            buttonsEl.innerHTML = `
                <div class="wa-btn-item" style="flex-direction:column; align-items:stretch; gap:0.4rem; background:#f8f9fa; border:1px solid #e9edef; padding:0.6rem; border-radius:8px;">
                    <div style="font-weight:700; color:#111b21; font-size:0.775rem;">Choose preference ˅</div>
                    <div style="font-size:0.725rem; color:#667781; display:flex; flex-direction:column; gap:0.25rem; text-align:left; margin-top:0.25rem;">
                        <div>🔘 Always allow calls</div>
                        <div>⚪ Temporarily allow calls</div>
                        <div>⚪ Not now</div>
                    </div>
                </div>
            `;
        } else if (currentSelectedCategory === 'AUTHENTICATION') {
            buttonsEl.style.display = 'flex';
            buttonsEl.innerHTML = `<div class="wa-btn-item">📋 Copy code</div>`;
        } else {
            const btnRows = document.querySelectorAll('#tpl-buttons-list .tpl-btn-row');
            if (btnRows.length > 0) {
                buttonsEl.style.display = 'flex';
                let previewHtml = '';
                btnRows.forEach(row => {
                    const type = row.dataset.type;
                    if (type === 'QUICK_REPLY') {
                        const txt = row.querySelector('.btn-text-input')?.value || 'Quick reply';
                        previewHtml += `<div class="wa-btn-item">💬 ${txt}</div>`;
                    } else if (type === 'URL') {
                        const txt = row.querySelector('.btn-text-input')?.value || 'Visit website';
                        previewHtml += `<div class="wa-btn-item">↗ ${txt}</div>`;
                    } else if (type === 'PHONE_NUMBER') {
                        const txt = row.querySelector('.btn-text-input')?.value || 'Call Us';
                        previewHtml += `<div class="wa-btn-item">📞 ${txt}</div>`;
                    } else if (type === 'COPY_CODE') {
                        const code = row.querySelector('.btn-code-input')?.value || 'OFFER25';
                        previewHtml += `<div class="wa-btn-item">📋 Copy code (${code})</div>`;
                    }
                });
                buttonsEl.innerHTML = previewHtml;
            } else if (currentSelectedCategory === 'UTILITY') {
                buttonsEl.style.display = 'flex';
                buttonsEl.innerHTML = `<div class="wa-btn-item">↗ Track shipment</div>`;
            } else if (currentSelectedCategory === 'MARKETING') {
                buttonsEl.style.display = 'flex';
                buttonsEl.innerHTML = `
                    <div class="wa-btn-item">↗ Shop now</div>
                    <div class="wa-btn-item">📋 Copy code</div>
                `;
            } else {
                buttonsEl.style.display = 'none';
            }
        }
    }

    // Good for summary
    const goodforEl = document.getElementById('wa-preview-goodfor');
    if (goodforEl) {
        if (currentSelectedCategory === 'MARKETING') {
            if (currentSelectedSubtype === 'catalogue') {
                goodforEl.textContent = 'Product/service discovery, sales, offers, targeted product catalog promotions.';
            } else if (currentSelectedSubtype === 'calling_permissions') {
                goodforEl.textContent = 'When you wish to call your customer directly on WhatsApp for service or consultation.';
            } else {
                goodforEl.textContent = 'Welcome messages, promotions, offers, coupons, customer engagement.';
            }
        } else if (currentSelectedCategory === 'UTILITY') {
            goodforEl.textContent = 'Order confirmations, shipping updates, receipts, account notifications.';
        } else {
            goodforEl.textContent = 'One-time passwords, account recovery codes, verification & login alerts.';
        }
    }
}

function refreshVariableSampleFields(varType = 'TEXT') {
    const container = document.getElementById('tpl-samples-container');
    if (!container) return;

    const headerText = document.getElementById('tpl-header-text')?.value || '';
    const bodyText = document.getElementById('tpl-body')?.value || '';

    const hasHeaderVar = headerText.includes('{{1}}');
    const bodyMatches = Array.from(new Set(bodyText.match(/\{\{(\d+)\}\}/g) || []));

    if (!hasHeaderVar && bodyMatches.length === 0) {
        container.innerHTML = '';
        container.style.display = 'none';
        return;
    }

    container.style.display = 'block';

    const existingValues = {};
    container.querySelectorAll('.tpl-var-sample-input').forEach(inp => {
        existingValues[inp.dataset.varKey] = inp.value;
    });

    let html = `
        <div class="tpl-sample-box">
            <h5 style="font-size:0.8rem; font-weight:600; margin:0 0 0.5rem 0; color:var(--text-main);">Samples for parameters</h5>
            <p style="font-size:0.725rem; color:var(--text-muted); margin-bottom:0.6rem;">To help Meta review your template, specify an example value for each variable.</p>
            <div style="display:flex; flex-direction:column; gap:0.5rem;">
    `;

    if (hasHeaderVar) {
        const val = existingValues['header_1'] || (varType === 'NUMBER' ? '123' : 'John');
        html += `
            <div style="display:flex; align-items:center; gap:0.5rem;">
                <label style="font-size:0.75rem; font-weight:600; width:120px; color:var(--primary);">Header {{1}}</label>
                <input type="text" class="tpl-var-sample-input" data-var-key="header_1" value="${val.replace(/"/g, '&quot;')}" placeholder="${varType === 'NUMBER' ? 'e.g. 123' : 'e.g. John'}" style="flex:1; padding:0.4rem 0.6rem; font-size:0.8rem;">
            </div>
        `;
    }

    bodyMatches.sort((a, b) => parseInt(a.replace(/\D/g, '')) - parseInt(b.replace(/\D/g, ''))).forEach(m => {
        const num = m.replace(/\D/g, '');
        const key = `body_${num}`;
        const defaultSample = varType === 'NUMBER' ? (100 * parseInt(num)).toString() : (num === '1' ? 'John' : num === '2' ? '10% OFF' : `Sample ${num}`);
        const val = existingValues[key] || defaultSample;
        html += `
            <div style="display:flex; align-items:center; gap:0.5rem;">
                <label style="font-size:0.75rem; font-weight:600; width:120px; color:var(--primary);">Body {{${num}}}</label>
                <input type="text" class="tpl-var-sample-input" data-var-key="${key}" value="${val.replace(/"/g, '&quot;')}" placeholder="${varType === 'NUMBER' ? `e.g. ${100 * parseInt(num)}` : `e.g. Sample ${num}`}" style="flex:1; padding:0.4rem 0.6rem; font-size:0.8rem;">
            </div>
        `;
    });

    html += `
            </div>
        </div>
    `;

    container.innerHTML = html;

    container.querySelectorAll('.tpl-var-sample-input').forEach(inp => {
        inp.addEventListener('input', () => {
            const sampleValues = {};
            container.querySelectorAll('.tpl-var-sample-input').forEach(i => {
                sampleValues[i.dataset.varKey] = i.value;
            });

            const headerEl = document.getElementById('wa-preview-header');
            const headerType = document.getElementById('tpl-header-type')?.value;
            const headerTextVal = document.getElementById('tpl-header-text')?.value || '';
            if (headerEl && headerType === 'TEXT' && headerTextVal.trim()) {
                const headerSample = sampleValues['header_1'] || (varType === 'NUMBER' ? '123' : 'Sample Header');
                headerEl.innerHTML = headerTextVal.replace(/\{\{1\}\}/g, `<span style="background:rgba(0,168,132,0.15);color:#00a884;padding:0.1rem 0.35rem;border-radius:4px;font-weight:700;">${headerSample}</span>`);
            }

            const bodyEl = document.getElementById('wa-preview-body');
            const bodyVal = document.getElementById('tpl-body')?.value || '';
            if (bodyEl && bodyVal.trim()) {
                let formatted = bodyVal.replace(/\{\{(\d+)\}\}/g, (match, p1) => {
                    const sample = sampleValues[`body_${p1}`] || (varType === 'NUMBER' ? `{{${p1}}}` : `{{${p1}}}`);
                    return `<span style="background:rgba(0,168,132,0.15);color:#00a884;padding:0.1rem 0.35rem;border-radius:4px;font-weight:700;">${sample}</span>`;
                });
                formatted = formatted
                    .replace(/\*(.*?)\*/g, '<strong>$1</strong>')
                    .replace(/_(.*?)_/g, '<em>$1</em>')
                    .replace(/~(.*?)~/g, '<del>$1</del>')
                    .replace(/```(.*?)```/g, '<code style="font-family:monospace;background:#f0f2f5;padding:0.1rem 0.3rem;border-radius:3px;">$1</code>');
                bodyEl.innerHTML = formatted;
            }
        });
    });
}

function resetTemplateModal() {
    editingTemplateId = null;
    currentSelectedCategory = 'MARKETING';
    currentSelectedSubtype = 'default';
    currentMediaSampleFile = null;
    if (currentMediaSampleUrl) {
        URL.revokeObjectURL(currentMediaSampleUrl);
        currentMediaSampleUrl = null;
    }
    const mediaFileInput = document.getElementById('tpl-media-file-input');
    if (mediaFileInput) mediaFileInput.value = '';
    const mediaFileCard = document.getElementById('tpl-media-file-card');
    if (mediaFileCard) mediaFileCard.style.display = 'none';
    const mediaDropzone = document.getElementById('tpl-media-dropzone');
    if (mediaDropzone) mediaDropzone.style.display = 'flex';

    // Reset Category Tabs UI
    document.querySelectorAll('.meta-tabs .tab-btn').forEach(b => {
        if (b.getAttribute('data-category') === 'MARKETING') b.classList.add('active');
        else b.classList.remove('active');
    });

    // Reset Submit Button
    const submitBtn = document.getElementById('btn-submit-tpl');
    if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = 'Submit Template to Meta';
    }

    // Reset Name Input
    const nameInput = document.getElementById('tpl-name');
    if (nameInput) {
        nameInput.disabled = false;
        nameInput.value = '';
    }

    // Reset Header, Body, Footer Inputs
    const headerText = document.getElementById('tpl-header-text');
    if (headerText) headerText.value = '';
    const headerType = document.getElementById('tpl-header-type');
    if (headerType) headerType.value = 'NONE';
    const bodyInput = document.getElementById('tpl-body');
    if (bodyInput) bodyInput.value = '';
    const footerInput = document.getElementById('tpl-footer');
    if (footerInput) footerInput.value = '';

    // Clear Dynamic Buttons List
    const listContainer = document.getElementById('tpl-buttons-list');
    if (listContainer) listContainer.innerHTML = '';

    // Reset Language Select
    const langSelect = document.getElementById('tpl-lang');
    if (langSelect) langSelect.value = 'en';

    // Reset Banner Title
    const bannerTitle = document.getElementById('tpl-banner-title');
    if (bannerTitle) bannerTitle.textContent = 'your_template_name • English';
}

function openTemplateModal() {
    const modal = document.getElementById('template-create-modal');
    if (modal) {
        resetTemplateModal();
        modal.classList.remove('hidden');
        modal.style.display = 'flex';
        if (typeof goToStep === 'function') goToStep(1);
        if (typeof renderSubtypes === 'function') renderSubtypes(currentSelectedCategory);
        if (typeof updateLivePreview === 'function') updateLivePreview();
    }
}

function closeTemplateModal() {
    const modal = document.getElementById('template-create-modal');
    if (modal) {
        modal.classList.add('hidden');
        modal.style.display = 'none';
        resetTemplateModal();
    }
}

window.resetTemplateModal = resetTemplateModal;
window.openTemplateModal = openTemplateModal;
window.closeTemplateModal = closeTemplateModal;

// Modal Event Listeners Setup
document.addEventListener('DOMContentLoaded', () => {
    const modal = document.getElementById('template-create-modal');
    const openBtn = document.getElementById('btn-create-template');
    const closeBtn = document.getElementById('close-template-modal');
    const discardBtn = document.getElementById('btn-discard-tpl');

    openBtn?.addEventListener('click', openTemplateModal);
    closeBtn?.addEventListener('click', closeTemplateModal);
    discardBtn?.addEventListener('click', closeTemplateModal);

    document.getElementById('btn-next-step')?.addEventListener('click', () => {
        goToStep(2);
    });

    document.getElementById('btn-prev-step')?.addEventListener('click', () => {
        goToStep(1);
    });

    // Category Tabs
    document.querySelectorAll('.meta-tabs .tab-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            document.querySelectorAll('.meta-tabs .tab-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentSelectedCategory = btn.getAttribute('data-category');
            renderSubtypes(currentSelectedCategory);
            updateLivePreview();
        });
    });

    // Auto-sanitize Template Name
    const nameInput = document.getElementById('tpl-name');
    nameInput?.addEventListener('input', (e) => {
        e.target.value = e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '_');
        updateLivePreview();
    });

    // Header Format Change
    document.getElementById('tpl-header-type')?.addEventListener('change', (e) => {
        const type = e.target.value;
        const textGroup = document.getElementById('tpl-header-text-group');
        if (textGroup) textGroup.style.display = type === 'TEXT' ? 'block' : 'none';
        updateLivePreview();
    });

    // Header Text, Body, Footer Input Handlers
    document.getElementById('tpl-header-text')?.addEventListener('input', updateLivePreview);
    document.getElementById('tpl-body')?.addEventListener('input', updateLivePreview);
    document.getElementById('tpl-footer')?.addEventListener('input', updateLivePreview);

    // Formatting Toolbar Helpers (*bold*, _italic_, ~strike~, ```code```)
    const applyFormat = (wrapChar, doubleWrap = false) => {
        const bodyEl = document.getElementById('tpl-body');
        if (!bodyEl) return;
        const start = bodyEl.selectionStart;
        const end = bodyEl.selectionEnd;
        const text = bodyEl.value;
        const selected = text.substring(start, end) || 'text';
        const wrapper = doubleWrap ? `${wrapChar}${wrapChar}${wrapChar}` : wrapChar;
        const replacement = `${wrapper}${selected}${wrapper}`;
        bodyEl.value = text.substring(0, start) + replacement + text.substring(end);
        bodyEl.focus();
        bodyEl.setSelectionRange(start + wrapper.length, start + wrapper.length + selected.length);
        updateLivePreview();
    };

    document.getElementById('btn-fmt-bold')?.addEventListener('click', () => applyFormat('*'));
    document.getElementById('btn-fmt-italic')?.addEventListener('click', () => applyFormat('_'));
    document.getElementById('btn-fmt-strike')?.addEventListener('click', () => applyFormat('~'));
    document.getElementById('btn-fmt-code')?.addEventListener('click', () => applyFormat('`', true));

    // Add Variable Helper
    document.getElementById('btn-add-var')?.addEventListener('click', () => {
        const bodyEl = document.getElementById('tpl-body');
        if (!bodyEl) return;
        
        const text = bodyEl.value;
        const matches = text.match(/\{\{(\d+)\}\}/g) || [];
        const nextNum = matches.length + 1;
        
        const start = bodyEl.selectionStart || text.length;
        const end = bodyEl.selectionEnd || text.length;
        bodyEl.value = text.substring(0, start) + `{{${nextNum}}}` + text.substring(end);
        bodyEl.focus();
        updateLivePreview();
    });

    // Button Type Select
    document.getElementById('tpl-button-type')?.addEventListener('change', (e) => {
        updateButtonInputs(e.target.value);
    });

    // Submit Template for Review
    document.getElementById('btn-submit-tpl')?.addEventListener('click', async () => {
        const name = document.getElementById('tpl-name')?.value.trim();
        const lang = document.getElementById('tpl-lang')?.value;
        const category = currentSelectedCategory;
        const headerType = document.getElementById('tpl-header-type')?.value;
        const headerText = document.getElementById('tpl-header-text')?.value.trim();
        const bodyText = document.getElementById('tpl-body')?.value.trim();
        const footerText = document.getElementById('tpl-footer')?.value.trim();
        const buttonType = document.getElementById('tpl-button-type')?.value;

        if (!name) {
            showModal('Validation Error', 'Please enter a valid template name.');
            return;
        }

        if (!bodyText) {
            showModal('Validation Error', 'Body text is required for WhatsApp templates.');
            return;
        }

        // Validate Zero-Tap Consent Box if Zero-Tap is selected
        if (category === 'AUTHENTICATION') {
            const otpRadio = document.querySelector('input[name="otp-type"]:checked')?.value;
            const consentCb = document.getElementById('zt-consent-cb');
            const errBanner = document.getElementById('zt-consent-error');
            
            if (otpRadio === 'zero_tap' && consentCb && !consentCb.checked) {
                if (errBanner) errBanner.style.display = 'flex';
                return;
            } else if (errBanner) {
                errBanner.style.display = 'none';
            }
        }

        // Construct Meta Components Array
        const components = [];

        // Header Component
        if (headerType === 'TEXT' && headerText) {
            const headerComp = {
                type: 'HEADER',
                format: 'TEXT',
                text: headerText
            };
            const hPosMatches = [...headerText.matchAll(/\{\{(\d+)\}\}/g)];
            const hNamedMatches = [...headerText.matchAll(/\{\{([a-zA-Z_][a-zA-Z0-9_]*)\}\}/g)];
            if (hPosMatches.length > 0) {
                headerComp.example = { header_text: ["Sample Header"] };
            } else if (hNamedMatches.length > 0) {
                headerComp.example = {
                    header_text_named_params: [{
                        param_name: hNamedMatches[0][1],
                        example: "Sample Header"
                    }]
                };
            }
            components.push(headerComp);
        } else if (['IMAGE', 'VIDEO', 'DOCUMENT'].includes(headerType)) {
            let handle = null;

            if (currentMediaSampleFile) {
                try {
                    handle = await getMetaHeaderHandle(currentMediaSampleFile);
                } catch (err) {
                    console.error('Sample media upload error:', err);
                    showModal('Sample Media Upload Error', `Failed to upload sample ${headerType.toLowerCase()} to Meta: ${err.message}. Please select the file again.`);
                    return;
                }
            } else if (editingTemplateId && typeof templatesCache !== 'undefined') {
                const tpl = templatesCache.find(t => String(t.id || t.name) === String(editingTemplateId));
                const oldHeader = tpl?.components?.find(c => c.type === 'HEADER');
                if (oldHeader?.example?.header_handle?.[0]) {
                    handle = oldHeader.example.header_handle[0];
                }
            }

            if (!handle) {
                showModal('Sample File Required', `Meta requires a sample ${headerType.toLowerCase()} file for template verification. Please drag & drop or select a sample ${headerType.toLowerCase()} file in the "Upload sample media file" box.`);
                return;
            }

            components.push({
                type: 'HEADER',
                format: headerType,
                example: { header_handle: [handle] }
            });
        } else if (headerType === 'LOCATION') {
            components.push({
                type: 'HEADER',
                format: 'LOCATION'
            });
        }

        // Body Component supporting both named (e.g. {{customer_name}}) and positional (e.g. {{1}}) variables
        const bodyComp = {
            type: 'BODY',
            text: bodyText
        };

        const posMatches = [...bodyText.matchAll(/\{\{(\d+)\}\}/g)];
        const namedMatches = [...bodyText.matchAll(/\{\{([a-zA-Z_][a-zA-Z0-9_]*)\}\}/g)];

        let parameterFormat = null;
        if (posMatches.length > 0) {
            parameterFormat = 'POSITIONAL';
            const seen = new Set();
            const samples = [];
            posMatches.forEach((m, idx) => {
                const num = m[1];
                if (!seen.has(num)) {
                    seen.add(num);
                    const domSample = document.querySelector(`input[data-var="${num}"], input[name="var_${num}"]`)?.value.trim();
                    samples.push(domSample || `Sample_${idx + 1}`);
                }
            });
            bodyComp.example = { body_text: [samples] };
        } else if (namedMatches.length > 0) {
            parameterFormat = 'NAMED';
            const seen = new Set();
            const namedParams = [];
            namedMatches.forEach(m => {
                const paramName = m[1];
                if (!seen.has(paramName)) {
                    seen.add(paramName);
                    const domSample = document.querySelector(`input[data-var="${paramName}"], input[name="var_${paramName}"]`)?.value.trim();
                    const defaultVal = paramName.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
                    namedParams.push({
                        param_name: paramName,
                        example: domSample || defaultVal
                    });
                }
            });
            bodyComp.example = { body_text_named_params: namedParams };
        }

        components.push(bodyComp);

        // Footer Component
        if (footerText) {
            components.push({
                type: 'FOOTER',
                text: footerText
            });
        }

        // Buttons Component (Collected dynamically from #tpl-buttons-list or category type)
        const buttonRows = document.querySelectorAll('#tpl-buttons-list .tpl-btn-row');
        const buttonsArray = [];

        buttonRows.forEach(row => {
            const type = row.dataset.type;
            if (type === 'QUICK_REPLY') {
                const text = row.querySelector('.btn-text-input')?.value.trim();
                if (text) buttonsArray.push({ type: 'QUICK_REPLY', text });
            } else if (type === 'URL') {
                const text = row.querySelector('.btn-text-input')?.value.trim();
                const url = row.querySelector('.btn-url-input')?.value.trim();
                if (text && url) buttonsArray.push({ type: 'URL', text, url });
            } else if (type === 'PHONE_NUMBER') {
                const text = row.querySelector('.btn-text-input')?.value.trim();
                const phone = row.querySelector('.btn-phone-input')?.value.trim();
                if (text && phone) buttonsArray.push({ type: 'PHONE_NUMBER', text, phone_number: phone });
            } else if (type === 'COPY_CODE') {
                const code = row.querySelector('.btn-code-input')?.value.trim();
                if (code) buttonsArray.push({ type: 'COPY_CODE', example: code });
            }
        });

        if (buttonsArray.length > 0) {
            components.push({
                type: 'BUTTONS',
                buttons: buttonsArray
            });
        } else if (category === 'AUTHENTICATION') {
            const otpType = document.querySelector('input[name="otp-type"]:checked')?.value || 'copy_code';
            if (otpType === 'copy_code') {
                components.push({
                    type: 'BUTTONS',
                    buttons: [{ type: 'OTP', otp_type: 'COPY_CODE', text: 'Copy Code' }]
                });
            } else {
                const pkgInputs = document.querySelectorAll('#template-builder-form input[type="text"]');
                let pkgName = 'com.example.myapplication';
                let sigHash = '1234567890a';
                pkgInputs.forEach(inp => {
                    if (inp.placeholder && inp.placeholder.includes('com.example')) pkgName = inp.value.trim() || pkgName;
                    if (inp.placeholder && inp.placeholder.includes('11-char')) sigHash = inp.value.trim() || sigHash;
                });
                components.push({
                    type: 'BUTTONS',
                    buttons: [{
                        type: 'OTP',
                        otp_type: otpType.toUpperCase(),
                        title: 'Copy Code',
                        autofill_text: 'Autofill',
                        package_name: pkgName,
                        signature_hash: sigHash
                    }]
                });
            }
        } else if (currentSelectedSubtype === 'catalogue') {
            components.push({
                type: 'BUTTONS',
                buttons: [{ type: 'CATALOG' }]
            });
        }

        const submitBtn = document.getElementById('btn-submit-tpl');
        const origBtnText = submitBtn ? (submitBtn.dataset.origText || submitBtn.innerHTML) : 'Submit Template to Meta';
        if (submitBtn) {
            submitBtn.dataset.origText = origBtnText;
            submitBtn.disabled = true;
            submitBtn.style.opacity = '0.6';
            submitBtn.style.pointerEvents = 'none';
            submitBtn.innerHTML = '<span class="spinner"></span> Submitting to Meta...';
        }

        try {
            const isEdit = !!editingTemplateId;
            const endpoint = isEdit ? `/api/templates?action=edit&id=${editingTemplateId}` : '/api/templates';
            const method = isEdit ? 'PUT' : 'POST';

            const payloadObj = {
                id: editingTemplateId,
                name,
                category,
                language: lang,
                components,
                is_edit: isEdit
            };
            if (parameterFormat) {
                payloadObj.parameter_format = parameterFormat;
            }

            const res = await fetch(endpoint, {
                method: method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payloadObj)
            });

            const data = await res.json();

            if (data.error) {
                if (submitBtn) {
                    submitBtn.disabled = false;
                    submitBtn.style.opacity = '1';
                    submitBtn.style.pointerEvents = 'auto';
                    submitBtn.innerHTML = origBtnText;
                }
                showModal('Meta Submission Error', data.error);
            } else {
                closeTemplateModal();
                editingTemplateId = null;
                const nameInput = document.getElementById('tpl-name');
                if (nameInput) nameInput.disabled = false;
                if (submitBtn) {
                    submitBtn.disabled = false;
                    submitBtn.style.opacity = '1';
                    submitBtn.style.pointerEvents = 'auto';
                    submitBtn.innerHTML = origBtnText;
                }
                showModal('Success!', isEdit ? `Template "${name}" updated in Meta Cloud API successfully!` : `Template "${name}" created and submitted to Meta for review successfully! Status: ${data.template?.status || 'PENDING'}`);
                loadTemplates();
            }
        } catch (err) {
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.style.opacity = '1';
                submitBtn.style.pointerEvents = 'auto';
                submitBtn.innerHTML = origBtnText;
            }
            showModal('Error', 'Failed to connect to template API: ' + err.message);
        }
    });
});



// --- Broadcast Logic ---
const bcDisplay = document.getElementById('bc-target-display');
const bcOptions = document.getElementById('bc-target-options');

bcDisplay?.addEventListener('click', () => {
    bcOptions?.classList.toggle('active');
});

document.addEventListener('click', (e) => {
    if(bcDisplay && !bcDisplay.contains(e.target) && !bcOptions?.contains(e.target)) {
        bcOptions?.classList.remove('active');
    }
});

document.getElementById('btn-bc-target-done')?.addEventListener('click', () => {
    bcOptions?.classList.remove('active');
});

let broadcastCustomersCache = [];
let activeBroadcastRangeFilter = null; // { start: number, end: number, label: string }

// Dynamic customer range generator based on total audience size
function generateCustomerRanges(totalCount) {
    if (!totalCount || totalCount <= 0) return [];
    const ranges = [];
    const step = 250;

    // Standard 250-sized chunks (1 - 250, 251 - 500, etc.)
    for (let start = 1; start <= totalCount; start += step) {
        const end = Math.min(start + step - 1, totalCount);
        ranges.push({
            start,
            end,
            label: `${start} to ${end}`,
            count: end - start + 1
        });
    }

    return ranges;
}

// Populate Range Selector in Top Bar & Chips inside Dropdown
function populateBroadcastRangeOptions() {
    const sel = document.getElementById('bc-range-filter-select');
    const chipsContainer = document.getElementById('bc-range-chips-container');
    const totalCount = broadcastCustomersCache.length;

    const ranges = generateCustomerRanges(totalCount);

    if (sel) {
        sel.innerHTML = `<option value="">-- All Customers (1 to ${totalCount}) --</option>`;
        ranges.forEach(r => {
            const opt = document.createElement('option');
            opt.value = `${r.start}-${r.end}`;
            opt.textContent = `Range ${r.label} (${r.count} Customers)`;
            if (activeBroadcastRangeFilter && activeBroadcastRangeFilter.start === r.start && activeBroadcastRangeFilter.end === r.end) {
                opt.selected = true;
            }
            sel.appendChild(opt);
        });
    }

    if (chipsContainer) {
        chipsContainer.innerHTML = '';

        // "All (1 - N)" Chip
        const allChip = document.createElement('button');
        allChip.type = 'button';
        const isAllActive = !activeBroadcastRangeFilter;
        allChip.className = `btn sm ${isAllActive ? 'primary' : 'secondary'}`;
        allChip.style.cssText = 'padding: 0.2rem 0.55rem; font-size: 0.725rem; border-radius: 999px; white-space: nowrap; flex-shrink: 0;';
        allChip.innerHTML = `All (1 - ${totalCount})`;
        allChip.onclick = () => clearBroadcastRangeFilter();
        chipsContainer.appendChild(allChip);

        ranges.forEach(r => {
            const isActive = activeBroadcastRangeFilter && activeBroadcastRangeFilter.start === r.start && activeBroadcastRangeFilter.end === r.end;
            const chip = document.createElement('button');
            chip.type = 'button';
            chip.className = 'btn sm';
            chip.style.cssText = `padding: 0.2rem 0.6rem; font-size: 0.725rem; border-radius: 999px; white-space: nowrap; flex-shrink: 0; cursor: pointer; border: 1px solid ${isActive ? 'var(--primary)' : 'var(--border)'}; background: ${isActive ? 'var(--primary-light)' : 'var(--bg-card)'}; color: ${isActive ? 'var(--primary)' : 'var(--text-main)'}; font-weight: ${isActive ? '700' : '500'};`;
            chip.innerHTML = `🔢 ${r.label} <span style="opacity:0.75; font-size:0.68rem;">(${r.count})</span>`;
            chip.onclick = () => {
                if (isActive) {
                    clearBroadcastRangeFilter();
                } else {
                    applyBroadcastRangeFilter(r, true);
                }
            };
            chipsContainer.appendChild(chip);
        });
    }
}

// Apply Range Selection Filter (e.g. '1-250', '251-500', or {start: 1, end: 250})
window.applyBroadcastRangeFilter = function applyBroadcastRangeFilter(rangeVal, autoSelect = true) {
    if (!rangeVal) {
        clearBroadcastRangeFilter();
        return;
    }

    let start = 1, end = broadcastCustomersCache.length;
    if (typeof rangeVal === 'string') {
        const parts = rangeVal.split('-');
        if (parts.length === 2) {
            start = parseInt(parts[0], 10);
            end = parseInt(parts[1], 10);
        }
    } else if (typeof rangeVal === 'object' && rangeVal.start && rangeVal.end) {
        start = parseInt(rangeVal.start, 10);
        end = parseInt(rangeVal.end, 10);
    }

    if (isNaN(start) || start < 1) start = 1;
    if (isNaN(end) || end < start) end = start;

    activeBroadcastRangeFilter = { start, end, label: `${start} to ${end}` };

    const sel = document.getElementById('bc-range-filter-select');
    if (sel) sel.value = `${start}-${end}`;

    const clearBtn = document.getElementById('btn-bc-clear-range-filter');
    if (clearBtn) clearBtn.style.display = 'inline-flex';

    populateBroadcastRangeOptions();

    // If autoSelect: Check ONLY customers that fall in the range [start, end]
    if (autoSelect) {
        let selectedCount = 0;
        document.querySelectorAll('.bc-cust-cb').forEach(cb => {
            const label = cb.closest('.option-item');
            const srNo = label ? parseInt(label.getAttribute('data-sr'), 10) : 0;
            const inRange = srNo >= start && srNo <= end;

            if (inRange) {
                cb.checked = true;
                selectedCount++;
            } else {
                cb.checked = false;
            }
        });

        const selectAll = document.getElementById('bc-select-all');
        if (selectAll) selectAll.checked = selectedCount > 0;
    }

    filterBroadcastCustomerList();
    updateBcDisplay();
};

window.clearBroadcastRangeFilter = function clearBroadcastRangeFilter() {
    activeBroadcastRangeFilter = null;
    const sel = document.getElementById('bc-range-filter-select');
    if (sel) sel.value = '';

    const clearBtn = document.getElementById('btn-bc-clear-range-filter');
    if (clearBtn) clearBtn.style.display = 'none';

    populateBroadcastRangeOptions();
    filterBroadcastCustomerList();
    updateBcDisplay();
};

window.clearBroadcastAudienceSelection = function clearBroadcastAudienceSelection() {
    document.querySelectorAll('.bc-cust-cb').forEach(cb => { cb.checked = false; });
    const selectAll = document.getElementById('bc-select-all');
    if (selectAll) selectAll.checked = false;
    clearBroadcastRangeFilter();
    updateBcDisplay();
};

window.toggleBroadcastCustomRangeInput = function toggleBroadcastCustomRangeInput(forceState) {
    const row = document.getElementById('bc-custom-range-row');
    if (!row) return;
    const shouldShow = (typeof forceState === 'boolean') ? forceState : (row.style.display === 'none');
    row.style.display = shouldShow ? 'flex' : 'none';
    if (shouldShow) {
        const fromInput = document.getElementById('bc-range-custom-from');
        const toInput = document.getElementById('bc-range-custom-to');
        if (fromInput && !fromInput.value) fromInput.value = '1';
        if (toInput && !toInput.value) toInput.value = Math.min(250, broadcastCustomersCache.length || 250);
        fromInput?.focus();
    }
};

window.applyBroadcastCustomRange = function applyBroadcastCustomRange() {
    const fromInput = document.getElementById('bc-range-custom-from');
    const toInput = document.getElementById('bc-range-custom-to');
    const start = parseInt(fromInput?.value, 10);
    const end = parseInt(toInput?.value, 10);

    if (isNaN(start) || start < 1) {
        alert('Please enter a valid starting Serial Number (1 or higher).');
        return;
    }
    if (isNaN(end) || end < start) {
        alert('Ending Serial Number must be greater than or equal to starting Serial Number.');
        return;
    }

    applyBroadcastRangeFilter({ start, end }, true);
};

window.filterBroadcastCustomerList = function filterBroadcastCustomerList() {
    const searchVal = (document.getElementById('bc-customer-search')?.value || '').toLowerCase().trim();
    let visibleCount = 0;
    const optionLabels = document.querySelectorAll('#bc-target-list .option-item');

    optionLabels.forEach(label => {
        const custId = label.getAttribute('data-id');
        const srNo = parseInt(label.getAttribute('data-sr'), 10) || 0;
        const cust = broadcastCustomersCache.find(c => String(c.id) === String(custId));
        if (!cust) return;

        const matchesRange = !activeBroadcastRangeFilter || (
            srNo >= activeBroadcastRangeFilter.start && srNo <= activeBroadcastRangeFilter.end
        );

        const matchesSearch = !searchVal || (
            (cust.name && cust.name.toLowerCase().includes(searchVal)) ||
            (cust.phone && cust.phone.includes(searchVal)) ||
            String(srNo) === searchVal ||
            ('#' + srNo) === searchVal
        );

        if (matchesRange && matchesSearch) {
            label.style.display = 'flex';
            visibleCount++;
        } else {
            label.style.display = 'none';
        }
    });

    const selectAllLabel = document.getElementById('bc-select-all-label');
    if (selectAllLabel) {
        if (activeBroadcastRangeFilter) {
            selectAllLabel.textContent = `Select All in Range #${activeBroadcastRangeFilter.start}-#${activeBroadcastRangeFilter.end} (${visibleCount})`;
        } else if (searchVal) {
            selectAllLabel.textContent = `Select All Filtered (${visibleCount})`;
        } else {
            selectAllLabel.textContent = `Select All Customers (${broadcastCustomersCache.length})`;
        }
    }

    const countBadge = document.getElementById('bc-matching-count-badge');
    if (countBadge) {
        countBadge.textContent = `${visibleCount} shown`;
    }
};

async function loadCustomersForSelect() {
    try {
        const res = await fetch('/api/customers');
        const customers = await res.json();
        
        if (customers.error) return;

        broadcastCustomersCache = Array.isArray(customers) ? customers : [];

        const list = document.getElementById('bc-target-list');
        if(list && Array.isArray(customers)) {
            list.innerHTML = '';
            customers.forEach((c, idx) => {
                const srNo = idx + 1;
                const label = document.createElement('label');
                label.className = 'option-item bc-customer-row';
                label.setAttribute('data-id', c.id);
                label.setAttribute('data-sr', srNo);
                label.innerHTML = `
                    <div class="bc-cust-left">
                        <input type="checkbox" class="bc-cust-cb" value="${c.id}">
                        <span class="bc-sr-badge" title="Customer Serial Number">#${srNo}</span>
                        <div class="bc-cust-meta">
                            <span class="bc-cust-name" title="${escapeHtml(c.name || 'Unnamed')}">${escapeHtml(c.name || 'Unnamed')}</span>
                            <span class="bc-cust-phone">(${escapeHtml(c.phone || '')})</span>
                        </div>
                    </div>
                `;
                list.appendChild(label);
            });

            populateBroadcastRangeOptions();

            const selectAll = document.getElementById('bc-select-all');
            const cbs = document.querySelectorAll('.bc-cust-cb');
            
            selectAll?.addEventListener('change', (e) => {
                const isChecked = e.target.checked;
                document.querySelectorAll('#bc-target-list .option-item').forEach(item => {
                    if (item.style.display !== 'none') {
                        const cb = item.querySelector('.bc-cust-cb');
                        if (cb) cb.checked = isChecked;
                    }
                });
                updateBcDisplay();
            });

            cbs.forEach(cb => {
                cb.addEventListener('change', () => {
                    if(!cb.checked && selectAll) selectAll.checked = false;
                    updateBcDisplay();
                });
            });

            // ⚡ Select 24h Active (Free Tier) shortcut button
            document.getElementById('btn-bc-select-24h-active')?.addEventListener('click', () => {
                const now = Date.now();
                const twentyFourHoursMs = 24 * 60 * 60 * 1000;
                
                if (selectAll) selectAll.checked = false;

                cbs.forEach(cb => {
                    const custId = parseInt(cb.value);
                    const cust = broadcastCustomersCache.find(c => c.id === custId);
                    if (cust && cust.last_inbound_at && (now - new Date(cust.last_inbound_at).getTime() <= twentyFourHoursMs)) {
                        cb.checked = true;
                    } else {
                        cb.checked = false;
                    }
                });

                updateBcDisplay();
                setTimeout(() => bcOptions?.classList.remove('active'), 250);
            });
        }
    } catch (e) {
        console.error('Error in loadCustomersForSelect:', e);
    }
}

function updateBcDisplay() {
    const cbs = document.querySelectorAll('.bc-cust-cb:checked');
    selectedCustomerIds = Array.from(cbs).map(cb => cb.value);
    
    const selectAll = document.getElementById('bc-select-all');
    if (selectedCustomerIds.length === 0) {
        bcDisplay.textContent = "Select Audience...";
    } else if (selectAll?.checked && !activeBroadcastRangeFilter) {
        bcDisplay.textContent = `All Customers Selected (${broadcastCustomersCache.length})`;
    } else if (activeBroadcastRangeFilter) {
        bcDisplay.textContent = `🎯 ${selectedCustomerIds.length} Customer(s) in Range #${activeBroadcastRangeFilter.start}-#${activeBroadcastRangeFilter.end} Selected`;
    } else {
        bcDisplay.textContent = `${selectedCustomerIds.length} Customer(s) Selected`;
    }
}

// Populate Media Library Select in Broadcast View (Filtered by Image vs Video)
async function loadMediaForSelect(targetType) {
    try {
        const res = await fetch('/api/media');
        const mediaList = await res.json();
        const select = document.getElementById('bc-media-select');
        const fileInput = document.getElementById('bc-media');
        if (!select || !Array.isArray(mediaList)) return;

        const currentBcType = targetType || document.getElementById('bc-type')?.value;

        // Set file input accept attribute based on message type
        if (fileInput) {
            if (currentBcType === 'image') fileInput.accept = 'image/*';
            else if (currentBcType === 'video') fileInput.accept = 'video/*';
            else fileInput.accept = 'image/*,video/*';
        }

        const typeLabel = currentBcType === 'image' ? 'Image' : currentBcType === 'video' ? 'Video' : 'Media';
        select.innerHTML = `<option value="">-- Select from uploaded ${typeLabel} files --</option>`;
        
        const filteredMedia = mediaList.filter(m => {
            if (!currentBcType || currentBcType === 'template' || currentBcType === 'text') return true;
            if (currentBcType === 'image') return m.type === 'image' || (m.mime_type && m.mime_type.startsWith('image'));
            if (currentBcType === 'video') return m.type === 'video' || (m.mime_type && m.mime_type.startsWith('video'));
            return true;
        });

        filteredMedia.forEach(m => {
            const val = m.meta_media_id || m.file_url;
            if (val) {
                select.innerHTML += `<option value="${val}">${m.name} (${m.type})</option>`;
            }
        });
    } catch (e) {
        console.error('Error loading media for select:', e);
    }
}

document.getElementById('bc-media-select')?.addEventListener('change', (e) => {
    const url = e.target.value;
    const previewContainer = document.getElementById('bc-media-preview-container');
    const fileInput = document.getElementById('bc-media');
    
    if (fileInput) fileInput.value = ''; // Reset file input if library item chosen
    
    if (url && previewContainer) {
        const isVideo = url.endsWith('.mp4');
        previewContainer.style.display = 'block';
        previewContainer.innerHTML = isVideo 
            ? `<video src="${url}" controls style="max-height:120px;border-radius:8px;"></video>` 
            : `<img src="${url}" style="max-height:120px;border-radius:8px;object-fit:cover;">`;
    } else if (previewContainer) {
        previewContainer.style.display = 'none';
    }
});

function checkSelectedTemplateMediaRequirement() {
    const type = document.getElementById('bc-type')?.value;
    const mediaGroup = document.getElementById('bc-media-group');
    if (!mediaGroup) return;

    let banner = document.getElementById('bc-template-auto-header-banner');

    if (type === 'template') {
        const tSel = document.getElementById('bc-template');
        const selectedName = tSel ? tSel.value : null;
        const tmpl = (templatesCache || []).find(t => t.name === selectedName);
        const headerComp = tmpl && tmpl.components ? tmpl.components.find(c => c.type === 'HEADER') : null;

        if (headerComp && ['IMAGE', 'VIDEO', 'DOCUMENT'].includes(headerComp.format)) {
            const mediaFormat = headerComp.format.toLowerCase();
            const metaExampleUrl = headerComp.example?.header_handle?.[0] || headerComp.example?.header_url?.[0];
            mediaGroup.style.display = 'block';
            const label = mediaGroup.querySelector('label');

            if (!banner) {
                banner = document.createElement('div');
                banner.id = 'bc-template-auto-header-banner';
                const label = mediaGroup.querySelector('label');
                if (label && label.parentNode === mediaGroup) {
                    label.insertAdjacentElement('afterend', banner);
                } else {
                    mediaGroup.prepend(banner);
                }
            }

            if (metaExampleUrl) {
                if (label) label.textContent = `Attached Template Header ${headerComp.format}:`;
                banner.style.display = 'block';
                banner.innerHTML = `
                    <div style="background:rgba(16, 185, 129, 0.1); border:1px solid rgba(16, 185, 129, 0.3); border-radius:8px; padding:0.65rem; margin-bottom:0.75rem; display:flex; align-items:center; gap:0.75rem;">
                        <div style="width:52px; height:52px; border-radius:6px; overflow:hidden; flex-shrink:0; background:var(--bg-dark); cursor:pointer;" onclick="openMediaPreview('${escapeAttr(metaExampleUrl)}', ${mediaFormat === 'video'}, '${escapeAttr(selectedName)}')">
                            ${mediaFormat === 'video' 
                                ? `<video src="${metaExampleUrl}" style="width:100%; height:100%; object-fit:cover;"></video>` 
                                : `<img src="${metaExampleUrl}" alt="Template Header" style="width:100%; height:100%; object-fit:cover;">`}
                        </div>
                        <div style="flex:1; min-width:0;">
                            <div style="color:#10b981; font-weight:600; font-size:0.82rem; display:flex; align-items:center; gap:0.3rem;">
                                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg>
                                <span>Meta Approved Header Attached Automatically</span>
                            </div>
                            <span style="font-size:0.73rem; color:var(--text-muted); display:block; margin-top:0.15rem;">Attached from Meta template. Choose or upload below only if you want to override.</span>
                        </div>
                    </div>
                `;
            } else {
                if (label) label.textContent = `Attach Template Header ${headerComp.format} (Required by Meta)`;
                banner.style.display = 'none';
            }

            loadMediaForSelect(mediaFormat === 'video' ? 'video' : 'image');
            return;
        }
    }

    if (banner) banner.style.display = 'none';

    if (type !== 'image' && type !== 'video') {
        mediaGroup.style.display = 'none';
    }
}

const bcType = document.getElementById('bc-type');
bcType?.addEventListener('change', (e) => {
    const type = e.target.value;
    document.getElementById('bc-template-group').style.display = type === 'template' ? 'block' : 'none';
    document.getElementById('bc-media-group').style.display = (type === 'image' || type === 'video') ? 'block' : 'none';
    document.getElementById('bc-content-group').style.display = type === 'template' ? 'none' : 'block';
    
    if (type === 'image' || type === 'video') {
        const label = document.getElementById('bc-media-group')?.querySelector('label');
        if (label) label.textContent = "Attach Media";
        loadMediaForSelect(type);
    }
    
    checkSelectedTemplateMediaRequirement();
});

document.getElementById('bc-template')?.addEventListener('change', () => {
    checkSelectedTemplateMediaRequirement();
});

document.getElementById('bc-media')?.addEventListener('change', (e) => {
    const file = e.target.files[0];
    const dropzoneText = document.getElementById('dropzone-text');
    const mediaSelect = document.getElementById('bc-media-select');
    
    if (mediaSelect) mediaSelect.value = ''; // Clear library dropdown if file chosen
    const previewContainer = document.getElementById('bc-media-preview-container');
    if (previewContainer) previewContainer.style.display = 'none';

    if (file && dropzoneText) {
        dropzoneText.textContent = `Attached: ${file.name}`;
    }
});

const getBase64 = (file) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result);
    reader.onerror = error => reject(error);
});

// Obtain Meta Resumable Upload handle (header_handle) for Template Header sample media via server API
async function getMetaHeaderHandle(file) {
    if (!file) return null;
    const base64Data = await getBase64(file);
    const mimeType = file.type || (file.name && file.name.endsWith('.mp4') ? 'video/mp4' : 'image/jpeg');

    const res = await fetch('/api/upload-media', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            base64Data: base64Data,
            fileName: file.name,
            mimeType: mimeType
        })
    });

    const data = await res.json();
    if (data.error) {
        throw new Error(data.error);
    }

    if (data.handle) {
        return data.handle;
    }

    throw new Error('Server did not return a valid Meta media handle.');
}

// Fast Binary Streaming Upload to Meta Cloud API with Live Progress
function uploadMediaToMetaFast(file, config, onProgress) {
    return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('POST', `https://graph.facebook.com/v19.0/${config.meta_phone_id}/media`);
        xhr.setRequestHeader('Authorization', `Bearer ${config.meta_token}`);

        if (xhr.upload && onProgress) {
            xhr.upload.onprogress = (e) => {
                if (e.lengthComputable) {
                    const percent = Math.round((e.loaded / e.total) * 100);
                    onProgress(percent);
                }
            };
        }

        xhr.onload = () => {
            if (xhr.status >= 200 && xhr.status < 300) {
                try {
                    const res = JSON.parse(xhr.responseText);
                    if (res.error) reject(new Error("Meta Upload Error: " + res.error.message));
                    else resolve(res);
                } catch (e) { reject(e); }
            } else {
                reject(new Error(`Meta Upload Failed with status ${xhr.status}`));
            }
        };

        xhr.onerror = () => reject(new Error("Network error uploading media to Meta"));

        const formData = new FormData();
        formData.append('messaging_product', 'whatsapp');
        formData.append('file', file);
        xhr.send(formData);
    });
}

// Non-blocking background sync to GitHub Media Storage
function syncToGithubBackground(file, config) {
    getBase64(file).then(base64Data => {
        const cleanBase64 = base64Data.replace(/^data:.*?;base64,/, "");
        const fileName = `${Date.now()}_${file.name.replace(/\s+/g, '_')}`;
        
        fetch(`https://api.github.com/repos/${config.github_owner}/${config.github_repo}/contents/uploads/${fileName}`, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${config.github_token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                message: `Upload media ${file.name}`,
                content: cleanBase64,
                branch: "main"
            })
        }).then(() => {
            if (typeof loadMedia === 'function') loadMedia();
            if (typeof loadMediaForSelect === 'function') loadMediaForSelect();
        }).catch(err => console.error("Background GitHub sync warning:", err));
    }).catch(err => console.error("Base64 encoding error:", err));
}

function resetBroadcastForm() {
    const form = document.getElementById('broadcast-form');
    if (form) form.reset();
    
    selectedCustomerIds = [];
    activeBroadcastRangeFilter = null;
    document.querySelectorAll('.bc-cust-cb').forEach(cb => { cb.checked = false; });
    const selectAll = document.getElementById('bc-select-all');
    if (selectAll) selectAll.checked = false;
    const bcDisplay = document.getElementById('bc-target-display');
    if (bcDisplay) bcDisplay.textContent = "Select Audience...";
    
    const sel = document.getElementById('bc-range-filter-select');
    if (sel) sel.value = '';
    const clearBtn = document.getElementById('btn-bc-clear-range-filter');
    if (clearBtn) clearBtn.style.display = 'none';
    populateBroadcastRangeOptions();
    filterBroadcastCustomerList();
    
    document.getElementById('bc-target-options')?.classList.remove('active');
    
    const mediaSelect = document.getElementById('bc-media-select');
    if (mediaSelect) mediaSelect.value = '';
    const fileInput = document.getElementById('bc-media');
    if (fileInput) fileInput.value = '';
    const previewContainer = document.getElementById('bc-media-preview-container');
    if (previewContainer) {
        previewContainer.style.display = 'none';
        previewContainer.innerHTML = '';
    }
    const dropzoneText = document.getElementById('dropzone-text');
    if (dropzoneText) dropzoneText.textContent = "Drag & Drop media here, or Click to Browse";
    
    const bcType = document.getElementById('bc-type');
    if (bcType) bcType.value = 'text';
    const tg = document.getElementById('bc-template-group');
    if (tg) tg.style.display = 'none';
    const mg = document.getElementById('bc-media-group');
    if (mg) mg.style.display = 'none';
    const cg = document.getElementById('bc-content-group');
    if (cg) cg.style.display = 'block';
}

// --- Broadcast Progress Modal Handler ---
const bcProgressModal = document.getElementById('broadcast-progress-modal');
const bcProgressCircle = document.getElementById('bc-progress-circle-fill');
const bcProgressPercent = document.getElementById('bc-progress-percent');
const bcProgressCounterSub = document.getElementById('bc-progress-counter-sub');
const bcProgressBarFill = document.getElementById('bc-progress-bar-fill');
const bcStatSent = document.getElementById('bc-stat-sent');
const bcStatFailed = document.getElementById('bc-stat-failed');
const bcStatRemaining = document.getElementById('bc-stat-remaining');
const bcProgressLog = document.getElementById('bc-progress-log');
const btnCloseBcProgress = document.getElementById('btn-close-bc-progress');
const btnCloseBcModalX = document.getElementById('btn-close-bc-modal-x');

const handleCloseBcModal = () => {
    bcProgressModal?.classList.add('hidden');
    loadDashboard();
    loadInboxSidebar();
};

btnCloseBcProgress?.addEventListener('click', handleCloseBcModal);
btnCloseBcModalX?.addEventListener('click', handleCloseBcModal);

function updateBcProgress(processed, total, sent, failed, logMsg = '') {
    const percent = total > 0 ? Math.round((processed / total) * 100) : 0;
    
    // SVG dashoffset: full circle radius is 50, circumference is 2 * PI * 50 = 314.16
    const dashoffset = 314.16 - (314.16 * (percent / 100));
    if (bcProgressCircle) bcProgressCircle.style.strokeDashoffset = dashoffset;
    if (bcProgressBarFill) bcProgressBarFill.style.width = `${percent}%`;
    if (bcProgressPercent) bcProgressPercent.textContent = `${percent}%`;
    if (bcProgressCounterSub) bcProgressCounterSub.textContent = `${processed} of ${total}`;
    
    if (bcStatSent) bcStatSent.textContent = sent;
    if (bcStatFailed) bcStatFailed.textContent = failed;
    if (bcStatRemaining) bcStatRemaining.textContent = Math.max(0, total - processed);

    // Instagram-style green verified badge animation toggle at 100%
    const verifiedBadge = document.getElementById('bc-verified-badge');
    const textBox = document.getElementById('bc-progress-text-box');
    const circleSvg = document.getElementById('bc-circle-svg');
    if (percent === 100 && total > 0) {
        if (verifiedBadge) verifiedBadge.style.display = 'flex';
        if (textBox) textBox.style.display = 'none';
        if (circleSvg) circleSvg.style.display = 'none';
    } else {
        if (verifiedBadge) verifiedBadge.style.display = 'none';
        if (textBox) textBox.style.display = 'flex';
        if (circleSvg) circleSvg.style.display = 'block';
    }

    if (logMsg && bcProgressLog) {
        const timeStr = new Date().toLocaleTimeString([], { hour12: true, hour: '2-digit', minute: '2-digit', second: '2-digit' });
        const logLine = document.createElement('div');
        logLine.innerHTML = `<span style="opacity:0.6;">[${timeStr}]</span> ${logMsg}`;
        bcProgressLog.appendChild(logLine);

        // Keep DOM lightweight if processing 1000+ numbers
        if (bcProgressLog.children.length > 400) {
            bcProgressLog.removeChild(bcProgressLog.firstElementChild);
        }

        // Smooth auto-scroll to bottom
        requestAnimationFrame(() => {
            if (bcProgressLog) bcProgressLog.scrollTop = bcProgressLog.scrollHeight;
        });
    }
}

document.getElementById('broadcast-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('btn-broadcast');
    const statusDiv = document.getElementById('broadcast-status');
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span> Sending Broadcast...';
    if (statusDiv) statusDiv.textContent = '';

    try {
        let targetList = [];
        const isSelectAll = document.getElementById('bc-select-all')?.checked;
        const checkedCbs = document.querySelectorAll('.bc-cust-cb:checked');
        const checkedIds = Array.from(checkedCbs).map(cb => String(cb.value));

        if (isSelectAll && !activeBroadcastRangeFilter) {
            const res = await fetch('/api/customers');
            const allCust = await res.json();
            if (Array.isArray(allCust)) targetList = allCust;
        } else if (checkedIds.length > 0) {
            if (broadcastCustomersCache && broadcastCustomersCache.length > 0) {
                targetList = broadcastCustomersCache.filter(c => checkedIds.includes(String(c.id)));
            } else {
                const res = await fetch('/api/customers');
                const allCust = await res.json();
                if (Array.isArray(allCust)) {
                    targetList = allCust.filter(c => checkedIds.includes(String(c.id)));
                }
            }
        } else if (activeBroadcastRangeFilter) {
            const pool = (broadcastCustomersCache && broadcastCustomersCache.length > 0)
                ? broadcastCustomersCache
                : await (await fetch('/api/customers')).json();
            if (Array.isArray(pool)) {
                targetList = pool.filter((c, idx) => {
                    const sr = idx + 1;
                    return sr >= activeBroadcastRangeFilter.start && sr <= activeBroadcastRangeFilter.end;
                });
            }
        } else {
            throw new Error("Please select at least one customer or range.");
        }

        if (targetList.length === 0) throw new Error("No target customers found for broadcast.");

        const type = document.getElementById('bc-type').value;
        const content = document.getElementById('bc-content').value;
        
        let media_id = null;
        let media_type = null;

        if (type === 'image' || type === 'video') {
            media_type = type;
            const librarySelectedUrl = document.getElementById('bc-media-select')?.value;
            const fileInput = document.getElementById('bc-media');

            if (librarySelectedUrl) {
                media_id = librarySelectedUrl;
            } else if (fileInput.files.length > 0) {
                const file = fileInput.files[0];
                const configRes = await fetch('/api/config');
                const config = await configRes.json();
                
                if (statusDiv) statusDiv.innerHTML = `<span class="spinner"></span> Streaming ${file.name} to Meta Cloud...`;
                const metaData = await uploadMediaToMetaFast(file, config, (percent) => {
                    if (statusDiv) statusDiv.innerHTML = `<span class="spinner"></span> Streaming ${file.name} to Meta Cloud (${percent}%)...`;
                });
                media_id = metaData.id;
                syncToGithubBackground(file, config);
            } else {
                throw new Error("Please select a media file from Library or upload a new file.");
            }
        }

        let template_name, template_language;
        if (type === 'template') {
            const tSel = document.getElementById('bc-template');
            template_name = tSel.value;
            template_language = tSel.options[tSel.selectedIndex].getAttribute('data-lang');

            const tmpl = (templatesCache || []).find(t => t.name === template_name);
            const headerComp = tmpl && tmpl.components ? tmpl.components.find(c => c.type === 'HEADER') : null;
            const requiresMedia = headerComp && ['IMAGE', 'VIDEO', 'DOCUMENT'].includes(headerComp.format);

            if (requiresMedia) {
                media_type = headerComp.format.toLowerCase();
                const librarySelectedUrl = document.getElementById('bc-media-select')?.value;
                const fileInput = document.getElementById('bc-media');
                const metaExampleUrl = headerComp.example?.header_handle?.[0] || headerComp.example?.header_url?.[0];

                if (librarySelectedUrl) {
                    media_id = librarySelectedUrl;
                } else if (fileInput && fileInput.files.length > 0) {
                    const file = fileInput.files[0];
                    const configRes = await fetch('/api/config');
                    const config = await configRes.json();
                    
                    if (statusDiv) statusDiv.innerHTML = `<span class="spinner"></span> Streaming ${file.name} to Meta Cloud...`;
                    const metaData = await uploadMediaToMetaFast(file, config, (percent) => {
                        if (statusDiv) statusDiv.innerHTML = `<span class="spinner"></span> Streaming ${file.name} to Meta Cloud (${percent}%)...`;
                    });
                    media_id = metaData.id;
                    syncToGithubBackground(file, config);
                } else if (metaExampleUrl) {
                    // Auto-attach related content header from Meta!
                    media_id = metaExampleUrl;
                } else {
                    throw new Error(`Template "${template_name}" requires a header ${headerComp.format.toLowerCase()} file. Please select or upload a media file.`);
                }
            }
        }

        // Display Full-Screen Live Progress Overlay Modal
        if (bcProgressModal) {
            bcProgressModal.classList.remove('hidden');
            if (btnCloseBcProgress) btnCloseBcProgress.style.display = 'none';
            if (bcProgressLog) bcProgressLog.innerHTML = '<div>🚀 Initializing Meta WhatsApp Cloud API connection...</div>';
            document.getElementById('bc-progress-title').textContent = 'Broadcasting Campaign...';
            document.getElementById('bc-progress-subtitle').textContent = `Targeting ${targetList.length} selected customer(s)`;
            updateBcProgress(0, targetList.length, 0, 0);
        }

        let sentTotal = 0;
        let failedTotal = 0;

        // Process customers in small chunks for live percentage updates
        const BATCH_SIZE = 2;
        for (let i = 0; i < targetList.length; i += BATCH_SIZE) {
            const chunk = targetList.slice(i, i + BATCH_SIZE);
            const chunkIds = chunk.map(c => c.id);
            const chunkNames = chunk.map(c => c.name || c.phone).join(', ');

            updateBcProgress(i, targetList.length, sentTotal, failedTotal, `⏳ Sending to ${chunkNames}...`);

            try {
                const res = await fetch('/api/broadcast', {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify({ target: chunkIds, type, content, media_id, media_type, template_name, template_language })
                });
                
                const result = await res.json();
                if (result.success) {
                    sentTotal += result.sent || 0;
                    failedTotal += result.failed || 0;
                    
                    if (result.errors && result.errors.length > 0) {
                        updateBcProgress(i + chunk.length, targetList.length, sentTotal, failedTotal, `<span style="color:#ef4444;">⚠️ Batch error: ${result.errors[0]}</span>`);
                    } else {
                        updateBcProgress(i + chunk.length, targetList.length, sentTotal, failedTotal, `<span style="color:#10b981;">✅ Delivered to ${chunkNames}</span>`);
                    }
                } else {
                    failedTotal += chunk.length;
                    updateBcProgress(i + chunk.length, targetList.length, sentTotal, failedTotal, `<span style="color:#ef4444;">❌ Failed for ${chunkNames}: ${result.error}</span>`);
                }
            } catch (err) {
                failedTotal += chunk.length;
                updateBcProgress(i + chunk.length, targetList.length, sentTotal, failedTotal, `<span style="color:#ef4444;">❌ Network Error for ${chunkNames}: ${err.message}</span>`);
            }
        }

        // Final 100% State
        updateBcProgress(targetList.length, targetList.length, sentTotal, failedTotal, `🎉 Campaign finished! ${sentTotal} sent, ${failedTotal} failed.`);
        document.getElementById('bc-progress-title').textContent = '🎉 Broadcast Campaign Complete!';
        document.getElementById('bc-progress-subtitle').textContent = `Finished processing all ${targetList.length} customers`;
        if (btnCloseBcProgress) btnCloseBcProgress.style.display = 'flex';

        resetBroadcastForm();

    } catch (err) {
        if (bcProgressModal && !bcProgressModal.classList.contains('hidden')) {
            updateBcProgress(0, 1, 0, 1, `<span style="color:#ef4444;">⚠️ Error: ${err.message}</span>`);
            if (btnCloseBcProgress) btnCloseBcProgress.style.display = 'flex';
        } else if (statusDiv) {
            statusDiv.textContent = `⚠️ ${err.message}`;
            statusDiv.style.color = 'var(--error)';
            resetBroadcastForm();
        }
    } finally {
        btn.disabled = false;
        btn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:18px;height:18px;"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg> Send Broadcast Campaign`;
    }
});


// --- Inbox Logic (WhatsApp Web Inspired) ---

let currentInboxFilter = 'all';

async function loadInboxSidebar() {
    const sidebar = document.getElementById('inbox-customers');
    if (sidebar) {
        sidebar.innerHTML = `<div class="loading-spinner-container"><div class="spinner-icon"></div><span>Loading chats...</span></div>`;
    }
    try {
        const res = await fetch('/api/customers');
        const customers = await res.json();
        if(!sidebar) return;
        
        if (customers.error || !Array.isArray(customers)) {
            sidebar.innerHTML = '<div style="padding:1rem;font-size:0.85rem;color:var(--error);">Failed to load contacts.</div>';
            return;
        }

        inboxCustomersList = customers;
        filterAndRenderInboxContacts();

        // Calculate total UNREAD messages count (not total customers!)
        const totalUnread = customers.reduce((sum, c) => sum + (parseInt(c.unread_count) || 0), 0);
        const badge = document.getElementById('nav-inbox-badge');
        if (badge) {
            badge.textContent = totalUnread;
            badge.style.display = totalUnread > 0 ? 'inline-block' : 'none';
        }

    } catch (e) {
        console.error('Error in loadInboxSidebar:', e);
        if (sidebar) sidebar.innerHTML = '<div style="padding:1rem;font-size:0.85rem;color:var(--error);">Error loading chats.</div>';
    }
}

function isUnsavedLead(c) {
    if (c.is_saved === true || c.is_saved === 'true') return false;
    return (c.is_saved === false || c.is_saved === 'false') ||
           (c.name === c.phone) ||
           (parseInt(c.inbound_count) > 0 && parseInt(c.outbound_count) === 0 && !c.is_saved);
}

function getCustomerActivityTimestamp(c) {
    const tMsg = c.last_message_at ? new Date(c.last_message_at).getTime() : 0;
    const tInbound = c.last_inbound_at ? new Date(c.last_inbound_at).getTime() : 0;
    const tCreated = c.created_at ? new Date(c.created_at).getTime() : 0;
    return Math.max(tMsg, tInbound, tCreated);
}

function filterAndRenderInboxContacts() {
    const query = document.getElementById('inbox-search')?.value.toLowerCase().trim() || '';
    const now = Date.now();
    const twentyFourHoursMs = 24 * 60 * 60 * 1000;

    const filtered = (inboxCustomersList || []).filter(c => {
        const matchesQuery = (!query) ||
                             (c.name && c.name.toLowerCase().includes(query)) ||
                             (c.phone && c.phone.toLowerCase().includes(query));
        if (!matchesQuery) return false;

        const is24hActive = c.last_inbound_at && (now - new Date(c.last_inbound_at).getTime() <= twentyFourHoursMs);
        const isInboundLead = isUnsavedLead(c);
        const custStatus = c.status || 'Open - Not Contacted';

        if (currentInboxFilter === 'free') {
            return is24hActive;
        } else if (currentInboxFilter === 'expired') {
            return !is24hActive;
        } else if (currentInboxFilter === 'unsaved') {
            return isInboundLead;
        } else if (currentInboxFilter === 'status-open') {
            return custStatus === 'Open - Not Contacted';
        } else if (currentInboxFilter === 'status-working') {
            return custStatus === 'Working - Contacted';
        } else if (currentInboxFilter === 'status-closed') {
            return custStatus === 'Closed - Not Converted';
        } else if (currentInboxFilter === 'status-converted') {
            return custStatus === 'Converted';
        }
        return true;
    });

    // Ensure recently messaged or reply customer is on top as recent conversations
    filtered.sort((a, b) => getCustomerActivityTimestamp(b) - getCustomerActivityTimestamp(a));

    // Check unsaved leads count to show/hide bulk save button
    const unsavedLeadsCount = (inboxCustomersList || []).filter(c => isUnsavedLead(c)).length;

    const bulkBtn = document.getElementById('btn-bulk-save-unsaved');
    if (bulkBtn) {
        if (unsavedLeadsCount > 0 && (currentInboxFilter === 'unsaved' || currentInboxFilter === 'all')) {
            bulkBtn.style.display = 'flex';
            bulkBtn.textContent = `✨ Save ${unsavedLeadsCount} Unsaved Lead(s) in Bulk`;
        } else {
            bulkBtn.style.display = 'none';
        }
    }

    renderInboxContacts(filtered);
}

function renderInboxContacts(list) {
    const sidebar = document.getElementById('inbox-customers');
    if (!sidebar) return;

    sidebar.innerHTML = '';
    if (list.length === 0) {
        const msg = currentInboxFilter === 'free' ? 'No active 24h free tier chats' 
                  : currentInboxFilter === 'expired' ? 'No 24h expired chats'
                  : currentInboxFilter === 'unsaved' ? 'No new unsaved / ad leads found' 
                  : currentInboxFilter === 'status-open' ? 'No chats in "Open - Not Contacted"'
                  : currentInboxFilter === 'status-working' ? 'No chats in "Working - Contacted"'
                  : currentInboxFilter === 'status-closed' ? 'No chats in "Closed - Not Converted"'
                  : currentInboxFilter === 'status-converted' ? 'No chats in "Converted"'
                  : 'No contacts found';
        sidebar.innerHTML = `<div class="empty-state">${msg}</div>`;
        return;
    }

    list.forEach(c => {
        const unreadNum = parseInt(c.unread_count) || 0;
        const unreadBadgeHtml = unreadNum > 0 
            ? `<span class="badge-count" style="font-size:0.7rem;padding:0.1rem 0.45rem;">${unreadNum}</span>` 
            : '';

        const isInboundLead = isUnsavedLead(c);

        const leadTagHtml = isInboundLead 
            ? `<span style="font-size:0.6rem; background:rgba(234, 179, 8, 0.18); color:#eab308; padding:0.1rem 0.35rem; border-radius:4px; margin-left:0.35rem; font-weight:600; display:inline-block;">Ad Lead</span>`
            : '';

        const custStatus = c.status || 'Open - Not Contacted';
        const statusKey = getStatusKey(custStatus);
        const statusShort = getStatusShort(custStatus);
        const statusPillHtml = `<span class="status-pill status-${statusKey}">${statusShort}</span>`;

        let lastMsgHtml = '';
        if (c.last_message_content || c.last_message_at) {
            let preview = c.last_message_content || (c.last_message_direction === 'inbound' ? 'Inbound message' : 'Message');
            if (preview.startsWith('[Template]')) {
                preview = '📋 ' + preview.replace(/^\[Template\]\s*/i, '');
            } else if (preview.length > 26) {
                preview = preview.slice(0, 26) + '...';
            }
            const timeStr = formatTime(c.last_message_at || c.last_inbound_at);
            lastMsgHtml = `
                <div class="contact-last-msg">
                    <span class="contact-last-msg-text">${escapeHtml(preview)}</span>
                    <span class="contact-last-msg-time">${timeStr}</span>
                </div>
            `;
        }

        const div = document.createElement('div');
        div.className = `inbox-contact-card ${activeInboxCustomer === c.id ? 'active' : ''}`;
        div.setAttribute('data-id', c.id);
        div.innerHTML = `
            <div class="contact-avatar">${getInitial(c.name)}</div>
            <div class="contact-details">
                <div class="contact-name" style="display:flex; align-items:center; justify-content:space-between; gap:0.25rem;">
                    <span style="overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${escapeHtml(c.name)}</span>
                    ${leadTagHtml}
                </div>
                <div style="display:flex; align-items:center; justify-content:space-between; gap:0.4rem; margin-top:0.2rem;">
                    <div class="contact-phone">${formatDisplayPhone(c.phone)}</div>
                    ${statusPillHtml}
                </div>
                ${lastMsgHtml}
            </div>
            ${unreadBadgeHtml}
        `;
        div.onclick = () => {
            activeInboxCustomer = c.id;
            c.unread_count = 0; // Mark read locally
            filterAndRenderInboxContacts();
            openChat(c);
        };
        sidebar.appendChild(div);
    });
}

document.querySelectorAll('.inbox-filter-chip').forEach(btn => {
    btn.addEventListener('click', (e) => {
        document.querySelectorAll('.inbox-filter-chip').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentInboxFilter = btn.dataset.filter || 'all';
        filterAndRenderInboxContacts();
    });
});

// Interactive Modal for Reviewing and Saving Unsaved Ad Leads
function openSaveUnsavedLeadsModal() {
    const unsavedList = inboxCustomersList.filter(c => isUnsavedLead(c));
    if (unsavedList.length === 0) {
        showModal('Info', 'All ad leads are already saved in the Customer Directory!');
        return;
    }

    const modal = document.getElementById('save-unsaved-leads-modal');
    const container = document.getElementById('unsaved-leads-list-container');
    if (!modal || !container) return;

    container.innerHTML = '';
    unsavedList.forEach(c => {
        const formattedPhone = formatIndiaPhone(c.phone);
        const displayPhone = formatDisplayPhone(c.phone);
        const initialName = c.name && c.name !== c.phone ? c.name : `Lead ${formattedPhone.slice(-4)}`;

        const row = document.createElement('div');
        row.className = 'unsaved-lead-item-row';
        row.setAttribute('data-phone', formattedPhone);
        row.style.cssText = 'display: flex; align-items: center; justify-content: space-between; gap: 0.75rem; padding: 0.65rem 0.85rem; background: var(--bg-sidebar); border-radius: 10px; border: 1px solid var(--border);';
        
        row.innerHTML = `
            <div style="flex: 1; display: flex; flex-direction: column; gap: 0.25rem;">
                <div style="display: flex; align-items: center; gap: 0.5rem;">
                    <input type="text" class="lead-name-input" value="${initialName}" placeholder="Enter Customer Name" style="padding: 0.4rem 0.65rem; font-size: 0.825rem; font-weight: 600; border-radius: 6px; border: 1px solid var(--border); background: var(--bg-card); color: var(--text-main); width: 100%;">
                </div>
                <span style="font-size: 0.75rem; color: var(--text-muted); font-family: monospace;">${displayPhone}</span>
            </div>
            <button type="button" class="btn-save-single-lead btn primary sm" style="white-space: nowrap; font-size: 0.75rem; padding: 0.45rem 0.85rem;">
                ➕ Save Contact
            </button>
        `;

        const singleSaveBtn = row.querySelector('.btn-save-single-lead');
        const nameInput = row.querySelector('.lead-name-input');

        singleSaveBtn.addEventListener('click', async () => {
            const consentChecked = document.getElementById('unsaved-consent-check')?.checked;
            if (!consentChecked) {
                showModal('Terms Consent Required', 'Please check the WhatsApp Business Terms consent box to proceed.');
                return;
            }

            const newName = nameInput.value.trim() || initialName;
            singleSaveBtn.disabled = true;
            singleSaveBtn.innerHTML = '<span class="spinner"></span> Saving...';

            try {
                const res = await fetch('/api/customers', {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify({ name: newName, phone: formattedPhone })
                });
                const data = await res.json();

                if (data.success) {
                    singleSaveBtn.innerHTML = '✅ Saved';
                    singleSaveBtn.style.background = '#10b981';
                    singleSaveBtn.style.borderColor = '#10b981';
                    nameInput.disabled = true;

                    // Update local customer state
                    c.is_saved = true;
                    c.name = newName;
                    c.phone = formattedPhone;

                    // Refresh directory & sidebar
                    await loadCustomers();
                    filterAndRenderInboxContacts();
                } else {
                    throw new Error(data.error || 'Failed to save customer');
                }
            } catch (err) {
                singleSaveBtn.disabled = false;
                singleSaveBtn.innerHTML = '➕ Save Contact';
                showModal('Error', err.message);
            }
        });

        container.appendChild(row);
    });

    modal.classList.remove('hidden');
}

document.getElementById('btn-bulk-save-unsaved')?.addEventListener('click', openSaveUnsavedLeadsModal);
document.getElementById('btn-close-unsaved-modal-x')?.addEventListener('click', () => {
    document.getElementById('save-unsaved-leads-modal')?.classList.add('hidden');
});
document.getElementById('btn-cancel-unsaved-modal')?.addEventListener('click', () => {
    document.getElementById('save-unsaved-leads-modal')?.classList.add('hidden');
});

document.getElementById('btn-save-all-unsaved-leads')?.addEventListener('click', async () => {
    const consentChecked = document.getElementById('unsaved-consent-check')?.checked;
    if (!consentChecked) {
        showModal('Terms Consent Required', 'Please check the WhatsApp Business Terms consent box to proceed.');
        return;
    }

    const rows = document.querySelectorAll('#unsaved-leads-list-container .unsaved-lead-item-row');
    const toSave = [];

    rows.forEach(row => {
        const btn = row.querySelector('.btn-save-single-lead');
        if (btn && !btn.disabled) { // Not already saved
            const phone = row.getAttribute('data-phone');
            const name = row.querySelector('.lead-name-input')?.value.trim() || `Lead ${phone.slice(-4)}`;
            toSave.push({ name, phone });
        }
    });

    if (toSave.length === 0) {
        showModal('Info', 'All leads in the list are already saved!');
        document.getElementById('save-unsaved-leads-modal')?.classList.add('hidden');
        return;
    }

    const bulkAllBtn = document.getElementById('btn-save-all-unsaved-leads');
    if (bulkAllBtn) {
        bulkAllBtn.disabled = true;
        bulkAllBtn.innerHTML = '<span class="spinner"></span> Saving All...';
    }

    try {
        const res = await fetch('/api/customers-import', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ customers: toSave })
        });
        const result = await res.json();

        if (result.success) {
            document.getElementById('save-unsaved-leads-modal')?.classList.add('hidden');

            // Switch to All Chats filter so saved contacts appear immediately
            currentInboxFilter = 'all';
            document.querySelectorAll('.inbox-filter-chip').forEach(b => {
                if (b.dataset.filter === 'all') b.classList.add('active');
                else b.classList.remove('active');
            });

            await loadCustomers();
            await loadInboxSidebar();

            showModal('Success', `🎉 Successfully saved ${result.count} lead(s) to Customer Directory!`);
        } else {
            throw new Error(result.error || 'Failed to bulk save leads');
        }
    } catch (err) {
        showModal('Error', err.message);
    } finally {
        if (bulkAllBtn) {
            bulkAllBtn.disabled = false;
            bulkAllBtn.innerHTML = '✨ Save All Unsaved Leads';
        }
    }
});

document.getElementById('inbox-search')?.addEventListener('input', () => {
    filterAndRenderInboxContacts();
});

async function openChat(customer, pushHistory = true) {
    activeInboxCustomer = customer.id;
    activeCustomerData = customer;

    if (pushHistory && history.pushState) {
        history.pushState({ view: 'inbox', chatId: customer.id }, '', `#inbox-chat-${customer.id}`);
    }

    // Show Header & Form
    const headerBar = document.getElementById('chat-header-bar');
    const activeAvatar = document.getElementById('active-chat-avatar');
    const activeName = document.getElementById('active-chat-name');
    const activePhone = document.getElementById('active-chat-phone');
    
    if (headerBar) headerBar.style.display = 'flex';
    if (activeAvatar) activeAvatar.textContent = getInitial(customer.name);
    if (activeName) activeName.textContent = customer.name;
    if (activePhone) activePhone.textContent = formatDisplayPhone(customer.phone);

    const badge = document.getElementById('active-chat-window-badge');
    if (badge) {
        if (customer.last_inbound_at) {
            const diffMs = Date.now() - new Date(customer.last_inbound_at).getTime();
            if (diffMs <= 24 * 60 * 60 * 1000) {
                const remainingMs = (24 * 60 * 60 * 1000) - diffMs;
                const h = Math.floor(remainingMs / (1000 * 60 * 60));
                const m = Math.floor((remainingMs % (1000 * 60 * 60)) / (1000 * 60));
                badge.textContent = `⚡ 24h Active (${h}h ${m}m)`;
                badge.className = 'window-badge active';
            } else {
                badge.textContent = '🔒 24h Expired';
                badge.className = 'window-badge expired';
            }
        } else {
            badge.textContent = '🔒 24h Expired';
            badge.className = 'window-badge expired';
        }
    }

    // Initialize Status Dropdown in Chat Header
    const headerStatusSelect = document.getElementById('chat-header-status-select');
    if (headerStatusSelect) {
        const custStatus = customer.status || 'Open - Not Contacted';
        headerStatusSelect.value = custStatus;
        headerStatusSelect.className = `chat-header-status-select status-${getStatusKey(custStatus)}`;
    }

    document.getElementById('chat-active-customer').value = customer.id;
    document.getElementById('chat-reply-form').style.display = 'flex';
    
    // Mobile toggle
    if (window.innerWidth <= 768) {
        document.getElementById('inbox-customers-panel')?.classList.add('hidden');
        document.getElementById('inbox-chat-area')?.classList.remove('hidden');
    }

    await fetchChatMessages(true);
    
    if(inboxPollInterval) clearInterval(inboxPollInterval);
    inboxPollInterval = setInterval(fetchChatMessages, 4000);
}

document.getElementById('chat-header-status-select')?.addEventListener('change', async (e) => {
    if (!activeInboxCustomer) return;
    const newStatus = e.target.value;
    await updateCustomerStatus(activeInboxCustomer, newStatus, e.target);
});

document.getElementById('close-chat-btn')?.addEventListener('click', closeChat);

function closeChat() {
    activeInboxCustomer = null;
    activeCustomerData = null;
    if(inboxPollInterval) clearInterval(inboxPollInterval);
    
    const headerBar = document.getElementById('chat-header-bar');
    if (headerBar) headerBar.style.display = 'none';

    document.getElementById('chat-reply-form').style.display = 'none';
    document.getElementById('chat-messages').innerHTML = `
        <div class="empty-state">
            <div class="empty-inbox-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>
            </div>
            <h3>Select a customer chat</h3>
            <p>Choose a conversation from the left to start messaging in real-time.</p>
        </div>
    `;
    document.querySelectorAll('.inbox-contact-card').forEach(el => el.classList.remove('active'));

    if (window.innerWidth <= 768) {
        document.getElementById('inbox-customers-panel')?.classList.remove('hidden');
        document.getElementById('inbox-chat-area')?.classList.add('hidden');
    }
}

function renderTick(status, direction) {
    if (direction === 'inbound') return '';
    if (status === 'read') return `<span class="tick-icon tick-read" title="Read">✓✓</span>`;
    if (status === 'delivered') return `<span class="tick-icon tick-sent" title="Delivered">✓✓</span>`;
    return `<span class="tick-icon tick-sent" title="Sent">✓</span>`;
}

function update24hWindowBadge(messages) {
    const badge = document.getElementById('active-chat-window-badge');
    if (!badge) return;

    if (!Array.isArray(messages) || messages.length === 0) {
        badge.textContent = '🔒 24h Window Expired';
        badge.className = 'window-badge expired';
        badge.title = 'No inbound messages from customer yet. Use a Template to message.';
        return;
    }

    const inboundMsgs = messages.filter(m => m.direction === 'inbound');
    if (inboundMsgs.length === 0) {
        badge.textContent = '🔒 24h Window Expired';
        badge.className = 'window-badge expired';
        badge.title = 'No inbound messages from customer yet. Use a Template to initiate conversation.';
        return;
    }

    const latestInbound = inboundMsgs.reduce((latest, m) => {
        const t = new Date(m.created_at).getTime();
        return t > latest ? t : latest;
    }, 0);

    const now = Date.now();
    const diffMs = now - latestInbound;
    const twentyFourHoursMs = 24 * 60 * 60 * 1000;

    if (diffMs <= twentyFourHoursMs) {
        const remainingMs = twentyFourHoursMs - diffMs;
        const remainingHours = Math.floor(remainingMs / (1000 * 60 * 60));
        const remainingMins = Math.floor((remainingMs % (1000 * 60 * 60)) / (1000 * 60));
        badge.textContent = `⚡ 24h Active (${remainingHours}h ${remainingMins}m)`;
        badge.className = 'window-badge active';
        badge.title = '24-hour service window is active. Free session replies allowed.';
    } else {
        badge.textContent = '🔒 24h Expired';
        badge.className = 'window-badge expired';
        badge.title = 'Last inbound message was over 24 hours ago. Send a Template message to reconnect.';
    }
}

function getChatDateHeader(dateStr) {
    if (!dateStr) return 'Today';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return 'Today';

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    const msgDate = new Date(d.getFullYear(), d.getMonth(), d.getDate());

    if (msgDate.getTime() === today.getTime()) {
        return 'Today';
    } else if (msgDate.getTime() === yesterday.getTime()) {
        return 'Yesterday';
    } else {
        return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
    }
}

function escapeHtml(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function escapeAttr(str) {
    if (!str) return '';
    return String(str).replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}

function formatWhatsAppText(text) {
    if (!text) return '';
    let safe = escapeHtml(text);
    // WhatsApp Markdown Formatting
    safe = safe.replace(/\*([^*\n\r]+)\*/g, '<strong>$1</strong>');
    safe = safe.replace(/_([^_<\n\r]+)_/g, '<em>$1</em>');
    safe = safe.replace(/~([^~<\n\r]+)~/g, '<del>$1</del>');
    safe = safe.replace(/\r?\n/g, '<br>');
    return safe;
}

function renderTemplateMessageBubble(m, timeStr, tickHtml) {
    const rawContent = (m.content || '').trim();
    // Extract template name: e.g. from "[Template] vinayaka_chavithi" or "vinayaka_chavithi"
    const templateName = rawContent.replace(/^\[Template\]\s*/i, '').trim();
    
    // Find matching template in cache
    const tmpl = (templatesCache || []).find(t => t.name && t.name.toLowerCase() === templateName.toLowerCase());

    const headerComp = tmpl?.components?.find(c => c.type === 'HEADER');
    const bodyComp = tmpl?.components?.find(c => c.type === 'BODY');
    const footerComp = tmpl?.components?.find(c => c.type === 'FOOTER');
    const buttonsComp = tmpl?.components?.find(c => c.type === 'BUTTONS');

    // 1. Header Media or Text
    let headerHtml = '';
    const headerFormat = (headerComp?.format || (m.media_url ? 'IMAGE' : '')).toUpperCase();
    const mediaSrc = m.media_url || headerComp?.example?.header_handle?.[0] || headerComp?.example?.header_url?.[0];

    if (headerFormat === 'IMAGE' && mediaSrc) {
        headerHtml = `
            <div class="chat-tpl-header-media" onclick="openMediaPreview('${escapeAttr(mediaSrc)}', false, '${escapeAttr(templateName)}')" title="Click to view full image">
                <img src="${escapeAttr(mediaSrc)}" alt="${escapeAttr(templateName)}" loading="lazy" />
                <div class="chat-tpl-zoom-badge">
                    <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line><line x1="11" y1="8" x2="11" y2="14"></line><line x1="8" y1="11" x2="14" y2="11"></line></svg>
                    <span>View Image</span>
                </div>
            </div>
        `;
    } else if (headerFormat === 'VIDEO' && mediaSrc) {
        headerHtml = `
            <div class="chat-tpl-header-media video">
                <video src="${escapeAttr(mediaSrc)}" controls preload="metadata"></video>
            </div>
        `;
    } else if (headerFormat === 'TEXT' && headerComp?.text) {
        headerHtml = `<div class="chat-tpl-header-text">${escapeHtml(headerComp.text)}</div>`;
    }

    // 2. Body Text
    let bodyText = bodyComp?.text || '';
    if (bodyText) {
        const custName = (activeCustomerData && activeCustomerData.name && activeCustomerData.name.trim()) 
            ? activeCustomerData.name.trim() 
            : 'Customer';
        // Replace named parameters e.g. {{customer_name}} or {{1}}
        bodyText = bodyText.replace(/\{\{\s*(?:customer_name|name|1)\s*\}\}/gi, custName);
        bodyText = bodyText.replace(/\{\{\s*\d+\s*\}\}/g, custName);
    } else {
        bodyText = rawContent;
    }

    const bodyHtml = `<div class="chat-tpl-body">${formatWhatsAppText(bodyText)}</div>`;

    // 3. Footer Text
    let footerHtml = '';
    if (footerComp && footerComp.text) {
        footerHtml = `<div class="chat-tpl-footer">${escapeHtml(footerComp.text)}</div>`;
    }

    // 4. Interactive Quick Reply / CTA Buttons
    let buttonsHtml = '';
    if (buttonsComp && Array.isArray(buttonsComp.buttons) && buttonsComp.buttons.length > 0) {
        buttonsHtml = `
            <div class="chat-tpl-buttons">
                ${buttonsComp.buttons.map(b => `
                    <div class="chat-tpl-btn">
                        <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="15 10 20 15 15 20"></polyline><path d="M4 4v7a4 4 0 0 0 4 4h12"></path></svg>
                        <span>${escapeHtml(b.text || b.title || 'Option')}</span>
                    </div>
                `).join('')}
            </div>
        `;
    }

    return `
        <div class="message-bubble ${m.direction} chat-tpl-bubble">
            <div class="chat-tpl-badge">
                <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
                <span>WhatsApp Template • ${escapeHtml(templateName)}</span>
            </div>
            ${headerHtml}
            ${bodyHtml}
            ${footerHtml}
            ${buttonsHtml}
            <div class="msg-meta">
                <span>${timeStr}</span>
                ${tickHtml}
            </div>
        </div>
    `;
}

let lastChatMsgCount = 0;
let lastChatLatestMsgId = null;

async function fetchChatMessages(isInitial = false) {
    if(!activeInboxCustomer) return;
    const chatContainer = document.getElementById('chat-messages');
    if (!chatContainer) return;
    
    if (isInitial) {
        lastChatMsgCount = 0;
        lastChatLatestMsgId = null;
        chatContainer.innerHTML = `<div class="loading-spinner-container"><div class="spinner-icon"></div><span>Loading conversation history...</span></div>`;
    }

    // Ensure templates are preloaded in templatesCache for rendering template bubbles
    if (!templatesCache || templatesCache.length === 0) {
        try {
            const cached = sessionStorage.getItem('mg_templates_cache');
            if (cached) templatesCache = JSON.parse(cached);
        } catch(e) {}
        if (!templatesCache || templatesCache.length === 0) {
            try {
                const tRes = await fetch('/api/templates');
                const tData = await tRes.json();
                if (Array.isArray(tData)) {
                    templatesCache = tData;
                    try { sessionStorage.setItem('mg_templates_cache', JSON.stringify(tData)); } catch(e) {}
                }
            } catch(e) {
                console.warn('Could not load templates for chat:', e);
            }
        }
    }

    try {
        const res = await fetch(`/api/messages?customer_id=${activeInboxCustomer}`);
        const messages = await res.json();
        
        if (messages.error || !Array.isArray(messages)) return;

        update24hWindowBadge(messages);

        const latestMsg = messages.length > 0 ? messages[messages.length - 1] : null;
        const latestMsgId = latestMsg ? (latestMsg.id || latestMsg.created_at) : null;

        // Keep active customer's latest message activity up to date
        if (latestMsg && activeCustomerData) {
            const numId = parseInt(activeCustomerData.id, 10);
            const inList = (inboxCustomersList || []).find(c => c.id === numId || c.id === activeCustomerData.id);
            if (inList) {
                const hadChange = inList.last_message_at !== latestMsg.created_at || inList.last_message_content !== latestMsg.content;
                inList.last_message_at = latestMsg.created_at;
                inList.last_message_content = latestMsg.content;
                inList.last_message_direction = latestMsg.direction;
                if (latestMsg.direction === 'inbound') {
                    inList.last_inbound_at = latestMsg.created_at;
                }
                if (hadChange) {
                    filterAndRenderInboxContacts();
                }
            }
        }

        // Skip DOM re-render on polling if message count and latest message ID haven't changed
        if (!isInitial && messages.length === lastChatMsgCount && latestMsgId === lastChatLatestMsgId) {
            return;
        }

        const isNearBottom = chatContainer.scrollHeight - chatContainer.scrollTop - chatContainer.clientHeight < 140;

        lastChatMsgCount = messages.length;
        lastChatLatestMsgId = latestMsgId;

        chatContainer.innerHTML = '';
        
        if (messages.length === 0) {
            chatContainer.innerHTML = `
                <div class="empty-state">
                    <p style="color:var(--text-muted);">No message history with this contact yet.</p>
                </div>
            `;
            return;
        }

        let lastDateHeader = null;

        messages.forEach(m => {
            const dateHeader = getChatDateHeader(m.created_at);
            if (dateHeader !== lastDateHeader) {
                lastDateHeader = dateHeader;
                const divider = document.createElement('div');
                divider.className = 'chat-date-divider';
                divider.innerHTML = `<span>${dateHeader}</span>`;
                chatContainer.appendChild(divider);
            }

            const row = document.createElement('div');
            row.className = `msg-row ${m.direction}`;
            
            const timeStr = formatTime(m.created_at);
            const tickHtml = renderTick(m.status, m.direction);

            const isTemplate = m.type === 'template' || (m.content && m.content.trim().startsWith('[Template]'));

            if (isTemplate) {
                row.innerHTML = renderTemplateMessageBubble(m, timeStr, tickHtml);
            } else if (m.type === 'image' && m.media_url) {
                row.innerHTML = `
                    <div class="message-bubble ${m.direction} media-bubble">
                        <div class="chat-media-wrapper" onclick="openMediaPreview('${escapeAttr(m.media_url)}', false, 'Shared Image')">
                            <img src="${escapeAttr(m.media_url)}" alt="WhatsApp Image" loading="lazy" />
                        </div>
                        ${m.content && m.content !== '[Image]' ? `<div class="msg-content" style="margin-top:0.35rem;">${formatWhatsAppText(m.content)}</div>` : ''}
                        <div class="msg-meta">
                            <span>${timeStr}</span>
                            ${tickHtml}
                        </div>
                    </div>
                `;
            } else if (m.type === 'video' && m.media_url) {
                row.innerHTML = `
                    <div class="message-bubble ${m.direction} media-bubble">
                        <div class="chat-media-wrapper">
                            <video src="${escapeAttr(m.media_url)}" controls preload="metadata"></video>
                        </div>
                        ${m.content && m.content !== '[Video]' ? `<div class="msg-content" style="margin-top:0.35rem;">${formatWhatsAppText(m.content)}</div>` : ''}
                        <div class="msg-meta">
                            <span>${timeStr}</span>
                            ${tickHtml}
                        </div>
                    </div>
                `;
            } else {
                let contentHtml = m.content || '';
                if (contentHtml === '[button]' || contentHtml === '[Button]' || contentHtml === 'button' || contentHtml === '[button reply]' || contentHtml === 'Button Clicked') {
                    contentHtml = `<span style="display:inline-flex;align-items:center;gap:0.35rem;background:rgba(16,185,129,0.12);color:#10b981;padding:0.25rem 0.55rem;border-radius:6px;font-weight:600;font-size:0.8rem;">🔘 Quick Reply Button Clicked</span>`;
                } else if (contentHtml.startsWith('[button]')) {
                    const btnText = contentHtml.replace('[button]', '').trim();
                    contentHtml = `<span style="display:inline-flex;align-items:center;gap:0.35rem;background:rgba(16,185,129,0.12);color:#10b981;padding:0.25rem 0.55rem;border-radius:6px;font-weight:600;font-size:0.8rem;">🔘 Tapped: "${btnText || 'Quick Reply'}"</span>`;
                } else if (m.type === 'button' || m.type === 'interactive') {
                    contentHtml = `<span style="display:inline-flex;align-items:center;gap:0.35rem;background:rgba(16,185,129,0.12);color:#10b981;padding:0.25rem 0.55rem;border-radius:6px;font-weight:600;font-size:0.8rem;">🔘 Tapped: "${escapeHtml(contentHtml)}"</span>`;
                } else {
                    contentHtml = formatWhatsAppText(contentHtml);
                }

                row.innerHTML = `
                    <div class="message-bubble ${m.direction}">
                        <div class="msg-content">${contentHtml}</div>
                        <div class="msg-meta">
                            <span>${timeStr}</span>
                            ${tickHtml}
                        </div>
                    </div>
                `;
            }
            chatContainer.appendChild(row);
        });

        if (isInitial || isNearBottom) {
            chatContainer.scrollTop = chatContainer.scrollHeight;
        }

        // Update nav badge to reflect cleared unread count
        if (inboxCustomersList.length > 0) {
            const currentCust = inboxCustomersList.find(c => c.id === activeInboxCustomer);
            if (currentCust) currentCust.unread_count = 0;
            const remainingUnread = inboxCustomersList.reduce((sum, c) => sum + (parseInt(c.unread_count) || 0), 0);
            const badge = document.getElementById('nav-inbox-badge');
            if (badge) {
                badge.textContent = remainingUnread;
                badge.style.display = remainingUnread > 0 ? 'inline-block' : 'none';
            }
        }
    } catch (e) {
        console.error('Error in fetchChatMessages:', e);
    }
}

document.getElementById('chat-reply-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const inputEl = document.getElementById('chat-reply-text');
    const content = inputEl.value.trim();
    if (!content) return;

    const customerId = document.getElementById('chat-active-customer').value;
    const btn = e.target.querySelector('button[type="submit"]');
    
    inputEl.value = '';
    btn.disabled = true;
    
    const res = await fetch('/api/send-message', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({
            customer_id: customerId,
            type: 'text',
            content: content
        })
    });
    
    btn.disabled = false;
    
    const result = await res.json();
    if (result.error) {
        showModal('Message Error', "Failed to send message: " + result.error);
    } else {
        const numId = parseInt(customerId, 10);
        const cust = (inboxCustomersList || []).find(c => c.id === numId || c.id === customerId);
        if (cust) {
            cust.last_message_at = new Date().toISOString();
            cust.last_message_content = content;
            cust.last_message_direction = 'outbound';
            filterAndRenderInboxContacts();
        }
    }
    
    fetchChatMessages();
});

// Toggle Chat Header 3-Dots Dropdown Menu
document.getElementById('chat-menu-btn')?.addEventListener('click', (e) => {
    e.stopPropagation();
    const menu = document.getElementById('chat-dropdown-menu');
    if (menu) menu.classList.toggle('hidden');
});

// Close dropdown menu when clicking anywhere outside
document.addEventListener('click', (e) => {
    const menu = document.getElementById('chat-dropdown-menu');
    if (menu && !menu.classList.contains('hidden')) {
        menu.classList.add('hidden');
    }
});

// Send Template directly from Inbox to Initiate Conversation with New Numbers
document.getElementById('btn-inbox-send-template')?.addEventListener('click', async () => {
    document.getElementById('chat-dropdown-menu')?.classList.add('hidden');
    if (!activeInboxCustomer) return;
    
    try {
        const res = await fetch('/api/templates');
        const templates = await res.json();
        
        if (!Array.isArray(templates) || templates.length === 0) {
            showModal('No Templates Found', 'No approved Meta message templates found in your WhatsApp Business Account.');
            return;
        }

        const templateOptions = templates.map(t => `<option value="${t.name}" data-lang="${t.language}">${t.name} (${t.language})</option>`).join('');
        
        const modalHtml = `
            <div style="text-align:left; margin-top:0.75rem;">
                <label style="font-size:0.85rem; color:var(--text-muted); display:block; margin-bottom:0.35rem;">Choose an Approved Meta Template to send:</label>
                <select id="modal-template-select" style="width:100%; padding:0.6rem; border-radius:6px; background:var(--bg-dark); color:var(--text-main); border:1px solid var(--border);">
                    ${templateOptions}
                </select>

                <div id="modal-template-media-group" style="display:none; margin-top:0.75rem;">
                    <div id="modal-meta-header-banner" style="display:none; background:rgba(16, 185, 129, 0.1); border:1px solid rgba(16, 185, 129, 0.3); border-radius:8px; padding:0.75rem; margin-bottom:0.6rem;">
                        <div style="display:flex; align-items:center; gap:0.4rem; color:#10b981; font-weight:600; font-size:0.84rem; margin-bottom:0.3rem;">
                            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg>
                            <span id="modal-meta-header-title">Meta Template Header Attached Automatically</span>
                        </div>
                        <p style="font-size:0.76rem; color:var(--text-muted); margin:0 0 0.5rem 0; line-height:1.4;">
                            Meta's approved content header will be attached automatically when sending. No need to upload again.
                        </p>
                        <div id="modal-meta-header-preview" style="text-align:center; background:var(--bg-dark); border-radius:6px; padding:0.4rem; overflow:hidden;"></div>
                        <button type="button" id="btn-toggle-modal-override" style="margin-top:0.5rem; background:transparent; border:none; color:var(--primary); font-size:0.78rem; cursor:pointer; text-decoration:underline; display:flex; align-items:center; gap:0.3rem; padding:0;">
                            <span>Change or upload custom header media (Optional)</span>
                        </button>
                    </div>

                    <div id="modal-custom-media-container" style="display:none; padding-top:0.35rem;">
                        <label id="modal-template-media-label" style="font-size:0.8rem; color:var(--text-muted); display:block; margin-bottom:0.35rem;">Custom Media Attachment:</label>
                        <select id="modal-template-media-select" style="width:100%; padding:0.6rem; border-radius:6px; background:var(--bg-dark); color:var(--text-main); border:1px solid var(--border); margin-bottom:0.5rem;">
                            <option value="">-- Choose from uploaded media --</option>
                        </select>
                        <div class="file-dropzone" id="modal-dropzone-box" style="padding:0.6rem; text-align:center; border:1px dashed var(--border); border-radius:6px; cursor:pointer;">
                            <span id="modal-dropzone-text" style="font-size:0.8rem; color:var(--text-muted);">Click to browse and upload custom media file</span>
                            <input type="file" id="modal-template-media-file" accept="image/*,video/*" style="display:none">
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        showModal('Send Template Message', 'Select a template to initiate conversation:', 'confirm', async () => {
            const selectEl = document.getElementById('modal-template-select');
            if (!selectEl) return;
            const templateName = selectEl.value;
            const templateLang = selectEl.options[selectEl.selectedIndex].getAttribute('data-lang') || 'en_US';
            
            const tmpl = templates.find(t => t.name === templateName);
            const headerComp = tmpl && tmpl.components ? tmpl.components.find(c => c.type === 'HEADER') : null;
            const requiresMedia = headerComp && ['IMAGE', 'VIDEO', 'DOCUMENT'].includes(headerComp.format);

            let media_id = null;
            let media_type = null;

            if (requiresMedia) {
                media_type = headerComp.format.toLowerCase();
                const mediaSelect = document.getElementById('modal-template-media-select');
                const fileInput = document.getElementById('modal-template-media-file');
                const metaExampleUrl = headerComp?.example?.header_handle?.[0] || headerComp?.example?.header_url?.[0];

                if (mediaSelect && mediaSelect.value) {
                    media_id = mediaSelect.value;
                } else if (fileInput && fileInput.files.length > 0) {
                    const file = fileInput.files[0];
                    const configRes = await fetch('/api/config');
                    const config = await configRes.json();
                    const metaData = await uploadMediaToMetaFast(file, config);
                    media_id = metaData.id;
                    syncToGithubBackground(file, config);
                } else if (metaExampleUrl) {
                    // Auto-attach related content header from Meta!
                    media_id = metaExampleUrl;
                } else {
                    showModal('Media Required', `Template "${templateName}" requires a header ${headerComp.format.toLowerCase()} file. Please select an uploaded file or upload a new file before sending.`);
                    return;
                }
            }

            const sendRes = await fetch('/api/send-message', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({
                    customer_id: activeInboxCustomer,
                    type: 'template',
                    template_name: templateName,
                    template_language: templateLang,
                    media_id: media_id,
                    media_type: media_type
                })
            });
            const result = await sendRes.json();
            if (result.error) {
                showModal('Template Send Error', result.error);
            } else {
                const numId = parseInt(activeInboxCustomer, 10);
                const cust = (inboxCustomersList || []).find(c => c.id === numId || c.id === activeInboxCustomer);
                if (cust) {
                    cust.last_message_at = new Date().toISOString();
                    cust.last_message_content = `[Template] ${templateName}`;
                    cust.last_message_direction = 'outbound';
                    filterAndRenderInboxContacts();
                }
                fetchChatMessages();
            }
        }, 'Send Template', 'btn primary');
        
        const msgEl = document.getElementById('modal-message');
        if (msgEl) {
            msgEl.innerHTML = modalHtml;

            const tSelect = document.getElementById('modal-template-select');
            const dropzoneBox = document.getElementById('modal-dropzone-box');
            const fileInput = document.getElementById('modal-template-media-file');
            const dropzoneText = document.getElementById('modal-dropzone-text');
            const mediaSelect = document.getElementById('modal-template-media-select');
            const btnToggleOverride = document.getElementById('btn-toggle-modal-override');
            const customMediaBox = document.getElementById('modal-custom-media-container');

            if (btnToggleOverride && customMediaBox) {
                btnToggleOverride.onclick = (e) => {
                    e.preventDefault();
                    const isHidden = customMediaBox.style.display === 'none';
                    customMediaBox.style.display = isHidden ? 'block' : 'none';
                    btnToggleOverride.textContent = isHidden ? '▲ Hide custom media options' : '✏️ Change or upload custom header media (Optional)';
                };
            }

            if (dropzoneBox && fileInput) {
                dropzoneBox.onclick = () => fileInput.click();
            }
            if (fileInput) {
                fileInput.onchange = (e) => {
                    if (mediaSelect) mediaSelect.value = '';
                    if (e.target.files.length > 0 && dropzoneText) {
                        dropzoneText.textContent = `Attached: ${e.target.files[0].name}`;
                    }
                };
            }

            const updateModalMediaVisibility = async () => {
                const selName = tSelect ? tSelect.value : null;
                const tmpl = templates.find(t => t.name === selName);
                const headerComp = tmpl && tmpl.components ? tmpl.components.find(c => c.type === 'HEADER') : null;
                const mg = document.getElementById('modal-template-media-group');
                if (!mg) return;

                if (headerComp && ['IMAGE', 'VIDEO', 'DOCUMENT'].includes(headerComp.format)) {
                    const mFormat = headerComp.format.toLowerCase();
                    const metaExampleUrl = headerComp?.example?.header_handle?.[0] || headerComp?.example?.header_url?.[0];
                    mg.style.display = 'block';

                    const autoBanner = document.getElementById('modal-meta-header-banner');
                    const autoPreview = document.getElementById('modal-meta-header-preview');
                    const autoTitle = document.getElementById('modal-meta-header-title');
                    const customContainer = document.getElementById('modal-custom-media-container');

                    if (metaExampleUrl) {
                        if (autoBanner) autoBanner.style.display = 'block';
                        if (autoTitle) autoTitle.textContent = `Meta Approved Header ${headerComp.format} Attached Automatically`;
                        if (autoPreview) {
                            if (mFormat === 'video') {
                                autoPreview.innerHTML = `<video src="${metaExampleUrl}" controls style="max-height:130px; border-radius:6px; max-width:100%; display:block; margin:0 auto;"></video>`;
                            } else {
                                autoPreview.innerHTML = `<img src="${metaExampleUrl}" alt="Template Header" style="max-height:130px; border-radius:6px; object-fit:cover; max-width:100%; display:block; margin:0 auto;">`;
                            }
                        }
                        if (customContainer) customContainer.style.display = 'none';
                    } else {
                        if (autoBanner) autoBanner.style.display = 'none';
                        if (customContainer) customContainer.style.display = 'block';
                        const lbl = document.getElementById('modal-template-media-label');
                        if (lbl) lbl.textContent = `Attach Template Header ${headerComp.format} (Required by Meta):`;
                    }

                    try {
                        const mRes = await fetch('/api/media');
                        const mList = await mRes.json();
                        if (Array.isArray(mList) && mediaSelect) {
                            mediaSelect.innerHTML = '<option value="">-- Select from uploaded files --</option>';
                            mList.filter(m => mFormat === 'video' ? m.is_video : !m.is_video).forEach(m => {
                                mediaSelect.innerHTML += `<option value="${m.url}">${m.name}</option>`;
                            });
                        }
                    } catch(e) {
                        console.error('Failed to load media for template select modal:', e);
                    }
                } else {
                    mg.style.display = 'none';
                }
            };

            if (tSelect) {
                tSelect.onchange = updateModalMediaVisibility;
            }
            updateModalMediaVisibility();
        }
    } catch(e) {
        showModal('Error', 'Failed to load templates: ' + e.message);
    }
});

// --- Media Logic ---
async function loadMedia() {
    const grid = document.getElementById('media-grid');
    if (grid) {
        grid.innerHTML = `<div style="grid-column: 1 / -1;"><div class="loading-spinner-container"><div class="spinner-icon"></div><span>Loading media library...</span></div></div>`;
    }
    try {
        const res = await fetch('/api/media');
        const mediaList = await res.json();
        if (!grid) return;

        if (mediaList.error) {
            grid.innerHTML = `<div class="empty-state">Error: ${mediaList.error}</div>`;
            return;
        }

        if (!Array.isArray(mediaList) || mediaList.length === 0) {
            grid.innerHTML = '<div class="empty-state">No media uploaded yet. Use "Upload New Media" above to add files.</div>';
            return;
        }

        grid.innerHTML = '';
        mediaList.forEach(m => {
            const isVideo = m.type === 'video' || (m.name && m.name.endsWith('.mp4'));
            const safeName = (m.name || 'Media').replace(/'/g, "\\'");
            
            let thumbnailHtml = '';
            if (m.file_url) {
                if (isVideo) {
                    thumbnailHtml = `
                        <div onclick="openMediaPreview('${m.file_url}', true, '${safeName}')" style="position:relative; width:100%; height:160px; background:#000; overflow:hidden; cursor:pointer;" title="Click to Preview">
                            <img src="${m.file_url}" alt="${m.name}" style="width:100%; height:160px; object-fit:cover; opacity:0.85; display:block;">
                            <div style="position:absolute; top:50%; left:50%; transform:translate(-50%,-50%); width:44px; height:44px; border-radius:50%; background:rgba(16, 185, 129, 0.9); display:flex; align-items:center; justify-content:center; color:#fff; font-size:1.1rem; box-shadow: 0 4px 12px rgba(0,0,0,0.4);">▶</div>
                        </div>
                    `;
                } else {
                    thumbnailHtml = `
                        <div onclick="openMediaPreview('${m.file_url}', false, '${safeName}')" style="position:relative; width:100%; height:160px; background:var(--bg-dark); overflow:hidden; cursor:pointer;" title="Click to Preview">
                            <img src="${m.file_url}" alt="${m.name}" style="width:100%; height:160px; object-fit:cover; display:block;">
                        </div>
                    `;
                }
            } else {
                thumbnailHtml = `
                    <div style="width:100%; height:160px; background: linear-gradient(135deg, rgba(16, 185, 129, 0.12), rgba(6, 182, 212, 0.08)); display:flex; flex-direction:column; align-items:center; justify-content:center; padding:1rem; text-align:center; border-bottom:1px solid var(--border);">
                        <div style="font-size:2rem; margin-bottom:0.35rem;">${isVideo ? '🎥' : '🖼️'}</div>
                        <span style="font-size:0.75rem; font-weight:600; color:var(--text-main); text-overflow:ellipsis; overflow:hidden; max-width:100%; white-space:nowrap;">${m.name}</span>
                        <span style="font-size:0.68rem; color:var(--primary); margin-top:0.2rem; font-weight:500;">Meta Cloud ID Active</span>
                    </div>
                `;
            }

            grid.innerHTML += `
                <div class="media-card" style="border-radius:14px; overflow:hidden; border:1px solid var(--border); background:var(--bg-card); transition:transform 0.2s, box-shadow 0.2s;">
                    ${thumbnailHtml}
                    <div class="overlay" style="position:absolute; top:8px; right:8px; z-index:5;">
                        <button class="btn danger sm" style="padding:0.3rem 0.6rem; font-size:0.75rem; border-radius:6px;" onclick="deleteMedia('${m.id}')">Delete</button>
                    </div>
                    <div class="name" style="padding:0.75rem 0.9rem; font-size:0.8rem; font-weight:600; color:var(--text-main); display:flex; align-items:center; justify-content:space-between; gap:0.5rem;">
                        <span style="text-overflow:ellipsis; overflow:hidden; white-space:nowrap;" title="${m.name}">${m.name}</span>
                        <span style="font-size:0.68rem; padding:0.15rem 0.45rem; border-radius:12px; background:rgba(16, 185, 129, 0.15); color:var(--primary); font-weight:700; text-transform:uppercase;">${isVideo ? 'VIDEO' : 'IMAGE'}</span>
                    </div>
                </div>
            `;
        });
    } catch(e) {
        console.error('Error loading media', e);
        document.getElementById('media-grid').innerHTML = '<div class="empty-state">Failed to load media library.</div>';
    }
}

window.deleteMedia = (id) => {
    showModal('Delete Media', 'Are you sure you want to delete this file from your Media Library?', 'confirm', async () => {
        try {
            await fetch(`/api/media?id=${id}`, { method: 'DELETE' });
            loadMedia();
            loadMediaForSelect();
        } catch(e) {
            showModal('Error', 'Failed to delete file.');
        }
    });
};

// Direct Upload from Media Library View
document.getElementById('media-library-upload-input')?.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const btn = document.getElementById('btn-upload-media-library');
    const originalBtnHtml = btn ? btn.innerHTML : '';
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<span class="spinner"></span> Streaming...';
    }

    try {
        const configRes = await fetch('/api/config');
        const config = await configRes.json();

        // 1. Generate local Base64 image/video thumbnail
        let fileUrl = null;
        if (file.type && file.type.startsWith('image')) {
            fileUrl = await generateImageThumbnail(file);
        } else if ((file.type && file.type.startsWith('video')) || file.name.endsWith('.mp4')) {
            fileUrl = await generateVideoThumbnail(file);
        }

        // 2. Stream binary directly to Meta Cloud API fast with percentage indicator!
        const metaData = await uploadMediaToMetaFast(file, config, (percent) => {
            if (btn) btn.innerHTML = `<span class="spinner"></span> Uploading ${percent}%`;
        });

        // 3. Save media record with thumbnail URL into Neon Database
        const fileType = (file.type && file.type.startsWith('video')) || file.name.endsWith('.mp4') ? 'video' : 'image';
        await fetch('/api/media', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                name: file.name,
                type: fileType,
                meta_media_id: metaData.id,
                file_url: fileUrl
            })
        });

        // 4. Non-blocking background sync to GitHub Media Storage if configured
        if (config.github_token) {
            syncToGithubBackground(file, config);
        }

        showModal('Success', `Uploaded ${file.name} to Cloud Media storage successfully!`);
        loadMedia();
        loadMediaForSelect();
    } catch (err) {
        console.error('Media upload error:', err);
        showModal('Upload Error', err.message);
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = originalBtnHtml;
        }
        document.getElementById('media-library-upload-input').value = '';
    }
});