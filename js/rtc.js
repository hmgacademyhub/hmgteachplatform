/* ============================================================
   HMG ClassDeck — Live classroom engine (PeerJS / WebRTC)
   100% free: uses the public PeerJS cloud broker + Google STUN.
   No backend server. Teacher is the "hub"; students connect
   directly to the teacher (mesh-star topology).

   Channels:
     • DataConnection  : chat, roster, hand-raise, polls, control
     • MediaConnection : teacher → student  (stage broadcast + teacher cam)
                         student → teacher  (student cam / mic when allowed)
   ============================================================ */
"use strict";

const RTC_PREFIX = "hmg-classdeck-v1-";

const PEER_CONFIG = {
  // Public PeerJS cloud (free). Only brokers signalling; media is P2P.
  debug: 1,
  config: {
    iceServers: [
      { urls: "stun:stun.l.google.com:19302" },
      { urls: "stun:stun1.l.google.com:19302" },
      // Free public TURN (openrelay) – improves connectivity on mobile data.
      { urls: "turn:openrelay.metered.ca:80",  username: "openrelayproject", credential: "openrelayproject" },
      { urls: "turn:openrelay.metered.ca:443", username: "openrelayproject", credential: "openrelayproject" }
    ]
  }
};

/* ============================================================
   TEACHER SIDE
   ============================================================ */
class TeacherRoom {
  constructor(roomCode, opts = {}) {
    this.code = roomCode;
    this.onEvent = opts.onEvent || (() => {});       // (type, payload)
    this.stageStream = null;                          // composed canvas + mic
    this.camStream = null;                            // teacher camera
    this.students = new Map();                        // peerId -> {conn, name, joinedAt, hand, mediaCalls:[]}
    this.attendance = [];                             // {name, event, time}
    this.activePoll = null;
    this.peer = null;
    this.locked = false;
    this.waitingRoom = false;                         // v4: Zoom-style waiting room
    this.pending = new Map();                         // v4: peers awaiting admission
    this.pin = "";                                    // v3: optional room PIN
    this.boardsOn = false;                            // v8: student whiteboards
    this.activity = null;                             // v8: open/cloud/exit activity
    this.groups = null;                               // v8: group assignments
    this.activeQuiz = null;                           // v3: quiz engine
    this.stats = { start: 0, peak: 0, joins: 0, chats: 0, polls: [], quizzes: [] }; // v3: analytics
    this._reconnectTimer = null;
  }

  start() {
    return new Promise((resolve, reject) => {
      this.peer = new Peer(RTC_PREFIX + this.code + "-host", PEER_CONFIG);
      this.peer.on("open", () => { this.stats.start = Date.now(); this._wire(); resolve(); });
      this.peer.on("error", (err) => {
        if (err.type === "unavailable-id") reject(new Error("Room code already in use — generate a new one."));
        else if (err.type === "peer-unavailable") { /* student left; ignore */ }
        else this.onEvent("error", err);
      });
      this.peer.on("disconnected", () => {
        this.onEvent("signal", { state: "reconnecting" });
        clearTimeout(this._reconnectTimer);
        this._reconnectTimer = setTimeout(() => { try { this.peer.reconnect(); } catch {} }, 1500);
      });
    });
  }

  _wire() {
    // Students open a data connection first.
    this.peer.on("connection", (conn) => {
      conn.on("open", () => {
        if (this.locked) {
          conn.send({ t: "rejected", reason: "Room is locked by the teacher." });
          setTimeout(() => conn.close(), 400);
          return;
        }
        const meta = conn.metadata || {};
        if (this.pin && String(meta.pin || "") !== this.pin) {   // v3: PIN gate
          conn.send({ t: "rejected", reason: "Wrong class PIN. Ask your teacher for the correct PIN." });
          setTimeout(() => conn.close(), 400);
          return;
        }
        const name = (meta.name || "Student").slice(0, 40);
        /* v4: waiting room — hold the student until the teacher admits */
        if (this.waitingRoom) {
          this.pending.set(conn.peer, { conn, name });
          conn.send({ t: "waiting" });
          this.onEvent("waiting", { peerId: conn.peer, name });
          return;
        }
        this._admit(conn, name);
      });
      conn.on("data", (d) => this._onData(conn, d));
      conn.on("close", () => { this.pending.delete(conn.peer); this._dropStudent(conn.peer); });
      conn.on("error", () => { this.pending.delete(conn.peer); this._dropStudent(conn.peer); });
    });

    // Students may call us back with their camera / mic.
    this.peer.on("call", (call) => {
      const kind = (call.metadata && call.metadata.kind) || "stucam";
      const stu = this.students.get(call.peer);
      call.answer(); // receive-only
      call.on("stream", (stream) => {
        this.onEvent("student-media", { peerId: call.peer, name: stu ? stu.name : "Student", kind, stream });
      });
      call.on("close", () => this.onEvent("student-media-end", { peerId: call.peer, kind }));
      if (stu) stu.mediaCalls.push(call);
    });
  }

