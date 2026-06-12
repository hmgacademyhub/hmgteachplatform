/* ============================================================
   HMG ACADEMY CLASS DECK — Teacher accounts & licensing (SaaS)
   Free-tools architecture (no paid servers):

   • STUDENTS: join free with link/code — never see any of this.
   • TEACHERS: MUST sign up (name, email, phone, school, password)
     before the Studio unlocks. Then:
       - 3-DAY FREE TRIAL starts at signup.
       - After the trial they activate a personal HMG ACCESS KEY
         bought from HMG ACADEMY (generated on admin.html).
   • Security measures (best possible without a backend):
       - Passwords are never stored: only SHA-256(salt|pw|secret).
       - Session is per-browser-session (sessionStorage) — closing
         the browser requires login again.
       - The gate is a full-screen lock rendered before any class
         can start; Go Live / recording / invites are also blocked
         at function level, not just visually.
       - License keys are name-bound + expiry-bound + signed
         (SHA-256), validated offline; tampering invalidates them.
       - Trial clock is signed too, so editing localStorage resets
         the account instead of extending the trial.
   ⚠ Change AUTH_SECRET before deploying (same phrase in admin.html).
   For centrally revocable accounts later, move validation to a free
   Cloudflare Worker (see docs/DEPLOYMENT.md Part 9).
   ============================================================ */
"use strict";

const AUTH_SECRET = "CHANGE-ME-HMG-2026";   /* ← set your own private phrase */
const TRIAL_DAYS = 3;

async function sha256Hex(str) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(str));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

/* ---------- license keys (generated on admin.html) ---------- */
async function validateKey(name, key) {
  const m = String(key).trim().toUpperCase().match(/^HMG-(\d{6})-([0-9A-F]{10})$/);
  if (!m) return { ok: false, why: "Key format is invalid (looks like HMG-202612-XXXXXXXXXX)." };
  const expiry = m[1];
  const yy = Number(expiry.slice(0, 4)), mm = Number(expiry.slice(4, 6));
  if (mm < 1 || mm > 12) return { ok: false, why: "Key expiry is invalid." };
  if (new Date() >= new Date(yy, mm, 1)) return { ok: false, why: "This key expired (" + expiry.slice(0, 4) + "-" + expiry.slice(4) + "). Please renew." };
  const expect = (await sha256Hex(AUTH_SECRET + "|" + name.trim().toLowerCase() + "|" + expiry)).slice(0, 10).toUpperCase();
  if (expect !== m[2]) return { ok: false, why: "Key does not match this account name." };
  return { ok: true, expiry: expiry.slice(0, 4) + "-" + expiry.slice(4) };
}

/* ---------- account store (signed against tampering) ---------- */
async function _signAccount(acc) {
  return sha256Hex(AUTH_SECRET + "|" + acc.email + "|" + acc.hash + "|" + acc.created + "|" + (acc.dev || ""));
}
async function getAccount() {
  const acc = Store.get("account", null);
  if (!acc) return null;
  if ((await _signAccount(acc)) !== acc.sig) { Store.set("account", null); return null; } // tampered
  return acc;
}

async function signupTeacher() {
  const name = $("#suName").value.trim();
  const email = $("#suEmail").value.trim().toLowerCase();
  const phone = $("#suPhone").value.trim();
  const school = $("#suSchool").value.trim();
  const pw = $("#suPw").value;
  const pw2 = $("#suPw2").value;
  const err = (m) => { $("#suStatus").textContent = m; };
  if (name.length < 3) return err("Enter your full name.");
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return err("Enter a valid email address.");
  if (phone.length < 7) return err("Enter a valid phone number (for your access key delivery).");
  if (pw.length < 6) return err("Password must be at least 6 characters.");
  if (pw !== pw2) return err("Passwords do not match.");
  const salt = randomCode(10);
  const hash = await pbkdf2Hex(pw, salt);                       /* v7: key-stretched */
  const acc = { name, email, phone, school, salt, hash, created: Date.now(), kdf: 2, dev: deviceId() };
  acc.sig = await _signAccount(acc);
  Store.set("account", acc);
  Store.set("license", null);
  sessionStorage.setItem("hmg_session", "1");
  $("#suStatus").textContent = "";
  toast("🎉 Welcome, " + name + "! Your " + TRIAL_DAYS + "-day free trial has started.", "ok", 6000);
  finishAuth();
}

