/* ============================================================
   HMG ClassDeck — Teacher Studio controller
   • Dual-pane app loader (whiteboard / pdf / web / notes / image)
   • Resizable split, layout cycling, pane swap
   • Composite broadcaster: draws both panes onto one canvas and
     streams it (canvas.captureStream) to every student — students
     always see the FULL split-screen, like a laptop share.
   • Live classroom: roster, student cams, chat, polls, attendance,
     announcements, lock, kick, recording, timer.
   ============================================================ */
"use strict";

/* ------------------------------------------------------------
   0. PDF.js worker
   ------------------------------------------------------------ */
if (window.pdfjsLib) {
  pdfjsLib.GlobalWorkerOptions.workerSrc = "vendor/pdf.worker.min.js";
}

/* ------------------------------------------------------------
   1. Pane / app management
   ------------------------------------------------------------ */
const APPS = ["board", "pdf", "web", "notes", "image"];
const paneState = {
  L: { app: Store.get("pane_L", "board"), instances: {} },
  R: { app: Store.get("pane_R", "pdf"),   instances: {} }
};
let layoutMode = Store.get("layout", "split"); // split | left | right

const bodyEls = { L: $("#bodyL"), R: $("#bodyR") };

function mountApp(side, app) {
  const st = paneState[side];
  st.app = app;
  Store.set("pane_" + side, app);

  // hide all existing app sections in this pane
  $$("#body" + side + " > section").forEach((s) => s.classList.remove("active"));

  let inst = st.instances[app];
  if (!inst) {
    const tpl = $("#tpl-" + app);
    const node = tpl.content.firstElementChild.cloneNode(true);
    bodyEls[side].appendChild(node);
    inst = { el: node };
    st.instances[app] = inst;
    initApp(side, app, inst);
  }
  inst.el.classList.add("active");

  // tab highlight
  $$('.pane-head[data-pane="' + side + '"] .tab').forEach((t) =>
    t.classList.toggle("active", t.dataset.app === app));

  if (app === "board" && inst.wb) setTimeout(() => inst.wb.resize(), 60);
  if (app === "pdf" && inst.renderPage) setTimeout(() => inst.renderPage(), 60);
}

$$(".pane-head .tab").forEach((tab) => {
  tab.addEventListener("click", () => {
    const side = tab.closest(".pane-head").dataset.pane;
    mountApp(side, tab.dataset.app);
  });
});

/* ------------------------------------------------------------
   2. App initialisers
   ------------------------------------------------------------ */
function initApp(side, app, inst) {
  if (app === "board") initBoard(side, inst);
  else if (app === "pdf") initPdf(side, inst);
  else if (app === "web") initWeb(side, inst);
  else if (app === "notes") initNotes(side, inst);
  else if (app === "image") initImage(side, inst);
}

/* ---- whiteboard ---- */
function initBoard(side, inst) {
  const el = inst.el;
  const stage = $(".wb-stage", el);
  const wb = new Whiteboard(stage, { onChange: updatePageInfo });
  inst.wb = wb;

  function updatePageInfo() {
    $(".wb-pageinfo", el).textContent = (wb.pageIndex + 1) + " / " + wb.pages.length;
  }
  updatePageInfo();

  $$(".tool[data-tool]", el).forEach((b) => b.addEventListener("click", () => {
    $$(".tool[data-tool]", el).forEach((x) => x.classList.remove("active"));
    b.classList.add("active");
    wb.setTool(b.dataset.tool);
  }));
  $$(".wb-color", el).forEach((c) => c.addEventListener("click", () => {
    $$(".wb-color", el).forEach((x) => x.classList.remove("active"));
    c.classList.add("active");
    wb.setColor(c.dataset.c);
  }));
  $(".wb-size", el).addEventListener("input", (e) => wb.setSize(Number(e.target.value)));
  $(".wb-undo", el).addEventListener("click", () => wb.undo());
  $(".wb-redo", el).addEventListener("click", () => wb.redo());
  $(".wb-clear", el).addEventListener("click", () => { if (confirm("Clear this page?")) wb.clearPage(); });
  $(".wb-bg", el).value = wb.bgStyle;
  $(".wb-bg", el).addEventListener("change", (e) => wb.setBackground(e.target.value));
  $(".wb-export", el).addEventListener("click", () => wb.exportPNG());
  $(".wb-prev", el).addEventListener("click", () => { wb.gotoPage(wb.pageIndex - 1); updatePageInfo(); });
  $(".wb-next", el).addEventListener("click", () => { wb.gotoPage(wb.pageIndex + 1); updatePageInfo(); });
  $(".wb-add",  el).addEventListener("click", () => { wb.addPage(); updatePageInfo(); });
  $(".wb-del",  el).addEventListener("click", () => { if (confirm("Delete this page?")) { wb.deletePage(); updatePageInfo(); } });
}

/* ---- PDF reader (v2: + annotation overlay) ---- */
function initPdf(side, inst) {
  const el = inst.el;
  const canvas = $(".pdf-canvas", el);
  const annotStage = $(".pdf-annot-stage", el);
  let annotWb = null, annotOn = false;
  const annotPages = {};   // pdf page number -> saved stroke pages
  const ctx = canvas.getContext("2d");
  const info = $(".pdf-info", el);
  const zoomLbl = $(".pdf-zoom", el);
  let doc = null, pageNum = 1, scale = 1, fitMode = true, rendering = false, pending = null;

  inst.getCanvas = () => (doc ? canvas : null);

  async function renderPage() {
    if (!doc) return;
    if (rendering) { pending = pageNum; return; }
    rendering = true;
    try {
      const page = await doc.getPage(pageNum);
      let s = scale;
      if (fitMode) {
        const avail = $(".pdf-scroll", el).clientWidth - 28;
        const v1 = page.getViewport({ scale: 1 });
        s = Math.max(0.3, avail / v1.width);
        scale = s;
      }
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const vp = page.getViewport({ scale: s * dpr });
      canvas.width = vp.width; canvas.height = vp.height;
      canvas.style.width = (vp.width / dpr) + "px";
      canvas.style.height = (vp.height / dpr) + "px";
      await page.render({ canvasContext: ctx, viewport: vp }).promise;
      info.textContent = pageNum + " / " + doc.numPages;
      zoomLbl.textContent = Math.round(s * 100) + "%";
      syncAnnotStage();
    } catch (e) { console.warn(e); }
    rendering = false;
    if (pending !== null) { pending = null; renderPage(); }
  }
  inst.renderPage = renderPage;

  async function loadFile(file) {
    try {
      const buf = await file.arrayBuffer();
      doc = await pdfjsLib.getDocument({ data: buf }).promise;
      pageNum = 1; fitMode = true;
      $(".pdf-hint", el).classList.add("hide");
      renderPage();
      toast("Opened: " + file.name, "ok");
    } catch (e) { toast("Could not open PDF: " + e.message, "err"); }
  }

  $(".pdf-open", el).addEventListener("click", () => $(".pdf-file", el).click());
  $(".pdf-file", el).addEventListener("change", (e) => { if (e.target.files[0]) loadFile(e.target.files[0]); });
  el.addEventListener("dragover", (e) => e.preventDefault());
  el.addEventListener("drop", (e) => {
    e.preventDefault();
    const f = e.dataTransfer.files[0];
    if (f && f.type === "application/pdf") loadFile(f);
  });
  $(".pdf-prev", el).addEventListener("click", () => { if (doc && pageNum > 1) { pageNum--; renderPage(); } });
  $(".pdf-next", el).addEventListener("click", () => { if (doc && pageNum < doc.numPages) { pageNum++; renderPage(); } });
  $(".pdf-zoomin", el).addEventListener("click", () => { fitMode = false; scale = Math.min(4, scale * 1.2); renderPage(); });
  $(".pdf-zoomout", el).addEventListener("click", () => { fitMode = false; scale = Math.max(0.3, scale / 1.2); renderPage(); });
  $(".pdf-fit", el).addEventListener("click", () => { fitMode = true; renderPage(); });
  $(".pdf-goto", el).addEventListener("change", (e) => {
    const n = Number(e.target.value);
    if (doc && n >= 1 && n <= doc.numPages) { pageNum = n; renderPage(); }
  });

  /* ----- v2: annotate on top of the PDF page ----- */
  function syncAnnotStage() {
    annotStage.style.width = canvas.style.width;
    annotStage.style.height = canvas.style.height;
    if (annotWb) {
      // swap strokes per PDF page so notes stick to the right page
      const want = annotPages[pageNum] || [{ strokes: [] }];
      if (annotWb._boundPdfPage !== pageNum) {
        annotWb.pages = want;
        annotPages[pageNum] = annotWb.pages;
        annotWb.pageIndex = 0;
        annotWb._boundPdfPage = pageNum;
      }
      annotWb.resize();
    }
  }
  inst.getAnnotCanvas = () => (annotOn && annotWb ? annotWb.canvas : null);

  $(".pdf-annot", el).addEventListener("click", (e) => {
    if (!doc) { toast("Open a PDF first"); return; }
    annotOn = !annotOn;
    e.currentTarget.classList.toggle("active", annotOn);
    $(".pdf-annot-clear", el).classList.toggle("hide", !annotOn);
    annotStage.classList.toggle("armed", annotOn);
    if (annotOn && !annotWb) {
      annotWb = new Whiteboard(annotStage, { transparent: true, persist: false, color: "#e02b2b", size: 3 });
      annotWb._boundPdfPage = pageNum;
      annotPages[pageNum] = annotWb.pages;
    }
    if (annotOn) { syncAnnotStage(); toast("✏ Annotating the PDF — drawings stay on this page. Tap again to scroll/zoom.", "ok", 4500); }
    else toast("Annotation off — you can scroll/zoom again");
  });
  $(".pdf-annot-clear", el).addEventListener("click", () => {
    if (annotWb) { annotWb.clearPage(); toast("Annotations cleared on this page"); }
  });
}