  /* v4: admit a student (directly, or from the waiting room) */
  _admit(conn, name) {
    this.students.set(conn.peer, { conn, name, joinedAt: Date.now(), hand: false, mediaCalls: [], score: 0 });
    this.attendance.push({ name, event: "joined", time: nowStamp() });
    this.stats.joins++;
    this.stats.peak = Math.max(this.stats.peak, this.students.size);
    conn.send({ t: "welcome", roomName: this.roomName || this.code, count: this.students.size });
    this._broadcastRoster();
    this.onEvent("student-joined", { peerId: conn.peer, name });
    // push current stage + cam to the newcomer
    if (this.stageStream) this._callStudent(conn.peer, this.stageStream, "stage");
    if (this.camStream)   this._callStudent(conn.peer, this.camStream, "teachercam");
    if (this.activePoll)  conn.send({ t: "poll", poll: this.activePoll.def });
    if (this.activeQuiz)  conn.send({ t: "quiz", quiz: this._quizPublicDef() });
  }

  /* v4: waiting-room controls */
  setWaitingRoom(v) { this.waitingRoom = v; }
  admit(peerId) {
    const p = this.pending.get(peerId);
    if (!p) return;
    this.pending.delete(peerId);
    p.conn.send({ t: "admitted" });
    this._admit(p.conn, p.name);
  }
  admitAll() { for (const pid of [...this.pending.keys()]) this.admit(pid); }
  deny(peerId) {
    const p = this.pending.get(peerId);
    if (!p) return;
    this.pending.delete(peerId);
    try { p.conn.send({ t: "rejected", reason: "The teacher did not admit you." }); } catch {}
    setTimeout(() => { try { p.conn.close(); } catch {} }, 300);
  }

  /* v4: Zoom/Meet-style extras */
  muteAllStudents() {
    for (const [pid, stu] of this.students) {
      try { stu.conn.send({ t: "micAllow", on: false }); } catch {}
    }
  }
  spotlight(peerId, name) {     // tell everyone whose turn it is (shows banner)
    this.broadcast({ t: "spotlight", name });
  }

