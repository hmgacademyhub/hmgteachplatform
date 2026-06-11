# 🚀 HMG ACADEMY CLASS DECK (v4) — Deployment Guide (step by step, free tools only)

> v4 note: deployment is identical to earlier versions — it is still a pure static site
> with no build step. If you already deployed an earlier version, just push
> these files over the old ones (CACHE_VERSION in `sw.js` is already bumped to
> v4.0.0 so installed apps auto-update). Suggested repo: `hmg-classdeck`
> (same repo, new commit) or `hmg-classdeck-v4` to keep versions side-by-side.

This guide assumes **zero prior DevOps experience**. Follow it top-to-bottom once;
future updates take under a minute.

> **Golden rule:** the platform MUST be served over **HTTPS**.
> Camera, microphone, screen wake-lock, clipboard and the service worker are
> blocked by browsers on plain `http://`. Every option below provides free HTTPS
> automatically — do not try to host it on a plain-HTTP server.

---

## Part 0 — What you need

| Item | Cost |
|------|------|
| The `platform/` folder (this project) | free |
| A GitHub account → <https://github.com/signup> | free |
| (Option A) A Cloudflare account → <https://dash.cloudflare.com/sign-up> | free |
| Git installed on a PC, **or** just a browser (upload method below needs no Git) | free |

---

## Part 1 — Put the code on GitHub

### Method 1A: Browser only (no Git installed — easiest from a tablet/PC)

1. Log in to GitHub → click the **+** (top-right) → **New repository**.
2. Repository name: `hmg-classdeck` (any name works). Visibility: **Public**
   (required for free GitHub Pages; Cloudflare Pages works with private too).
3. Click **Create repository**.
4. On the new repo page click **uploading an existing file**.
5. Drag **the CONTENTS of the `platform` folder** (index.html, teach.html,
   join.html, sw.js, manifest.webmanifest, and the css/ js/ vendor/ assets/
   docs/ folders) into the upload box.
   ⚠ Upload the *contents*, not the folder itself, so `index.html` sits at the
   repository root. (If you upload the folder itself, see “Subfolder note” below.)
6. Scroll down → commit message: `HMG ClassDeck v1.0` → **Commit changes**.

### Method 1B: With Git (PC / Termux)

```bash
cd platform
git init
git add .
git commit -m "HMG ClassDeck v1.0"
git branch -M main
git remote add origin https://github.com/<YOUR-USERNAME>/hmg-classdeck.git
git push -u origin main
```
When asked for a password, use a **Personal Access Token**
(GitHub → Settings → Developer settings → Personal access tokens → Generate new
token → tick `repo`), not your account password.

---

## Part 2 (Option A, recommended) — Deploy on **Cloudflare Pages**

Why recommended: you already use `*.pages.dev` for your brand sites, it is fast
in Nigeria/Africa, unlimited bandwidth on the free plan, and gives instant HTTPS.

1. Go to <https://dash.cloudflare.com> → log in.
2. Left sidebar: **Workers & Pages** → **Create** → **Pages** tab →
   **Connect to Git**.
3. Click **Connect GitHub**, authorize Cloudflare, pick the `hmg-classdeck` repo.
4. Configure the build:
   - **Project name:** `hmgclassdeck` → your URL becomes `https://hmgclassdeck.pages.dev`.
   - **Production branch:** `main`
   - **Framework preset:** `None`
   - **Build command:** *(leave completely empty)*
   - **Build output directory:** `/`
     - **Subfolder note:** if your repo contains the `platform` folder rather
       than its contents, set Build output directory to `platform` instead.
5. Click **Save and Deploy**. Wait ~30–60 seconds.
6. Open `https://hmgclassdeck.pages.dev` — you should see the landing page.

**Updates from now on:** just push/upload changed files to GitHub →
Cloudflare auto-redeploys in under a minute. Remember to bump `CACHE_VERSION`
in `sw.js` whenever you change code so installed apps pick up the update.

**Custom domain (optional, still free if you own a domain):**
Pages project → **Custom domains** → **Set up a custom domain** → e.g.
`class.hmgacademy.com` → follow the DNS instructions.

---

## Part 3 (Option B) — Deploy on **GitHub Pages**

1. Open your repo on GitHub → **Settings** (top tab) → **Pages** (left sidebar).
2. Under **Build and deployment**:
   - Source: **Deploy from a branch**
   - Branch: **main**, folder **/(root)** → **Save**.
   - **Subfolder note:** GitHub Pages can only serve `/root` or `/docs`. If your
     repo has a `platform/` subfolder, either move the files to the root, or
     rename the folder to `docs` and select `/docs`.
3. Wait 1–2 minutes; refresh the Pages settings page — it shows:
   `Your site is live at https://<username>.github.io/hmg-classdeck/`
4. Test the link. HTTPS is automatic.

---

## Part 4 — Other free options (alternatives)

