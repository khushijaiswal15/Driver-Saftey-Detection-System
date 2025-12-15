const express = require('express');
const cors = require('cors');
const sgMail = require('@sendgrid/mail');
const mysql = require('mysql2');
const bcrypt = require('bcrypt');
const PDFDocument = require('pdfkit');
const { Parser } = require('json2csv');

const app = express();
const port = 8080;


sgMail.setApiKey(process.env.SENDGRID_API_KEY);


const db = mysql.createConnection({
    host: 'localhost',
    user: 'root',

    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
}).promise();

console.log("Attempting to connect to the database...");


app.use(cors());
app.use(express.json());
app.use(express.static('public')); 

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
            from: 'khushijaiswal123tt@gmail.com', 
            subject: 'Your OTP for Account Verification',
            html: `<h1>Your OTP is: ${otp}</h1>`,
        };
        await sgMail.send(msg);
        console.log(`OTP email sent successfully to ${email}`);
        res.status(200).json({ message: `An OTP has been sent to ${email}.` });
    } catch (error) {
        console.error('Error during registration:', error);
        res.status(500).json({ message: 'An error occurred during registration.' });
    }
});

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
            from: 'khushijaiswal123tt@gmail.com', 
            subject: 'Your Password Reset OTP',
            html: `<h1>Your OTP to log in and reset your password is: ${otp}</h1>`,
        };
        await sgMail.send(msg);
        console.log(`Password reset OTP sent successfully to ${email}`);
        res.status(200).json({ message: `An OTP has been sent to your email.` });
    } catch (error) {
        console.error('Error during forgot password:', error);
        res.status(500).json({ message: 'An error occurred on the server.' });
    }
});


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