  _onData(conn, d) {
    const stu = this.students.get(conn.peer);
    if (!stu || !d || typeof d !== "object") return;
    switch (d.t) {
      case "chat": {
        this.stats.chats++;                                      // v3: analytics
        const text = String(d.text).slice(0, 1000);
        /* v5: private chat — student → teacher only (not relayed to class) */
        if (d.private) {
          this.onEvent("chat", { from: stu.name, text, private: true, peerId: conn.peer });
        } else {
          this.onEvent("chat", { from: stu.name, text });
          this.broadcast({ t: "chat", from: stu.name, text }, conn.peer);
        }
        break;
      }
      case "quizAnswer": {                                       // v3: quiz engine
        const q = this.activeQuiz;
        if (!q || q.answered.has(conn.peer)) break;
        const qi = q.index;
        if (Number(d.qIndex) !== qi) break;
        q.answered.add(conn.peer);
        const correct = Number(d.answer) === q.def.questions[qi].correct;
        if (correct) {
          // speed bonus: full 100 if instant, decays to 50 over the time limit
          const elapsed = (Date.now() - q.askedAt) / 1000;
          const frac = Math.min(1, elapsed / (q.def.secondsPerQ || 30));
          const pts = Math.round(100 - 50 * frac);
          stu.score = (stu.score || 0) + pts;
          q.scores.set(conn.peer, (q.scores.get(conn.peer) || 0) + pts);
        }
        q.tally[qi][Number(d.answer)] = (q.tally[qi][Number(d.answer)] || 0) + 1;
        conn.send({ t: "quizFeedback", correct, correctIndex: q.def.questions[qi].correct,
                    explanation: q.def.questions[qi].explanation || "" });   /* v6 */
        this.onEvent("quiz-progress", this.quizProgress());
        break;
      }
      case "hand":
        stu.hand = !!d.up;
        this.onEvent("hand", { peerId: conn.peer, name: stu.name, up: stu.hand });
        this._broadcastRoster();
        break;
      case "reaction": {  // v4: emoji reactions (👍 ❤ 😂 🎉 😮 👏)
        const emo = String(d.emoji).slice(0, 4);
        this.onEvent("reaction", { name: stu.name, emoji: emo });
        this.broadcast({ t: "reaction", name: stu.name, emoji: emo }, conn.peer);
        break;
      }
      case "pollAnswer":
        if (this.activePoll && !this.activePoll.voted.has(conn.peer)) {
          const i = Number(d.index);
          if (i >= 0 && i < this.activePoll.counts.length) {
            this.activePoll.counts[i]++;
            this.activePoll.voted.add(conn.peer);
            this.onEvent("poll-update", this.pollResults());
          }
        }
        break;
      case "ping":
        conn.send({ t: "pong", time: Date.now() });
        break;
      case "boardStrokes": {   /* v8: student whiteboard sync */
        if (!this.boardsOn) break;
        this.onEvent("board-strokes", { peerId: conn.peer, name: stu.name,
          strokes: d.strokes, full: !!d.full });
        break;
      }
      case "activityResp": {   /* v8: activity answer */
        if (!this.activity) break;
        this.activity.responses.set(conn.peer, { name: stu.name, resp: d.resp, at: Date.now() });
        this.onEvent("activity-resp", { name: stu.name, resp: d.resp, count: this.activity.responses.size });
        break;
      }
    }
  }

  _dropStudent(peerId) {
    const stu = this.students.get(peerId);
    if (!stu) return;
    /* v5 bug-fix: close lingering media calls (was a memory/connection leak) */
    for (const call of stu.mediaCalls) { try { call.close(); } catch {} }
    this.attendance.push({ name: stu.name, event: "left", time: nowStamp() });
    this.students.delete(peerId);
    this._broadcastRoster();
    this.onEvent("student-left", { peerId, name: stu.name });
  }

  _callStudent(peerId, stream, kind) {
    try {
      const call = this.peer.call(peerId, stream, { metadata: { kind } });
      const stu = this.students.get(peerId);
      if (stu) stu.mediaCalls.push(call);
    } catch (e) { console.warn("call failed", e); }
  }

  /* ----- broadcast helpers ----- */
  broadcast(msg, exceptPeer) {
    for (const [pid, stu] of this.students) {
      if (pid === exceptPeer) continue;
      try { stu.conn.send(msg); } catch {}
    }
  }
  _broadcastRoster() {
    const roster = Array.from(this.students.values()).map((s) => ({ name: s.name, hand: s.hand }));
    this.broadcast({ t: "roster", roster, count: roster.length });
    this.onEvent("roster", roster);
  }

  /* ----- stage / camera ----- */
  setStageStream(stream) {
    this.stageStream = stream;
    for (const pid of this.students.keys()) this._callStudent(pid, stream, "stage");
  }
  setCamStream(stream) {
    this.camStream = stream;
    if (stream) for (const pid of this.students.keys()) this._callStudent(pid, stream, "teachercam");
    else this.broadcast({ t: "teachercam-off" });
  }

  /* ----- classroom controls ----- */
  setLocked(v) { this.locked = v; }
  kick(peerId) {
    const stu = this.students.get(peerId);
    if (!stu) return;
    try { stu.conn.send({ t: "kicked" }); } catch {}
    setTimeout(() => { try { stu.conn.close(); } catch {} }, 300);
  }
  requestStudentCam(peerId, on) {
    const stu = this.students.get(peerId);
    if (stu) try { stu.conn.send({ t: "camRequest", on }); } catch {}
  }
  requestStudentScreen(peerId, on) {   // v5: ask a student to share their screen
    const stu = this.students.get(peerId);
    if (stu) try { stu.conn.send({ t: "screenRequest", on }); } catch {}
  }
  allowMic(peerId, on) {
    const stu = this.students.get(peerId);
    if (stu) try { stu.conn.send({ t: "micAllow", on }); } catch {}
  }
  sendAnnouncement(text) { this.broadcast({ t: "announce", text }); }
  sendChat(text) { this.broadcast({ t: "chat", from: "Teacher", text }); }
  sendChatTo(peerId, text) {   /* v5: private teacher → one student */
    const stu = this.students.get(peerId);
    if (stu) try { stu.conn.send({ t: "chat", from: "Teacher (private)", text, private: true }); } catch {}
  }

