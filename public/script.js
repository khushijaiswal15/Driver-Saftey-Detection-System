const state = {
    isAuthenticated: false,
    currentPage: 'dashboard',
    user: null,
    isCapturing: false,
    isProcessing: false,
    activeTrip: null,
    trips: [],
    selectedTrip: null,
    tripEvents: [],
    safetyScore: 100,
    alerts: [],
    isMuted: false,
    volume: 100,
    activeTab: 'history',
    reportsLoading: false,
    alertIntervalId: null,
    tripDuration: 0
};


const API_BASE_URL = 'http://localhost:8080/api';
const FAKE_USER = { name: 'Pankaj Chandra', email: 'Pankaj@example.com', avatar: 'https://ui-avatars.com/api/?name=Pankaj+Chandra&background=4f46e5&color=fff' };
const ALERT_TYPES = ['drowsiness', 'yawning', 'mobile phone use', 'seat belt absence'];
const ALERT_SOUND_URL = 'https://s3.amazonaws.com/cdn.freshdesk.com/data/helpdesk/attachments/production/60007877148/original/alarm-horn-01.mp3?1577749437';
const audioPlayer = new Audio(ALERT_SOUND_URL);
let tripTimerInterval = null;

const getIconHtml = (iconName, classes = 'w-5 h-5') => `<i data-lucide="${iconName}" class="${classes}"></i>`;
const getRandomAlert = () => ALERT_TYPES[Math.floor(Math.random() * ALERT_TYPES.length)];
const formatDuration = (seconds) => { const h = Math.floor(seconds / 3600); const m = Math.floor((seconds % 3600) / 60); const s = seconds % 60; return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`; };
const initializeIcons = () => { if (window.lucide) window.lucide.createIcons(); };


const scoreColor = (score) => { if (score >= 90) return 'text-green-600'; if (score >= 70) return 'text-yellow-600'; return 'text-red-600'; };

const renderDashboardPage = () => {
    const videoSource = state.isCapturing ? 'http://localhost:5001/video_feed' : '';
    const videoDisplay = state.isCapturing
        ? `<img src="${videoSource}" class="w-full h-full object-cover rounded-lg" alt="Live Video Feed">`
        : `<div class="flex flex-col items-center justify-center h-full text-gray-400">
             ${getIconHtml('camera-off', 'w-16 h-16 mb-4 opacity-50')}
             <p class="text-lg font-medium">Camera Inactive</p>
             <p class="text-sm">Start a trip to activate monitoring</p>
           </div>`;

    return `
    <div class="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        <div class="lg:col-span-2 space-y-6">
            <div class="bg-black rounded-2xl shadow-2xl overflow-hidden relative aspect-video border-4 border-gray-800 group">
                ${videoDisplay}
                <div class="absolute top-4 left-4 bg-black/60 backdrop-blur-md text-white px-3 py-1.5 rounded-lg flex items-center space-x-2 border border-white/10">
                    <div class="w-2.5 h-2.5 rounded-full ${state.isCapturing ? 'bg-red-500 animate-pulse' : 'bg-gray-500'}"></div>
                    <span class="text-xs font-bold tracking-wider uppercase">${state.isCapturing ? 'LIVE MONITORING' : 'OFFLINE'}</span>
                </div>
                ${state.isCapturing ? `<div id="video-timer" class="absolute bottom-4 left-4 text-white font-mono text-xl bg-black/50 px-2 py-1 rounded">${formatDuration(state.tripDuration)}</div>` : ''}
            </div>
            <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div class="bg-white p-5 rounded-xl shadow-md border border-gray-100 flex items-center justify-between transition hover:shadow-lg">
                    <div><p class="text-sm font-medium text-gray-500">Safety Score</p><p id="dashboard-score" class="text-3xl font-bold ${scoreColor(state.safetyScore)} mt-1">${state.safetyScore}</p></div>
                    <div class="p-3 bg-indigo-50 rounded-full text-indigo-600">${getIconHtml('shield', 'w-8 h-8')}</div>
                </div>
                <div class="bg-white p-5 rounded-xl shadow-md border border-gray-100 flex items-center justify-between transition hover:shadow-lg">
                    <div><p class="text-sm font-medium text-gray-500">Alerts Today</p><p id="dashboard-alerts-count" class="text-3xl font-bold text-gray-800 mt-1">${state.alerts.length}</p></div>
                    <div class="p-3 bg-red-50 rounded-full text-red-600">${getIconHtml('alert-triangle', 'w-8 h-8')}</div>
                </div>
                <div class="bg-white p-5 rounded-xl shadow-md border border-gray-100 flex items-center justify-between transition hover:shadow-lg">
                    <div><p class="text-sm font-medium text-gray-500">Trip Duration</p><p id="dashboard-timer" class="text-3xl font-bold text-gray-800 mt-1">${formatDuration(state.tripDuration)}</p></div>
                    <div class="p-3 bg-green-50 rounded-full text-green-600">${getIconHtml('clock', 'w-8 h-8')}</div>
                </div>
            </div>
        </div>
        <div class="space-y-6">
            <div class="bg-white p-6 rounded-xl shadow-lg border border-gray-100 h-full flex flex-col">
                <div class="flex justify-between items-center mb-4 border-b pb-2">
                    <h3 class="text-lg font-bold text-gray-800 flex items-center">${getIconHtml('bell', 'w-5 h-5 mr-2 text-indigo-500')} Recent Alerts</h3>
                    <button onclick="handleClearAlerts()" class="text-xs text-gray-500 hover:text-red-500 transition">Clear All</button>
                </div>
                <div id="alerts-list" class="flex-1 overflow-y-auto space-y-3 pr-1 custom-scrollbar" style="max-height: 400px;">
                    ${state.alerts.length === 0 ? '<div class="flex flex-col items-center justify-center h-full text-gray-400 py-10"><i data-lucide="check-circle" class="w-12 h-12 mb-2 opacity-20"></i><p class="text-sm">No alerts detected</p></div>' : ''}
                </div>
            </div>
        </div>
    </div>
    <div class="bg-white p-6 rounded-xl shadow-lg border border-gray-100">
        <h3 class="text-lg font-bold text-gray-800 mb-4 flex items-center">${getIconHtml('sliders', 'w-5 h-5 mr-2 text-indigo-500')} Controls & Settings</h3>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div class="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                <div class="flex items-center"><div class="p-2 bg-white rounded-md shadow-sm mr-3 text-indigo-600">${getIconHtml('cpu')}</div><div><p class="font-medium text-gray-800">AI Processing</p><p class="text-xs text-gray-500">Real-time detection</p></div></div>
                <button id="processing-btn" onclick="handleToggleProcessing()" class="relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 ${state.isProcessing ? 'bg-indigo-600' : 'bg-gray-200'}"><span class="translate-x-1 inline-block h-4 w-4 transform rounded-full bg-white transition ${state.isProcessing ? 'translate-x-6' : 'translate-x-1'}"></span></button>
            </div>
            <div class="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                <div class="flex items-center"><div id="audio-icon-container" class="p-2 bg-white rounded-md shadow-sm mr-3 text-indigo-600">${getIconHtml(state.isMuted ? 'volume-x' : 'volume-2')}</div><div><p class="font-medium text-gray-800">Audio Alerts</p><p id="volume-text" class="text-xs text-gray-500">Volume: ${state.volume}%</p></div></div>
                <div class="flex items-center space-x-3"><input type="range" min="0" max="100" value="${state.volume}" oninput="handleVolumeChange(this.value)" class="w-24 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"><button id="mute-btn" onclick="handleToggleMute()" class="p-2 rounded-full hover:bg-gray-200 text-gray-600 transition">${getIconHtml(state.isMuted ? 'volume-x' : 'volume-2', 'w-5 h-5')}</button></div>
            </div>
        </div>
    </div>`;
};

const updateDashboard = () => {
    const mainContent = document.getElementById('main-content');
    if (mainContent && state.currentPage === 'dashboard') {
        mainContent.innerHTML = renderDashboardPage();
        updateAlerts();
        initializeIcons();
    }
};

const updateDashboardStats = () => {
    if (state.currentPage !== 'dashboard') return;

    const videoTimer = document.getElementById('video-timer');
    const dashboardScore = document.getElementById('dashboard-score');
    const dashboardAlertsCount = document.getElementById('dashboard-alerts-count');
    const dashboardTimer = document.getElementById('dashboard-timer');

    if (videoTimer) videoTimer.innerText = formatDuration(state.tripDuration);
    if (dashboardScore) {
        dashboardScore.innerText = state.safetyScore;
        dashboardScore.className = `text-3xl font-bold ${scoreColor(state.safetyScore)} mt-1`;
    }
    if (dashboardAlertsCount) dashboardAlertsCount.innerText = state.alerts.length;
    if (dashboardTimer) dashboardTimer.innerText = formatDuration(state.tripDuration);
};

const updateAlerts = () => {
    const alertsList = document.getElementById('alerts-list');
    if (!alertsList) return;
    if (state.alerts.length === 0) {
        alertsList.innerHTML = '<div class="flex flex-col items-center justify-center h-full text-gray-400 py-10"><i data-lucide="check-circle" class="w-12 h-12 mb-2 opacity-20"></i><p class="text-sm">No alerts detected</p></div>';
    } else {
        alertsList.innerHTML = state.alerts.map(alert => `
            <div class="flex items-start p-3 bg-${alert.severity === 'High' ? 'red' : alert.severity === 'Medium' ? 'yellow' : 'blue'}-50 border-l-4 border-${alert.severity === 'High' ? 'red' : alert.severity === 'Medium' ? 'yellow' : 'blue'}-500 rounded-r-lg animate-fade-in">
                <div class="flex-shrink-0 mr-3 text-${alert.severity === 'High' ? 'red' : alert.severity === 'Medium' ? 'yellow' : 'blue'}-600 mt-0.5">
                    ${getIconHtml('alert-circle', 'w-5 h-5')}
                </div>
                <div class="flex-1 min-w-0">
                    <p class="text-sm font-bold text-gray-900 capitalize">${alert.type}</p>
                    <p class="text-xs text-gray-500 mt-0.5">${new Date(alert.timestamp).toLocaleTimeString()}</p>
                </div>
                <span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-white text-gray-800 border border-gray-200 shadow-sm">
                    ${alert.severity}
                </span>
            </div>
        `).join('');
    }
    initializeIcons();
};

const updateSidebar = () => {
    const userProfile = document.getElementById('user-profile');
    const startTripBtn = document.getElementById('start-trip-btn');
    const endTripBtn = document.getElementById('end-trip-btn');
    const navItems = document.querySelectorAll('.nav-item');

    if (state.isAuthenticated && state.user) {
        userProfile.innerHTML = `<div class="flex items-center space-x-3 p-3 bg-gray-800 rounded-xl border border-gray-700"><img src="${state.user.avatar}" alt="User" class="w-10 h-10 rounded-full border-2 border-indigo-500"><div class="flex-1 min-w-0"><p class="text-sm font-medium text-white truncate">${state.user.name}</p><p class="text-xs text-gray-400 truncate">${state.user.email}</p></div><button onclick="handleLogout()" class="text-gray-400 hover:text-white transition p-1">${getIconHtml('log-out', 'w-5 h-5')}</button></div>`;
        if (state.activeTrip) { startTripBtn.classList.add('hidden'); endTripBtn.classList.remove('hidden'); } else { startTripBtn.classList.remove('hidden'); endTripBtn.classList.add('hidden'); }
    } else {
        userProfile.innerHTML = `<button onclick="renderAuthPage('login')" class="w-full flex items-center justify-center px-4 py-2 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 transition">Sign In</button>`;
        startTripBtn.classList.add('hidden'); endTripBtn.classList.add('hidden');
    }

    navItems.forEach(item => {
        const page = item.getAttribute('onclick').replace("setPage('", "").replace("')", "");
        if (page === state.currentPage) { item.classList.add('bg-gray-800', 'text-white'); item.classList.remove('text-gray-400', 'hover:bg-gray-800', 'hover:text-white'); } else { item.classList.remove('bg-gray-800', 'text-white'); item.classList.add('text-gray-400', 'hover:bg-gray-800', 'hover:text-white'); }
    });
};

const renderPage = () => {
    const mainContent = document.getElementById('main-content');
    document.getElementById('auth-overlay').classList.add('hidden');
    document.getElementById('sidebar').classList.remove('hidden');

    if (!state.isAuthenticated) {
        renderAuthPage('login');
        return;
    }

    if (state.currentPage === 'dashboard') {
        mainContent.innerHTML = renderDashboardPage();
        updateDashboard();
    } else if (state.currentPage === 'reports') {
        mainContent.innerHTML = renderReportsPage();
        fetchTripHistory();
    } else if (state.currentPage === 'settings') {
        mainContent.innerHTML = `<div class="bg-white p-8 rounded-xl shadow-lg"><h2 class="text-2xl font-bold mb-4">Settings</h2><p class="text-gray-600">Settings page content placeholder.</p></div>`;
    }
    updateSidebar();
    initializeIcons();
};


const renderPostOtpChoice = (email) => {
    const overlay = document.getElementById('auth-overlay');
    overlay.classList.remove('hidden');
    document.getElementById('sidebar').classList.add('hidden');

    const choiceHtml = `
        <video autoplay loop muted playsinline id="bg-video">
            <source src="Driver_Safety_Video_Generation.mp4" type="video/mp4">
        </video>
        <div class="relative z-10 w-full max-w-md bg-white p-8 rounded-xl shadow-2xl border border-gray-100 text-center">
             <div class="mb-6">
                <div class="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-green-100">
                    <i data-lucide="check" class="h-6 w-6 text-green-600"></i>
                </div>
                <h2 class="mt-4 text-2xl font-bold text-gray-900">Login Successful</h2>
                <p class="mt-2 text-sm text-gray-500">You have verified your identity.</p>
            </div>
            <div class="space-y-4">
                <button id="choice-just-login" class="w-full flex justify-center py-3 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition">
                    Continue to Dashboard
                </button>
                <div class="relative">
                    <div class="absolute inset-0 flex items-center">
                        <div class="w-full border-t border-gray-300"></div>
                    </div>
                    <div class="relative flex justify-center text-sm">
                        <span class="px-2 bg-white text-gray-500">Optional</span>
                    </div>
                </div>
                <button id="choice-reset-password" class="w-full flex justify-center py-3 px-4 border border-gray-300 rounded-lg shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition">
                    Reset Password
                </button>
            </div>
        </div>
    `;
    overlay.innerHTML = choiceHtml;

    document.getElementById('choice-just-login').onclick = () => {
        renderPage();
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
    stopRealTimeStatusPolling();
    renderPage();
};

// --- REAL-TIME STATUS POLLING ---
let statusPollingInterval = null;

const startRealTimeStatusPolling = () => {
    if (statusPollingInterval) clearInterval(statusPollingInterval);
    statusPollingInterval = setInterval(async () => {
        try {
            const response = await fetch('http://localhost:5001/status');
            if (!response.ok) return;
            const status = await response.json();

            // Generate alerts based on real status
            if (!state.isProcessing) return;

            if (status.drowsy) addRealTimeAlert('drowsiness', 'High');
            if (status.mobile) addRealTimeAlert('mobile phone use', 'High');
            if (!status.seatbelt) addRealTimeAlert('seat belt absence', 'High');

        } catch (error) {
            console.error("Error polling status:", error);
        }
    }, 1000); 
};

const stopRealTimeStatusPolling = () => {
    if (statusPollingInterval) {
        clearInterval(statusPollingInterval);
        statusPollingInterval = null;
    }
};

const addRealTimeAlert = (type, severity) => {

    const recentAlert = state.alerts.find(a => a.type === type && (new Date() - new Date(a.timestamp)) < 3000);
    if (!recentAlert) {
        const newAlert = {
            id: crypto.randomUUID(),
            type,
            severity,
            timestamp: new Date().toISOString(),
            location: '30.3398 N, 78.0263 E'
        };
        state.alerts.unshift(newAlert);
        state.alerts = state.alerts.slice(0, 50);
        updateAlerts();
        updateDashboardStats();

        playAlertSound();
    }
};

const startTripTimer = () => { if (tripTimerInterval) clearInterval(tripTimerInterval); state.tripDuration = 0; tripTimerInterval = setInterval(() => { state.tripDuration += 1; updateDashboardStats(); }, 1000); };
const stopTripTimer = () => { if (tripTimerInterval) clearInterval(tripTimerInterval); tripTimerInterval = null; };

const playAlertSound = () => { if (!state.isMuted && state.alerts.some(a => a.severity === 'High')) { audioPlayer.volume = state.volume / 100; audioPlayer.play().catch(e => console.error("Audio playback failed:", e)); } };

const handleStartTrip = async () => { try { const response = await fetch(`${API_BASE_URL}/trips/start`, { method: 'POST', headers: { 'Authorization': `Bearer ${localStorage.getItem('auth_token')}` } }); if (!response.ok) throw new Error('Failed to start trip.'); state.activeTrip = await response.json(); state.isCapturing = true; state.isProcessing = true; state.alerts = []; startTripTimer(); startRealTimeStatusPolling(); updateDashboard(); updateSidebar(); } catch (error) { console.error("Error starting trip:", error); } };
const handleEndTrip = async () => { if (!state.activeTrip) return; try { await fetch(`${API_BASE_URL}/trips/end`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('auth_token')}` }, body: JSON.stringify({ tripId: state.activeTrip.id, events: state.alerts }) }); stopTripTimer(); stopRealTimeStatusPolling(); state.activeTrip = null; state.isCapturing = false; state.isProcessing = false; updateDashboard(); updateSidebar(); } catch (error) { console.error("Error ending trip:", error); } };

