/**
 * ╔══════════════════════════════════════════════════════╗
 * ║     Lishna Love Story — Optimized Server             ║
 * ║     Node.js + Express + Nodemailer + SQLite          ║
 * ╚══════════════════════════════════════════════════════╝
 */

require('dotenv').config();
const express = require('express');
const nodemailer = require('nodemailer');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const rateLimit = require('express-rate-limit');
const Database = require('better-sqlite3');

const app = express();
const PORT = process.env.PORT || 3000;

// ─── 1. FILE PATHS (The "Not Found" Fix) ────────────────────────
// This ensures the server always looks in the correct folder regardless of where it's hosted
const PUBLIC_DIR = path.join(__dirname, 'public');

// ─── 2. DATABASE SETUP ──────────────────────────────────────────
const db = new Database('submissions.db');
db.exec(`
  CREATE TABLE IF NOT EXISTS submissions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    submitted_at TEXT,
    message TEXT,
    feeling TEXT,
    user_agent TEXT,
    device_type TEXT,
    ip_address TEXT,
    email_sent INTEGER DEFAULT 0
  )
`);

// ─── 3. MIDDLEWARE ─────────────────────────────────────────────
app.use(cors());
app.use(express.json());

// Tell Express to serve everything in the /public folder
app.use(express.static(PUBLIC_DIR));

// Rate limit: Max 5 attempts per hour per person
const limiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  message: { success: false, error: 'Too many tries. Please wait a while. 🌸' }
});

// ─── 4. EMAIL CONFIGURATION ────────────────────────────────────
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

// ─── 5. API ENDPOINT ───────────────────────────────────────────
app.post('/api/submit', limiter, async (req, res) => {
  const { message, feeling } = req.body;

  if (!message || !feeling) {
    return res.status(400).json({ success: false, error: 'Please fill in both boxes! 💗' });
  }

  const timestamp = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
  const userAgent = req.headers['user-agent'] || 'Unknown';
  const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'Unknown';

  try {
    // Save to Database first
    const stmt = db.prepare(`
      INSERT INTO submissions (submitted_at, message, feeling, user_agent, ip_address)
      VALUES (?, ?, ?, ?, ?)
    `);
    const info = stmt.run(timestamp, message, feeling, userAgent, ip);
    const savedId = info.lastInsertRowid;

    // Send Email
    const mailOptions = {
      from: `"Lishna Love Story 💌" <${process.env.EMAIL_USER}>`,
      to: process.env.ADMIN_EMAIL,
      subject: "Lishna's Response ❤️",
      html: `
        <div style="font-family: sans-serif; padding: 20px; border: 1px solid #ffc0cb; border-radius: 10px;">
          <h2 style="color: #d02060;">Lishna has replied! 💌</h2>
          <p><strong>Time:</strong> ${timestamp}</p>
          <hr>
          <p><strong>Message:</strong><br>${message}</p>
          <p><strong>How she feels:</strong><br>${feeling}</p>
          <hr>
          <p style="font-size: 10px; color: #888;">Device: ${userAgent} | IP: ${ip}</p>
        </div>
      `
    };

    await transporter.sendMail(mailOptions);
    db.prepare('UPDATE submissions SET email_sent = 1 WHERE id = ?').run(savedId);

    res.json({ success: true, message: '✨ Your answer has been sent to him. Thank you, Lishna.' });
  } catch (error) {
    console.error('Submission Error:', error);
    // Even if email fails, we return success because it's saved in the DB
    res.json({ success: true, message: '🌸 Your answer has been saved safely. Thank you.' });
  }
});

// ─── 6. CATCH-ALL ROUTE (Fixes 404 errors) ────────────────────
// If the user goes to the main link, send the index.html file
app.get('*', (req, res) => {
  const indexPath = path.join(PUBLIC_DIR, 'index.html');
  
  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    res.status(404).send(`
      <div style="text-align:center; margin-top:50px; font-family:sans-serif;">
        <h1>Oops! File Not Found</h1>
        <p>The server is running, but <b>index.html</b> is missing from the <b>public</b> folder.</p>
        <p>Please make sure your folder structure on GitHub looks like this:</p>
        <code style="background:#eee; padding:10px; display:inline-block;">
          /public/index.html<br>
          server.js<br>
          package.json
        </code>
      </div>
    `);
  }
});

// ─── 7. START SERVER ──────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n  💌 SERVER STARTING...`);
  console.log(`  ➜ URL: http://localhost:${PORT}`);
  console.log(`  ➜ Public Folder Path: ${PUBLIC_DIR}`);
  
  if (!fs.existsSync(PUBLIC_DIR)) {
    console.error(`  ❌ ERROR: The 'public' folder was not found at ${PUBLIC_DIR}`);
  } else {
    console.log(`  ✅ Success: 'public' folder found.`);
  }
});