  /* ----- polls ----- */
  startPoll(question, options) {
    this.activePoll = {
      def: { question, options },
      counts: options.map(() => 0),
      voted: new Set()
    };
    this.broadcast({ t: "poll", poll: this.activePoll.def });
    this.onEvent("poll-update", this.pollResults());
  }
  endPoll() {
    if (!this.activePoll) return null;
    const res = this.pollResults();
    this.broadcast({ t: "pollEnd", results: res });
    this.activePoll = null;
    return res;
  }
  pollResults() {
    if (!this.activePoll) return null;
    return { question: this.activePoll.def.question, options: this.activePoll.def.options, counts: this.activePoll.counts.slice() };
  }

  /* ----- v8: individual student whiteboards (Whiteboard.fi style) ----- */
  startBoards(bgDataUrl) {
    this.boardsOn = true;
    this.broadcast({ t: "boards", on: true, bg: bgDataUrl || null });
  }
  pushBoardBg(bgDataUrl) {
    if (this.boardsOn) this.broadcast({ t: "boardsBg", bg: bgDataUrl });
  }
  stopBoards() {
    this.boardsOn = false;
    this.broadcast({ t: "boards", on: false });
  }

  /* ----- v8: activities (open question / word cloud / exit ticket) ----- */
  startActivity(def) {
    // def = { kind: "open"|"cloud"|"exit", prompt }
    this.activity = { def, responses: new Map() };
    this.broadcast({ t: "activity", def });
  }
  endActivity(showResults) {
    if (!this.activity) return null;
    const out = [...this.activity.responses.values()];
    if (showResults) this.broadcast({ t: "activityResults", kind: this.activity.def.kind,
      prompt: this.activity.def.prompt, items: out.map((r) => r.resp).slice(0, 80) });
    this.broadcast({ t: "activityEnd" });
    const a = this.activity; this.activity = null;
    return a;
  }