const handleRequestPDF = () => {
    if (!state.selectedTrip) return;
    window.location.href = `${API_BASE_URL}/trips/${state.selectedTrip.id}/export/pdf`;
};

const handleToggleProcessing = () => {
    state.isProcessing = !state.isProcessing;
    const btn = document.getElementById('processing-btn');
    if (btn) {
        btn.className = `relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 ${state.isProcessing ? 'bg-indigo-600' : 'bg-gray-200'}`;
        const span = btn.querySelector('span');
        if (span) span.className = `translate-x-1 inline-block h-4 w-4 transform rounded-full bg-white transition ${state.isProcessing ? 'translate-x-6' : 'translate-x-1'}`;
    }
};

const handleToggleMute = () => {
    state.isMuted = !state.isMuted;
    const muteBtn = document.getElementById('mute-btn');
    if (muteBtn) {
        muteBtn.innerHTML = getIconHtml(state.isMuted ? 'volume-x' : 'volume-2', 'w-5 h-5');
    }
    const audioIconContainer = document.getElementById('audio-icon-container');
    if (audioIconContainer) {
        audioIconContainer.innerHTML = getIconHtml(state.isMuted ? 'volume-x' : 'volume-2');
    }
    lucide.createIcons();
};

const handleVolumeChange = (val) => {
    state.volume = val;
    const volText = document.getElementById('volume-text');
    if (volText) {
        volText.innerText = `Volume: ${state.volume}%`;
    }
};