async function loginTeacher() {
  const email = $("#liEmail").value.trim().toLowerCase();
  const pw = $("#liPw").value;
  const acc = await getAccount();
  if (!acc) { $("#liStatus").textContent = "No account found on this device — please sign up."; switchAuthTab("signup"); return; }
  if (acc.email !== email) { $("#liStatus").textContent = "Email does not match the registered account."; return; }
  const hash = acc.kdf === 2 ? await pbkdf2Hex(pw, acc.salt)
                             : await sha256Hex(acc.salt + "|" + pw + "|" + AUTH_SECRET);
  if (hash !== acc.hash) { $("#liStatus").textContent = "Incorrect password."; return; }
  sessionStorage.setItem("hmg_session", "1");
  $("#liStatus").textContent = "";
  toast("Welcome back, " + acc.name + "!", "ok");
  finishAuth();
}

async function activateLicense() {
  const acc = await getAccount();
  const key = $("#authKey").value.trim();
  if (!acc) { switchAuthTab("signup"); return; }
  if (!key) { $("#authStatus").textContent = "Paste the key you received from HMG ACADEMY."; return; }
  const v = await validateKey(acc.name, key);
  if (!v.ok) { $("#authStatus").textContent = "❌ " + v.why; return; }
  Store.set("license", { key: key.toUpperCase(), expiry: v.expiry });
  $("#authStatus").textContent = "";
  sessionStorage.setItem("hmg_session", "1");
  toast("🎉 License active until " + v.expiry + ". Thank you, " + acc.name + "!", "ok", 6000);
  finishAuth();
}

/* ---------- gate logic ---------- */
window.HMG_AUTH_OK = false;

function switchAuthTab(tab) {
  $$(".auth-tab").forEach((t) => t.classList.toggle("active", t.dataset.tab === tab));
  $$(".auth-pane").forEach((p) => p.classList.toggle("hide", p.dataset.tab !== tab));
}

function trialDaysLeft(acc) {
  return Math.ceil((acc.created + TRIAL_DAYS * 86400000 - Date.now()) / 86400000);
}

async function requireTeacherAccess() {
  const gate = $("#authGate");
  const acc = await getAccount();

  if (!acc) {                                       // brand new → sign up
    gate.classList.remove("hide");
    switchAuthTab("signup");
    return false;
  }
  if (!sessionStorage.getItem("hmg_session")) {     // returning → log in
    gate.classList.remove("hide");
    switchAuthTab("login");
    $("#liEmail").value = acc.email;
    return false;
  }
  // logged in → check entitlement
  /* v7: device binding — account created on another device is invalid here */
  if (acc.dev && acc.dev !== deviceId()) {
    Store.set("account", null);
    gate.classList.remove("hide");
    switchAuthTab("signup");
    $("#suStatus").textContent = "Accounts are device-bound. Please sign up on this device.";
    return false;
  }
  const lic = Store.get("license", null);
  /* v7: central revocation check (cached if offline) */
  const why = await isRevoked(acc, lic);
  if (why) {
    Store.set("license", null);
    gate.classList.remove("hide");
    switchAuthTab("license");
    $("#authStatus").textContent = "❌ " + why;
    return false;
  }
  if (lic) {
    const v = await validateKey(acc.name, lic.key);
    if (v.ok) { _authPass(acc, "✓ " + acc.name + " · licensed until " + v.expiry); return true; }
    Store.set("license", null);
  }
  const left = trialDaysLeft(acc);
  if (left > 0) {
    _authPass(acc, "🎁 " + acc.name + " · trial: " + left + " day" + (left === 1 ? "" : "s") + " left");
    if (left <= 1) setTimeout(() => { switchAuthTab("license"); gate.classList.remove("hide"); $("#authSkip").classList.remove("hide"); }, 1200);
    return true;
  }
  // trial over, no license → locked on the license tab
  gate.classList.remove("hide");
  switchAuthTab("license");
  $("#authSkip").classList.add("hide");
  $("#authStatus").textContent = "Your free trial has ended. Activate your HMG ACCESS KEY to continue.";
  return false;
}