/* ---- embedded browser ---- */
function initWeb(side, inst) {
  const el = inst.el;
  const frame = $(".web-frame", el);
  const urlIn = $(".web-url", el);
  function nav(u) {
    if (!u) return;
    if (!/^https?:\/\//i.test(u)) u = "https://" + u;
    urlIn.value = u;
    frame.src = u;
  }
  $(".web-go", el).addEventListener("click", () => nav(urlIn.value.trim()));
  urlIn.addEventListener("keydown", (e) => { if (e.key === "Enter") nav(urlIn.value.trim()); });
  $(".web-back", el).addEventListener("click", () => { try { frame.contentWindow.history.back(); } catch { toast("Can't go back on cross-site pages"); } });
  $(".web-reload", el).addEventListener("click", () => { frame.src = frame.src; });
  $(".web-pop", el).addEventListener("click", () => { if (urlIn.value) window.open(/^https?:/i.test(urlIn.value) ? urlIn.value : "https://" + urlIn.value, "_blank"); });
  $$(".web-quick", el).forEach((b) => b.addEventListener("click", () => nav(b.dataset.u)));
}

/* ---- notes ---- */
function initNotes(side, inst) {
  const el = inst.el;
  const area = $(".notes-area", el);
  area.value = Store.get("notes", "");
  let t = null;
  area.addEventListener("input", () => {
    clearTimeout(t);
    t = setTimeout(() => Store.set("notes", area.value), 600);
  });
  $(".notes-save", el).addEventListener("click", () =>
    downloadBlob(new Blob([area.value], { type: "text/plain" }), "lesson-notes-" + Date.now() + ".txt"));
  $(".notes-clear", el).addEventListener("click", () => { if (confirm("Clear notes?")) { area.value = ""; Store.set("notes", ""); } });
  inst.getText = () => area.value;
}

/* ---- image viewer ---- */
function initImage(side, inst) {
  const el = inst.el;
  const img = $(".img-view", el);
  inst.imgEl = img;
  function load(f) {
    img.src = URL.createObjectURL(f);
    img.onload = () => $(".img-hint", el).classList.add("hide");
  }
  $(".img-open", el).addEventListener("click", () => $(".img-file", el).click());
  $(".img-file", el).addEventListener("change", (e) => { if (e.target.files[0]) load(e.target.files[0]); });
  el.addEventListener("dragover", (e) => e.preventDefault());
  el.addEventListener("drop", (e) => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f && f.type.startsWith("image/")) load(f); });
}

/* ------------------------------------------------------------
   3. Split divider + layout controls
   ------------------------------------------------------------ */
const workspace = $("#workspace");
const divider = $("#divider");
let splitRatio = Store.get("split", 0.5);

function applySplit() {
  $("#paneLeft").style.flex = `1 1 ${splitRatio * 100}%`;
  $("#paneRight").style.flex = `1 1 ${(1 - splitRatio) * 100}%`;
}
applySplit();

let dragging = false;
divider.addEventListener("pointerdown", (e) => { dragging = true; divider.setPointerCapture(e.pointerId); });
divider.addEventListener("pointermove", (e) => {
  if (!dragging) return;
  const r = workspace.getBoundingClientRect();
  splitRatio = Math.min(0.8, Math.max(0.2, (e.clientX - r.left) / r.width));
  applySplit();
});
divider.addEventListener("pointerup", () => { dragging = false; Store.set("split", splitRatio); resizeBoards(); });

function resizeBoards() {
  for (const side of ["L", "R"]) {
    const inst = paneState[side].instances.board;
    if (inst && inst.wb) inst.wb.resize();
    const pinst = paneState[side].instances.pdf;
    if (pinst && pinst.renderPage) pinst.renderPage();
  }
}

function applyLayout() {
  workspace.classList.toggle("right-hidden", layoutMode === "left");
  workspace.classList.toggle("left-hidden",  layoutMode === "right");
  Store.set("layout", layoutMode);
  setTimeout(resizeBoards, 80);
}
applyLayout();

$("#btnLayout").addEventListener("click", () => {
  layoutMode = layoutMode === "split" ? "left" : layoutMode === "left" ? "right" : "split";
  toast("Layout: " + (layoutMode === "split" ? "Split view" : layoutMode === "left" ? "Left pane only" : "Right pane only"));
  applyLayout();
});

$("#btnSwap").addEventListener("click", () => {
  const a = paneState.L.app, b = paneState.R.app;
  // move DOM nodes between bodies
  const swap = (from, to) => { while (from.firstChild) to.appendChild(from.firstChild); };
  const tmp = document.createDocumentFragment();
  swap(bodyEls.L, { appendChild: (n) => tmp.appendChild(n) });
  swap(bodyEls.R, bodyEls.L);
  while (tmp.firstChild) bodyEls.R.appendChild(tmp.firstChild);
  const ti = paneState.L.instances; paneState.L.instances = paneState.R.instances; paneState.R.instances = ti;
  paneState.L.app = b; paneState.R.app = a;
  mountApp("L", b); mountApp("R", a);
  setTimeout(resizeBoards, 80);
});

$("#btnFull").addEventListener("click", toggleFullscreen);

/* mount initial apps */
mountApp("L", paneState.L.app);
mountApp("R", paneState.R.app);

/* ------------------------------------------------------------
   4. Composite broadcaster
   Draws BOTH panes (whiteboard canvases, pdf canvas, notes,
   image) onto one 16:9 canvas, then captureStream()s it.
   Students therefore receive the full split-screen — exactly
   what the teacher sees — regardless of tablet quirks.
   ------------------------------------------------------------ */
const COMP = { canvas: document.createElement("canvas"), ctx: null, raf: null, fps: 8, w: 1280, h: 720 };
COMP.ctx = COMP.canvas.getContext("2d");

function setQuality(qstr) {
  const [w, h, f] = qstr.split("x").map(Number);
  COMP.w = w; COMP.h = h; COMP.fps = f;
  COMP.canvas.width = w; COMP.canvas.height = h;
}
setQuality(Store.get("quality", "1280x720x8"));

let lastComposite = 0;
function compositeLoop(ts) {
  COMP.raf = requestAnimationFrame(compositeLoop);
  if (ts - lastComposite < 1000 / COMP.fps) return;
  lastComposite = ts;
  drawComposite();
}

