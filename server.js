// server.js (UPDATED with Forgot Password Flow)
const express = require('express');
const cors = require('cors');
const sgMail = require('@sendgrid/mail');
const mysql = require('mysql2');
const bcrypt = require('bcrypt');

const app = express();
const port = 8080;

// ⚠️ ACTION 1: PASTE YOUR SENDGRID API KEY HERE
sgMail.setApiKey('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'); // I have replaced your key with a placeholder for security

// --- DATABASE CONNECTION ---
const db = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    // ⚠️ ACTION 2: ENTER YOUR MYSQL PASSWORD HERE
    password: 'supersecure123@', // I have replaced your password with a placeholder for security
    database: 'driver_safety_db'
}).promise();

console.log("Attempting to connect to the database...");

// --- MIDDLEWARE ---
app.use(cors());
app.use(express.json());

// --- FAKE TRIP DATA ---
const trips = {
    'TRIP-92837': { id: 'TRIP-92837', start: '2025-09-25T08:00:00Z', end: '2025-09-25T10:30:00Z', duration: '2h 30m', score: 85, events: [{ type: 'Mobile Phone Use', timestamp: '2025-09-25T09:05:45Z', severity: 'High', location: 'Highway 5' }] },
    'TRIP-12345': { id: 'TRIP-12345', start: '2025-09-24T14:15:00Z', end: '2025-09-24T15:05:00Z', duration: '50m', score: 92, events: [{ type: 'Yawning', timestamp: '2025-09-24T14:30:10Z', severity: 'Low', location: 'City Outskirts' }] },
    'TRIP-67890': { id: 'TRIP-67890', start: '2025-09-23T19:00:00Z', end: '2025-09-23T20:10:00Z', duration: '1h 10m', score: 71, events: [{ type: 'Drowsiness', timestamp: '2025-09-23T19:55:00Z', severity: 'Medium', location: 'Residential Area' }] },
};

console.log("Server starting...");

// --- API ENDPOINTS ---

