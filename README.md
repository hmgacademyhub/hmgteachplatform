# HMG ClassDeck v3 — Split-Screen Teaching Studio 🧑‍🏫

A **free, lightweight, installable (PWA) teaching platform** built for teachers who
teach from a tablet (e.g. itel Vista Tab 30s) and were being thrown out of
Google Meet every time they split-screened a whiteboard and their learning materials.

ClassDeck removes the need for split-screening two separate apps at all:

> **The whiteboard, PDF reader, browser, notes and image viewer all live INSIDE
> one app, side by side.** Share your screen on Google Meet and teach from
> here (Meet Companion mode, new in v2), or use the built-in live classroom —
> either way it looks like a laptop to your students.

No accounts. No servers to pay for. No AI APIs. 100% free-tier tools.

---

## ⭐ THE MAIN v2 WORKFLOW — teaching over Google Meet

This is the exact flow you asked for:

1. **Start your class on Google Meet** as usual (Meet free tier).
2. In Meet, tap **Share screen → Share entire screen**.
3. Open **ClassDeck → “Teach on Google Meet”** (this opens `teach.html?meet=1`,
   the **Meet Companion mode**).
4. Your whiteboard and learning materials are now **side by side in ONE app**,
   filling your screen exactly like your screenshot — and because it is a
   single app, **Android never kills the split-screen and Meet never logs you
   out**. Meet simply streams whatever is on your screen.
5. Tap **🎯 Focus mode** — every toolbar disappears; students see pure content.
   A translucent ☰ handle (top-left) and a floating mini-toolbar
   (pen / highlighter / eraser / laser / undo / page / layout) stay available.
6. Teach: write, annotate the PDF, scroll, flip pages. Meet keeps sharing; the
   screen wake-lock keeps the tablet awake.

**Why this can't crash like before:** the old crash happened because Android's
split-screen ran *two heavy apps + Meet's capture* and killed Meet to reclaim
memory. In v2 there is only **one Chrome tab** on screen. Nothing to split,
nothing for Android to kill.

> Bonus: the built-in live classroom from v1 is still fully present
> (`teach.html` without `?meet=1`). Use it when you want student-camera
> monitoring, hand-raise/mic control, polls and attendance — things Meet on a
> tablet cannot do — or as a backup if Meet misbehaves. You can even run both:
> teach over Meet while a few students join the ClassDeck room for cameras.

---

## Live pages

| Page | Who | What |
|------|-----|------|
| `index.html` | everyone | Landing page, feature list, install button |
| `teach.html?meet=1` | teacher | **Meet Companion** — workspace for Google Meet screen sharing (v2) |
| `teach.html` | teacher | The Studio: split-screen workspace + built-in live class controls |
| `teach.html?solo=1` | teacher | Same workspace without live-class chrome (prep / in-person) |
| `join.html` | students | Full-screen class view for the built-in classroom (room code / link / QR) |

---

# 🆕🆕 What's new in v3 (everything from v1 + v2 is still here)

| Feature | Detailed explanation |
|---|---|
| **🏆 Quiz engine with auto-scoring & leaderboard** | Open the 🏆 drawer, type questions in plain text (one block per question, `*` marks the correct option), set seconds-per-question, **Start quiz**. Students get a tap-to-answer card with a countdown; answers are scored automatically — 100 pts for an instant correct answer decaying to 50 pts at the time limit (speed bonus). You see a **live tally per option** (correct one highlighted green) and how many have answered; tap **Next question ➜** to advance, **End quiz** to publish the **top-10 leaderboard** to all students (gold/silver/bronze styling). Scores accumulate across quizzes in the same class; reset any time. **💾 Save bank** stores question sets on the device for reuse — write them once at home, load them in class. Late joiners automatically receive the current question. |
| **🧾 Whiteboard → PDF export** | The 🧾 button on the board toolbar renders **every page of the deck** into a single PDF using a built-in, zero-dependency PDF writer (no library, no upload, works offline). Perfect for sending "today's boards" to the class WhatsApp group after the lesson. |
| **🖼 Insert images onto the whiteboard** | The 🖼 board button stamps any photo/diagram onto the current page (auto-downscaled & JPEG-compressed so autosave stays light). Annotate around it with pen/highlighter; it undoes/redoes/exports like any stroke and is included in the live broadcast and PDF export. |
| **🔑 Class PIN (room security)** | Settings → set an optional PIN. Students must enter it on the join screen; wrong/missing PIN connections are rejected before they enter. Combine with 🔒 room-lock for the strictest setup: PIN to get in, lock once everyone has arrived. |
| **📈 Class analytics report** | 👥 drawer → **📈 Class report**: class duration, total joins, peak concurrent attendance, student chat-message count, quizzes run (with each winner), the current leaderboard and the full timestamped attendance log — previewed in-app and downloadable as a `.txt` file for your records or parents. |
| **💾 One-file backup & restore** | Settings → **Backup everything** downloads a single `.json` containing all ClassDeck data on the device (lessons, quiz banks, notes, boards, settings, branding). **Restore from file** imports it on a new/repaired tablet in seconds. Move devices without losing a single board. |
| **🎨 White-label branding** | Settings → set your **academy name** (replaces the broadcast watermark, e.g. "HMG Academy") and pick an **accent colour** — rebrand without touching code. Useful when other teachers/franchises use your deployment. |
| **🧮 Floating calculator** | Toolbar 🧮 opens a draggable calculator (÷ × − + ( ) % √ x² π). It floats above both panes — and because it is part of the app, it appears in the composite broadcast and in Meet screen shares, so students see the working. |
| **⌨ Keyboard shortcuts** | With a USB/Bluetooth keyboard: `P` pen, `H` highlighter, `E` eraser, `L` laser, `R` rectangle, `O` ellipse, `A` arrow, `T` text, `Ctrl+Z`/`Ctrl+Y` undo/redo, `PageUp`/`PageDown` board pages, `F9` toggle focus mode, `Esc` exit focus. |

