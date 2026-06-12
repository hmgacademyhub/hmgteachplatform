/* ============================================================
   HMG ACADEMY CLASS DECK — Reader Cast engine (v6.2)
   WHY: getDisplayMedia (screen capture) does NOT exist on
   Android Chrome/Edge — so "Cast" could never work on tablets
   like the itel Vista Tab 30s. And browsers forbid drawing an
   iframe's pixels onto a canvas (privacy), so the composite
   can never show the embedded browser directly.

   THE FIX — Reader Cast (works on EVERY device):
   1. Fetch the page's CONTENT (text + images) through free,
      key-less CORS-friendly readers:
        • https://r.jina.ai/<url>        (free reader proxy)
        • https://api.allorigins.win/raw (free CORS proxy, fallback)
   2. Render that content onto a CANVAS — headings, paragraphs,
      bullets, and images (loaded CORS-safe via images.weserv.nl).
   3. The canvas IS broadcastable: students see the page in the
      live stream, scrolling exactly as the teacher scrolls.
   Desktop browsers that DO support live tab capture still get
   the true 📡 Live Cast as an extra option.
   ============================================================ */
"use strict";

class ReaderView {
  constructor(stageEl, opts = {}) {
    this.stage = stageEl;
    this.onState = opts.onState || (() => {});
    this.canvas = document.createElement("canvas");
    this.canvas.style.cssText = "position:absolute;inset:0;width:100%;height:100%;touch-action:none";
    this.stage.appendChild(this.canvas);
    this.ctx = this.canvas.getContext("2d");
    this.blocks = [];          // {type:'h1'|'h2'|'p'|'li'|'img', text?, url?, img?}
    this.scroll = 0;
    this.totalH = 0;
    this.fontScale = 1;
    this.status = "idle";      // idle | loading | ready | error
    this.statusMsg = "";
    this.title = "";
    this.url = "";
    this._bind();
    new ResizeObserver(() => this.draw()).observe(this.stage);
    this.draw();
  }