const handleClearAlerts = () => {
    state.alerts = [];
    updateAlerts();
    updateDashboardStats();
};
const handleExportCSV = () => {
    if (!state.selectedTrip) return;
    window.location.href = `${API_BASE_URL}/trips/${state.selectedTrip.id}/export/csv`;
};

const handleDeleteTrip = async (tripId, event) => {
    if (event) event.stopPropagation(); 
    if (!confirm('Are you sure you want to delete this trip report? This action cannot be undone.')) return;

    try {
        const response = await fetch(`${API_BASE_URL}/trips/${tripId}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${localStorage.getItem('auth_token')}` }
        });

        if (!response.ok) throw new Error('Failed to delete trip');

        state.trips = state.trips.filter(t => t.id !== tripId);

        if (state.selectedTrip && state.selectedTrip.id === tripId) {
            state.selectedTrip = null;
            state.tripEvents = [];
            state.safetyScore = 100;
        }

        renderReportsDetails();
    } catch (error) {
        console.error("Error deleting trip:", error);
        alert("Failed to delete trip. Please try again.");
    }
};

const fetchTripHistory = async () => {
    state.reportsLoading = true; renderReportsDetails();
    try {
        const response = await fetch(`${API_BASE_URL}/trips`, { headers: { 'Authorization': `Bearer ${localStorage.getItem('auth_token')}` } });
        if (!response.ok) throw new Error('Failed to fetch trips');
        state.trips = await response.json();
    } catch (error) { console.error("Error fetching trips:", error); state.trips = []; }
    finally { state.reportsLoading = false; renderReportsDetails(); }
};

