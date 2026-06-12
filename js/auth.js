/* ============================================================
   HMG ACADEMY CLASS DECK v6 — Teacher access (SaaS licensing)
   100% free-tools approach (no backend, no database):

   • STUDENTS join free with a link/code — nothing changes.
   • TEACHERS need an HMG ACCESS KEY to use the Teacher Studio.
     - 14-day FREE TRIAL starts automatically on first use.
     - After the trial, the teacher buys a key from HMG ACADEMY
       (bank transfer / Paystack / Flutterwave payment link) and
       you send them a key generated on admin.html.
   • Keys are self-validating: HMG-<expiry>-<signature> where the
     signature = SHA-256(SECRET + name + expiry). admin.html
     generates them; this file verifies them offline.

   ⚠ IMPORTANT: change AUTH_SECRET below (and in admin.html —
   it asks you to type the same secret) BEFORE deploying.
   This is honest-security for a low-cost product: it keeps
   casual users out without paying for servers. For bank-grade
   licensing later, move validation to a free Cloudflare Worker.
   ============================================================ */
"use strict";

const AUTH_SECRET = "CHANGE-ME-HMG-2026";   /* ← set your own private phrase */
const TRIAL_DAYS = 14;
const HMG_PAY_INFO =
  "To get your HMG ACCESS KEY:\n" +
  "1. Pay the small license fee (see hmgacademy.pages.dev or contact us)\n" +
  "2. Send your full name + payment proof via WhatsApp/email\n" +
  "3. Receive your personal key instantly and activate below.";

async function sha256Hex(str) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(str));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

/* key = HMG-<YYYYMM base36-ish, just YYYYMM>-<10 hex sig> */
async function makeKey(name, expiryYYYYMM, secret) {
  const sig = (await sha256Hex((secret || AUTH_SECRET) + "|" + name.trim().toLowerCase() + "|" + expiryYYYYMM)).slice(0, 10).toUpperCase();
  return "HMG-" + expiryYYYYMM + "-" + sig;
}

async function validateKey(name, key) {
  const m = String(key).trim().toUpperCase().match(/^HMG-(\d{6})-([0-9A-F]{10})$/);
  if (!m) return { ok: false, why: "Key format is invalid. It looks like HMG-202612-XXXXXXXXXX" };
  const expiry = m[1];
  const yy = Number(expiry.slice(0, 4)), mm = Number(expiry.slice(4, 6));
  if (mm < 1 || mm > 12) return { ok: false, why: "Key expiry is invalid." };
  const now = new Date();
  const expEnd = new Date(yy, mm, 1); // first day of month AFTER expiry month
  if (now >= expEnd) return { ok: false, why: "This key expired in " + expiry.slice(0, 4) + "-" + expiry.slice(4) + ". Please renew." };
  const expect = (await sha256Hex(AUTH_SECRET + "|" + name.trim().toLowerCase() + "|" + expiry)).slice(0, 10).toUpperCase();
  if (expect !== m[2]) return { ok: false, why: "Key does not match this name. Use the exact name you registered with." };
  return { ok: true, expiry: expiry.slice(0, 4) + "-" + expiry.slice(4) };
}

/* ---------------- teacher gate ---------------- */
function authState() {
  const lic = Store.get("license", null);            // {name, key, expiry}
  let trialStart = Store.get("trial_start", null);
  if (!trialStart) { trialStart = Date.now(); Store.set("trial_start", trialStart); }
  const trialLeft = Math.ceil((trialStart + TRIAL_DAYS * 86400000 - Date.now()) / 86400000);
  return { lic, trialLeft };
}

async function requireTeacherAccess() {
  const { lic, trialLeft } = authState();
  if (lic) {
    const v = await validateKey(lic.name, lic.key);
    if (v.ok) {
      _showAuthBadge("✓ Licensed to " + lic.name + " (until " + v.expiry + ")");
      return true;
    }
    Store.set("license", null); // expired/invalid — fall through
  }
  if (trialLeft > 0) {
    _showAuthBadge("🎁 Free trial — " + trialLeft + " day" + (trialLeft === 1 ? "" : "s") + " left");
    if (trialLeft <= 4) setTimeout(() => openModal("#mAuth"), 1200);
    return true;
  }
  _authLock();
  return false;
}

function _showAuthBadge(text) {
  const el = $("#authBadge");
  if (el) { el.textContent = text; el.classList.remove("hide"); }
}

function _authLock() {
  const gate = $("#authGate");
  if (gate) gate.classList.remove("hide");
  openModal("#mAuth");
}

async function activateLicense() {
  const name = $("#authName").value.trim();
  const key = $("#authKey").value.trim();
  if (!name || !key) { $("#authStatus").textContent = "Enter both your registered name and your key."; return; }
  const v = await validateKey(name, key);
  if (!v.ok) { $("#authStatus").textContent = "❌ " + v.why; return; }
  Store.set("license", { name, key: key.toUpperCase(), expiry: v.expiry });
  $("#authStatus").textContent = "";
  closeModal("#mAuth");
  const gate = $("#authGate");
  if (gate) gate.classList.add("hide");
  _showAuthBadge("✓ Licensed to " + name + " (until " + v.expiry + ")");
  toast("🎉 Welcome, " + name + "! Your HMG ACADEMY CLASS DECK license is active.", "ok", 6000);
}