function drawComposite() {
  const ctx = COMP.ctx, W = COMP.w, H = COMP.h;
  ctx.fillStyle = "#10142b";
  ctx.fillRect(0, 0, W, H);

  const showL = layoutMode !== "right";
  const showR = layoutMode !== "left";
  const headH = 34;

  if (showL && showR) {
    const lw = Math.round(W * splitRatio);
    drawPaneInto(ctx, "L", 0, 0, lw - 2, H, headH);
    ctx.fillStyle = "#2e3768"; ctx.fillRect(lw - 2, 0, 4, H);
    drawPaneInto(ctx, "R", lw + 2, 0, W - lw - 2, H, headH);
  } else if (showL) {
    drawPaneInto(ctx, "L", 0, 0, W, H, headH);
  } else {
    drawPaneInto(ctx, "R", 0, 0, W, H, headH);
  }

  // LIVE watermark + clock
  ctx.fillStyle = "rgba(16,20,43,.78)";
  ctx.fillRect(W - 200, H - 30, 200, 30);
  ctx.fillStyle = "#9aa3cf";
  ctx.font = "13px system-ui, sans-serif";
  ctx.textBaseline = "middle";
  ctx.fillText("HMG ClassDeck • " + new Date().toLocaleTimeString(), W - 192, H - 15);
}

function drawPaneInto(ctx, side, x, y, w, h, headH) {
  const st = paneState[side];
  // header strip with app name
  ctx.fillStyle = "#181d3a";
  ctx.fillRect(x, y, w, headH);
  ctx.fillStyle = "#eef1ff";
  ctx.font = "bold 15px system-ui, sans-serif";
  ctx.textBaseline = "middle";
  const titles = { board: "✏ Whiteboard", pdf: "📄 Learning material", web: "🌐 Web resource", notes: "🗒 Notes", image: "🖼 Image" };
  ctx.fillText(titles[st.app] || st.app, x + 12, y + headH / 2);

  const cx = x, cy = y + headH, cw = w, ch = h - headH;
  ctx.save();
  ctx.beginPath(); ctx.rect(cx, cy, cw, ch); ctx.clip();
  ctx.fillStyle = "#ffffff"; ctx.fillRect(cx, cy, cw, ch);

  const inst = st.instances[st.app];
  try {
    if (st.app === "board" && inst && inst.wb) {
      ctx.drawImage(inst.wb.canvas, cx, cy, cw, ch);
    } else if (st.app === "pdf" && inst) {
      const c = inst.getCanvas && inst.getCanvas();
      if (c && c.width) {
        const s = Math.min(cw / c.width, ch / c.height);
        const dw = c.width * s, dh = c.height * s;
        const dx = cx + (cw - dw) / 2, dy = cy + (ch - dh) / 2;
        ctx.fillStyle = "#383d52"; ctx.fillRect(cx, cy, cw, ch);
        ctx.drawImage(c, dx, dy, dw, dh);
        const ac = inst.getAnnotCanvas && inst.getAnnotCanvas();   // v2: annotations over PDF
        if (ac && ac.width) ctx.drawImage(ac, dx, dy, dw, dh);
      } else drawPlaceholder(ctx, cx, cy, cw, ch, "No PDF open yet");
    } else if (st.app === "notes" && inst) {
      ctx.fillStyle = "#fffbe8"; ctx.fillRect(cx, cy, cw, ch);
      ctx.fillStyle = "#222";
      ctx.font = Math.max(15, Math.round(cw / 42)) + "px system-ui, sans-serif";
      ctx.textBaseline = "top";
      wrapText(ctx, (inst.getText && inst.getText()) || "", cx + 18, cy + 16, cw - 36, Math.max(20, Math.round(cw / 30)));
    } else if (st.app === "image" && inst && inst.imgEl && inst.imgEl.naturalWidth) {
      const im = inst.imgEl;
      const s = Math.min(cw / im.naturalWidth, ch / im.naturalHeight);
      const dw = im.naturalWidth * s, dh = im.naturalHeight * s;
      ctx.fillStyle = "#383d52"; ctx.fillRect(cx, cy, cw, ch);
      ctx.drawImage(im, cx + (cw - dw) / 2, cy + (ch - dh) / 2, dw, dh);
    } else if (st.app === "web") {
      drawPlaceholder(ctx, cx, cy, cw, ch,
        "🌐 Web resource open on teacher's screen", "Browsers block iframe capture for privacy.", "Tip: use 'Share screen' broadcast mode, or show the page via PDF/Image.");
    } else {
      drawPlaceholder(ctx, cx, cy, cw, ch, "Nothing to show yet");
    }
  } catch (e) { /* canvas tainting etc — never crash the loop */ }
  ctx.restore();
}

function drawPlaceholder(ctx, x, y, w, h, l1, l2, l3) {
  ctx.fillStyle = "#222952"; ctx.fillRect(x, y, w, h);
  ctx.fillStyle = "#9aa3cf"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.font = "bold " + Math.max(14, Math.round(w / 34)) + "px system-ui, sans-serif";
  ctx.fillText(l1, x + w / 2, y + h / 2 - (l2 ? 24 : 0));
  if (l2) { ctx.font = Math.max(12, Math.round(w / 46)) + "px system-ui"; ctx.fillText(l2, x + w / 2, y + h / 2 + 4); }
  if (l3) { ctx.font = Math.max(12, Math.round(w / 46)) + "px system-ui"; ctx.fillText(l3, x + w / 2, y + h / 2 + 28); }
  ctx.textAlign = "left";
}

function wrapText(ctx, text, x, y, maxW, lineH) {
  const lines = text.split("\n");
  let yy = y;
  for (const line of lines) {
    let cur = "";
    for (const word of line.split(" ")) {
      const test = cur ? cur + " " + word : word;
      if (ctx.measureText(test).width > maxW && cur) { ctx.fillText(cur, x, yy); yy += lineH; cur = word; }
      else cur = test;
    }
    ctx.fillText(cur, x, yy); yy += lineH;
    if (yy > y + 5000) break;
  }
}

/* ------------------------------------------------------------
   5. Live class
   ------------------------------------------------------------ */
let room = null;
let micStream = null, camStream = null;
let micOn = false, camOn = false;
let stageStream = null;
let classStartTs = 0, classTickInt = null;

const roomCode = (() => {
  let c = Store.get("roomcode", null);
  if (!c || Store.get("newroom", false)) { c = randomCode(); Store.set("roomcode", c); Store.set("newroom", false); }
  return c;
})();
$("#roomCodeLbl").textContent = roomCode;

function studentLink() {
  const base = location.href.replace(/teach\.html.*$/, "join.html");
  return base + "?room=" + roomCode;
}

/* invite modal */
$("#btnQR").addEventListener("click", () => {
  $("#inviteLink").value = studentLink();
  $("#inviteCode").textContent = roomCode;
  const box = $("#qrBox"); box.innerHTML = "";
  try { new QRCode(box, { text: studentLink(), width: 190, height: 190 }); } catch {}
  openModal("#mInvite");
});
$("#copyLink").addEventListener("click", async () => {
  try { await navigator.clipboard.writeText($("#inviteLink").value); toast("Link copied!", "ok"); }
  catch { $("#inviteLink").select(); document.execCommand("copy"); toast("Link copied!", "ok"); }
});
$("#roomInfo").addEventListener("click", async () => {
  try { await navigator.clipboard.writeText(studentLink()); toast("Student link copied!", "ok"); } catch {}
});

/* ---- go live / end ---- */
$("#btnGoLive").addEventListener("click", goLive);
$("#btnEndLive").addEventListener("click", endLive);

