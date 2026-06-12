/* ============================================================
   HMG ClassDeck — Student view controller
   Full-screen stage video (the teacher's split-screen),
   draggable teacher-cam PiP, hand raise, chat, polls,
   camera/mic sharing under teacher control.
   ============================================================ */
"use strict";

let sRoom = null;
let handUp = false;
let myCamOn = false, myMicOn = false, micAllowed = false;

const qs = new URLSearchParams(location.search);
if (qs.get("room")) $("#inRoom").value = qs.get("room").toUpperCase();
$("#inName").value = Store.get("stuname", "");

/* ---------- join flow ---------- */
$("#btnJoin").addEventListener("click", () => { lobbyOn ? stopLobby() : join(); });
$("#inName").addEventListener("keydown", (e) => { if (e.key === "Enter" && !lobbyOn) join(); });

async function join() {
  const code = $("#inRoom").value.trim().toUpperCase();
  const name = $("#inName").value.trim();
  if (code.length < 4) { $("#joinStatus").textContent = "Enter the room code your teacher shared."; return; }
  if (!name) { $("#joinStatus").textContent = "Please enter your name."; return; }
  Store.set("stuname", name);

  $("#btnJoin").disabled = true;
  $("#joinStatus").textContent = "Connecting to class…";

  sRoom = new StudentRoom(code, name, { onEvent: onEvent, pin: $("#inPin").value.trim() });
  try {
    await sRoom.join();
    enterStage();
  } catch (e) {
    /* v5 (issue 2): LOBBY — if the class is not live yet, wait politely and
       keep retrying until the teacher goes live. No more "join failed". */
    try { sRoom.leave(); } catch {}
    startLobby(code, name, e.message);
  }
}

/* ---------- v5: lobby (auto-join when teacher goes live) ---------- */
let lobbyTimer = null, lobbyOn = false;
function startLobby(code, name, why) {
  lobbyOn = true;
  $("#joinStatus").innerHTML = "🕐 <b>You're in the lobby.</b> " +
    (why && why.includes("PIN") ? escapeHtml(why) :
    "The class hasn't started yet — this page will join you automatically the moment your teacher goes live. Keep it open.");
  $("#btnJoin").textContent = "✕ Stop waiting";
  $("#btnJoin").disabled = false;
  window._wantWake = true; keepAwake(true);
  const tick = async () => {
    if (!lobbyOn) return;
    sRoom = new StudentRoom(code, name, { onEvent: onEvent, pin: $("#inPin").value.trim() });
    try {
      await sRoom.join();
      lobbyOn = false;
      restoreJoinButton();
      toast("🎉 Your teacher is live — joining now!", "ok");
      enterStage();
    } catch {
      try { sRoom.leave(); } catch {}
      lobbyTimer = setTimeout(tick, 8000);   // retry every 8 s
    }
  };
  lobbyTimer = setTimeout(tick, 4000);
}
function stopLobby() {
  lobbyOn = false;
  clearTimeout(lobbyTimer);
  restoreJoinButton();
  $("#joinStatus").textContent = "Stopped waiting. Tap Join class to try again.";
  window._wantWake = false; keepAwake(false);
}
function restoreJoinButton() {
  $("#btnJoin").textContent = "Join class ➜";
  $("#btnJoin").disabled = false;
}

function enterStage() {
  $("#joinGate").classList.add("hide");
  $("#stageWrap").classList.remove("hide");
  $("#stageStatus").classList.remove("hide");
  $("#stuControls").classList.remove("hidden");
  window._wantWake = true; keepAwake(true);
  scheduleControlsHide();
  // try fullscreen for the "laptop look"
  setTimeout(() => {
    document.documentElement.requestFullscreen().catch(() => {});
  }, 400);
}

