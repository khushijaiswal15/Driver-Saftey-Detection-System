// script.js (UPDATED with Forgot Password Flow - FULL VERSION)

// --- GLOBAL STATE ---
const state = {
    isAuthenticated: false,
    currentPage: 'dashboard',
    user: null,
    isCapturing: false,
    isProcessing: false,
    activeTrip: null,
    alerts: [],
    isMuted: false,
    volume: 80,
    tripDuration: 0,
    alertIntervalId: null,
    trips: [],
    selectedTrip: null,
    tripEvents: [],
    safetyScore: null,
    reportsLoading: false,
    activeTab: 'history',
};

// --- UTILITIES & CONFIGURATION ---
const FAKE_USER = { id: 'd-4567', name: 'Pankaj Chilkoti ', role: 'driver', email: 'Pankaj@example.com' };
const ALERT_TYPES = ['drowsiness', 'yawning', 'smoking', 'mobile phone use', 'seat belt absence', 'speeding', 'seat belt absence'];
const API_BASE_URL = 'http://localhost:8080/api';
const ALERT_SOUND_URL = 'https://s3.amazonaws.com/cdn.freshdesk.com/data/helpdesk/attachments/production/60007877148/original/alarm-horn-01.mp3?1577749437';
const audioPlayer = new Audio(ALERT_SOUND_URL);
let tripTimerInterval = null;

const getIconHtml = (iconName, classes = 'w-5 h-5') => `<i data-lucide="${iconName}" class="${classes}"></i>`;
const getRandomAlert = () => ({ id: crypto.randomUUID(), type: ALERT_TYPES[Math.floor(Math.random() * ALERT_TYPES.length)], severity: Math.random() < 0.2 ? 'High' : (Math.random() < 0.6 ? 'Medium' : 'Low'), timestamp: new Date().toISOString(), location: '30.3398 N, 78.0263 E' });
const formatDuration = (seconds) => { const h = Math.floor(seconds / 3600).toString().padStart(2, '0'); const m = Math.floor((seconds % 3600) / 60).toString().padStart(2, '0'); const s = Math.floor(seconds % 60).toString().padStart(2, '0'); return `${h}:${m}:${s}`; };
const initializeIcons = () => { if (window.lucide && window.lucide.createIcons) window.lucide.createIcons(); };

// --- UI RENDER FUNCTIONS ---
const updateSidebar = () => {
    document.getElementById('username-display').textContent = state.user?.name || 'Guest';
    document.getElementById('user-role').textContent = state.user?.role || '';
    ['dashboard', 'reports'].forEach(page => {
        const btn = document.getElementById(`nav-${page}`);
        if (btn) {
            btn.classList.toggle('bg-indigo-600', state.currentPage === page);
            btn.classList.toggle('border-l-4', state.currentPage === page);
            btn.classList.toggle('border-indigo-400', state.currentPage === page);
        }
    });
};
const renderPage = () => {
    const mainContent = document.getElementById('main-content');
    if (!state.isAuthenticated) {
        renderAuthPage();
        return;
    }
    document.getElementById('auth-overlay').classList.add('hidden');
    document.getElementById('sidebar').classList.remove('hidden');
    updateSidebar();
    switch (state.currentPage) {
        case 'dashboard':
            mainContent.innerHTML = renderDashboardPage();
            setTimeout(() => { initializeIcons(); updateDashboard(); }, 0);
            break;
        case 'reports':
            mainContent.innerHTML = renderReportsPage();
            setTimeout(() => { initializeIcons(); fetchTripHistory(); }, 0);
            break;
        default:
            state.currentPage = 'dashboard';
            renderPage();
    }
};

// --- AUTHENTICATION LOGIC ---