async function goLive() {
  $("#btnGoLive").disabled = true;
  toast("Starting class…");
  try {
    room = new TeacherRoom(roomCode, { onEvent: onRoomEvent });
    room.roomName = Store.get("roomname", "") || ("Class " + roomCode);
    await room.start();

    // build the stage stream
    const mode = Store.get("broadcast", "composite");
    if (mode === "screen" && navigator.mediaDevices.getDisplayMedia) {
      try {
        stageStream = await navigator.mediaDevices.getDisplayMedia({
          video: { frameRate: COMP.fps }, audio: false
        });
        stageStream.getVideoTracks()[0].addEventListener("ended", () => {
          toast("Screen share ended — switching to composite mode", "err");
          startCompositeStage();
        });
      } catch {
        toast("Screen share unavailable — using composite mode", "");
        startCompositeStage();
      }
    } else {
      startCompositeStage();
    }
    if (!stageStream) startCompositeStage();

    // mic: ask once, attach to stage stream so students hear you
    await ensureMic(true);

    room.setStageStream(stageStream);

    $("#liveBadge").classList.remove("hide");
    $("#btnEndLive").classList.remove("hide");
    $("#btnGoLive").classList.add("hide");
    $("#sigDot").className = "dot on";
    classStartTs = Date.now();
    classTickInt = setInterval(() => {
      $("#timerVal").textContent = fmtTime((Date.now() - classStartTs) / 1000);
      $("#timerChip").classList.add("show");
    }, 1000);

    window._wantWake = Store.get("wake", true);
    if (window._wantWake) keepAwake(true);
    toast("You are LIVE. Share the invite link with students.", "ok", 5000);
  } catch (e) {
    toast(e.message || "Could not start class", "err", 6000);
    $("#btnGoLive").disabled = false;
  }
}

function startCompositeStage() {
  if (COMP.raf) cancelAnimationFrame(COMP.raf);
  drawComposite();
  COMP.raf = requestAnimationFrame(compositeLoop);
  const vidStream = COMP.canvas.captureStream(COMP.fps);
  stageStream = new MediaStream(vidStream.getVideoTracks());
  if (micStream) micStream.getAudioTracks().forEach((t) => stageStream.addTrack(t));
  if (room) room.setStageStream(stageStream);
}

async function ensureMic(on) {
  if (on && !micStream) {
    try {
      micStream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true }, video: false });
      micOn = true;
      if (stageStream) micStream.getAudioTracks().forEach((t) => stageStream.addTrack(t));
      $("#btnMic").classList.add("active");
    } catch { toast("Microphone blocked — students won't hear you. Allow mic in browser settings.", "err", 6000); }
  }
}

$("#btnMic").addEventListener("click", async () => {
  if (!micStream) { await ensureMic(true); if (room && stageStream) room.setStageStream(stageStream); return; }
  micOn = !micOn;
  micStream.getAudioTracks().forEach((t) => (t.enabled = micOn));
  $("#btnMic").classList.toggle("active", micOn);
  toast(micOn ? "Mic on" : "Mic muted");
});

$("#btnCam").addEventListener("click", async () => {
  if (!camOn) {
    try {
      camStream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 640 }, frameRate: { ideal: 15 }, facingMode: "user" }, audio: false
      });
      $("#selfVideo").srcObject = camStream;
      $("#selfView").classList.add("show");
      camOn = true;
      $("#btnCam").classList.add("active");
      if (room) room.setCamStream(camStream);
      toast("Camera on — students can now see you", "ok");
    } catch { toast("Camera blocked. Allow camera access in browser settings.", "err"); }
  } else {
    camStream.getTracks().forEach((t) => t.stop());
    camStream = null; camOn = false;
    $("#selfView").classList.remove("show");
    $("#btnCam").classList.remove("active");
    if (room) room.setCamStream(null);
    toast("Camera off");
  }
});

function endLive() {
  if (!confirm("End the class for everyone?")) return;
  if (room) { room.end(); }
  if (COMP.raf) cancelAnimationFrame(COMP.raf);
  if (recorder && recorder.state !== "inactive") stopRecording();
  clearInterval(classTickInt);
  $("#liveBadge").classList.add("hide");
  $("#btnEndLive").classList.add("hide");
  $("#btnGoLive").classList.remove("hide");
  $("#btnGoLive").disabled = false;
  $("#sigDot").className = "dot off";
  window._wantWake = false; keepAwake(false);
  toast("Class ended. Attendance is available in the Students drawer until you reload.");
}

/* ---- room events ---- */
const camTiles = new Map();
function onRoomEvent(type, p) {
  switch (type) {
    case "student-joined":
      toast("👋 " + p.name + " joined", "ok");
      renderRoster();
      break;
    case "student-left":
      toast(p.name + " left");
      removeCamTile(p.peerId);
      renderRoster();
      break;
    case "roster": renderRoster(); break;
    case "hand":
      if (p.up) toast("✋ " + p.name + " raised a hand", "", 4500);
      renderRoster();
      break;
    case "chat": addChatMsg(p.from, p.text, false); break;
    case "student-media":
      if (p.kind === "stucam") addCamTile(p.peerId, p.name, p.stream);
      if (p.kind === "stumic") playStudentAudio(p.peerId, p.stream);
      break;
    case "student-media-end":
      if (p.kind === "stucam") removeCamTile(p.peerId);
      break;
    case "poll-update": renderPollBars(p); break;
    case "signal":
      $("#sigDot").className = "dot " + (p.state === "reconnecting" ? "off" : "on");
      if (p.state === "reconnecting") toast("Reconnecting to signalling server…", "err");
      break;
  }
  $("#stuCount").textContent = (room ? room.students.size : 0) + " 👥";
}

function renderRoster() {
  const list = $("#rosterList");
  if (!room || room.students.size === 0) {
    list.innerHTML = '<p style="color:var(--text-dim);font-size:13px">No students yet. Share the room link.</p>';
    return;
  }
  list.innerHTML = "";
  for (const [pid, stu] of room.students) {
    const row = document.createElement("div");
    row.className = "stu-row";
    row.innerHTML = `
      <span class="hand">${stu.hand ? "✋" : ""}</span>
      <span class="name">${escapeHtml(stu.name)}</span>
      <button class="btn small" data-act="cam" title="Ask/stop camera">📷</button>
      <button class="btn small" data-act="mic" title="Allow/revoke mic">🎙</button>
      <button class="btn small danger" data-act="kick" title="Remove">✕</button>`;
    row.querySelector('[data-act="cam"]').addEventListener("click", (e) => {
      const b = e.currentTarget;
      const on = !b.classList.contains("active");
      b.classList.toggle("active", on);
      room.requestStudentCam(pid, on);
      toast(on ? "Asked " + stu.name + " to turn camera on" : "Asked " + stu.name + " to turn camera off");
    });
    row.querySelector('[data-act="mic"]').addEventListener("click", (e) => {
      const b = e.currentTarget;
      const on = !b.classList.contains("active");
      b.classList.toggle("active", on);
      room.allowMic(pid, on);
      toast(on ? stu.name + " may now speak" : "Mic permission revoked for " + stu.name);
    });
    row.querySelector('[data-act="kick"]').addEventListener("click", () => {
      if (confirm("Remove " + stu.name + " from the class?")) room.kick(pid);
    });
    list.appendChild(row);
  }
}

function addCamTile(pid, name, stream) {
  removeCamTile(pid);
  const tile = document.createElement("div");
  tile.className = "cam-tile";
  tile.innerHTML = `<video autoplay playsinline muted></video><span class="label">${escapeHtml(name)}</span>`;
  tile.querySelector("video").srcObject = stream;
  tile.addEventListener("click", () => tile.classList.toggle("focus"));
  $("#camGrid").appendChild(tile);
  camTiles.set(pid, tile);
}
function removeCamTile(pid) {
  const t = camTiles.get(pid);
  if (t) { t.remove(); camTiles.delete(pid); }
}
const stuAudio = new Map();
function playStudentAudio(pid, stream) {
  let a = stuAudio.get(pid);
  if (!a) { a = document.createElement("audio"); a.autoplay = true; document.body.appendChild(a); stuAudio.set(pid, a); }
  a.srcObject = stream;
}

/* ---- drawers ---- */
function toggleDrawer(id) {
  const d = $(id);
  const open = d.classList.contains("open");
  $$(".drawer").forEach((x) => x.classList.remove("open"));
  if (!open) d.classList.add("open");
}
$("#btnStudents").addEventListener("click", () => toggleDrawer("#drawerStudents"));
$("#btnChat").addEventListener("click", () => toggleDrawer("#drawerChat"));
$("#btnPoll").addEventListener("click", () => toggleDrawer("#drawerPoll"));
$$(".drawer-close").forEach((b) => b.addEventListener("click", () => b.closest(".drawer").classList.remove("open")));