/* ---------- room events ---------- */
function onEvent(type, p) {
  switch (type) {
    case "welcome":
      $("#roomNameChip").textContent = p.roomName || "";
      $("#countChip").textContent = "👥 " + (p.count || 1);
      toast("Joined! Waiting for the teacher's screen…", "ok");
      break;
    case "roster":
      $("#countChip").textContent = "👥 " + (p.count || 0);
      break;
    case "media":
      if (p.kind === "stage") attachStage(p.stream);
      else if (p.kind === "teachercam") attachTeacherCam(p.stream);
      break;
    case "media-end":
      if (p.kind === "teachercam") $("#teacherPip").classList.remove("show");
      break;
    case "chat":
      addMsg(p.from, p.text, p.from === Store.get("stuname", ""));
      break;
    case "announce":
      $("#announceText").textContent = p.text;
      openModal("#mAnnounce");
      break;
    case "poll": showPoll(p); break;
    case "pollEnd": showPollResults(p); break;
    case "quiz": showQuiz(p); break;                 // v3
    case "quizFeedback": showQuizFeedback(p); break; // v3
    case "quizEnd": showQuizLeaderboard(p); break;   // v3
    case "waiting":                                   // v4: waiting room
      $("#joinGate").classList.add("hide");
      openModal("#mWaiting");
      break;
    case "admitted":                                  // v4
      closeModal("#mWaiting");
      enterStage();
      toast("✅ Admitted — welcome to class!", "ok");
      break;
    case "reaction":                                  // v4
      sFlyEmoji(p.emoji, p.name);
      break;
    case "spotlight":                                 // v4
      toast("🌟 " + p.name + ", it's your turn!", "ok", 6000);
      break;
    case "camRequest": handleCamRequest(p.on); break;
    case "screenRequest":                              /* v5 */
      if (p.on && !myScreenOn) {
        if (confirm("Your teacher asks you to SHARE YOUR SCREEN (e.g. to show your work). Allow?")) toggleMyScreen();
      } else if (!p.on && myScreenOn) { toggleMyScreen(); }
      break;
    case "screenEnded":
      myScreenOn = false;
      $("#sBtnScreen").classList.remove("active");
      break;
    case "micAllow":
      micAllowed = p.on;
      $("#sBtnMic").disabled = !p.on;
      toast(p.on ? "🎙 Teacher allowed your mic — tap the mic button to speak" : "Mic permission removed", p.on ? "ok" : "", 5000);
      if (!p.on && myMicOn) toggleMyMic();
      break;
    case "kicked":
      cleanupAndGate("You were removed from the class by the teacher.");
      break;
    case "rejected":
      cleanupAndGate(p.reason || "The room is locked.");
      break;
    case "classEnded":
      cleanupAndGate("Class has ended. Thanks for attending! 🎓");
      break;
    case "disconnected":
      toast("Connection lost — trying to rejoin…", "err", 5000);
      attemptRejoin();
      break;
  }
}

/* ---------- stage / video ---------- */
let pendingStream = null;
function attachStage(stream) {
  const v = $("#stageVideo");
  v.srcObject = stream;
  v.play().catch(() => {
    pendingStream = stream;
    openModal("#mUnmute");
  });
}
$("#btnUnmute").addEventListener("click", () => {
  closeModal("#mUnmute");
  const v = $("#stageVideo");
  if (pendingStream) v.srcObject = pendingStream;
  v.muted = false;
  v.play().catch(() => {});
  $("#teacherVideo").play().catch(() => {});
});

function attachTeacherCam(stream) {
  const pip = $("#teacherPip");
  $("#teacherVideo").srcObject = stream;
  pip.classList.add("show");
}

/* draggable PiP */
(function makeDraggable() {
  const pip = $("#teacherPip");
  let sx = 0, sy = 0, ox = 0, oy = 0, drag = false;
  pip.addEventListener("pointerdown", (e) => {
    drag = true; pip.setPointerCapture(e.pointerId);
    sx = e.clientX; sy = e.clientY;
    const r = pip.getBoundingClientRect(); ox = r.left; oy = r.top;
  });
  pip.addEventListener("pointermove", (e) => {
    if (!drag) return;
    pip.style.left = Math.max(4, Math.min(window.innerWidth - pip.offsetWidth - 4, ox + e.clientX - sx)) + "px";
    pip.style.top  = Math.max(4, Math.min(window.innerHeight - pip.offsetHeight - 4, oy + e.clientY - sy)) + "px";
    pip.style.right = "auto";
  });
  pip.addEventListener("pointerup", () => { drag = false; });
})();