| Host | How |
|------|-----|
| **Netlify** | <https://app.netlify.com/drop> → drag the `platform` folder into the page → done (no Git needed at all). Free subdomain + HTTPS. |
| **Vercel** | vercel.com → New Project → import the GitHub repo → Framework: Other → Deploy. |
| **Render (static site)** | render.com → New → Static Site → connect repo → publish directory `/`. |

All behave identically because ClassDeck is a pure static site (no build step,
no server code, no database).

---

## Part 5 — Install it on your itel Vista Tab 30s (PWA)

1. Open your deployed URL in **Chrome** on the tablet.
2. Chrome menu (⋮) → **Add to Home screen** → **Install**.
   (If you see an “Install app” banner or the ⬇ Install button on the landing
   page, use that instead.)
3. Launch **ClassDeck** from the home screen — it opens full-screen, standalone,
   with no browser bars. The app shell now also works offline.
4. Tell students they can do the same with the join link, but installing is
   optional for them — the link works in any browser.

---

## Part 5b — Google Meet Companion setup (v2, do this once)

1. Install ClassDeck as a PWA (Part 5).
2. Long-press the ClassDeck home-screen icon → you should see the shortcut
   **“Teach on Google Meet”**. (If shortcuts don't appear on your launcher,
   just open ClassDeck → tap the green **Teach on Google Meet** card.)
3. Dry-run before a real class:
   - ☐ Start a Meet meeting with yourself (second device or a friend).
   - ☐ In Meet: **Share screen → Share entire screen** → Start.
   - ☐ Press the recent-apps/home button, open **ClassDeck (Meet Companion)**.
   - ☐ Confirm on the second device that the whiteboard + PDF are visible.
   - ☐ Tap **🎯 Focus** — confirm toolbars disappear and the floating ☰ + mini
        capsule work; write something; flip a board page from the capsule.
   - ☐ Write for 5+ minutes and scroll the PDF — confirm Meet keeps sharing
        and never logs you out (it will: only one app is on screen now).
4. Tips for smooth Meet sharing on the itel Vista Tab 30s:
   - Close other apps before class (recent-apps → clear all except Meet + Chrome/ClassDeck).
   - Keep the tablet plugged in; screen sharing + wake-lock uses battery.
   - In Meet, turn **off** your camera while sharing if the network is weak —
     the screen share gets the bandwidth.

---

## Part 6 — First-class checklist (built-in classroom mode)

1. ☐ Open **Teacher Studio** on the tablet; confirm whiteboard writes smoothly.
2. ☐ Open a PDF in the right pane; drag the divider; tap ◫ and ⇄.
3. ☐ Tap **▶ Go Live** → **allow microphone** when Chrome asks.
4. ☐ Tap **🔗 Invite** → open the link on a second device (a phone) → join as
   “Test Student”. Confirm the student sees your full split screen and hears you.
5. ☐ Tap **📷 Cam** → confirm the student sees your face in the corner PiP.
6. ☐ On the phone: raise hand ✋, send a chat 💬, share camera 📷 → confirm they
   appear in your 👥 Students drawer.
7. ☐ Run a test **📊 poll** and a **⏱ 1-min timer**.
8. ☐ Tap **⏺ Rec** for 30 s, stop, and check the `.webm` plays.
9. ☐ Tap **⏹ End** and download the 📋 attendance CSV.

If anything fails on step 3–5, check: HTTPS URL? Camera/mic permissions
(Android Settings → Apps → Chrome → Permissions)? Both devices online?

---

## Part 7 — Updating the platform later

1. Edit the files (locally or directly on GitHub with the ✏ pencil icon).
2. **Open `sw.js` and bump the version**, e.g.
   `const CACHE_VERSION = "hmg-classdeck-v1.0.1";`
   This forces installed apps to fetch the new files.
3. Commit/push (or “Commit changes” in the GitHub editor).
4. Cloudflare/GitHub Pages redeploys automatically. Users get the update the
   next time they open/refresh the app.

---

## Part 8 — Optional hardening (still free)

- **Self-hosted signalling:** if the public PeerJS cloud is ever unreliable,
  deploy `peerjs-server` free on Render: render.com → New → Web Service →
  repo `https://github.com/peers/peerjs-server` → start command
  `peerjs --port $PORT --path /myapp`. Then in `js/rtc.js` create peers with
  `new Peer(id, { host: "your-app.onrender.com", secure: true, path: "/myapp", config: PEER_CONFIG.config })`.
- **Better TURN:** create a free account at <https://www.metered.ca/tools/openrelay/>
  for dedicated free TURN credentials and replace the `openrelay` entries in
  `PEER_CONFIG` (`js/rtc.js`).
- **Analytics (privacy-friendly, free):** Cloudflare Web Analytics — Pages
  project → Metrics → enable. No cookies, no cost.

---

*Maintained for HMG Academy / HMG Technologies. Questions → see README.md.*