const selectTrip = async (tripId) => {
    state.selectedTrip = state.trips.find(t => t.id === tripId);
    state.reportsLoading = true; renderReportsDetails();
    try {
        const response = await fetch(`${API_BASE_URL}/trips/${tripId}/details`, { headers: { 'Authorization': `Bearer ${localStorage.getItem('auth_token')}` } });
        if (!response.ok) throw new Error('Failed to fetch trip details');
        const data = await response.json();
        state.tripEvents = data.events || [];
        state.safetyScore = data.safetyScore || 100;
    } catch (error) { console.error("Error fetching trip details:", error); state.tripEvents = []; state.safetyScore = 0; }
    finally { state.reportsLoading = false; renderReportsDetails(); }
};

const renderTripHistoryList = () => {
    if (state.reportsLoading && state.trips.length === 0) {
        return `<div class="flex justify-center items-center py-10">${getIconHtml('loader-2', 'w-6 h-6 animate-spin text-indigo-500')}</div>`;
    }
    if (state.trips.length === 0) {
        return `<p class="text-gray-500 text-center py-4">No trip history available.</p>`;
    }
    return state.trips.map(trip => `
        <div onclick="selectTrip('${trip.id}')" class="group relative p-4 mb-3 rounded-lg border cursor-pointer transition duration-150 ${state.selectedTrip?.id === trip.id ? 'bg-indigo-50 border-indigo-400 shadow-md' : 'bg-gray-50 border-gray-200 hover:bg-gray-100'}">
            <div class="flex justify-between items-start">
                <div>
                    <p class="font-bold text-gray-800">${trip.id}</p>
                    <p class="text-sm text-gray-600">Start: ${new Date(trip.start).toLocaleDateString()} ${new Date(trip.start).toLocaleTimeString()}</p>
                </div>
                <button onclick="handleDeleteTrip('${trip.id}', event)" class="text-gray-400 hover:text-red-500 p-1 rounded-full hover:bg-red-50 transition opacity-0 group-hover:opacity-100" title="Delete Trip">
                    ${getIconHtml('trash-2', 'w-4 h-4')}
                </button>
            </div>
            <div class="flex justify-between items-center mt-2">
                <span class="text-xs font-medium text-gray-500">Duration: ${trip.duration || 'N/A'}</span>
                <span class="text-sm font-bold px-3 py-1 rounded-full ${scoreColor(trip.score)}">Score: ${trip.score}</span>
            </div>
        </div>
    `).join('');
};
const renderTripDetails = () => { if (!state.selectedTrip) { return '<p class="text-gray-500 text-center py-20">Select a trip to view details.</p>'; } const trip = state.selectedTrip; const scoreClass = scoreColor(state.safetyScore); const summaryContent = `<div class="space-y-4"><p><span class="font-semibold">Start Time:</span> ${new Date(trip.start).toLocaleString()}</p><p><span class="font-semibold">End Time:</span> ${new Date(trip.end).toLocaleString()}</p><p><span class="font-semibold">Total Duration:</span> ${trip.duration}</p><p><span class="font-semibold">Unsafe Events Recorded:</span> ${state.tripEvents.length}</p></div>`; const logsContent = state.reportsLoading ? `<tr><td colspan="4" class="text-center py-6 text-gray-500">${getIconHtml('loader-2', 'w-5 h-5 mx-auto animate-spin')} Loading...</td></tr>` : state.tripEvents.map((event) => `<tr class="hover:bg-gray-50"><td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">${event.type}</td><td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${new Date(event.timestamp).toLocaleTimeString()}</td><td class="px-6 py-4 whitespace-nowrap text-sm font-semibold"><span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${event.severity === 'High' ? 'bg-red-100 text-red-800' : event.severity === 'Medium' ? 'bg-yellow-100 text-yellow-800' : 'bg-green-100 text-green-800'}">${event.severity}</span></td><td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${event.location}</td></tr>`).join(''); const logsTable = `<div class="overflow-x-auto"><table class="min-w-full divide-y divide-gray-200"><thead class="bg-gray-50"><tr><th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th><th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Timestamp</th><th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Severity</th><th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Location</th></tr></thead><tbody class="bg-white divide-y divide-gray-200">${logsContent}</tbody></table></div>`; return `<h3 class="text-2xl font-bold text-gray-800 mb-4">Details for Trip: ${trip.id}</h3><div class="flex flex-col sm:flex-row justify-between items-center p-4 bg-indigo-50 rounded-lg mb-6 border border-indigo-200"><div class="text-center sm:text-left mb-4 sm:mb-0"><p class="text-sm font-medium text-indigo-700">Overall Safety Score</p><p class="text-4xl font-extrabold ${scoreClass}">${state.reportsLoading ? getIconHtml('loader-2', 'w-8 h-8 animate-spin') : state.safetyScore}</p></div><div class="flex space-x-3"><button onclick="handleExportCSV()" class="flex items-center px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition duration-150 text-sm">${getIconHtml('download', 'w-4 h-4 mr-2')} Export CSV</button><button onclick="handleRequestPDF()" class="flex items-center px-4 py-2 border border-indigo-600 text-indigo-600 rounded-lg hover:bg-indigo-50 transition duration-150 text-sm">${getIconHtml('file-text', 'w-4 h-4 mr-2')} Request PDF</button></div></div><div class="border-b border-gray-200 mb-4"><nav class="flex space-x-4"><button onclick="setActiveTab('history')" class="px-3 py-2 text-sm font-medium rounded-t-lg transition duration-150 ${state.activeTab === 'history' ? 'border-b-2 border-indigo-600 text-indigo-600' : 'text-gray-500 hover:text-gray-700'}">Trip Summary</button><button onclick="setActiveTab('logs')" class="px-3 py-2 text-sm font-medium rounded-t-lg transition duration-150 ${state.activeTab === 'logs' ? 'border-b-2 border-indigo-600 text-indigo-600' : 'text-gray-500 hover:text-gray-700'}">Event Logs (${state.tripEvents.length})</button></nav></div><div id="tab-content">${state.activeTab === 'history' ? summaryContent : logsTable}</div>`; };
const renderReportsDetails = () => { const historyList = document.getElementById('trip-history-list'); const detailsArea = document.getElementById('trip-details-area'); if (historyList) { historyList.innerHTML = renderTripHistoryList(); } if (detailsArea) { detailsArea.innerHTML = renderTripDetails(); } initializeIcons(); };
const setActiveTab = (tab) => { state.activeTab = tab; renderReportsDetails(); };
const renderReportsPage = () => { state.activeTab = 'history'; return `<h2 class="text-3xl font-bold text-gray-800 mb-6 flex items-center">${getIconHtml('bar-chart-2', 'w-6 h-6 mr-2 text-indigo-500')} Trip Reports & History</h2><div class="grid grid-cols-1 lg:grid-cols-3 gap-6"><div class="lg:col-span-1 bg-white p-6 rounded-xl shadow-lg h-full max-h-[80vh] overflow-y-auto"><h3 class="text-xl font-semibold mb-4 text-gray-700 border-b pb-2">Past Trips</h3><div id="trip-history-list"></div></div><div id="trip-details-area" class="lg:col-span-2 bg-white p-6 rounded-xl shadow-lg"></div></div>`; };
const initApp = () => { const token = localStorage.getItem('auth_token'); if (token) { state.user = FAKE_USER; state.isAuthenticated = true; } renderPage(); };


window.initApp = initApp; window.setPage = (page) => { state.currentPage = page; renderPage(); }; window.handleLogin = handleLogin; window.handleRegister = handleRegister; window.handleVerifyOtp = handleVerifyOtp; window.handleLogout = handleLogout; window.handleStartTrip = handleStartTrip; window.handleEndTrip = handleEndTrip; window.handleToggleProcessing = handleToggleProcessing; window.handleToggleMute = handleToggleMute; window.handleVolumeChange = handleVolumeChange; window.handleClearAlerts = handleClearAlerts; window.fetchTripHistory = fetchTripHistory; window.selectTrip = selectTrip; window.handleExportCSV = handleExportCSV; window.handleRequestPDF = handleRequestPDF; window.setActiveTab = setActiveTab; window.renderAuthPage = renderAuthPage; window.handleDeleteTrip = handleDeleteTrip;


document.addEventListener('DOMContentLoaded', initApp);
window.addEventListener('load', initializeIcons);
