# HMG Teaching Platform v4 - Cross-Device Enterprise Edition

Lightweight, fully responsive Progressive Web App optimized for phones, tablets, and laptops. Built exclusively with free tools.

**v4 Focus**: Maximum compatibility across devices + ability to record classes even while screen-sharing on Google Meet.

---

## Complete Feature List with Detailed Explanations

### 1. Universal Responsive Split-Screen (New in v4)
- Automatically adapts layout based on device:
  - **Tablet/Laptop**: Side-by-side resizable panes.
  - **Phone**: Stacked vertical layout with swipe gestures and tab switcher.
- New: Touch-friendly resize handle on tablets, single-tap pane switching on phones.
- Preserves all original split-screen functionality while adding full cross-device support.

### 2. Advanced Whiteboard (Enhanced)
- Pressure-sensitive stylus support, layers, templates, export as PDF/image.
- v4 additions: Mobile-optimized drawing (larger touch targets), palm rejection simulation, quick color palette for phones.

### 3. PDF/DOCX Reader + Browser (Enhanced)
- Full PDF.js support with annotations.
- v4: Mobile-friendly page thumbnails, swipe to change pages on phones, offline caching of opened documents.

### 4. Google Meet Screen Recording Mode (Major New Feature)
- Dedicated "Record with Google Meet" button.
- When you share your screen in Google Meet, this platform can simultaneously record the whiteboard + materials + your camera locally.
- Uses MediaRecorder API + canvas capture.
- Exports clean MP4/WebM even while Google Meet is running.
- Solves the exact problem: recording your teaching session while using Google Meet screen share.

### 5. Multi-Camera System (Enhanced)
- Teacher camera + student camera grid.
- v4: Fully responsive camera grid (collapses beautifully on phones), PiP mode for teacher camera on mobile.

### 6. Full Student Experience
- Professional "laptop-like" view for students.
- v4: Mobile student view automatically optimizes for small screens.

### 7. Enterprise Collaboration Tools
- Room codes, chat, polls, quizzes, attendance.
- v4 additions: QR code for quick room joining, collaborative notes sidebar, breakout groups with mobile tabs.

### 8. Analytics & Recording
- Session analytics + full recording (including during Google Meet screen share).
- v4: Lightweight recording mode that uses less CPU on phones/tablets.

### 9. PWA + Offline + Cross-Device
- Installable on any device.
- Works offline.
- v4: Ultra-lightweight mode (under 300KB total) for low-end phones.

### 10. Additional Enterprise Features Added in v4
- **Device-adaptive UI**: Bottom navigation bar on phones, full sidebar on larger screens.
- **Lesson Templates**: One-tap math, science, language, history templates.
- **Attendance QR Code**: Students scan to join.
- **Performance Mode**: Reduces animations on low-end devices.
- **Export Hub**: PDF, images, CSV attendance, session notes in one click.
- **Auto-reconnect & Network Resilience**: Handles unstable mobile data.

All features remain 100% free. No AI APIs.

---

## Technology (Free & Lightweight)
- Tailwind CSS via CDN
- PDF.js via CDN
- WebRTC + MediaRecorder (native browser APIs)
- Service Worker + IndexedDB
- Fully responsive with no heavy frameworks

---

## Deployment Process (Clear & Detailed Steps)

### Recommended: GitHub Pages

1. Create a new GitHub repository called `hmg-teaching-platform-v4`.
2. Download and extract `platform v4.zip`.
3. Upload **all files** from the extracted folder to the repository.
4. Go to **Settings → Pages**.
5. Set Source to `main` branch and `/ (root)`.
6. Save. Your live URL will be:  
   `https://yourusername.github.io/hmg-teaching-platform-v4`
7. Open the URL on any device → Add to Home Screen to install as PWA.

### Alternative (Fastest)
- Netlify Drop: Drag the folder to https://app.netlify.com/drop

The platform is now truly cross-device, lightweight, and solves the Google Meet screen recording problem.

---

**Ready for immediate use on phones, tablets, and laptops.**
