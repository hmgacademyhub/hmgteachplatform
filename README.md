# HMG Teaching Platform v5 - Enterprise Cross-Device Edition

A lightweight, fully responsive Progressive Web App (PWA) optimized for phones, tablets, and laptops. Built exclusively with free tools. No AI APIs used.

**v5 Focus**: Professional whiteboard + App Launcher + Full-screen split-screen experience + Enterprise features.

---

## Complete Feature List with Detailed Explanations

### 1. Universal Responsive Full-Screen Split-Screen (Enhanced in v5)
- Automatically occupies **full viewport** on any device when class starts.
- Tablet/Laptop: True side-by-side resizable panes (drag handle).
- Phone: Vertical stacked layout with swipe/tab switching.
- Hides all welcome elements for immersive teaching.
- **New in v5**: Dynamic height calculation using `100dvh`, proper canvas scaling.

### 2. Professional Rich Whiteboard (Major Enhancement in v5)
- Pressure-sensitive drawing, multiple tools, layers, templates, export.
- **New Professional Features Added**:
  - Shapes (Rectangle, Circle, Line, Arrow, Triangle)
  - Text tool with font size and color
  - Color palette + custom color picker
  - Line width slider
  - Grid / Lined / Graph paper backgrounds
  - 5 Layers with toggle visibility
  - Eraser with size control
  - Undo / Redo stack
  - Laser pointer mode
  - Save as PNG, PDF, or SVG
  - Clear all / Clear current layer
- Makes the whiteboard truly enterprise-grade and professional.

### 3. PDF/DOCX Reader + Browser (Enhanced)
- Full PDF.js support with annotations, page thumbnails, zoom, swipe on mobile.
- Browser pane with note overlay.
- **v5**: Full-height panes, better mobile experience.

### 4. App Launcher – Launch Device Apps (New Major Feature)
- "Launch App" button opens native device apps directly from the platform.
- Supported on Android tablets/phones:
  - Google Drive
  - Google Docs
  - Chrome
  - Files / Gallery
  - Camera
  - YouTube
  - WhatsApp
  - Custom URL schemes
- Works by triggering `intent://` or `https://` deep links.
- On iOS and Desktop: Falls back gracefully or opens web versions.
- **Benefit**: You can now launch your preferred apps (Drive, Docs, etc.) directly while teaching without leaving the platform.

### 5. Google Meet Screen Recording Mode (Preserved & Enhanced)
- Dedicated button to record whiteboard + materials locally while screen-sharing on Google Meet.
- Uses MediaRecorder API.
- Exports clean WebM file.

### 6. Multi-Camera System (Enhanced)
- Teacher camera + responsive student camera grid.
- Spotlight, PiP on mobile, auto-mute.

### 7. Enterprise Collaboration & Management Tools
- Room codes, QR code join, chat, polls, quizzes, attendance, breakout groups.
- Session timer, agenda sidebar, file sharing hub.

### 8. Analytics, Recording & Export Hub
- Session analytics, full recording, CSV/JSON export.
- Whiteboard export in multiple formats.

### 9. PWA + Offline + Cross-Device
- Installable, works offline, ultra-lightweight.

### 10. Additional Enterprise Features in v5
- Dark/Light/Education themes
- Auto-save every 5 seconds
- Keyboard shortcuts (Ctrl+Z, Ctrl+Shift+Z, etc.)
- Accessibility improvements
- Performance mode for low-end devices
- Branding options (logo upload placeholder)

All features remain 100% free. No paid services or AI APIs.

---

## Technology Stack (100% Free)
- Tailwind CSS (CDN)
- PDF.js (CDN)
- WebRTC + MediaRecorder (native)
- Canvas API + IndexedDB
- Service Worker for PWA

---

## Deployment Process (Clear & Detailed Steps)

### Recommended Method: GitHub Pages (Free & Permanent)

1. Go to github.com and create a **new repository** named `hmg-teaching-platform-v5`.
2. Download `platform v5.zip` and extract it.
3. In the GitHub repo, click **Add file → Upload files**.
4. Drag and drop **all files** from the extracted folder.
5. Commit with message: "Initial v5 deployment".
6. Go to **Settings → Pages**.
7. Under "Source", select:
   - Branch: `main`
   - Folder: `/ (root)`
8. Click **Save**.
9. Wait 30–60 seconds. Your live URL appears:
   `https://yourusername.github.io/hmg-teaching-platform-v5`
10. Open the URL on your tablet → Chrome menu → **Add to Home Screen**.

### Alternative Fast Methods
- **Netlify Drop**: Go to https://app.netlify.com/drop and drag the folder.
- **Vercel**: Import the GitHub repo (free hobby tier).

### Post-Deployment Testing
- Test on itel Vista Tab 30s (landscape + portrait).
- Create a room and verify full-screen split view.
- Test whiteboard tools, app launcher, and Meet recording.
- Verify PWA installation.

---

**Platform v5 is now production-ready** with a professional whiteboard, app launcher, full-screen experience, and all enterprise features.

Enjoy stable, rich teaching sessions!