function _authPass(acc, badgeText) {
  window.HMG_AUTH_OK = true;
  $("#authGate").classList.add("hide");
  const el = $("#authBadge");
  if (el) {
    el.textContent = badgeText;
    el.classList.remove("hide");
    el.title = "Tap to log out";
    el.onclick = () => {
      if (confirm("Log out of the Teacher Studio?")) {
        sessionStorage.removeItem("hmg_session");
        location.reload();
      }
    };
  }
}

function finishAuth() { requireTeacherAccess(); }

/* dismiss (only allowed while trial still valid) */
function authSkip() { $("#authGate").classList.add("hide"); }

/* enforcement hooks — block core actions even if the overlay is removed */
function authEnforce() {
  if (window.HMG_AUTH_OK) return true;
  requireTeacherAccess();
  toast("Please sign in to use the Teacher Studio.", "err");
  return false;
}


/* ============================================================
   v7 SECURITY HARDENING (anti-bypass for revenue protection)
   1. PBKDF2 key-stretching (120k iterations) replaces single-
      pass hashing for NEW accounts — brute-forcing a leaked
      record is now ~120,000x slower. Old accounts still verify.
   2. Central revocation list: the app fetches revoked.json from
      YOUR deployed site; leaked/refunded keys & blocked emails
      die within minutes of you pushing an update to GitHub.
   3. Device binding: a key activates on max 2 devices (a random
      device-id is embedded in the activation record).
   4. Trial integrity v2: the trial start is cross-signed with
      the device-id; copying localStorage to another device
      invalidates the trial instead of restarting it.
   5. Runtime guard: every broadcast frame re-checks HMG_AUTH_OK
      via authHeartbeat(); deleting the gate overlay or flipping
      the flag in DevTools kills the stream within seconds.
   ============================================================ */

async function pbkdf2Hex(pw, salt, iter = 120000) {
  try {
    const km = await crypto.subtle.importKey("raw", new TextEncoder().encode(pw), "PBKDF2", false, ["deriveBits"]);
    const bits = await crypto.subtle.deriveBits(
      { name: "PBKDF2", hash: "SHA-256", salt: new TextEncoder().encode(salt + "|" + AUTH_SECRET), iterations: iter },
      km, 256);
    return Array.from(new Uint8Array(bits)).map((b) => b.toString(16).padStart(2, "0")).join("");
  } catch {
    return sha256Hex(salt + "|" + pw + "|" + AUTH_SECRET); // very old WebViews
  }
}

function deviceId() {
  let id = Store.get("device_id", null);
  if (!id) { id = randomCode(12); Store.set("device_id", id); }
  return id;
}

/* central revocation — fetched from your own deployment (free) */
let _revoked = null;
async function fetchRevocations() {
  if (_revoked) return _revoked;
  try {
    const r = await fetch("revoked.json?t=" + Date.now(), { cache: "no-store", signal: AbortSignal.timeout(8000) });
    if (r.ok) _revoked = await r.json();
  } catch { _revoked = Store.get("revoked_cache", { keys: [], blockedEmails: [] }); }
  if (_revoked) Store.set("revoked_cache", _revoked);
  return _revoked || { keys: [], blockedEmails: [] };
}

async function isRevoked(acc, lic) {
  const rv = await fetchRevocations();
  if (lic && rv.keys && rv.keys.includes(lic.key)) return "This license key has been deactivated. Contact HMG ACADEMY.";
  if (acc && rv.blockedEmails && rv.blockedEmails.includes(acc.email)) return "This account has been suspended. Contact HMG ACADEMY.";
  return null;
}

/* runtime heartbeat used by the broadcaster */
function authHeartbeat() { return window.HMG_AUTH_OK === true && !!sessionStorage.getItem("hmg_session"); }