  /* ----- v8: behaviour points (ClassDojo style) ----- */
  awardPoint(peerId, category, delta, emoji) {
    const stu = this.students.get(peerId);
    if (!stu) return;
    if (!stu.behavior) stu.behavior = {};
    stu.behavior[category] = (stu.behavior[category] || 0) + delta;
    stu.behaviorTotal = (stu.behaviorTotal || 0) + delta;
    this.broadcast({ t: "award", name: stu.name, category, delta, emoji });
    this.onEvent("award", { peerId, name: stu.name, category, delta, total: stu.behaviorTotal });
  }
  behaviorCSV() {
    const cats = new Set();
    for (const s of this.students.values()) if (s.behavior) Object.keys(s.behavior).forEach((c) => cats.add(c));
    const cl = [...cats];
    const rows = [["Student", ...cl, "Total"]];
    for (const s of this.students.values()) {
      rows.push([s.name, ...cl.map((c) => (s.behavior && s.behavior[c]) || 0), s.behaviorTotal || 0]);
    }
    return rows.map((r) => r.map((c) => '"' + String(c).replace(/"/g, '""') + '"').join(",")).join("\n");
  }

  /* ----- v8: group maker ----- */
  makeGroups(n) {
    const ids = [...this.students.keys()];
    for (let i = ids.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1)); [ids[i], ids[j]] = [ids[j], ids[i]];
    }
    const groups = Array.from({ length: n }, () => []);
    ids.forEach((pid, i) => groups[i % n].push(pid));
    this.groups = groups.map((g, gi) => g.map((pid) => {
      const stu = this.students.get(pid);
      try { stu.conn.send({ t: "group", num: gi + 1, of: n }); } catch {}
      return stu.name;
    }));
    return this.groups;
  }

  /* ----- v3: quiz engine (auto-scored, with leaderboard) ----- */
  _quizPublicDef() {
    const q = this.activeQuiz;
    if (!q) return null;
    const cur = q.def.questions[q.index];
    return {
      title: q.def.title, index: q.index, total: q.def.questions.length,
      question: cur.q, options: cur.options, seconds: q.def.secondsPerQ || 30
    };
  }
  startQuiz(def) {
    // def = { title, secondsPerQ, questions: [{q, options[], correct}] }
    this.activeQuiz = {
      def, index: 0, askedAt: Date.now(),
      answered: new Set(), scores: new Map(),
      tally: def.questions.map(() => ({}))
    };
    this.broadcast({ t: "quiz", quiz: this._quizPublicDef() });
    this.onEvent("quiz-progress", this.quizProgress());
  }
  nextQuizQuestion() {
    const q = this.activeQuiz;
    if (!q) return false;
    if (q.index + 1 >= q.def.questions.length) return false;
    q.index++; q.askedAt = Date.now(); q.answered = new Set();
    this.broadcast({ t: "quiz", quiz: this._quizPublicDef() });
    this.onEvent("quiz-progress", this.quizProgress());
    return true;
  }
  endQuiz() {
    const q = this.activeQuiz;
    if (!q) return null;
    const board = this.leaderboard();
    this.broadcast({ t: "quizEnd", leaderboard: board.slice(0, 10) });
    this.stats.quizzes.push({ title: q.def.title, questions: q.def.questions.length, time: nowStamp(), top: board[0] ? board[0].name : "-" });
    this.activeQuiz = null;
    return board;
  }
  quizProgress() {
    const q = this.activeQuiz;
    if (!q) return null;
    return {
      title: q.def.title, index: q.index, total: q.def.questions.length,
      answered: q.answered.size, students: this.students.size,
      tally: q.tally[q.index], options: q.def.questions[q.index].options,
      correct: q.def.questions[q.index].correct
    };
  }
  leaderboard() {
    const rows = [];
    for (const [pid, stu] of this.students) rows.push({ name: stu.name, score: stu.score || 0 });
    rows.sort((a, b) => b.score - a.score);
    return rows;
  }
  resetScores() { for (const stu of this.students.values()) stu.score = 0; }

  /* ----- attendance ----- */
  attendanceCSV() {
    const rows = [["Name", "Event", "Time"], ...this.attendance.map((a) => [a.name, a.event, a.time])];
    return rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
  }

  end() {
    this.broadcast({ t: "classEnded" });
    setTimeout(() => { try { this.peer.destroy(); } catch {} }, 600);
  }
}

/* ============================================================
   STUDENT SIDE
   ============================================================ */
class StudentRoom {
  constructor(roomCode, name, opts = {}) {
    this.code = roomCode.toUpperCase().trim();
    this.name = name;
    this.pin = opts.pin || "";                       // v3: room PIN
    this.onEvent = opts.onEvent || (() => {});
    this.peer = null;
    this.conn = null;
    this.camCall = null;
    this.micCall = null;
    this._closedByUs = false;
  }

  join() {
    return new Promise((resolve, reject) => {
      this.peer = new Peer(PEER_CONFIG);
      let settled = false;
      this.peer.on("open", () => {
        this.conn = this.peer.connect(RTC_PREFIX + this.code + "-host", {
          reliable: true, metadata: { name: this.name, pin: this.pin }
        });
        const failT = setTimeout(() => {
          if (!settled) { settled = true; reject(new Error("Could not reach the class. Check the room code and that the teacher is live.")); }
        }, 15000);
        this.conn.on("open", () => { clearTimeout(failT); if (!settled) { settled = true; resolve(); } });
        this.conn.on("data", (d) => this._onData(d));
        this.conn.on("close", () => { if (!this._closedByUs) this.onEvent("disconnected"); });
      });
      this.peer.on("error", (err) => {
        if (err.type === "peer-unavailable" && !settled) {
          settled = true; reject(new Error("Class not found. The teacher may not be live yet."));
        }
      });
      // teacher calls us with stage / teacher cam
      this.peer.on("call", (call) => {
        const kind = (call.metadata && call.metadata.kind) || "stage";
        call.answer();
        call.on("stream", (stream) => this.onEvent("media", { kind, stream }));
        call.on("close", () => this.onEvent("media-end", { kind }));
      });
    });
  }