/* ---------- auto-hiding controls ---------- */
let hideT = null;
function scheduleControlsHide() {
  clearTimeout(hideT);
  $("#stuControls").classList.remove("hidden");
  hideT = setTimeout(() => $("#stuControls").classList.add("hidden"), 5000);
}
["pointerdown", "pointermove", "touchstart"].forEach((ev) =>
  document.addEventListener(ev, () => { if (sRoom) scheduleControlsHide(); }, { passive: true }));

/* ---------- controls ---------- */
$("#sBtnHand").addEventListener("click", () => {
  handUp = !handUp;
  sRoom.raiseHand(handUp);
  $("#sBtnHand").classList.toggle("active", handUp);
  toast(handUp ? "✋ Hand raised — the teacher can see it" : "Hand lowered");
});

/* v4: emoji reactions */
$("#sBtnReact").addEventListener("click", () => $("#reactBar").classList.toggle("hide"));
$$(".react-emo").forEach((b) => b.addEventListener("click", () => {
  sRoom.sendReaction(b.textContent.trim());
  sFlyEmoji(b.textContent.trim(), "You");
  $("#reactBar").classList.add("hide");
}));
function sFlyEmoji(emoji, name) {
  const el = document.createElement("div");
  el.style.cssText = "position:fixed;z-index:9998;font-size:34px;pointer-events:none;left:" +
    (12 + Math.random() * 70) + "%;bottom:90px;transition:all 2.6s ease-out;opacity:1";
  el.innerHTML = emoji + (name ? '<div style="font-size:11px;text-align:center;color:#fff;text-shadow:0 1px 3px #000">' + escapeHtml(name) + "</div>" : "");
  document.body.appendChild(el);
  requestAnimationFrame(() => { el.style.bottom = "75%"; el.style.opacity = "0"; });
  setTimeout(() => el.remove(), 2700);
}

$("#sBtnChat").addEventListener("click", () => $("#sDrawerChat").classList.toggle("open"));
$("#sChatClose").addEventListener("click", () => $("#sDrawerChat").classList.remove("open"));
function sendChat() {
  const inp = $("#sChatInput");
  const text = inp.value.trim();
  if (!text) return;
  inp.value = "";
  const priv = $("#sChatPriv").checked;       /* v5: private chat */
  sRoom.send({ t: "chat", text, private: priv });
  addMsg(priv ? "You → teacher (private)" : "You", text, true);
}
$("#sChatSend").addEventListener("click", sendChat);
$("#sChatInput").addEventListener("keydown", (e) => { if (e.key === "Enter") sendChat(); });

function addMsg(who, text, me) {
  const list = $("#sChatList");
  const div = document.createElement("div");
  div.className = "chat-msg" + (me ? " me" : "");
  div.innerHTML = `<div class="who">${escapeHtml(who)}</div>${escapeHtml(text)}`;
  list.appendChild(div);
  list.scrollTop = list.scrollHeight;
  if (!me && !$("#sDrawerChat").classList.contains("open"))
    toast("💬 " + who + ": " + text.slice(0, 60), "", 4000);
}

$("#sBtnCam").addEventListener("click", toggleMyCam);
async function toggleMyCam() {
  try {
    if (!myCamOn) {
      await sRoom.shareCamera(true);
      myCamOn = true;
      $("#sBtnCam").classList.add("active");
      toast("📷 Your camera is on — the teacher can see you", "ok");
    } else {
      await sRoom.shareCamera(false);
      myCamOn = false;
      $("#sBtnCam").classList.remove("active");
      toast("Camera off");
    }
  } catch { toast("Camera blocked. Allow camera in browser settings.", "err"); }
}

function handleCamRequest(on) {
  if (on && !myCamOn) {
    if (confirm("Your teacher is asking you to turn your camera ON. Allow?")) toggleMyCam();
  } else if (!on && myCamOn) {
    toggleMyCam();
    toast("Teacher turned your camera off");
  }
}