/* ---- chat ---- */
function addChatMsg(who, text, me) {
  const list = $("#chatList");
  const div = document.createElement("div");
  div.className = "chat-msg" + (me ? " me" : "");
  div.innerHTML = `<div class="who">${escapeHtml(who)}</div>${escapeHtml(text)}`;
  list.appendChild(div);
  list.scrollTop = list.scrollHeight;
  if (!me && !$("#drawerChat").classList.contains("open")) toast("💬 " + who + ": " + text.slice(0, 60), "", 4000);
}
function sendTeacherChat() {
  const inp = $("#chatInput");
  const text = inp.value.trim();
  if (!text) return;
  inp.value = "";
  addChatMsg("You (Teacher)", text, true);
  if (room) room.sendChat(text);
}
$("#chatSend").addEventListener("click", sendTeacherChat);
$("#chatInput").addEventListener("keydown", (e) => { if (e.key === "Enter") sendTeacherChat(); });
$("#btnAnnounce").addEventListener("click", () => {
  const text = prompt("Announcement (shows full-screen on every student device):");
  if (text && room) { room.sendAnnouncement(text); toast("Announcement sent", "ok"); }
});

/* ---- students drawer extras ---- */
$("#btnLock").addEventListener("click", (e) => {
  if (!room) { toast("Go live first"); return; }
  room.setLocked(!room.locked);
  e.currentTarget.classList.toggle("active", room.locked);
  e.currentTarget.textContent = room.locked ? "🔓 Unlock room" : "🔒 Lock room";
  toast(room.locked ? "Room locked — no new students can join" : "Room unlocked");
});
$("#btnAttendance").addEventListener("click", () => {
  if (!room) { toast("No class data yet"); return; }
  downloadBlob(new Blob([room.attendanceCSV()], { type: "text/csv" }), "attendance-" + roomCode + "-" + Date.now() + ".csv");
});
$("#btnAskAllCams").addEventListener("click", () => {
  if (!room) return;
  for (const pid of room.students.keys()) room.requestStudentCam(pid, true);
  toast("Asked all students to turn cameras on");
});

/* ---- polls ---- */
$("#pollStart").addEventListener("click", () => {
  if (!room) { toast("Go live first", "err"); return; }
  const q = $("#pollQ").value.trim();
  const opts = $("#pollOpts").value.split("\n").map((s) => s.trim()).filter(Boolean).slice(0, 6);
  if (!q || opts.length < 2) { toast("Enter a question and at least 2 options", "err"); return; }
  room.startPoll(q, opts);
  $("#pollSetup").classList.add("hide");
  $("#pollLive").classList.remove("hide");
  $("#pollLiveQ").textContent = q;
});
$("#pollEnd").addEventListener("click", () => {
  if (!room) return;
  room.endPoll();
  $("#pollSetup").classList.remove("hide");
  $("#pollLive").classList.add("hide");
  toast("Poll ended — results shown to students", "ok");
});
function renderPollBars(res) {
  if (!res) return;
  const total = res.counts.reduce((a, b) => a + b, 0) || 1;
  $("#pollLiveBars").innerHTML = res.options.map((o, i) => `
    <div class="poll-opt">
      <div class="poll-bar"><i style="width:${Math.round((res.counts[i] / total) * 100)}%"></i>
      <b>${escapeHtml(o)} — ${res.counts[i]}</b></div>
    </div>`).join("");
}

/* ---- countdown timer ---- */
let cdInt = null, cdEnd = 0;
$("#btnTimer").addEventListener("click", () => openModal("#mTimer"));
$$("#mTimer [data-min]").forEach((b) => b.addEventListener("click", () => startCountdown(Number(b.dataset.min))));
$("#timerStartCustom").addEventListener("click", () => {
  const m = Number($("#timerCustom").value);
  if (m > 0) startCountdown(m);
});
$("#timerStop").addEventListener("click", () => { stopCountdown(); closeModal("#mTimer"); });
function startCountdown(mins) {
  cdEnd = Date.now() + mins * 60000;
  closeModal("#mTimer");
  clearInterval(cdInt);
  $("#timerChip").classList.add("show");
  if (room) room.sendAnnouncement("⏱ Timer started: " + mins + " minute" + (mins > 1 ? "s" : ""));
  cdInt = setInterval(() => {
    const left = (cdEnd - Date.now()) / 1000;
    if (left <= 0) {
      stopCountdown();
      toast("⏱ Time is up!", "ok", 5000);
      if (room) room.sendAnnouncement("⏱ Time is up!");
      return;
    }
    $("#timerVal").textContent = fmtTime(left);
  }, 400);
}
function stopCountdown() {
  clearInterval(cdInt); cdInt = null;
  // revert chip to class elapsed time
  if (classStartTs) $("#timerVal").textContent = fmtTime((Date.now() - classStartTs) / 1000);
}

/* ---- local recording (MediaRecorder) ---- */
let recorder = null, recChunks = [];
$("#btnRec").addEventListener("click", () => {
  if (recorder && recorder.state === "recording") { stopRecording(); return; }
  startRecording();
});
function startRecording() {
  if (!stageStream) { startCompositeStage(); }
  try {
    const mime = MediaRecorder.isTypeSupported("video/webm;codecs=vp8,opus") ? "video/webm;codecs=vp8,opus" : "video/webm";
    recorder = new MediaRecorder(stageStream, { mimeType: mime, videoBitsPerSecond: 900_000 });
    recChunks = [];
    recorder.ondataavailable = (e) => { if (e.data.size) recChunks.push(e.data); };
    recorder.onstop = () => {
      downloadBlob(new Blob(recChunks, { type: "video/webm" }), "lesson-" + roomCode + "-" + Date.now() + ".webm");
      recChunks = [];
    };
    recorder.start(2000);
    $("#btnRec").classList.add("active");
    toast("⏺ Recording started (saved on this device when you stop)", "ok");
  } catch (e) { toast("Recording not supported on this browser: " + e.message, "err"); }
}
function stopRecording() {
  try { recorder.stop(); } catch {}
  $("#btnRec").classList.remove("active");
  toast("Recording saved to your downloads", "ok");
}

/* ---- settings ---- */
$("#btnSettings").addEventListener("click", () => {
  $("#setName").value = Store.get("teachername", "");
  $("#setRoomName").value = Store.get("roomname", "");
  $("#setBroadcast").value = Store.get("broadcast", "composite");
  $("#setQuality").value = Store.get("quality", "1280x720x8");
  $("#setWake").checked = Store.get("wake", true);
  $("#setNewRoom").checked = false;
  openModal("#mSettings");
});
$("#setSave").addEventListener("click", () => {
  Store.set("teachername", $("#setName").value.trim());
  Store.set("roomname", $("#setRoomName").value.trim());
  Store.set("broadcast", $("#setBroadcast").value);
  Store.set("quality", $("#setQuality").value);
  Store.set("wake", $("#setWake").checked);
  if ($("#setNewRoom").checked) Store.set("newroom", true);
  setQuality($("#setQuality").value);
  closeModal("#mSettings");
  toast("Settings saved", "ok");
});

/* ---- solo mode shortcut (?solo=1 hides live chrome) ---- */
if (new URLSearchParams(location.search).get("solo") === "1") {
  ["#btnGoLive", "#btnCam", "#btnMic", "#btnStudents", "#btnChat", "#btnPoll", "#roomInfo", "#btnQR"]
    .forEach((s) => { const el = $(s); if (el) el.classList.add("hide"); });
  toast("Solo workspace — no live class features");
}

/* ---- warn before accidental exit while live ---- */
window.addEventListener("beforeunload", (e) => {
  if (room && room.students && room.students.size > 0) { e.preventDefault(); e.returnValue = ""; }
});

/* ============================================================
   v2 FEATURES
   ============================================================ */

/* ------------------------------------------------------------
   v2.1 FOCUS MODE — hides every toolbar so the workspace fills
   the entire screen. Built for the Google-Meet workflow:
   share your screen in Meet, tap 🎯, and students see ONLY the
   whiteboard + materials (like your screenshot). A translucent
   ☰ handle and a mini tool capsule stay available.
   ------------------------------------------------------------ */
const studioEl = $(".studio");
const focusHandle = $("#focusHandle");

/* build the mini tool capsule (pen / highlighter / eraser / laser /
   undo / page± / layout) shown only while in focus mode */
