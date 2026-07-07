/**
 * ╔══════════════════════════════════════════════════════╗
 * ║     Lishna Love Story — Backend Server               ║
 * ║     Node.js + Express + Nodemailer + SQLite          ║
 * ╚══════════════════════════════════════════════════════╝
 */

require('dotenv').config();

const express    = require('express');
const nodemailer = require('nodemailer');
const cors       = require('cors');
const path       = require('path');
const fs         = require('fs');
const rateLimit  = require('express-rate-limit');
const Database   = require('better-sqlite3');

const app  = express();
const PORT = process.env.PORT || 3000;

// ─── Database Setup ────────────────────────────────────────────────────────────
const db = new Database('submissions.db');

// Create submissions table if it doesn't exist
db.exec(`
  CREATE TABLE IF NOT EXISTS submissions (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    submitted_at TEXT NOT NULL,
    message     TEXT NOT NULL,
    feeling     TEXT NOT NULL,
    user_agent  TEXT,
    device_type TEXT,
    ip_address  TEXT,
    email_sent  INTEGER DEFAULT 0
  )
`);

// ─── Middleware ────────────────────────────────────────────────────────────────
app.use(cors());
app.use(express.json({ limit: '10kb' }));
app.use(express.static(path.join(__dirname, 'public')));

// Rate limiter — max 5 submissions per IP per hour
const submissionLimiter = rateLimit({
  windowMs : 60 * 60 * 1000,
  max      : 5,
  message  : { success: false, error: 'Too many submissions. Please try again later.' }
});

// ─── Nodemailer Transporter ────────────────────────────────────────────────────
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

// ─── Helper: Detect device type ───────────────────────────────────────────────
function detectDevice(userAgent = '') {
  if (/mobile/i.test(userAgent))  return 'Mobile';
  if (/tablet/i.test(userAgent))  return 'Tablet';
  if (/ipad/i.test(userAgent))    return 'iPad';
  return 'Desktop';
}

// ─── Helper: Format date ──────────────────────────────────────────────────────
function formatDate(d) {
  return d.toLocaleString('en-IN', {
    timeZone    : 'Asia/Kolkata',
    weekday     : 'long',
    year        : 'numeric',
    month       : 'long',
    day         : 'numeric',
    hour        : '2-digit',
    minute      : '2-digit',
    second      : '2-digit'
  }) + ' IST';
}

// ─── POST /api/submit ─────────────────────────────────────────────────────────
app.post('/api/submit', submissionLimiter, async (req, res) => {
  const { message, feeling } = req.body;

  // Validate
  if (!message || message.trim().length < 3) {
    return res.status(400).json({ success: false, error: 'Please write something in your heart 💗' });
  }
  if (!feeling || feeling.trim().length < 2) {
    return res.status(400).json({ success: false, error: 'Please share how you feel 🌸' });
  }

  const now        = new Date();
  const userAgent  = req.headers['user-agent'] || 'Unknown';
  const deviceType = detectDevice(userAgent);
  const ipAddress  = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'Unknown';
  const timestamp  = formatDate(now);

  // ── Save to SQLite ────────────────────────────────────────────────────────
  let savedId;
  try {
    const stmt = db.prepare(`
      INSERT INTO submissions (submitted_at, message, feeling, user_agent, device_type, ip_address, email_sent)
      VALUES (?, ?, ?, ?, ?, ?, 0)
    `);
    const info = stmt.run(timestamp, message.trim(), feeling.trim(), userAgent, deviceType, ipAddress);
    savedId = info.lastInsertRowid;
  } catch (dbErr) {
    console.error('❌ Database error:', dbErr);
    return res.status(500).json({ success: false, error: 'Could not save your response. Please try again.' });
  }

  // ── Send Email ────────────────────────────────────────────────────────────
  const htmlBody = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <style>
        body { font-family: Georgia, serif; background: #fff0f5; margin: 0; padding: 20px; }
        .card { background: #fff; border-radius: 16px; padding: 32px; max-width: 600px;
                margin: auto; box-shadow: 0 4px 30px rgba(220,80,120,0.15); }
        h1   { color: #c0396b; text-align: center; font-size: 1.6rem; }
        .row { margin: 12px 0; padding: 12px; background: #fff5f8;
               border-left: 4px solid #e8819c; border-radius: 6px; }
        .label { color: #a0406b; font-size: 0.8rem; text-transform: uppercase;
                 letter-spacing: 1px; font-weight: bold; }
        .value { color: #333; font-size: 1rem; margin-top: 4px; white-space: pre-wrap; }
        .heart { text-align: center; font-size: 2rem; margin: 20px 0; }
        footer { text-align: center; color: #bbb; font-size: 0.75rem; margin-top: 24px; }
      </style>
    </head>
    <body>
      <div class="card">
        <h1>💌 Lishna's Response Has Arrived</h1>
        <div class="heart">❤️</div>
        <div class="row">
          <div class="label">📅 Date &amp; Time</div>
          <div class="value">${timestamp}</div>
        </div>
        <div class="row">
          <div class="label">💬 Her Message</div>
          <div class="value">${message.trim().replace(/</g,'&lt;').replace(/>/g,'&gt;')}</div>
        </div>
        <div class="row">
          <div class="label">💗 How She Feels</div>
          <div class="value">${feeling.trim().replace(/</g,'&lt;').replace(/>/g,'&gt;')}</div>
        </div>
        <div class="row">
          <div class="label">📱 Device</div>
          <div class="value">${deviceType} — ${userAgent}</div>
        </div>
        <div class="row">
          <div class="label">🌐 IP Address</div>
          <div class="value">${ipAddress}</div>
        </div>
        <div class="row">
          <div class="label">🗂 Submission ID</div>
          <div class="value">#${savedId}</div>
        </div>
        <footer>Sent automatically from the Lishna Love Story website 🌸</footer>
      </div>
    </body>
    </html>
  `;

  let emailSent = false;
  try {
    await transporter.sendMail({
      from    : `"Lishna Love Story 💌" <${process.env.EMAIL_USER}>`,
      to      : process.env.ADMIN_EMAIL,
      subject : "Lishna's Response ❤️",
      html    : htmlBody
    });
    emailSent = true;
    // Update email_sent flag in DB
    db.prepare('UPDATE submissions SET email_sent = 1 WHERE id = ?').run(savedId);
  } catch (mailErr) {
    // Email failed — submission already saved locally, so it's not lost
    console.error('⚠️  Email failed (submission saved locally):', mailErr.message);
  }

  return res.json({
    success   : true,
    emailSent,
    savedId,
    message   : emailSent
      ? '✨ Your answer has been sent. Thank you, Lishna.'
      : '🌸 Your answer has been saved safely. Thank you for sharing your heart.'
  });
});

// ─── GET /api/health ──────────────────────────────────────────────────────────
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

// ─── Serve frontend for all other routes ──────────────────────────────────────
app.get('*', (_req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ─── Start ────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n  💌 Lishna Love Story server running`);
  console.log(`  ➜  http://localhost:${PORT}\n`);
});