/* v5 (issue 1): student screen sharing — show your work to the teacher */
let myScreenOn = false;
$("#sBtnScreen").addEventListener("click", toggleMyScreen);
async function toggleMyScreen() {
  try {
    if (!myScreenOn) {
      await sRoom.shareScreen(true);
      myScreenOn = true;
      $("#sBtnScreen").classList.add("active");
      toast("🖥 You are sharing your screen with the teacher", "ok", 5000);
    } else {
      await sRoom.shareScreen(false);
      myScreenOn = false;
      $("#sBtnScreen").classList.remove("active");
      toast("Screen sharing stopped");
    }
  } catch (e) {
    toast(e.message || "Screen share blocked. On phones use Chrome/Edge; some browsers don't allow it.", "err", 6000);
  }
}

$("#sBtnMic").addEventListener("click", toggleMyMic);
async function toggleMyMic() {
  if (!micAllowed && !myMicOn) { toast("Raise your hand — the teacher must allow your mic first."); return; }
  try {
    if (!myMicOn) { await sRoom.shareMic(true); myMicOn = true; $("#sBtnMic").classList.add("active"); toast("🎙 You are speaking", "ok"); }
    else { await sRoom.shareMic(false); myMicOn = false; $("#sBtnMic").classList.remove("active"); toast("Mic off"); }
  } catch { toast("Mic blocked. Allow microphone in browser settings.", "err"); }
}

$("#sBtnFull").addEventListener("click", toggleFullscreen);
$("#sBtnLeave").addEventListener("click", () => {
  if (confirm("Leave the class?")) { sRoom.leave(); cleanupAndGate("You left the class."); }
});

/* ---------- polls ---------- */
function showPoll(poll) {
  $("#sPollQ").textContent = poll.question;
  const box = $("#sPollOpts");
  box.innerHTML = "";
  poll.options.forEach((o, i) => {
    const b = document.createElement("button");
    b.className = "btn";
    b.style.justifyContent = "flex-start";
    b.textContent = (i + 1) + ". " + o;
    b.addEventListener("click", () => {
      sRoom.answerPoll(i);
      closeModal("#mPoll");
      toast("Answer sent ✔", "ok");
    });
    box.appendChild(b);
  });
  openModal("#mPoll");
}
function showPollResults(res) {
  if (!res) return;
  const total = res.counts.reduce((a, b) => a + b, 0) || 1;
  $("#sPollQ").textContent = res.question + " — results";
  $("#sPollOpts").innerHTML = res.options.map((o, i) => `
    <div class="poll-opt"><div class="poll-bar">
      <i style="width:${Math.round((res.counts[i] / total) * 100)}%"></i>
      <b>${escapeHtml(o)} — ${res.counts[i]} (${Math.round((res.counts[i] / total) * 100)}%)</b>
    </div></div>`).join("");
  openModal("#mPoll");
  setTimeout(() => closeModal("#mPoll"), 7000);
}