const focusTools = document.createElement("div");
focusTools.className = "focus-tools";
focusTools.innerHTML = `
  <button class="tool ft" data-ft="pen"       title="Pen">✏️</button>
  <button class="tool ft" data-ft="highlight" title="Highlighter">🖍️</button>
  <button class="tool ft" data-ft="eraser"    title="Eraser">🧽</button>
  <button class="tool ft" data-ft="laser"     title="Laser pointer">🔴</button>
  <button class="tool" id="ftUndo"  title="Undo">↩</button>
  <button class="tool" id="ftPgPrev" title="Previous board page">‹</button>
  <button class="tool" id="ftPgNext" title="Next board page">›</button>
  <button class="tool" id="ftPgAdd"  title="New board page">＋</button>
  <button class="tool" id="ftLayout" title="Cycle layout">◫</button>`;
document.body.appendChild(focusTools);

function activeBoards() {
  const out = [];
  for (const side of ["L", "R"]) {
    if (paneState[side].app === "board") {
      const inst = paneState[side].instances.board;
      if (inst && inst.wb) out.push(inst);
    }
  }
  return out;
}
$$(".ft", focusTools).forEach((b) => b.addEventListener("click", () => {
  $$(".ft", focusTools).forEach((x) => x.classList.remove("active"));
  b.classList.add("active");
  for (const inst of activeBoards()) {
    inst.wb.setTool(b.dataset.ft);
    // mirror selection on the full toolbar
    $$('.tool[data-tool]', inst.el).forEach((t) =>
      t.classList.toggle("active", t.dataset.tool === b.dataset.ft));
  }
}));
$("#ftUndo", focusTools).addEventListener("click", () => activeBoards().forEach((i) => i.wb.undo()));
$("#ftPgPrev", focusTools).addEventListener("click", () => activeBoards().forEach((i) => { i.wb.gotoPage(i.wb.pageIndex - 1); $(".wb-pageinfo", i.el).textContent = (i.wb.pageIndex + 1) + " / " + i.wb.pages.length; }));
$("#ftPgNext", focusTools).addEventListener("click", () => activeBoards().forEach((i) => { i.wb.gotoPage(i.wb.pageIndex + 1); $(".wb-pageinfo", i.el).textContent = (i.wb.pageIndex + 1) + " / " + i.wb.pages.length; }));
$("#ftPgAdd",  focusTools).addEventListener("click", () => activeBoards().forEach((i) => { i.wb.addPage(); $(".wb-pageinfo", i.el).textContent = (i.wb.pageIndex + 1) + " / " + i.wb.pages.length; }));
$("#ftLayout", focusTools).addEventListener("click", () => $("#btnLayout").click());

let focusOn = false;
function setFocus(on) {
  focusOn = on;
  studioEl.classList.toggle("focus", on);
  focusHandle.classList.toggle("hide", !on);
  Store.set("focus", on);
  setTimeout(resizeBoards, 120);
  if (on) toast("🎯 Focus mode — toolbars hidden. Tap ☰ (top-left) to bring them back.", "ok", 4500);
}
$("#btnFocus").addEventListener("click", () => setFocus(true));
focusHandle.addEventListener("click", () => setFocus(false));
/* keyboard escape hatch too */
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && focusOn) setFocus(false);
  if (e.key === "F9") setFocus(!focusOn);
});

/* ------------------------------------------------------------
   v2.2 MEET COMPANION MODE  (?meet=1 or the landing-page card)
   For teaching over Google Meet's screen share:
     • hides all built-in live-class controls (Meet handles the call)
     • turns on wake-lock immediately (Meet shares can be long)
     • shows a green "MEET COMPANION" badge
     • auto-enters focus mode after a short delay so what Meet
       shares is a clean full-screen workspace
   You can still tap ☰ to adjust, then re-enter focus.
   ------------------------------------------------------------ */
const meetMode = new URLSearchParams(location.search).get("meet") === "1";
if (meetMode) {
  ["#btnGoLive", "#btnEndLive", "#btnCam", "#btnMic", "#btnStudents", "#btnChat",
   "#btnPoll", "#roomInfo", "#btnQR", "#liveBadge"]
    .forEach((s) => { const el = $(s); if (el) el.classList.add("hide"); });
  const badge = document.createElement("span");
  badge.className = "badge meet";
  badge.textContent = "● MEET COMPANION";
  $(".topbar .brand").after(badge);
  window._wantWake = true; keepAwake(true);
  toast("Meet Companion: share your screen in Google Meet, then tap 🎯 to hide toolbars.", "ok", 6000);
}

/* restore focus state across reloads (e.g. accidental refresh mid-class) */
if (Store.get("focus", false) && (meetMode || new URLSearchParams(location.search).get("solo") === "1")) {
  setTimeout(() => setFocus(true), 600);
}

/* ------------------------------------------------------------
   v2.3 LESSON MANAGER — save/load named whiteboard decks
   Prepare boards before class, switch decks mid-lesson,
   export/import as .json to move between devices.
   ------------------------------------------------------------ */
function lessonsAll() { return Store.get("lessons", {}); }
function mainBoard() {
  for (const side of ["L", "R"]) {
    const inst = paneState[side].instances.board;
    if (inst && inst.wb) return inst;
  }
  // ensure a board exists in the left pane
  mountApp("L", "board");
  return paneState.L.instances.board;
}

$("#btnLessons").addEventListener("click", () => { renderLessons(); openModal("#mLessons"); });

$("#lessonSave").addEventListener("click", () => {
  const name = $("#lessonName").value.trim();
  if (!name) { toast("Give the lesson a name first", "err"); return; }
  const inst = mainBoard();
  const all = lessonsAll();
  all[name] = { pages: inst.wb.pages, saved: nowStamp(), pageCount: inst.wb.pages.length };
  try {
    Store.set("lessons", all);
    toast("💾 Saved “" + name + "” (" + inst.wb.pages.length + " page(s))", "ok");
    renderLessons();
  } catch { toast("Storage full — export old lessons as .json and delete them.", "err", 6000); }
});

function renderLessons() {
  const all = lessonsAll();
  const list = $("#lessonList");
  const names = Object.keys(all);
  if (!names.length) { list.innerHTML = '<p style="color:var(--text-dim);font-size:13px">No saved lessons yet.</p>'; return; }
  list.innerHTML = "";
  for (const name of names) {
    const row = document.createElement("div");
    row.className = "lesson-row";
    row.innerHTML = `
      <span class="name">${escapeHtml(name)}<br><span class="meta">${escapeHtml(all[name].saved || "")} • ${all[name].pageCount || "?"} page(s)</span></span>
      <button class="btn small primary" data-a="load">Open</button>
      <button class="btn small" data-a="dl" title="Download as .json">⬇</button>
      <button class="btn small danger" data-a="del">✕</button>`;
    row.querySelector('[data-a="load"]').addEventListener("click", () => {
      const inst = mainBoard();
      inst.wb.pages = JSON.parse(JSON.stringify(all[name].pages));
      inst.wb.gotoPage(0);
      inst.wb._save();
      $(".wb-pageinfo", inst.el).textContent = "1 / " + inst.wb.pages.length;
      closeModal("#mLessons");
      toast("📚 Opened “" + name + "”", "ok");
    });
    row.querySelector('[data-a="dl"]').addEventListener("click", () => {
      downloadBlob(new Blob([JSON.stringify(all[name].pages)], { type: "application/json" }),
        name.replace(/[^\w\- ]+/g, "") + ".classdeck.json");
    });
    row.querySelector('[data-a="del"]').addEventListener("click", () => {
      if (!confirm("Delete lesson “" + name + "”?")) return;
      delete all[name]; Store.set("lessons", all); renderLessons();
    });
    list.appendChild(row);
  }
}

$("#lessonExport").addEventListener("click", () => mainBoard().wb.exportAllJSON());
$("#lessonImportBtn").addEventListener("click", () => $("#lessonImportFile").click());
$("#lessonImportFile").addEventListener("change", async (e) => {
  const f = e.target.files[0];
  if (!f) return;
  const text = await f.text();
  const inst = mainBoard();
  inst.wb.importJSON(text);
  $(".wb-pageinfo", inst.el).textContent = "1 / " + inst.wb.pages.length;
  toast("Deck imported", "ok");
});