---

# 🆕 What was new in v2 (still here)

| Feature | What it does |
|---|---|
| **🟢 Meet Companion mode** (`?meet=1`) | Hides all built-in live-class buttons (Meet handles the call), shows a green MEET COMPANION badge, switches wake-lock on immediately, and remembers focus mode across refreshes. Launchable from the landing page, an app-icon shortcut (long-press the installed icon), or the URL. |
| **🎯 Focus mode** | One tap hides the top bar, pane tabs and every toolbar — the workspace fills 100% of the screen (the “full display” in your screenshot). Exit via the translucent ☰ handle, `Esc`, or toggle with `F9`. |
| **🛟 Floating mini-toolbar** | In focus mode a small translucent capsule keeps pen / highlighter / eraser / laser, undo, board page ‹ › ＋ and layout-cycle within reach, without occupying screen space (it fades to 55% opacity until touched). |
| **✏ PDF annotation overlay** | Tap **✏ Annotate** in the PDF pane and draw directly on the page (red pen by default — underline, circle, solve on top of the example). Annotations are kept **per PDF page**: flip to page 7 and back, your page-3 markings are still there. 🧹 clears the current page. Annotations are also included in the v1 composite broadcast. |
| **🔴 Laser pointer** | A whiteboard tool that leaves a bright red trail which fades away in ~1.4 s and is never saved — perfect for “look HERE”. |
| **📚 Lesson manager** | Save the entire whiteboard deck (all pages) under a lesson name; reload any deck in one tap; prepare boards before class; export/import decks as `.json` files to move between devices or share with colleagues. |
| **🌑 Dark board** | New chalkboard-style background (white/colour ink on dark) alongside plain/grid/ruled. |
| **↔ Divider double-tap** | Double-tap the split divider to snap back to 50/50. |
| **📱 Mobile/system-friendly polish** | Tighter toolbars below 520 px width, slimmer chrome in low-height landscape (tablets/phones held sideways), brand label auto-hides on small screens, all controls touch-sized, wake-lock + exit-guard retained. The whole app is still ~2.7 MB and runs offline. |

---

# 📚 Full feature guide (what every feature does and how to use it)

## 1. The split-screen workspace (teacher)

### 1.1 Two panes, five apps each
Each pane (Left / Right) has tabs: **✏ Whiteboard · 📄 PDF · 🌐 Browser · 🗒 Notes · 🖼 Image**.
Tap a tab to switch what that pane shows. Your choice is remembered between sessions.
Typical setups:
- *Whiteboard + PDF* — solve questions next to the textbook.
- *Whiteboard + Browser* — derive a formula next to Desmos/GeoGebra/Wikipedia.
- *PDF + Notes* — read material while building a summary.

### 1.2 Resizable divider, layout cycling, swap
- **Drag the centre divider** to resize panes (20%–80%), with touch support.
- **◫ Layout button** cycles: Split → Left-only → Right-only → Split. Use a single
  full-width whiteboard when you need writing space, then return to split.
- **⇄ Swap button** exchanges the two panes instantly.
- **⛶ Fullscreen** hides the Android status bar for maximum teaching area.