/* ---------- v3: quizzes ---------- */
let quizTimerInt = null, quizAnsweredThis = false;
function showQuiz(q) {
  if (!q) return;
  quizAnsweredThis = false;
  $("#sQuizTitle").textContent = "🏆 " + (q.title || "Quiz");
  $("#sQuizPos").textContent = (q.index + 1) + " / " + q.total;
  $("#sQuizQ").textContent = q.question;
  $("#sQuizFb").classList.add("hide");
  const box = $("#sQuizOpts");
  box.innerHTML = "";
  q.options.forEach((o, i) => {
    const b = document.createElement("button");
    b.className = "btn";
    b.style.justifyContent = "flex-start";
    b.textContent = String.fromCharCode(65 + i) + ". " + o;
    b.addEventListener("click", () => {
      if (quizAnsweredThis) return;
      quizAnsweredThis = true;
      sRoom.answerQuiz(q.index, i);
      $$("#sQuizOpts .btn").forEach((x) => (x.disabled = true));
      b.classList.add("active");
    });
    box.appendChild(b);
  });
  // countdown display
  clearInterval(quizTimerInt);
  let left = q.seconds || 30;
  $("#sQuizTimer").textContent = "⏱ " + left + "s";
  quizTimerInt = setInterval(() => {
    left--;
    $("#sQuizTimer").textContent = left > 0 ? "⏱ " + left + "s" : "⏱ time!";
    if (left <= 0) { clearInterval(quizTimerInt); $$("#sQuizOpts .btn").forEach((x) => (x.disabled = true)); }
  }, 1000);
  openModal("#mQuiz");
}
function showQuizFeedback(d) {
  const fb = $("#sQuizFb");
  fb.classList.remove("hide");
  let html;
  if (d.correct) { html = "✅ Correct! Points added."; fb.style.color = "var(--ok)"; }
  else {
    const letter = String.fromCharCode(65 + Number(d.correctIndex));
    html = "❌ Not quite — the answer was " + letter + ".";
    fb.style.color = "var(--danger)";
  }
  fb.innerHTML = escapeHtml(html) +
    (d.explanation ? '<div style="font-weight:400;font-size:13px;color:var(--text-dim);margin-top:6px">💡 ' + escapeHtml(d.explanation) + "</div>" : "");
}
function showQuizLeaderboard(rows) {
  clearInterval(quizTimerInt);
  $("#sQuizTitle").textContent = "🏆 Quiz results";
  $("#sQuizTimer").textContent = "";
  $("#sQuizQ").textContent = "Top scores:";
  $("#sQuizFb").classList.add("hide");
  $("#sQuizOpts").innerHTML = (rows || []).map((r, i) =>
    `<div class="chat-msg"><b>${i + 1}.</b> ${escapeHtml(r.name)} — <b>${r.score} pts</b></div>`).join("") ||
    "<p>No scores.</p>";
  openModal("#mQuiz");
  setTimeout(() => closeModal("#mQuiz"), 9000);
}

/* ---------- reconnect / cleanup ----------
   v5 (issue 3): PROFESSIONAL RECONNECT. If the teacher's connection drops
   (left the app, network blip, tablet restart), students stay on the stage
   with a "reconnecting" banner and silently retry for up to 10 MINUTES.
   The moment the teacher is back live (same room code), everyone is
   reconnected automatically — nobody has to rejoin manually. */
let rejoinTries = 0;
const REJOIN_MAX_TRIES = 75;            // ~10 min with capped backoff
let rejoinBanner = null;
function showRejoinBanner() {
  if (rejoinBanner) return;
  rejoinBanner = document.createElement("div");
  rejoinBanner.style.cssText = "position:fixed;top:0;left:0;right:0;z-index:9000;background:#b7791f;color:#fff;text-align:center;padding:8px;font-size:14px;font-weight:600";
  rejoinBanner.textContent = "📡 Connection to the teacher lost — reconnecting automatically… stay on this page";
  document.body.appendChild(rejoinBanner);
}
function hideRejoinBanner() { if (rejoinBanner) { rejoinBanner.remove(); rejoinBanner = null; } }

async function attemptRejoin() {
  if (rejoinTries >= REJOIN_MAX_TRIES) {
    hideRejoinBanner();
    cleanupAndGate("Could not reconnect after several minutes. Tap Join class to try again.");
    return;
  }
  rejoinTries++;
  showRejoinBanner();
  const code = $("#inRoom").value.trim().toUpperCase();
  const name = Store.get("stuname", "Student");
  await new Promise((r) => setTimeout(r, Math.min(8000, 2000 + rejoinTries * 500)));
  try {
    try { sRoom && sRoom.leave(); } catch {}
    sRoom = new StudentRoom(code, name, { onEvent: onEvent, pin: $("#inPin").value.trim() });
    await sRoom.join();
    rejoinTries = 0;
    hideRejoinBanner();
    toast("✅ Reconnected to the class!", "ok");
  } catch { attemptRejoin(); }
}

function cleanupAndGate(message) {
  try { sRoom && sRoom.leave(); } catch {}
  $("#stageWrap").classList.add("hide");
  $("#stageStatus").classList.add("hide");
  $("#stuControls").classList.add("hidden");
  $("#teacherPip").classList.remove("show");
  $("#sDrawerChat").classList.remove("open");
  $("#joinGate").classList.remove("hide");
  $("#btnJoin").disabled = false;
  $("#joinStatus").textContent = message;
  window._wantWake = false; keepAwake(false);
  if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
}