  /* ---------------- fetching ---------------- */
  async load(url) {
    if (!/^https?:\/\//i.test(url)) url = "https://" + url;
    this.url = url;
    this.status = "loading";
    this.statusMsg = "Fetching page content…";
    this.scroll = 0;
    this.blocks = [];
    this.draw();
    this.onState(this.status);
    try {
      let blocks = null;
      /* 1st: r.jina.ai — returns clean markdown-ish text, CORS open, no key */
      try {
        const r = await fetch("https://r.jina.ai/" + url, {
          headers: { "Accept": "text/plain" }, signal: AbortSignal.timeout(20000)
        });
        if (r.ok) {
          const txt = await r.text();
          if (txt && txt.length > 60) blocks = this._parseMarkdown(txt);
        }
      } catch {}
      /* 2nd: retry r.jina.ai once (it is very reliable but can be busy) */
      if (!blocks || blocks.length < 3) {
        try {
          await new Promise((res) => setTimeout(res, 1200));
          const rr = await fetch("https://r.jina.ai/" + url, {
            headers: { "Accept": "text/plain" }, signal: AbortSignal.timeout(25000)
          });
          if (rr.ok) {
            const t2 = await rr.text();
            if (t2 && t2.length > 60) blocks = this._parseMarkdown(t2);
          }
        } catch {}
      }
      /* 3rd: allorigins raw HTML + DOMParser (secondary free proxy) */
      if (!blocks || blocks.length < 3) {
        const r2 = await fetch("https://api.allorigins.win/raw?url=" + encodeURIComponent(url),
          { signal: AbortSignal.timeout(25000) });
        if (!r2.ok) throw new Error("proxy " + r2.status);
        blocks = this._parseHTML(await r2.text(), url);
      }
      if (!blocks || !blocks.length) throw new Error("No readable content found");
      this.blocks = blocks.slice(0, 500);
      this.status = "ready";
      this.statusMsg = "";
      this._loadImages();
      this.draw();
    } catch (e) {
      this.status = "error";
      this.statusMsg = "Could not fetch this page (" + (e.message || "network") + "). " +
        "Some sites block readers — try a different page, or save it as PDF and open it in the PDF pane.";
      this.draw();
    }
    this.onState(this.status);
  }

  _parseMarkdown(txt) {
    /* r.jina.ai prepends "Title:", "URL Source:", "Markdown Content:" */
    const mIdx = txt.indexOf("Markdown Content:");
    const tMatch = txt.match(/^Title:\s*(.+)$/m);
    if (tMatch) this.title = tMatch[1].trim();
    const body = mIdx >= 0 ? txt.slice(mIdx + 17) : txt;
    const out = [];
    if (this.title) out.push({ type: "h1", text: this.title });
    for (let raw of body.split("\n")) {
      let line = raw.trim();
      if (!line) continue;
      /* image: ![alt](url) */
      const im = line.match(/!\[[^\]]*\]\((https?:\/\/[^)\s]+)\)/);
      if (im) { out.push({ type: "img", url: im[1] }); line = line.replace(im[0], "").trim(); if (!line) continue; }
      /* strip links [text](url) -> text ; bold/italics */
      line = line.replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
                 .replace(/\*\*([^*]+)\*\*/g, "$1").replace(/\*([^*]+)\*/g, "$1")
                 .replace(/`{1,3}([^`]*)`{1,3}/g, "$1").replace(/^>+\s*/, "");
      if (!line || /^[-=_*]{3,}$/.test(line)) continue;
      if (/^#{1,2}\s/.test(line)) out.push({ type: "h1", text: line.replace(/^#+\s*/, "") });
      else if (/^#{3,6}\s/.test(line)) out.push({ type: "h2", text: line.replace(/^#+\s*/, "") });
      else if (/^[-*+•]\s/.test(line)) out.push({ type: "li", text: line.replace(/^[-*+•]\s*/, "") });
      else if (/^\d+\.\s/.test(line)) out.push({ type: "li", text: line });
      else out.push({ type: "p", text: line });
    }
    return out;
  }

  _parseHTML(html, baseUrl) {
    const doc = new DOMParser().parseFromString(html, "text/html");
    doc.querySelectorAll("script,style,nav,footer,header,aside,noscript,iframe,form,svg").forEach((n) => n.remove());
    this.title = (doc.querySelector("title") || {}).textContent || "";
    const out = [];
    if (this.title) out.push({ type: "h1", text: this.title.trim() });
    const root = doc.querySelector("main, article, #content, .content, body") || doc.body;
    const walk = (node) => {
      for (const el of node.children) {
        const tag = el.tagName;
        const txt = (el.textContent || "").replace(/\s+/g, " ").trim();
        if (tag === "H1" || tag === "H2") { if (txt) out.push({ type: "h1", text: txt }); }
        else if (/^H[3-6]$/.test(tag)) { if (txt) out.push({ type: "h2", text: txt }); }
        else if (tag === "P") { if (txt.length > 2) out.push({ type: "p", text: txt }); }
        else if (tag === "LI") { if (txt.length > 1) out.push({ type: "li", text: txt }); }
        else if (tag === "IMG") {
          let src = el.getAttribute("src") || "";
          if (src && !/^data:/.test(src)) {
            try { src = new URL(src, baseUrl).href; out.push({ type: "img", url: src }); } catch {}
          }
        } else if (["DIV", "SECTION", "ARTICLE", "MAIN", "UL", "OL", "TABLE", "TBODY", "TR", "TD", "FIGURE", "SPAN", "A", "BODY"].includes(tag)) {
          walk(el);
        }
        if (out.length > 600) return;
      }
    };
    walk(root);
    /* de-duplicate consecutive identical lines */
    return out.filter((b, i) => !(i && b.text && out[i - 1].text === b.text));
  }

  _loadImages() {
    let n = 0;
    for (const b of this.blocks) {
      if (b.type !== "img" || b.img) continue;
      if (++n > 12) break;             // keep it light on mobile data
      /* 1st: direct with CORS (Wikipedia/Wikimedia and many CDNs allow it).
         2nd: images.weserv.nl free image proxy. Else: skip gracefully. */
      const direct = new Image();
      direct.crossOrigin = "anonymous";
      direct.src = b.url;
      direct.onload = () => { b.img = direct; this.draw(); };
      direct.onerror = () => {
        const prox = new Image();
        prox.crossOrigin = "anonymous";
        prox.src = "https://images.weserv.nl/?url=" + encodeURIComponent(b.url.replace(/^https?:\/\//, "")) + "&w=900";
        prox.onload = () => { b.img = prox; this.draw(); };
        prox.onerror = () => { b.failed = true; this.draw(); };
      };
    }
  }

  /* ---------------- layout + drawing ---------------- */
  _dims() {
    const r = this.stage.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = Math.max(50, Math.round(r.width * dpr));
    const h = Math.max(50, Math.round(r.height * dpr));
    if (this.canvas.width !== w || this.canvas.height !== h) {
      this.canvas.width = w; this.canvas.height = h;
    }
    return { W: w, H: h, dpr };
  }

  draw() {
    const { W, H, dpr } = this._dims();
    const ctx = this.ctx;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, W, H);

    if (this.status !== "ready") {
      ctx.fillStyle = this.status === "error" ? "#b3261e" : "#445";
      ctx.font = Math.round(W / 34) + "px system-ui";
      ctx.textAlign = "center"; ctx.textBaseline = "middle";
      const msg = this.status === "loading" ? "⏳ " + this.statusMsg
        : this.status === "error" ? "⚠ " + this.statusMsg
        : "📖 Enter a URL above and tap Cast to show the page to your students.";
      this._wrapCentred(ctx, msg, W / 2, H / 2, W * 0.8, Math.round(W / 26));
      ctx.textAlign = "left";
      return;
    }

    const m = Math.round(W * 0.055);
    const base = Math.round(W / 30 * this.fontScale);
    const lh = Math.round(base * 1.55);
    ctx.textBaseline = "alphabetic";
    let y = m - this.scroll;

    for (const b of this.blocks) {
      if (y > H + lh * 4 + (b.type === "img" ? 600 : 0)) { y += this._blockH(ctx, b, W, m, base, lh); continue; }
      const bh = this._blockH(ctx, b, W, m, base, lh);
      if (y + bh > 0) this._drawBlock(ctx, b, W, m, base, lh, y);
      y += bh;
    }
    this.totalH = y + this.scroll + m;

    /* scrollbar */
    if (this.totalH > H) {
      const sbH = Math.max(40, H * (H / this.totalH));
      const sbY = (this.scroll / (this.totalH - H)) * (H - sbH);
      ctx.fillStyle = "rgba(30,42,120,.35)";
      ctx.fillRect(W - 7 * dpr, sbY, 5 * dpr, sbH);
    }
    /* footer source line */
    ctx.fillStyle = "rgba(255,255,255,.92)";
    ctx.fillRect(0, H - lh * 1.2, W, lh * 1.2);
    ctx.fillStyle = "#777";
    ctx.font = Math.round(base * 0.72) + "px system-ui";
    ctx.fillText("📖 Reader Cast · " + this.url.slice(0, 80), m, H - lh * 0.4);
  }

  _blockH(ctx, b, W, m, base, lh) {
    if (b.type === "img") {
      if (b.img) {
        const iw = Math.min(W - m * 2, b.img.naturalWidth * 2);
        return Math.round(iw * b.img.naturalHeight / b.img.naturalWidth) + lh;
      }
      return b.failed ? 0 : lh * 2;
    }
    const size = b.type === "h1" ? base * 1.5 : b.type === "h2" ? base * 1.2 : base;
    ctx.font = (b.type === "h1" || b.type === "h2" ? "bold " : "") + Math.round(size) + "px system-ui";
    const maxW = W - m * 2 - (b.type === "li" ? base * 1.2 : 0);
    const lines = this._wrapCount(ctx, b.text, maxW);
    return lines * Math.round(size * 1.5) + (b.type === "h1" ? lh : b.type === "h2" ? lh * 0.6 : lh * 0.4);
  }

  _drawBlock(ctx, b, W, m, base, lh, y) {
    if (b.type === "img") {
      if (b.img) {
        const iw = Math.min(W - m * 2, b.img.naturalWidth * 2);
        const ih = Math.round(iw * b.img.naturalHeight / b.img.naturalWidth);
        ctx.drawImage(b.img, m, y, iw, ih);
      } else if (!b.failed) {
        ctx.fillStyle = "#eef1f8";
        ctx.fillRect(m, y, W - m * 2, lh * 1.6);
        ctx.fillStyle = "#99a";
        ctx.font = Math.round(base * 0.8) + "px system-ui";
        ctx.fillText("🖼 loading image…", m + base, y + lh);
      }
      return;
    }
    const size = b.type === "h1" ? base * 1.5 : b.type === "h2" ? base * 1.2 : base;
    ctx.font = (b.type === "h1" || b.type === "h2" ? "bold " : "") + Math.round(size) + "px system-ui";
    ctx.fillStyle = b.type === "h1" ? "#1e2a78" : b.type === "h2" ? "#27357f" : "#222";
    let x = m;
    if (b.type === "li") {
      ctx.fillStyle = "#4f6ef7";
      ctx.beginPath(); ctx.arc(m + base * 0.3, y + size * 0.6, base * 0.16, 0, 7); ctx.fill();
      ctx.fillStyle = "#222";
      x = m + base * 1.2;
    }
    const maxW = W - m - x;
    let cur = "", yy = y + size;
    for (const w of String(b.text).split(" ")) {
      const t = cur ? cur + " " + w : w;
      if (ctx.measureText(t).width > maxW && cur) {
        ctx.fillText(cur, x, yy); yy += Math.round(size * 1.5); cur = w;
      } else cur = t;
    }
    ctx.fillText(cur, x, yy);
  }

  _wrapCount(ctx, text, maxW) {
    let lines = 1, cur = "";
    for (const w of String(text).split(" ")) {
      const t = cur ? cur + " " + w : w;
      if (ctx.measureText(t).width > maxW && cur) { lines++; cur = w; }
      else cur = t;
    }
    return lines;
  }
  _wrapCentred(ctx, text, cx, cy, maxW, lhPx) {
    const words = String(text).split(" ");
    const lines = []; let cur = "";
    for (const w of words) {
      const t = cur ? cur + " " + w : w;
      if (ctx.measureText(t).width > maxW && cur) { lines.push(cur); cur = w; }
      else cur = t;
    }
    lines.push(cur);
    const y0 = cy - ((lines.length - 1) * lhPx) / 2;
    lines.forEach((l, i) => ctx.fillText(l, cx, y0 + i * lhPx));
  }

  /* ---------------- scrolling ---------------- */
  _bind() {
    let dragging = false, lastY = 0, vel = 0, raf = null;
    const dpr = () => this.canvas.width / Math.max(1, this.canvas.getBoundingClientRect().width);
    this.canvas.addEventListener("pointerdown", (e) => {
      dragging = true; lastY = e.clientY; vel = 0;
      this.canvas.setPointerCapture(e.pointerId);
      if (raf) { cancelAnimationFrame(raf); raf = null; }
    });
    this.canvas.addEventListener("pointermove", (e) => {
      if (!dragging) return;
      const dy = (lastY - e.clientY) * dpr();
      lastY = e.clientY;
      vel = dy;
      this._scrollBy(dy);
    });
    const end = () => {
      dragging = false;
      /* momentum */
      const tick = () => {
        vel *= 0.94;
        if (Math.abs(vel) < 0.6) { raf = null; return; }
        this._scrollBy(vel);
        raf = requestAnimationFrame(tick);
      };
      if (Math.abs(vel) > 2) raf = requestAnimationFrame(tick);
    };
    this.canvas.addEventListener("pointerup", end);
    this.canvas.addEventListener("pointercancel", end);
    this.canvas.addEventListener("wheel", (e) => {
      e.preventDefault();
      this._scrollBy(e.deltaY * dpr());
    }, { passive: false });
  }
  _scrollBy(dy) {
    const H = this.canvas.height;
    this.scroll = Math.max(0, Math.min(Math.max(0, this.totalH - H), this.scroll + dy));
    this.draw();
  }
  setFontScale(s) {
    this.fontScale = Math.max(0.6, Math.min(2.2, s));
    this.draw();
  }
}