### 1.3 Whiteboard (✏)
- **Tools:** pen, highlighter (semi-transparent), eraser, straight line, arrow,
  rectangle, ellipse, text stamps, and the new **🔴 laser pointer** (v2).
- **6 colours + stroke-size slider.**
- **Smooth ink:** strokes use coalesced pointer events + quadratic smoothing, so
  handwriting looks natural even on budget tablets.
- **Multi-page:** ‹ › navigate, ＋ adds a page, ✕ deletes. The page counter floats
  at the bottom.
- **Paper styles:** plain, grid, ruled, or **dark chalkboard** (v2) background.
- **Undo / Redo / Clear page.**
- **Autosave:** every stroke is saved to the device (localStorage). Close the
  app, reopen tomorrow — your boards are still there.
- **⬇ Export:** save the current page as a PNG (share to WhatsApp/Telegram after class).
- Strokes are stored as *vectors* (relative coordinates), so resizing the pane
  or rotating the tablet never blurs or crops your writing.

### 1.4 PDF reader (📄)
- Powered by Mozilla **PDF.js** (bundled locally — works offline).
- **Open PDF** button or drag-and-drop. The file is read locally; *nothing is uploaded anywhere.*
- Page ‹ ›, jump-to-page box, zoom −/＋, and **Fit** (fit-to-width).
- **✏ Annotate (v2):** draw straight onto the PDF page; markings are stored per
  page and survive page flips. 🧹 clears the current page's markings.
- The rendered page (plus annotations) is included in the live broadcast automatically.

### 1.5 Browser (🌐)
- An embedded browser pane with URL bar, reload, back, and quick links
  (Wikipedia, OpenStreetMap, Desmos, GeoGebra, Archive.org — all embed-friendly).
- **Honest limitation (browser security, not a bug):** sites like Google and
  YouTube refuse to load inside iframes, and browsers forbid *capturing* iframe
  pixels into the broadcast. So in the default **Composite broadcast mode**
  students see a placeholder card for this pane. Three workarounds:
  1. Use the **embed-friendly quick links** (Desmos/GeoGebra render fine for you locally).
  2. Switch Settings → Broadcast mode → **Share screen** (on devices/browsers
     that support `getDisplayMedia`) — then students see *everything*, browser included.
  3. Save the web page as PDF/screenshot and open it in the PDF/Image pane (fully broadcastable).

### 1.6 Notes (🗒)
- A big legal-pad style text area. Auto-saves on the device as you type.
- Its text **is rendered into the broadcast** (with word-wrap), so you can type
  live notes that students see.
- Export as `.txt` with one tap.

### 1.7 Image viewer (🖼)
- Open or drop any image (diagrams, past-question photos, charts).
- Scales to fit and is included in the broadcast.

---

## 2. The live classroom

### 2.1 How it works (free architecture)
- Built on **WebRTC** via **PeerJS** with the free public PeerJS cloud broker
  for signalling, Google **STUN** and the free **OpenRelay TURN** servers for
  NAT traversal. Audio/video flows **peer-to-peer, DTLS-encrypted** — there is
  no media server and no bill.
- The teacher is the hub (star topology). Recommended class size on a tablet
  over mobile data: **up to ~10–15 students** receiving the stage stream
  (each student costs upload bandwidth). On Wi-Fi with a decent connection,
  20+ is feasible at the default 720p/8fps.

### 2.2 Go Live + invite
1. Tap **▶ Go Live**. Allow the microphone when asked (so students hear you).
2. Tap **🔗 Invite**. Share the link (one tap copies it) or let students scan
   the **QR code**. The room code (e.g. `K7M2QX`) is stable across sessions
   unless you ask for a new one in Settings.
3. Students open the link on **any** phone/tablet/laptop browser — no install,
   no account — type their name, and they're in.

### 2.3 The broadcast ("full display / laptop look")
- **Composite mode (default, perfect for tablets):** the app continuously paints
  *both panes* onto an internal 1280×720 canvas — pane titles, split divider,
  whiteboard ink, PDF page, notes text, images, plus a small clock watermark —
  and streams that canvas. Students' screens show one clean 16:9 video that
  fills their display (`join.html` even auto-requests fullscreen), exactly like
  a laptop share. Because this is canvas-based, **Android split-screen, app
  switching or memory pressure can never kill it** — there is no second app.
- **Share-screen mode (Settings):** uses `getDisplayMedia` where supported
  (laptops, some Android Chrome versions) to stream the real screen including
  the browser pane.
- **Quality presets:** 720p@8fps (default, great on 3G/4G), 720p@15fps,
  1080p@10fps. Lower fps = much lower data usage; handwriting still looks live.