// NEW FUNCTION: Renders the choice modal after OTP login
const renderPostOtpChoice = (email) => {
    const overlay = document.getElementById('auth-overlay');
    overlay.classList.remove('hidden'); // Ensure overlay is visible
    const choiceHtml = `
        <video autoplay loop muted playsinline id="bg-video"><source src="Driver_Safety_Video_Generation.mp4" type="video/mp4"></video>
        <div class="relative z-20 w-full max-w-md bg-white p-8 rounded-xl shadow-2xl border border-gray-100 text-center">
            <h2 class="text-2xl font-bold text-gray-800 mb-4">Login Successful!</h2>
            <p class="text-gray-600 mb-6">What would you like to do next?</p>
            <div class="space-y-3">
                <button id="choice-just-login" class="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-3 rounded-lg transition">
                    Continue to Dashboard
                </button>
                <button id="choice-reset-password" class="w-full bg-gray-200 hover:bg-gray-300 text-gray-800 font-semibold py-3 rounded-lg transition">
                    Create a New Password
                </button>
            </div>
        </div>
    `;
    overlay.innerHTML = choiceHtml;

    document.getElementById('choice-just-login').onclick = () => {
        renderPage(); // Simply hide overlay and go to the dashboard
    };
    document.getElementById('choice-reset-password').onclick = () => {
        renderAuthPage('reset', 'Please create a new password.', false, email);
    };
};

const renderAuthPage = (mode = 'login', message = '', isError = false, emailForOtp = '') => {
    document.getElementById('auth-overlay').classList.remove('hidden');
    document.getElementById('sidebar').classList.add('hidden');
    let title, buttonText, formContent, switchContent;
    const messageHtml = message ? `<div class="p-3 text-sm rounded-lg ${isError ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}">${message}</div>` : '';

    switch (mode) {
        case 'otp':
            title = 'Verify Your Account';
            buttonText = 'Verify OTP';
            formContent = `
                <input id="auth-email-hidden" type="hidden" value="${emailForOtp}">
                <input id="auth-otp" type="text" inputmode="numeric" placeholder="6-Digit OTP" required class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500" />
            `;
            switchContent = `
                <p class="mt-6 text-center text-sm text-gray-600">
                    Didn't receive an OTP?
                    <button onclick="renderAuthPage('register')" class="text-indigo-600 hover:text-indigo-800 font-medium ml-1">
                        Go back to Register
                    </button>
                </p>
            `;
            break;
        case 'register':
            title = 'Create an Account';
            buttonText = 'Register';
            formContent = `
                <input id="auth-name" type="text" placeholder="Full Name" required class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500" />
                <input id="auth-email" type="email" placeholder="Email Address" required class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500" />
                <input id="auth-password" type="password" placeholder="Password" required class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500" />
            `;
            switchContent = `
                <p class="mt-6 text-center text-sm text-gray-600">
                    Already have an account?
                    <button onclick="renderAuthPage('login')" class="text-indigo-600 hover:text-indigo-800 font-medium ml-1">
                        Sign in
                    </button>
                </p>
            `;
            break;
        case 'forgot':
            title = 'Forgot Your Password?';
            buttonText = 'Send Reset OTP';
            formContent = `
                <p class="text-sm text-center text-gray-500 mb-4">Enter your email address and we'll send you an OTP to log in.</p>
                <input id="auth-email" type="email" placeholder="Email Address" required class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500"/>
            `;
            switchContent = `
                <p class="mt-6 text-center text-sm text-gray-600">
                    Remember your password?
                    <button onclick="renderAuthPage('login')" class="text-indigo-600 font-medium ml-1">Sign in</button>
                </p>
            `;
            break;
        case 'otp-login':
            title = 'Enter Login OTP';
            buttonText = 'Login with OTP';
            formContent = `
                <input id="auth-email-hidden" type="hidden" value="${emailForOtp}">
                <input id="auth-otp" type="text" inputmode="numeric" placeholder="6-Digit OTP" required class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500"/>
            `;
            switchContent = `
                <p class="mt-6 text-center text-sm text-gray-600">
                    Didn't get an OTP?
                    <button onclick="renderAuthPage('forgot')" class="text-indigo-600 font-medium ml-1">Try again</button>
                </p>
            `;
            break;
        case 'reset':
            title = 'Create a New Password';
            buttonText = 'Update Password & Login';
            formContent = `
                <input id="auth-email-hidden" type="hidden" value="${emailForOtp}">
                <input id="auth-new-password" type="password" placeholder="Enter New Password" required class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500"/>
            `;
            switchContent = '';
            break;
        case 'login':
        default:
            title = 'Sign in to your Dashboard';
            buttonText = 'Login';
            formContent = `
                <input id="auth-email" type="email" placeholder="Email Address" value="Pankaj@example.com" required class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500" />
                <input id="auth-password" type="password" placeholder="Password" value="password@321" required class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500" />
            `;
            switchContent = `
                <div class="text-right text-sm mt-2">
                    <button onclick="renderAuthPage('forgot')" class="font-medium text-indigo-600 hover:text-indigo-500">Forgot password?</button>
                </div>
                <p class="mt-6 text-center text-sm text-gray-600">
                    Don't have an account?
                    <button onclick="renderAuthPage('register')" class="text-indigo-600 font-medium ml-1">Register here</button>
                </p>
            `;
            break;
    }

    document.getElementById('auth-overlay').innerHTML = `
        <video autoplay loop muted playsinline id="bg-video">
            <source src="Driver_Safety_Video_Generation.mp4" type="video/mp4">
        </video>
        <div class="relative z-10 w-full max-w-md bg-white p-8 rounded-xl shadow-2xl border border-gray-100">
            <div class="text-center mb-6">
                <h1 class="text-3xl font-extrabold text-indigo-700">Driver Safety Monitor</h1>
                <p class="text-gray-500 mt-1">${title}</p>
            </div>
            <form id="auth-form" class="space-y-4">
                ${formContent}
                ${messageHtml}
                <button type="submit" id="auth-submit" class="w-full flex items-center justify-center bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-3 rounded-lg transition disabled:bg-indigo-400">
                    ${buttonText}
                </button>
            </form>
            ${switchContent}
        </div>
    `;
    
    document.getElementById('auth-form').onsubmit = (e) => {
        e.preventDefault();
        const submitBtn = document.getElementById('auth-submit');
        submitBtn.disabled = true;
        submitBtn.innerHTML = `${getIconHtml('loader-2', 'w-5 h-5 mr-2 animate-spin')} Loading...`;
        
        if (mode === 'login') { handleLogin(document.getElementById('auth-email').value, document.getElementById('auth-password').value); }
        else if (mode === 'register') { handleRegister(document.getElementById('auth-name').value, document.getElementById('auth-email').value, document.getElementById('auth-password').value); }
        else if (mode === 'otp') { handleVerifyOtp(document.getElementById('auth-email-hidden').value, document.getElementById('auth-otp').value); }
        else if (mode === 'forgot') { handleForgotPassword(document.getElementById('auth-email').value); }
        else if (mode === 'otp-login') { handleVerifyLoginOtp(document.getElementById('auth-email-hidden').value, document.getElementById('auth-otp').value); }
        else if (mode === 'reset') { handleResetPassword(document.getElementById('auth-email-hidden').value, document.getElementById('auth-new-password').value); }
    };
    initializeIcons();
};