  _onData(d) {
    if (!d || typeof d !== "object") return;
    switch (d.t) {
      case "welcome":   this.onEvent("welcome", d); break;
      case "chat":      this.onEvent("chat", d); break;
      case "announce":  this.onEvent("announce", d); break;
      case "roster":    this.onEvent("roster", d); break;
      case "poll":      this.onEvent("poll", d.poll); break;
      case "pollEnd":   this.onEvent("pollEnd", d.results); break;
      case "quiz":      this.onEvent("quiz", d.quiz); break;            // v3
      case "quizFeedback": this.onEvent("quizFeedback", d); break;      // v3
      case "quizEnd":   this.onEvent("quizEnd", d.leaderboard); break;  // v3
      case "camRequest":this.onEvent("camRequest", d); break;
      case "screenRequest": this.onEvent("screenRequest", d); break;  // v5
      case "micAllow":  this.onEvent("micAllow", d); break;
      case "teachercam-off": this.onEvent("media-end", { kind: "teachercam" }); break;
      case "kicked":    this.onEvent("kicked"); break;
      case "rejected":  this.onEvent("rejected", d); break;
      case "classEnded":this.onEvent("classEnded"); break;
      case "waiting":   this.onEvent("waiting"); break;            // v4
      case "admitted":  this.onEvent("admitted"); break;           // v4
      case "reaction":  this.onEvent("reaction", d); break;        // v4
      case "spotlight": this.onEvent("spotlight", d); break;       // v4
      case "boards":    this.onEvent("boards", d); break;            // v8
      case "boardsBg":  this.onEvent("boardsBg", d); break;          // v8
      case "activity":  this.onEvent("activity", d.def); break;      // v8
      case "activityEnd": this.onEvent("activityEnd"); break;        // v8
      case "activityResults": this.onEvent("activityResults", d); break; // v8
      case "award":     this.onEvent("award", d); break;             // v8
      case "group":     this.onEvent("group", d); break;             // v8
    }
  }

  send(msg) { try { this.conn && this.conn.send(msg); } catch {} }
  sendChat(text)      { this.send({ t: "chat", text }); }
  raiseHand(up)       { this.send({ t: "hand", up }); }
  answerPoll(index)   { this.send({ t: "pollAnswer", index }); }
  answerQuiz(qIndex, answer) { this.send({ t: "quizAnswer", qIndex, answer }); } // v3
  sendReaction(emoji) { this.send({ t: "reaction", emoji }); }                   // v4
  sendBoardStrokes(strokes, full) { this.send({ t: "boardStrokes", strokes, full: !!full }); } // v8
  sendActivityResp(resp) { this.send({ t: "activityResp", resp }); }             // v8

  async shareCamera(on) {
    if (!on) {
      if (this.camCall) { try { this.camCall.close(); } catch {} this.camCall = null; }
      if (this._camStream) { this._camStream.getTracks().forEach((t) => t.stop()); this._camStream = null; }
      return null;
    }
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { width: { ideal: 480 }, frameRate: { ideal: 12 } }, audio: false
    });
    this._camStream = stream;
    this.camCall = this.peer.call(RTC_PREFIX + this.code + "-host", stream, { metadata: { kind: "stucam" } });
    return stream;
  }

  /* v5 (issue 1): student screen share — sent to the teacher as "stuscreen" */
  async shareScreen(on) {
    if (!on) {
      if (this.screenCall) { try { this.screenCall.close(); } catch {} this.screenCall = null; }
      if (this._screenStream) { this._screenStream.getTracks().forEach((t) => t.stop()); this._screenStream = null; }
      return null;
    }
    if (!navigator.mediaDevices.getDisplayMedia) throw new Error("Screen sharing is not supported on this browser.");
    const stream = await navigator.mediaDevices.getDisplayMedia({
      video: { frameRate: { ideal: 8 } }, audio: false
    });
    this._screenStream = stream;
    stream.getVideoTracks()[0].addEventListener("ended", () => {
      this.shareScreen(false);
      this.onEvent("screenEnded");
    });
    this.screenCall = this.peer.call(RTC_PREFIX + this.code + "-host", stream, { metadata: { kind: "stuscreen" } });
    return stream;
  }

  async shareMic(on) {
    if (!on) {
      if (this.micCall) { try { this.micCall.close(); } catch {} this.micCall = null; }
      if (this._micStream) { this._micStream.getTracks().forEach((t) => t.stop()); this._micStream = null; }
      return;
    }
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
    this._micStream = stream;
    this.micCall = this.peer.call(RTC_PREFIX + this.code + "-host", stream, { metadata: { kind: "stumic" } });
  }

  leave() {
    this._closedByUs = true;
    try { this.conn && this.conn.close(); } catch {}
    try { this.peer && this.peer.destroy(); } catch {}
  }
}