### 2.4 Teacher camera (students see you) 📷
- Tap **📷 Cam**: your front camera streams to all students and appears for them
  as a **movable picture-in-picture** window over the stage (they can drag it).
  Tap again to turn it off any time. A mirrored self-view shows in your corner.

### 2.5 Student camera monitoring (the Meet-on-tablet fix) 👥
- Open the **👥 Students drawer**:
  - **Roster** with live join/leave and ✋ hand-raised indicators.
  - Per-student buttons: **📷 ask camera on/off**, **🎙 grant/revoke mic**, **✕ remove**.
  - **📷 Ask all cams** requests every student's camera at once.
  - Incoming student cameras appear in the **camera grid**; tap a tile to
    enlarge it. Student cams stream at 480p/12fps to stay light.
- Students are always asked to consent before their camera turns on.

### 2.6 Hand raise & speaking control ✋🎙
- Students tap ✋; you get a toast and the roster shows it.
- Mics are **off by default for students**. You grant the mic per-student
  (🎙 in the roster); their audio then plays on your device and they can ask
  their question. Revoke with the same button. No more talking over each other.

### 2.7 Class chat & announcements 💬📢
- Two-way chat drawer (teacher ↔ all students). Messages are HTML-escaped (safe).
- **📢 Announcement** pushes a full-screen modal onto every student device —
  impossible to miss ("Submit exercise 3 now").

### 2.8 Instant polls 📊
- Open **📊**, type a question + options (2–6), **Start poll**.
- Students get a tap-to-answer modal; you watch **live result bars**; ending the
  poll publishes the percentages to students. One vote per student enforced.

### 2.9 Attendance register 📋
- Every join and leave is logged with a timestamp.
- **📋 Attendance CSV** downloads the register (opens in Excel/Sheets) — useful
  for records, parents, or paid-class verification.

### 2.10 Lesson recording ⏺
- **⏺ Rec** records the broadcast (video + your mic) locally with MediaRecorder
  at ~0.9 Mbps. Stop to save a `.webm` to your downloads. Share it on
  WhatsApp/Telegram or upload to YouTube later. No cloud cost.

### 2.11 Security / order controls 🔒
- **Lock room:** once everyone has arrived, lock it; new connections are rejected.
- **Remove student:** kicks a participant immediately.
- **Random room codes** (unambiguous alphabet, no 0/O/1/I), regenerate any time.
- WebRTC media is end-to-end DTLS-SRTP encrypted between you and each student.

### 2.12 Timers & clock ⏱
- The top-bar chip shows elapsed class time once live.
- **⏱ Countdown timer** (1/2/5/10 min or custom) for exercises; students are
  notified when it starts and when time is up.

### 2.13 Resilience (the anti-logout features)
- **Screen Wake Lock** keeps the tablet awake during class (toggle in Settings).
- **Auto-reconnect:** if the signalling connection drops (network blip), the
  teacher side silently reconnects; students retry joining up to 4 times with
  backoff and resume the stream.
- **Exit guard:** the browser warns you before accidentally closing the tab
  while students are connected.
- **Late joiners** automatically receive the current stage + teacher cam + any
  running poll the moment they connect.

---

## 3. Platform / "enterprise-grade on free tools" features

- **Installable PWA:** manifest + service worker → "Add to Home screen" on
  Android, runs full-screen standalone like a native app, with app shortcuts
  ("Start a class", "Join a class", "Solo workspace").
- **Offline-first shell:** all code, the PDF engine, and icons are cached;
  whiteboard/PDF/notes work with zero internet (live class obviously needs it).
- **No build step:** plain HTML/CSS/JS. Edit any file, refresh, done. Easy for
  HMG Technologies to maintain and brand.
- **Self-contained vendor libs:** PeerJS, PDF.js (+worker) and QRCode.js are
  bundled in `/vendor` — no CDN dependency at class time.
- **Privacy by design:** PDFs, images, notes, whiteboards and recordings never
  leave the device; only live WebRTC streams go out, peer-to-peer.
- **State persistence:** whiteboard pages, notes, pane layout, split position,
  settings and room code all survive restarts (localStorage).
- **Branding-ready:** colours in `css/style.css` `:root` variables; icons in
  `/assets`; footer links to the whole HMG family of sites.

---

## 4. Repository layout