// 1. User Registration (No changes needed here)
app.post('/api/auth/register', async (req, res) => {
    const { name, email, password } = req.body;
    console.log('Registration attempt for:', email);

    if (!name || !email || !password) {
        return res.status(400).json({ message: 'All fields are required.' });
    }

    try {
        const [existingUserRows] = await db.query('SELECT * FROM users WHERE email = ?', [email]);
        if (existingUserRows.length > 0) {
            console.log(`Registration failed: Email ${email} already exists.`);
            return res.status(409).json({ message: 'This email is already registered. Please log in.' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        const query = `
            INSERT INTO temp_users (name, email, password, otp, purpose)
            VALUES (?, ?, ?, ?, 'register')
            ON DUPLICATE KEY UPDATE name = ?, password = ?, otp = ?, purpose = 'register';
        `;
        await db.query(query, [name, email, hashedPassword, otp, name, hashedPassword, otp]);
        const msg = {
            to: email,
            from: 'khushijaiswal123tt@gmail.com', // ⚠️ ACTION 3: Make sure this is your verified SendGrid email
            subject: 'Your OTP for Account Verification',
            html: `<h1>Your OTP is: ${otp}</h1>`,
        };
        await sgMail.send(msg);
        console.log(`✅ OTP email sent successfully to ${email}`);
        res.status(200).json({ message: `An OTP has been sent to ${email}.` });
    } catch (error) {
        console.error('Error during registration:', error);
        res.status(500).json({ message: 'An error occurred during registration.' });
    }
});

// 2. Verify Registration OTP (No changes needed)
app.post('/api/auth/verify', async (req, res) => {
    const { email, otp } = req.body;
    console.log(`Verifying registration OTP for ${email}`);
    try {
        const [rows] = await db.query('SELECT * FROM temp_users WHERE email = ? AND otp = ? AND purpose = "register"', [email, otp]);
        if (rows.length > 0) {
            const tempUser = rows[0];
            await db.query('INSERT INTO users (name, email, password) VALUES (?, ?, ?)', [tempUser.name, tempUser.email, tempUser.password]);
            await db.query('DELETE FROM temp_users WHERE email = ?', [email]);
            console.log(`User ${email} verified successfully.`);
            res.status(201).json({ message: 'Account verified successfully. Please log in.' });
        } else {
            console.log(`Invalid OTP attempt for ${email}`);
            res.status(400).json({ message: 'Invalid OTP. Please try again.' });
        }
    } catch (error) {
        console.error('Error during verification:', error);
        if (error.code === 'ER_DUP_ENTRY') {
            await db.query('DELETE FROM temp_users WHERE email = ?', [email]);
            return res.status(400).json({ message: 'This email has already been registered.' });
        }
        res.status(500).json({ message: 'An error occurred during verification.' });
    }
});

// 3. User Login (No changes needed)
app.post('/api/auth/login', async (req, res) => {
    const { email, password } = req.body;
    console.log('Login attempt for:', email);
    try {
        const [rows] = await db.query('SELECT * FROM users WHERE email = ?', [email]);
        if (rows.length === 0) {
            return res.status(401).json({ message: 'Invalid email or password.' });
        }
        const user = rows[0];
        const isMatch = await bcrypt.compare(password, user.password);
        if (isMatch) {
            console.log(`User ${email} logged in successfully.`);
            res.json({
                message: 'Login successful',
                token: 'real-jwt-token-placeholder',
                user: { id: user.id, name: user.name, role: 'driver', email: user.email }
            });
        } else {
            res.status(401).json({ message: 'Invalid email or password.' });
        }
    } catch (error) {
        console.error('Error during login:', error);
        res.status(500).json({ message: 'An error occurred during login.' });
    }
});


// --- NEW FORGOT PASSWORD ENDPOINTS ---

// 4. Forgot Password (Step 1: Request OTP)
app.post('/api/auth/forgot-password', async (req, res) => {
    const { email } = req.body;
    console.log(`Forgot password request for: ${email}`);
    try {
        const [users] = await db.query('SELECT * FROM users WHERE email = ?', [email]);
        if (users.length === 0) {
            return res.status(404).json({ message: 'No account found with that email address.' });
        }
        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        const query = `
            INSERT INTO temp_users (email, otp, purpose, name, password)
            VALUES (?, ?, 'reset', '', '')
            ON DUPLICATE KEY UPDATE otp = ?, purpose = 'reset';
        `;
        await db.query(query, [email, otp, otp]);
        const msg = {
            to: email,
            from: 'khushijaiswal123tt@gmail.com', // ⚠️ ACTION: Use your verified SendGrid email
            subject: 'Your Password Reset OTP',
            html: `<h1>Your OTP to log in and reset your password is: ${otp}</h1>`,
        };
        await sgMail.send(msg);
        console.log(`✅ Password reset OTP sent successfully to ${email}`);
        res.status(200).json({ message: `An OTP has been sent to your email.` });
    } catch (error) {
        console.error('Error during forgot password:', error);
        res.status(500).json({ message: 'An error occurred on the server.' });
    }
});

// 5. Verify Login OTP (Step 2: Use OTP to log in)
app.post('/api/auth/verify-login-otp', async (req, res) => {
    const { email, otp } = req.body;
    console.log(`Verifying login OTP for: ${email}`);
    try {
        const [tempUsers] = await db.query('SELECT * FROM temp_users WHERE email = ? AND otp = ? AND purpose = "reset"', [email, otp]);
        if (tempUsers.length === 0) {
            return res.status(400).json({ message: 'Invalid OTP. Please try again.' });
        }
        const [users] = await db.query('SELECT * FROM users WHERE email = ?', [email]);
        if (users.length === 0) {
            return res.status(404).json({ message: 'User account not found.' });
        }
        await db.query('DELETE FROM temp_users WHERE email = ?', [email]);
        const user = users[0];
        console.log(`User ${email} logged in successfully via OTP.`);
        res.json({
            message: 'OTP verified. Logged in successfully.',
            token: 'otp-based-jwt-placeholder',
            user: { id: user.id, name: user.name, role: 'driver', email: user.email }
        });
    } catch (error) {
        console.error('Error during login OTP verification:', error);
        res.status(500).json({ message: 'An error occurred on the server.' });
    }
});

// 6. Reset Password (Step 3: Update password)
app.post('/api/auth/reset-password', async (req, res) => {
    const { email, newPassword } = req.body;
    console.log(`Resetting password for: ${email}`);
    if (!newPassword || newPassword.length < 6) { // Added a basic length check
        return res.status(400).json({ message: 'Password must be at least 6 characters long.' });
    }
    try {
        const hashedPassword = await bcrypt.hash(newPassword, 10);
        await db.query('UPDATE users SET password = ? WHERE email = ?', [hashedPassword, email]);
        console.log(`Password for ${email} has been updated.`);
        res.status(200).json({ message: 'Password updated successfully. You are now logged in.' });
    } catch (error) {
        console.error('Error during password reset:', error);
        res.status(500).json({ message: 'An error occurred on the server.' });
    }
});


// --- Trip Management Endpoints (No changes needed) ---
app.post('/api/trips/start', (req, res) => { /* ... unchanged ... */ });
app.post('/api/trips/end', (req, res) => { /* ... unchanged ... */ });
app.get('/api/trips', (req, res) => { /* ... unchanged ... */ });
app.get('/api/trips/:tripId/details', (req, res) => { /* ... unchanged ... */ });


// --- START SERVER ---
app.listen(port, () => {
    console.log(`✅ Server is running at http://localhost:${port}`);
});