/* ------------------------------------------------------------
   v2.4 Divider double-tap → reset to 50/50
   ------------------------------------------------------------ */
let _lastDivTap = 0;
divider.addEventListener("pointerdown", () => {
  const now = Date.now();
  if (now - _lastDivTap < 350) { splitRatio = 0.5; applySplit(); Store.set("split", 0.5); resizeBoards(); }
  _lastDivTap = now;
});

/* ============================================================
   v3 FEATURES
   ============================================================ */

/* ------------------------------------------------------------
   v3.1 Whiteboard extras: insert image + export deck as PDF
   (buttons exist inside every board toolbar template)
   ------------------------------------------------------------ */
document.addEventListener("click", (e) => {
  const t = e.target.closest ? e.target.closest(".wb-img, .wb-pdf") : null;
  if (!t) return;
  const sec = t.closest("section");
  // find owning instance
  let owner = null;
  for (const side of ["L", "R"]) {
    const inst = paneState[side].instances.board;
    if (inst && inst.el === sec) owner = inst;
  }
  if (!owner || !owner.wb) return;
  if (t.classList.contains("wb-img")) {
    $(".wb-imgfile", sec).onchange = async (ev) => {
      const f = ev.target.files[0];
      if (f) { await owner.wb.insertImage(f); toast("🖼 Image placed on the board", "ok"); }
      ev.target.value = "";
    };
    $(".wb-imgfile", sec).click();
  } else {
    toast("Building PDF of " + owner.wb.pages.length + " page(s)…");
    owner.wb.exportDeckPDF().then(() => toast("🧾 Deck exported as PDF", "ok"));
  }
});

/* ------------------------------------------------------------
   v3.2 Quiz engine with auto-scoring + leaderboard
   ------------------------------------------------------------ */
$("#btnQuiz").addEventListener("click", () => { refreshQuizBanks(); renderLeaderboard(); toggleDrawer("#drawerQuiz"); });

function parseQuizText(text) {
  const blocks = text.split(/\n\s*\n/).map((b) => b.trim()).filter(Boolean);
  const questions = [];
  for (const b of blocks) {
    const lines = b.split("\n").map((l) => l.trim()).filter(Boolean);
    if (lines.length < 3) continue;
    const q = lines[0];
    const options = [];
    let correct = -1;
    lines.slice(1).forEach((l) => {
      if (l.startsWith("*")) { correct = options.length; options.push(l.slice(1).trim()); }
      else options.push(l);
    });
    if (correct >= 0 && options.length >= 2 && options.length <= 6)
      questions.push({ q, options, correct });
  }
  return questions;
}

$("#quizStart").addEventListener("click", () => {
  if (!room) { toast("Go live first (▶ Go Live) — quizzes run over the built-in classroom.", "err", 5000); return; }
  const questions = parseQuizText($("#quizText").value);
  if (!questions.length) { toast("No valid questions. Mark the correct option with * and separate questions with a blank line.", "err", 6000); return; }
  const def = {
    title: $("#quizTitle").value.trim() || "Quick quiz",
    secondsPerQ: Math.max(5, Number($("#quizSecs").value) || 30),
    questions
  };
  room.startQuiz(def);
  $("#quizSetup").classList.add("hide");
  $("#quizLive").classList.remove("hide");
  toast("🏆 Quiz started — " + questions.length + " question(s)", "ok");
});

$("#quizNext").addEventListener("click", () => {
  if (!room) return;
  if (!room.nextQuizQuestion()) toast("That was the last question — tap End quiz.", "", 4000);
});
$("#quizEnd").addEventListener("click", () => {
  if (!room) return;
  const board = room.endQuiz();
  $("#quizSetup").classList.remove("hide");
  $("#quizLive").classList.add("hide");
  renderLeaderboard();
  if (board && board.length) toast("🏆 Quiz over! Top: " + board[0].name + " (" + board[0].score + " pts)", "ok", 6000);
});
$("#scoreReset").addEventListener("click", () => {
  if (room) { room.resetScores(); renderLeaderboard(); toast("Scores reset"); }
});

function renderQuizProgress(p) {
  if (!p) return;
  $("#quizLiveTitle").textContent = p.title;
  $("#quizLiveQ").textContent = p.question || (room && room.activeQuiz ? room.activeQuiz.def.questions[p.index].q : "");
  $("#quizAnswered").textContent = p.answered + " / " + p.students;
  $("#quizPos").textContent = (p.index + 1) + " / " + p.total;
  const total = Object.values(p.tally).reduce((a, b) => a + b, 0) || 1;
  $("#quizTally").innerHTML = p.options.map((o, i) => `
    <div class="poll-opt ${i === p.correct ? "quiz-correct" : ""}">
      <div class="poll-bar"><i style="width:${Math.round(((p.tally[i] || 0) / total) * 100)}%"></i>
      <b>${i === p.correct ? "✓ " : ""}${escapeHtml(o)} — ${p.tally[i] || 0}</b></div>
    </div>`).join("");
}

function renderLeaderboard() {
  const list = $("#leaderList");
  if (!room) { list.innerHTML = '<p style="color:var(--text-dim);font-size:13px">Go live to see scores.</p>'; return; }
  const rows = room.leaderboard();
  if (!rows.length) { list.innerHTML = '<p style="color:var(--text-dim);font-size:13px">No students yet.</p>'; return; }
  list.innerHTML = rows.map((r, i) => `
    <div class="lead-row ${i === 0 ? "top1" : i === 1 ? "top2" : i === 2 ? "top3" : ""}">
      <span class="rank">${i + 1}</span><span class="name">${escapeHtml(r.name)}</span>
      <span class="pts">${r.score} pts</span>
    </div>`).join("");
}

/* question banks (saved on device) */
function refreshQuizBanks() {
  const banks = Store.get("quizbanks", {});
  const sel = $("#quizBankSel");
  sel.innerHTML = '<option value="">Load saved…</option>' +
    Object.keys(banks).map((n) => `<option>${escapeHtml(n)}</option>`).join("");
}
$("#quizSaveBank").addEventListener("click", () => {
  const name = $("#quizTitle").value.trim() || "Untitled quiz";
  const banks = Store.get("quizbanks", {});
  banks[name] = { secs: $("#quizSecs").value, text: $("#quizText").value };
  Store.set("quizbanks", banks);
  refreshQuizBanks();
  toast("💾 Question bank saved: " + name, "ok");
});
$("#quizBankSel").addEventListener("change", (e) => {
  const banks = Store.get("quizbanks", {});
  const b = banks[e.target.value];
  if (b) { $("#quizTitle").value = e.target.value; $("#quizSecs").value = b.secs; $("#quizText").value = b.text; }
});

/* hook quiz events into the room event stream */
const _origOnRoomEvent = onRoomEvent;
onRoomEvent = function (type, p) {
  _origOnRoomEvent(type, p);
  if (type === "quiz-progress") { renderQuizProgress(p); renderLeaderboard(); }
  if (type === "student-joined" || type === "student-left") renderLeaderboard();
};

/* ------------------------------------------------------------
   v3.3 Floating draggable calculator (scientific basics)
   ------------------------------------------------------------ */