```
platform/
├── index.html              Landing page
├── teach.html              Teacher Studio
├── join.html               Student view
├── manifest.webmanifest    PWA manifest (name, icons, shortcuts)
├── sw.js                   Service worker (offline cache)
├── css/style.css           All styling (CSS variables for branding)
├── js/
│   ├── common.js           Toasts, modals, storage, wake-lock, PWA install
│   ├── whiteboard.js       Vector whiteboard engine
│   ├── rtc.js              TeacherRoom / StudentRoom (PeerJS WebRTC)
│   ├── teach.js            Studio controller + composite broadcaster
│   └── join.js             Student controller
├── vendor/                 peerjs / pdf.js / pdf worker / qrcode (bundled)
├── assets/                 App icons (96/192/512/apple-touch)
└── docs/
    ├── DEPLOYMENT.md       Step-by-step deployment (GitHub & Cloudflare Pages)
    └── USER_GUIDE.md       Printable quick guide for you and your students
```

---

## 5. Deployment (summary — full detail in `docs/DEPLOYMENT.md`)

> ⚠ **HTTPS is mandatory** — camera, microphone, wake-lock and service workers
> only work on `https://` (or `localhost`). Both options below give free HTTPS.

### Option A — Cloudflare Pages (recommended; matches your `*.pages.dev` brand)
1. Push this folder to a GitHub repository (steps below).
2. Cloudflare dashboard → **Workers & Pages → Create → Pages → Connect to Git**.
3. Select the repo. Framework preset: **None**. Build command: *(empty)*.
   Build output directory: **`/`** (or `platform` if the repo root contains the folder).
4. **Save and Deploy** → you get `https://hmgclassdeck.pages.dev`.

### Option B — GitHub Pages
1. Push to GitHub → repo **Settings → Pages** → Source: `main` branch, `/ (root)`.
2. Wait ~1 minute → `https://<username>.github.io/<repo>/`.

### Pushing to GitHub (first time)
```bash
cd platform
git init
git add .
git commit -m "HMG ClassDeck v1.0"
git branch -M main
git remote add origin https://github.com/<your-username>/hmg-classdeck.git
git push -u origin main
```

### Updating later
Edit files → bump `CACHE_VERSION` in `sw.js` → commit & push → hosting redeploys
automatically; users get the update on next refresh.

---

## 6. Quick classroom workflows (cheat sheets)

### A) Teaching over Google Meet (your main flow)
1. Install ClassDeck on your tablet (browser menu → *Add to Home screen*).
2. Prepare: long-press the ClassDeck icon → **Teach on Google Meet** (or open it
   and tap the green card) → load your PDF in the right pane, optionally open a
   saved lesson deck (📚).
3. Start your **Google Meet** class as normal → **Share screen → entire screen**.
4. Switch to ClassDeck (recent-apps button). Meet keeps sharing in the background.
5. Tap **🎯 Focus** — toolbars vanish, students see the clean split workspace.
6. Teach. Use the floating capsule for pen/eraser/laser/pages; ☰ brings the full
   toolbars back whenever needed.
7. When done, return to Meet and stop sharing/end the call.

### B) Built-in live classroom (no Meet)
1. Open **Teacher Studio** → left pane Whiteboard, right pane PDF → open your material.
2. **▶ Go Live** → allow mic → **🔗 Invite** → send link to your class WhatsApp group.
3. Optional: **📷 Cam** so students see you; **⏺ Rec** to record.
4. Teach: write, scroll the PDF, drag the divider — students see everything live.
5. Use 👥 to monitor cameras, ✋/🎙 to let students speak, 📊 for checks, ⏱ for exercises.
6. **⏹ End** → download 📋 attendance → recording is already in your downloads.

---

## 7. Known limitations (and the honest reasons)

- **Browser pane isn't in the composite broadcast** — web security forbids
  reading iframe pixels. Use Share-screen mode or PDF/Image instead.
- **Class size** is bounded by *your* upload bandwidth (star topology).
  Lower the quality preset for big classes on mobile data.
- **Free PeerJS cloud** brokers connections on a best-effort basis. If it is
  ever down, you can self-host `peerjs-server` free on Render/Railway and
  change `PEER_CONFIG` in `js/rtc.js` (documented inside the file).
- iOS Safari students must tap the “Start class view” button once (autoplay policy) — the app shows it automatically.

---

Built with ❤ for **HMG Academy** · [cssadewale.pages.dev](https://cssadewale.pages.dev) ·
[hmgconcepts.pages.dev](https://hmgconcepts.pages.dev) · [hmgacademy.pages.dev](https://hmgacademy.pages.dev) ·
[hmgtechnologies.pages.dev](https://hmgtechnologies.pages.dev) · [hmgmedia.pages.dev](https://hmgmedia.pages.dev) ·
[hmggospel.pages.dev](https://hmggospel.pages.dev)

License: MIT (see `LICENSE`).