app.post('/api/auth/reset-password', async (req, res) => {
    const { email, newPassword } = req.body;
    console.log(`Resetting password for: ${email}`);
    if (!newPassword || newPassword.length < 6) { 
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


const initDb = async () => {
    try {
        await db.query(`
            CREATE TABLE IF NOT EXISTS trips (
                id VARCHAR(255) PRIMARY KEY,
                user_id INT,
                start_time DATETIME,
                end_time DATETIME,
                duration VARCHAR(50),
                safety_score INT,
                events JSON,
                FOREIGN KEY (user_id) REFERENCES users(id)
            )
        `);
        console.log("Trips table checked/created.");
    } catch (error) {
        console.error("Error initializing database:", error);
    }
};
initDb();


app.post('/api/trips/start', async (req, res) => {
    const tripId = 'TRIP-' + Date.now();
    const startTime = new Date();

    try {
        const [users] = await db.query('SELECT id FROM users LIMIT 1');
        const userId = users.length > 0 ? users[0].id : null;

        await db.query('INSERT INTO trips (id, user_id, start_time) VALUES (?, ?, ?)',
            [tripId, userId, startTime]);

        res.json({ id: tripId, start: startTime });
    } catch (error) {
        console.error("Error starting trip:", error);
        res.status(500).json({ message: "Failed to start trip" });
    }
});


app.post('/api/trips/end', async (req, res) => {
    const { tripId, events } = req.body;
    const endTime = new Date();

    try {
        const [rows] = await db.query('SELECT start_time FROM trips WHERE id = ?', [tripId]);
        if (rows.length === 0) {
            return res.status(404).json({ message: 'Trip not found' });
        }

        const startTime = new Date(rows[0].start_time);
        const durationSeconds = Math.floor((endTime - startTime) / 1000);


        const h = Math.floor(durationSeconds / 3600);
        const m = Math.floor((durationSeconds % 3600) / 60);
        const s = durationSeconds % 60;
        const durationStr = `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
        const safetyScore = Math.max(0, 100 - (events.length * 5));

        await db.query('UPDATE trips SET end_time = ?, duration = ?, safety_score = ?, events = ? WHERE id = ?',
            [endTime, durationStr, safetyScore, JSON.stringify(events), tripId]);

        res.json({ message: 'Trip ended successfully', duration: durationStr, score: safetyScore });
    } catch (error) {
        console.error("Error ending trip:", error);
        res.status(500).json({ message: "Failed to end trip" });
    }
});


app.get('/api/trips', async (req, res) => {
    try {

        const [rows] = await db.query('SELECT * FROM trips ORDER BY start_time DESC');

        const trips = rows.map(row => ({
            id: row.id,
            start: row.start_time,
            end: row.end_time,
            duration: row.duration,
            score: row.safety_score,
            events: row.events 
        }));

        res.json(trips);
    } catch (error) {
        console.error("Error fetching trips:", error);
        res.status(500).json({ message: "Failed to fetch trips" });
    }
});

app.get('/api/trips/:tripId/details', async (req, res) => {
    const { tripId } = req.params;
    try {
        const [rows] = await db.query('SELECT * FROM trips WHERE id = ?', [tripId]);
        if (rows.length === 0) {
            return res.status(404).json({ message: 'Trip not found' });
        }

        const trip = rows[0];
        res.json({
            id: trip.id,
            start: trip.start_time,
            end: trip.end_time,
            duration: trip.duration,
            safetyScore: trip.safety_score,
            events: trip.events || []
        });
    } catch (error) {
        console.error("Error fetching trip details:", error);
        res.status(500).json({ message: "Failed to fetch trip details" });
    }
});

app.delete('/api/trips/:tripId', async (req, res) => {
    const { tripId } = req.params;
    try {
        await db.query('DELETE FROM trips WHERE id = ?', [tripId]);
        res.json({ message: 'Trip deleted successfully' });
    } catch (error) {
        console.error("Error deleting trip:", error);
        res.status(500).json({ message: "Failed to delete trip" });
    }
});
app.get('/api/trips/:tripId/export/csv', async (req, res) => {
    const { tripId } = req.params;
    try {
        const [rows] = await db.query('SELECT * FROM trips WHERE id = ?', [tripId]);
        if (rows.length === 0) return res.status(404).json({ message: 'Trip not found' });

        const trip = rows[0];
        const events = trip.events || [];

        if (events.length === 0) {
            return res.status(400).json({ message: 'No events to export for this trip.' });
        }

        const fields = ['type', 'severity', 'timestamp', 'location'];
        const json2csvParser = new Parser({ fields });
        const csv = json2csvParser.parse(events);

        res.header('Content-Type', 'text/csv');
        res.attachment(`trip_report_${tripId}.csv`);
        return res.send(csv);

    } catch (error) {
        console.error("Error exporting CSV:", error);
        res.status(500).json({ message: "Failed to export CSV" });
    }
});

app.get('/api/trips/:tripId/export/pdf', async (req, res) => {
    const { tripId } = req.params;
    try {
        const [rows] = await db.query('SELECT * FROM trips WHERE id = ?', [tripId]);
        if (rows.length === 0) return res.status(404).json({ message: 'Trip not found' });

        const trip = rows[0];
        const events = trip.events || [];

        const doc = new PDFDocument();
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename=trip_report_${tripId}.pdf`);

        doc.pipe(res);


        doc.fontSize(25).text('Driver Safety Trip Report', { align: 'center' });
        doc.moveDown();


        doc.fontSize(14).text(`Trip ID: ${trip.id}`);
        doc.text(`Start Time: ${new Date(trip.start_time).toLocaleString()}`);
        doc.text(`End Time: ${new Date(trip.end_time).toLocaleString()}`);
        doc.text(`Duration: ${trip.duration}`);
        doc.text(`Safety Score: ${trip.safety_score}`);
        doc.moveDown();


        doc.fontSize(18).text('Unsafe Events Log', { underline: true });
        doc.moveDown();

        if (events.length > 0) {
            events.forEach((event, index) => {
                doc.fontSize(12).text(`${index + 1}. ${event.type.toUpperCase()} - ${event.severity} Severity`);
                doc.fontSize(10).text(`   Time: ${new Date(event.timestamp).toLocaleTimeString()}`);
                doc.text(`   Location: ${event.location || 'N/A'}`);
                doc.moveDown(0.5);
            });
        } else {
            doc.fontSize(12).text('No unsafe events recorded during this trip.');
        }

        doc.end();

    } catch (error) {
        console.error("Error exporting PDF:", error);
        res.status(500).json({ message: "Failed to export PDF" });
    }
});


app.listen(port, () => {
    console.log(` Server is running at http://localhost:${port}`);
});