const CALC_KEYS = [
  "C", "(", ")", "%", "⌫",
  "7", "8", "9", "÷", "√",
  "4", "5", "6", "×", "x²",
  "1", "2", "3", "−", "π",
  "0", ".", "+", "=",
];
(function buildCalc() {
  const grid = $("#calcKeys");
  CALC_KEYS.forEach((k) => {
    const b = document.createElement("button");
    b.textContent = k;
    if ("÷×−+%√".includes(k) || k === "x²" || k === "π") b.className = "op";
    if (k === "=") b.className = "eq";
    b.addEventListener("click", () => calcPress(k));
    grid.appendChild(b);
  });
})();
let calcExpr = "";
function calcPress(k) {
  const disp = $("#calcDisplay");
  if (k === "C") calcExpr = "";
  else if (k === "⌫") calcExpr = calcExpr.slice(0, -1);
  else if (k === "=") {
    try {
      let e = calcExpr.replace(/÷/g, "/").replace(/×/g, "*").replace(/−/g, "-")
        .replace(/π/g, "Math.PI").replace(/√\(/g, "Math.sqrt(").replace(/√(\d+(\.\d+)?)/g, "Math.sqrt($1)")
        .replace(/(\d+(\.\d+)?|\))²/g, "Math.pow($1,2)").replace(/%/g, "/100");
      if (!/^[\d+\-*/().,\sMathPIsqrtpow]+$/.test(e)) throw new Error("bad");
      // eslint-disable-next-line no-new-func
      const val = Function('"use strict";return (' + e + ")")();
      calcExpr = String(Number.isFinite(val) ? Math.round(val * 1e10) / 1e10 : "Error");
    } catch { calcExpr = "Error"; }
  }
  else if (k === "x²") calcExpr += "²";
  else calcExpr += k;
  disp.value = calcExpr || "0";
  if (calcExpr === "Error") calcExpr = "";
}
$("#btnCalc").addEventListener("click", () => $("#calcBox").classList.toggle("hide"));
$("#calcClose").addEventListener("click", () => $("#calcBox").classList.add("hide"));
(function dragCalc() {
  const box = $("#calcBox"), head = $("#calcDrag");
  let drag = false, sx = 0, sy = 0, ox = 0, oy = 0;
  head.addEventListener("pointerdown", (e) => {
    if (e.target.tagName === "BUTTON") return;
    drag = true; head.setPointerCapture(e.pointerId);
    sx = e.clientX; sy = e.clientY;
    const r = box.getBoundingClientRect(); ox = r.left; oy = r.top;
  });
  head.addEventListener("pointermove", (e) => {
    if (!drag) return;
    box.style.left = Math.max(2, Math.min(window.innerWidth - box.offsetWidth - 2, ox + e.clientX - sx)) + "px";
    box.style.top = Math.max(2, Math.min(window.innerHeight - 60, oy + e.clientY - sy)) + "px";
    box.style.right = "auto";
  });
  head.addEventListener("pointerup", () => { drag = false; });
})();

/* ------------------------------------------------------------
   v3.4 Class analytics report
   ------------------------------------------------------------ */
function buildReport() {
  if (!room) return "No class data — go live first.";
  const s = room.stats;
  const dur = s.start ? fmtTime((Date.now() - s.start) / 1000) : "—";
  const lb = room.leaderboard();
  const lines = [
    "HMG ClassDeck — Class report",
    "Generated: " + nowStamp(),
    "Room: " + room.code + (room.roomName ? "  (" + room.roomName + ")" : ""),
    "",
    "Duration so far:      " + dur,
    "Total joins:          " + s.joins,
    "Peak attendance:      " + s.peak,
    "Currently connected:  " + room.students.size,
    "Chat messages (stu):  " + s.chats,
    "Quizzes run:          " + s.quizzes.length +
      (s.quizzes.length ? "  [" + s.quizzes.map((q) => q.title + " → top: " + q.top).join("; ") + "]" : ""),
    "",
    "Leaderboard:",
    ...(lb.length ? lb.map((r, i) => "  " + (i + 1) + ". " + r.name + " — " + r.score + " pts") : ["  (no students)"]),
    "",
    "Attendance log:",
    ...room.attendance.map((a) => "  " + a.time + "  " + a.event.toUpperCase().padEnd(6) + " " + a.name)
  ];
  return lines.join("\n");
}
$("#btnReport").addEventListener("click", () => {
  $("#reportBody").innerHTML = "<pre style='white-space:pre-wrap;font-size:12.5px'>" + escapeHtml(buildReport()) + "</pre>";
  openModal("#mReport");
});
$("#reportDownload").addEventListener("click", () => {
  downloadBlob(new Blob([buildReport()], { type: "text/plain" }), "class-report-" + roomCode + "-" + Date.now() + ".txt");
});

/* ------------------------------------------------------------
   v3.5 Room PIN + branding + backup/restore (Settings)
   ------------------------------------------------------------ */
(function extendSettings() {
  const openBtn = $("#btnSettings");
  openBtn.addEventListener("click", () => {
    $("#setPin").value = Store.get("pin", "");
    $("#setBrand").value = Store.get("brand", "HMG ClassDeck");
    $("#setAccent").value = Store.get("accent", "#ffb347");
  });
  $("#setSave").addEventListener("click", () => {
    const pin = $("#setPin").value.trim();
    Store.set("pin", pin);
    if (room) room.pin = pin;
    const brand = $("#setBrand").value.trim() || "HMG ClassDeck";
    Store.set("brand", brand);
    const accent = $("#setAccent").value;
    Store.set("accent", accent);
    applyBranding();
  });
  $("#setAccentReset").addEventListener("click", () => { $("#setAccent").value = "#ffb347"; });

  $("#setBackup").addEventListener("click", () => {
    const dump = {};
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith("hmgcd_")) dump[k] = localStorage.getItem(k);
    }
    downloadBlob(new Blob([JSON.stringify({ v: 3, when: nowStamp(), data: dump }, null, 1)],
      { type: "application/json" }), "classdeck-backup-" + Date.now() + ".json");
    toast("⬇ Backup downloaded — keep it somewhere safe", "ok");
  });
  $("#setRestoreBtn").addEventListener("click", () => $("#setRestoreFile").click());
  $("#setRestoreFile").addEventListener("change", async (e) => {
    const f = e.target.files[0];
    if (!f) return;
    try {
      const obj = JSON.parse(await f.text());
      if (!obj.data) throw new Error("not a ClassDeck backup");
      if (!confirm("Restore backup from " + (obj.when || "unknown date") + "? This overwrites current lessons/settings.")) return;
      for (const [k, v] of Object.entries(obj.data)) localStorage.setItem(k, v);
      toast("✅ Backup restored — reloading…", "ok");
      setTimeout(() => location.reload(), 900);
    } catch (err) { toast("Restore failed: " + err.message, "err"); }
  });
})();

function applyBranding() {
  const accent = Store.get("accent", "#ffb347");
  document.documentElement.style.setProperty("--accent", accent);
}
applyBranding();

/* apply pin to room when going live (wrap goLive side-effect) */
const _origGoLiveBtn = $("#btnGoLive");
_origGoLiveBtn.addEventListener("click", () => {
  setTimeout(() => { if (room) room.pin = Store.get("pin", ""); }, 1200);
});

/* branding in the composite watermark */
const _origDrawComposite = drawComposite;
drawComposite = function () {
  _origDrawComposite();
  const brand = Store.get("brand", "");
  if (brand && brand !== "HMG ClassDeck") {
    const ctx = COMP.ctx;
    ctx.fillStyle = "rgba(16,20,43,.78)";
    const w = ctx.measureText(brand).width + 26;
    ctx.fillRect(0, COMP.h - 30, w + 14, 30);
    ctx.fillStyle = "#ffb347";
    ctx.font = "bold 13px system-ui, sans-serif";
    ctx.textBaseline = "middle";
    ctx.fillText(brand, 10, COMP.h - 15);
  }
};

/* ------------------------------------------------------------
   v3.6 Keyboard shortcuts (USB/Bluetooth keyboard friendly)
   ------------------------------------------------------------ */
document.addEventListener("keydown", (e) => {
  if (e.target.matches("input, textarea, select")) return;
  const board = activeBoards()[0];
  const map = {
    "p": "pen", "h": "highlight", "e": "eraser", "l": "laser",
    "r": "rect", "o": "ellipse", "a": "arrow", "t": "text"
  };
  if (e.ctrlKey && e.key.toLowerCase() === "z") { board && board.wb.undo(); e.preventDefault(); return; }
  if (e.ctrlKey && e.key.toLowerCase() === "y") { board && board.wb.redo(); e.preventDefault(); return; }
  if (!e.ctrlKey && !e.altKey && map[e.key.toLowerCase()] && board) {
    board.wb.setTool(map[e.key.toLowerCase()]);
    $$('.tool[data-tool]', board.el).forEach((t) => t.classList.toggle("active", t.dataset.tool === map[e.key.toLowerCase()]));
    toast("Tool: " + map[e.key.toLowerCase()]);
  }
  if (e.key === "PageDown" && board) { board.wb.gotoPage(board.wb.pageIndex + 1); }
  if (e.key === "PageUp" && board) { board.wb.gotoPage(board.wb.pageIndex - 1); }
});
