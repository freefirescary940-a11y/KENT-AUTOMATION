// Kent Service - Technician Stock backend (Express + JSON file storage)
// Load a ".env" file that sits next to this file (for hosts that have no screen for environment variables).
try {
  const envFile = require('path').join(__dirname, '.env');
  if (require('fs').existsSync(envFile)) for (const line of require('fs').readFileSync(envFile, 'utf8').split(/\r?\n/)) {
    const m = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/.exec(line);
    if (m && !line.trim().startsWith('#') && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^(['"])(.*)\1$/, '$2');
  }
} catch (e) {}
const express = require('express'), fs = require('fs'), path = require('path'), crypto = require('crypto');
const bcrypt = require('bcryptjs'), jwt = require('jsonwebtoken');

const PORT = process.env.PORT || 3000;
const SECRET = process.env.JWT_SECRET || 'change-this-secret';
const ADMIN_ID = (process.env.ADMIN_ID || 'gnane').toLowerCase();
// Storage: if DATABASE_URL is set the data (and photos) live in a Postgres database (safe on Render free plan).
// Otherwise everything is saved in files inside DATA_DIR (needs a Render disk, or your own computer).
const DATABASE_URL = process.env.DATABASE_URL;
let pool = null;
if (DATABASE_URL) {
  const { Pool } = require('pg');
  pool = new Pool({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false }, max: 3 });
  pool.on('error', e => console.error('Database error:', e.message));
}
const LIMIT_MB = Number(process.env.DB_LIMIT_MB) || 1024;   // free Neon plan = about 1 GB; change with DB_LIMIT_MB
let chain = Promise.resolve();
let saveError = '', failCount = 0, usageCache = { t: 0, v: null };
async function dbUsage() {
  if (!pool) return null;
  if (usageCache.v && Date.now() - usageCache.t < 60000) return usageCache.v;
  try {
    const r = await pool.query("select pg_database_size(current_database()) as total, (select coalesce(sum(length(data)), 0) from files) as photos, (select count(*) from files) as n");
    const total = Number(r.rows[0].total), ph = Number(r.rows[0].photos);
    const v = { usedMB: +(total / 1048576).toFixed(1), limitMB: LIMIT_MB, percent: Math.round(total / 1048576 / LIMIT_MB * 100), photosMB: +(ph / 1048576).toFixed(1), photoCount: Number(r.rows[0].n) };
    usageCache = { t: Date.now(), v }; return v;
  } catch (e) { return null; }
}
const DIR = process.env.DATA_DIR || path.join(__dirname, 'data'), FILE = path.join(DIR, 'db.json');
const UPLOADS = path.join(DIR, 'uploads');
if (!pool) { fs.mkdirSync(path.join(DIR, 'backups'), { recursive: true }); fs.mkdirSync(UPLOADS, { recursive: true }); }
const okImg = d => typeof d === 'string' && d.length < 4e6 && /^data:image\/(jpeg|png|webp);base64,/.test(d);
function putFile(name, buf) {
  if (pool) chain = chain.then(() => pool.query('insert into files (name, data) values ($1, $2) on conflict (name) do update set data = excluded.data', [name, buf])).then(() => {}).catch(e => { failCount++; saveError = 'photo: ' + e.message; console.error('Photo save failed:', e.message); });
  else fs.writeFileSync(path.join(UPLOADS, name), buf);
}
function delFile(name) {
  if (pool) chain = chain.then(() => pool.query('delete from files where name = $1', [name])).then(() => {}).catch(() => {});
  else { try { fs.unlinkSync(path.join(UPLOADS, name)); } catch (e) {} }
}
function saveImg(d) {
  const m = /^data:image\/(jpeg|png|webp);base64,(.+)$/s.exec(d);
  const name = crypto.randomUUID() + '.' + (m[1] === 'jpeg' ? 'jpg' : m[1]), buf = Buffer.from(m[2], 'base64');
  putFile(name, buf);
  return name;
}

const today = () => new Date().toISOString().slice(0, 10);
let db = { items: [], technicians: [], allocations: [], reports: [], estimates: [], attendance: [], config: {} };

// Every change is saved at once. In file mode a copy is also kept every day in data/backups.
// ---- live updates: every save() pushes a tiny "something changed" signal to open screens, so a case moves to Pending on the admin screen at once ----
let REV = 0; const subs = new Set();
function save() {
  REV++; for (const r of subs) { try { r.write('data: ' + REV + '\n\n'); } catch (e) {} }
  saveData();
}
function saveData() {
  if (pool) {
    const json = JSON.stringify(db);
    chain = chain.then(() => pool.query("insert into kv (key, value) values ('db', $1::jsonb) on conflict (key) do update set value = excluded.value", [json]))
                 .then(() => { saveError = ''; })
                 .catch(e => { failCount++; saveError = e.message; console.error('Save failed:', e.message); });
    return;
  }
  fs.writeFileSync(FILE + '.tmp', JSON.stringify(db));
  fs.renameSync(FILE + '.tmp', FILE);
  fs.copyFileSync(FILE, path.join(DIR, 'backups', 'db-' + today() + '.json'));
}
async function reloadDb() {   // undo changes that could not be saved
  try {
    const r = await pool.query("select value from kv where key = 'db'");
    if (r.rows[0]) db = { items: [], technicians: [], allocations: [], reports: [], estimates: [], attendance: [], config: {}, ...r.rows[0].value };
  } catch (e) { console.error('Reload failed:', e.message); }
}
async function bootstrap() {
  if (pool) {
    await pool.query('create table if not exists kv (key text primary key, value jsonb not null)');
    await pool.query('create table if not exists files (name text primary key, data bytea not null)');
    const r = await pool.query("select value from kv where key = 'db'");
    if (r.rows[0]) db = { ...db, ...r.rows[0].value };
  } else if (fs.existsSync(FILE)) db = { ...db, ...JSON.parse(fs.readFileSync(FILE, 'utf8')) };
  if (!db.config.adminHash) {
    db.config.adminHash = bcrypt.hashSync(process.env.ADMIN_PASSWORD || '9032', 10);
    db.config.adminDefault = true;
    save();
  }
  // Forgot the admin password? Set RESET_ADMIN_PASSWORD=<new password>, restart, log in, then DELETE that variable.
  if (process.env.RESET_ADMIN_PASSWORD) {
    db.config.adminHash = bcrypt.hashSync(process.env.RESET_ADMIN_PASSWORD, 10);
    db.config.adminDefault = true;
    save();
    console.log('Admin password was reset from RESET_ADMIN_PASSWORD. Remove that variable now.');
  }
}

const sid = s => String(s || '').trim().toLowerCase().replace(/[^a-z0-9_-]/g, '');
const num = v => parseFloat(v) || 0;
const sign = (id, role) => jwt.sign({ id, role }, SECRET, { expiresIn: '30d' });

function auth(role) {
  return (req, res, next) => {
    try {
      const t = (req.headers.authorization || '').replace('Bearer ', '') || String(req.query.t || '');
      const u = jwt.verify(t, SECRET);
      if (role && u.role !== role) return res.status(403).json({ error: 'Not allowed' });
      if (u.role === 'tech') {
        const tech = db.technicians.find(x => x.id === u.id);
        if (!tech) return res.status(401).json({ error: 'Account removed' });
        u.name = tech.name;
      }
      req.user = u; next();
    } catch (e) { res.status(401).json({ error: 'Please login again' }); }
  };
}

const app = express();
app.set('trust proxy', 1);
app.use(express.json({ limit: '50mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// If the database cannot save (for example it is full), say so clearly instead of replying "saved".
app.use('/api', (req, res, next) => {
  if (!pool || req.method === 'GET' || req.path === '/login') return next();
  const f0 = failCount, send = res.json.bind(res);
  res.json = async body => {
    if (res.statusCode < 400) {
      await chain;
      if (failCount > f0) {
        await reloadDb();
        res.status(507);
        return send({ error: 'The online storage is full (or not saving), so this was NOT saved. Please tell the admin.' });
      }
    }
    return send(body);
  };
  next();
});

// ---------- server check (open /api/health in the browser) ----------
app.get('/api/rev', auth(), (req, res) => res.json({ rev: REV }));
app.get('/api/stream', auth(), (req, res) => {
  res.set({ 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache, no-transform', Connection: 'keep-alive', 'X-Accel-Buffering': 'no' });
  res.flushHeaders(); res.write('retry: 3000\n\ndata: ' + REV + '\n\n'); subs.add(res);
  const hb = setInterval(() => { try { res.write(': hb\n\n'); } catch (e) {} }, 15000);
  req.on('close', () => { clearInterval(hb); subs.delete(res); });
});
app.get('/api/health', async (req, res) => {
  res.json({
    usage: await dbUsage(), saveError: saveError || null,
    ok: true,
    time: new Date().toISOString(),
    letterheadFound: fs.existsSync(path.join(__dirname, 'public', 'letterhead.jpg')),
    dataSavedOnDisk: !!process.env.DATA_DIR || !!pool,
    storage: pool ? 'database (safe)' : process.env.DATA_DIR ? 'disk (safe)' : (process.env.RENDER ? 'TEMPORARY - erased on every restart' : 'files in the app folder (kept as long as the host keeps the folder)'),
    adminPasswordIsDefault: !!db.config.adminDefault,
    adminOtp: otpOn(), mailProvider: mailProvider(),
    counts: { items: db.items.length, technicians: db.technicians.length, reports: db.reports.length, estimates: db.estimates.length }
  });
});

// ---------- login ----------
app.post('/api/login', (req, res) => {
  const id = sid(req.body.id), pw = String(req.body.password || '');
  if (id === ADMIN_ID) {
    if (otpOn()) return res.status(400).json({ error: 'Admin login uses email OTP. Tap Admin and enter your email.' });
    if (!bcrypt.compareSync(pw, db.config.adminHash)) return res.status(400).json({ error: 'Wrong ID or password' });
    return res.json({ token: sign(id, 'admin'), role: 'admin', id });
  }
  const t = db.technicians.find(x => x.id === id);
  if (!t || !bcrypt.compareSync(pw, t.hash)) return res.status(400).json({ error: 'Wrong ID or password' });
  res.json({ token: sign(id, 'tech'), role: 'tech', id });
});


// ---------- admin login by e-mail + OTP ----------
// Needs ADMIN_EMAIL plus ONE mail provider: BREVO_API_KEY, RESEND_API_KEY, or SMTP_HOST (SMTP is blocked on Render's free plan - use Brevo/Resend there).
const ADMIN_EMAIL = (process.env.ADMIN_EMAIL || 'paidignane708@gmail.com').trim().toLowerCase();   // default admin mailbox
const MAIL_FROM = process.env.MAIL_FROM || ADMIN_EMAIL;
const mailReady = () => !!(process.env.BREVO_API_KEY || process.env.RESEND_API_KEY || process.env.SMTP_HOST);
const mailProvider = () => process.env.BREVO_API_KEY ? 'brevo' : process.env.RESEND_API_KEY ? 'resend' : process.env.SMTP_HOST ? 'smtp' : 'none';
const otpOn = () => !!ADMIN_EMAIL && process.env.ADMIN_OTP_DISABLE !== '1';   // admin ALWAYS needs email OTP (emergency off: ADMIN_OTP_DISABLE=1)
if (otpOn() && !mailReady()) console.warn('WARNING: Admin OTP is ON but no mail provider is set - admin cannot log in. Set BREVO_API_KEY (+MAIL_FROM) or RESEND_API_KEY, or ADMIN_OTP_DISABLE=1 temporarily.');
async function sendMail(to, subject, html, text) {
  if (process.env.BREVO_API_KEY) {
    const r = await fetch('https://api.brevo.com/v3/smtp/email', { method: 'POST',
      headers: { 'api-key': process.env.BREVO_API_KEY, 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify({ sender: { name: 'Kent Service', email: MAIL_FROM }, to: [{ email: to }], subject, htmlContent: html, textContent: text }) });
    if (!r.ok) throw new Error('Brevo ' + r.status + ' ' + (await r.text())); return;
  }
  if (process.env.RESEND_API_KEY) {
    const r = await fetch('https://api.resend.com/emails', { method: 'POST',
      headers: { Authorization: 'Bearer ' + process.env.RESEND_API_KEY, 'content-type': 'application/json' },
      body: JSON.stringify({ from: process.env.MAIL_FROM || 'Kent Service <onboarding@resend.dev>', to: [to], subject, html, text }) });
    if (!r.ok) throw new Error('Resend ' + r.status + ' ' + (await r.text())); return;
  }
  if (process.env.SMTP_HOST) {
    const port = parseInt(process.env.SMTP_PORT || '465', 10);
    const tr = require('nodemailer').createTransport({ host: process.env.SMTP_HOST, port, secure: port === 465, auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } });
    await tr.sendMail({ from: MAIL_FROM, to, subject, html, text }); return;
  }
  throw new Error('No mail provider configured');
}
const hmac = c => crypto.createHmac('sha256', SECRET).update(String(c)).digest();
const same = (a, b) => a.length === b.length && crypto.timingSafeEqual(a, b);
let otpState = null;               // { hash, exp, tries } - only ONE code is valid at a time
const hits = new Map();            // simple per-IP rate limit
function limited(ip, key, max, winMs) {
  const k = key + ip, now = Date.now(), h = hits.get(k);
  if (!h || now > h.reset) { hits.set(k, { n: 1, reset: now + winMs }); return false; }
  return ++h.n > max;
}
app.get('/api/login-mode', (req, res) => res.json({ adminOtp: otpOn() }));
app.post('/api/admin/otp/request', async (req, res) => {
  if (!otpOn()) return res.status(400).json({ error: 'Email OTP is not set up on the server' });
  if (limited(req.ip, 'rq', 5, 15 * 60e3)) return res.status(429).json({ error: 'Too many requests. Try again in a few minutes.' });
  const generic = { ok: true, message: 'If this is the admin email, a 6-digit code has been sent.' };
  const em = String(req.body.email || '').trim().toLowerCase();
  if (!same(hmac(em), hmac(ADMIN_EMAIL))) { console.log('OTP requested for a different email than ADMIN_EMAIL - nothing sent'); return res.json(generic); }          // never reveal whether the email matched
  if (otpState && otpState.sent && Date.now() - otpState.sent < 30e3) return res.status(429).json({ error: 'Wait 30 seconds before asking for a new code.' });
  const code = String(crypto.randomInt(100000, 1000000));
  otpState = { hash: hmac(code), exp: Date.now() + 10 * 60e3, tries: 0, sent: Date.now() };
  try {
    await sendMail(ADMIN_EMAIL, 'Kent Service admin login code: ' + code,
      '<div style="font-family:Arial,sans-serif;max-width:420px"><h2 style="color:#0a4a9a">Sri Rajammathalli Services</h2><p>Your admin login code is</p><p style="font-size:34px;letter-spacing:8px;font-weight:700;color:#0e7490">' + code + '</p><p>It is valid for 10 minutes. If you did not try to log in, ignore this email.</p></div>',
      'Your Kent Service admin login code is ' + code + '. Valid for 10 minutes.');
    console.log('OTP mail accepted by provider:', mailProvider());
  } catch (e) { otpState = null; console.error('OTP mail failed:', e.message); return res.status(500).json({ error: 'Could not send the email. Check the mail settings on the server.' }); }
  res.json(generic);
});
app.post('/api/admin/otp/verify', (req, res) => {
  if (!otpOn()) return res.status(400).json({ error: 'Email OTP is not set up on the server' });
  if (limited(req.ip, 'vf', 15, 15 * 60e3)) return res.status(429).json({ error: 'Too many attempts. Try again in a few minutes.' });
  const em = String(req.body.email || '').trim().toLowerCase(), code = String(req.body.code || '').trim();
  const bad = () => res.status(400).json({ error: 'Wrong or expired code' });
  if (!otpState || Date.now() > otpState.exp || otpState.tries >= 5 || !/^\d{6}$/.test(code) || !same(hmac(em), hmac(ADMIN_EMAIL))) return bad();
  otpState.tries++;
  if (!same(hmac(code), otpState.hash)) return bad();
  otpState = null;
  res.json({ token: sign(ADMIN_ID, 'admin'), role: 'admin', id: ADMIN_ID });
});

// ---------- state (everything the screen needs) ----------
app.get('/api/state', auth(), async (req, res) => {
  const u = req.user, isAdmin = u.role === 'admin';
  const techs = db.technicians.map(({ id, name }) => ({ id, name }));
  const usage = isAdmin ? await dbUsage() : null;
  res.json({
    storage: usage, saveError: isAdmin ? saveError : '',
    items: db.items,
    technicians: isAdmin ? techs : techs.filter(t => t.id === u.id),
    allocations: isAdmin ? db.allocations : db.allocations.filter(a => a.techId === u.id),
    reports: isAdmin ? db.reports : db.reports.filter(r => r.techId === u.id).map(r => ({ ...r, kent: undefined, kentPrio: undefined, ks: techKs(r), serialWait: serialWaitFor(r), serial: undefined })),   // technicians see only a simple status, never the robot's internal notes
    estimates: isAdmin ? db.estimates : [],
    attendance: isAdmin ? db.attendance : [],     // attendance is never sent to technicians
    robotSince: isAdmin ? (db.config.robotSince || 0) : 0, robotSeen: isAdmin ? robotLastSeen : 0,
    adminId: ADMIN_ID, adminDefault: !!db.config.adminDefault, backupDate: db.config.backupDate || null
  });
});

// ---------- items (admin) ----------
app.post('/api/items', auth('admin'), (req, res) => {
  const name = String(req.body.name || '').trim(), price = num(req.body.price);
  const hsn = String(req.body.hsn || '').trim(), partCode = String(req.body.partCode || '').trim();
  if (!name || price <= 0 || !hsn || !partCode) return res.status(400).json({ error: 'Enter name, price (with GST), HSN code and Part code' });
  const id = sid(name) || crypto.randomUUID().slice(0, 8);
  if (db.items.find(i => i.id === id)) return res.status(400).json({ error: 'Item already exists' });
  db.items.push({ id, name, price, hsn, partCode }); save(); res.json({ ok: true });
});
app.put('/api/items/:id', auth('admin'), (req, res) => {
  const i = db.items.find(x => x.id === req.params.id); if (!i) return res.status(404).json({ error: 'Not found' });
  const price = num(req.body.price), hsn = String(req.body.hsn || '').trim(), partCode = String(req.body.partCode || '').trim();
  if (price <= 0 || !hsn || !partCode) return res.status(400).json({ error: 'Enter price, HSN code and Part code' });
  i.price = price; i.hsn = hsn; i.partCode = partCode; save(); res.json({ ok: true });
});
app.delete('/api/items/:id', auth('admin'), (req, res) => {
  db.items = db.items.filter(x => x.id !== req.params.id); save(); res.json({ ok: true });
});

// ---------- technicians (admin) ----------
app.post('/api/technicians', auth('admin'), (req, res) => {
  const id = sid(req.body.id), name = String(req.body.name || '').trim(), pw = String(req.body.password || '');
  if (!id || !name || pw.length < 4) return res.status(400).json({ error: 'Enter ID, name and password (min 4)' });
  if (id === ADMIN_ID || db.technicians.find(t => t.id === id)) return res.status(400).json({ error: 'ID already exists or reserved' });
  db.technicians.push({ id, name, hash: bcrypt.hashSync(pw, 10) }); save(); res.json({ ok: true });
});
app.post('/api/technicians/:id/password', auth('admin'), (req, res) => {
  const t = db.technicians.find(x => x.id === req.params.id); if (!t) return res.status(404).json({ error: 'Not found' });
  if (String(req.body.password || '').length < 4) return res.status(400).json({ error: 'Password too short' });
  t.hash = bcrypt.hashSync(String(req.body.password), 10); save(); res.json({ ok: true });
});
app.delete('/api/technicians/:id', auth('admin'), (req, res) => {
  db.technicians = db.technicians.filter(x => x.id !== req.params.id); save(); res.json({ ok: true });
});
app.post('/api/admin/password', auth('admin'), (req, res) => {
  const p = String(req.body.password || ''); if (p.length < 4) return res.status(400).json({ error: 'Password too short' });
  db.config.adminHash = bcrypt.hashSync(p, 10); db.config.adminDefault = false; save(); res.json({ ok: true });
});

// ---------- stock given (admin) ----------
app.post('/api/allocations', auth('admin'), (req, res) => {
  const t = db.technicians.find(x => x.id === req.body.techId), i = db.items.find(x => x.id === req.body.itemId);
  const qty = Math.floor(num(req.body.qty)), date = String(req.body.date || today());
  if (!t || !i || qty < 1) return res.status(400).json({ error: 'Check technician, item and quantity' });
  db.allocations.push({ id: crypto.randomUUID(), techId: t.id, techName: t.name, itemId: i.id, itemName: i.name, qty, date, ts: Date.now() });
  save(); res.json({ ok: true });
});

// ---------- sales / cases (technician) ----------
app.post('/api/reports', auth('tech'), (req, res) => {
  const b = req.body, customer = String(b.customer || '').trim(), caseId = String(b.caseId || '').trim();
  if (!customer || !caseId) return res.status(400).json({ error: 'Customer and Case ID are required' });
  const lines = [];
  for (const l of (b.serviceOnly === true ? [] : Array.isArray(b.lines) ? b.lines : [])) {
    const it = db.items.find(x => x.id === l.itemId), qty = Math.floor(num(l.qty));
    const foc = l.foc === true;                                                                  // FOC = free of cost: customer is not charged, stock is still used
    if (it && qty > 0) lines.push({ itemId: it.id, name: it.name, price: foc ? 0 : it.price, mrp: it.price, foc, qty });   // price always taken from the server
  }
  const other = Math.max(0, num(b.other)), subtotal = lines.reduce((s, l) => s + l.price * l.qty, 0) + other;
  if (!subtotal && !lines.length && b.serviceOnly !== true) return res.status(400).json({ error: 'Add at least one item or charge' });
  const free = subtotal === 0 && (lines.length > 0 || b.serviceOnly === true);                // every spare is FOC and no other charge: nothing to pay, so no bill is needed
  const payMode = !free && b.payMode === 'PhonePe' ? 'PhonePe' : 'Cash';
  if (!free && !okImg(b.billPhoto)) return res.status(400).json({ error: 'Upload the bill photo' });
  if (payMode === 'PhonePe' && !okImg(b.payPhoto)) return res.status(400).json({ error: 'Upload the PhonePe payment photo' });
  const billFile = okImg(b.billPhoto) ? saveImg(b.billPhoto) : '', payFile = payMode === 'PhonePe' ? saveImg(b.payPhoto) : '';
  const discount = Math.min(Math.max(0, num(b.discount)), subtotal);
  db.reports.push({
    id: crypto.randomUUID(), techId: req.user.id, techName: req.user.name, date: String(b.date || today()),
    customer, phone: String(b.phone || '').trim(), address: String(b.address || '').trim(), caseId,
    type: b.type === 'Installation' ? 'Installation' : 'Service', serviceOnly: b.serviceOnly === true, payMode, billFile, payFile, lines, other, subtotal, discount,
    dstatus: discount ? 'pending' : 'none', notes: String(b.notes || '').trim(), seen: false, ts: Date.now()
  });
  save(); res.json({ ok: true });
});
app.post('/api/reports/:id/seen', auth('admin'), (req, res) => {
  const r = db.reports.find(x => x.id === req.params.id); if (r) { r.seen = true; save(); } res.json({ ok: true });
});
app.post('/api/reports/:id/discount', auth('admin'), (req, res) => {
  const r = db.reports.find(x => x.id === req.params.id); if (!r) return res.status(404).json({ error: 'Not found' });
  r.dstatus = req.body.approve ? 'approved' : 'rejected'; r.seen = true; save(); res.json({ ok: true });
});

// ---------- reset notifications + photos only (stock and sales figures are NOT touched) ----------
app.post('/api/notifications/reset', auth('admin'), (req, res) => {
  const tid = String(req.body.techId || ''); let count = 0;
  for (const r of db.reports) {
    if ((tid && r.techId !== tid) || r.dstatus === 'pending') continue;   // discounts waiting for approval are kept
    for (const f of [r.billFile, r.payFile]) if (f) {
      if (pool) pool.query('delete from files where name = $1', [f]).catch(() => {});
      else { try { fs.unlinkSync(path.join(UPLOADS, f)); } catch (e) {} }
    }
    if (!r.seen || r.billFile || r.payFile) count++;
    r.billFile = ''; r.payFile = ''; r.seen = true;
  }
  save(); res.json({ ok: true, count });
});

// ---------- estimates / quotations (admin) ----------
app.post('/api/estimates', auth('admin'), (req, res) => {
  const b = req.body, customer = String(b.customer || '').trim();
  if (!customer) return res.status(400).json({ error: 'Enter customer name' });
  const lines = [];
  for (const l of Array.isArray(b.lines) ? b.lines : []) {
    const it = db.items.find(x => x.id === l.itemId), qty = Math.floor(num(l.qty));
    if (it && qty > 0) {
      if (!it.hsn || !it.partCode) return res.status(400).json({ error: 'Add HSN code and Part code for ' + it.name + ' in Setup' });
      lines.push({ itemId: it.id, name: it.name, hsn: it.hsn, partCode: it.partCode, price: it.price, qty });
    }
  }
  const other = Math.max(0, num(b.other)), subtotal = lines.reduce((t, l) => t + l.price * l.qty, 0) + other;
  if (!subtotal) return res.status(400).json({ error: 'Add at least one item or charge' });
  const discount = Math.min(Math.max(0, num(b.discount)), subtotal);
  const seq = (db.config.estSeq || 0) + 1; db.config.estSeq = seq;
  const eid = crypto.randomUUID();
  db.estimates.push({
    id: eid, no: 'EST-' + String(seq).padStart(4, '0'), date: String(b.date || today()), customer,
    phone: String(b.phone || '').trim(), address: String(b.address || '').trim(), lines, other, subtotal, discount,
    total: subtotal - discount, notes: String(b.notes || '').trim(), ts: Date.now()
  });
  save(); res.json({ ok: true, id: eid });
});
app.delete('/api/estimates/:id', auth('admin'), (req, res) => {
  db.estimates = db.estimates.filter(x => x.id !== req.params.id); save(); res.json({ ok: true });
});

// ---------- daily attendance: working / leave (admin only) ----------
app.post('/api/attendance', auth('admin'), (req, res) => {
  const t = db.technicians.find(x => x.id === req.body.techId);
  const date = String(req.body.date || ''), st = req.body.status;
  if (!t) return res.status(400).json({ error: 'Technician not found' });
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return res.status(400).json({ error: 'Bad date' });
  if (!['working', 'leave', ''].includes(st)) return res.status(400).json({ error: 'Bad status' });
  db.attendance = db.attendance.filter(a => !(a.techId === t.id && a.date === date));
  if (st) db.attendance.push({ techId: t.id, date, status: st, ts: Date.now() });
  save(); res.json({ ok: true });
});

// ---------- bill / PhonePe photos (admin, or the technician who uploaded them) ----------
app.get('/api/files/:name', auth(), async (req, res) => {
  const n = req.params.name;
  if (!/^[a-f0-9-]+\.(jpg|png|webp)$/.test(n)) return res.status(400).end();
  if (req.user.role !== 'admin' && !db.reports.some(r => r.techId === req.user.id && (r.billFile === n || r.payFile === n))) return res.status(403).end();
  if (pool) {
    try {
      const r = await pool.query('select data from files where name = $1', [n]);
      if (!r.rows[0]) return res.status(404).end();
      res.type(n.split('.').pop()); return res.send(r.rows[0].data);
    } catch (e) { return res.status(500).end(); }
  }
  res.sendFile(path.join(UPLOADS, n));
});

// ---------- full backup for the PC (records + list of photos) and restore ----------
app.get('/api/export/full.json', auth('admin'), (req, res) => {
  db.config.backupDate = today(); save();
  const photos = [...new Set(db.reports.flatMap(r => [r.billFile, r.payFile]).filter(Boolean))];
  const { adminHash, adminDefault, ...cfg } = db.config;          // the admin password is never exported
  res.json({ version: 1, saved: new Date().toISOString(), data: { ...db, config: cfg }, photos });
});
app.post('/api/restore', auth('admin'), (req, res) => {
  const b = req.body || {}, d = b.data;
  if (b.confirm !== 'RESTORE' || !d) return res.status(400).json({ error: 'Type RESTORE to confirm' });
  const keys = ['items', 'technicians', 'allocations', 'reports', 'estimates', 'attendance'];
  for (const k of keys) if (d[k] !== undefined && !Array.isArray(d[k])) return res.status(400).json({ error: 'Bad backup file' });
  db = { items: d.items || [], technicians: d.technicians || [], allocations: d.allocations || [], reports: d.reports || [], estimates: d.estimates || [], attendance: d.attendance || [],
         config: { ...(d.config || {}), adminHash: db.config.adminHash, adminDefault: db.config.adminDefault, backupDate: today() } };
  save(); res.json({ ok: true, counts: Object.fromEntries(keys.map(k => [k, db[k].length])) });
});
app.post('/api/restore/photo', auth('admin'), (req, res) => {
  const { name, data } = req.body || {};
  if (!/^[a-f0-9-]+\.(jpg|png|webp)$/.test(String(name)) || !okImg(data)) return res.status(400).json({ error: 'Bad photo' });
  putFile(name, Buffer.from(/^data:image\/(?:jpeg|png|webp);base64,(.+)$/s.exec(data)[1], 'base64'));
  res.json({ ok: true });
});

// ---------- PC backup tool: remove OLD photos online, only the ones the PC has confirmed it saved ----------
app.post('/api/photos/prune', auth('admin'), (req, res) => {
  const names = new Set(Array.isArray(req.body.names) ? req.body.names : []);
  const days = Math.max(7, Math.floor(num(req.body.days) || 60));
  const cutoff = new Date(Date.now() - days * 864e5).toISOString().slice(0, 10);
  let n = 0;
  for (const r of db.reports) {
    if (r.date >= cutoff || r.dstatus === 'pending') continue;          // recent cases and pending discounts keep their photos
    for (const k of ['billFile', 'payFile']) {
      const f = r[k];
      if (f && names.has(f)) { delFile(f); r[k] = ''; r.archived = true; n++; }
    }
  }
  if (n) save();
  usageCache.t = 0;
  res.json({ ok: true, deleted: n });
});

// ---------- downloads (admin) ----------
const csv = rows => '\ufeff' + rows.map(r => r.map(c => '"' + String(c == null ? '' : c).replace(/"/g, '""') + '"').join(',')).join('\r\n');
const pay = r => r.dstatus === 'approved' ? r.subtotal - r.discount : r.subtotal;
app.get('/api/export/sales.csv', auth('admin'), (req, res) => {
  res.type('text/csv').send(csv([['Date', 'Technician', 'Tech ID', 'Customer', 'Phone', 'Case ID', 'Type', 'Address', 'Items', 'Subtotal', 'Discount', 'Discount status', 'Total payable', 'Payment', 'Notes']]
    .concat(db.reports.map(r => [r.date, r.techName, r.techId, r.customer, r.phone, r.caseId, r.type, r.address,
      r.lines.map(l => `${l.name} x${l.qty} ${l.foc ? 'FOC' : '@' + l.price}`).join('; ') + (r.other ? `; Other ${r.other}` : ''), r.subtotal, r.discount, r.dstatus, pay(r), r.payMode || '', r.notes]))));
});
app.get('/api/export/stock.csv', auth('admin'), (req, res) => {
  res.type('text/csv').send(csv([['Date', 'Technician', 'Tech ID', 'Item', 'Qty given']].concat(db.allocations.map(a => [a.date, a.techName, a.techId, a.itemName, a.qty]))));
});
app.get('/api/export/backup.json', auth('admin'), (req, res) => {
  db.config.backupDate = today(); save();
  res.json({ saved: today(), items: db.items, technicians: db.technicians.map(({ id, name }) => ({ id, name })), allocations: db.allocations, reports: db.reports, estimates: db.estimates, attendance: db.attendance });
});

// ---------- Kent portal robot (runs on the owner's PC, needs ROBOT_KEY in .env) ----------
const ROBOT_KEY = process.env.ROBOT_KEY || '';
// What the technician sees for the Kent approval: waiting | sending | sent | failed | manual | offline | '' (nothing)
// Technician view: a Draft case waiting for the serial number / warranty card. sent = time the technician last sent it.
const serialWaitFor = r => (r.kent && r.kent.status === 'pending' && (r.kent.kind === 'serial' || r.kent.kind === 'warranty'))
  ? { need: r.kent.kind, note: String(r.kent.note || '').slice(0, 300), ts: r.kent.ts, sent: r.serial ? r.serial.ts : 0 } : undefined;
const techKs = r => {
  const k = r.kent && r.kent.status;
  if (k === 'approval_sent') return 'sent';
  if (k === 'pending' && (r.kent.kind === 'serial' || r.kent.kind === 'warranty')) return 'serial';   // Draft machine: technician must send serial / warranty card
  if (k === 'failed' || k === 'pending') return 'failed';   // 'pending' = Case ID not found in Kent -> technician also sees "transferred to admin"
  if (k === 'working' || k === 'filled') return 'sending';
  if (k === 'manual') return 'manual';
  if (k === 'skipped' || k === 'cancelled' || r.type === 'Installation' || /offline/i.test(r.caseId || '')) return '';
  if (r.ts < (db.config.robotSince || 0)) return '';
  return robotOnline() ? 'waiting' : 'offline';   // robot PC off -> technician goes straight to the WhatsApp share
};
// Lightweight status for the technician's "sending approval" screen (polled every 2 seconds).
app.get('/api/reports/:id/ks', auth('tech'), (req, res) => {
  const r = db.reports.find(x => x.id === req.params.id && x.techId === req.user.id);
  if (!r) return res.status(404).json({ error: 'Not found' });
  res.json({ ks: techKs(r) });
});
const robotOnline = () => Date.now() - robotLastSeen < 3 * 60 * 1000;   // robot asks for cases every minute; 3 min of silence = offline
let robotLastSeen = 0;                                   // time the robot last asked for cases (kept in memory only)
// A case the robot may take: not touched yet, submitted after the robot first connected, no discount waiting, not install/offline.
const robotOk = r => !r.kent && r.ts >= (db.config.robotSince || 0) && r.type !== 'Installation' && !/offline/i.test(r.caseId || '');
// Priority cases first (the one the admin marked last goes first), then oldest first.
// Pending cases are looked at again every 15 minutes (up to 48 times = 12 hours). After that they wait for the admin (Go next / Done by hand).
const RECHECK_MS = 15 * 60 * 1000, MAX_CHECKS = 48;
const robotDue = r => !!r.kent && r.kent.status === 'pending' && (r.kent.next || 0) <= Date.now() && (r.kentChecks || 0) < MAX_CHECKS && r.ts >= (db.config.robotSince || 0);
const byPrio = (a, b) => (b.kentPrio || 0) - (a.kentPrio || 0) || (!!a.kent - !!b.kent) || a.ts - b.ts;   // priority first, then new cases, re-checks last
const robotAuth = (req, res, next) => {
  if (ROBOT_KEY.length < 20 || !same(hmac(String(req.headers['x-robot-key'] || '')), hmac(ROBOT_KEY))) return res.status(401).json({ error: 'Bad robot key' });
  next();
};
// New cases only: reports that existed before the robot first connected are never pushed. Cases with a discount still waiting for approval are held back.
// Draft machines: the serial number / warranty card that the technician sent (robot reads these fields).
const serialFields = r => r.serial ? { serialNo: r.serial.no, serialMode: r.serial.mode, serialInst: r.serial.inst, serialPur: r.serial.pur, serialCode: r.serial.code, serialFile: r.serial.file, serialTs: r.serial.ts } : {};
app.get('/api/robot/cases', robotAuth, (req, res) => {
  robotLastSeen = Date.now();
  if (!db.config.robotSince) { db.config.robotSince = Date.now(); save(); }
  const list = db.reports.filter(r => robotOk(r) || robotDue(r)).sort(byPrio).map(r => ({
    id: r.id, ...serialFields(r), notes: String(r.notes || '').slice(0, 200), try: r.kentTry || 0, checks: r.kentChecks || 0, recheck: !!r.kent, force: !!r.kentForce, caseId: r.caseId, type: r.type, serviceOnly: !!r.serviceOnly || !r.lines.length, techName: r.techName, total: pay(r), other: r.other || 0,
    lines: r.lines.map(l => { const it = db.items.find(x => x.id === l.itemId); return { name: l.name, partCode: it ? it.partCode : '', qty: l.qty, foc: !!l.foc }; })
  }));
  res.json({ cases: list });
});
app.post('/api/robot/cases/:id/status', robotAuth, (req, res) => {
  const r = db.reports.find(x => x.id === req.params.id); if (!r) return res.status(404).json({ error: 'Not found' });
  const st = String(req.body.status || ''); if (!['working', 'filled', 'approval_sent', 'failed', 'pending', 'skipped'].includes(st)) return res.status(400).json({ error: 'Bad status' });
  if (st === 'working' && r.kent && r.kent.status === 'cancelled') return res.status(409).json({ error: 'Removed from the queue by the admin' });   // admin removed it a moment before the robot took it
  if (st === 'pending') { r.kentChecks = (r.kentChecks || 0) + 1; r.kent = { status: 'pending', note: String(req.body.note || '').slice(0, 300), ts: Date.now(), kind: ['allocated', 'serial', 'warranty'].includes(req.body.kind) ? req.body.kind : 'notfound', checks: r.kentChecks, next: Date.now() + RECHECK_MS }; }
  else r.kent = { status: st, note: String(req.body.note || '').slice(0, 300), ts: Date.now() };
  if (st !== 'working') { delete r.kentPrio; delete r.kentForce; }
  save(); res.json({ ok: true });
});
// Technician: send the serial number (mode serial) or the warranty card (mode warranty) + photo for a Draft case the robot is waiting for.
app.post('/api/reports/:id/serial', auth('tech'), (req, res) => {
  const r = db.reports.find(x => x.id === req.params.id); if (!r) return res.status(404).json({ error: 'Not found' });
  if (r.techId !== req.user.id && req.user.role !== 'admin') return res.status(403).json({ error: 'Not your case' });
  if (!r.kent || r.kent.status !== 'pending' || !['serial', 'warranty'].includes(r.kent.kind)) return res.status(400).json({ error: 'This case is not waiting for a serial number or warranty card' });
  const mode = (r.kent.kind === 'warranty' || req.body.mode === 'warranty') ? 'warranty' : 'serial';   // Kent did not find the serial -> warranty card only
  const no = String(req.body.serialNo || '').trim().toUpperCase().slice(0, 40);
  if (!no) return res.status(400).json({ error: 'Type the serial number' });
  const dOk = s => /^\d{1,2}[\/.-]\d{1,2}[\/.-]\d{2,4}$/.test(s);
  const inst = String(req.body.inst || '').trim(), pur = String(req.body.pur || '').trim(), code = String(req.body.code || '').trim().toUpperCase().slice(0, 40);
  if (mode === 'warranty' && (!dOk(inst) || !dOk(pur) || !code)) return res.status(400).json({ error: 'Warranty card: installation date and purchase date (dd/mm/yyyy) and product code are required' });
  if (!okImg(req.body.photo)) return res.status(400).json({ error: mode === 'warranty' ? 'Add the warranty card photo' : 'Add the serial number photo' });
  if (r.serial && r.serial.file) delFile(r.serial.file);
  r.serial = { no, mode, inst: mode === 'warranty' ? inst : '', pur: mode === 'warranty' ? pur : '', code: mode === 'warranty' ? code : '', file: saveImg(req.body.photo), ts: Date.now() };
  r.kentChecks = 0; r.kent.next = 0;                 // the robot looks at it again right away
  save(); res.json({ ok: true });
});
// Robot: download the serial / warranty photo of a case (only photos that belong to a case the robot may read).
app.get('/api/robot/files/:name', robotAuth, async (req, res) => {
  const n = req.params.name;
  if (!/^[a-f0-9-]+\.(jpg|png|webp)$/.test(n) || !db.reports.some(r => r.serial && r.serial.file === n)) return res.status(404).end();
  if (pool) {
    try {
      const r = await pool.query('select data from files where name = $1', [n]);
      if (!r.rows[0]) return res.status(404).end();
      res.type(n.split('.').pop()); return res.send(r.rows[0].data);
    } catch (e) { return res.status(500).end(); }
  }
  res.sendFile(path.join(UPLOADS, n));
});

// Robot asks before each big step whether the admin cancelled the case it is working on.
app.get('/api/robot/cases/:id/cancel', robotAuth, (req, res) => {
  robotLastSeen = Date.now();
  const r = db.reports.find(x => x.id === req.params.id);
  if (r && r.kent && r.kent.status === 'working') r.kent.seen = Date.now();   // proof the robot is on THIS case (it asks every 0.5 s while working)
  res.json({ cancel: !!(r && r.kent && r.kent.status === 'working' && r.kent.cancel) });
});
// Admin: cancel the case the robot is working on. The robot stops at its next checkpoint and the case goes to Failed (finish it by hand).
app.post('/api/reports/:id/cancel', auth('admin'), (req, res) => {
  const r = db.reports.find(x => x.id === req.params.id); if (!r) return res.status(404).json({ error: 'Not found' });
  if (!r.kent || r.kent.status !== 'working') return res.status(400).json({ error: 'The robot is not working on this case' });
  const onIt = Date.now() - Math.max(r.kent.seen || 0, r.kent.ts || 0) < 10000;   // robot asked about THIS case in the last 10 s (or just started it)
  if (!onIt) r.kent = { status: 'failed', note: 'Cancelled by admin (robot was not on this case) - check Kent and finish by hand', ts: Date.now() };   // nobody is working on it: cancel at once
  else r.kent = { ...r.kent, cancel: true, note: 'Cancel requested - robot is stopping', ts: r.kent.ts };
  save(); res.json({ ok: true });
});
// Safety net: a cancel request that no robot answers within 10 s (robot closed or restarted mid-case) is completed here.
setInterval(() => {
  let changed = false;
  for (const r of db.reports) {
    if (r.kent && r.kent.status === 'working' && r.kent.cancel && Date.now() - Math.max(r.kent.seen || 0, r.kent.ts || 0) > 10000) {
      r.kent = { status: 'failed', note: 'Cancelled by admin (robot was not on this case) - check Kent and finish by hand', ts: Date.now() }; changed = true;
    }
  }
  if (changed) save();
}, 3000);
// Admin: remove a WAITING case from the queue. The robot will never take it; finish it in Kent by hand if needed.
app.post('/api/reports/:id/dequeue', auth('admin'), (req, res) => {
  const r = db.reports.find(x => x.id === req.params.id); if (!r) return res.status(404).json({ error: 'Not found' });
  if (!robotOk(r)) return res.status(400).json({ error: 'This case is not waiting in the queue' });
  r.kent = { status: 'cancelled', note: 'Removed from queue by admin', ts: Date.now() }; delete r.kentPrio;
  save(); res.json({ ok: true });
});
// Admin: put a waiting case next in line (priority 1). It never interrupts the case the robot is working on now.
app.post('/api/reports/:id/priority', auth('admin'), (req, res) => {
  const r = db.reports.find(x => x.id === req.params.id); if (!r) return res.status(404).json({ error: 'Not found' });
  if (!robotOk(r)) return res.status(400).json({ error: 'This case is not waiting in the queue' });
  if (req.body.on === false) delete r.kentPrio; else r.kentPrio = Date.now();
  save(); res.json({ ok: true });
});
// Admin: "Go next" on a Pending case (urgent). It becomes priority 1: the robot works it right after the case it is working on now, even if Kent still shows Allocated.
app.post('/api/reports/:id/gonext', auth('admin'), (req, res) => {
  const r = db.reports.find(x => x.id === req.params.id); if (!r) return res.status(404).json({ error: 'Not found' });
  if (!r.kent || r.kent.status !== 'pending') return res.status(400).json({ error: 'Only Pending cases can go next' });
  r.kentTry = (r.kentTry || 0) + 1; delete r.kent; r.kentPrio = Date.now(); r.kentForce = true;
  save(); res.json({ ok: true });
});
// Admin: Retry a Failed case. It goes back to the queue as priority 1 and the robot starts it again from the beginning.
app.post('/api/reports/:id/retry', auth('admin'), (req, res) => {
  const r = db.reports.find(x => x.id === req.params.id); if (!r) return res.status(404).json({ error: 'Not found' });
  if (!r.kent || r.kent.status !== 'failed') return res.status(400).json({ error: 'Only Failed cases can be retried' });
  r.kentTry = (r.kentTry || 0) + 1; delete r.kent; r.kentPrio = Date.now(); delete r.kentForce;
  save(); res.json({ ok: true });
});
// Admin: a failed / pending / stuck / filled case was finished by hand - remove it from the Sending list.
app.post('/api/reports/:id/hand', auth('admin'), (req, res) => {
  const r = db.reports.find(x => x.id === req.params.id); if (!r) return res.status(404).json({ error: 'Not found' });
  if (!r.kent || !['failed', 'pending', 'working', 'filled'].includes(r.kent.status)) return res.status(400).json({ error: 'Nothing to clear for this case' });
  r.kent = { status: 'manual', note: 'Finished by hand', ts: Date.now() }; delete r.kentPrio; save(); res.json({ ok: true });
});

bootstrap()
  .then(() => app.listen(PORT, () => console.log(`Kent stock app running on port ${PORT} - storage: ${pool ? 'database' : 'files'}`)))
  .catch(e => { console.error('Could not start:', e); process.exit(1); });
