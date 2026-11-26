# Kent Service – Technician Stock App

Admin gives stock to technicians, technicians upload cases and sales, admin approves discounts.
Data is stored on YOUR computer/server (no expiry) in `data/db.json`.

## Folder
```
kent-stock-app/
├─ server.js          ← BACKEND (Node + Express, login, stock, sales, discount, backups)
├─ package.json
├─ .env.example       ← copy to .env and edit
└─ public/            ← FRONTEND
   ├─ index.html
   ├─ style.css
   └─ app.js
```

## Run in Visual Studio Code
1. Install **Node.js 20.6 or newer** from nodejs.org.
2. In VS Code: File → Open Folder → `kent-stock-app`.
3. Copy `.env.example` to a new file named `.env` and change `JWT_SECRET` (any long random text).
4. Terminal → New Terminal, then run:
   ```
   npm install
   npm start
   ```
5. Open http://localhost:3000

**Admin login:** ID `gnane`, password `9032` (first time only – change it in Setup → Admin login).
Technicians: admin creates their ID and password in Setup → Technicians.

## Use on phones
- Same Wi-Fi: find your PC's IP (`ipconfig`) and open `http://<PC-IP>:3000` on the phone.
- From anywhere: deploy to a host such as Render, Railway or a VPS. Use a persistent disk/volume for the `data` folder.

## Your data is safe
- Every change is saved to `data/db.json`.
- A copy is kept every day in `data/backups/` (one file per day, automatic).
- Setup → Backup also downloads Excel/CSV and a full JSON file.

## Admin login by e-mail + OTP
The admin logs in with e-mail + a 6-digit code (valid 10 min, one code at a time, 5 tries, rate-limited). Technicians still use ID + password.
1. The admin mailbox is `paidignane708@gmail.com` by default (change it with `ADMIN_EMAIL` if needed).
2. Set ONE mail provider: `BREVO_API_KEY` (+ `MAIL_FROM` = a sender you verified in Brevo), or `RESEND_API_KEY`, or `SMTP_HOST`/`SMTP_PORT`/`SMTP_USER`/`SMTP_PASS` (Gmail needs an App Password). **Render's free plan blocks SMTP ports**, so use Brevo or Resend there (they work over HTTPS).
3. Restart. The login page shows Technician / Admin; Admin asks for the email, then the code. Until `ADMIN_EMAIL` and a provider are set, admin keeps using ID + password.
4. Locked out (mail not working)? Set `ADMIN_OTP_DISABLE=1`, restart, log in with ID + password, fix the mail settings, then remove the variable.

## Notes
- Passwords are hashed (bcrypt). Prices are always taken from the server, so technicians cannot change them.
- The admin screen is protected by login. For email/SMS OTP you can add `nodemailer` or an SMS provider (MSG91/Twilio) inside the `/api/login` route in `server.js`.
- Always use HTTPS when hosting online.

## Host online (Render example)
1. Put the project on GitHub (the `.env` and `data` folders are ignored automatically).
2. On render.com: New → Web Service → connect the repo.
3. Build command: `npm install`   Start command: `npm run start:prod`
4. Choose a **paid** instance (not Free). Free services sleep and cannot keep a disk.
5. Add a **Disk** (1 GB is plenty), Mount Path `/data`.
6. Environment variables: `DATA_DIR=/data`, `JWT_SECRET=<long random text>`, `ADMIN_ID=gnane`, `ADMIN_PASSWORD=<first password>`, `NODE_VERSION=22`.
7. Open the https address Render gives you. Then change the admin password in Setup.
Any VPS also works: install Node 22, run `npm install` and `npm run start:prod` (use pm2 to keep it running), and put Nginx + HTTPS in front.

## Bill and PhonePe photos
Technicians upload a bill photo for every case and a PhonePe payment photo when payment mode is PhonePe. Photos are saved in `data/uploads/`. **Back up the whole `data` folder** (it contains `db.json`, `backups/` and `uploads/`).

## Forgot the admin password
Set the environment variable `RESET_ADMIN_PASSWORD` to a new password and restart the app. Log in with the admin ID and that password, then **delete the variable**. Your data is not touched.

## Keep your data safe on Render's FREE plan (free database)
Render's free plan erases the server's files on every restart and deploy. To keep your data (and photos):
1. Create a free Postgres database at neon.com and copy its connection string (it starts with `postgresql://`).
2. In Render -> your service -> **Environment**, add `DATABASE_URL` = that connection string, then save.
3. Make sure `server.js` and `package.json` are the latest versions on GitHub (they use the `pg` package).
4. Open `your-link/api/health`. It must say `"storage": "database (safe)"`.
Everything is then stored in the database, so deploys and restarts no longer erase anything.
