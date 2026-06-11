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
$("#btnJoin").addEventListener("click", join);
$("#inName").addEventListener("keydown", (e) => { if (e.key === "Enter") join(); });

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
    $("#joinStatus").textContent = "❌ " + e.message;
    $("#btnJoin").disabled = false;
  }
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
    case "camRequest": handleCamRequest(p.on); break;
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

$("#sBtnChat").addEventListener("click", () => $("#sDrawerChat").classList.toggle("open"));
$("#sChatClose").addEventListener("click", () => $("#sDrawerChat").classList.remove("open"));
function sendChat() {
  const inp = $("#sChatInput");
  const text = inp.value.trim();
  if (!text) return;
  inp.value = "";
  sRoom.sendChat(text);
  addMsg("You", text, true);
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
  if (d.correct) { fb.textContent = "✅ Correct! Points added."; fb.style.color = "var(--ok)"; }
  else {
    const letter = String.fromCharCode(65 + Number(d.correctIndex));
    fb.textContent = "❌ Not quite — the answer was " + letter + ".";
    fb.style.color = "var(--danger)";
  }
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

/* ---------- reconnect / cleanup ---------- */
let rejoinTries = 0;
async function attemptRejoin() {
  if (rejoinTries >= 4) { cleanupAndGate("Could not reconnect. Tap Join to try again."); return; }
  rejoinTries++;
  const code = $("#inRoom").value.trim().toUpperCase();
  const name = Store.get("stuname", "Student");
  await new Promise((r) => setTimeout(r, 2500 * rejoinTries));
  try {
    sRoom = new StudentRoom(code, name, { onEvent: onEvent, pin: $("#inPin").value.trim() });
    await sRoom.join();
    rejoinTries = 0;
    toast("Reconnected ✔", "ok");
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