const handleLogin = async (email, password) => {
    try {
        const response = await fetch(`${API_BASE_URL}/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) });
        const data = await response.json();
        if (!response.ok) throw new Error(data.message);
        localStorage.setItem('auth_token', data.token);
        state.user = data.user;
        state.isAuthenticated = true;
        renderPage();
    } catch (error) {
        renderAuthPage('login', error.message, true);
    }
};
const handleRegister = async (name, email, password) => {
    try {
        const response = await fetch(`${API_BASE_URL}/auth/register`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, email, password }) });
        const data = await response.json();
        if (!response.ok) throw new Error(data.message);
        renderAuthPage('otp', data.message, false, email);
    } catch (error) {
        renderAuthPage('register', error.message, true);
    }
};
const handleVerifyOtp = async (email, otp) => {
    try {
        const response = await fetch(`${API_BASE_URL}/auth/verify`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, otp }) });
        const data = await response.json();
        if (!response.ok) throw new Error(data.message);
        renderAuthPage('login', data.message, false);
    } catch (error) {
        renderAuthPage('otp', error.message, true, email);
    }
};
const handleForgotPassword = async (email) => {
    try {
        const response = await fetch(`${API_BASE_URL}/auth/forgot-password`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email }) });
        const data = await response.json();
        if (!response.ok) throw new Error(data.message);
        renderAuthPage('otp-login', data.message, false, email);
    } catch (error) {
        renderAuthPage('forgot', error.message, true);
    }
};
const handleVerifyLoginOtp = async (email, otp) => {
    try {
        const response = await fetch(`${API_BASE_URL}/auth/verify-login-otp`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, otp }) });
        const data = await response.json();
        if (!response.ok) throw new Error(data.message);
        localStorage.setItem('auth_token', data.token);
        state.user = data.user;
        state.isAuthenticated = true;
        renderPostOtpChoice(email);
    } catch (error) {
        renderAuthPage('otp-login', error.message, true, email);
    }
};
const handleResetPassword = async (email, newPassword) => {
    try {
        const response = await fetch(`${API_BASE_URL}/auth/reset-password`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, newPassword }) });
        const data = await response.json();
        if (!response.ok) throw new Error(data.message);
        renderPage();
    } catch (error) {
        renderAuthPage('reset', error.message, true, email);
    }
};
const handleLogout = () => {
    localStorage.removeItem('auth_token');
    state.user = null; state.isAuthenticated = false; state.activeTrip = null; state.isCapturing = false; state.isProcessing = false; state.alerts = [];
    if (state.alertIntervalId) clearInterval(state.alertIntervalId);
    stopTripTimer();
    renderPage();
};
const startTripTimer = () => { if (tripTimerInterval) clearInterval(tripTimerInterval); state.tripDuration = 0; tripTimerInterval = setInterval(() => { state.tripDuration += 1; updateDashboard(); }, 1000); };
const stopTripTimer = () => { if (tripTimerInterval) clearInterval(tripTimerInterval); tripTimerInterval = null; };
const startAlertSimulation = () => { if (state.alertIntervalId) clearInterval(state.alertIntervalId); state.alertIntervalId = setInterval(() => { if (Math.random() > 0.6) { state.alerts.unshift(getRandomAlert()); state.alerts = state.alerts.slice(0, 50); updateAlerts(); playAlertSound(); } }, Math.floor(Math.random() * 5000) + 3000); };
const stopAlertSimulation = () => { if (state.alertIntervalId) { clearInterval(state.alertIntervalId); state.alertIntervalId = null; } };
const playAlertSound = () => { if (!state.isMuted && state.alerts.some(a => a.severity === 'High')) { audioPlayer.volume = state.volume / 100; audioPlayer.play().catch(e => console.error("Audio playback failed:", e)); } };
const handleStartTrip = async () => { try { const response = await fetch(`${API_BASE_URL}/trips/start`, { method: 'POST', headers: { 'Authorization': `Bearer ${localStorage.getItem('auth_token')}` } }); if (!response.ok) throw new Error('Failed to start trip.'); state.activeTrip = await response.json(); state.isCapturing = true; state.isProcessing = true; state.alerts = []; startTripTimer(); startAlertSimulation(); updateDashboard(); } catch (error) { console.error("Error starting trip:", error); } };
const handleEndTrip = async () => { if (!state.activeTrip) return; try { await fetch(`${API_BASE_URL}/trips/end`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('auth_token')}` }, body: JSON.stringify({ tripId: state.activeTrip.id, events: state.alerts }) }); stopTripTimer(); stopAlertSimulation(); state.activeTrip = null; state.isCapturing = false; state.isProcessing = false; updateDashboard(); } catch (error) { console.error("Error ending trip:", error); } };
const handleToggleProcessing = () => { if (!state.isCapturing) return; state.isProcessing = !state.isProcessing; state.isProcessing ? startAlertSimulation() : stopAlertSimulation(); updateDashboard(); };
const handleToggleMute = () => { state.isMuted = !state.isMuted; updateDashboard(); };
const handleVolumeChange = (value) => { state.volume = parseInt(value); audioPlayer.volume = state.isMuted ? 0 : state.volume / 100; updateDashboard(); };
const handleClearAlerts = () => { state.alerts = []; updateAlerts(); };
const updateDashboard = () => {
    const webcamStatus = document.getElementById('webcam-status');
    if (webcamStatus) { webcamStatus.textContent = state.isCapturing ? "LIVE FEED ACTIVE" : "CAMERA INACTIVE"; document.getElementById('processing-overlay')?.classList.toggle('hidden', !(state.isCapturing && state.isProcessing)); }
    document.getElementById('trip-id-value').textContent = state.activeTrip?.id || 'N/A';
    document.getElementById('trip-duration-value').textContent = formatDuration(state.tripDuration);
    document.getElementById('btn-start-trip').disabled = !!state.activeTrip;
    document.getElementById('btn-end-trip').disabled = !state.activeTrip;
    const procBtn = document.getElementById('btn-processing-toggle');
    if (procBtn) { procBtn.disabled = !state.isCapturing; procBtn.textContent = state.isProcessing ? 'Stop Processing' : 'Start Processing Frames'; procBtn.className = `px-4 py-2 rounded-lg font-semibold transition duration-150 w-full ${state.isProcessing ? 'bg-yellow-500 text-gray-900 hover:bg-yellow-600' : 'bg-indigo-600 text-white hover:bg-indigo-700'} disabled:bg-gray-400`; }
    const muteBtn = document.getElementById('btn-mute-toggle');
    if (muteBtn) { muteBtn.className = `px-4 py-2 rounded-lg font-semibold transition duration-150 flex items-center justify-center w-full ${state.isMuted ? 'bg-red-500 text-white hover:bg-red-600' : 'bg-green-500 text-white hover:bg-green-600'}`; muteBtn.innerHTML = state.isMuted ? `${getIconHtml('volume-x', 'w-5 h-5 mr-1')} Muted` : `${getIconHtml('volume-2', 'w-5 h-5 mr-1')} Volume: ${state.volume}%`; }
    const volRange = document.getElementById('volume-range');
    if (volRange) { volRange.value = state.volume; volRange.disabled = state.isMuted; }
    updateAlerts();
    initializeIcons();
};
const updateAlerts = () => {
    const alertList = document.getElementById('alert-list'); if (!alertList) return;
    const counts = state.alerts.reduce((acc, alert) => { acc[alert.severity] = (acc[alert.severity] || 0) + 1; return acc; }, { High: 0, Medium: 0, Low: 0 });
    document.getElementById('alert-count-high').textContent = `High: ${counts.High}`; document.getElementById('alert-count-medium').textContent = `Medium: ${counts.Medium}`; document.getElementById('alert-count-low').textContent = `Low: ${counts.Low}`;
    document.getElementById('alert-header-count').textContent = `Real-time Alerts (${state.alerts.length})`;
    alertList.innerHTML = state.alerts.length === 0 ? '<p class="text-gray-500 text-center py-4">No recent unsafe events detected.</p>' : state.alerts.map(alert => {
        const color = alert.severity === 'High' ? 'text-red-500' : alert.severity === 'Medium' ? 'text-yellow-500' : 'text-green-500';
        const bgColor = alert.severity === 'High' ? 'bg-red-100' : alert.severity === 'Medium' ? 'bg-yellow-100' : 'bg-green-100';
        return `<div class="p-3 mb-2 rounded-lg flex items-start space-x-3 ${bgColor}">${getIconHtml('zap', `w-5 h-5 flex-shrink-0 ${color}`)}<div class="flex-grow"><p class="font-semibold capitalize ${color}">${alert.type}</p><p class="text-xs text-gray-700">Severity: ${alert.severity} | ${new Date(alert.timestamp).toLocaleTimeString()}</p></div></div>`;
    }).join('');
    initializeIcons();
};
const renderDashboardPage = () => {
    return `<h2 class="text-3xl font-bold text-gray-800 mb-6">Driver Safety Dashboard</h2><div class="grid grid-cols-1 lg:grid-cols-3 gap-6"><div class="lg:col-span-2 space-y-6"><div class="relative w-full aspect-video bg-gray-900 rounded-xl overflow-hidden shadow-2xl border-4 border-gray-700"><div class="absolute inset-0 flex items-center justify-center bg-black bg-opacity-70">${getIconHtml('camera', 'w-12 h-12 text-gray-500')}<span id="webcam-status" class="ml-3 text-lg text-gray-400">CAMERA INACTIVE</span></div><div id="processing-overlay" class="absolute top-0 left-0 right-0 p-2 bg-yellow-500 text-gray-900 font-bold text-center animate-pulse hidden">Processing Frames...</div></div><div class="bg-white p-6 rounded-xl shadow-lg"><h3 class="text-xl font-semibold mb-4 text-gray-700 flex items-center">${getIconHtml('history', 'w-5 h-5 mr-2 text-indigo-500')} Trip Management</h3><div class="flex flex-col sm:flex-row gap-4 mb-4"><button id="btn-start-trip" onclick="handleStartTrip()" class="flex-1 px-6 py-3 bg-green-600 hover:bg-green-700 text-white font-bold rounded-lg transition duration-150 disabled:bg-gray-400">Start New Trip</button><button id="btn-end-trip" onclick="handleEndTrip()" disabled class="flex-1 px-6 py-3 bg-red-600 hover:bg-red-700 text-white font-bold rounded-lg transition duration-150 disabled:bg-gray-400">End Trip</button></div><div class="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4"><div class="bg-white p-3 rounded-lg shadow flex items-center justify-between transition duration-300 hover:shadow-md"><span class="text-sm font-medium text-gray-500">Active Trip ID</span><span id="trip-id-value" class="text-xl font-bold text-gray-500">N/A</span></div><div class="bg-white p-3 rounded-lg shadow flex items-center justify-between transition duration-300 hover:shadow-md"><span class="text-sm font-medium text-gray-500">Duration</span><span id="trip-duration-value" class="text-xl font-bold text-gray-700">00:00:00</span></div><div class="p-3 rounded-lg shadow bg-gray-50 flex flex-col justify-center"><span class="text-sm font-medium text-gray-500 mb-1">Processing Toggle</span><button id="btn-processing-toggle" onclick="handleToggleProcessing()" disabled class="px-4 py-2 rounded-lg font-semibold transition duration-150 bg-indigo-600 text-white hover:bg-indigo-700 disabled:bg-gray-400">Start Processing Frames</button></div><div class="p-3 rounded-lg shadow bg-gray-50 flex flex-col justify-center"><span class="text-sm font-medium text-gray-500 mb-1">Audible Alerts</span><button id="btn-mute-toggle" onclick="handleToggleMute()" class="px-4 py-2 rounded-lg font-semibold transition duration-150 flex items-center justify-center bg-green-500 text-white hover:bg-green-600">${getIconHtml('volume-2', 'w-5 h-5 mr-1')} Volume: ${state.volume}%</button><input type="range" id="volume-range" min="0" max="100" value="${state.volume}" oninput="handleVolumeChange(this.value)" class="mt-2 w-full h-1 bg-gray-200 rounded-lg appearance-none cursor-pointer"></div></div></div></div><div class="lg:col-span-1 space-y-6"><div class="bg-white p-6 rounded-xl shadow-lg"><h3 class="text-xl font-semibold mb-4 text-gray-700 flex items-center justify-between"><div class="flex items-center">${getIconHtml('zap', 'w-5 h-5 mr-2 text-red-500')} <span id="alert-header-count">Real-time Alerts (0)</span></div><button onclick="handleClearAlerts()" class="text-xs text-indigo-500 hover:text-indigo-700 font-medium">Clear All</button></h3><div class="grid grid-cols-3 gap-2 text-center text-xs font-semibold mb-4"><div id="alert-count-high" class="p-2 rounded bg-red-500 text-white">High: 0</div><div id="alert-count-medium" class="p-2 rounded bg-yellow-500 text-gray-900">Medium: 0</div><div id="alert-count-low" class="p-2 rounded bg-green-500 text-white">Low: 0</div></div><div id="alert-list" class="max-h-96 overflow-y-auto pr-2"><p class="text-gray-500 text-center py-4">No recent unsafe events detected.</p></div></div></div></div>`;
};
const fetchTripHistory = async () => { state.reportsLoading = true; renderReportsDetails(); try { const response = await fetch(`${API_BASE_URL}/trips`, { headers: { 'Authorization': `Bearer ${localStorage.getItem('auth_token')}` } }); const tripsData = await response.json(); if (!response.ok) throw new Error('Failed to fetch trip history.'); state.trips = tripsData; state.reportsLoading = false; state.selectedTrip = state.trips.length > 0 ? state.trips[0] : null; renderReportsDetails(); if (state.selectedTrip) { fetchTripDetails(); } } catch (error) { console.error("Error fetching trip history:", error); state.reportsLoading = false; renderReportsDetails(); } };
const selectTrip = (tripId) => { state.selectedTrip = state.trips.find(t => t.id === tripId); state.activeTab = 'history'; fetchTripDetails(); };
const fetchTripDetails = async () => { if (!state.selectedTrip) return; state.reportsLoading = true; renderReportsDetails(); try { const response = await fetch(`${API_BASE_URL}/trips/${state.selectedTrip.id}/details`, { headers: { 'Authorization': `Bearer ${localStorage.getItem('auth_token')}` } }); const detailsData = await response.json(); if (!response.ok) throw new Error('Failed to fetch trip details.'); state.tripEvents = detailsData.events; state.safetyScore = detailsData.safetyScore; state.reportsLoading = false; renderReportsDetails(); } catch (error) { console.error("Error fetching trip details:", error); state.reportsLoading = false; renderReportsDetails(); } };
const scoreColor = (safetyScore) => { if (safetyScore >= 80) return 'text-green-500 bg-green-100'; if (safetyScore >= 50) return 'text-yellow-500 bg-yellow-100'; return 'text-red-500 bg-red-100'; };
const handleExportCSV = () => { console.log(`Generating CSV report for ${state.selectedTrip.id}.`); };
const handleRequestPDF = () => { console.log(`Requesting PDF report for ${state.selectedTrip.id} from backend.`); };
const renderTripHistoryList = () => { if (state.reportsLoading && state.trips.length === 0) { return `<div class="flex justify-center items-center py-10">${getIconHtml('loader-2', 'w-6 h-6 animate-spin text-indigo-500')}</div>`; } if (state.trips.length === 0) { return `<p class="text-gray-500 text-center py-4">No trip history available.</p>`; } return state.trips.map(trip => `<div onclick="selectTrip('${trip.id}')" class="p-4 mb-3 rounded-lg border cursor-pointer transition duration-150 ${state.selectedTrip?.id === trip.id ? 'bg-indigo-50 border-indigo-400 shadow-md' : 'bg-gray-50 border-gray-200 hover:bg-gray-100'}"><p class="font-bold text-gray-800">${trip.id}</p><p class="text-sm text-gray-600">Start: ${new Date(trip.start).toLocaleDateString()} ${new Date(trip.start).toLocaleTimeString()}</p><div class="flex justify-between items-center mt-1"><span class="text-xs font-medium text-gray-500">Duration: ${trip.duration}</span><span class="text-sm font-bold px-3 py-1 rounded-full ${scoreColor(trip.score)}">Score: ${trip.score}</span></div></div>`).join(''); };
const renderTripDetails = () => { if (!state.selectedTrip) { return '<p class="text-gray-500 text-center py-20">Select a trip to view details.</p>'; } const trip = state.selectedTrip; const scoreClass = scoreColor(state.safetyScore); const summaryContent = `<div class="space-y-4"><p><span class="font-semibold">Start Time:</span> ${new Date(trip.start).toLocaleString()}</p><p><span class="font-semibold">End Time:</span> ${new Date(trip.end).toLocaleString()}</p><p><span class="font-semibold">Total Duration:</span> ${trip.duration}</p><p><span class="font-semibold">Unsafe Events Recorded:</span> ${state.tripEvents.length}</p></div>`; const logsContent = state.reportsLoading ? `<tr><td colspan="4" class="text-center py-6 text-gray-500">${getIconHtml('loader-2', 'w-5 h-5 mx-auto animate-spin')} Loading...</td></tr>` : state.tripEvents.map((event) => `<tr class="hover:bg-gray-50"><td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">${event.type}</td><td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${new Date(event.timestamp).toLocaleTimeString()}</td><td class="px-6 py-4 whitespace-nowrap text-sm font-semibold"><span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${event.severity === 'High' ? 'bg-red-100 text-red-800' : event.severity === 'Medium' ? 'bg-yellow-100 text-yellow-800' : 'bg-green-100 text-green-800'}">${event.severity}</span></td><td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${event.location}</td></tr>`).join(''); const logsTable = `<div class="overflow-x-auto"><table class="min-w-full divide-y divide-gray-200"><thead class="bg-gray-50"><tr><th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th><th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Timestamp</th><th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Severity</th><th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Location</th></tr></thead><tbody class="bg-white divide-y divide-gray-200">${logsContent}</tbody></table></div>`; return `<h3 class="text-2xl font-bold text-gray-800 mb-4">Details for Trip: ${trip.id}</h3><div class="flex flex-col sm:flex-row justify-between items-center p-4 bg-indigo-50 rounded-lg mb-6 border border-indigo-200"><div class="text-center sm:text-left mb-4 sm:mb-0"><p class="text-sm font-medium text-indigo-700">Overall Safety Score</p><p class="text-4xl font-extrabold ${scoreClass}">${state.reportsLoading ? getIconHtml('loader-2', 'w-8 h-8 animate-spin') : state.safetyScore}</p></div><div class="flex space-x-3"><button onclick="handleExportCSV()" class="flex items-center px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition duration-150 text-sm">${getIconHtml('download', 'w-4 h-4 mr-2')} Export CSV</button><button onclick="handleRequestPDF()" class="flex items-center px-4 py-2 border border-indigo-600 text-indigo-600 rounded-lg hover:bg-indigo-50 transition duration-150 text-sm">${getIconHtml('file-text', 'w-4 h-4 mr-2')} Request PDF</button></div></div><div class="border-b border-gray-200 mb-4"><nav class="flex space-x-4"><button onclick="setActiveTab('history')" class="px-3 py-2 text-sm font-medium rounded-t-lg transition duration-150 ${state.activeTab === 'history' ? 'border-b-2 border-indigo-600 text-indigo-600' : 'text-gray-500 hover:text-gray-700'}">Trip Summary</button><button onclick="setActiveTab('logs')" class="px-3 py-2 text-sm font-medium rounded-t-lg transition duration-150 ${state.activeTab === 'logs' ? 'border-b-2 border-indigo-600 text-indigo-600' : 'text-gray-500 hover:text-gray-700'}">Event Logs (${state.tripEvents.length})</button></nav></div><div id="tab-content">${state.activeTab === 'history' ? summaryContent : logsTable}</div>`; };
const renderReportsDetails = () => { const historyList = document.getElementById('trip-history-list'); const detailsArea = document.getElementById('trip-details-area'); if (historyList) { historyList.innerHTML = renderTripHistoryList(); } if (detailsArea) { detailsArea.innerHTML = renderTripDetails(); } initializeIcons(); };
const setActiveTab = (tab) => { state.activeTab = tab; renderReportsDetails(); };
const renderReportsPage = () => { state.activeTab = 'history'; return `<h2 class="text-3xl font-bold text-gray-800 mb-6 flex items-center">${getIconHtml('bar-chart-2', 'w-6 h-6 mr-2 text-indigo-500')} Trip Reports & History</h2><div class="grid grid-cols-1 lg:grid-cols-3 gap-6"><div class="lg:col-span-1 bg-white p-6 rounded-xl shadow-lg h-full max-h-[80vh] overflow-y-auto"><h3 class="text-xl font-semibold mb-4 text-gray-700 border-b pb-2">Past Trips</h3><div id="trip-history-list"></div></div><div id="trip-details-area" class="lg:col-span-2 bg-white p-6 rounded-xl shadow-lg"></div></div>`; };
const initApp = () => { const token = localStorage.getItem('auth_token'); if (token) { state.user = FAKE_USER; state.isAuthenticated = true; } renderPage(); };

// --- GLOBAL EXPORTS ---
window.initApp = initApp; window.setPage = (page) => { state.currentPage = page; renderPage(); }; window.handleLogin = handleLogin; window.handleRegister = handleRegister; window.handleVerifyOtp = handleVerifyOtp; window.handleLogout = handleLogout; window.handleStartTrip = handleStartTrip; window.handleEndTrip = handleEndTrip; window.handleToggleProcessing = handleToggleProcessing; window.handleToggleMute = handleToggleMute; window.handleVolumeChange = handleVolumeChange; window.handleClearAlerts = handleClearAlerts; window.fetchTripHistory = fetchTripHistory; window.selectTrip = selectTrip; window.handleExportCSV = handleExportCSV; window.handleRequestPDF = handleRequestPDF; window.setActiveTab = setActiveTab; window.renderAuthPage = renderAuthPage;

// --- EVENT LISTENERS ---
document.addEventListener('DOMContentLoaded', initApp);
window.addEventListener('load', initializeIcons);