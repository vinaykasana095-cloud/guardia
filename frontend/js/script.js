/**
 * ==========================================================================
 * GUARDIA — Smart Security Door Simulation Engine
 * Architecture: Full-Stack Vanilla JS Frontend communicating with Express REST API & MySQL
 * Version: 3.2 (Virtual Door System Edition)
 * ==========================================================================
 */

document.addEventListener('DOMContentLoaded', () => {
    
    let API_BASE = '/api';
    if (window.location.protocol === 'file:') {
        API_BASE = 'http://localhost:5000/api';
    } else if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
        if (window.location.port !== '5000') {
            API_BASE = 'http://localhost:5000/api';
        } else {
            API_BASE = '/api';
        }
    }
    const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    // ==========================================================================
    // 1. AUDIO SERVICE (Web Audio API Synthesizer)
    // ==========================================================================
    class AudioService {
        constructor() {
            this.ctx = null;
            this.alarmOsc = null;
            this.alarmGain = null;
            this.alarmInterval = null;
        }

        init() {
            if (!this.ctx) {
                const AudioCtx = window.AudioContext || window.webkitAudioContext;
                if (AudioCtx) this.ctx = new AudioCtx();
            }
            if (this.ctx && this.ctx.state === 'suspended') {
                this.ctx.resume();
            }
        }

        playKeyClick() {
            this.init();
            if (!this.ctx) return;
            try {
                const osc = this.ctx.createOscillator();
                const gain = this.ctx.createGain();
                osc.type = 'sine';
                osc.frequency.setValueAtTime(800, this.ctx.currentTime);
                gain.gain.setValueAtTime(0.08, this.ctx.currentTime);
                gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.05);
                osc.connect(gain);
                gain.connect(this.ctx.destination);
                osc.start();
                osc.stop(this.ctx.currentTime + 0.05);
            } catch (e) {}
        }

        playSuccess() {
            this.init();
            if (!this.ctx) return;
            try {
                const now = this.ctx.currentTime;
                const osc1 = this.ctx.createOscillator();
                const osc2 = this.ctx.createOscillator();
                const gain = this.ctx.createGain();

                osc1.type = 'sine';
                osc2.type = 'sine';
                osc1.frequency.setValueAtTime(523.25, now);
                osc2.frequency.setValueAtTime(659.25, now + 0.1);

                gain.gain.setValueAtTime(0.15, now);
                gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

                osc1.connect(gain);
                osc2.connect(gain);
                gain.connect(this.ctx.destination);

                osc1.start(now);
                osc1.stop(now + 0.1);
                osc2.start(now + 0.1);
                osc2.stop(now + 0.35);
            } catch (e) {}
        }

        playError() {
            this.init();
            if (!this.ctx) return;
            try {
                const now = this.ctx.currentTime;
                const osc = this.ctx.createOscillator();
                const gain = this.ctx.createGain();

                osc.type = 'sawtooth';
                osc.frequency.setValueAtTime(150, now);
                gain.gain.setValueAtTime(0.2, now);
                gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);

                osc.connect(gain);
                gain.connect(this.ctx.destination);

                osc.start(now);
                osc.stop(now + 0.3);
            } catch (e) {}
        }

        playLockSound() {
            this.init();
            if (!this.ctx) return;
            try {
                const now = this.ctx.currentTime;
                const osc = this.ctx.createOscillator();
                const gain = this.ctx.createGain();

                osc.type = 'triangle';
                osc.frequency.setValueAtTime(300, now);
                osc.frequency.exponentialRampToValueAtTime(80, now + 0.15);

                gain.gain.setValueAtTime(0.2, now);
                gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);

                osc.connect(gain);
                gain.connect(this.ctx.destination);

                osc.start(now);
                osc.stop(now + 0.15);
            } catch (e) {}
        }

        startAlarmSiren(duration = 4000) {
            this.init();
            if (!this.ctx) return;
            this.stopAlarmSiren();
            try {
                this.alarmOsc = this.ctx.createOscillator();
                this.alarmGain = this.ctx.createGain();

                this.alarmOsc.type = 'sine';
                this.alarmOsc.frequency.setValueAtTime(650, this.ctx.currentTime);
                this.alarmGain.gain.setValueAtTime(0.12, this.ctx.currentTime);

                this.alarmOsc.connect(this.alarmGain);
                this.alarmGain.connect(this.ctx.destination);
                this.alarmOsc.start();

                let high = true;
                this.alarmInterval = setInterval(() => {
                    if (this.alarmOsc && this.ctx) {
                        const freq = high ? 850 : 580;
                        this.alarmOsc.frequency.setTargetAtTime(freq, this.ctx.currentTime, 0.08);
                        high = !high;
                    }
                }, 280);

                if (duration > 0) {
                    this.alarmTimeout = setTimeout(() => {
                        this.stopAlarmSiren();
                    }, duration);
                }
            } catch (e) {}
        }

        stopAlarmSiren() {
            if (this.alarmInterval) {
                clearInterval(this.alarmInterval);
                this.alarmInterval = null;
            }
            if (this.alarmTimeout) {
                clearTimeout(this.alarmTimeout);
                this.alarmTimeout = null;
            }
            if (this.alarmGain && this.ctx) {
                try {
                    this.alarmGain.gain.setValueAtTime(0, this.ctx.currentTime);
                    this.alarmGain.disconnect();
                } catch (e) {}
                this.alarmGain = null;
            }
            if (this.alarmOsc) {
                try {
                    this.alarmOsc.stop();
                    this.alarmOsc.disconnect();
                } catch (e) {}
                this.alarmOsc = null;
            }
        }
    }

    const audio = new AudioService();

    // ==========================================================================
    // 2. APP STATE & CACHED DOM ELEMENTS
    // ==========================================================================
    const state = {
        token: localStorage.getItem('guardia_token') || null,
        user: null,
        doorStatus: 'LOCKED', // Base DB states: 'LOCKED', 'UNLOCKED', 'OPEN'
        uiTransitioning: false, // True during active CSS animations
        securityMode: 'NORMAL',
        powerStatus: 'AC',
        batteryLevel: 100,
        alarmActive: false,
        failedAttempts: 0,
        stats: { totalAttempts: 0, successfulAccess: 0, failedAccess: 0, securityEvents: 0 },
        recentActivity: [],
        logs: [],
        historyFilter: { method: 'all', status: 'all', dateRange: 'all', page: 1, limit: 10 },
        pagination: { total: 0, page: 1, limit: 10, totalPages: 1 },
        serverOnline: true
    };

    const el = {
        // Notifications & Toast
        toastContainer: document.getElementById('toast-container'),

        // Auth Modal & Views
        authModalOverlay: document.getElementById('auth-modal-overlay'),
        authSubtext: document.getElementById('auth-subtext'),
        tabLogin: document.getElementById('tab-login'),
        tabRegister: document.getElementById('tab-register'),
        formLogin: document.getElementById('form-login'),
        formRegister: document.getElementById('form-register'),
        btnGotoRegister: document.getElementById('btn-goto-register'),
        btnGotoLogin: document.getElementById('btn-goto-login'),
        authErrorMsg: document.getElementById('auth-error-msg'),
        userDisplayName: document.getElementById('user-display-name'),
        btnLogout: document.getElementById('btn-logout'),

        // Eye Toggles
        btnLoginSubmit: document.getElementById('btn-login-submit'),
        btnRegisterSubmit: document.getElementById('btn-register-submit'),
        btnToggleLoginPass: document.getElementById('btn-toggle-login-pass'),
        btnToggleRegPass: document.getElementById('btn-toggle-reg-pass'),
        btnToggleRegConfirm: document.getElementById('btn-toggle-reg-confirm'),

        // Header & Connection Status
        clockDisplay: document.getElementById('clock-display'),
        dateDisplay: document.getElementById('date-display'),
        statusDoorText: document.getElementById('status-door-text'),
        statusSecurityLevel: document.getElementById('status-security-level'),
        statusBatteryText: document.getElementById('status-battery-text'),
        statusHealthText: document.getElementById('status-health-text'),
        valPowerSource: document.getElementById('val-power-source'),
        valSecMode: document.getElementById('val-sec-mode'),
        connDot: document.getElementById('conn-dot'),
        valConnStatus: document.getElementById('val-conn-status'),

        // Door Stage
        doorLeaf: document.getElementById('door-leaf'),
        lockBolt: document.getElementById('lock-bolt'),
        lockRingLed: document.getElementById('lock-ring-led'),
        frameLedBar: document.getElementById('frame-led-bar'),
        doorActionIndicator: document.getElementById('door-action-indicator'),

        // Direct Buttons
        btnUnlock: document.getElementById('btn-direct-unlock'),
        btnOpen: document.getElementById('btn-direct-open'),
        btnClose: document.getElementById('btn-direct-close'),
        btnLock: document.getElementById('btn-direct-lock'),

        // Metrics & Stats
        statTotalAttempts: document.getElementById('stat-total-attempts'),
        statSuccess: document.getElementById('stat-successful-access'),
        statFailed: document.getElementById('stat-failed-attempts'),
        statSecurityEvents: document.getElementById('stat-security-events'),

        // Recent Activity
        recentActivityList: document.getElementById('recent-activity-list'),

        // Control Switches & Security Badges
        alarmStatusBadge: document.getElementById('alarm-status-badge'),
        btnActivateAlarm: document.getElementById('btn-activate-alarm'),
        btnDeactivateAlarm: document.getElementById('btn-deactivate-alarm'),

        emergencyStatusBadge: document.getElementById('emergency-status-badge'),
        btnActivateEmergency: document.getElementById('btn-activate-emergency'),
        btnExitEmergency: document.getElementById('btn-exit-emergency'),

        privacyStatusBadge: document.getElementById('privacy-status-badge'),
        btnEnablePrivacy: document.getElementById('btn-enable-privacy'),
        btnDisablePrivacy: document.getElementById('btn-disable-privacy'),

        powerStatusBadge: document.getElementById('power-status-badge'),
        btnSimulatePowerFail: document.getElementById('btn-simulate-power-fail'),
        btnRestorePower: document.getElementById('btn-restore-power'),

        // Access History Filters & Table & Pagination
        historyTableBody: document.getElementById('history-table-body'),
        noLogsMsg: document.getElementById('no-logs-msg'),
        btnExportCsv: document.getElementById('btn-export-csv'),
        btnClearHistory: document.getElementById('btn-clear-history'),
        filterMethod: document.getElementById('filter-method'),
        filterStatus: document.getElementById('filter-status'),
        filterDate: document.getElementById('filter-date'),
        btnApplyFilters: document.getElementById('btn-apply-filters'),
        btnResetFilters: document.getElementById('btn-reset-filters'),
        paginationInfo: document.getElementById('pagination-info'),
        paginationPages: document.getElementById('pagination-pages'),
        btnPagePrev: document.getElementById('btn-page-prev'),
        btnPageNext: document.getElementById('btn-page-next'),

        // Alarm Overlay
        alarmOverlay: document.getElementById('alarm-overlay'),
        btnSilenceAlarm: document.getElementById('btn-silence-alarm'),
        alarmCauseText: document.getElementById('alarm-cause-text'),

        // Access Methods & PIN System
        btnPinSubmit: document.getElementById('btn-pin-submit'),
        btnPinClear: document.getElementById('btn-pin-clear'),
        btnPinBackspace: document.getElementById('btn-pin-backspace'),
        pinMaskedBox: document.getElementById('pin-masked-box'),
        pinStateBadge: document.getElementById('pin-state-badge'),

        // Manage PIN Modal
        pinModalOverlay: document.getElementById('pin-modal-overlay'),
        pinModalError: document.getElementById('pin-modal-error'),
        formManagePin: document.getElementById('form-manage-pin'),
        btnClosePinModal: document.getElementById('btn-close-pin-modal'),
        btnOpenPinModal: document.getElementById('btn-open-pin-modal'),

        fpScanner: document.getElementById('fp-scanner'),
        fpStatusLabel: document.getElementById('fp-status-label'),
        btnTriggerFpScan: document.getElementById('btn-trigger-fp-scan'),

        rfidReader: document.getElementById('rfid-reader'),
        rfidTargetText: document.querySelector('.rfid-target-text'),
        btnOpenRfidModal: document.getElementById('btn-open-rfid-modal'),
        rfidModalOverlay: document.getElementById('rfid-modal-overlay'),
        rfidModalError: document.getElementById('rfid-modal-error'),
        rfidCardsListBox: document.getElementById('rfid-cards-list-box'),
        formAddRfidCard: document.getElementById('form-add-rfid-card'),
        btnCloseRfidModal: document.getElementById('btn-close-rfid-modal'),

        // Mobile App Control Simulation
        appStatusBadge: document.getElementById('app-status-badge'),
        appSecMode: document.getElementById('app-sec-mode'),
        appPowerSource: document.getElementById('app-power-source'),
        appAlarmState: document.getElementById('app-alarm-state'),
        appBtnUnlock: document.getElementById('app-btn-unlock'),
        appBtnOpen: document.getElementById('app-btn-open'),
        appBtnClose: document.getElementById('app-btn-close'),
        appBtnLock: document.getElementById('app-btn-lock'),
        appConnectionDot: document.getElementById('app-connection-dot'),
        appConnectionText: document.getElementById('app-connection-text'),
        appLastSync: document.getElementById('app-last-sync'),

        // Voice Command System
        voiceStage: document.getElementById('voice-stage'),
        voiceMicOuter: document.getElementById('voice-mic-outer'),
        voiceMicBtn: document.getElementById('voice-mic-btn'),
        soundwaveAnim: document.getElementById('soundwave-anim'),
        voiceTranscriptText: document.getElementById('voice-transcript-text'),
        voiceStatusBadge: document.getElementById('voice-status-badge'),
        voiceFeedbackText: document.getElementById('voice-feedback-text'),
        btnVoiceToggle: document.getElementById('btn-voice-toggle'),
        btnVoiceToggleText: document.getElementById('btn-voice-toggle-text'),
        btnOpenVoiceModal: document.getElementById('btn-open-voice-modal'),
        voiceUnsupportedAlert: document.getElementById('voice-unsupported-alert'),
        voiceConfirmBanner: document.getElementById('voice-confirm-banner'),
        voiceConfirmQuestion: document.getElementById('voice-confirm-question'),
        btnVoiceConfirmYes: document.getElementById('btn-voice-confirm-yes'),
        btnVoiceConfirmNo: document.getElementById('btn-voice-confirm-no'),
        voiceModalOverlay: document.getElementById('voice-modal-overlay'),
        voicePresetSelect: document.getElementById('voice-preset-select'),
        voiceCustomInput: document.getElementById('voice-custom-input'),
        btnCloseVoiceModal: document.getElementById('btn-close-voice-modal'),
        btnSubmitVoiceSim: document.getElementById('btn-submit-voice-sim'),

        // Security Switches & Controls
        btnToggleAlarm: document.getElementById('btn-activate-alarm'),
        btnToggleEmergency: document.getElementById('btn-activate-emergency'),
        btnTogglePrivacy: document.getElementById('btn-enable-privacy'),
        btnTogglePower: document.getElementById('btn-simulate-power-fail'),
        statCurrentMode: document.getElementById('val-sec-mode'),
        statBatteryPct: document.getElementById('status-battery-text'),

        // Multi-Module Navigation & Header Breadcrumbs
        navItems: document.querySelectorAll('.sidebar-nav .nav-item'),
        moduleViews: document.querySelectorAll('.module-view'),
        moduleIcon: document.getElementById('module-icon'),
        moduleTitleHeading: document.getElementById('module-title-heading'),
        moduleSubtext: document.getElementById('module-subtext'),
        settingsUserName: document.getElementById('settings-user-name'),
        settingsUserEmail: document.getElementById('settings-user-email'),
        btnSettingManagePin: document.getElementById('btn-setting-manage-pin'),
        btnSettingManageRfid: document.getElementById('btn-setting-manage-rfid')
    };

    // ==========================================================================
    // 3. TOAST NOTIFICATION UTILITY
    // ==========================================================================
    function showToast(message, type = 'info') {
        if (!el.toastContainer) return;
        const toast = document.createElement('div');
        toast.className = `toast-message ${type}`;
        
        let icon = 'ℹ️';
        if (type === 'success') icon = '✅';
        if (type === 'error') icon = '⚠️';

        toast.innerHTML = `<span>${icon}</span> <span>${message}</span>`;
        el.toastContainer.appendChild(toast);

        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transform = 'translateX(100%)';
            setTimeout(() => toast.remove(), 300);
        }, 3200);
    }

    // ==========================================================================
    // 4. API FETCH HELPER (WITH JWT BEARER AUTH)
    // ==========================================================================
    async function apiRequest(endpoint, method = 'GET', body = null) {
        const headers = { 'Content-Type': 'application/json' };
        if (state.token) {
            headers['Authorization'] = `Bearer ${state.token}`;
        }

        try {
            const options = { method, headers };
            if (body) options.body = JSON.stringify(body);

            const res = await fetch(`${API_BASE}${endpoint}`, options);
            const data = await res.json();

            if (res.status === 401 && (data.unauthenticated || (data.message && (data.message.toLowerCase().includes('token') || data.message.toLowerCase().includes('session expired') || data.message.toLowerCase().includes('unauthenticated'))))) {
                logoutUser();
            }

            return data;
        } catch (error) {
            console.error(`API Error on ${endpoint}:`, error);
            el.statusHealthText.textContent = 'BACKEND OFFLINE';
            el.statusHealthText.className = 'value locked-text';
            if (el.appConnectionDot) el.appConnectionDot.className = 'status-dot red';
            if (el.appConnectionText) el.appConnectionText.textContent = 'OFFLINE';
            return { success: false, message: 'Unable to connect to GUARDIA server.' };
        }
    }

    // ==========================================================================
    // 5. CLOCK & UI RENDERERS
    // ==========================================================================
    function updateClock() {
        const now = new Date();
        el.clockDisplay.textContent = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        el.dateDisplay.textContent = now.toLocaleDateString([], { month: 'short', day: '2-digit', year: 'numeric' });
    }
    setInterval(updateClock, 1000);
    updateClock();

    // DYNAMIC CONTROL BUTTON MATRIX
    function updateDoorControlButtons(doorStatus, isTransitioning = false) {
        if (isTransitioning) {
            // Disable ALL buttons during active animations
            el.btnUnlock.disabled = true;
            el.btnOpen.disabled = true;
            el.btnClose.disabled = true;
            el.btnLock.disabled = true;

            if (el.appBtnUnlock) el.appBtnUnlock.disabled = true;
            if (el.appBtnOpen) el.appBtnOpen.disabled = true;
            if (el.appBtnClose) el.appBtnClose.disabled = true;
            if (el.appBtnLock) el.appBtnLock.disabled = true;
            return;
        }

        if (doorStatus === 'LOCKED') {
            el.btnUnlock.disabled = false;
            el.btnOpen.disabled = true;
            el.btnClose.disabled = true;
            el.btnLock.disabled = true;

            if (el.appBtnUnlock) el.appBtnUnlock.disabled = false;
            if (el.appBtnOpen) el.appBtnOpen.disabled = true;
            if (el.appBtnClose) el.appBtnClose.disabled = true;
            if (el.appBtnLock) el.appBtnLock.disabled = true;
        } else if (doorStatus === 'UNLOCKED') {
            el.btnUnlock.disabled = true;
            el.btnOpen.disabled = false;
            el.btnClose.disabled = true;
            el.btnLock.disabled = false;

            if (el.appBtnUnlock) el.appBtnUnlock.disabled = true;
            if (el.appBtnOpen) el.appBtnOpen.disabled = false;
            if (el.appBtnClose) el.appBtnClose.disabled = true;
            if (el.appBtnLock) el.appBtnLock.disabled = false;
        } else if (doorStatus === 'OPEN') {
            el.btnUnlock.disabled = true;
            el.btnOpen.disabled = true;
            el.btnClose.disabled = false;
            el.btnLock.disabled = true;

            if (el.appBtnUnlock) el.appBtnUnlock.disabled = true;
            if (el.appBtnOpen) el.appBtnOpen.disabled = true;
            if (el.appBtnClose) el.appBtnClose.disabled = false;
            if (el.appBtnLock) el.appBtnLock.disabled = true;
        }
    }

    // Direct Door Action Control Button Listeners
    if (el.btnUnlock) {
        el.btnUnlock.addEventListener('click', async () => {
            if (state.uiTransitioning) return;
            if (state.doorStatus !== 'LOCKED') {
                showToast('Door is already unlocked.', 'info');
                return;
            }

            state.uiTransitioning = true;
            updateDoorControlButtons(state.doorStatus, true);

            el.doorActionIndicator.textContent = 'State: UNLOCKING...';
            el.lockRingLed.className = 'lock-ring-led unlocking';
            el.frameLedBar.className = 'frame-led-bar unlocking';
            audio.playLockSound();

            const res = await apiRequest('/door/unlock', 'POST', { method: 'Manual Control' });

            setTimeout(() => {
                state.uiTransitioning = false;
                if (res && res.success) {
                    renderDoorState('UNLOCKED');
                    showToast(res.message || 'Door unlocked successfully.', 'success');
                    fetchAccessHistory();
                    loadDashboard();
                } else {
                    renderDoorState('LOCKED');
                    audio.playError();
                    showToast(res.message || 'Unlock operation failed.', 'error');
                    fetchAccessHistory();
                    loadDashboard();
                }
            }, 800);
        });
    }

    if (el.btnOpen) {
        el.btnOpen.addEventListener('click', async () => {
            if (state.uiTransitioning) return;
            if (state.doorStatus === 'LOCKED') {
                audio.playError();
                showToast('Door is locked. Unlock the door first.', 'error');
                return;
            }
            if (state.doorStatus === 'OPEN') {
                showToast('Door is already open.', 'info');
                return;
            }

            state.uiTransitioning = true;
            updateDoorControlButtons(state.doorStatus, true);

            el.doorActionIndicator.textContent = 'State: OPENING DOOR...';
            el.doorLeaf.className = 'door-leaf opening';

            const res = await apiRequest('/door/open', 'POST', { method: 'Door Hardware' });

            setTimeout(() => {
                state.uiTransitioning = false;
                if (res && res.success) {
                    renderDoorState('OPEN');
                    showToast(res.message || 'Door opened.', 'success');
                    fetchAccessHistory();
                    loadDashboard();
                } else {
                    renderDoorState('UNLOCKED');
                    audio.playError();
                    showToast(res.message || 'Failed to open door.', 'error');
                    fetchAccessHistory();
                    loadDashboard();
                }
            }, 1000);
        });
    }

    if (el.btnClose) {
        el.btnClose.addEventListener('click', async () => {
            if (state.uiTransitioning) return;
            if (state.doorStatus !== 'OPEN') {
                showToast('Door is not open.', 'info');
                return;
            }

            state.uiTransitioning = true;
            updateDoorControlButtons(state.doorStatus, true);

            el.doorActionIndicator.textContent = 'State: CLOSING DOOR...';
            el.doorLeaf.className = 'door-leaf closing';

            const res = await apiRequest('/door/close', 'POST', { method: 'Door Hardware' });

            setTimeout(() => {
                state.uiTransitioning = false;
                if (res && res.success) {
                    renderDoorState('UNLOCKED');
                    showToast(res.message || 'Door closed.', 'success');
                    fetchAccessHistory();
                    loadDashboard();
                } else {
                    renderDoorState('OPEN');
                    audio.playError();
                    showToast(res.message || 'Failed to close door.', 'error');
                    fetchAccessHistory();
                    loadDashboard();
                }
            }, 1000);
        });
    }

    if (el.btnLock) {
        el.btnLock.addEventListener('click', async () => {
            if (state.uiTransitioning) return;
            if (state.doorStatus === 'OPEN') {
                audio.playError();
                showToast('Close the door before locking.', 'error');
                return;
            }
            if (state.doorStatus === 'LOCKED') {
                showToast('Door is already locked.', 'info');
                return;
            }

            state.uiTransitioning = true;
            updateDoorControlButtons(state.doorStatus, true);

            el.doorActionIndicator.textContent = 'State: LOCKING DOOR...';
            el.lockRingLed.className = 'lock-ring-led locking';
            el.frameLedBar.className = 'frame-led-bar locking';
            audio.playLockSound();

            const res = await apiRequest('/door/lock', 'POST', { method: 'Manual Control' });

            setTimeout(() => {
                state.uiTransitioning = false;
                if (res && res.success) {
                    renderDoorState('LOCKED');
                    showToast(res.message || 'Door locked successfully.', 'success');
                    fetchAccessHistory();
                    loadDashboard();
                } else {
                    renderDoorState('UNLOCKED');
                    audio.playError();
                    showToast(res.message || 'Failed to lock door.', 'error');
                    fetchAccessHistory();
                    loadDashboard();
                }
            }, 800);
        });
    }

    function renderDoorState(doorStatus) {
        state.doorStatus = doorStatus;
        if (el.doorLeaf) el.doorLeaf.className = 'door-leaf';

        if (doorStatus === 'UNLOCKED') {
            if (el.doorLeaf) el.doorLeaf.classList.add('unlocked');
            if (el.lockRingLed) el.lockRingLed.className = 'gold-fp-ring-interactive unlocked';
            if (el.frameLedBar) el.frameLedBar.className = 'frame-led-bar unlocked';
            if (el.statusDoorText) {
                el.statusDoorText.textContent = 'UNLOCKED';
                el.statusDoorText.style.color = '#10b981';
                el.statusDoorText.style.textShadow = '0 0 10px rgba(16, 185, 129, 0.8), 0 0 20px rgba(16, 185, 129, 0.4)';
            }
            if (el.doorActionIndicator) el.doorActionIndicator.textContent = 'State: DOOR UNLOCKED';

            if (el.appStatusBadge) {
                el.appStatusBadge.textContent = '🔓 UNLOCKED';
                el.appStatusBadge.style.background = 'rgba(16, 185, 129, 0.2)';
                el.appStatusBadge.style.color = 'var(--emerald-green)';
            }
            updateDoorControlButtons('UNLOCKED');
        } else if (doorStatus === 'OPEN') {
            if (el.doorLeaf) el.doorLeaf.classList.add('unlocked', 'open');
            if (el.lockRingLed) el.lockRingLed.className = 'gold-fp-ring-interactive open';
            if (el.frameLedBar) el.frameLedBar.className = 'frame-led-bar open';
            if (el.statusDoorText) {
                el.statusDoorText.textContent = 'OPEN';
                el.statusDoorText.style.color = '#60a5fa';
                el.statusDoorText.style.textShadow = '0 0 10px rgba(96, 165, 250, 0.8), 0 0 20px rgba(96, 165, 250, 0.4)';
            }
            if (el.doorActionIndicator) el.doorActionIndicator.textContent = 'State: DOOR OPEN';

            if (el.appStatusBadge) {
                el.appStatusBadge.textContent = '🚪 OPEN';
                el.appStatusBadge.style.background = 'rgba(96, 165, 250, 0.2)';
                el.appStatusBadge.style.color = '#60a5fa';
            }
            updateDoorControlButtons('OPEN');
        } else {
            // LOCKED
            if (el.doorLeaf) el.doorLeaf.classList.remove('unlocked', 'open');
            if (el.lockRingLed) el.lockRingLed.className = 'gold-fp-ring-interactive locked';
            if (el.frameLedBar) el.frameLedBar.className = 'frame-led-bar locked';
            if (el.statusDoorText) {
                el.statusDoorText.textContent = 'LOCKED';
                el.statusDoorText.style.color = '#fbbf24';
                el.statusDoorText.style.textShadow = '0 0 10px rgba(251, 191, 36, 0.8), 0 0 20px rgba(251, 191, 36, 0.4)';
            }
            if (el.doorActionIndicator) el.doorActionIndicator.textContent = 'State: DOOR LOCKED';

            if (el.appStatusBadge) {
                el.appStatusBadge.textContent = '🔒 LOCKED';
                el.appStatusBadge.style.background = 'rgba(245, 158, 11, 0.2)';
                el.appStatusBadge.style.color = 'var(--primary-gold)';
            }
            updateDoorControlButtons('LOCKED');
        }
    }

    function renderDashboardData(door, stats) {
        if (!door) return;

        state.securityMode = door.security_mode;
        state.powerStatus = door.power_status;
        state.batteryLevel = door.battery_level || 100;
        state.alarmActive = door.alarm_status === 1;

        if (stats) state.stats = stats;

        // Render door
        if (!state.uiTransitioning) {
            renderDoorState(door.status);
        }

        // Security level header & app status
        if (el.valSecMode) el.valSecMode.textContent = door.security_mode;
        if (el.statCurrentMode) el.statCurrentMode.textContent = door.security_mode;
        if (el.appSecMode) el.appSecMode.textContent = door.security_mode;

        if (door.security_mode === 'EMERGENCY') {
            if (el.statusSecurityLevel) {
                el.statusSecurityLevel.textContent = 'EMERGENCY';
                el.statusSecurityLevel.style.color = 'var(--rose-red)';
            }
        } else if (door.security_mode === 'PRIVACY') {
            if (el.statusSecurityLevel) {
                el.statusSecurityLevel.textContent = 'PRIVACY';
                el.statusSecurityLevel.style.color = 'var(--amber-yellow)';
            }
        } else {
            if (el.statusSecurityLevel) {
                el.statusSecurityLevel.textContent = 'NORMAL';
                el.statusSecurityLevel.style.color = 'var(--text-main)';
            }
        }

        // Power Status
        if (el.valPowerSource) el.valPowerSource.textContent = door.power_status === 'AC' ? 'MAIN POWER' : 'UPS BATTERY';
        if (el.statusBatteryText) el.statusBatteryText.textContent = door.power_status === 'AC' ? 'MAIN POWER' : 'UPS BATTERY';
        if (el.appPowerSource) el.appPowerSource.textContent = door.power_status === 'AC' ? 'MAIN POWER' : 'UPS BATTERY';

        // Alarm System Armed Status
        if (door.alarm_status === 1) {
            if (el.statusHealthText) {
                el.statusHealthText.textContent = 'ARMED';
                el.statusHealthText.className = 'value locked-text';
            }
            if (el.appAlarmState) el.appAlarmState.textContent = 'ARMED';
        } else {
            // Disarmed state
            if (door.security_mode !== 'EMERGENCY' && !state.sirenActive) {
                state.sirenActive = false;
                audio.stopAlarmSiren();
                if (el.alarmOverlay) el.alarmOverlay.classList.add('hidden');
            }

            if (el.statusHealthText) {
                el.statusHealthText.textContent = 'OFF';
                el.statusHealthText.className = 'value text-emerald';
            }
            if (el.appAlarmState) el.appAlarmState.textContent = 'OFF';
        }

        // Show visual alarm/emergency overlay without infinite restart of audio on background polls
        if (door.security_mode === 'EMERGENCY' || state.sirenActive) {
            if (el.alarmOverlay) el.alarmOverlay.classList.remove('hidden');
        } else {
            if (el.alarmOverlay) el.alarmOverlay.classList.add('hidden');
        }

        // --- System Controls Grid 1: Alarm System ---
        if (el.alarmStatusBadge) {
            if (door.alarm_status === 1) {
                el.alarmStatusBadge.textContent = '● ARMED';
                el.alarmStatusBadge.className = 'badge-status-pill active';
            } else {
                el.alarmStatusBadge.textContent = '● OFF';
                el.alarmStatusBadge.className = 'badge-status-pill off';
            }
        }
        if (el.btnActivateAlarm && el.btnDeactivateAlarm) {
            if (door.alarm_status === 1) {
                el.btnActivateAlarm.classList.add('hidden');
                el.btnDeactivateAlarm.classList.remove('hidden');
            } else {
                el.btnActivateAlarm.classList.remove('hidden');
                el.btnDeactivateAlarm.classList.add('hidden');
            }
        }

        // --- System Controls Grid 2: Emergency Mode ---
        if (el.emergencyStatusBadge) {
            if (door.security_mode === 'EMERGENCY') {
                el.emergencyStatusBadge.textContent = 'EMERGENCY';
                el.emergencyStatusBadge.className = 'badge-status-pill emergency';
            } else {
                el.emergencyStatusBadge.textContent = 'NORMAL';
                el.emergencyStatusBadge.className = 'badge-status-pill normal';
            }
        }
        if (el.btnActivateEmergency && el.btnExitEmergency) {
            if (door.security_mode === 'EMERGENCY') {
                el.btnActivateEmergency.classList.add('hidden');
                el.btnExitEmergency.classList.remove('hidden');
            } else {
                el.btnActivateEmergency.classList.remove('hidden');
                el.btnExitEmergency.classList.add('hidden');
            }
        }

        // --- System Controls Grid 3: Privacy Mode ---
        if (el.privacyStatusBadge) {
            if (door.security_mode === 'PRIVACY') {
                el.privacyStatusBadge.textContent = 'PRIVACY';
                el.privacyStatusBadge.className = 'badge-status-pill privacy';
            } else {
                el.privacyStatusBadge.textContent = 'NORMAL';
                el.privacyStatusBadge.className = 'badge-status-pill normal';
            }
        }
        if (el.btnEnablePrivacy && el.btnDisablePrivacy) {
            if (door.security_mode === 'PRIVACY') {
                el.btnEnablePrivacy.classList.add('hidden');
                el.btnDisablePrivacy.classList.remove('hidden');
            } else {
                el.btnEnablePrivacy.classList.remove('hidden');
                el.btnDisablePrivacy.classList.add('hidden');
            }
        }

        // --- System Controls Grid 4: Power System ---
        if (el.powerStatusBadge) {
            if (door.power_status === 'AC') {
                el.powerStatusBadge.textContent = 'MAIN POWER';
                el.powerStatusBadge.className = 'badge-status-pill main';
            } else {
                el.powerStatusBadge.textContent = 'UPS BATTERY';
                el.powerStatusBadge.className = 'badge-status-pill backup';
            }
        }
        if (el.btnSimulatePowerFail && el.btnRestorePower) {
            if (door.power_status === 'AC') {
                el.btnSimulatePowerFail.classList.remove('hidden');
                el.btnRestorePower.classList.add('hidden');
            } else {
                el.btnSimulatePowerFail.classList.add('hidden');
                el.btnRestorePower.classList.remove('hidden');
            }
        }

        // Mobile App Synchronization & Connection Status
        if (el.appConnectionDot) el.appConnectionDot.className = 'status-dot green';
        if (el.appConnectionText) el.appConnectionText.textContent = 'CONNECTED';
        if (el.appLastSync) {
            const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
            el.appLastSync.textContent = `Last synced: ${timeStr}`;
        }

        // Metrics
        if (el.statSuccess) el.statSuccess.textContent = state.stats.success;
        if (el.statFailed) el.statFailed.textContent = state.stats.failed;
        if (el.statTotalAttempts) el.statTotalAttempts.textContent = (state.stats.success || 0) + (state.stats.failed || 0);
        if (el.statBatteryPct) el.statBatteryPct.textContent = `${state.batteryLevel}%`;
    }

    function renderHistoryTable(logs) {
        el.historyTableBody.innerHTML = '';
        if (!logs) logs = state.logs;

        if (logs.length === 0) {
            el.noLogsMsg.classList.remove('hidden');
            return;
        } else {
            el.noLogsMsg.classList.add('hidden');
        }

        logs.forEach(log => {
            const tr = document.createElement('tr');
            let badgeClass = 'badge-system';
            if (log.status === 'granted') badgeClass = 'badge-granted';
            if (log.status === 'denied') badgeClass = 'badge-denied';

            const timeStr = new Date(log.timestamp || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

            tr.innerHTML = `
                <td style="font-family: var(--font-mono); font-size: 0.75rem;">${timeStr}</td>
                <td style="font-weight: 600;">${log.access_method}</td>
                <td><span class="badge-status ${badgeClass}">${log.status.toUpperCase()}</span></td>
                <td>${log.description}</td>
            `;
            el.historyTableBody.appendChild(tr);
        });
    }

    // ==========================================================================
    // 6. AUTHENTICATION & NAVIGATION LOGIC
    // ==========================================================================
    function showAuthModal() { el.authModalOverlay.classList.remove('hidden'); }
    function hideAuthModal() { el.authModalOverlay.classList.add('hidden'); }

    function logoutUser() {
        state.token = null;
        state.user = null;
        localStorage.removeItem('guardia_token');
        showAuthModal();
        audio.stopAlarmSiren();
    }

    function showLoginView() {
        el.tabLogin.classList.add('active');
        el.tabRegister.classList.remove('active');
        el.formLogin.classList.add('active');
        el.formRegister.classList.remove('active');
        el.authErrorMsg.classList.add('hidden');
        el.authSubtext.textContent = 'Access your smart security control dashboard';
    }

    function showRegisterView() {
        el.tabRegister.classList.add('active');
        el.tabLogin.classList.remove('active');
        el.formRegister.classList.add('active');
        el.formLogin.classList.remove('active');
        el.authErrorMsg.classList.add('hidden');
        el.authSubtext.textContent = 'Create a secure user account to manage your smart door';
    }

    el.tabLogin.addEventListener('click', showLoginView);
    el.tabRegister.addEventListener('click', showRegisterView);
    el.btnGotoRegister.addEventListener('click', showRegisterView);
    el.btnGotoLogin.addEventListener('click', showLoginView);

    function setupPasswordToggle(btn, inputId) {
        btn.addEventListener('click', () => {
            const input = document.getElementById(inputId);
            if (input.type === 'password') {
                input.type = 'text';
                btn.textContent = '🔒';
            } else {
                input.type = 'password';
                btn.textContent = '👁️';
            }
        });
    }

    setupPasswordToggle(el.btnToggleLoginPass, 'login-password');
    setupPasswordToggle(el.btnToggleRegPass, 'reg-password');
    setupPasswordToggle(el.btnToggleRegConfirm, 'reg-confirm-password');

    function showAuthError(msg) {
        el.authErrorMsg.textContent = msg;
        el.authErrorMsg.classList.remove('hidden');
    }

    function setButtonLoading(btn, isLoading, loadingText, defaultText) {
        const textSpan = btn.querySelector('.btn-text');
        const spinnerSpan = btn.querySelector('.btn-spinner');

        if (isLoading) {
            btn.disabled = true;
            if (textSpan) textSpan.classList.add('hidden');
            if (spinnerSpan) {
                spinnerSpan.textContent = loadingText;
                spinnerSpan.classList.remove('hidden');
            }
        } else {
            btn.disabled = false;
            if (textSpan) textSpan.classList.remove('hidden');
            if (spinnerSpan) spinnerSpan.classList.add('hidden');
        }
    }

    // --- LOGIN SUBMIT ---
    el.formLogin.addEventListener('submit', async (e) => {
        e.preventDefault();
        el.authErrorMsg.classList.add('hidden');

        const email = document.getElementById('login-email').value.trim();
        const password = document.getElementById('login-password').value;

        if (!email || !password) {
            showAuthError('Please fill in both Email and Password.');
            return;
        }

        if (!EMAIL_REGEX.test(email)) {
            showAuthError('Please enter a valid email address.');
            return;
        }

        setButtonLoading(el.btnLoginSubmit, true, '⏳ Logging in...', 'ACCESS GUARDIA DASHBOARD');

        const data = await apiRequest('/auth/login', 'POST', { email, password });
        setButtonLoading(el.btnLoginSubmit, false, '', 'ACCESS GUARDIA DASHBOARD');

        if (data && data.success) {
            state.token = data.token;
            state.user = data.user;
            localStorage.setItem('guardia_token', data.token);
            if (el.userDisplayName) el.userDisplayName.textContent = data.user.name;
            if (el.settingsUserName) el.settingsUserName.textContent = data.user.name;
            if (el.settingsUserEmail) el.settingsUserEmail.textContent = data.user.email;
            hideAuthModal();
            loadDashboard();
        } else {
            showAuthError(data.message || 'Invalid email or password.');
        }
    });

    // --- REGISTER SUBMIT ---
    el.formRegister.addEventListener('submit', async (e) => {
        e.preventDefault();
        el.authErrorMsg.classList.add('hidden');

        const name = document.getElementById('reg-name').value.trim();
        const email = document.getElementById('reg-email').value.trim();
        const password = document.getElementById('reg-password').value;
        const confirmPassword = document.getElementById('reg-confirm-password').value;

        if (!name || !email || !password || !confirmPassword) {
            showAuthError('All fields are required.');
            return;
        }

        if (!EMAIL_REGEX.test(email)) {
            showAuthError('Please enter a valid email address.');
            return;
        }

        if (password.length < 6) {
            showAuthError('Password must be at least 6 characters long.');
            return;
        }

        if (password !== confirmPassword) {
            showAuthError('Password and Confirm Password do not match.');
            return;
        }

        setButtonLoading(el.btnRegisterSubmit, true, '⏳ Creating Account...', 'CREATE SECURE ACCOUNT');

        const data = await apiRequest('/auth/register', 'POST', { name, email, password, confirmPassword });
        setButtonLoading(el.btnRegisterSubmit, false, '', 'CREATE SECURE ACCOUNT');

        if (data && data.success) {
            state.token = data.token;
            state.user = data.user;
            localStorage.setItem('guardia_token', data.token);
            if (el.userDisplayName) el.userDisplayName.textContent = data.user.name;
            if (el.settingsUserName) el.settingsUserName.textContent = data.user.name;
            if (el.settingsUserEmail) el.settingsUserEmail.textContent = data.user.email;
            hideAuthModal();
            loadDashboard();
        } else {
            showAuthError(data.message || 'Registration failed. Try again.');
        }
    });

    el.btnLogout.addEventListener('click', logoutUser);

    // ==========================================================================
    // 7. DASHBOARD & DATA SYNCHRONIZATION
    // ==========================================================================
    function setServerOnlineState(isOnline) {
        state.serverOnline = isOnline;
        if (el.valConnStatus && el.connDot) {
            if (isOnline) {
                el.connDot.className = 'status-dot green';
                el.valConnStatus.textContent = 'ONLINE';
                el.valConnStatus.style.color = 'var(--emerald-green)';
            } else {
                el.connDot.className = 'status-dot red';
                el.valConnStatus.textContent = 'SERVER OFFLINE';
                el.valConnStatus.style.color = 'var(--rose-red)';
            }
        }
    }

    async function loadDashboard() {
        if (!state.token) {
            showAuthModal();
            return;
        }

        const res = await apiRequest('/dashboard/summary');
        if (res && res.success) {
            setServerOnlineState(true);
            hideAuthModal();
            renderDashboardSummary(res.summary);
            fetchAccessHistory();
        } else if (res && res.message === 'Unable to connect to GUARDIA server.') {
            setServerOnlineState(false);
        } else {
            showAuthModal();
        }
    }

    function renderDashboardSummary(summary) {
        if (!summary) return;
        const { user, door, stats, recentActivity } = summary;

        if (user && user.name) {
            el.userDisplayName.textContent = user.name;
            const avatarEl = document.getElementById('user-avatar-initials');
            if (avatarEl) avatarEl.textContent = user.name.charAt(0).toUpperCase();
        }

        if (door) {
            renderDashboardData(door, stats);
        }

        if (stats) {
            if (el.statTotalAttempts) el.statTotalAttempts.textContent = stats.totalAttempts || 0;
            if (el.statSuccess) el.statSuccess.textContent = stats.successfulAccess || 0;
            if (el.statFailed) el.statFailed.textContent = stats.failedAccess || 0;
            if (el.statSecurityEvents) el.statSecurityEvents.textContent = stats.securityEvents || 0;
        }

        if (recentActivity) {
            renderRecentActivity(recentActivity);
        }
    }

    function renderRecentActivity(recentLogs) {
        if (!el.recentActivityList) return;
        el.recentActivityList.innerHTML = '';

        if (!recentLogs || recentLogs.length === 0) {
            el.recentActivityList.innerHTML = '<div style="text-align:center; padding:16px; color:#64748b; font-size:0.85rem; font-weight:600;">No recent access events recorded.</div>';
            return;
        }

        const topEvents = recentLogs.slice(0, 6);
        topEvents.forEach(item => {
            const div = document.createElement('div');
            div.className = 'recent-item';

            let icon = '🛡️';
            let iconBgClass = 'icon-bg-gold';
            const m = (item.access_method || '').toUpperCase();
            const d = (item.description || '').toUpperCase();

            if (m.includes('PIN')) { icon = '🔢'; iconBgClass = 'icon-bg-blue'; }
            else if (m.includes('FINGER')) { icon = '👆'; iconBgClass = 'icon-bg-gold'; }
            else if (m.includes('RFID')) { icon = '🪪'; iconBgClass = 'icon-bg-purple'; }
            else if (m.includes('MOBILE')) { icon = '📱'; iconBgClass = 'icon-bg-emerald'; }
            else if (m.includes('VOICE')) { icon = '🎙️'; iconBgClass = 'icon-bg-blue'; }
            else if (d.includes('UNLOCKED')) { icon = '🔓'; iconBgClass = 'icon-bg-emerald'; }
            else if (d.includes('LOCKED')) { icon = '🔒'; iconBgClass = 'icon-bg-gold'; }
            else if (d.includes('OPEN')) { icon = '🚪'; iconBgClass = 'icon-bg-blue'; }
            else if (d.includes('CLOSED')) { icon = '🚪'; iconBgClass = 'icon-bg-slate'; }
            else if (m.includes('SYSTEM') || d.includes('ALARM')) { icon = '🚨'; iconBgClass = 'icon-bg-red'; }

            let badgeClass = 'badge-system';
            let badgeText = 'ALERT';
            if (item.status === 'granted') { badgeClass = 'badge-granted'; badgeText = 'SUCCESS'; }
            else if (item.status === 'denied') { badgeClass = 'badge-denied'; badgeText = 'FAILED'; }
            else if (item.status === 'system') { badgeClass = 'badge-system'; badgeText = 'ALERT'; }

            const timeStr = new Date(item.timestamp || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

            div.innerHTML = `
                <div class="recent-left">
                    <div class="recent-icon-badge ${iconBgClass}">${icon}</div>
                    <div class="recent-info-block">
                        <span class="recent-desc-text">${item.description}</span>
                        <span class="recent-method-sub">${item.access_method}</span>
                    </div>
                </div>
                <div class="recent-right">
                    <span class="activity-status-pill ${badgeClass}">${badgeText}</span>
                    <span class="recent-time-text">${timeStr}</span>
                </div>
            `;
            el.recentActivityList.appendChild(div);
        });
    }

    async function fetchAccessHistory() {
        const { method, status, dateRange, page, limit } = state.historyFilter;
        const queryStr = `/access/history?method=${encodeURIComponent(method)}&status=${encodeURIComponent(status)}&dateRange=${encodeURIComponent(dateRange)}&page=${page}&limit=${limit}`;

        const data = await apiRequest(queryStr);
        if (data && data.success) {
            state.logs = data.logs || [];
            if (data.pagination) {
                state.pagination = data.pagination;
            }
            renderHistoryTable(state.logs);
            renderPagination(state.pagination);
        }
    }

    function renderPagination(pagination) {
        if (!el.paginationInfo) return;

        const { total, page, limit, totalPages } = pagination;
        if (!total || total === 0) {
            el.paginationInfo.textContent = 'Showing 0 of 0';
            if (el.btnPagePrev) el.btnPagePrev.disabled = true;
            if (el.btnPageNext) el.btnPageNext.disabled = true;
            if (el.paginationPages) el.paginationPages.innerHTML = '';
            return;
        }

        const start = (page - 1) * limit + 1;
        const end = Math.min(page * limit, total);
        el.paginationInfo.textContent = `Showing ${start}–${end} of ${total}`;

        if (el.btnPagePrev) el.btnPagePrev.disabled = page <= 1;
        if (el.btnPageNext) el.btnPageNext.disabled = page >= totalPages;

        if (el.paginationPages) {
            el.paginationPages.innerHTML = '';
            for (let i = 1; i <= totalPages; i++) {
                if (i === 1 || i === totalPages || (i >= page - 1 && i <= page + 1)) {
                    const btn = document.createElement('button');
                    btn.className = `page-num ${i === page ? 'active' : ''}`;
                    btn.textContent = i;
                    btn.addEventListener('click', () => {
                        state.historyFilter.page = i;
                        fetchAccessHistory();
                    });
                    el.paginationPages.appendChild(btn);
                }
            }
        }
    }

    // ==========================================================================
    // 8. VIRTUAL DOOR STATE MACHINE & DIRECT ACTIONS
    // ==========================================================================

    // --- UNLOCK ACTION ---
    async function executeUnlockAction() {
        if (state.uiTransitioning) return;

        if (state.doorStatus !== 'LOCKED') {
            showToast('Door is already unlocked.', 'info');
            return;
        }

        state.uiTransitioning = true;
        updateDoorControlButtons(state.doorStatus, true);

        // Visual transition: UNLOCKING
        el.doorActionIndicator.textContent = 'State: UNLOCKING...';
        el.lockRingLed.className = 'lock-ring-led unlocking';
        el.frameLedBar.className = 'frame-led-bar unlocking';
        audio.playLockSound();

        const res = await apiRequest('/door/unlock', 'POST');

        setTimeout(() => {
            state.uiTransitioning = false;
            if (res && res.success) {
                renderDoorState('UNLOCKED');
                showToast(res.message || 'Door unlocked successfully', 'success');
                fetchAccessHistory();
            } else {
                renderDoorState('LOCKED');
                audio.playError();
                showToast(res.message || 'Unlock operation failed', 'error');
            }
        }, 800);
    }

    // --- OPEN ACTION ---
    async function executeOpenAction() {
        if (state.uiTransitioning) return;

        // Rule Validation: Cannot open a locked door!
        if (state.doorStatus === 'LOCKED') {
            audio.playError();
            showToast('Access denied. Door is locked.', 'error');
            return;
        }

        if (state.doorStatus === 'OPEN') {
            showToast('Door is already open.', 'info');
            return;
        }

        state.uiTransitioning = true;
        updateDoorControlButtons(state.doorStatus, true);

        // Visual transition: OPENING
        el.doorActionIndicator.textContent = 'State: OPENING...';
        el.doorLeaf.className = 'door-leaf opening';

        const res = await apiRequest('/door/open', 'POST');

        setTimeout(() => {
            state.uiTransitioning = false;
            if (res && res.success) {
                renderDoorState('OPEN');
                showToast(res.message || 'Door opened', 'success');
                fetchAccessHistory();
            } else {
                renderDoorState('UNLOCKED');
                audio.playError();
                showToast(res.message || 'Cannot open door', 'error');
            }
        }, 1000);
    }

    // --- CLOSE ACTION ---
    async function executeCloseAction() {
        if (state.uiTransitioning) return;

        if (state.doorStatus !== 'OPEN') {
            showToast('Door is not currently open.', 'info');
            return;
        }

        state.uiTransitioning = true;
        updateDoorControlButtons(state.doorStatus, true);

        // Visual transition: CLOSING
        el.doorActionIndicator.textContent = 'State: CLOSING...';
        el.doorLeaf.className = 'door-leaf closing';

        const res = await apiRequest('/door/close', 'POST');

        setTimeout(() => {
            state.uiTransitioning = false;
            if (res && res.success) {
                renderDoorState('UNLOCKED');
                showToast(res.message || 'Door closed', 'success');
                fetchAccessHistory();
            } else {
                renderDoorState('OPEN');
                audio.playError();
                showToast(res.message || 'Cannot close door', 'error');
            }
        }, 1000);
    }

    // --- LOCK ACTION ---
    async function executeLockAction() {
        if (state.uiTransitioning) return;

        // Rule Validation: Cannot lock an open door!
        if (state.doorStatus === 'OPEN') {
            audio.playError();
            showToast('Cannot lock an open door. Please close the door first.', 'error');
            return;
        }

        if (state.doorStatus === 'LOCKED') {
            showToast('Door is already locked.', 'info');
            return;
        }

        state.uiTransitioning = true;
        updateDoorControlButtons(state.doorStatus, true);

        // Visual transition: LOCKING
        el.doorActionIndicator.textContent = 'State: LOCKING...';
        el.lockRingLed.className = 'lock-ring-led locking';
        el.frameLedBar.className = 'frame-led-bar locking';
        audio.playLockSound();

        const res = await apiRequest('/door/lock', 'POST');

        setTimeout(() => {
            state.uiTransitioning = false;
            if (res && res.success) {
                renderDoorState('LOCKED');
                showToast(res.message || 'Door locked successfully', 'success');
                fetchAccessHistory();
            } else {
                renderDoorState('UNLOCKED');
                audio.playError();
                showToast(res.message || 'Lock operation failed', 'error');
            }
        }, 800);
    }

    // Bind Direct Control Buttons
    if (el.btnUnlock) el.btnUnlock.addEventListener('click', executeUnlockAction);
    if (el.btnOpen) el.btnOpen.addEventListener('click', executeOpenAction);
    if (el.btnClose) el.btnClose.addEventListener('click', executeCloseAction);
    if (el.btnLock) el.btnLock.addEventListener('click', executeLockAction);



    // --- AUDIT HISTORY FILTERS & EXPORT ---
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            state.currentFilter = btn.dataset.filter;
            fetchAccessHistory();
        });
    });

    el.btnExportCsv.addEventListener('click', () => {
        let csvContent = 'data:text/csv;charset=utf-8,Time,Access Method,Status,Description\n';
        state.logs.forEach(log => {
            const timeStr = new Date(log.timestamp || Date.now()).toLocaleTimeString();
            csvContent += `"${timeStr}","${log.access_method}","${log.status}","${log.description}"\n`;
        });
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement('a');
        link.setAttribute('href', encodedUri);
        link.setAttribute('download', `guardia_db_audit_log_${Date.now()}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    });

    el.btnClearHistory.addEventListener('click', async () => {
        if (confirm('Are you sure you want to clear all MySQL audit logs for this user?')) {
            await apiRequest('/access/history', 'DELETE');
            fetchAccessHistory();
        }
    });

    // Tab Switcher for Access Hub
    const tabBtns = document.querySelectorAll('.access-panel .tab-btn');
    const tabPanes = document.querySelectorAll('.access-panel .tab-pane');
    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            tabBtns.forEach(b => b.classList.remove('active'));
            tabPanes.forEach(p => p.classList.remove('active'));
            btn.classList.add('active');
            document.getElementById(btn.dataset.tab).classList.add('active');
        });
    });

    // ==========================================================================
    // 10. PIN ACCESS SYSTEM & MANAGE PIN MODAL
    // ==========================================================================
    let pinInputVal = '';
    let isPinLockedOut = false;
    let lockoutInterval = null;

    function renderPinDots() {
        if (!el.pinMaskedBox) return;
        el.pinMaskedBox.innerHTML = '';
        const totalDots = Math.max(4, pinInputVal.length);
        for (let i = 0; i < totalDots; i++) {
            const dot = document.createElement('span');
            dot.className = i < pinInputVal.length ? 'pin-dot filled' : 'pin-dot';
            el.pinMaskedBox.appendChild(dot);
        }
    }

    function handlePinDigit(digit) {
        if (isPinLockedOut || state.uiTransitioning) return;
        if (pinInputVal.length < 6) {
            pinInputVal += digit;
            audio.playKeyClick();
            renderPinDots();
        }
    }

    function handlePinBackspace() {
        if (isPinLockedOut || state.uiTransitioning) return;
        if (pinInputVal.length > 0) {
            pinInputVal = pinInputVal.slice(0, -1);
            audio.playKeyClick();
            renderPinDots();
        }
    }

    function clearPinInput() {
        if (isPinLockedOut) return;
        pinInputVal = '';
        renderPinDots();
    }

    function startPinLockoutTimer(seconds) {
        isPinLockedOut = true;
        let remaining = seconds;

        if (el.pinStateBadge) {
            el.pinStateBadge.textContent = `LOCKOUT (${remaining}s)`;
            el.pinStateBadge.style.background = 'rgba(239, 68, 68, 0.2)';
            el.pinStateBadge.style.color = 'var(--rose-red)';
        }

        if (lockoutInterval) clearInterval(lockoutInterval);

        lockoutInterval = setInterval(() => {
            remaining--;
            if (remaining > 0) {
                if (el.pinStateBadge) el.pinStateBadge.textContent = `LOCKOUT (${remaining}s)`;
            } else {
                clearInterval(lockoutInterval);
                lockoutInterval = null;
                isPinLockedOut = false;
                if (el.pinStateBadge) {
                    el.pinStateBadge.textContent = 'ENTER PIN';
                    el.pinStateBadge.style.background = '';
                    el.pinStateBadge.style.color = '';
                }
            }
        }, 1000);
    }

    async function submitPinVerification() {
        if (isPinLockedOut || state.uiTransitioning) return;

        if (!pinInputVal || (pinInputVal.length !== 4 && pinInputVal.length !== 6)) {
            audio.playError();
            if (el.pinStateBadge) {
                el.pinStateBadge.textContent = '4 OR 6 DIGITS REQ';
                el.pinStateBadge.style.color = 'var(--amber-yellow)';
            }
            showToast('PIN must be 4 or 6 digits.', 'error');
            setTimeout(() => {
                if (!isPinLockedOut && el.pinStateBadge) {
                    el.pinStateBadge.textContent = 'ENTER PIN';
                    el.pinStateBadge.style.color = '';
                }
            }, 2000);
            return;
        }

        const submittedPin = pinInputVal;
        pinInputVal = '';
        renderPinDots();

        if (el.pinStateBadge) {
            el.pinStateBadge.textContent = 'VERIFYING...';
            el.pinStateBadge.style.color = 'var(--primary-cyan)';
        }

        const res = await apiRequest('/access/pin/verify', 'POST', { pin: submittedPin });

        if (res && (res.lockout || res.alarmTriggered)) {
            if (res.alarmTriggered) {
                state.sirenActive = true;
                audio.startAlarmSiren();
                if (el.alarmOverlay) el.alarmOverlay.classList.remove('hidden');
            }
            audio.playError();
            showToast(res.message, 'error');
            startPinLockoutTimer(res.lockoutSeconds || 30);
            fetchAccessHistory();
            loadDashboard();
            return;
        }

        if (res && res.success) {
            audio.playSuccess();
            if (el.pinStateBadge) {
                el.pinStateBadge.textContent = 'ACCESS GRANTED';
                el.pinStateBadge.style.color = 'var(--emerald-green)';
            }
            showToast(res.message, 'success');

            if (state.doorStatus === 'LOCKED') {
                state.uiTransitioning = true;
                updateDoorControlButtons(state.doorStatus, true);
                el.doorActionIndicator.textContent = 'State: UNLOCKING...';
                el.lockRingLed.className = 'lock-ring-led unlocking';
                el.frameLedBar.className = 'frame-led-bar unlocking';
                audio.playLockSound();

                setTimeout(() => {
                    state.uiTransitioning = false;
                    renderDoorState('UNLOCKED');
                    fetchAccessHistory();
                    loadDashboard();
                }, 800);
            } else {
                fetchAccessHistory();
                loadDashboard();
            }

            setTimeout(() => {
                if (!isPinLockedOut && el.pinStateBadge) {
                    el.pinStateBadge.textContent = 'ENTER PIN';
                    el.pinStateBadge.style.color = '';
                }
            }, 3000);

        } else {
            audio.playError();
            if (el.pinStateBadge) {
                el.pinStateBadge.textContent = 'ACCESS DENIED';
                el.pinStateBadge.style.color = 'var(--rose-red)';
            }
            showToast(res.message || 'Invalid PIN.', 'error');
            fetchAccessHistory();
            loadDashboard();

            setTimeout(() => {
                if (!isPinLockedOut && el.pinStateBadge) {
                    el.pinStateBadge.textContent = 'ENTER PIN';
                    el.pinStateBadge.style.color = '';
                }
            }, 2500);
        }
    }

    // Keypad On-Screen Click Listeners
    document.querySelectorAll('.keypad .key-btn[data-val]').forEach(btn => {
        btn.addEventListener('click', () => handlePinDigit(btn.dataset.val));
    });

    if (el.btnPinBackspace) el.btnPinBackspace.addEventListener('click', handlePinBackspace);
    if (el.btnPinSubmit) el.btnPinSubmit.addEventListener('click', submitPinVerification);
    if (el.btnPinClear) el.btnPinClear.addEventListener('click', clearPinInput);

    // Global Keydown Listener for Physical Keyboard Input
    document.addEventListener('keydown', (e) => {
        const activeTabPane = document.querySelector('.tab-pane.active');
        const isPinTabActive = activeTabPane && activeTabPane.id === 'pin-tab';
        const isAuthModalOpen = el.authModalOverlay && !el.authModalOverlay.classList.contains('hidden');
        const isPinModalOpen = el.pinModalOverlay && !el.pinModalOverlay.classList.contains('hidden');
        
        const targetTag = e.target.tagName ? e.target.tagName.toLowerCase() : '';
        if (targetTag === 'input' || targetTag === 'textarea' || isAuthModalOpen || isPinModalOpen) {
            return;
        }

        if (isPinTabActive) {
            if (e.key >= '0' && e.key <= '9') {
                e.preventDefault();
                handlePinDigit(e.key);
            } else if (e.key === 'Backspace') {
                e.preventDefault();
                handlePinBackspace();
            } else if (e.key === 'Enter') {
                e.preventDefault();
                submitPinVerification();
            } else if (e.key === 'Escape' || e.key === 'c' || e.key === 'C') {
                clearPinInput();
            }
        }
    });

    // --- MANAGE PIN MODAL LISTENERS ---
    function openPinModal() {
        if (el.pinModalError) el.pinModalError.classList.add('hidden');
        if (el.formManagePin) el.formManagePin.reset();
        if (el.pinModalOverlay) el.pinModalOverlay.classList.remove('hidden');
    }

    function closePinModal() {
        if (el.pinModalOverlay) el.pinModalOverlay.classList.add('hidden');
    }

    if (el.btnOpenPinModal) el.btnOpenPinModal.addEventListener('click', openPinModal);
    if (el.btnOpenPinModalHeader) el.btnOpenPinModalHeader.addEventListener('click', openPinModal);
    if (el.btnClosePinModal) el.btnClosePinModal.addEventListener('click', closePinModal);

    if (el.formManagePin) {
        el.formManagePin.addEventListener('submit', async (e) => {
            e.preventDefault();
            if (el.pinModalError) el.pinModalError.classList.add('hidden');

            const currentPin = document.getElementById('pin-current').value.trim();
            const newPin = document.getElementById('pin-new').value.trim();
            const confirmNewPin = document.getElementById('pin-confirm-new').value.trim();

            if (!newPin || !confirmNewPin) {
                if (el.pinModalError) {
                    el.pinModalError.textContent = 'Please enter New PIN and Confirm New PIN.';
                    el.pinModalError.classList.remove('hidden');
                }
                return;
            }

            if (newPin.length !== 4 && newPin.length !== 6) {
                if (el.pinModalError) {
                    el.pinModalError.textContent = 'PIN must be exactly 4 or 6 numeric digits.';
                    el.pinModalError.classList.remove('hidden');
                }
                return;
            }

            if (newPin !== confirmNewPin) {
                if (el.pinModalError) {
                    el.pinModalError.textContent = 'New PIN and Confirm New PIN do not match.';
                    el.pinModalError.classList.remove('hidden');
                }
                return;
            }

            const btnSubmit = document.getElementById('btn-submit-manage-pin');
            btnSubmit.disabled = true;
            btnSubmit.textContent = 'Saving...';

            const res = await apiRequest('/access/pin/change', 'POST', {
                currentPin: currentPin || undefined,
                newPin,
                confirmNewPin
            });

            btnSubmit.disabled = false;
            btnSubmit.textContent = 'Save Security PIN';

            if (res && res.success) {
                showToast(res.message || 'Security PIN updated successfully.', 'success');
                closePinModal();
                fetchAccessHistory();
            } else {
                audio.playError();
                if (el.pinModalError) {
                    el.pinModalError.textContent = res.message || 'Failed to update PIN.';
                    el.pinModalError.classList.remove('hidden');
                }
            }
        });
    }

    // Initialize PIN dots display
    renderPinDots();

    // ==========================================================================
    // 11. FINGERPRINT AUTHENTICATION SIMULATION
    // ==========================================================================
    let isFpScanning = false;

    async function triggerFingerprintScan() {
        if (isFpScanning || state.uiTransitioning) return;
        isFpScanning = true;

        if (el.btnTriggerFpScan) el.btnTriggerFpScan.disabled = true;

        // Get selected radio option ('authorized' vs 'unauthorized')
        const selectedRadio = document.querySelector('input[name="fp-user"]:checked');
        const printType = selectedRadio ? selectedRadio.value : 'authorized';

        // Phase 1: SCANNING (Laser sweep animation)
        if (el.fpScanner) el.fpScanner.className = 'fp-scanner-zone scanning';
        if (el.fpStatusLabel) el.fpStatusLabel.textContent = 'SCANNING FINGERPRINT...';
        audio.playKeyClick();

        await new Promise(resolve => setTimeout(resolve, 800));

        // Phase 2: VERIFYING (Pulse animation)
        if (el.fpScanner) el.fpScanner.className = 'fp-scanner-zone verifying';
        if (el.fpStatusLabel) el.fpStatusLabel.textContent = 'VERIFYING BIOMETRICS...';

        await new Promise(resolve => setTimeout(resolve, 600));

        // Phase 3: REST API Verification
        const res = await apiRequest('/access/fingerprint/verify', 'POST', { printType });

        if (res && res.success) {
            // SUCCESSFUL VERIFICATION
            audio.playSuccess();
            if (el.fpScanner) el.fpScanner.className = 'fp-scanner-zone success';
            if (el.fpStatusLabel) el.fpStatusLabel.textContent = 'FINGERPRINT VERIFIED';
            showToast(res.message, 'success');

            if (state.doorStatus === 'LOCKED') {
                state.uiTransitioning = true;
                updateDoorControlButtons(state.doorStatus, true);
                el.doorActionIndicator.textContent = 'State: UNLOCKING...';
                el.lockRingLed.className = 'lock-ring-led unlocking';
                el.frameLedBar.className = 'frame-led-bar unlocking';
                audio.playLockSound();

                setTimeout(() => {
                    state.uiTransitioning = false;
                    renderDoorState('UNLOCKED');
                    fetchAccessHistory();
                    loadDashboard();
                }, 800);
            } else {
                fetchAccessHistory();
                loadDashboard();
            }
        } else {
            // FAILED VERIFICATION
            audio.playError();
            if (el.fpScanner) el.fpScanner.className = 'fp-scanner-zone denied';
            if (el.fpStatusLabel) el.fpStatusLabel.textContent = 'FINGERPRINT NOT RECOGNIZED';
            showToast(res.message || 'Fingerprint not recognized.', 'error');
            fetchAccessHistory();
            loadDashboard();
        }

        // Phase 4: RESET SCANNER ZONE TO READY STATE
        setTimeout(() => {
            if (el.fpScanner) el.fpScanner.className = 'fp-scanner-zone';
            if (el.fpStatusLabel) el.fpStatusLabel.textContent = 'PRESS & HOLD TO SCAN';
            if (el.btnTriggerFpScan) el.btnTriggerFpScan.disabled = false;
            isFpScanning = false;
        }, 2500);
    }

    if (el.btnTriggerFpScan) el.btnTriggerFpScan.addEventListener('click', triggerFingerprintScan);
    if (el.fpScanner) el.fpScanner.addEventListener('click', triggerFingerprintScan);

    // ==========================================================================
    // 12. RFID CARD AUTHENTICATION & MANAGEMENT SIMULATION
    // ==========================================================================
    let isRfidScanning = false;

    async function triggerRfidScan(cardId) {
        if (isRfidScanning || state.uiTransitioning) return;
        isRfidScanning = true;

        // Phase 1: READING CARD (Cyan pulsing wave ring)
        if (el.rfidReader) el.rfidReader.className = 'rfid-reader-target reading';
        if (el.rfidTargetText) el.rfidTargetText.textContent = 'READING RFID CHIP...';
        audio.playKeyClick();

        await new Promise(resolve => setTimeout(resolve, 700));

        // Phase 2: VERIFYING CREDENTIAL
        if (el.rfidTargetText) el.rfidTargetText.textContent = 'VERIFYING CREDENTIAL...';

        await new Promise(resolve => setTimeout(resolve, 500));

        // Phase 3: REST API Verification
        const res = await apiRequest('/access/rfid/verify', 'POST', { cardId });

        if (res && res.success) {
            // SUCCESSFUL VERIFICATION
            audio.playSuccess();
            if (el.rfidReader) el.rfidReader.className = 'rfid-reader-target success';
            if (el.rfidTargetText) el.rfidTargetText.textContent = 'RFID CARD VERIFIED';
            showToast(res.message, 'success');

            if (state.doorStatus === 'LOCKED') {
                state.uiTransitioning = true;
                updateDoorControlButtons(state.doorStatus, true);
                el.doorActionIndicator.textContent = 'State: UNLOCKING...';
                el.lockRingLed.className = 'lock-ring-led unlocking';
                el.frameLedBar.className = 'frame-led-bar unlocking';
                audio.playLockSound();

                setTimeout(() => {
                    state.uiTransitioning = false;
                    renderDoorState('UNLOCKED');
                    fetchAccessHistory();
                    loadDashboard();
                }, 800);
            } else {
                fetchAccessHistory();
                loadDashboard();
            }
        } else {
            // FAILED VERIFICATION
            audio.playError();
            if (el.rfidReader) el.rfidReader.className = 'rfid-reader-target denied';
            if (el.rfidTargetText) el.rfidTargetText.textContent = 'UNAUTHORIZED RFID CARD';
            showToast(res.message || 'Unauthorized RFID card.', 'error');
            fetchAccessHistory();
            loadDashboard();
        }

        // Phase 4: RESET READER TO READY STATE
        setTimeout(() => {
            if (el.rfidReader) el.rfidReader.className = 'rfid-reader-target';
            if (el.rfidTargetText) el.rfidTargetText.textContent = 'TAP OR DROP RFID CARD HERE';
            isRfidScanning = false;
        }, 2500);
    }

    // Bind Card Tap Buttons in Deck
    document.querySelectorAll('.rfid-card').forEach(card => {
        const cardId = card.dataset.cardId;
        const tapBtn = card.querySelector('.btn-tap-card');
        if (tapBtn) {
            tapBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                triggerRfidScan(cardId);
            });
        }
        card.addEventListener('click', () => triggerRfidScan(cardId));

        // Drag and Drop simulation handlers
        card.addEventListener('dragstart', (e) => {
            e.dataTransfer.setData('text/plain', cardId);
        });
    });

    if (el.rfidReader) {
        el.rfidReader.addEventListener('dragover', (e) => {
            e.preventDefault();
            el.rfidReader.classList.add('drag-over');
        });
        el.rfidReader.addEventListener('dragleave', () => {
            el.rfidReader.classList.remove('drag-over');
        });
        el.rfidReader.addEventListener('drop', (e) => {
            e.preventDefault();
            el.rfidReader.classList.remove('drag-over');
            const cardId = e.dataTransfer.getData('text/plain');
            if (cardId) triggerRfidScan(cardId);
        });
    }

    // --- RFID MANAGEMENT MODAL HANDLERS ---
    async function loadUserRfidCards() {
        if (!el.rfidCardsListBox) return;
        el.rfidCardsListBox.innerHTML = '<p class="hint-text">Loading RFID cards...</p>';

        const res = await apiRequest('/access/rfid/cards');
        if (res && res.success && res.cards) {
            if (res.cards.length === 0) {
                el.rfidCardsListBox.innerHTML = '<p class="hint-text">No active RFID cards registered.</p>';
                return;
            }

            el.rfidCardsListBox.innerHTML = '';
            res.cards.forEach(card => {
                const item = document.createElement('div');
                item.className = 'rfid-item-row';
                item.innerHTML = `
                    <div class="rfid-item-info">
                        <span class="rfid-item-name">🪪 ${card.cardLabel}</span>
                        <span class="rfid-item-code">${card.maskedCode}</span>
                    </div>
                    <button class="btn btn-danger-outline btn-delete-rfid" data-card-db-id="${card.id}">Revoke Pass</button>
                `;
                el.rfidCardsListBox.appendChild(item);
            });

            // Bind delete/revoke buttons
            el.rfidCardsListBox.querySelectorAll('.btn-delete-rfid').forEach(btn => {
                btn.addEventListener('click', async () => {
                    const cardDbId = btn.dataset.cardDbId;
                    btn.disabled = true;
                    btn.textContent = 'Revoking...';
                    const delRes = await apiRequest(`/access/rfid/cards/${cardDbId}`, 'DELETE');
                    if (delRes && delRes.success) {
                        showToast(delRes.message, 'success');
                        loadUserRfidCards();
                        fetchAccessHistory();
                    } else {
                        showToast(delRes.message || 'Failed to revoke card.', 'error');
                        btn.disabled = false;
                        btn.textContent = 'Revoke Pass';
                    }
                });
            });
        } else {
            el.rfidCardsListBox.innerHTML = '<p class="hint-text">Failed to load RFID cards.</p>';
        }
    }

    function openRfidModal() {
        if (el.rfidModalError) el.rfidModalError.classList.add('hidden');
        if (el.formAddRfidCard) el.formAddRfidCard.reset();
        if (el.rfidModalOverlay) el.rfidModalOverlay.classList.remove('hidden');
        loadUserRfidCards();
    }

    function closeRfidModal() {
        if (el.rfidModalOverlay) el.rfidModalOverlay.classList.add('hidden');
    }

    if (el.btnOpenRfidModal) el.btnOpenRfidModal.addEventListener('click', openRfidModal);
    if (el.btnCloseRfidModal) el.btnCloseRfidModal.addEventListener('click', closeRfidModal);

    if (el.formAddRfidCard) {
        el.formAddRfidCard.addEventListener('submit', async (e) => {
            e.preventDefault();
            if (el.rfidModalError) el.rfidModalError.classList.add('hidden');

            const cardName = document.getElementById('rfid-card-name').value.trim();
            const cardId = document.getElementById('rfid-card-id').value.trim();

            if (!cardName || !cardId) {
                if (el.rfidModalError) {
                    el.rfidModalError.textContent = 'Card Name and Code are required.';
                    el.rfidModalError.classList.remove('hidden');
                }
                return;
            }

            const btnSubmit = document.getElementById('btn-submit-add-rfid');
            btnSubmit.disabled = true;
            btnSubmit.textContent = 'Registering...';

            const res = await apiRequest('/access/rfid/cards', 'POST', { cardName, cardId });

            btnSubmit.disabled = false;
            btnSubmit.textContent = '+ Add RFID Pass';

            if (res && res.success) {
                showToast(res.message || 'RFID card registered successfully.', 'success');
                if (el.formAddRfidCard) el.formAddRfidCard.reset();
                loadUserRfidCards();
                fetchAccessHistory();
            } else {
                audio.playError();
                if (el.rfidModalError) {
                    el.rfidModalError.textContent = res.message || 'Failed to register card.';
                    el.rfidModalError.classList.remove('hidden');
                }
            }
        });
    }

    // ==========================================================================
    // 13. MOBILE APP REMOTE CONTROL SIMULATION
    // ==========================================================================
    async function executeMobileUnlock() {
        if (state.uiTransitioning) return;
        if (state.doorStatus !== 'LOCKED') {
            showToast('Door is already unlocked.', 'info');
            return;
        }

        state.uiTransitioning = true;
        updateDoorControlButtons(state.doorStatus, true);

        el.doorActionIndicator.textContent = 'State: UNLOCKING... (Remote Mobile)';
        el.lockRingLed.className = 'lock-ring-led unlocking';
        el.frameLedBar.className = 'frame-led-bar unlocking';
        if (el.appStatusBadge) el.appStatusBadge.textContent = '⏳ UNLOCKING...';
        audio.playLockSound();

        const res = await apiRequest('/door/unlock', 'POST', { method: 'MOBILE_APP' });

        setTimeout(() => {
            state.uiTransitioning = false;
            if (res && res.success) {
                renderDoorState('UNLOCKED');
                showToast(res.message || 'Door unlocked remotely', 'success');
                fetchAccessHistory();
                loadDashboard();
            } else {
                renderDoorState('LOCKED');
                audio.playError();
                showToast(res.message || 'Remote unlock operation failed', 'error');
                fetchAccessHistory();
                loadDashboard();
            }
        }, 800);
    }

    async function executeMobileOpen() {
        if (state.uiTransitioning) return;

        if (state.doorStatus === 'LOCKED') {
            audio.playError();
            showToast('Door is locked. Unlock the door first.', 'error');
            return;
        }

        if (state.doorStatus === 'OPEN') {
            showToast('Door is already open.', 'info');
            return;
        }

        state.uiTransitioning = true;
        updateDoorControlButtons(state.doorStatus, true);

        el.doorActionIndicator.textContent = 'State: OPENING... (Remote Mobile)';
        el.doorLeaf.className = 'door-leaf opening';
        if (el.appStatusBadge) el.appStatusBadge.textContent = '⏳ OPENING...';

        const res = await apiRequest('/door/open', 'POST', { method: 'MOBILE_APP' });

        setTimeout(() => {
            state.uiTransitioning = false;
            if (res && res.success) {
                renderDoorState('OPEN');
                showToast(res.message || 'Door opened remotely', 'success');
                fetchAccessHistory();
                loadDashboard();
            } else {
                renderDoorState('UNLOCKED');
                audio.playError();
                showToast(res.message || 'Cannot open door', 'error');
                fetchAccessHistory();
                loadDashboard();
            }
        }, 1000);
    }

    async function executeMobileClose() {
        if (state.uiTransitioning) return;

        if (state.doorStatus !== 'OPEN') {
            showToast('Door is not currently open.', 'info');
            return;
        }

        state.uiTransitioning = true;
        updateDoorControlButtons(state.doorStatus, true);

        el.doorActionIndicator.textContent = 'State: CLOSING... (Remote Mobile)';
        el.doorLeaf.className = 'door-leaf closing';
        if (el.appStatusBadge) el.appStatusBadge.textContent = '⏳ CLOSING...';

        const res = await apiRequest('/door/close', 'POST', { method: 'MOBILE_APP' });

        setTimeout(() => {
            state.uiTransitioning = false;
            if (res && res.success) {
                renderDoorState('UNLOCKED');
                showToast(res.message || 'Door closed remotely', 'success');
                fetchAccessHistory();
                loadDashboard();
            } else {
                renderDoorState('OPEN');
                audio.playError();
                showToast(res.message || 'Cannot close door', 'error');
                fetchAccessHistory();
                loadDashboard();
            }
        }, 1000);
    }

    async function executeMobileLock() {
        if (state.uiTransitioning) return;

        if (state.doorStatus === 'OPEN') {
            audio.playError();
            showToast('Close the door before locking.', 'error');
            return;
        }

        if (state.doorStatus === 'LOCKED') {
            showToast('Door is already locked.', 'info');
            return;
        }

        state.uiTransitioning = true;
        updateDoorControlButtons(state.doorStatus, true);

        el.doorActionIndicator.textContent = 'State: LOCKING... (Remote Mobile)';
        el.lockRingLed.className = 'lock-ring-led locking';
        el.frameLedBar.className = 'frame-led-bar locking';
        if (el.appStatusBadge) el.appStatusBadge.textContent = '⏳ LOCKING...';
        audio.playLockSound();

        const res = await apiRequest('/door/lock', 'POST', { method: 'MOBILE_APP' });

        setTimeout(() => {
            state.uiTransitioning = false;
            if (res && res.success) {
                renderDoorState('LOCKED');
                showToast(res.message || 'Door locked remotely', 'success');
                fetchAccessHistory();
                loadDashboard();
            } else {
                renderDoorState('UNLOCKED');
                audio.playError();
                showToast(res.message || 'Remote lock operation failed', 'error');
                fetchAccessHistory();
                loadDashboard();
            }
        }, 800);
    }

    if (el.appBtnUnlock) el.appBtnUnlock.addEventListener('click', executeMobileUnlock);
    if (el.appBtnOpen) el.appBtnOpen.addEventListener('click', executeMobileOpen);
    if (el.appBtnClose) el.appBtnClose.addEventListener('click', executeMobileClose);
    if (el.appBtnLock) el.appBtnLock.addEventListener('click', executeMobileLock);

    // ==========================================================================
    // 14. VOICE COMMAND SYSTEM (WEB SPEECH API + SIMULATION FALLBACK)
    // ==========================================================================
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    let voiceRecognition = null;
    let isListening = false;
    let pendingVoiceAction = null;

    const VOICE_COMMAND_MAP = {
        UNLOCK: [
            "unlock door", "unlock the door", "please unlock door", "please unlock the door",
            "unlock my door", "unlock main door", "unlock the main door", "unlock guardia door",
            "disengage lock", "unlock"
        ],
        LOCK: [
            "lock door", "lock the door", "please lock door", "please lock the door",
            "lock my door", "lock main door", "lock the main door", "lock guardia door",
            "engage lock", "lock"
        ],
        OPEN: [
            "open door", "open the door", "please open door", "please open the door",
            "open my door", "open main door", "open the main door", "open guardia door",
            "swing open door", "open"
        ],
        CLOSE: [
            "close door", "close the door", "please close door", "please close the door",
            "close my door", "close main door", "close the main door", "close guardia door",
            "shut door", "shut the door", "close"
        ],
        ACTIVATE_ALARM: [
            "activate alarm", "turn on alarm", "trigger alarm", "enable alarm",
            "sound alarm", "start alarm", "alarm on"
        ],
        DEACTIVATE_ALARM: [
            "deactivate alarm", "turn off alarm", "silence alarm", "disable alarm",
            "stop alarm", "reset alarm", "alarm off"
        ],
        ENABLE_PRIVACY: [
            "enable privacy mode", "turn on privacy mode", "activate privacy mode",
            "enable privacy", "privacy mode on", "privacy on"
        ],
        DISABLE_PRIVACY: [
            "disable privacy mode", "turn off privacy mode", "deactivate privacy mode",
            "disable privacy", "privacy mode off", "privacy off"
        ]
    };

    function normalizeSpeechText(text) {
        if (!text) return '';
        return text
            .toLowerCase()
            .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?'"]/g, "")
            .replace(/\s+/g, " ")
            .trim();
    }

    function parseVoiceIntent(rawSpeech) {
        const norm = normalizeSpeechText(rawSpeech);
        if (!norm) return { action: 'UNKNOWN', norm, raw: rawSpeech };

        // Informational queries (e.g. "Tell me how to unlock the door") must NOT execute actions
        const informationalPrefixes = ["tell me", "how to", "how do i", "what is", "where is", "show me", "explain"];
        for (const pref of informationalPrefixes) {
            if (norm.startsWith(pref)) {
                return { action: 'UNKNOWN', norm, raw: rawSpeech, reason: 'Informational queries are not executable voice commands.' };
            }
        }

        // Clean conversational polite fillers
        let clean = norm
            .replace(/^(can you|could you|please|would you|hey guardia|guardia)\s+/i, "")
            .trim();

        // Exact array match
        for (const [action, phrases] of Object.entries(VOICE_COMMAND_MAP)) {
            for (const p of phrases) {
                if (clean === p || norm === p) {
                    return { action, norm, raw: rawSpeech };
                }
            }
        }

        // Substring / keyword intent matching
        if (/\bunlock\b/.test(clean) && !/\b(lock|open|close|alarm|privacy)\b/.test(clean.replace('unlock', ''))) {
            return { action: 'UNLOCK', norm, raw: rawSpeech };
        }
        if (/\block\b/.test(clean) && !/\bunlock\b/.test(clean) && !/\b(open|close|alarm|privacy)\b/.test(clean.replace('lock', ''))) {
            return { action: 'LOCK', norm, raw: rawSpeech };
        }
        if (/\bopen\b/.test(clean) && !/\b(lock|unlock|close|alarm|privacy)\b/.test(clean.replace('open', ''))) {
            return { action: 'OPEN', norm, raw: rawSpeech };
        }
        if (/\b(close|shut)\b/.test(clean) && !/\b(lock|unlock|open|alarm|privacy)\b/.test(clean)) {
            return { action: 'CLOSE', norm, raw: rawSpeech };
        }
        if (/\balarm\b/.test(clean)) {
            if (/\b(on|activate|trigger|enable|sound|start)\b/.test(clean)) return { action: 'ACTIVATE_ALARM', norm, raw: rawSpeech };
            if (/\b(off|deactivate|silence|disable|stop|reset)\b/.test(clean)) return { action: 'DEACTIVATE_ALARM', norm, raw: rawSpeech };
        }
        if (/\bprivacy\b/.test(clean)) {
            if (/\b(on|enable|activate|turn on)\b/.test(clean)) return { action: 'ENABLE_PRIVACY', norm, raw: rawSpeech };
            if (/\b(off|disable|deactivate|turn off)\b/.test(clean)) return { action: 'DISABLE_PRIVACY', norm, raw: rawSpeech };
        }

        return { action: 'UNKNOWN', norm, raw: rawSpeech };
    }

    function setVoiceUIStatus(statusType, transcriptText, feedbackMessage) {
        if (el.voiceTranscriptText && transcriptText !== undefined) {
            el.voiceTranscriptText.textContent = `"${transcriptText}"`;
        }
        if (el.voiceFeedbackText && feedbackMessage !== undefined) {
            el.voiceFeedbackText.textContent = feedbackMessage;
        }

        if (el.voiceStatusBadge) {
            el.voiceStatusBadge.className = `voice-status-badge ${statusType.toLowerCase()}`;
            el.voiceStatusBadge.textContent = statusType.toUpperCase();
        }

        // Outer ring & animations
        if (el.voiceMicOuter) {
            el.voiceMicOuter.className = `voice-mic-outer-ring ${statusType === 'listening' ? 'listening' : statusType === 'processing' ? 'processing' : ''}`;
        }
        if (el.soundwaveAnim) {
            if (statusType === 'listening') el.soundwaveAnim.classList.remove('hidden');
            else el.soundwaveAnim.classList.add('hidden');
        }

        // Toggle button label
        if (el.btnVoiceToggle) {
            if (statusType === 'listening') {
                el.btnVoiceToggle.className = 'btn btn-voice-stop full-width';
                if (el.btnVoiceToggleText) el.btnVoiceToggleText.textContent = 'STOP LISTENING';
            } else {
                el.btnVoiceToggle.className = 'btn btn-voice-start full-width';
                if (el.btnVoiceToggleText) el.btnVoiceToggleText.textContent = 'START LISTENING';
            }
        }
    }

    async function executeVoiceIntent(parsedResult) {
        if (!parsedResult) return;
        const { action, norm, raw, reason } = parsedResult;

        // Hide confirmation banner if open
        if (el.voiceConfirmBanner) el.voiceConfirmBanner.classList.add('hidden');

        if (action === 'UNKNOWN') {
            audio.playError();
            setVoiceUIStatus('unrecognized', raw || norm, reason || 'Please use a supported GUARDIA voice command.');
            showToast('Voice Command Not Recognized', 'error');

            // Log unrecognized voice attempt to MySQL
            await apiRequest('/access/voice/log', 'POST', {
                status: 'denied',
                description: `Unrecognized voice command: "${raw || norm}"`
            });
            fetchAccessHistory();
            return;
        }

        setVoiceUIStatus('processing', raw || norm, `Processing command: ${action}...`);

        // Check if sensitive action requires confirmation prompt (e.g. UNLOCK)
        if (action === 'UNLOCK' && state.doorStatus === 'LOCKED') {
            pendingVoiceAction = parsedResult;
            if (el.voiceConfirmQuestion) {
                el.voiceConfirmQuestion.textContent = `Confirm voice command: "Unlock door"?`;
            }
            if (el.voiceConfirmBanner) el.voiceConfirmBanner.classList.remove('hidden');
            setVoiceUIStatus('processing', raw || norm, 'Confirmation required. Press CONFIRM or CANCEL.');
            return;
        }

        await dispatchVoiceAction(action, raw || norm);
    }

    async function dispatchVoiceAction(action, rawText) {
        if (pendingVoiceAction) pendingVoiceAction = null;
        if (el.voiceConfirmBanner) el.voiceConfirmBanner.classList.add('hidden');

        switch (action) {
            case 'UNLOCK':
                await executeMobileUnlock(); // Reuse centralized unlock endpoint logic
                break;
            case 'LOCK':
                await executeMobileLock();
                break;
            case 'OPEN':
                await executeMobileOpen();
                break;
            case 'CLOSE':
                await executeMobileClose();
                break;
            case 'ACTIVATE_ALARM':
                if (!state.alarmActive) {
                    await handleToggleAlarm('VOICE');
                } else {
                    showToast('Alarm is already active.', 'info');
                }
                break;
            case 'DEACTIVATE_ALARM':
                if (state.alarmActive) {
                    await handleToggleAlarm('VOICE');
                } else {
                    showToast('Alarm is currently off.', 'info');
                }
                break;
            case 'ENABLE_PRIVACY':
                if (state.securityMode !== 'PRIVACY') {
                    await handleTogglePrivacy('VOICE');
                } else {
                    showToast('Privacy Mode is already active.', 'info');
                }
                break;
            case 'DISABLE_PRIVACY':
                if (state.securityMode === 'PRIVACY') {
                    await handleTogglePrivacy('VOICE');
                } else {
                    showToast('Privacy Mode is currently disabled.', 'info');
                }
                break;
        }

        setVoiceUIStatus('accepted', rawText, `✓ COMMAND ACCEPTED: Executed ${action}`);
        audio.playSuccess();

        setTimeout(() => {
            setVoiceUIStatus('ready', 'Press Start Listening or select command', 'Click button to activate speech recognition.');
        }, 3500);
    }

    // Helper functions for security controls with method parameter
    async function handleToggleAlarm(method = 'Manual Control') {
        const endpoint = state.alarmActive ? '/security/alarm/deactivate' : '/security/alarm/activate';
        const res = await apiRequest(endpoint, 'POST', { method });
        if (res && res.success) {
            showToast(res.message, res.alarmStatus === 1 ? 'warning' : 'info');
            await loadDashboard();
        } else if (res) {
            showToast(res.message || 'Alarm action failed.', 'error');
        }
    }

    async function handleTogglePrivacy(method = 'Manual Control') {
        const endpoint = state.securityMode === 'PRIVACY' ? '/security/privacy/disable' : '/security/privacy/enable';
        const res = await apiRequest(endpoint, 'POST', { method });
        if (res && res.success) {
            showToast(res.message, res.securityMode === 'PRIVACY' ? 'warning' : 'info');
            await loadDashboard();
        } else if (res) {
            showToast(res.message || 'Privacy action failed.', 'error');
        }
    }

    // Direct Security Control Event Listeners
    if (el.btnActivateAlarm) {
        el.btnActivateAlarm.addEventListener('click', async () => {
            const res = await apiRequest('/security/alarm/activate', 'POST', { method: 'Manual Control' });
            if (res && res.success) {
                audio.playSuccess();
                showToast('Security Alarm System ARMED — Monitoring for intrusions.', 'info');
                await loadDashboard();
            } else if (res) {
                showToast(res.message || 'Failed to activate alarm.', 'error');
            }
        });
    }

    if (el.btnDeactivateAlarm) {
        el.btnDeactivateAlarm.addEventListener('click', async () => {
            state.sirenActive = false;
            audio.stopAlarmSiren();
            if (el.alarmOverlay) el.alarmOverlay.classList.add('hidden');
            const res = await apiRequest('/security/alarm/deactivate', 'POST', { method: 'Manual Control' });
            if (res && res.success) {
                audio.playKeyClick();
                showToast('Security Alarm System DISARMED.', 'info');
                await loadDashboard();
            } else if (res) {
                showToast(res.message || 'Failed to deactivate alarm.', 'error');
            }
        });
    }

    if (el.btnSilenceAlarm) {
        el.btnSilenceAlarm.addEventListener('click', async () => {
            state.sirenActive = false;
            audio.stopAlarmSiren();
            if (el.alarmOverlay) el.alarmOverlay.classList.add('hidden');
            await apiRequest('/security/alarm/deactivate', 'POST', { method: 'Manual Control' });
            if (state.securityMode === 'EMERGENCY') {
                await apiRequest('/security/emergency/deactivate', 'POST');
            }
            showToast('Alarm silenced and reset to normal', 'info');
            await loadDashboard();
        });
    }

    if (el.btnActivateEmergency) {
        el.btnActivateEmergency.addEventListener('click', async () => {
            const res = await apiRequest('/security/emergency/activate', 'POST');
            if (res && res.success) {
                state.sirenActive = true;
                audio.startAlarmSiren(3500);
                showToast(res.message, 'error');
                await loadDashboard();
            } else if (res) {
                showToast(res.message || 'Failed to activate emergency mode.', 'error');
            }
        });
    }

    if (el.btnExitEmergency) {
        el.btnExitEmergency.addEventListener('click', async () => {
            state.sirenActive = false;
            audio.stopAlarmSiren();
            if (el.alarmOverlay) el.alarmOverlay.classList.add('hidden');
            const res = await apiRequest('/security/emergency/deactivate', 'POST');
            if (res && res.success) {
                showToast(res.message, 'info');
                await loadDashboard();
            } else if (res) {
                showToast(res.message || 'Failed to deactivate emergency mode.', 'error');
            }
        });
    }

    if (el.btnEnablePrivacy) {
        el.btnEnablePrivacy.addEventListener('click', async () => {
            const res = await apiRequest('/security/privacy/enable', 'POST', { method: 'Manual Control' });
            if (res && res.success) {
                showToast(res.message, 'warning');
                await loadDashboard();
            } else if (res) {
                showToast(res.message || 'Failed to enable privacy mode.', 'error');
            }
        });
    }

    if (el.btnDisablePrivacy) {
        el.btnDisablePrivacy.addEventListener('click', async () => {
            const res = await apiRequest('/security/privacy/disable', 'POST', { method: 'Manual Control' });
            if (res && res.success) {
                showToast(res.message, 'info');
                await loadDashboard();
            } else if (res) {
                showToast(res.message || 'Failed to disable privacy mode.', 'error');
            }
        });
    }

    if (el.btnSimulatePowerFail) {
        el.btnSimulatePowerFail.addEventListener('click', async () => {
            const res = await apiRequest('/security/power/failure', 'POST');
            if (res && res.success) {
                showToast(res.message, 'warning');
                await loadDashboard();
            } else if (res) {
                showToast(res.message || 'Failed to simulate power failure.', 'error');
            }
        });
    }

    if (el.btnRestorePower) {
        el.btnRestorePower.addEventListener('click', async () => {
            const res = await apiRequest('/security/power/restore', 'POST');
            if (res && res.success) {
                showToast(res.message, 'info');
                await loadDashboard();
            } else if (res) {
                showToast(res.message || 'Failed to restore main power.', 'error');
            }
        });
    }

    // Initialize Web Speech API Engine
    function initSpeechRecognition() {
        if (!SpeechRecognition) {
            if (el.voiceUnsupportedAlert) el.voiceUnsupportedAlert.classList.remove('hidden');
            return null;
        }

        try {
            const rec = new SpeechRecognition();
            rec.continuous = false;
            rec.interimResults = true;
            rec.lang = 'en-US';

            rec.onstart = () => {
                isListening = true;
                setVoiceUIStatus('listening', 'Listening for voice command...', 'Speak clearly into your microphone...');
                audio.playKeyClick();
            };

            rec.onresult = (event) => {
                let transcript = '';
                for (let i = event.resultIndex; i < event.results.length; ++i) {
                    transcript += event.results[i][0].transcript;
                }
                if (el.voiceTranscriptText) {
                    el.voiceTranscriptText.textContent = `"${transcript}"`;
                }
            };

            rec.onerror = (event) => {
                console.warn('SpeechRecognition Error:', event.error);
                isListening = false;
                audio.playError();
                
                let errDesc = 'Speech recognition error occurred.';
                if (event.error === 'not-allowed') errDesc = 'Microphone permission denied by user/browser.';
                else if (event.error === 'no-speech') errDesc = 'No speech was detected. Please try speaking again.';
                else if (event.error === 'network') errDesc = 'Network error during speech recognition.';

                setVoiceUIStatus('rejected', 'Speech Error', errDesc);
                showToast(errDesc, 'error');

                setTimeout(() => {
                    setVoiceUIStatus('ready', 'Click Start Listening to retry', 'Press button to activate microphone.');
                }, 3000);
            };

            rec.onend = () => {
                if (isListening) {
                    isListening = false;
                    const finalCapturedText = el.voiceTranscriptText ? el.voiceTranscriptText.textContent.replace(/"/g, '') : '';
                    
                    if (finalCapturedText && !finalCapturedText.includes('Listening for voice') && !finalCapturedText.includes('Press Start Listening')) {
                        const parsed = parseVoiceIntent(finalCapturedText);
                        executeVoiceIntent(parsed);
                    } else {
                        setVoiceUIStatus('ready', 'No speech detected', 'Click button to try again.');
                    }
                }
            };

            return rec;
        } catch (e) {
            console.error('Failed to initialize SpeechRecognition:', e);
            if (el.voiceUnsupportedAlert) el.voiceUnsupportedAlert.classList.remove('hidden');
            return null;
        }
    }

    voiceRecognition = initSpeechRecognition();

    function toggleVoiceListening() {
        if (isListening) {
            if (voiceRecognition) {
                try { voiceRecognition.stop(); } catch(e) {}
            }
            isListening = false;
            setVoiceUIStatus('ready', 'Listening stopped', 'Voice recognition deactivated.');
        } else {
            if (!voiceRecognition) {
                openVoiceModal();
                showToast('Web Speech API not supported in this browser. Use simulation modal.', 'info');
                return;
            }
            try {
                voiceRecognition.start();
            } catch (err) {
                console.error('Error starting voice recognition:', err);
                openVoiceModal();
            }
        }
    }

    if (el.btnVoiceToggle) el.btnVoiceToggle.addEventListener('click', toggleVoiceListening);
    if (el.voiceMicBtn) el.voiceMicBtn.addEventListener('click', toggleVoiceListening);

    // Confirmation banner listeners
    if (el.btnVoiceConfirmYes) {
        el.btnVoiceConfirmYes.addEventListener('click', () => {
            if (pendingVoiceAction) {
                dispatchVoiceAction(pendingVoiceAction.action, pendingVoiceAction.raw || pendingVoiceAction.norm);
            }
        });
    }
    if (el.btnVoiceConfirmNo) {
        el.btnVoiceConfirmNo.addEventListener('click', () => {
            pendingVoiceAction = null;
            if (el.voiceConfirmBanner) el.voiceConfirmBanner.classList.add('hidden');
            setVoiceUIStatus('ready', 'Command cancelled', 'Voice action cancelled by user.');
        });
    }

    // Supported command chip click handlers
    document.querySelectorAll('.cmd-chip').forEach(chip => {
        chip.addEventListener('click', () => {
            const command = chip.dataset.cmd;
            if (command) {
                const parsed = parseVoiceIntent(command);
                executeVoiceIntent(parsed);
            }
        });
    });

    // Voice Simulation Modal Handlers
    function openVoiceModal() {
        if (el.voiceModalOverlay) el.voiceModalOverlay.classList.remove('hidden');
    }

    function closeVoiceModal() {
        if (el.voiceModalOverlay) el.voiceModalOverlay.classList.add('hidden');
    }

    if (el.btnOpenVoiceModal) el.btnOpenVoiceModal.addEventListener('click', openVoiceModal);
    if (el.btnCloseVoiceModal) el.btnCloseVoiceModal.addEventListener('click', closeVoiceModal);

    if (el.btnSubmitVoiceSim) {
        el.btnSubmitVoiceSim.addEventListener('click', () => {
            const customVal = el.voiceCustomInput ? el.voiceCustomInput.value.trim() : '';
            const selectVal = el.voicePresetSelect ? el.voicePresetSelect.value : 'unlock door';
            const finalSpeech = customVal || selectVal;

            closeVoiceModal();
            if (el.voiceCustomInput) el.voiceCustomInput.value = '';

            const parsed = parseVoiceIntent(finalSpeech);
            executeVoiceIntent(parsed);
        });
    }

    // Filter controls listeners
    if (el.btnApplyFilters) {
        el.btnApplyFilters.addEventListener('click', () => {
            state.historyFilter.method = el.filterMethod ? el.filterMethod.value : 'all';
            state.historyFilter.status = el.filterStatus ? el.filterStatus.value : 'all';
            state.historyFilter.dateRange = el.filterDate ? el.filterDate.value : 'all';
            state.historyFilter.page = 1;
            fetchAccessHistory();
        });
    }

    if (el.btnResetFilters) {
        el.btnResetFilters.addEventListener('click', () => {
            if (el.filterMethod) el.filterMethod.value = 'all';
            if (el.filterStatus) el.filterStatus.value = 'all';
            if (el.filterDate) el.filterDate.value = 'all';
            state.historyFilter = { method: 'all', status: 'all', dateRange: 'all', page: 1, limit: 10 };
            fetchAccessHistory();
        });
    }

    if (el.btnPagePrev) {
        el.btnPagePrev.addEventListener('click', () => {
            if (state.historyFilter.page > 1) {
                state.historyFilter.page -= 1;
                fetchAccessHistory();
            }
        });
    }

    if (el.btnPageNext) {
        el.btnPageNext.addEventListener('click', () => {
            if (state.historyFilter.page < state.pagination.totalPages) {
                state.historyFilter.page += 1;
                fetchAccessHistory();
            }
        });
    }

    // Method Card & Access Method Tab Click Listeners
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const targetTabId = btn.dataset.tab;
            if (!targetTabId) return;

            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            document.querySelectorAll('.tab-pane').forEach(pane => {
                if (pane.id === targetTabId) {
                    pane.classList.add('active');
                } else {
                    pane.classList.remove('active');
                }
            });
            audio.playKeyClick();
        });
    });

    document.querySelectorAll('.method-card').forEach(card => {
        card.addEventListener('click', () => {
            const targetTab = card.dataset.targetTab;
            if (targetTab) {
                document.querySelectorAll('.method-card').forEach(c => c.classList.remove('active-card'));
                card.classList.add('active-card');

                const tabBtn = document.querySelector(`.tab-btn[data-tab="${targetTab}"]`);
                if (tabBtn) tabBtn.click();
            }
        });
    });

    // Periodic Live Dashboard Synchronization (every 8 seconds)
    setInterval(() => {
        if (state.token && !state.uiTransitioning) {
            loadDashboard();
        }
    }, 8000);

    // ==========================================================================
    // MULTI-MODULE SIDEBAR NAVIGATION & BREADCRUMBS
    // ==========================================================================
    function initModuleNavigation() {
        const navItems = document.querySelectorAll('.sidebar-nav .nav-item');
        const moduleViews = document.querySelectorAll('.module-view');

        if (navItems.length === 0) return;

        navItems.forEach(item => {
            item.addEventListener('click', (e) => {
                const targetBtn = e.currentTarget;
                const targetViewId = targetBtn.dataset.view;
                const viewTitle = targetBtn.dataset.title || 'Guardia Security Center';
                const viewIcon = targetBtn.dataset.icon || '📊';
                const viewSubtext = targetBtn.dataset.subtext || 'Smart security control center';

                // Update active state in sidebar nav items
                navItems.forEach(n => n.classList.remove('active'));
                targetBtn.classList.add('active');

                // Switch module views
                moduleViews.forEach(v => {
                    if (v.id === targetViewId) {
                        v.classList.add('active');
                    } else {
                        v.classList.remove('active');
                    }
                });

                // Update top bar breadcrumb header title, icon & subtext
                if (el.moduleTitleHeading) el.moduleTitleHeading.textContent = viewTitle;
                if (el.moduleIcon) el.moduleIcon.textContent = viewIcon;
                if (el.moduleSubtext) el.moduleSubtext.textContent = viewSubtext;

                if (targetViewId === 'view-history') {
                    fetchAccessHistory();
                } else if (targetViewId === 'view-settings') {
                    if (state.user) {
                        if (el.settingsUserName) el.settingsUserName.textContent = state.user.name || 'User';
                        if (el.settingsUserEmail) el.settingsUserEmail.textContent = state.user.email || 'email@example.com';
                    }
                }

                audio.playKeyClick();
            });
        });

        // Hero CTA button handler -> Navigate to Access Methods / HOW IT WORKS
        const btnHeroCta = document.getElementById('btn-hero-cta');
        if (btnHeroCta) {
            btnHeroCta.addEventListener('click', () => {
                const navAccessBtn = document.getElementById('nav-access-methods');
                if (navAccessBtn) navAccessBtn.click();
            });
        }

        // Top Settings Gear button handler -> Navigate to Settings
        const btnTopGear = document.getElementById('btn-top-settings-gear');
        if (btnTopGear) {
            btnTopGear.addEventListener('click', () => {
                navItems.forEach(n => n.classList.remove('active'));
                moduleViews.forEach(v => {
                    if (v.id === 'view-settings') {
                        v.classList.add('active');
                    } else {
                        v.classList.remove('active');
                    }
                });
                if (el.moduleTitleHeading) el.moduleTitleHeading.textContent = 'Credentials & System Settings';
                if (el.moduleIcon) el.moduleIcon.textContent = '⚙️';
                if (el.moduleSubtext) el.moduleSubtext.textContent = 'User profile, credential management, security configuration & system info';
                if (state.user) {
                    if (el.settingsUserName) el.settingsUserName.textContent = state.user.name || 'User';
                    if (el.settingsUserEmail) el.settingsUserEmail.textContent = state.user.email || 'email@example.com';
                }
                audio.playKeyClick();
            });
        }

        // Interactive Fingerprint Ring Touch on Arched Door Card
        const fpRingDoor = document.getElementById('lock-ring-led');
        if (fpRingDoor) {
            fpRingDoor.addEventListener('click', () => {
                const btnTriggerFp = document.getElementById('btn-trigger-fp-scan');
                if (btnTriggerFp) {
                    const navAccessBtn = document.getElementById('nav-access-methods');
                    if (navAccessBtn) navAccessBtn.click();
                    const fpTabBtn = document.querySelector('.tab-btn[data-tab="fingerprint-tab"]');
                    if (fpTabBtn) fpTabBtn.click();
                    setTimeout(() => btnTriggerFp.click(), 100);
                }
            });
        }

        // Settings Buttons launching existing modals
        if (el.btnSettingManagePin) {
            el.btnSettingManagePin.addEventListener('click', () => {
                openPinModal();
            });
        }
        if (el.btnSettingManageRfid) {
            el.btnSettingManageRfid.addEventListener('click', () => {
                openRfidModal();
            });
        }
    }

    initModuleNavigation();

    // --- INITIAL SESSION ROUTER ---
    if (state.token) {
        apiRequest('/auth/me').then(res => {
            if (res && res.success) {
                state.user = res.user;
                if (el.userDisplayName) el.userDisplayName.textContent = res.user.name;
                const inputContactName = document.getElementById('contact-name');
                const inputContactEmail = document.getElementById('contact-email');
                if (inputContactName && res.user.name) inputContactName.value = res.user.name;
                if (inputContactEmail && res.user.email) inputContactEmail.value = res.user.email;
                loadDashboard();
            } else {
                logoutUser();
            }
        });
    } else {
        showAuthModal();
    }

    // --- CONTACT FORM SUBMISSION HANDLER ---
    const formContactUs = document.getElementById('form-contact-us');
    if (formContactUs) {
        formContactUs.addEventListener('submit', (e) => {
            e.preventDefault();
            audio.playSuccess();
            showToast('Your message has been sent successfully! Our security team will contact you shortly.', 'success');
            const currentName = document.getElementById('contact-name')?.value;
            const currentEmail = document.getElementById('contact-email')?.value;
            formContactUs.reset();
            if (currentName && document.getElementById('contact-name')) document.getElementById('contact-name').value = currentName;
            if (currentEmail && document.getElementById('contact-email')) document.getElementById('contact-email').value = currentEmail;
        });
    }

    console.log('🛡️ GUARDIA Security Dashboard Engine Initialized.');
});
