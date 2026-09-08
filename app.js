/* ============================================================
   SIDEKICK — app.js
   Vanilla JS PWA. No build step, no frameworks.
   ============================================================ */
(function(){
"use strict";

const STORAGE_KEY = "sidekick.v1";
const DATA_URL = "data/knowledge_base.json";

const CATEGORY_COLOR_VARS = {
  "Foundation":"--cat-foundation","Communication & Engagement":"--cat-com","Basic Skills":"--cat-basic",
  "Life Skills":"--cat-life","Calmness & Regulation":"--cat-calm","Walking":"--cat-walk","Recall":"--cat-recall",
  "Socialisation":"--cat-social","Handling & Cooperative Care":"--cat-care","Home Manners":"--cat-home",
  "Alone Time":"--cat-alone","Barking":"--cat-bark","Chewing & Destruction":"--cat-chew",
  "Resource Guarding":"--cat-guard","Chasing & Predatory Behaviour":"--cat-chase","Reactivity":"--cat-react",
  "Enrichment":"--cat-enrich","Tricks & Games":"--cat-tricks","Owner Skills":"--cat-owner",
  "Assessment":"--cat-assess","Safety & Referral":"--cat-safety","Advanced / Real World":"--cat-advanced",
  "Troubleshooting":"--cat-trouble","Behaviour Assessment":"--cat-assess","Mouthing & Bite Inhibition":"--cat-mouth"
};
// Categories genuinely worth a completion certificate -- deliberately excludes
// the diagnostic/reference categories (Assessment, Safety & Referral,
// Behaviour Assessment, Troubleshooting), since finishing those represents
// working through reference material, not a trained skill.
const CERTIFICATE_CATEGORIES = [
  "Foundation","Communication & Engagement","Basic Skills","Life Skills",
  "Calmness & Regulation","Walking","Recall","Socialisation",
  "Handling & Cooperative Care","Home Manners","Alone Time","Barking",
  "Chewing & Destruction","Resource Guarding","Chasing & Predatory Behaviour",
  "Reactivity","Enrichment","Tricks & Games","Owner Skills",
  "Advanced / Real World","Mouthing & Bite Inhibition",
];
const CATEGORY_ICON = {
  "Foundation":"🌱","Communication & Engagement":"👀","Basic Skills":"🐾","Life Skills":"🏠",
  "Calmness & Regulation":"🧘","Walking":"🚶","Recall":"📣","Socialisation":"🐕‍🦺",
  "Handling & Cooperative Care":"🩺","Home Manners":"🛋️","Alone Time":"🚪","Barking":"🔊",
  "Chewing & Destruction":"🦴","Resource Guarding":"🍖","Chasing & Predatory Behaviour":"🏃",
  "Reactivity":"⚡","Enrichment":"🧩","Tricks & Games":"🎉","Owner Skills":"🧑‍🏫",
  "Assessment":"📋","Safety & Referral":"🚨","Advanced / Real World":"🌍","Troubleshooting":"🔧",
  "Behaviour Assessment":"📋","Mouthing & Bite Inhibition":"🦷"
};
const SKILL_STATES = ["Acquiring","Developing","Reliable","Generalising","Life-ready"];
const STATE_COLOR = {"Acquiring":"var(--ink-soft)","Developing":"var(--sky)","Reliable":"var(--ochre)","Generalising":"var(--forest)","Life-ready":"var(--forest-dark)"};
const ADAPTIVE_FEEDBACK = ["too easy","about right","difficult","too difficult"];
const FEEDBACK_DISPLAY = {
  "too easy": "😄 Easy",
  "about right": "🙂 Just right",
  "difficult": "😐 Difficult",
  "too difficult": "😣 Too difficult"
};
const AVATAR_COLORS = ["#2F5233","#3E6E82","#C08A2B","#6B4E9A","#B23A2E","#4E7A8C","#8A6D3A"];
const DOG_EMOJI = ["🐕","🐶","🐩","🦮","🐕‍🦺"];
// A curated subset of existing Enrichment / Tricks & Games lessons, presented
// as a browsable "Games" grid -- not new content, just a more playful way
// into lessons that already exist. Each opens straight into its real lesson
// detail page (steps, safety notes, etc. all already there).
const GAMES_LIST = [
  {lessonId:"ENR-006", emoji:"🧩"},
  {lessonId:"ENR-005", emoji:"📦"},
  {lessonId:"ENR-014", emoji:"🙈"},
  {lessonId:"ENR-015", emoji:"🗺️"},
  {lessonId:"TRK-018", emoji:"🔍"},
  {lessonId:"TRK-019", emoji:"🥤"},
  {lessonId:"TRK-020", emoji:"✊"},
  {lessonId:"TRK-021", emoji:"🚶"},
  {lessonId:"TRK-022", emoji:"🏃"},
  {lessonId:"TRK-023", emoji:"🏓"},
  {lessonId:"TRK-024", emoji:"🚦"},
  {lessonId:"TRK-025", emoji:"🏷️"},
  {lessonId:"TRK-026", emoji:"🕵️"},
];
const AGE_STAGES = ["Puppy","Adolescent","Adult","Senior"];
const GENDERS = ["Male","Female","Unknown"];

/* ---------------- State ---------------- */
let KB = null;          // raw knowledge base
let IDX = null;         // indexed lookups
let DB = null;          // user data (persisted)
let currentScreen = "home";
let currentDogId = null;
let lessonFilter = { category:"All", query:"", difficulty:"All" };
let activeSession = null; // {lessonId, reps:[], startedAt}
let activeProgramme = null; // {programmeId, lessons:[], index, blockResults:[]}

/* ---------------- Storage ---------------- */
function loadDB(){
  try{
    const raw = localStorage.getItem(STORAGE_KEY);
    if(raw){
      const parsed = JSON.parse(raw);
      if(!parsed.favourites) parsed.favourites = []; // added after initial release — default for existing saves
      if(!parsed.lessonNotes) parsed.lessonNotes = {}; // added after initial release — default for existing saves
      if(!parsed.weightLogs) parsed.weightLogs = []; // added after initial release — default for existing saves
      return parsed;
    }
  }catch(e){ console.error("Sidekick: failed to parse local data, starting fresh.", e); }
  return { dogs:[], activeDogId:null, sessions:[], skillStates:{}, lessonProgress:{}, settings:{}, favourites:[], lessonNotes:{}, weightLogs:[] };
}
function getWeightLogs(dogId){
  return DB.weightLogs.filter(w=>w.dogId===dogId).sort((a,b)=>new Date(a.date)-new Date(b.date));
}
function addWeightEntry(dogId, date, weight, unit){
  DB.weightLogs.push({ id: uid(), dogId, date, weight: Number(weight), unit: unit||"kg" });
  saveDB();
}
function deleteWeightEntry(id){
  DB.weightLogs = DB.weightLogs.filter(w=>w.id!==id);
  saveDB();
}
function applyTheme(theme){
  document.body.dataset.theme = theme; // "light" | "dark" | "auto" — CSS handles all three
  const btn = document.getElementById("topbarThemeToggle");
  if(btn){
    const isDark = theme === "dark" || (theme === "auto" && window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches);
    btn.textContent = isDark ? "☀️" : "🌙";
    btn.setAttribute("aria-label", isDark ? "Switch to light mode" : "Switch to dark mode");
    btn.title = isDark ? "Switch to light mode" : "Switch to dark mode";
  }
}
function setTheme(theme){
  if(!DB.settings) DB.settings = {};
  DB.settings.theme = theme;
  saveDB();
  applyTheme(theme);
}
// Voice list loads asynchronously in some browsers (empty on the very first
// call until the browser actually finishes enumerating system voices), so
// this is exposed as a function to call fresh each time rather than cached
// once at startup.
function getAvailableVoices(){
  if(!("speechSynthesis" in window)) return [];
  return window.speechSynthesis.getVoices();
}
function getSelectedVoiceURI(){
  return (DB.settings && DB.settings.voiceURI) || "";
}
function setSelectedVoiceURI(uri){
  if(!DB.settings) DB.settings = {};
  DB.settings.voiceURI = uri;
  saveDB();
}
function isVoiceEnabled(){
  return !!(DB.settings && DB.settings.voiceGuidance);
}
function setVoiceEnabled(on){
  if(!DB.settings) DB.settings = {};
  DB.settings.voiceGuidance = on;
  saveDB();
}
function isSilentModeBypassEnabled(){
  return !!(DB.settings && DB.settings.silentModeBypass);
}
// This is a best-effort, opt-in workaround for an undocumented iOS Safari
// behaviour, not a guaranteed fix -- see the comment on the audio element
// itself in index.html for the full explanation. Starting/stopping this
// element must happen inside a real user-gesture handler (a click), the
// same constraint the Web Audio API itself has.
function setSilentModeBypassEnabled(on){
  if(!DB.settings) DB.settings = {};
  DB.settings.silentModeBypass = on;
  saveDB();
  const el = document.getElementById("silentModeUnlockAudio");
  if(!el) return;
  if(on){
    el.volume = 1; // the WAV content itself is already near-silent
    el.play().catch(()=>{}); // ignored: will retry on the next real click if this one wasn't a gesture
  }else{
    el.pause();
  }
}
function getQuietHours(){
  const s = DB.settings || {};
  return {
    enabled: !!s.quietHoursEnabled,
    start: s.quietHoursStart || "21:00",
    end: s.quietHoursEnd || "07:00",
  };
}
function setQuietHours(enabled, start, end){
  if(!DB.settings) DB.settings = {};
  DB.settings.quietHoursEnabled = enabled;
  if(start) DB.settings.quietHoursStart = start;
  if(end) DB.settings.quietHoursEnd = end;
  saveDB();
}
// Handles the overnight case (e.g. 21:00-07:00 spans midnight) as well as a
// same-day window (e.g. 13:00-14:00) with the same comparison.
function isWithinQuietHours(){
  const q = getQuietHours();
  if(!q.enabled) return false;
  const now = new Date();
  const mins = now.getHours()*60 + now.getMinutes();
  const [sh,sm] = q.start.split(":").map(Number);
  const [eh,em] = q.end.split(":").map(Number);
  const startMins = sh*60+sm, endMins = eh*60+em;
  if(startMins === endMins) return false; // a zero-length window means "never"
  if(startMins < endMins) return mins >= startMins && mins < endMins;
  return mins >= startMins || mins < endMins; // overnight wrap
}
// Speaks a short phrase aloud during a session, for the exact moment hands
// are full (treat, lead) and eyes are on the dog, not the phone. Silently
// does nothing if the setting is off, quiet hours are active, or the browser
// has no speech support — this is a convenience layer, never something the
// app depends on.
function speak(text){
  if(!isVoiceEnabled()) return;
  if(isWithinQuietHours()) return;
  if(!("speechSynthesis" in window)) return;
  try{
    window.speechSynthesis.cancel(); // don't let phrases queue up and lag behind real reps
    const u = new SpeechSynthesisUtterance(text);
    u.rate = 1.05;
    u.volume = 1;
    // Isolated deliberately: if the stored voice preference no longer matches
    // an available voice, or assigning it fails for any browser-specific
    // reason, the utterance must still be spoken with the default voice --
    // not dropped silently, which would defeat the entire point of this
    // being a reliability feature for hands-full moments.
    try{
      const wantedURI = getSelectedVoiceURI();
      if(wantedURI){
        const match = getAvailableVoices().find(v=>v.voiceURI === wantedURI);
        if(match) u.voice = match;
      }
    }catch(e){ /* falls back to the default voice */ }
    window.speechSynthesis.speak(u);
  }catch(e){ /* speech is a nice-to-have, never worth surfacing an error for */ }
}

let sharedAudioCtx = null;
// Synthesises a short, sharp "click" -- there's no bundled audio file, so this
// builds the sound from scratch with the Web Audio API: a very brief burst of
// filtered noise (the "snap") layered under a short high tone (the "click"
// pitch a real box clicker has), both with a near-instant decay envelope.
function playClickSound(){
  try{
    if(isSilentModeBypassEnabled()){
      const unlockEl = document.getElementById("silentModeUnlockAudio");
      if(unlockEl && unlockEl.paused) unlockEl.play().catch(()=>{});
    }
    if(!sharedAudioCtx){
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if(!Ctx) return;
      sharedAudioCtx = new Ctx();
    }
    const ctx = sharedAudioCtx;
    // A freshly-created or previously-suspended context must actually finish
    // resuming before its clock runs and its graph processes anything -- an
    // AudioContext does not advance currentTime, or play anything scheduled
    // against it, while suspended. Scheduling before resume() resolves is
    // exactly what was silently dropping the sound.
    if(ctx.state === "suspended"){
      ctx.resume().then(()=>scheduleClickSound(ctx)).catch(()=>{});
    }else{
      scheduleClickSound(ctx);
    }
  }catch(e){ /* clicker sound is a nice-to-have, never worth surfacing an error for */ }
}
function scheduleClickSound(ctx){
  const now = ctx.currentTime; // captured only once we know the context is actually running

  // Noise burst: a short buffer of random samples run through a highpass
  // filter, giving the sharp "snap" transient rather than a dull thud.
  const bufferLen = Math.floor(ctx.sampleRate * 0.03);
  const buffer = ctx.createBuffer(1, bufferLen, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for(let i=0;i<bufferLen;i++) data[i] = (Math.random()*2-1) * (1 - i/bufferLen);
  const noise = ctx.createBufferSource();
  noise.buffer = buffer;
  const filter = ctx.createBiquadFilter();
  filter.type = "highpass";
  filter.frequency.value = 2500;
  const noiseGain = ctx.createGain();
  noiseGain.gain.setValueAtTime(1, now);
  noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.045);
  noise.connect(filter);
  filter.connect(noiseGain);
  noiseGain.connect(ctx.destination);
  noise.start(now);
  noise.stop(now + 0.045);

  // Tone layer: a very short, fast-decaying high tone for the "click" pitch.
  const osc = ctx.createOscillator();
  osc.type = "square";
  osc.frequency.setValueAtTime(3200, now);
  const oscGain = ctx.createGain();
  oscGain.gain.setValueAtTime(0.35, now);
  oscGain.gain.exponentialRampToValueAtTime(0.001, now + 0.03);
  osc.connect(oscGain);
  oscGain.connect(ctx.destination);
  osc.start(now);
  osc.stop(now + 0.03);
}
function saveDB(){
  try{
    localStorage.setItem(STORAGE_KEY, JSON.stringify(DB));
  }catch(e){
    console.error("Sidekick: save failed", e);
    if(e && e.name === "QuotaExceededError"){
      showToast("Storage full — try exporting & clearing old sessions in More → Data.");
    }else{
      showToast("Couldn't save — storage may be unavailable.");
    }
  }
}

/* ---------------- Data loading & indexing ---------------- */
async function loadKnowledgeBase(){
  const res = await fetch(DATA_URL);
  if(!res.ok) throw new Error("Failed to load knowledge base: " + res.status);
  KB = await res.json();
  buildIndex();
}
function splitPipe(str){
  if(!str) return [];
  return String(str).split("|").map(s=>s.trim()).filter(Boolean);
}
function splitSemi(str){
  if(!str) return [];
  return String(str).split(/[;|]/).map(s=>s.trim()).filter(Boolean);
}
function buildIndex(){
  const c = KB.collections;
  IDX = {
    lessonsById: new Map(c.lessons.map(l=>[l.lesson_id,l])),
    skillsById: new Map(c.skills.map(s=>[s.skill_id,s])),
    behavioursById: new Map(c.behaviours.map(b=>[b.behaviour_id,b])),
    safetyGatesById: new Map(c.safety_gates.map(g=>[g.safety_gate_id,g])),
    sourcesById: new Map(c.evidence_sources.map(s=>[s.source_id||s.evidence_source_id||s.id, s])),
    protocolsById: new Map(c.protocols.map(p=>[p.protocol_id,p])),
    programmesById: new Map(c.daily_programmes.map(p=>[p.programme_id,p])),
    categories: [],
    linksByFrom: new Map(),
  };
  // categories in stable order of first appearance
  const seen = new Set();
  c.lessons.forEach(l=>{ if(!seen.has(l.category)){ seen.add(l.category); IDX.categories.push(l.category); } });
  // lesson links adjacency
  c.lesson_links.forEach(link=>{
    if(!IDX.linksByFrom.has(link.from_id)) IDX.linksByFrom.set(link.from_id, []);
    IDX.linksByFrom.get(link.from_id).push(link);
  });
  // fix source id key fallback (schema uses source_id)
  IDX.sourcesById = new Map(c.evidence_sources.map(s=>[s.source_id, s]));
}

function getCategoryVar(cat){ return CATEGORY_COLOR_VARS[cat] || "--ink-soft"; }
function getCategoryIcon(cat){ return CATEGORY_ICON[cat] || "📘"; }

/* ---------------- Dog helpers ---------------- */
function getCurrentDog(){
  return DB.dogs.find(d=>d.id===currentDogId) || null;
}
function ensureCurrentDog(){
  if(DB.activeDogId && DB.dogs.some(d=>d.id===DB.activeDogId)){
    currentDogId = DB.activeDogId;
  }else if(DB.dogs.length){
    currentDogId = DB.dogs[0].id;
    DB.activeDogId = currentDogId;
  }else{
    currentDogId = null;
  }
}
function dogSkillState(dogId, skillId){
  return (DB.skillStates[dogId] && DB.skillStates[dogId][skillId]) || "Acquiring";
}
function setDogSkillState(dogId, skillId, state){
  if(!DB.skillStates[dogId]) DB.skillStates[dogId] = {};
  DB.skillStates[dogId][skillId] = state;
  saveDB();
}
function dogLessonProgress(dogId, lessonId){
  return (DB.lessonProgress[dogId] && DB.lessonProgress[dogId][lessonId]) || null;
}
function isFavourite(lessonId){
  return DB.favourites.includes(lessonId);
}
function toggleFavourite(lessonId){
  if(!DB.favourites) DB.favourites = [];
  const idx = DB.favourites.indexOf(lessonId);
  if(idx===-1) DB.favourites.push(lessonId);
  else DB.favourites.splice(idx,1);
  saveDB();
  return idx===-1; // true if it's now favourited
}
function getLessonNote(dogId, lessonId){
  return (DB.lessonNotes[dogId] && DB.lessonNotes[dogId][lessonId]) || "";
}
function setLessonNote(dogId, lessonId, text){
  if(!DB.lessonNotes[dogId]) DB.lessonNotes[dogId] = {};
  if(text && text.trim()){
    DB.lessonNotes[dogId][lessonId] = text.trim();
  }else{
    delete DB.lessonNotes[dogId][lessonId];
  }
  saveDB();
}

/* ---------------- Utility ---------------- */
function uid(){ return Date.now().toString(36)+Math.random().toString(36).slice(2,8); }
function logoLockupHTML(maxWidth){
  const w = maxWidth || 180;
  return `<img src="images/logo-lockup-light.png" alt="Sidekick" class="logo-lockup-light" style="max-width:${w}px; width:100%; height:auto;">
    <img src="images/logo-lockup-dark.png" alt="Sidekick" class="logo-lockup-dark" style="max-width:${w}px; width:100%; height:auto;">`;
}
function esc(str){
  if(str===undefined||str===null) return "";
  return String(str).replace(/[&<>"']/g, m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[m]));
}
function fmtDate(iso){
  const d = new Date(iso);
  return d.toLocaleDateString(undefined,{month:"short",day:"numeric"});
}
function daysAgo(iso){
  const diff = Date.now() - new Date(iso).getTime();
  return Math.floor(diff/86400000);
}
function showToast(msg){
  const t = document.getElementById("toast");
  t.textContent = msg;
  t.classList.add("show");
  clearTimeout(showToast._t);
  showToast._t = setTimeout(()=>t.classList.remove("show"), 2200);
}
let modalReturnFocus = null;
function getFocusable(container){
  return Array.from(container.querySelectorAll(
    'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
  ));
}
function openModal(html){
  modalReturnFocus = document.activeElement;
  const sheet = document.getElementById("modalSheet");
  sheet.innerHTML = '<div class="handle"></div><button type="button" class="modal-close" aria-label="Close">&times;</button>' + html;
  document.getElementById("modalOverlay").classList.add("active");
  sheet.querySelector(".modal-close").addEventListener("click", closeModal);
  // Move focus into the dialog so screen readers announce it and keyboard
  // users don't stay stranded on whatever triggered it.
  const focusable = getFocusable(sheet);
  (focusable[0] || sheet).focus();
}
function closeModal(){
  document.getElementById("modalOverlay").classList.remove("active");
  if(modalReturnFocus && typeof modalReturnFocus.focus === "function"){
    modalReturnFocus.focus();
  }
  modalReturnFocus = null;
}
document.addEventListener("click", (e)=>{
  if(e.target.id === "modalOverlay") closeModal();
});
document.addEventListener("keydown", (e)=>{
  const overlay = document.getElementById("modalOverlay");
  if(!overlay.classList.contains("active")) return;
  if(e.key === "Escape"){ closeModal(); return; }
  if(e.key !== "Tab") return;
  // Basic focus trap: keep Tab cycling within the dialog while it's open.
  const sheet = document.getElementById("modalSheet");
  const focusable = getFocusable(sheet);
  if(!focusable.length) return;
  const first = focusable[0], last = focusable[focusable.length-1];
  if(e.shiftKey && document.activeElement === first){ e.preventDefault(); last.focus(); }
  else if(!e.shiftKey && document.activeElement === last){ e.preventDefault(); first.focus(); }
});

/* ---------------- Router ---------------- */
const SCREEN_RENDERERS = {}; // filled in by other sections: name -> function(container)
const TAB_SCREENS = ["home","lessons","behaviours","skills","more","about","progress"];
// Baseline topbar content per screen, applied before the renderer runs.
// This exists so a screen can never show another screen's leftover title —
// a real bug: onboarding never called setTopbar, so reaching it via Reset
// or "remove last dog" left whatever title the previous screen had set.
// Renderers that need dynamic content (e.g. Home's "Hey Bramble!") still
// override this immediately after.
const SCREEN_TOPBAR_DEFAULTS = {
  onboarding: ["Sidekick", "Let's get set up"],
  home: ["Sidekick", "Reward-based training"],
  lessons: ["Train", "Lessons, skills & programmes"],
  behaviours: ["Behaviour guide", "Find management & training routes"],
  skills: ["Skills", ""],
  more: ["Profile", "Dog, safety & data"],
  about: ["About", "Sidekick"],
  progress: ["Progress", "Your training history"],
};

function setTabbarVisible(visible){
  document.getElementById("tabbar").style.display = visible ? "flex" : "none";
}

function goScreen(name, opts){
  opts = opts || {};
  currentScreen = name;
  document.querySelectorAll(".tab").forEach(t=>{
    const isActive = t.dataset.screen===name;
    t.classList.toggle("active", isActive);
    if(isActive) t.setAttribute("aria-current","page"); else t.removeAttribute("aria-current");
  });
  setTabbarVisible(TAB_SCREENS.includes(name));
  const fallback = SCREEN_TOPBAR_DEFAULTS[name];
  if(fallback) window.__sk.setTopbar(fallback[0], fallback[1], "");
  render(opts);
  window.scrollTo(0,0);
}
function render(opts){
  const container = document.getElementById("screens");
  const fn = SCREEN_RENDERERS[currentScreen];
  container.innerHTML = "";
  const div = document.createElement("div");
  div.className = "screen active";
  container.appendChild(div);
  if(fn) fn(div, opts||{});
  else div.innerHTML = '<div class="empty-state"><span class="glyph">🚧</span>Coming soon.</div>';
}

document.addEventListener("DOMContentLoaded", ()=>{
  document.querySelectorAll(".tab").forEach(tab=>{
    tab.addEventListener("click", ()=>goScreen(tab.dataset.screen));
  });
  document.getElementById("topbarLogo").addEventListener("click", ()=>{
    if(window.__sk.currentScreen === "onboarding") return; // avoid wiping a half-filled form
    goScreen("home");
  });
  document.getElementById("topbarLogoFull").addEventListener("click", ()=>{
    if(window.__sk.currentScreen === "onboarding") return;
    goScreen("home");
  });
});

/* expose small internal API for other IIFE-scoped sections appended below */
window.__sk = {
  get KB(){return KB;}, get IDX(){return IDX;}, get DB(){return DB;},
  set DB(v){DB=v;},
  get currentDogId(){return currentDogId;}, setCurrentDogId(v){currentDogId=v; DB.activeDogId=v; saveDB();},
  get currentScreen(){return currentScreen;},
  get lessonFilter(){return lessonFilter;},
  get activeSession(){return activeSession;}, setActiveSession(v){activeSession=v;},
  get activeProgramme(){return activeProgramme;}, setActiveProgramme(v){activeProgramme=v;},
  CATEGORY_COLOR_VARS, CATEGORY_ICON, SKILL_STATES, STATE_COLOR, ADAPTIVE_FEEDBACK, FEEDBACK_DISPLAY,
  AVATAR_COLORS, DOG_EMOJI, AGE_STAGES, GENDERS, GAMES_LIST, CERTIFICATE_CATEGORIES,
  splitPipe, splitSemi, getCategoryVar, getCategoryIcon,
  getCurrentDog, ensureCurrentDog, dogSkillState, setDogSkillState, dogLessonProgress,
  isFavourite, toggleFavourite, getLessonNote, setLessonNote,
  uid, esc, fmtDate, daysAgo, showToast, openModal, closeModal, setTheme, logoLockupHTML,
  isVoiceEnabled, setVoiceEnabled, speak, playClickSound,
  getAvailableVoices, getSelectedVoiceURI, setSelectedVoiceURI,
  getQuietHours, setQuietHours,
  getWeightLogs, addWeightEntry, deleteWeightEntry,
  isSilentModeBypassEnabled, setSilentModeBypassEnabled,
  goScreen, render, SCREEN_RENDERERS, saveDB, loadKnowledgeBase, loadDB, setTabbarVisible
};

/* ---------------- Boot ---------------- */
async function boot(){
  DB = loadDB();
  ensureCurrentDog();
  applyTheme((DB.settings && DB.settings.theme) || "auto");
  document.getElementById("topbarThemeToggle").addEventListener("click", ()=>{
    const current = (DB.settings && DB.settings.theme) || "auto";
    const isDarkNow = current === "dark" || (current === "auto" && window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches);
    setTheme(isDarkNow ? "light" : "dark");
  });
  if(window.matchMedia){
    // Keeps the quick-toggle icon honest if the OS theme changes while "Auto" is selected,
    // since that case is otherwise handled purely by CSS with nothing to tell the JS side.
    window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", ()=>{
      if(((DB.settings && DB.settings.theme) || "auto") === "auto") applyTheme("auto");
    });
  }
  setTabbarVisible(false);
  document.getElementById("screens").innerHTML =
    '<div class="screen active"><div class="empty-state"><span class="glyph">🐾</span>Loading the training library…</div></div>';
  try{
    await loadKnowledgeBase();
  }catch(e){
    console.error(e);
    document.getElementById("screens").innerHTML =
      '<div class="screen active"><div class="empty-state"><span class="glyph">⚠️</span>'+
      "Couldn't load the training library. Check your connection and reload.</div></div>";
    return;
  }
  if(!DB.dogs.length){
    goScreen("onboarding");
  }else{
    goScreen("home");
    // PWA shortcut: "Start today's suggestion" (manifest.json) launches with
    // ?action=suggested — jump straight into a session instead of making
    // the person tap through from Home.
    const params = new URLSearchParams(location.search);
    if(params.get("action") === "suggested"){
      const dog = getCurrentDog();
      if(dog){
        const lesson = window.__sk.suggestedLesson(dog);
        if(lesson) window.__sk.startSession(lesson.lesson_id);
      }
      history.replaceState(null, "", location.pathname);
    }else if(params.get("action") === "clicker"){
      window.__sk.openClickerModal();
      history.replaceState(null, "", location.pathname);
    }
  }
  if("serviceWorker" in navigator){
    navigator.serviceWorker.register("sw.js").catch(()=>{});
  }
}
document.addEventListener("DOMContentLoaded", boot);

})();

/* ============================================================
   ONBOARDING + DOG PROFILE MANAGEMENT
   ============================================================ */
(function(){
const sk = window.__sk;

function dogAvatarHTML(dog, size){
  const cls = size==="lg" ? "avatar avatar-lg" : "avatar";
  const color = dog.color || sk.AVATAR_COLORS[0];
  if(dog.photo){
    return '<div class="'+cls+'" style="background:'+color+'; padding:0; overflow:hidden;"><img src="'+dog.photo+'" alt="" style="width:100%; height:100%; object-fit:cover; border-radius:50%;"></div>';
  }
  return '<div class="'+cls+'" style="background:'+color+'">'+ (dog.emoji||"🐕") +'</div>';
}

// Reads an image file, downscales it on a canvas, and re-encodes as JPEG.
// Runs iteratively, shrinking further if the result is still too large —
// localStorage has a hard ~5-10MB quota shared with the whole app (the
// lesson library alone is ~1.4MB), so an uncompressed phone photo (often
// 2-5MB) could not just fail to save but crowd out real training data.
function compressImageToDataURL(file, maxDim, quality){
  return new Promise((resolve, reject)=>{
    const reader = new FileReader();
    reader.onerror = ()=>reject(new Error("Couldn't read that file."));
    reader.onload = ()=>{
      const img = new Image();
      img.onerror = ()=>reject(new Error("That doesn't look like a valid image."));
      img.onload = ()=>{
        let width = img.naturalWidth, height = img.naturalHeight;
        if(!width || !height){ reject(new Error("That image appears to be empty.")); return; }
        if(width > height){ if(width > maxDim){ height = Math.round(height*maxDim/width); width = maxDim; } }
        else{ if(height > maxDim){ width = Math.round(width*maxDim/height); height = maxDim; } }
        const canvas = document.createElement("canvas");
        canvas.width = width; canvas.height = height;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL("image/jpeg", quality));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

async function processDogPhoto(file){
  if(!file.type || !file.type.startsWith("image/")) throw new Error("Please choose an image file.");
  const MAX_CHARS = 70000; // ~50KB of actual image data once base64 overhead is accounted for
  let dim = 260, quality = 0.75;
  let dataUrl = await compressImageToDataURL(file, dim, quality);
  let attempts = 0;
  while(dataUrl.length > MAX_CHARS && attempts < 5){
    quality = Math.max(0.35, quality - 0.15);
    if(quality <= 0.35) dim = Math.round(dim*0.8);
    dataUrl = await compressImageToDataURL(file, dim, quality);
    attempts++;
  }
  return dataUrl;
}

function renderOnboarding(container){
  sk.setTopbar("Sidekick", "Let's get set up", "", true);
  container.innerHTML = `
    <div style="padding-top:8px;">
      <div style="text-align:center; margin-bottom:24px;">
        <div style="margin-bottom:10px;">${sk.logoLockupHTML(200)}</div>
        <p style="color:var(--ink-soft); font-size:14.5px;">A calm, reward-based training companion.<br>Let's set up your dog's profile.</p>
      </div>
      <form id="onboardForm">
        <label id="ob_photoLabel">Photo <span style="font-weight:400;color:var(--ink-soft)">(optional — you can always add one later)</span></label>
        <div style="display:flex; align-items:center; gap:12px; margin-bottom:12px;">
          <div id="ob_photoPreview">${sk.dogAvatarHTML({emoji:sk.DOG_EMOJI[0], color:sk.AVATAR_COLORS[0], photo:null}, "lg")}</div>
          <button type="button" class="btn btn-secondary btn-sm" id="ob_photoPick" aria-describedby="ob_photoLabel">Add photo</button>
          <input type="file" id="ob_photoInput" accept="image/*" aria-label="Upload a photo of your dog" style="display:none;">
        </div>

        <label for="ob_name">Dog's name</label>
        <input type="text" id="ob_name" placeholder="e.g. Bramble" required maxlength="30">

        <label for="ob_breed">Breed <span style="font-weight:400;color:var(--ink-soft)">(optional)</span></label>
        <input type="text" id="ob_breed" placeholder="e.g. Cocker Spaniel">

        <label id="ob_stageLabel">Life stage</label>
        <div class="chip-group" id="ob_stage" role="group" aria-labelledby="ob_stageLabel">
          ${sk.AGE_STAGES.map((s,i)=>`<button type="button" class="chip${i===1?' selected':''}" data-val="${s}">${s}</button>`).join("")}
        </div>

        <label id="ob_genderLabel">Gender <span style="font-weight:400;color:var(--ink-soft)">(optional)</span></label>
        <div class="chip-group" id="ob_gender" role="group" aria-labelledby="ob_genderLabel">
          ${sk.GENDERS.map((g,i)=>`<button type="button" class="chip${i===2?' selected':''}" data-val="${g}">${g}</button>`).join("")}
        </div>

        <label id="ob_avatarLabel">Pick an avatar <span style="font-weight:400;color:var(--ink-soft)">(used if no photo)</span></label>
        <div class="chip-group" id="ob_emoji" role="group" aria-labelledby="ob_avatarLabel">
          ${sk.DOG_EMOJI.map((e,i)=>`<button type="button" class="chip${i===0?' selected':''}" data-val="${e}" style="font-size:18px;" aria-label="Avatar option ${i+1}">${e}</button>`).join("")}
        </div>
        <div class="chip-group" id="ob_color" role="group" aria-label="Avatar colour">
          ${sk.AVATAR_COLORS.map((c,i)=>`<button type="button" class="chip${i===0?' selected':''}" data-val="${c}" style="width:34px;height:34px;padding:0;border-radius:50%;background:${c};border-color:${c};" aria-label="Colour option ${i+1}"></button>`).join("")}
        </div>

        <button type="submit" class="btn btn-primary btn-block" style="margin-top:8px;">Start training</button>
      </form>
    </div>
  `;
  let stage = sk.AGE_STAGES[1];
  let gender = sk.GENDERS[2];
  let emoji = sk.DOG_EMOJI[0];
  let color = sk.AVATAR_COLORS[0];
  let photo = null;
  function repaintObPreview(){
    container.querySelector("#ob_photoPreview").innerHTML = sk.dogAvatarHTML({emoji, color, photo}, "lg");
    container.querySelector("#ob_photoPick").textContent = photo ? "Change photo" : "Add photo";
  }
  container.querySelector("#ob_photoPick").addEventListener("click", ()=>container.querySelector("#ob_photoInput").click());
  container.querySelector("#ob_photoInput").addEventListener("change", async (e)=>{
    const file = e.target.files[0];
    if(!file) return;
    const pickBtn = container.querySelector("#ob_photoPick");
    pickBtn.textContent = "Processing…"; pickBtn.disabled = true;
    try{
      photo = await sk.processDogPhoto(file);
    }catch(err){
      sk.showToast(err.message || "Couldn't use that photo.");
    }finally{
      pickBtn.disabled = false;
      repaintObPreview();
    }
    e.target.value = "";
  });
  container.querySelector("#ob_stage").addEventListener("click", e=>{
    const b = e.target.closest(".chip"); if(!b) return;
    container.querySelectorAll("#ob_stage .chip").forEach(c=>c.classList.remove("selected"));
    b.classList.add("selected"); stage = b.dataset.val;
  });
  container.querySelector("#ob_gender").addEventListener("click", e=>{
    const b = e.target.closest(".chip"); if(!b) return;
    container.querySelectorAll("#ob_gender .chip").forEach(c=>c.classList.remove("selected"));
    b.classList.add("selected"); gender = b.dataset.val;
  });
  container.querySelector("#ob_emoji").addEventListener("click", e=>{
    const b = e.target.closest(".chip"); if(!b) return;
    container.querySelectorAll("#ob_emoji .chip").forEach(c=>c.classList.remove("selected"));
    b.classList.add("selected"); emoji = b.dataset.val;
    repaintObPreview();
  });
  container.querySelector("#ob_color").addEventListener("click", e=>{
    const b = e.target.closest(".chip"); if(!b) return;
    container.querySelectorAll("#ob_color .chip").forEach(c=>c.classList.remove("selected"));
    b.classList.add("selected"); color = b.dataset.val;
    repaintObPreview();
  });
  container.querySelector("#onboardForm").addEventListener("submit", e=>{
    e.preventDefault();
    const name = container.querySelector("#ob_name").value.trim();
    if(!name) return;
    const dog = {
      id: sk.uid(), name, breed: container.querySelector("#ob_breed").value.trim(),
      ageStage: stage, gender, emoji, color, photo, createdAt: new Date().toISOString()
    };
    sk.DB.dogs.push(dog);
    sk.DB.activeDogId = dog.id;
    sk.saveDB();
    sk.setCurrentDogId(dog.id);
    sk.showToast("Welcome, "+name+"! 🐾");
    sk.goScreen("home");
  });
}

function renderDogForm(existing){
  const isNew = !existing;
  const dog = existing || {name:"",breed:"",ageStage:sk.AGE_STAGES[1],emoji:sk.DOG_EMOJI[0],color:sk.AVATAR_COLORS[0]};
  let stage = dog.ageStage, gender = dog.gender || sk.GENDERS[2], emoji = dog.emoji, color = dog.color, photo = dog.photo || null;
  const html = `
    <h3>${isNew?"Add a dog":"Edit "+sk.esc(dog.name)}</h3>
    <form id="dogForm">
      <label id="df_photoLabel">Photo <span style="font-weight:400;color:var(--ink-soft)">(optional)</span></label>
      <div style="display:flex; align-items:center; gap:12px; margin-bottom:12px;">
        <div id="df_photoPreview">${dogAvatarHTML({...dog, emoji, color, photo}, "lg")}</div>
        <div style="display:flex; flex-direction:column; gap:6px;">
          <button type="button" class="btn btn-secondary btn-sm" id="df_photoPick" aria-describedby="df_photoLabel">${photo?"Change photo":"Add photo"}</button>
          ${photo ? '<button type="button" class="btn btn-ghost btn-sm" id="df_photoRemove">Remove photo</button>' : ""}
        </div>
        <input type="file" id="df_photoInput" accept="image/*" aria-label="Upload a photo of your dog" style="display:none;">
      </div>
      <label for="df_name">Name</label>
      <input type="text" id="df_name" value="${sk.esc(dog.name)}" maxlength="30" required>
      <label for="df_breed">Breed <span style="font-weight:400;color:var(--ink-soft)">(optional)</span></label>
      <input type="text" id="df_breed" value="${sk.esc(dog.breed||"")}">
      <label id="df_stageLabel">Life stage</label>
      <div class="chip-group" id="df_stage" role="group" aria-labelledby="df_stageLabel">
        ${sk.AGE_STAGES.map(s=>`<button type="button" class="chip${s===stage?' selected':''}" data-val="${s}">${s}</button>`).join("")}
      </div>
      <label id="df_genderLabel">Gender <span style="font-weight:400;color:var(--ink-soft)">(optional)</span></label>
      <div class="chip-group" id="df_gender" role="group" aria-labelledby="df_genderLabel">
        ${sk.GENDERS.map(g=>`<button type="button" class="chip${g===gender?' selected':''}" data-val="${g}">${g}</button>`).join("")}
      </div>
      <label id="df_avatarLabel">${photo?"Backup avatar":"Avatar"} <span style="font-weight:400;color:var(--ink-soft)">${photo?"(shown if the photo can't load)":""}</span></label>
      <div class="chip-group" id="df_emoji" role="group" aria-labelledby="df_avatarLabel">
        ${sk.DOG_EMOJI.map((e,i)=>`<button type="button" class="chip${e===emoji?' selected':''}" data-val="${e}" style="font-size:18px;" aria-label="Avatar option ${i+1}">${e}</button>`).join("")}
      </div>
      <div class="chip-group" id="df_color" role="group" aria-label="Avatar colour">
        ${sk.AVATAR_COLORS.map((c,i)=>`<button type="button" class="chip${c===color?' selected':''}" data-val="${c}" style="width:34px;height:34px;padding:0;border-radius:50%;background:${c};border-color:${c};" aria-label="Colour option ${i+1}"></button>`).join("")}
      </div>
      <button type="submit" class="btn btn-primary btn-block">${isNew?"Add dog":"Save changes"}</button>
      ${!isNew?'<button type="button" id="df_delete" class="btn btn-danger btn-block" style="margin-top:8px;">Remove '+sk.esc(dog.name)+'</button>':""}
    </form>
  `;
  sk.openModal(html);
  const root = document.getElementById("modalSheet");
  function repaintPreview(){
    root.querySelector("#df_photoPreview").innerHTML = dogAvatarHTML({...dog, emoji, color, photo}, "lg");
    const pickBtn = root.querySelector("#df_photoPick");
    if(pickBtn) pickBtn.textContent = photo ? "Change photo" : "Add photo";
    let removeBtn = root.querySelector("#df_photoRemove");
    if(photo && !removeBtn){
      removeBtn = document.createElement("button");
      removeBtn.type = "button"; removeBtn.id = "df_photoRemove";
      removeBtn.className = "btn btn-ghost btn-sm";
      removeBtn.textContent = "Remove photo";
      pickBtn.insertAdjacentElement("afterend", removeBtn);
      removeBtn.addEventListener("click", ()=>{ photo = null; repaintPreview(); });
    }else if(!photo && removeBtn){
      removeBtn.remove();
    }
  }
  root.querySelector("#df_photoPick").addEventListener("click", ()=>root.querySelector("#df_photoInput").click());
  const removeBtnInit = root.querySelector("#df_photoRemove");
  if(removeBtnInit) removeBtnInit.addEventListener("click", ()=>{ photo = null; repaintPreview(); });
  root.querySelector("#df_photoInput").addEventListener("change", async (e)=>{
    const file = e.target.files[0];
    if(!file) return;
    const pickBtn = root.querySelector("#df_photoPick");
    const prevLabel = pickBtn.textContent;
    pickBtn.textContent = "Processing…"; pickBtn.disabled = true;
    try{
      photo = await sk.processDogPhoto(file);
      repaintPreview();
    }catch(err){
      sk.showToast(err.message || "Couldn't use that photo.");
    }finally{
      pickBtn.disabled = false;
      if(root.querySelector("#df_photoPick")) root.querySelector("#df_photoPick").textContent = photo ? "Change photo" : prevLabel;
    }
    e.target.value = "";
  });
  root.querySelector("#df_stage").addEventListener("click", e=>{
    const b=e.target.closest(".chip"); if(!b) return;
    root.querySelectorAll("#df_stage .chip").forEach(c=>c.classList.remove("selected"));
    b.classList.add("selected"); stage=b.dataset.val;
  });
  root.querySelector("#df_gender").addEventListener("click", e=>{
    const b=e.target.closest(".chip"); if(!b) return;
    root.querySelectorAll("#df_gender .chip").forEach(c=>c.classList.remove("selected"));
    b.classList.add("selected"); gender=b.dataset.val;
  });
  root.querySelector("#df_emoji").addEventListener("click", e=>{
    const b=e.target.closest(".chip"); if(!b) return;
    root.querySelectorAll("#df_emoji .chip").forEach(c=>c.classList.remove("selected"));
    b.classList.add("selected"); emoji=b.dataset.val;
    repaintPreview();
  });
  root.querySelector("#df_color").addEventListener("click", e=>{
    const b=e.target.closest(".chip"); if(!b) return;
    root.querySelectorAll("#df_color .chip").forEach(c=>c.classList.remove("selected"));
    b.classList.add("selected"); color=b.dataset.val;
    repaintPreview();
  });
  root.querySelector("#dogForm").addEventListener("submit", e=>{
    e.preventDefault();
    const name = root.querySelector("#df_name").value.trim();
    if(!name) return;
    const breed = root.querySelector("#df_breed").value.trim();
    if(isNew){
      const nd = {id:sk.uid(), name, breed, ageStage:stage, gender, emoji, color, photo, createdAt:new Date().toISOString()};
      sk.DB.dogs.push(nd);
      sk.setCurrentDogId(nd.id);
    }else{
      Object.assign(dog, {name, breed, ageStage:stage, gender, emoji, color, photo});
      sk.saveDB();
    }
    sk.closeModal();
    sk.showToast("Saved.");
    sk.render();
  });
  if(!isNew){
    root.querySelector("#df_delete").addEventListener("click", ()=>{
      sk.openModal(`
        <h3>Remove ${sk.esc(dog.name)}?</h3>
        <p style="color:var(--ink-soft);font-size:14px;">This deletes their profile, skill progress and session history. This can't be undone.</p>
        <button class="btn btn-danger btn-block" id="confirmDel">Remove ${sk.esc(dog.name)}</button>
        <button class="btn btn-ghost btn-block" style="margin-top:8px;" id="cancelDel">Cancel</button>
      `);
      document.getElementById("confirmDel").addEventListener("click", ()=>{
        sk.DB.dogs = sk.DB.dogs.filter(d=>d.id!==dog.id);
        delete sk.DB.skillStates[dog.id];
        delete sk.DB.lessonProgress[dog.id];
        sk.DB.sessions = sk.DB.sessions.filter(s=>s.dogId!==dog.id);
        if(sk.DB.activeDogId===dog.id) sk.DB.activeDogId = sk.DB.dogs[0]?.id || null;
        sk.saveDB();
        sk.setCurrentDogId(sk.DB.activeDogId);
        sk.closeModal();
        if(!sk.DB.dogs.length) sk.goScreen("onboarding"); else sk.goScreen("home");
      });
      document.getElementById("cancelDel").addEventListener("click", sk.closeModal);
    });
  }
}

function openDogSwitcher(){
  const dogs = sk.DB.dogs;
  const html = `
    <h3>Your dogs</h3>
    <div class="row-list">
      ${dogs.map(d=>`
        <button class="row" data-id="${d.id}">
          <div class="row-tab" style="background:${d.color}"></div>
          ${dogAvatarHTML(d)}
          <div class="row-body">
            <div class="row-title">${sk.esc(d.name)}</div>
            <div class="row-meta">${sk.esc(d.breed||d.ageStage)}</div>
          </div>
          ${d.id===sk.currentDogId?'<span class="badge">Active</span>':''}
        </button>`).join("")}
    </div>
    <button class="btn btn-secondary btn-block" id="addDogBtn" style="margin-top:14px;">+ Add another dog</button>
  `;
  sk.openModal(html);
  document.getElementById("modalSheet").querySelectorAll(".row[data-id]").forEach(r=>{
    r.addEventListener("click", ()=>{
      sk.setCurrentDogId(r.dataset.id);
      sk.closeModal();
      sk.render();
    });
  });
  document.getElementById("addDogBtn").addEventListener("click", ()=>renderDogForm(null));
}

sk.SCREEN_RENDERERS.onboarding = renderOnboarding;
window.__sk.dogAvatarHTML = dogAvatarHTML;
window.__sk.processDogPhoto = processDogPhoto;
window.__sk.renderDogForm = renderDogForm;
window.__sk.openDogSwitcher = openDogSwitcher;
})();

/* ============================================================
   HOME SCREEN
   ============================================================ */
(function(){
const sk = window.__sk;

function setTopbar(title, sub, actionsHTML, useLogoLockup){
  document.getElementById("topbarTitle").textContent = title;
  document.getElementById("topbarSub").textContent = sub||"";
  document.getElementById("topbarActions").innerHTML = actionsHTML||"";
  document.getElementById("topbarLogo").style.display = useLogoLockup ? "none" : "";
  document.getElementById("topbarLogoFull").style.display = useLogoLockup ? "flex" : "none";
  document.getElementById("topbarTitleWrap").style.display = useLogoLockup ? "none" : "";
}

// Categories that are owner education/reference/assessment content rather
// than hands-on exercises to actually do with the dog — excluded from
// "today's session" and the home suggestion so a new dog isn't scheduled
// "Recognising bite-risk warning signs" as exercise #2.
const NON_SESSION_CATEGORIES = new Set(["Owner Skills","Safety & Referral","Assessment","Behaviour Assessment","Troubleshooting"]);

function suggestedLesson(dog){
  const IDX = sk.IDX, KB = sk.KB;
  // Prefer a Foundation/Comms lesson the dog hasn't completed yet; fall back to least-recently-practised.
  // Note: lesson.age_stage isn't a real exclusion filter in this dataset — 506/530 lessons are
  // "All life stages" and the remaining 24 just say "Puppy to adult, adapted to individual" (a
  // note to adapt technique, not a stage to match against), so there's nothing meaningful to
  // filter on here. All lessons are eligible for all dogs regardless of ageStage.
  const progress = sk.DB.lessonProgress[dog.id] || {};
  const prereqsMet = (l)=> sk.splitPipe(l.prerequisites).every(pid=>progress[pid]);
  const candidates = KB.collections.lessons.filter(l=>!NON_SESSION_CATEGORIES.has(l.category));
  let notStarted = candidates.filter(l=>!progress[l.lesson_id]);
  let pool = notStarted.length ? notStarted : candidates;
  // Don't suggest something the dog isn't ready for yet — prefer lessons whose
  // prerequisites are already done. Only falls through to the full pool if
  // every not-started lesson still has an unmet prerequisite (rare, but
  // possible early on before any Foundation lessons are complete).
  let ready = pool.filter(prereqsMet);
  if(ready.length) pool = ready;
  // prioritise Beginner + Foundation/Communication for brand-new dogs
  let beginnerFirst = pool.filter(l=>l.difficulty==="Beginner" && (l.category==="Foundation"||l.category==="Communication & Engagement"));
  if(beginnerFirst.length && Object.keys(progress).length < 5) return beginnerFirst[0];
  pool.sort((a,b)=>{
    const pa = progress[a.lesson_id], pb = progress[b.lesson_id];
    const ta = pa?pa.lastPracticed:0, tb = pb?pb.lastPracticed:0;
    return (ta||0)-(tb||0);
  });
  return pool[0] || candidates[0];
}

// Builds today's short multi-lesson session: the same lead pick as
// suggestedLesson(), plus up to two more from different categories so the
// session has some variety rather than three lessons on the same topic.
// Looks for a lesson practiced very recently that came back "regress" (too
// difficult, or difficult with a low success rate) so Home can surface a
// short, honest note about it — this is what actually makes the adaptive
// engine feel visible rather than invisible.
function recentStruggleNote(dog){
  const progress = sk.DB.lessonProgress[dog.id] || {};
  let candidate = null;
  Object.entries(progress).forEach(([lessonId, p])=>{
    if(p.lastVerdict !== "regress") return;
    if(sk.daysAgo(p.lastPracticed) > 2) return;
    if(!candidate || p.lastPracticed > candidate.p.lastPracticed) candidate = {lessonId, p};
  });
  if(!candidate) return null;
  const l = sk.IDX.lessonsById.get(candidate.lessonId);
  if(!l) return null;
  const when = sk.daysAgo(candidate.p.lastPracticed) === 0 ? "earlier today" : "last time";
  return `Sidekick noticed ${sk.esc(l.title).toLowerCase()} was tricky ${when} — we'll ease back in before pushing forward again.`;
}

function todaysSessionLessons(dog){
  const progress = sk.DB.lessonProgress[dog.id] || {};
  const prereqsMet = (l)=> sk.splitPipe(l.prerequisites).every(pid=>progress[pid]);
  const candidates = sk.KB.collections.lessons.filter(l=>!NON_SESSION_CATEGORIES.has(l.category));
  let notStarted = candidates.filter(l=>!progress[l.lesson_id]);
  let pool = notStarted.length ? notStarted : candidates;
  let ready = pool.filter(prereqsMet);
  if(ready.length) pool = ready;
  pool = pool.slice().sort((a,b)=>{
    const pa = progress[a.lesson_id], pb = progress[b.lesson_id];
    const ta = pa?pa.lastPracticed:0, tb = pb?pb.lastPracticed:0;
    return (ta||0)-(tb||0);
  });

  const lead = suggestedLesson(dog);
  const picked = [lead];
  const usedCategories = new Set([lead.category]);
  for(const l of pool){
    if(picked.length >= 3) break;
    if(picked.some(p=>p.lesson_id===l.lesson_id)) continue;
    if(usedCategories.has(l.category)) continue;
    picked.push(l);
    usedCategories.add(l.category);
  }
  // if variety ran out (small library edge case), fill remaining slots regardless of category
  if(picked.length < 3){
    for(const l of pool){
      if(picked.length >= 3) break;
      if(picked.some(p=>p.lesson_id===l.lesson_id)) continue;
      picked.push(l);
    }
  }
  return picked;
}

function skillSummary(dogId){
  const counts = {}; sk.SKILL_STATES.forEach(s=>counts[s]=0);
  sk.KB.collections.skills.forEach(sObj=>{
    const st = sk.dogSkillState(dogId, sObj.skill_id);
    counts[st] = (counts[st]||0)+1;
  });
  return counts;
}

// A single "how far along overall" number, built from the same 5 skill
// states already tracked everywhere else in the app -- no new data needed.
// Acquiring counts for a little, Life-ready counts for full credit.
const SKILL_STATE_WEIGHT = {"Acquiring":0, "Developing":0.25, "Reliable":0.5, "Generalising":0.75, "Life-ready":1};
function overallProgressPercent(dogId){
  const skills = sk.KB.collections.skills;
  if(!skills.length) return 0;
  const total = skills.reduce((sum,sObj)=>{
    const st = sk.dogSkillState(dogId, sObj.skill_id);
    return sum + (SKILL_STATE_WEIGHT[st]||0);
  }, 0);
  return Math.round(total / skills.length * 100);
}

// Longest streak ever achieved, not just the current one -- distinct,
// motivating milestone info the current-streak number alone doesn't give.
function longestStreakEver(dogId){
  const dates = [...new Set(sk.DB.sessions.filter(s=>s.dogId===dogId).map(s=>s.date.slice(0,10)))].sort();
  if(!dates.length) return 0;
  let longest = 1, current = 1;
  for(let i=1;i<dates.length;i++){
    const prev = new Date(dates[i-1]), cur = new Date(dates[i]);
    const diffDays = Math.round((cur-prev)/86400000);
    if(diffDays===1){ current++; longest = Math.max(longest,current); }
    else current = 1;
  }
  return longest;
}

function totalLessonsCompleted(dogId){
  const progress = sk.DB.lessonProgress[dogId] || {};
  return Object.keys(progress).length;
}

function recentSessions(dogId, n){
  return sk.DB.sessions.filter(s=>s.dogId===dogId).sort((a,b)=>new Date(b.date)-new Date(a.date)).slice(0,n||3);
}

// Returns the praise word matching the dog's gender, falling back to a
// neutral term for "Unknown" or if the field is missing on older profiles.
function praiseWordFor(dog){
  if(dog && dog.gender === "Male") return "Good boy";
  if(dog && dog.gender === "Female") return "Good girl";
  return "Good dog";
}

function trainingStreak(dogId){
  const dates = new Set(sk.DB.sessions.filter(s=>s.dogId===dogId).map(s=>s.date.slice(0,10)));
  let streak = 0;
  let d = new Date();
  for(;;){
    const key = d.toISOString().slice(0,10);
    if(dates.has(key)){ streak++; d.setDate(d.getDate()-1); }
    else if(streak===0 && key===new Date().toISOString().slice(0,10)){ d.setDate(d.getDate()-1); continue; }
    else break;
  }
  return streak;
}

function renderHome(container){
  const dog = sk.getCurrentDog();
  if(!dog){ sk.goScreen("onboarding"); return; }
  setTopbar("Sidekick", "", `<button class="icon-btn" id="switchDogBtn" aria-label="Switch dog" style="padding:0; overflow:hidden;">${dog.photo?`<img src="${dog.photo}" alt="" style="width:100%; height:100%; object-fit:cover; border-radius:50%;">`:dog.emoji}</button>`, true);

  const sessionLessons = todaysSessionLessons(dog);
  const totalMin = sessionLessons.reduce((sum,l)=>sum+(l.session_length_min||5), 0);
  const counts = skillSummary(dog.id);
  const streak = trainingStreak(dog.id);
  const overallPct = overallProgressPercent(dog.id);
  const developingCount = counts["Developing"]||0;
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  const skillTotal = sk.KB.collections.skills.length;
  const topCategories = Object.entries(
    sk.KB.collections.lessons.reduce((acc,l)=>{
      const p = sk.DB.lessonProgress[dog.id]?.[l.lesson_id];
      if(!acc[l.category]) acc[l.category] = {done:0,total:0};
      acc[l.category].total++;
      if(p) acc[l.category].done++;
      return acc;
    }, {})
  ).filter(([,v])=>v.total>=4).sort((a,b)=>(b[1].done/b[1].total)-(a[1].done/a[1].total)).slice(0,3);

  const struggleNote = recentStruggleNote(dog);

  container.innerHTML = `
    <div style="display:flex; flex-direction:column; align-items:center; padding:8px 0 18px;">
      <div style="border-radius:50%; box-shadow:0 4px 14px rgba(0,0,0,0.12);">${sk.dogAvatarHTML(dog, "lg")}</div>
      <h2 style="margin:10px 0 2px;">${sk.esc(dog.name)}</h2>
      <p style="color:var(--ink-soft); font-size:13px; margin:0 0 12px;">${greeting}${sk.DB.dogs.length>1?" 👋":""}</p>
      <button id="journeyStatsRow" style="display:flex; gap:18px; background:none; border:none; padding:4px 10px; cursor:pointer; color:var(--ink);">
        <div style="text-align:center;"><div style="font-size:15px; font-weight:700; font-family:var(--font-display); color:var(--ink);">🐾 ${developingCount}</div><div style="font-size:10.5px; color:var(--ink-soft);">developing</div></div>
        <div style="text-align:center;"><div style="font-size:15px; font-weight:700; font-family:var(--font-display); color:var(--ink);">🔥 ${streak}</div><div style="font-size:10.5px; color:var(--ink-soft);">day streak</div></div>
        <div style="text-align:center;"><div style="font-size:15px; font-weight:700; font-family:var(--font-display); color:var(--ink);">⭐ ${overallPct}%</div><div style="font-size:10.5px; color:var(--ink-soft);">progress</div></div>
      </button>
    </div>

    ${struggleNote ? `<p style="font-size:12.5px; color:var(--ink-soft); text-align:center; margin:0 8px 12px; line-height:1.5;">🧠 ${struggleNote}</p>` : ""}

    <div class="card" id="sessionCard" style="cursor:pointer;">
      <div class="section-label" role="heading" aria-level="2" style="margin-top:0;">Today's training</div>
      <div style="display:flex; align-items:baseline; gap:8px; margin-bottom:10px;">
        <span style="font-size:22px; font-weight:700; font-family:var(--font-display);">⭐ ${totalMin} min session</span>
      </div>
      ${sessionLessons.map((l,i)=>`
        <div style="display:flex; align-items:center; gap:10px; padding:7px 0; ${i>0?'border-top:1px solid var(--line);':''}">
          <div style="width:22px; height:22px; border-radius:50%; background:var(${sk.getCategoryVar(l.category)}); color:#fff; font-size:11px; font-weight:700; display:flex; align-items:center; justify-content:center; flex:none;">${i+1}</div>
          <div style="flex:1; font-size:14px;">${sk.esc(l.title)}</div>
          <div style="font-size:12px; color:var(--ink-soft);">${l.session_length_min||5} min</div>
        </div>`).join("")}
      <button class="btn btn-primary btn-block" style="margin-top:12px;" id="startTodaySession">Start today's session →</button>
      <button class="btn btn-ghost btn-block" style="margin-top:8px;" id="startQuickSession">⏱ Only have ${sessionLessons[0].session_length_min||5} minutes?</button>
    </div>

    <div style="height:6px;"></div>

    <div class="section-label" role="heading" aria-level="2">How can we help?</div>
    <div class="row-list">
      <button class="row" id="quickWhatTrain"><div class="row-tab" style="background:var(--forest)"></div><div class="row-body"><div class="row-title"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:18px;height:18px;vertical-align:-3px;margin-right:6px;"><circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3.5"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/></svg>What should I train?</div><div class="row-meta">Browse by category</div></div><span class="row-chev">›</span></button>
      <button class="row" id="quickBehaviour"><div class="row-tab" style="background:var(--red)"></div><div class="row-body"><div class="row-title"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:18px;height:18px;vertical-align:-3px;margin-right:6px;"><path d="M4 5h16v10H8l-4 4z"/><path d="M12 8.5v2.5M12 14v.01"/></svg>Help with a behaviour</div><div class="row-meta">Answer a couple of questions</div></div><span class="row-chev">›</span></button>
      <button class="row" id="quickBrowse"><div class="row-tab" style="background:var(--ochre)"></div><div class="row-body"><div class="row-title"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:18px;height:18px;vertical-align:-3px;margin-right:6px;"><path d="M4 5.5c0-.6.4-1 1-1h5.5a2 2 0 0 1 2 2v13a1.5 1.5 0 0 0-1.5-1.5H4z"/><path d="M20 5.5c0-.6-.4-1-1-1h-5.5a2 2 0 0 0-2 2v13a1.5 1.5 0 0 1 1.5-1.5H20z"/></svg>Browse all lessons</div><div class="row-meta">${sk.KB.collections.lessons.length} lessons in the library</div></div><span class="row-chev">›</span></button>
      <button class="row" id="quickClicker"><div class="row-tab" style="background:var(--sky)"></div><div class="row-body"><div class="row-title">🔨 Clicker</div><div class="row-meta">A tap-to-click sound, ready anytime</div></div><span class="row-chev">›</span></button>
      <button class="row" id="quickGames"><div class="row-tab" style="background:var(--forest)"></div><div class="row-body"><div class="row-title">🎮 Games</div><div class="row-meta">Fun ways to play, bond, and enrich</div></div><span class="row-chev">›</span></button>
    </div>

    <div class="section-label" role="heading" aria-level="2">${sk.esc(dog.name)}'s progress <a href="#" id="seeProgress" style="font-size:11px;text-transform:none;letter-spacing:0;font-weight:600;color:var(--forest);">View all →</a></div>
    <div class="card">
      ${topCategories.length ? topCategories.map(([cat,v])=>`
        <div style="display:flex; align-items:center; gap:10px; margin-bottom:8px;">
          <div style="width:120px; font-size:11.5px; color:var(--ink-soft); overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${sk.esc(cat)}</div>
          <div class="progress-track" style="flex:1;"><div class="progress-fill" style="width:${Math.round(v.done/v.total*100)}%; background:var(${sk.getCategoryVar(cat)})"></div></div>
          <div style="width:34px; text-align:right; font-size:12px; font-weight:700;">${Math.round(v.done/v.total*100)}%</div>
        </div>`).join("") : `<p style="font-size:13px; color:var(--ink-soft); margin:0;">Complete a few lessons to see progress by category here.</p>`}
      <div style="display:flex; justify-content:space-between; margin-top:10px; padding-top:10px; border-top:1px solid var(--line); font-size:12.5px; color:var(--ink-soft);">
        <span>${counts["Life-ready"]||0} of ${skillTotal} skills life-ready</span>
        <span>${counts["Reliable"]||0} reliable</span>
      </div>
    </div>
  `;

  container.querySelector("#sessionCard").addEventListener("click", (e)=>{
    if(e.target.id==="startTodaySession") return;
    sk.openLessonDetail(sessionLessons[0].lesson_id);
  });
  container.querySelector("#startTodaySession").addEventListener("click", (e)=>{
    e.stopPropagation();
    sk.startAdHocSession("Today's session", sessionLessons);
  });
  container.querySelector("#startQuickSession").addEventListener("click", (e)=>{
    e.stopPropagation();
    const quickLesson = sessionLessons[0];
    sk.startAdHocSession(`Quick ${quickLesson.session_length_min||5}-minute session`, [quickLesson]);
  });
  document.getElementById("switchDogBtn").addEventListener("click", sk.openDogSwitcher);
  container.querySelector("#journeyStatsRow").addEventListener("click", ()=>openTrainingJourney(dog));
  container.querySelector("#quickWhatTrain").addEventListener("click", ()=>sk.goScreen("lessons"));
  container.querySelector("#quickBehaviour").addEventListener("click", sk.openTroubleshootPicker);
  container.querySelector("#quickBrowse").addEventListener("click", ()=>sk.goScreen("lessons"));
  container.querySelector("#quickClicker").addEventListener("click", openClickerModal);
  container.querySelector("#quickGames").addEventListener("click", openGamesModal);
  container.querySelector("#seeProgress").addEventListener("click", (e)=>{ e.preventDefault(); sk.goScreen("progress"); });
}

// The dog's overall training journey -- pulls together stats that already
// exist scattered across Home and Progress into one motivating summary,
// rather than a new tracking system.
// A standalone clicker, independent of any lesson -- for general clicker-training
// practice, charging the clicker with a new dog, or just testing the sound.
// A playful, illustrated way into a curated set of existing Enrichment and
// Tricks & Games lessons -- not a new content type, just a more fun front
// door onto games that were already in the library. Each tile opens the
// real lesson detail page.
function openGamesModal(){
  const dog = sk.getCurrentDog();
  const tiles = sk.GAMES_LIST.map((g,i)=>{
    const l = sk.IDX.lessonsById.get(g.lessonId);
    if(!l) return "";
    const done = dog && sk.dogLessonProgress(dog.id, l.lesson_id);
    const color = sk.AVATAR_COLORS[i % sk.AVATAR_COLORS.length];
    const thumb = (l.media && l.media.image)
      ? `<img src="${sk.esc(l.media.image)}" alt="" loading="lazy" style="width:100%; height:100%; object-fit:cover; border-radius:50%;">`
      : `<div style="width:100%; height:100%; border-radius:50%; background:${color}; display:flex; align-items:center; justify-content:center; font-size:26px;">${g.emoji}</div>`;
    return `
      <button class="game-tile" data-game-lesson="${l.lesson_id}">
        <div class="game-tile-thumb">${thumb}</div>
        <div class="game-tile-label">${sk.esc(l.title)}</div>
        ${done ? `<div class="game-tile-done">✓ Done</div>` : ""}
      </button>
    `;
  }).join("");
  sk.openModal(`
    <h3>Games</h3>
    <p style="color:var(--ink-soft); font-size:13px; margin-bottom:14px;">Fun ways to play, bond, and enrich your dog's day — pulled from the training library's Enrichment and Tricks &amp; Games lessons.</p>
    <div class="game-grid">${tiles}</div>
  `);
  document.querySelectorAll("[data-game-lesson]").forEach(btn=>{
    btn.addEventListener("click", ()=>{ sk.closeModal(); sk.openLessonDetail(btn.dataset.gameLesson); });
  });
}

function openClickerModal(){
  let count = 0;
  sk.openModal(`
    <h3 style="text-align:center;">Clicker</h3>
    <p style="color:var(--ink-soft); font-size:13px; text-align:center; margin-bottom:24px;">Tap the button to hear a click — mark the moment, then reward.</p>
    <div style="display:flex; justify-content:center; margin-bottom:20px;">
      <button id="clickerMainBtn" aria-label="Play click sound" style="width:180px; height:180px; border-radius:50%; border:none; background:var(--forest); color:#fff; font-size:20px; font-weight:700; font-family:var(--font-display); cursor:pointer; box-shadow:var(--shadow-card);">🔨 Click</button>
    </div>
    <p style="text-align:center; color:var(--ink-soft); font-size:13px;" id="clickerCount">0 clicks this session</p>
  `);
  const btn = document.getElementById("clickerMainBtn");
  const countEl = document.getElementById("clickerCount");
  btn.addEventListener("click", ()=>{
    sk.playClickSound();
    count++;
    countEl.textContent = count + (count===1 ? " click this session" : " clicks this session");
  });
}

// Builds a GitHub-style contribution grid for the last ~10 weeks -- 7 rows
// (days) x N columns (weeks), each cell coloured by whether at least one
// session happened that day. Cells are emitted in chronological (column-major)
// order and CSS handles arranging them into the visual 7-row grid.
function trainingHeatmapHTML(dogId, weeks){
  weeks = weeks || 10;
  const sessionDates = new Set(
    sk.DB.sessions.filter(s=>s.dogId===dogId).map(s=>s.date.slice(0,10))
  );
  const today = new Date();
  today.setHours(0,0,0,0);
  const endOfGrid = new Date(today);
  endOfGrid.setDate(today.getDate() + (6 - today.getDay())); // roll forward to this week's Saturday
  const totalDays = weeks * 7;
  const start = new Date(endOfGrid);
  start.setDate(endOfGrid.getDate() - totalDays + 1);

  let cells = "";
  const cursor = new Date(start);
  const monthLabels = [];
  let lastMonth = null;
  for(let col=0; col<weeks; col++){
    const colDate = new Date(start);
    colDate.setDate(start.getDate() + col*7);
    const monthName = colDate.toLocaleDateString(undefined,{month:"short"});
    if(monthName !== lastMonth){ monthLabels.push({col, label:monthName}); lastMonth = monthName; }
  }
  for(let i=0;i<totalDays;i++){
    const key = cursor.toISOString().slice(0,10);
    const isFuture = cursor > today;
    const trained = sessionDates.has(key);
    const title = cursor.toLocaleDateString(undefined,{weekday:"short",month:"short",day:"numeric"}) + (trained ? " — trained" : "");
    cells += `<div class="heatmap-cell${trained?' trained':''}${isFuture?' future':''}" title="${sk.esc(title)}"></div>`;
    cursor.setDate(cursor.getDate()+1);
  }
  return `
    <div style="position:relative; height:14px; margin-bottom:2px; font-size:10px; color:var(--ink-soft);">
      ${monthLabels.map(m=>`<span style="position:absolute; left:${(m.col/weeks*100).toFixed(1)}%;">${m.label}</span>`).join("")}
    </div>
    <div class="heatmap-grid" style="grid-template-columns:repeat(${weeks}, 1fr);">${cells}</div>
    <div style="display:flex; align-items:center; justify-content:flex-end; gap:5px; margin-top:6px; font-size:10.5px; color:var(--ink-soft);">
      <span>Less</span><span class="heatmap-cell" style="display:inline-block;"></span><span class="heatmap-cell trained" style="display:inline-block;"></span><span>Trained</span>
    </div>
  `;
}

// A minimal, dependency-free SVG line chart for weight-over-time -- points
// are spaced evenly by entry order rather than proportionally by date gap,
// which keeps irregular logging intervals (a week here, a month there) from
// visually compressing or stretching the trend line unpredictably.
function weightChartSVG(entries, unit){
  const w = 320, h = 140, padX = 30, padY = 16;
  const weights = entries.map(e=>e.weight);
  let min = Math.min(...weights), max = Math.max(...weights);
  if(min === max){ min -= 1; max += 1; } // avoid a zero-range chart being a flat line at the very edge
  const range = max - min;
  const min2 = min - range*0.15, max2 = max + range*0.15;
  const range2 = max2 - min2;
  const n = entries.length;
  const xFor = i => n<=1 ? w/2 : padX + (i/(n-1))*(w-padX*2);
  const yFor = v => h-padY - ((v-min2)/range2)*(h-padY*2);
  const points = entries.map((e,i)=>`${xFor(i)},${yFor(e.weight)}`).join(" ");
  const dots = entries.map((e,i)=>`<circle cx="${xFor(i)}" cy="${yFor(e.weight)}" r="3.5" fill="var(--forest)"/>`).join("");
  const firstLabel = entries[0] ? sk.fmtDate(entries[0].date) : "";
  const lastLabel = entries[n-1] ? sk.fmtDate(entries[n-1].date) : "";
  return `
    <svg viewBox="0 0 ${w} ${h}" style="width:100%; height:auto;" role="img" aria-label="Weight trend chart">
      <polyline points="${points}" fill="none" stroke="var(--forest)" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>
      ${dots}
      <text x="${padX}" y="${h-2}" font-size="9" fill="var(--ink-soft)" text-anchor="start">${sk.esc(firstLabel)}</text>
      <text x="${w-padX}" y="${h-2}" font-size="9" fill="var(--ink-soft)" text-anchor="end">${sk.esc(lastLabel)}</text>
      <text x="2" y="${yFor(max2)+4}" font-size="9" fill="var(--ink-soft)">${max.toFixed(1)}${sk.esc(unit)}</text>
      <text x="2" y="${yFor(min2)+4}" font-size="9" fill="var(--ink-soft)">${min.toFixed(1)}${sk.esc(unit)}</text>
    </svg>
  `;
}

// The dog's weight log -- a simple add-entry form, a chart, and a
// deletable list, all scoped to whichever dog is currently active.
function openWeightTracker(){
  const dog = sk.getCurrentDog();
  if(!dog){ sk.showToast("Add a dog first."); return; }
  render();
  function render(){
    const entries = sk.getWeightLogs(dog.id);
    const unit = entries.length ? entries[entries.length-1].unit : "kg";
    sk.openModal(`
      <img src="images/weight-hero.jpg" alt="" style="width:100%; aspect-ratio:4/3; object-fit:cover; border-radius:12px; margin-bottom:14px;">
      <h3>${sk.esc(dog.name)}'s weight</h3>
      ${entries.length>=2 ? `<div class="card">${weightChartSVG(entries, unit)}</div>` : `<p style="color:var(--ink-soft); font-size:13px;">Log at least two entries to see a trend chart.</p>`}

      <div class="section-label" role="heading" aria-level="2">Add an entry</div>
      <div class="card">
        <form id="weightForm">
          <label for="wt_date">Date</label>
          <input type="date" id="wt_date" value="${new Date().toISOString().slice(0,10)}" max="${new Date().toISOString().slice(0,10)}" required>
          <div style="display:flex; gap:10px; align-items:flex-end;">
            <div style="flex:1;">
              <label for="wt_value">Weight</label>
              <input type="number" id="wt_value" step="0.1" min="0" placeholder="e.g. 12.5" required>
            </div>
            <div class="chip-group" id="wt_unit" role="group" aria-label="Unit" style="margin-bottom:12px;">
              <button type="button" class="chip${unit==="kg"?" selected":""}" data-val="kg">kg</button>
              <button type="button" class="chip${unit==="lb"?" selected":""}" data-val="lb">lb</button>
            </div>
          </div>
          <button type="submit" class="btn btn-primary btn-block">Save entry</button>
        </form>
      </div>

      ${entries.length ? `<div class="section-label" role="heading" aria-level="2">History</div>
      <div class="row-list">
        ${entries.slice().reverse().map(e=>`
          <div class="row" style="cursor:default;">
            <div class="row-body"><div class="row-title">${e.weight}${sk.esc(e.unit)}</div><div class="row-meta">${sk.fmtDate(e.date)}</div></div>
            <button type="button" class="icon-btn" data-delete-weight="${e.id}" aria-label="Delete this entry" style="width:32px; height:32px; font-size:14px;">🗑️</button>
          </div>
        `).join("")}
      </div>` : ""}
    `);
    let selectedUnit = unit;
    document.getElementById("wt_unit").addEventListener("click", e=>{
      const b = e.target.closest(".chip"); if(!b) return;
      document.querySelectorAll("#wt_unit .chip").forEach(c=>c.classList.remove("selected"));
      b.classList.add("selected");
      selectedUnit = b.dataset.val;
    });
    document.getElementById("weightForm").addEventListener("submit", e=>{
      e.preventDefault();
      const date = document.getElementById("wt_date").value;
      const value = document.getElementById("wt_value").value;
      if(!date || !value) return;
      sk.addWeightEntry(dog.id, date, value, selectedUnit);
      render(); // repaint with the new entry included
    });
    document.querySelectorAll("[data-delete-weight]").forEach(btn=>{
      btn.addEventListener("click", ()=>{
        sk.deleteWeightEntry(btn.dataset.deleteWeight);
        render();
      });
    });
  }
}

function openTrainingJourney(dog){
  const counts = skillSummary(dog.id);
  const skillTotal = sk.KB.collections.skills.length;
  const overallPct = overallProgressPercent(dog.id);
  const streak = trainingStreak(dog.id);
  const longest = longestStreakEver(dog.id);
  const lessonsCompleted = totalLessonsCompleted(dog.id);

  const categoryProgress = Object.entries(
    sk.KB.collections.lessons.reduce((acc,l)=>{
      const p = sk.DB.lessonProgress[dog.id]?.[l.lesson_id];
      if(!acc[l.category]) acc[l.category] = {done:0,total:0};
      acc[l.category].total++;
      if(p) acc[l.category].done++;
      return acc;
    }, {})
  ).filter(([,v])=>v.total>=4 && v.done>0).sort((a,b)=>(b[1].done/b[1].total)-(a[1].done/a[1].total));

  sk.openModal(`
    <div style="display:flex; flex-direction:column; align-items:center; margin-bottom:6px;">
      ${sk.dogAvatarHTML(dog, "lg")}
      <h3 style="margin:10px 0 0;">${sk.esc(dog.name)}'s journey</h3>
    </div>

    <div class="card" style="text-align:center;">
      <div style="font-size:40px; font-weight:700; font-family:var(--font-display); color:var(--forest);">${overallPct}%</div>
      <div style="font-size:12.5px; color:var(--ink-soft);">overall progress across all tracked skills</div>
    </div>

    <div class="stat-grid" style="margin-bottom:14px;">
      <div class="stat-box"><div class="num">${lessonsCompleted}</div><div class="lbl">Lessons trained</div></div>
      <div class="stat-box"><div class="num">🔥 ${streak}</div><div class="lbl">Current streak</div></div>
      <div class="stat-box"><div class="num">${longest}</div><div class="lbl">Longest streak</div></div>
    </div>

    <div class="section-label" role="heading" aria-level="2">Training days</div>
    <div class="card">
      ${trainingHeatmapHTML(dog.id)}
    </div>

    <div class="section-label" role="heading" aria-level="2" style="margin-top:0;">Skills by stage</div>
    <div class="card">
      ${sk.SKILL_STATES.map(st=>`
        <div style="display:flex; align-items:center; gap:10px; padding:5px 0;">
          <span style="width:9px; height:9px; border-radius:50%; background:${sk.STATE_COLOR[st]}; flex:none;"></span>
          <div style="flex:1; font-size:13.5px;">${sk.esc(st)}</div>
          <div style="font-size:13.5px; font-weight:700;">${counts[st]||0}</div>
        </div>
      `).join("")}
      <div style="display:flex; justify-content:flex-end; margin-top:6px; padding-top:8px; border-top:1px solid var(--line); font-size:11.5px; color:var(--ink-soft);">
        ${skillTotal} skills tracked in total
      </div>
    </div>

    <div class="section-label" role="heading" aria-level="2">Progress by category</div>
    <div class="card">
      ${categoryProgress.length ? categoryProgress.map(([cat,v])=>`
        <div style="display:flex; align-items:center; gap:10px; margin-bottom:8px;">
          <div style="width:130px; font-size:11.5px; color:var(--ink-soft); overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${sk.esc(cat)}</div>
          <div class="progress-track" style="flex:1;"><div class="progress-fill" style="width:${Math.round(v.done/v.total*100)}%; background:var(${sk.getCategoryVar(cat)})"></div></div>
          <div style="width:34px; text-align:right; font-size:12px; font-weight:700;">${Math.round(v.done/v.total*100)}%</div>
        </div>`).join("") : `<p style="font-size:13px; color:var(--ink-soft); margin:0;">Complete a few lessons to see progress by category here.</p>`}
    </div>
  `);
}

sk.SCREEN_RENDERERS.home = renderHome;
window.__sk.setTopbar = setTopbar;
window.__sk.suggestedLesson = suggestedLesson;
window.__sk.openClickerModal = openClickerModal;
window.__sk.openGamesModal = openGamesModal;
window.__sk.openWeightTracker = openWeightTracker;
window.__sk.todaysSessionLessons = todaysSessionLessons;
window.__sk.recentStruggleNote = recentStruggleNote;
window.__sk.overallProgressPercent = overallProgressPercent;
window.__sk.longestStreakEver = longestStreakEver;
window.__sk.totalLessonsCompleted = totalLessonsCompleted;
window.__sk.skillSummary = skillSummary;
window.__sk.trainingStreak = trainingStreak;
window.__sk.praiseWordFor = praiseWordFor;
window.__sk.recentSessions = recentSessions;
})();

/* ============================================================
   LESSON LIBRARY (list + filter/search)
   ============================================================ */
(function(){
const sk = window.__sk;

function renderLessons(container){
  sk.setTopbar("Train", sk.KB.collections.lessons.length+" lessons in the library", "");
  const f = sk.lessonFilter;
  const dog = sk.getCurrentDog();

  container.innerHTML = `
    ${dog ? `
    <button class="row" id="viewSkillsRow" style="margin-bottom:14px;">
      <div class="row-tab" style="background:var(--forest)"></div>
      <div class="row-body"><div class="row-title">🎯 ${sk.esc(dog.name)}'s skills</div><div class="row-meta">Track progress across all ${sk.KB.collections.skills.length} tracked skills</div></div>
      <span class="row-chev">›</span>
    </button>` : ""}
    <div class="search-input-wrap">
      <span class="sicon">🔍</span>
      <input type="text" id="lessonSearch" placeholder="Search lessons…" value="${sk.esc(f.query)}">
    </div>
    <div class="chip-group" id="catChips" style="flex-wrap:nowrap; overflow-x:auto; padding-bottom:4px; margin-bottom:10px;">
      <button class="chip${f.category==='All'?' selected':''}" data-val="All">All</button>
      <button class="chip${f.category==='★ Favourites'?' selected':''}" data-val="★ Favourites">★ Favourites</button>
      ${sk.IDX.categories.map(c=>`<button class="chip${f.category===c?' selected':''}" data-val="${sk.esc(c)}">${sk.getCategoryIcon(c)} ${sk.esc(c)}</button>`).join("")}
    </div>
    <div class="chip-group" id="diffChips" style="flex-wrap:nowrap; overflow-x:auto; padding-bottom:2px;">
      ${["All","Beginner","Intermediate","Advanced"].map(d=>`<button class="chip${f.difficulty===d?' selected':''}" data-val="${d}">${d}</button>`).join("")}
    </div>
    <div id="lessonResults"></div>
  `;
  const viewSkillsRow = container.querySelector("#viewSkillsRow");
  if(viewSkillsRow) viewSkillsRow.addEventListener("click", ()=>sk.goScreen("skills"));

  function applyFilter(){
    let list = sk.KB.collections.lessons;
    if(f.category==="★ Favourites") list = list.filter(l=>sk.isFavourite(l.lesson_id));
    else if(f.category!=="All") list = list.filter(l=>l.category===f.category);
    if(f.difficulty!=="All") list = list.filter(l=>l.difficulty===f.difficulty);
    if(f.query.trim()){
      const q = f.query.trim().toLowerCase();
      list = list.filter(l=>
        l.title.toLowerCase().includes(q) ||
        (l.objective||"").toLowerCase().includes(q) ||
        (l.success_criteria||"").toLowerCase().includes(q) ||
        (l.common_mistakes||"").toLowerCase().includes(q)
      );
    }
    return list;
  }

  function paint(){
    const list = applyFilter();
    const resultsEl = container.querySelector("#lessonResults");
    if(!list.length){
      const msg = f.category==="★ Favourites"
        ? "No favourites yet — tap the star on any lesson to pin it here."
        : "No lessons match. Try another search or category.";
      resultsEl.innerHTML = `<div class="empty-state"><span class="glyph">${f.category==="★ Favourites"?"★":"🔎"}</span>${msg}</div>`;
      return;
    }
    const dog = sk.getCurrentDog();
    const progress = dog ? (sk.DB.lessonProgress[dog.id]||{}) : {};
    resultsEl.innerHTML = `<div class="row-list">${list.map(l=>{
      const p = progress[l.lesson_id];
      const done = p && p.timesCompleted;
      const fav = sk.isFavourite(l.lesson_id);
      return `<button class="row" data-id="${l.lesson_id}">
        <div class="row-tab" style="background:var(${sk.getCategoryVar(l.category)})"></div>
        <div class="row-body">
          <div class="row-title">${fav?'★ ':''}${sk.esc(l.title)}</div>
          <div class="row-meta">
            <span class="badge badge-outline">${sk.esc(l.difficulty)}</span>
            <span>${sk.esc(l.session_length_min)} min</span>
            ${l.safety_gate_ids ? '<span class="badge badge-red">⚠ safety</span>' : ""}
            ${done ? '<span>· trained '+done+'×</span>' : ""}
          </div>
        </div>
        <span class="row-chev">›</span>
      </button>`;
    }).join("")}</div>`;
    resultsEl.querySelectorAll(".row[data-id]").forEach(r=>{
      r.addEventListener("click", ()=>sk.openLessonDetail(r.dataset.id));
    });
  }

  container.querySelector("#lessonSearch").addEventListener("input", (e)=>{ f.query = e.target.value; paint(); });
  container.querySelector("#catChips").addEventListener("click", e=>{
    const b = e.target.closest(".chip"); if(!b) return;
    f.category = b.dataset.val;
    container.querySelectorAll("#catChips .chip").forEach(c=>c.classList.remove("selected"));
    b.classList.add("selected"); paint();
  });
  container.querySelector("#diffChips").addEventListener("click", e=>{
    const b = e.target.closest(".chip"); if(!b) return;
    f.difficulty = b.dataset.val;
    container.querySelectorAll("#diffChips .chip").forEach(c=>c.classList.remove("selected"));
    b.classList.add("selected"); paint();
  });
  paint();
}

sk.SCREEN_RENDERERS.lessons = renderLessons;
})();

/* ============================================================
   LESSON DETAIL + SESSION (TRAINING) FLOW
   ============================================================ */
(function(){
const sk = window.__sk;

function severityClass(severity){
  if(!severity) return "banner-green";
  if(severity.includes("Red")) return "banner-red";
  if(severity.includes("Amber")) return "banner-amber";
  return "banner-green";
}
function safetyGateBanners(idsStr){
  const ids = sk.splitSemi(idsStr);
  if(!ids.length) return "";
  return ids.map(id=>{
    const g = sk.IDX.safetyGatesById.get(id);
    if(!g) return "";
    const cls = severityClass(g.severity);
    return `<div class="banner ${cls}"><span class="glyph">⚠️</span><div><strong>${sk.esc(g.name)}</strong><br><span style="font-size:12.5px;">${sk.esc(g.trigger)}</span><br>${sk.esc(g.action)}</div></div>`;
  }).join("");
}

function sourcesLine(idsStr){
  const ids = sk.splitSemi(idsStr).length ? sk.splitSemi(idsStr) : sk.splitPipe(idsStr);
  if(!ids.length) return "";
  const names = ids.map(id=>{
    const s = sk.IDX.sourcesById.get(id);
    return s ? (s.organisation || s.name || s.source_name || id) : id;
  });
  return names.join(" · ");
}

// Renders each source as a tappable pill instead of plain text — lets
// someone actually inspect a citation (key finding, year, limitations,
// link to the original) rather than just seeing an organisation name.
function sourcesPillsHTML(idsStr){
  const ids = sk.splitSemi(idsStr).length ? sk.splitSemi(idsStr) : sk.splitPipe(idsStr);
  if(!ids.length) return "";
  return `<div style="margin-top:8px;">${ids.map(id=>{
    const s = sk.IDX.sourcesById.get(id);
    const label = s ? (s.organisation || s.name || s.source_name || id) : id;
    return `<span class="link-pill" data-source-id="${sk.esc(id)}" style="font-size:11px; padding:4px 10px;">${sk.esc(label)}</span>`;
  }).join("")}</div>`;
}

function openSourceDetail(sourceId){
  const s = sk.IDX.sourcesById.get(sourceId);
  if(!s) return;
  sk.openModal(`
    <h3 style="margin-bottom:2px;">${sk.esc(s.organisation || "Source")}</h3>
    <p style="font-size:13px; color:var(--ink-soft); margin-bottom:12px;">${sk.esc(s.title || "")}${s.year ? " · "+sk.esc(s.year) : ""}</p>
    ${s.evidence_type ? `<span class="badge badge-outline">${sk.esc(s.evidence_type)}</span>` : ""}
    ${s.key_finding ? `<div class="section-label" role="heading" aria-level="2">Key finding</div><p style="font-size:13.5px;">${sk.esc(s.key_finding)}</p>` : ""}
    ${s.limitations ? `<div class="section-label" role="heading" aria-level="2">Limitations</div><p style="font-size:13px; color:var(--ink-soft);">${sk.esc(s.limitations)}</p>` : ""}
    ${s.url ? `<a href="${sk.esc(s.url)}" target="_blank" rel="noopener" class="btn btn-secondary btn-block" style="margin-top:14px;">View original source ↗</a>` : ""}
  `);
  // Delegated so it works regardless of how the modal content was built.
  document.getElementById("modalSheet").querySelectorAll("a[target=_blank]").forEach(a=>{
    a.addEventListener("click", e=>e.stopPropagation());
  });
}

// Any screen that renders sourcesPillsHTML() needs this wired after render —
// delegate from the modal sheet / screen container since pills are added
// dynamically in many different places.
document.addEventListener("click", (e)=>{
  const pill = e.target.closest(".link-pill[data-source-id]");
  if(pill) openSourceDetail(pill.dataset.sourceId);
});

// ---------- Optional lesson media (images/video) ----------
// Schema (all fields optional, everything no-ops if absent — safe to add
// later without touching this code):
//   lesson.media = {
//     image: "url" or hero_image: "url",   // either key name works
//     video: "url" or hero_video: "url",   // YouTube link or direct .mp4 — either key name works
//     steps: [ {image:"url"} | {video:"url"} | null, ... ]  // parallel to lesson.steps
//   }
// Recommendation for whoever populates this later: keep media as real files
// referenced by URL/relative path (e.g. a data/media/ folder alongside
// knowledge_base.json), not base64-embedded in the JSON — the knowledge
// base is already 1.5MB and inline images at this lesson count would bloat
// it dramatically and hurt the service worker's cache performance.
function youtubeEmbedUrl(url){
  const m = String(url).match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/))([\w-]{11})/);
  return m ? `https://www.youtube.com/embed/${m[1]}` : null;
}
function renderMediaBlock(media){
  if(!media) return "";
  if(typeof media === "string") media = { image: media };
  const video = media.video || media.hero_video;
  const image = media.image || media.hero_image;
  if(video){
    const yt = youtubeEmbedUrl(video);
    if(yt) return `<div style="border-radius:var(--radius-m); overflow:hidden; margin-bottom:12px; aspect-ratio:16/9;"><iframe src="${sk.esc(yt)}" style="width:100%; height:100%; border:none;" allowfullscreen loading="lazy"></iframe></div>`;
    return `<video controls preload="none" style="width:100%; border-radius:var(--radius-m); margin-bottom:12px;" src="${sk.esc(video)}"></video>`;
  }
  if(image){
    return `<img src="${sk.esc(image)}" alt="" loading="lazy" style="width:100%; border-radius:var(--radius-m); margin-bottom:12px; display:block;">`;
  }
  return "";
}

// Reusable animated concept diagrams — for lessons with no photo/video yet,
// used only where a diagram genuinely explains the mechanic (not a general
// decoration). Each is 3 beats cycling in a CSS loop; falls back to a
// static side-by-side layout under prefers-reduced-motion automatically
// via CSS, no JS branching needed.
const CONCEPT_DIAGRAMS = {
  "marker-timing": [
    { label:"Dog notices", svg:'<circle cx="12" cy="12" r="9"/><circle cx="9" cy="10" r="1"/><circle cx="15" cy="10" r="1"/><path d="M8 15c1.2 1 2.6 1.5 4 1.5s2.8-.5 4-1.5"/>' },
    { label:"Mark it", svg:'<path d="M12 3v1.5M18.5 8.5c1.5 1.5 1.5 6-1 8H6.5c-2.5-2-2.5-6.5-1-8a6.5 6.5 0 0 1 13 0z"/><path d="M9.5 19.5a2.5 2.5 0 0 0 5 0"/>' },
    { label:"Reward!", svg:'<path d="M12 2v4M12 18v4M2 12h4M18 12h4M5 5l3 3M16 16l3 3M5 19l3-3M16 8l3-3"/><circle cx="12" cy="12" r="3"/>' },
  ],
  "trade": [
    { label:"Dog has item", svg:'<circle cx="12" cy="12" r="9"/><path d="M9 12h6M9 9h4M9 15h3"/>' },
    { label:"Offer a trade", svg:'<path d="M7 8h10M7 8l3-3M7 8l3 3M17 16H7M17 16l-3-3M17 16l-3 3"/>' },
    { label:"Fair swap", svg:'<path d="M9 11l2 2 4-4"/><circle cx="12" cy="12" r="9"/>' },
  ],
  "settle": [
    { label:"Cue settle", svg:'<rect x="3" y="10" width="18" height="8" rx="2"/><path d="M7 10V7a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v3"/>' },
    { label:"Reward calm", svg:'<path d="M12 21c-4-3-8-6.5-8-11a4.5 4.5 0 0 1 8-2.8A4.5 4.5 0 0 1 20 10c0 4.5-4 8-8 11z"/>' },
    { label:"Longer, calmer", svg:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.5 2"/>' },
  ],
  "lure-fade": [
    { label:"Lure with a treat", svg:'<path d="M8 13V6.5a1.5 1.5 0 0 1 3 0V12"/><path d="M11 12V4.5a1.5 1.5 0 0 1 3 0V12"/><path d="M14 12V6.5a1.5 1.5 0 0 1 3 0V13"/><path d="M17 13v-2a1.5 1.5 0 0 1 3 0v5a5 5 0 0 1-5 5h-2a5 5 0 0 1-4-2l-2.5-3.5a1.5 1.5 0 0 1 2.3-1.9L10 15"/><circle cx="13" cy="9" r="1.6" fill="currentColor" stroke="none"/>' },
    { label:"Dog moves into position", svg:'<path d="M5 13l4 4L19 7"/>' },
    { label:"Fade to signal only", svg:'<path d="M8 13V6.5a1.5 1.5 0 0 1 3 0V12"/><path d="M11 12V4.5a1.5 1.5 0 0 1 3 0V12"/><path d="M14 12V6.5a1.5 1.5 0 0 1 3 0V13"/><path d="M17 13v-2a1.5 1.5 0 0 1 3 0v5a5 5 0 0 1-5 5h-2a5 5 0 0 1-4-2l-2.5-3.5a1.5 1.5 0 0 1 2.3-1.9L10 15"/>' },
  ],
  "recall": [
    { label:"Call your dog", svg:'<path d="M3 10v4a1 1 0 0 0 1 1h3l4 4V5L7 9H4a1 1 0 0 0-1 1z"/><path d="M16 9a3 3 0 0 1 0 6M19 6a7 7 0 0 1 0 12"/>' },
    { label:"Dog runs to you", svg:'<path d="M4 12h11M11 8l4 4-4 4"/><circle cx="19" cy="12" r="2"/>' },
    { label:"Big reward!", svg:'<path d="M12 2v4M12 18v4M2 12h4M18 12h4M5 5l3 3M16 16l3 3M5 19l3-3M16 8l3-3"/><circle cx="12" cy="12" r="3"/>' },
  ],
  "leave-it": [
    { label:"Dog sees temptation", svg:'<path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6-10-6-10-6z"/><circle cx="12" cy="12" r="2.5"/>' },
    { label:"Chooses to leave it", svg:'<path d="M5 13l4 4L19 7"/>' },
    { label:"Reward the choice", svg:'<path d="M12 2v4M12 18v4M2 12h4M18 12h4M5 5l3 3M16 16l3 3M5 19l3-3M16 8l3-3"/><circle cx="12" cy="12" r="3"/>' },
  ],
  "hand-target": [
    { label:"Offer your palm", svg:'<path d="M8 13V6.5a1.5 1.5 0 0 1 3 0V12"/><path d="M11 12V4.5a1.5 1.5 0 0 1 3 0V12"/><path d="M14 12V6.5a1.5 1.5 0 0 1 3 0V13"/><path d="M17 13v-2a1.5 1.5 0 0 1 3 0v5a5 5 0 0 1-5 5h-2a5 5 0 0 1-4-2l-2.5-3.5a1.5 1.5 0 0 1 2.3-1.9L10 15"/>' },
    { label:"Nose meets hand", svg:'<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="4"/><circle cx="12" cy="12" r="0.8" fill="currentColor" stroke="none"/>' },
    { label:"Mark and reward", svg:'<path d="M12 2v4M12 18v4M2 12h4M18 12h4M5 5l3 3M16 16l3 3M5 19l3-3M16 8l3-3"/><circle cx="12" cy="12" r="3"/>' },
  ],
  "loose-lead": [
    { label:"Lead stays slack", svg:'<path d="M3 12c3-4 6 4 9 0s6-4 9 0"/>' },
    { label:"Dog stays close", svg:'<circle cx="7" cy="14" r="3"/><path d="M13 14h3"/><circle cx="19" cy="14" r="1.8"/>' },
    { label:"Reward the position", svg:'<path d="M12 2v4M12 18v4M2 12h4M18 12h4M5 5l3 3M16 16l3 3M5 19l3-3M16 8l3-3"/><circle cx="12" cy="12" r="3"/>' },
  ],
  "four-paws": [
    { label:"Dog wants to jump", svg:'<path d="M12 19V9M8 13l4-4 4 4"/><path d="M5 5l1.5 1.5M19 5l-1.5 1.5"/>' },
    { label:"Four paws stay down", svg:'<path d="M5 13l4 4L19 7"/>' },
    { label:"Reward calm greeting", svg:'<path d="M12 2v4M12 18v4M2 12h4M18 12h4M5 5l3 3M16 16l3 3M5 19l3-3M16 8l3-3"/><circle cx="12" cy="12" r="3"/>' },
  ],
  "chin-rest": [
    { label:"Offer open palm", svg:'<path d="M8 13V6.5a1.5 1.5 0 0 1 3 0V12"/><path d="M11 12V4.5a1.5 1.5 0 0 1 3 0V12"/><path d="M14 12V6.5a1.5 1.5 0 0 1 3 0V13"/><path d="M17 13v-2a1.5 1.5 0 0 1 3 0v5a5 5 0 0 1-5 5h-2a5 5 0 0 1-4-2l-2.5-3.5a1.5 1.5 0 0 1 2.3-1.9L10 15"/>' },
    { label:"Chin rests on palm", svg:'<path d="M8 13V6.5a1.5 1.5 0 0 1 3 0V12"/><path d="M11 12V4.5a1.5 1.5 0 0 1 3 0V12"/><path d="M14 12V6.5a1.5 1.5 0 0 1 3 0V13"/><path d="M17 13v-2a1.5 1.5 0 0 1 3 0v5a5 5 0 0 1-5 5h-2a5 5 0 0 1-4-2l-2.5-3.5a1.5 1.5 0 0 1 2.3-1.9L10 15"/><circle cx="10" cy="7" r="2.6" fill="currentColor" stroke="none"/>' },
    { label:"Free to lift away", svg:'<path d="M12 20V8M7 12l5-5 5 5"/>' },
  ],
  "wait-release": [
    { label:"Cue wait", svg:'<rect x="4" y="4" width="7" height="16" rx="1.5"/><rect x="13" y="4" width="7" height="16" rx="1.5"/>' },
    { label:"Holds position", svg:'<path d="M5 13l4 4L19 7"/>' },
    { label:"Release word = go", svg:'<path d="M5 12h11M12 7l5 5-5 5"/>' },
  ],
  "capturing": [
    { label:"Watch for it", svg:'<path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6-10-6-10-6z"/><circle cx="12" cy="12" r="2.5"/>' },
    { label:"It happens naturally", svg:'<path d="M12 2l2.4 7.2H22l-6 4.4 2.3 7.2-6.3-4.6-6.3 4.6 2.3-7.2-6-4.4h7.6z"/>' },
    { label:"Mark and reward", svg:'<path d="M12 2v4M12 18v4M2 12h4M18 12h4M5 5l3 3M16 16l3 3M5 19l3-3M16 8l3-3"/><circle cx="12" cy="12" r="3"/>' },
  ],
  "threshold-distance": [
    { label:"Calm at a distance", svg:'<circle cx="4" cy="12" r="2.2"/><circle cx="20" cy="12" r="2.2"/><path d="M8 12h8" stroke-dasharray="2 2"/>' },
    { label:"Notice tension rising", svg:'<circle cx="7" cy="12" r="2.2"/><circle cx="17" cy="12" r="2.2"/><path d="M11 12h2" stroke-dasharray="2 2"/><path d="M12 5v2M12 3.5h.01"/>' },
    { label:"Reward before reacting", svg:'<path d="M12 2v4M12 18v4M2 12h4M18 12h4M5 5l3 3M16 16l3 3M5 19l3-3M16 8l3-3"/><circle cx="12" cy="12" r="3"/>' },
  ],
  "redirect-chew": [
    { label:"Wrong item", svg:'<path d="M6 4c-1 3-1 13 0 16M18 4c1 3 1 13 0 16"/><circle cx="12" cy="12" r="9.5"/><path d="M6.5 6.5l11 11"/>' },
    { label:"Redirect to chew", svg:'<path d="M5 12h9M10 7l4 5-4 5"/><ellipse cx="20" cy="12" rx="2.5" ry="4"/>' },
    { label:"Reward the choice", svg:'<path d="M12 2v4M12 18v4M2 12h4M18 12h4M5 5l3 3M16 16l3 3M5 19l3-3M16 8l3-3"/><circle cx="12" cy="12" r="3"/>' },
  ],
  "pairing": [
    { label:"New thing appears", svg:'<circle cx="12" cy="12" r="8"/><path d="M12 5v2M12 3.5h.01"/>' },
    { label:"Pair with something good", svg:'<circle cx="6" cy="12" r="3.2"/><path d="M13 12h2"/><path d="M19 9v6"/><path d="M17 12h4"/>' },
    { label:"Builds good feelings", svg:'<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 1 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8z"/>' },
  ],
  "shaping": [
    { label:"Dog tries something", svg:'<circle cx="12" cy="12" r="9" stroke-dasharray="3 3"/><circle cx="12" cy="12" r="2" fill="currentColor" stroke="none"/>' },
    { label:"Closer attempts rewarded", svg:'<path d="M4 20v-4h4v-4h4V8h4V4"/>' },
    { label:"Full behaviour achieved", svg:'<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="4"/><circle cx="12" cy="12" r="0.8" fill="currentColor" stroke="none"/>' },
  ],
  "emergency-turn": [
    { label:"Notice trigger appear", svg:'<path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6-10-6-10-6z"/><circle cx="12" cy="12" r="2.5"/>' },
    { label:"Cue turn-away", svg:'<path d="M4 6v6a4 4 0 0 0 4 4h10M14 12l4 4-4 4"/>' },
    { label:"Calmly move away", svg:'<circle cx="16" cy="12" r="2.2"/><path d="M11 12H8" stroke-dasharray="2 2"/><path d="M3 8l3 4-3 4"/>' },
  ],
  "name-response": [
    { label:"Say name", svg:'<path d="M3 10v4a1 1 0 0 0 1 1h3l4 4V5L7 9H4a1 1 0 0 0-1 1z"/><path d="M16 9a3 3 0 0 1 0 6M19 6a7 7 0 0 1 0 12"/>' },
    { label:"Dog looks at you", svg:'<circle cx="12" cy="12" r="9"/><circle cx="9" cy="10" r="1"/><circle cx="15" cy="10" r="1"/><path d="M8 15c1.2 1 2.6 1.5 4 1.5s2.8-.5 4-1.5"/>' },
    { label:"Reward attention", svg:'<path d="M12 2v4M12 18v4M2 12h4M18 12h4M5 5l3 3M16 16l3 3M5 19l3-3M16 8l3-3"/><circle cx="12" cy="12" r="3"/>' },
  ],
  "alone-time": [
    { label:"Step away", svg:'<path d="M15 4h3a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1h-3"/><path d="M15 3v18"/><path d="M11 12h4"/><circle cx="10.5" cy="12" r="0.6" fill="currentColor" stroke="none"/>' },
    { label:"Dog settles", svg:'<circle cx="12" cy="12" r="9"/><circle cx="9" cy="10" r="1"/><circle cx="15" cy="10" r="1"/><path d="M8 15c1.2 1 2.6 1.5 4 1.5s2.8-.5 4-1.5"/>' },
    { label:"Return calmly", svg:'<path d="M5 13l4 4L19 7"/>' },
  ],
  "scent-search": [
    { label:"Scatter treats", svg:'<circle cx="12" cy="5" r="1.4" fill="currentColor" stroke="none"/><circle cx="7" cy="9" r="1.2" fill="currentColor" stroke="none"/><circle cx="17" cy="9" r="1.2" fill="currentColor" stroke="none"/><circle cx="9" cy="14" r="1" fill="currentColor" stroke="none"/><circle cx="15" cy="14" r="1" fill="currentColor" stroke="none"/><circle cx="12" cy="18" r="1" fill="currentColor" stroke="none"/>' },
    { label:"Dog sniffs and searches", svg:'<circle cx="10" cy="10" r="6"/><path d="M14.5 14.5L20 20"/>' },
    { label:"Finds and enjoys", svg:'<path d="M12 2v4M12 18v4M2 12h4M18 12h4M5 5l3 3M16 16l3 3M5 19l3-3M16 8l3-3"/><circle cx="12" cy="12" r="3"/>' },
  ],
  "touch-acceptance": [
    { label:"Touch happens", svg:'<path d="M8 13V6.5a1.5 1.5 0 0 1 3 0V12"/><path d="M11 12V4.5a1.5 1.5 0 0 1 3 0V12"/><path d="M14 12V6.5a1.5 1.5 0 0 1 3 0V13"/><path d="M17 13v-2a1.5 1.5 0 0 1 3 0v5a5 5 0 0 1-5 5h-2a5 5 0 0 1-4-2l-2.5-3.5a1.5 1.5 0 0 1 2.3-1.9L10 15"/>' },
    { label:"Dog stays relaxed", svg:'<circle cx="12" cy="12" r="9"/><circle cx="9" cy="10" r="1"/><circle cx="15" cy="10" r="1"/><path d="M8 15c1.2 1 2.6 1.5 4 1.5s2.8-.5 4-1.5"/>' },
    { label:"Reward calm", svg:'<path d="M12 2v4M12 18v4M2 12h4M18 12h4M5 5l3 3M16 16l3 3M5 19l3-3M16 8l3-3"/><circle cx="12" cy="12" r="3"/>' },
  ],
  "equipment-intro": [
    { label:"See equipment calmly", svg:'<path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6-10-6-10-6z"/><circle cx="12" cy="12" r="2.5"/>' },
    { label:"Calm approach", svg:'<path d="M5 13l4 4L19 7"/>' },
    { label:"Reward", svg:'<path d="M12 2v4M12 18v4M2 12h4M18 12h4M5 5l3 3M16 16l3 3M5 19l3-3M16 8l3-3"/><circle cx="12" cy="12" r="3"/>' },
  ],
  "toilet-training": [
    { label:"Take outside on schedule", svg:'<path d="M15 4h3a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1h-3"/><path d="M15 3v18"/><path d="M11 12h4"/><circle cx="10.5" cy="12" r="0.6" fill="currentColor" stroke="none"/>' },
    { label:"Dog toilets outside", svg:'<path d="M5 13l4 4L19 7"/>' },
    { label:"Reward immediately", svg:'<path d="M12 2v4M12 18v4M2 12h4M18 12h4M5 5l3 3M16 16l3 3M5 19l3-3M16 8l3-3"/><circle cx="12" cy="12" r="3"/>' },
  ],
  "retrieve": [
    { label:"Throw it", svg:'<path d="M4 18c4-8 12-8 16-14" stroke-dasharray="2 2.5"/><circle cx="20" cy="4" r="2" fill="currentColor" stroke="none"/>' },
    { label:"Dog picks it up", svg:'<circle cx="12" cy="12" r="9"/><path d="M9 12h2M13 12h2"/><circle cx="16" cy="12" r="1.4" fill="currentColor" stroke="none"/>' },
    { label:"Brings it back", svg:'<path d="M20 12H9M13 8l-4 4 4 4"/>' },
  ],
};
function conceptDiagramHTML(type){
  const beats = CONCEPT_DIAGRAMS[type];
  if(!beats) return "";
  return `<div class="concept-diagram">${beats.map((b,i)=>`
    <div class="concept-beat b${i+1}">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${b.svg}</svg>
      <span>${sk.esc(b.label)}</span>
    </div>`).join("")}</div>`;
}
// Only lessons that genuinely teach one of these mechanics get a diagram —
// not a blanket category match, which would attach it to unrelated lessons.
const LESSON_DIAGRAM = {
  "FND-002":"marker-timing", "FND-003":"marker-timing", "COM-015":"marker-timing",
  "COM-016":"marker-timing", "TROUBLE-011":"marker-timing",
  "SKL-022":"trade", "SKL-023":"trade", "SKL-024":"trade", "RG-005":"trade", "RG-006":"trade", "HOME-026":"trade", "CHEW-005":"trade",
  "CALM-001":"settle", "CALM-003":"settle", "SKL-029":"settle", "SKL-030":"settle", "SKL-031":"settle", "SKL-032":"settle", "CALM-020":"settle",
  "SKL-001":"lure-fade", "SKL-002":"lure-fade", "SKL-003":"lure-fade", "SKL-004":"lure-fade",
  "SKL-005":"lure-fade", "SKL-006":"lure-fade", "SKL-007":"lure-fade", "SKL-008":"lure-fade",
  "SKL-009":"lure-fade", "SKL-010":"lure-fade", "SKL-011":"lure-fade", "FND-007":"lure-fade",
  "REC-001":"recall", "REC-003":"recall", "REC-004":"recall",
  "REC-005":"recall", "REC-006":"recall", "REC-007":"recall", "REC-008":"recall",
  "REC-009":"recall", "REC-010":"recall", "REC-011":"recall", "REC-012":"recall", "REC-013":"recall",
  "REC-014":"recall", "REC-015":"recall", "REC-016":"recall", "REC-018":"recall", "REC-019":"recall",
  "REC-020":"recall", "REC-021":"recall", "REC-022":"recall", "REC-023":"recall", "REC-024":"recall",
  "REC-025":"recall", "REC-026":"recall", "REC-027":"recall", "REC-028":"recall",
  "SKL-025":"leave-it", "SKL-026":"leave-it", "SKL-027":"leave-it", "SKL-028":"leave-it",
  "COM-005":"hand-target", "COM-006":"hand-target", "COM-007":"hand-target", "TRK-001":"hand-target",
  "WAL-003":"loose-lead", "WAL-004":"loose-lead", "WAL-005":"loose-lead", "WAL-007":"loose-lead",
  "WAL-013":"loose-lead", "WAL-014":"loose-lead", "WAL-015":"loose-lead", "WAL-016":"loose-lead",
  "WAL-018":"loose-lead", "WAL-019":"loose-lead", "WAL-022":"loose-lead", "WAL-023":"loose-lead",
  "WAL-024":"loose-lead", "WAL-025":"loose-lead", "WAL-026":"loose-lead", "WAL-027":"loose-lead",
  "WAL-028":"loose-lead", "WAL-029":"loose-lead", "WAL-030":"loose-lead", "WAL-031":"loose-lead",
  "WAL-032":"loose-lead",
  "LIFE-001":"four-paws", "LIFE-002":"four-paws", "LIFE-003":"four-paws", "HOME-012":"four-paws",
  "SKL-012":"four-paws",
  "SKL-013":"wait-release", "SKL-014":"wait-release", "SKL-015":"wait-release",
  "SKL-016":"wait-release", "SKL-017":"wait-release", "SKL-018":"wait-release",
  "SKL-019":"wait-release", "SKL-020":"wait-release", "SKL-021":"wait-release",
  "LIFE-004":"wait-release", "LIFE-005":"wait-release",
  "CARE-014":"chin-rest", "CARE-015":"chin-rest", "CARE-016":"chin-rest",
  "FND-006":"capturing", "CALM-002":"capturing",
  "REACT-004":"threshold-distance", "REACT-010":"threshold-distance", "REACT-013":"threshold-distance",
  "REACT-014":"threshold-distance", "REACT-015":"threshold-distance", "OWN-002":"threshold-distance",
  "CHEW-006":"redirect-chew", "HOME-018":"redirect-chew", "LIFE-017":"redirect-chew",
  "SOC-008":"pairing", "SOC-009":"pairing", "SOC-010":"pairing",
  "ENR-011":"shaping", "FND-008":"shaping", "FND-009":"shaping",
  "REACT-006":"emergency-turn", "REACT-007":"emergency-turn", "WAL-008":"emergency-turn",
  "WAL-009":"emergency-turn", "WAL-010":"emergency-turn", "WAL-011":"emergency-turn", "WAL-012":"emergency-turn",
  "COM-001":"name-response", "COM-002":"name-response", "COM-009":"name-response",
  "LIFE-006":"wait-release", "LIFE-008":"wait-release", "LIFE-021":"wait-release",
  "LIFE-022":"wait-release", "LIFE-023":"wait-release", "LIFE-033":"wait-release", "LIFE-034":"wait-release",
  "LIFE-007":"settle", "LIFE-009":"settle", "LIFE-010":"settle", "LIFE-011":"settle",
  "CALM-004":"settle", "CALM-005":"settle", "CALM-006":"settle", "CALM-007":"settle",
  "CALM-008":"settle", "CALM-009":"settle", "CALM-010":"settle", "CALM-011":"settle",
  "CALM-012":"settle", "CALM-013":"settle", "CALM-014":"settle", "CALM-019":"settle",
  "CALM-021":"settle", "CALM-022":"settle", "CALM-023":"settle", "CALM-024":"settle",
  "CALM-015":"scent-search",
  "CALM-025":"wait-release",
  "LIFE-027":"settle", "LIFE-028":"settle", "LIFE-030":"settle", "LIFE-031":"settle", "LIFE-032":"settle",
  "LIFE-012":"leave-it", "LIFE-013":"leave-it", "LIFE-014":"leave-it", "LIFE-015":"leave-it",
  "LIFE-016":"leave-it", "LIFE-019":"leave-it", "LIFE-020":"leave-it",
  "LIFE-018":"trade",
  "LIFE-024":"loose-lead", "LIFE-025":"loose-lead", "LIFE-026":"loose-lead",
  "LIFE-029":"four-paws",
  "ALONE-003":"alone-time", "ALONE-004":"alone-time", "ALONE-005":"alone-time", "ALONE-006":"alone-time",
  "ALONE-007":"alone-time", "ALONE-008":"alone-time", "ALONE-009":"alone-time", "ALONE-011":"alone-time",
  "ALONE-012":"alone-time", "ALONE-013":"alone-time", "ALONE-014":"alone-time",
  "ENR-001":"scent-search", "ENR-002":"scent-search", "ENR-004":"scent-search", "ENR-005":"scent-search",
  "ENR-014":"scent-search", "ENR-015":"scent-search", "ENR-016":"scent-search",
  "CARE-001":"touch-acceptance", "CARE-002":"touch-acceptance", "CARE-003":"touch-acceptance",
  "CARE-004":"touch-acceptance", "CARE-005":"touch-acceptance", "CARE-006":"touch-acceptance",
  "CARE-012":"touch-acceptance", "CARE-013":"touch-acceptance", "CARE-017":"touch-acceptance",
  "CARE-019":"touch-acceptance", "CARE-020":"touch-acceptance", "CARE-022":"touch-acceptance",
  "CARE-024":"touch-acceptance", "CARE-027":"touch-acceptance",
  "CARE-007":"equipment-intro", "CARE-008":"equipment-intro", "CARE-009":"equipment-intro",
  "CARE-010":"equipment-intro", "CARE-011":"equipment-intro", "CARE-018":"equipment-intro",
  "CARE-021":"equipment-intro", "CARE-023":"equipment-intro",
  "HOME-009":"equipment-intro", "HOME-010":"equipment-intro",
  "HOME-001":"toilet-training", "HOME-002":"toilet-training", "HOME-003":"toilet-training",
  "HOME-004":"toilet-training", "HOME-005":"toilet-training", "HOME-008":"toilet-training",
  "TRK-002":"lure-fade", "TRK-003":"lure-fade", "TRK-004":"lure-fade", "TRK-005":"lure-fade",
  "TRK-006":"lure-fade", "TRK-007":"lure-fade", "TRK-008":"lure-fade", "TRK-009":"lure-fade",
  "TRK-010":"lure-fade", "TRK-016":"lure-fade", "TRK-017":"lure-fade",
  "TRK-015":"chin-rest",
  "TRK-022":"recall", "TRK-023":"recall",
  "TRK-024":"wait-release",
  "TRK-021":"loose-lead", "COM-008":"loose-lead",
  "TRK-018":"scent-search", "TRK-019":"scent-search", "TRK-020":"scent-search",
  "HOME-011":"pairing",
  "HOME-014":"wait-release", "HOME-015":"wait-release", "HOME-028":"wait-release",
  "COM-013":"wait-release", "COM-014":"wait-release",
  "HOME-020":"trade",
  "HOME-024":"settle", "HOME-025":"settle",
  "COM-003":"name-response", "COM-010":"name-response", "COM-011":"name-response",
  "COM-012":"name-response", "COM-018":"name-response", "COM-019":"name-response", "COM-020":"name-response",
  "COM-004":"hand-target",
  "FND-011":"lure-fade", "FND-012":"lure-fade",
  "ENR-003":"scent-search", "WAL-020":"scent-search",
  "ENR-006":"shaping", "ENR-007":"shaping", "ENR-012":"shaping", "ENR-013":"shaping",
  "RG-007":"pairing", "RG-008":"pairing", "RG-009":"pairing", "SOC-003":"pairing", "SOC-018":"pairing",
  "RG-010":"trade", "RG-014":"trade",
  "CHEW-007":"capturing",
  "CHEW-009":"alone-time",
  "SOC-004":"threshold-distance", "SOC-005":"threshold-distance", "SOC-006":"threshold-distance",
  "SOC-007":"threshold-distance", "SOC-011":"threshold-distance", "SOC-012":"threshold-distance",
  "SOC-013":"threshold-distance", "SOC-014":"threshold-distance", "SOC-015":"threshold-distance",
  "SOC-016":"threshold-distance", "SOC-017":"threshold-distance", "SOC-021":"threshold-distance",
  "SOC-022":"threshold-distance", "SOC-023":"threshold-distance", "SOC-026":"threshold-distance",
  "SOC-019":"leave-it", "SOC-020":"leave-it",
  "MOUTH-001":"redirect-chew", "MOUTH-002":"redirect-chew",
  "WAL-002":"equipment-intro", "CARE-025":"equipment-intro", "CARE-026":"equipment-intro", "CARE-028":"equipment-intro",
  "ALONE-002":"settle", "REACT-018":"settle", "ADV-022":"settle",
  "BARK-007":"capturing", "BARK-014":"capturing",
  "BARK-008":"emergency-turn", "BARK-009":"emergency-turn", "CHASE-006":"emergency-turn", "CHASE-007":"emergency-turn",
  "BARK-011":"pairing", "OWN-026":"pairing",
  "BARK-012":"four-paws",
  "BARK-017":"threshold-distance", "REACT-011":"threshold-distance", "REACT-012":"threshold-distance",
  "REACT-016":"threshold-distance", "REACT-020":"threshold-distance", "CHASE-013":"threshold-distance", "CHASE-014":"threshold-distance",
  "CHASE-003":"name-response", "CHASE-004":"name-response",
  "CHASE-005":"scent-search", "TRK-014":"scent-search", "TRK-026":"scent-search", "REACT-008":"scent-search",
  "CHASE-008":"recall",
  "CHASE-009":"wait-release", "CHASE-010":"wait-release",
  "CHASE-011":"leave-it", "CHASE-012":"leave-it", "REACT-009":"leave-it",
  "OWN-010":"lure-fade",
  "TRK-011":"retrieve", "TRK-012":"retrieve", "TRK-013":"retrieve",
  "ADV-018":"settle", "ADV-021":"settle",
  "FND-004":"marker-timing",
  "HOME-013":"pairing",
  "HOME-006":"toilet-training",
  "LIFE-036":"capturing",
  "BARK-015":"threshold-distance", "ADV-017":"threshold-distance", "TROUBLE-007":"threshold-distance", "SAFE-015":"threshold-distance",
  "TROUBLE-006":"settle",
  "SAFE-009":"recall", "REC-017":"recall",
  "WAL-017":"wait-release", "OWN-028":"wait-release",
  "WAL-033":"threshold-distance",
};

function openLessonDetail(lessonId){
  window.scrollTo(0,0);
  const l = sk.IDX.lessonsById.get(lessonId);
  if(!l) return;
  sk.setTabbarVisible(true); // detail views are read-only — safe to tab away anytime
  const dog = sk.getCurrentDog();
  const progress = dog ? sk.dogLessonProgress(dog.id, lessonId) : null;
  const steps = sk.splitPipe(l.steps);
  const mistakes = sk.splitPipe(l.common_mistakes);
  const related = sk.splitPipe(l.related_lessons);
  const prerequisites = sk.splitPipe(l.prerequisites);
  const regression = sk.splitPipe(l.regression);
  const progression = sk.splitPipe(l.progression);

  const isFav = sk.isFavourite(lessonId);
  sk.setTopbar(l.title, l.category, `<button class="icon-btn" id="favBtn" aria-label="${isFav?'Remove from favourites':'Add to favourites'}" style="${isFav?'color:var(--ochre);':''}">${isFav?'★':'☆'}</button><button class="icon-btn" id="backBtn" aria-label="Back">←</button>`);

  const container = document.getElementById("screens");
  const catVar = sk.getCategoryVar(l.category);
  const catIcon = sk.getCategoryIcon(l.category);
  const media = renderMediaBlock(l.media);
  container.innerHTML = `<div class="screen active" id="detailScreen">
    ${safetyGateBanners(l.safety_gate_ids)}

    ${media || conceptDiagramHTML(LESSON_DIAGRAM[l.lesson_id]) || `<div class="lesson-hero-fallback" style="background:var(--canvas-raised); border:1px dashed var(--line); color:var(${catVar});">${catIcon}</div>`}

    <p style="font-size:15px;">🎯 <strong>Today's goal:</strong> ${sk.esc(l.objective)}</p>

    <div class="stat-grid">
      <div class="stat-box"><div class="num" style="font-size:16px;">${sk.esc(l.session_length_min)} min</div><div class="lbl">Session length</div></div>
      <div class="stat-box"><div class="num" style="font-size:16px;">${sk.esc(l.difficulty)}</div><div class="lbl">Difficulty</div></div>
      <div class="stat-box"><div class="num" style="font-size:14px;">${sk.esc(l.equipment||"None")}</div><div class="lbl">Equipment</div></div>
    </div>

    ${prerequisites.length ? `
    <div class="section-label" role="heading" aria-level="2">Before you start</div>
    <div class="row-list" style="margin-bottom:14px;">${prerequisites.map(pid=>{
      const pl = sk.IDX.lessonsById.get(pid);
      if(!pl) return "";
      const done = dog && sk.dogLessonProgress(dog.id, pid);
      return `<button class="row" data-id="${pid}">
        <div class="row-tab" style="background:var(${sk.getCategoryVar(pl.category)})"></div>
        <div class="row-body"><div class="row-title">${sk.esc(pl.title)}</div><div class="row-meta">${sk.esc(pl.category)}</div></div>
        ${done ? '<span class="badge" style="background:var(--forest);color:#fff;">✓ done</span>' : '<span class="badge badge-outline">not started</span>'}
      </button>`;
    }).join("")}</div>` : ""}

    ${l.setup ? `<p style="font-size:14px; color:var(--ink-soft); margin-bottom:16px;"><strong style="color:var(--ink);">Setup:</strong> ${sk.esc(l.setup)}</p>` : ""}

    <div class="section-label" role="heading" aria-level="2">Let's practise</div>
    <div class="card">${steps.map((s,i)=>`<div class="step-item"><div class="step-num-lg" style="background:var(${catVar});">${i+1}</div><div style="padding-top:4px;">${sk.esc(s)}${(l.media&&l.media.steps&&l.media.steps[i])?renderMediaBlock(l.media.steps[i]):""}</div></div>`).join("")}</div>

    <button class="btn btn-primary btn-block" id="startBtn" style="margin-bottom:28px;">▶ Start training</button>

    <div style="display:flex; align-items:center; gap:10px; margin:4px 0 18px;">
      <div style="flex:1; height:1px; background:var(--line);"></div>
      <span style="font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:0.04em; color:var(--ink-soft);">📚 Learn more</span>
      <div style="flex:1; height:1px; background:var(--line);"></div>
    </div>

    <p style="color:var(--ink-soft); font-size:13.5px;"><strong>Why it matters:</strong> ${sk.esc(l.why_it_matters)}</p>

    <div class="section-label" role="heading" aria-level="2">Success criteria</div>
    <p style="font-size:14.5px;">${sk.esc(l.success_criteria)}</p>

    ${mistakes.length ? `<div class="section-label" role="heading" aria-level="2">Common mistakes</div>
    <div style="margin-bottom:16px;">${mistakes.map(m=>`<div class="checklist-item"><span class="dot"></span>${sk.esc(m)}</div>`).join("")}</div>` : ""}

    <div class="section-label" role="heading" aria-level="2">If it's too hard</div>
    <p style="font-size:14px; color:var(--ink-soft);">${regression.join(" · ")}</p>
    <div class="section-label" role="heading" aria-level="2">Ready for more?</div>
    <p style="font-size:14px; color:var(--ink-soft);">${progression.join(" · ")}</p>

    ${l.real_world_application ? `<div class="section-label" role="heading" aria-level="2">Using it in real life</div>
    <p style="font-size:14px; color:var(--ink-soft);">${sk.esc(l.real_world_application)}</p>` : ""}

    ${l.professional_help_if ? `<div class="banner banner-amber"><span class="glyph">🩺</span><div><strong>Get professional help if:</strong><br>${sk.esc(l.professional_help_if)}</div></div>` : ""}

    ${related.length ? `<div class="section-label" role="heading" aria-level="2">Related lessons</div>
    <div>${related.map(id=>{
      const rl = sk.IDX.lessonsById.get(id);
      return rl ? `<span class="link-pill" data-id="${id}">${sk.esc(rl.title)}</span>` : "";
    }).join("")}</div>` : ""}

    ${progress ? `<div class="section-label" role="heading" aria-level="2">Your progress</div>
    <p style="font-size:13.5px; color:var(--ink-soft);">
      Trained ${progress.timesCompleted}× · last ${sk.daysAgo(progress.lastPracticed)===0?"today":sk.daysAgo(progress.lastPracticed)+"d ago"} · avg success ${Math.round(progress.avgSuccess*100)}%
    </p>` : ""}

    ${dog ? `
    <div class="section-label" role="heading" aria-level="2">Your notes</div>
    <div class="card">
      <textarea id="lessonNoteInput" placeholder="e.g. worked better after a short walk first, struggles near the front door…" style="margin-bottom:8px;">${sk.esc(sk.getLessonNote(dog.id, lessonId))}</textarea>
      <button class="btn btn-secondary btn-sm" id="saveNoteBtn">Save note</button>
    </div>` : ""}

    ${sourcesLine(l.source_ids) ? `<p style="font-size:11.5px; color:var(--ink-soft); margin-top:18px;">Sources:</p>${sourcesPillsHTML(l.source_ids)}` : ""}
    ${l.evidence_level ? `<p style="font-size:11.5px; color:var(--ink-soft); margin-top:6px;">${sk.esc(l.evidence_level)}</p>` : ""}
    <button class="btn btn-ghost btn-block" id="printLessonBtn" style="margin-top:18px;">🖨️ Print this lesson</button>
  </div>`;

  document.getElementById("backBtn").addEventListener("click", ()=>sk.goScreen(sk.currentScreen));
  document.getElementById("printLessonBtn").addEventListener("click", ()=>sk.openLessonPrintView(l));
  document.getElementById("favBtn").addEventListener("click", ()=>{
    const nowFav = sk.toggleFavourite(lessonId);
    const btn = document.getElementById("favBtn");
    btn.textContent = nowFav ? "★" : "☆";
    btn.setAttribute("aria-label", nowFav ? "Remove from favourites" : "Add to favourites");
    btn.style.color = nowFav ? "var(--ochre)" : "";
    sk.showToast(nowFav ? "Added to favourites" : "Removed from favourites");
  });
  document.getElementById("startBtn").addEventListener("click", ()=>sk.startSession(lessonId));
  const noteBtn = document.getElementById("saveNoteBtn");
  if(noteBtn){
    noteBtn.addEventListener("click", ()=>{
      sk.setLessonNote(dog.id, lessonId, document.getElementById("lessonNoteInput").value);
      sk.showToast("Note saved.");
    });
  }
  container.querySelectorAll(".link-pill").forEach(p=>p.addEventListener("click", ()=>openLessonDetail(p.dataset.id)));
  container.querySelectorAll("#detailScreen .row[data-id]").forEach(r=>r.addEventListener("click", ()=>openLessonDetail(r.dataset.id)));
}

/* ---------- Session (training) flow ---------- */
function startSession(lessonId){
  const l = sk.IDX.lessonsById.get(lessonId);
  const dog = sk.getCurrentDog();
  if(!dog){ sk.showToast("Add a dog first."); return; }
  sk.setTabbarVisible(false); // in-progress reps — don't let a stray tab tap discard them
  sk.setActiveSession({ lessonId, reps:[], startedAt:Date.now() });
  renderSessionScreen();
}

function renderSessionScreen(){
  const session = sk.activeSession;
  const l = sk.IDX.lessonsById.get(session.lessonId);
  const dog = sk.getCurrentDog();
  const steps = sk.splitPipe(l.steps);
  sk.setTopbar(l.title, "Training session", `<button class="icon-btn" id="endBtn" aria-label="End session">✕</button>`);
  const container = document.getElementById("screens");
  container.innerHTML = `<div class="screen active">
    <div class="card" style="text-align:center;">
      <div class="badge" style="background:var(${sk.getCategoryVar(l.category)});color:#fff;">${sk.getCategoryIcon(l.category)} ${sk.esc(l.category)}</div>
      <p style="font-size:14px; margin:12px 0 4px; color:var(--ink-soft);">Tap after each repetition</p>
      <div style="font-size:12px; font-weight:700; text-transform:uppercase; letter-spacing:0.04em; color:var(--ink-soft); margin-top:6px;" id="repLabel">Rep 0</div>
      <div style="font-size:40px; font-weight:700; font-family:var(--font-display); margin:2px 0;" id="repCounter">0</div>
      <div style="display:flex; align-items:center; justify-content:center; gap:8px; margin-bottom:16px;">
        <div style="font-size:13px; color:var(--ink-soft);" id="repBreakdown">successful, 0 so far</div>
        <button type="button" id="undoRepBtn" aria-label="Undo last rep" style="display:none; border:none; background:none; color:var(--ink-soft); font-size:12px; text-decoration:underline; cursor:pointer; padding:0;">↩ Undo</button>
      </div>
      <div style="display:flex; gap:10px;">
        <button class="btn btn-primary btn-block" id="repSuccess">✓ Success</button>
        <button class="btn btn-ghost btn-block" id="repMiss">✗ No luck</button>
      </div>
      <button class="btn btn-secondary btn-block" id="clickerBtn" style="margin-top:10px;">🔨 Click</button>
    </div>

    <div class="section-label" role="heading" aria-level="2">
      What to do
      <button class="icon-btn" id="repeatStepsBtn" aria-label="Read steps aloud again" style="float:right; width:28px; height:28px; font-size:13px;">🔊</button>
    </div>
    <div class="card" id="stepsCard">
      ${steps.map((s,i)=>`<div class="step-item" data-step-idx="${i}"><div class="step-num-lg" style="background:var(${sk.getCategoryVar(l.category)});">${i+1}</div><div style="padding-top:4px;">${sk.esc(s)}</div></div>`).join("")}
    </div>

    <div class="section-label" role="heading" aria-level="2">Reminder</div>
    <div class="checklist-item"><span class="dot"></span>${sk.esc(l.success_criteria)}</div>

    <button class="btn btn-secondary btn-block" id="finishBtn" style="margin-top:16px;">Finish session</button>
  </div>`;

  const stepsSpoken = steps.map((s,i)=>`Step ${i+1}: ${s}`).join(". ");
  function speakSteps(){ sk.speak(`${l.title}. ${stepsSpoken}`); }
  speakSteps();

  // Cycles a highlight through the visible steps in time with the spoken
  // list above, so glancing at the screen mid-rep shows roughly where the
  // voice guidance is up to -- an approximation, not a precise sync, since
  // speech duration varies with device and voice.
  let highlightTimer = null;
  function highlightStepsInSequence(){
    clearTimeout(highlightTimer);
    const items = container.querySelectorAll("#stepsCard .step-item");
    items.forEach(it=>it.classList.remove("step-active"));
    let i = 0;
    const advance = ()=>{
      items.forEach(it=>it.classList.remove("step-active"));
      if(i >= items.length) return;
      items[i].classList.add("step-active");
      const words = steps[i].split(" ").length;
      const ms = Math.max(1400, words * 320);
      i++;
      highlightTimer = setTimeout(advance, ms);
    };
    advance();
  }
  if(sk.isVoiceEnabled()) highlightStepsInSequence();

  function paint(){
    const total = session.reps.length;
    const succ = session.reps.filter(r=>r).length;
    container.querySelector("#repLabel").textContent = "Rep "+total;
    container.querySelector("#repCounter").textContent = succ;
    const pct = total ? Math.round(succ/total*100) : 0;
    container.querySelector("#repBreakdown").textContent = total
      ? `successful${total>=3?" · 🔥 "+pct+"% success rate":""}`
      : "successful, 0 so far";
    container.querySelector("#undoRepBtn").style.display = total ? "inline" : "none";
  }
  container.querySelector("#repSuccess").addEventListener("click", ()=>{ session.reps.push(true); paint(); sk.speak(sk.praiseWordFor(dog)); });
  container.querySelector("#repMiss").addEventListener("click", ()=>{ session.reps.push(false); paint(); sk.speak("Okay, next one"); });
  container.querySelector("#undoRepBtn").addEventListener("click", ()=>{
    if(!session.reps.length) return;
    session.reps.pop();
    paint();
    sk.speak("Undone");
  });
  container.querySelector("#clickerBtn").addEventListener("click", sk.playClickSound);
  container.querySelector("#repeatStepsBtn").addEventListener("click", ()=>{ speakSteps(); if(sk.isVoiceEnabled()) highlightStepsInSequence(); });
  container.querySelector("#finishBtn").addEventListener("click", ()=>{
    clearTimeout(highlightTimer);
    const succ = session.reps.filter(r=>r).length;
    sk.speak(`Session finished. ${succ} out of ${session.reps.length} successful.`);
    renderFeedbackStep();
  });
  document.getElementById("endBtn").addEventListener("click", ()=>{
    clearTimeout(highlightTimer);
    sk.setActiveSession(null);
    openLessonDetail(l.lesson_id);
  });
}

// Shared verdict logic — combines the 80/60/40 success-rate heuristic
// (RULE-001) with the dog's felt difficulty (RULE-003 "stress override").
// Exported so the daily-programme runner can reuse the exact same,
// already-tested rule rather than re-implementing it.
function computeVerdict(l, dog, rate, feedback){
  const progressionHint = sk.splitPipe(l.progression)[0] || "Try a small increase in difficulty next time.";
  const regressionHint = sk.splitPipe(l.regression)[0] || "Make the setup a little easier next time.";
  if(feedback === "too difficult"){
    return {verdict:"regress", cls:"banner-amber",
      verdictText:"Welfare first — this felt too difficult for "+dog.name+", regardless of the rep count. "+regressionHint};
  }else if(feedback === "difficult" && rate < 0.8){
    return {verdict:"regress", cls:"banner-amber", verdictText:dog.name+" found this hard going. "+regressionHint};
  }else if(feedback === "difficult"){
    return {verdict:"repeat", cls:"banner-amber",
      verdictText:"Good reps, but it felt effortful for "+dog.name+" — repeat at this level before moving on."};
  }else if(rate >= 0.8){
    return {verdict:"progress", cls:"banner-green", verdictText:"Great work — ready to progress. "+progressionHint};
  }else if(rate >= 0.5){
    return {verdict:"repeat", cls:"banner-amber",
      verdictText:"Solid session — repeat at this level a little longer before moving on."};
  }else{
    return {verdict:"regress", cls:"banner-amber", verdictText:"No worries — make it easier next time. "+regressionHint};
  }
}

// Records one lesson attempt (a rep array + felt-difficulty feedback) into
// session history and lesson-progress stats. Used by both the single-lesson
// session flow and the daily-programme runner so they can never drift apart.
function recordLessonAttempt(dog, l, reps, feedback, programmeId){
  const total = reps.length;
  const successCount = reps.filter(r=>r).length;
  const rate = total ? successCount/total : 0;
  const rec = {
    id: sk.uid(), dogId: dog.id, lessonId: l.lesson_id,
    date: new Date().toISOString(), repCount: total, successCount, rate, feedback
  };
  if(programmeId) rec.programmeId = programmeId;
  sk.DB.sessions.push(rec);
  if(!sk.DB.lessonProgress[dog.id]) sk.DB.lessonProgress[dog.id] = {};
  const prior = sk.DB.lessonProgress[dog.id][l.lesson_id];
  const timesCompleted = (prior?prior.timesCompleted:0) + 1;
  const avgSuccess = prior ? (prior.avgSuccess*prior.timesCompleted + rate)/timesCompleted : rate;
  const {verdict, verdictText, cls} = computeVerdict(l, dog, rate, feedback);
  sk.DB.lessonProgress[dog.id][l.lesson_id] = {
    timesCompleted, avgSuccess, lastPracticed: rec.date,
    lastVerdict: verdict, lastFeedback: feedback
  };
  return { rate, successCount, total, verdict, verdictText, cls };
}

function renderFeedbackStep(){
  const session = sk.activeSession;
  const l = sk.IDX.lessonsById.get(session.lessonId);
  const total = session.reps.length;
  const succ = session.reps.filter(r=>r).length;
  const rate = total ? succ/total : 0;

  sk.setTopbar(l.title, "How did it go?", "");
  const container = document.getElementById("screens");
  container.innerHTML = `<div class="screen active">
    <div class="card" style="text-align:center;">
      <div style="font-size:28px; font-family:var(--font-display); font-weight:700;">${succ}/${total||0}</div>
      <div style="color:var(--ink-soft); font-size:13.5px;">successful repetitions (${Math.round(rate*100)}%)</div>
    </div>
    <div class="section-label" role="heading" aria-level="2">How did ${sk.getCurrentDog().name} find it?</div>
    <div class="chip-group" id="feedbackChips">
      ${sk.ADAPTIVE_FEEDBACK.map(f=>`<button type="button" class="chip" data-val="${f}">${sk.FEEDBACK_DISPLAY[f]}</button>`).join("")}
    </div>
    <button class="btn btn-primary btn-block" id="saveSessionBtn" disabled>Save session</button>
  </div>`;
  let feedback = null;
  container.querySelector("#feedbackChips").addEventListener("click", e=>{
    const b = e.target.closest(".chip"); if(!b) return;
    container.querySelectorAll("#feedbackChips .chip").forEach(c=>c.classList.remove("selected"));
    b.classList.add("selected"); feedback = b.dataset.val;
    container.querySelector("#saveSessionBtn").disabled = false;
  });
  container.querySelector("#saveSessionBtn").addEventListener("click", ()=>{
    saveSession(l, session, feedback);
  });
}

function saveSession(l, session, feedback){
  const dog = sk.getCurrentDog();
  const result = recordLessonAttempt(dog, l, session.reps, feedback);
  sk.saveDB();
  sk.setActiveSession(null);

  sk.setTopbar("Session saved", "", "");
  const container = document.getElementById("screens");
  container.innerHTML = `<div class="screen active" style="text-align:center; padding-top:32px;">
    <div style="font-size:44px;">🎉</div>
    <h2>Nice work!</h2>
    <p style="color:var(--ink-soft);">${sk.getCurrentDog().name} completed <strong>${sk.esc(l.title)}</strong>.</p>
    <div class="banner ${result.cls}" style="text-align:left;"><span class="glyph">${result.verdict==="progress"?"📈":result.verdict==="repeat"?"🔁":"🌱"}</span><div>${sk.esc(result.verdictText)}</div></div>
    <button class="btn btn-primary btn-block" id="doneBtn">Done</button>
  </div>`;
  container.querySelector("#doneBtn").addEventListener("click", ()=>sk.goScreen("home"));
}

window.__sk.openLessonDetail = openLessonDetail;
window.__sk.startSession = startSession;
window.__sk.severityClass = severityClass;
window.__sk.sourcesLine = sourcesLine;
window.__sk.sourcesPillsHTML = sourcesPillsHTML;
window.__sk.openSourceDetail = openSourceDetail;
function recalculateLessonProgress(dogId, lessonId){
  const sessions = sk.DB.sessions.filter(s=>s.dogId===dogId && s.lessonId===lessonId);
  if(!sessions.length){
    if(sk.DB.lessonProgress[dogId]) delete sk.DB.lessonProgress[dogId][lessonId];
    return;
  }
  const timesCompleted = sessions.length;
  const avgSuccess = sessions.reduce((sum,s)=>sum+s.rate,0)/timesCompleted;
  const lastPracticed = sessions.reduce((max,s)=> s.date>max?s.date:max, sessions[0].date);
  if(!sk.DB.lessonProgress[dogId]) sk.DB.lessonProgress[dogId] = {};
  sk.DB.lessonProgress[dogId][lessonId] = { timesCompleted, avgSuccess, lastPracticed };
}

// Deletes one logged session and rebuilds that lesson's aggregate stats from
// whatever sessions remain, rather than leaving stale timesCompleted/avgSuccess
// numbers that still counted the deleted attempt.
function deleteSession(sessionId){
  const idx = sk.DB.sessions.findIndex(s=>s.id===sessionId);
  if(idx===-1) return;
  const { dogId, lessonId } = sk.DB.sessions[idx];
  sk.DB.sessions.splice(idx,1);
  recalculateLessonProgress(dogId, lessonId);
  sk.saveDB();
}

window.__sk.recordLessonAttempt = recordLessonAttempt;
window.__sk.recalculateLessonProgress = recalculateLessonProgress;
window.__sk.deleteSession = deleteSession;
window.__sk.computeVerdict = computeVerdict;
window.__sk.LESSON_DIAGRAM = LESSON_DIAGRAM;
window.__sk.CONCEPT_DIAGRAMS = CONCEPT_DIAGRAMS;
})();

/* ============================================================
   BEHAVIOURS (issue navigator)
   ============================================================ */
(function(){
const sk = window.__sk;

// Map lesson_id category-prefix codes (used in behaviour.training_route text) to actual categories
const ROUTE_CODE_TO_CATEGORY = {
  "FND":"Foundation","COM":"Communication & Engagement","SKL":"Basic Skills","LIFE":"Life Skills",
  "CALM":"Calmness & Regulation","WAL":"Walking","REC":"Recall","SOC":"Socialisation","CARE":"Handling & Cooperative Care",
  "HOME":"Home Manners","ALONE":"Alone Time","BARK":"Barking","CHEW":"Chewing & Destruction","RG":"Resource Guarding",
  "CHASE":"Chasing & Predatory Behaviour","REACT":"Reactivity","ENR":"Enrichment","TRK":"Tricks & Games",
  "OWN":"Owner Skills","ASSESS":"Assessment","SAFE":"Safety & Referral","ADV":"Advanced / Real World","TROUBLE":"Troubleshooting"
};

// Several behaviours have a purpose-built decision-tree/engine lesson, but
// those lessons all live under the "Behaviour Assessment" category — a
// different category than the route text's own code words point to (e.g.
// behaviour BEH-003 Barking's route text says "BARK decision tree", but the
// actual lesson "Barking decision tree" is filed under Behaviour Assessment,
// not the Barking category). Category-code parsing alone can't find these,
// so they're mapped explicitly and surfaced separately, above the general
// route lessons.
const BEHAVIOUR_DECISION_TREE = {
  "BEH-001":"ASSESS-026", // Jumping up -> Jumping decision tree
  "BEH-002":"ASSESS-028", // Pulling on lead -> Pulling decision tree
  "BEH-003":"ASSESS-027", // Barking -> Barking decision tree
  "BEH-004":"ASSESS-029", // Growling -> Growling decision tree
  "BEH-005":"ASSESS-030", // Biting -> Biting decision tree
  "BEH-006":"ASSESS-035", // Resource guarding -> Resource guarding engine
  "BEH-007":"ASSESS-032", // Destruction -> Destruction decision tree
  "BEH-008":"ASSESS-031", // Toileting indoors -> Toileting decision tree
  // BEH-009 Chasing, BEH-010 Reactivity, BEH-011 Separation distress have no
  // dedicated decision-tree lesson in the data; their own category route
  // (CHASE / REACT / ALONE) already points somewhere sensible.
};
// Expands the internal category-code shorthand in a route string (e.g.
// "COM check-in → WAL loose lead") into full category names for display —
// the codes are a convenient internal shorthand, not something a user
// should have to decode.
function formatTrainingRoute(routeStr){
  if(!routeStr) return "";
  let out = routeStr;
  Object.keys(ROUTE_CODE_TO_CATEGORY).forEach(code=>{
    out = out.replace(new RegExp(`\\b${code}\\b`, "g"), ROUTE_CODE_TO_CATEGORY[code]);
  });
  return out;
}

// Behaviour-level severity, used to stop every behaviour looking equally
// alarming just because it has *a* safety gate attached. This is a
// deliberate editorial judgement, not derived mechanically from the gates'
// own severity — nearly every gate is itself marked "Red" (e.g. the
// child-interaction gate genuinely is serious *if that situation applies*),
// which would make common, usually-benign behaviours like jumping look as
// alarming as biting. The distinction here is how inherent the risk is to
// the behaviour as a whole, not whether an edge-case trigger exists.
const BEHAVIOUR_SEVERITY = {
  "BEH-001": "amber", // Jumping up — common, usually benign; child-interaction is a situational caveat
  "BEH-002": "amber", // Pulling on lead — common; traffic risk is situational, not inherent to pulling itself
  "BEH-003": "amber", // Barking — common; sudden-change-suggesting-pain is the situational caveat
  "BEH-004": "red",   // Growling — can precede a bite; genuine warning communication
  "BEH-005": "red",   // Biting — unambiguously safety-critical
  "BEH-006": "red",   // Resource guarding — can escalate to a bite
  "BEH-007": "amber", // Destruction — welfare/property concern, not physical danger to people
  "BEH-008": "amber", // Toileting indoors — medical-consideration caveat, not danger
  "BEH-009": "amber", // Chasing — situational traffic/wildlife risk, not aggression toward people
  "BEH-010": "red",   // Reactivity — can involve fear or aggression escalating
  "BEH-011": "amber", // Separation distress — welfare concern, not physical danger to others
};
function behaviourSeverity(b){
  return BEHAVIOUR_SEVERITY[b.behaviour_id] || "amber";
}

function extractRouteCategories(routeStr){
  const found = [];
  Object.keys(ROUTE_CODE_TO_CATEGORY).forEach(code=>{
    const re = new RegExp("\\b"+code+"\\b");
    if(re.test(routeStr) && !found.includes(ROUTE_CODE_TO_CATEGORY[code])) found.push(ROUTE_CODE_TO_CATEGORY[code]);
  });
  return found;
}

function renderBehaviours(container){
  sk.setTopbar("Behaviour guide", "Find management & training routes", "");
  const list = sk.KB.collections.behaviours;
  container.innerHTML = `
    <div class="search-input-wrap">
      <span class="sicon">🔍</span>
      <input type="text" id="behaviourSearch" placeholder="Search behaviours…">
    </div>
    <div id="behaviourResults"></div>
  `;
  function paint(query){
    const q = query.trim().toLowerCase();
    const filtered = q ? list.filter(b=>
      b.name.toLowerCase().includes(q) ||
      (b.category||"").toLowerCase().includes(q) ||
      (b.possible_functions||"").toLowerCase().includes(q)
    ) : list;
    const resultsEl = container.querySelector("#behaviourResults");
    if(!filtered.length){
      resultsEl.innerHTML = `<div class="empty-state"><span class="glyph">🔎</span>No behaviours match "${sk.esc(query)}".</div>`;
      return;
    }
    resultsEl.innerHTML = `<div class="row-list">${filtered.map(b=>{
      const sev = behaviourSeverity(b);
      const sevBadge = sev === "red"
        ? '<span style="color:var(--red); font-weight:700;">🔴 Safety-critical</span>'
        : sev === "amber"
          ? '<span style="color:var(--ochre-text); font-weight:600;">🟡 Consider</span>'
          : "";
      return `<button class="row" data-id="${b.behaviour_id}">
        <div class="row-tab" style="background:var(--sky)"></div>
        <div class="row-body">
          <div class="row-title">${sk.esc(b.name)}</div>
          <div class="row-meta">${sk.esc(b.category)}${sevBadge?' · '+sevBadge:''}</div>
        </div>
        <span class="row-chev">›</span>
      </button>`;
    }).join("")}</div>`;
    resultsEl.querySelectorAll(".row[data-id]").forEach(r=>r.addEventListener("click", ()=>openBehaviourDetail(r.dataset.id)));
  }
  container.querySelector("#behaviourSearch").addEventListener("input", e=>paint(e.target.value));
  paint("");
}

function openBehaviourDetail(id){
  window.scrollTo(0,0);
  const b = sk.IDX.behavioursById.get(id);
  if(!b) return;
  sk.setTabbarVisible(true); // read-only detail view
  sk.setTopbar(b.name, b.category, `<button class="icon-btn" id="backBtn" aria-label="Back">←</button>`);
  const cats = extractRouteCategories(b.training_route||"");
  const routeLessons = [];
  cats.forEach(cat=>{
    sk.KB.collections.lessons.filter(l=>l.category===cat).slice(0,3).forEach(l=>routeLessons.push(l));
  });
  const decisionTreeId = BEHAVIOUR_DECISION_TREE[id];
  const decisionTreeLesson = decisionTreeId ? sk.IDX.lessonsById.get(decisionTreeId) : null;
  const gateIds = sk.splitSemi(b.safety_gate_ids);
  const sev = behaviourSeverity(b);

  const container = document.getElementById("screens");
  container.innerHTML = `<div class="screen active">
    ${sev === "red" ? gateIds.map(gid=>{
      const g = sk.IDX.safetyGatesById.get(gid); if(!g) return "";
      const cls = sk.severityClass(g.severity);
      return `<div class="banner ${cls}"><span class="glyph">⚠️</span><div><strong>${sk.esc(g.name)}</strong><br><span style="font-size:12.5px;">${sk.esc(g.trigger)}</span><br>${sk.esc(g.action)}</div></div>`;
    }).join("") : gateIds.length ? `
      <div style="display:flex; gap:8px; align-items:flex-start; padding:10px 2px; margin-bottom:8px; font-size:13px; color:var(--ink-soft);">
        <span style="flex:none;">⚠️</span>
        <div><strong style="color:var(--ink);">Safety considerations:</strong> ${gateIds.map(gid=>{
          const g = sk.IDX.safetyGatesById.get(gid);
          return g ? sk.esc(g.trigger) : "";
        }).filter(Boolean).join(" ")} Use management and consider professional guidance if any of this applies.</div>
      </div>` : ""}

    <div class="section-label" role="heading" aria-level="2">Possible functions</div>
    <p style="font-size:14.5px;">${sk.esc(b.possible_functions)}</p>

    <div class="section-label" role="heading" aria-level="2">Management (do this now)</div>
    <p style="font-size:14.5px;">${sk.esc(b.management)}</p>

    ${decisionTreeLesson ? `
    <div class="section-label" role="heading" aria-level="2">Start with this assessment</div>
    <button class="row" data-id="${decisionTreeLesson.lesson_id}" style="background:var(--canvas-raised); border:1px solid var(--line); border-radius:var(--radius-m); margin-bottom:4px;">
      <div class="row-tab" style="background:var(--ochre)"></div>
      <div class="row-body"><div class="row-title">${sk.esc(decisionTreeLesson.title)}</div><div class="row-meta">Figure out the right path before diving into lessons</div></div>
      <span class="row-chev">›</span>
    </button>` : ""}

    <div class="section-label" role="heading" aria-level="2">Suggested training route</div>
    <p style="font-size:13px; color:var(--ink-soft);">${sk.esc(formatTrainingRoute(b.training_route))}</p>
    <div class="row-list">${routeLessons.map(l=>`
      <button class="row" data-id="${l.lesson_id}">
        <div class="row-tab" style="background:var(${sk.getCategoryVar(l.category)})"></div>
        <div class="row-body"><div class="row-title">${sk.esc(l.title)}</div><div class="row-meta">${sk.esc(l.category)} · ${sk.esc(l.difficulty)}</div></div>
        <span class="row-chev">›</span>
      </button>`).join("")}</div>
  </div>`;
  document.getElementById("backBtn").addEventListener("click", ()=>sk.goScreen("behaviours"));
  container.querySelectorAll(".row[data-id]").forEach(r=>r.addEventListener("click", ()=>sk.openLessonDetail(r.dataset.id)));
}

sk.SCREEN_RENDERERS.behaviours = renderBehaviours;
window.__sk.formatTrainingRoute = formatTrainingRoute;
})();

/* ============================================================
   SKILLS SCREEN
   ============================================================ */
(function(){
const sk = window.__sk;

// Curated skill -> anchor lesson mapping. Deliberately explicit rather than
// name-matched: substring matching on skill names produced false positives
// (e.g. skill "Sit" substring-matched lesson "Reward delivery POSITION",
// skill "Stand" matched "Sit from STANDing"). Each mapping below points to
// the first lesson in that skill's actual teaching sequence in the data.
const SKILL_LESSON_MAP = {
  "SKL-001":"COM-001",  // Name response -> Name game
  "SKL-002":"COM-003",  // Eye contact -> Eye contact
  "SKL-003":"COM-005",  // Hand target -> Hand target
  "SKL-004":"FND-002",  // Marker response -> Condition a marker
  "SKL-005":"SKL-001",  // Sit -> Teach sit
  "SKL-006":"SKL-006",  // Down -> Down from standing
  "SKL-007":"SKL-010",  // Stand -> Stand from sit
  "SKL-008":"SKL-013",  // Wait -> Wait for food bowl
  "SKL-009":"SKL-016",  // Stay -> Stay foundation
  "SKL-010":"SKL-025",  // Leave -> Leave closed hand
  "SKL-011":"SKL-022",  // Drop -> Drop with trade
  "SKL-012":"REC-001",  // Recall -> Choose recall cue
  "SKL-013":"WAL-004",  // Loose lead -> Reward loose lead
  "SKL-014":"WAL-009",  // This way -> This way cue
  "SKL-015":"CALM-003", // Settle -> Settle on mat
  "SKL-016":"SKL-029",  // Mat/place -> Go to mat
  "SKL-017":"CARE-014", // Cooperative chin rest -> Chin rest foundation
  "SKL-018":"CARE-008", // Harness acceptance -> Approach harness
  "SKL-019":"CARE-019", // Grooming tolerance -> Brush introduction
  "SKL-020":"HOME-001", // Toilet routine -> Toilet schedule foundation
  "SKL-021":"ALONE-002",// Alone-time coping -> Relaxation before absence
  "SKL-022":"COM-002",  // Check-in -> Voluntary check-in
  "SKL-023":"ENR-002",  // Find it -> Find-it
  "SKL-024":"TRK-009",  // Go around -> Go around cone
  "SKL-025":"SKL-022",  // Trade -> Drop with trade
  "SKL-026":"HOME-011", // Door manners -> Doorbell management
  "SKL-027":"LIFE-001", // Greeting -> Four paws on floor when greeting
  "SKL-028":"SOC-019",  // Dog neutrality -> Neutrality instead of greeting
  "SKL-029":"CALM-018", // Recovery -> Build recovery routine
  "SKL-030":"COM-012",  // Pattern game -> Pattern game
};
function findMatchingLesson(skillId){
  const lessonId = SKILL_LESSON_MAP[skillId];
  return lessonId ? sk.IDX.lessonsById.get(lessonId) : null;
}

function renderSkills(container){
  sk.setTopbar("Skills", sk.KB.collections.skills.length+" tracked skills", "");
  const dog = sk.getCurrentDog();
  if(!dog){ container.innerHTML = '<div class="empty-state">Add a dog to track skills.</div>'; return; }
  container.innerHTML = `
    <div class="search-input-wrap">
      <span class="sicon">🔍</span>
      <input type="text" id="skillSearch" placeholder="Search skills…">
    </div>
    <div id="skillResults"></div>
  `;
  function paint(query){
    const q = query.trim().toLowerCase();
    const filtered = q ? sk.KB.collections.skills.filter(s=>
      s.skill_name.toLowerCase().includes(q) || (s.definition||"").toLowerCase().includes(q)
    ) : sk.KB.collections.skills;
    const resultsEl = container.querySelector("#skillResults");
    if(!filtered.length){
      resultsEl.innerHTML = `<div class="empty-state"><span class="glyph">🔎</span>No skills match "${sk.esc(query)}".</div>`;
      return;
    }
    const bySub = {};
    filtered.forEach(s=>{ (bySub[s.subcategory] = bySub[s.subcategory]||[]).push(s); });
    resultsEl.innerHTML = Object.keys(bySub).map(sub=>`
      <div class="section-label" role="heading" aria-level="2">${sk.esc(sub)}</div>
      <div class="row-list">
        ${bySub[sub].map(s=>{
          const state = sk.dogSkillState(dog.id, s.skill_id);
          return `<button class="row" data-id="${s.skill_id}">
            <div class="row-tab" style="background:${sk.STATE_COLOR[state]}"></div>
            <div class="row-body">
              <div class="row-title">${sk.esc(s.skill_name)}</div>
              <div class="row-meta">${sk.esc(s.definition)}</div>
            </div>
            <span class="badge" style="background:${sk.STATE_COLOR[state]};color:#fff;">${state}</span>
          </button>`;
        }).join("")}
      </div>
    `).join("");
    resultsEl.querySelectorAll(".row[data-id]").forEach(r=>r.addEventListener("click", ()=>openSkillDetail(r.dataset.id)));
  }
  container.querySelector("#skillSearch").addEventListener("input", e=>paint(e.target.value));
  paint("");
}

function openSkillDetail(skillId){
  window.scrollTo(0,0);
  const s = sk.IDX.skillsById.get(skillId);
  const dog = sk.getCurrentDog();
  const state = sk.dogSkillState(dog.id, skillId);
  const linked = findMatchingLesson(s.skill_id);
  const html = `
    <h3>${sk.esc(s.skill_name)}</h3>
    <p style="color:var(--ink-soft); font-size:14px;">${sk.esc(s.definition)}</p>
    <div class="section-label" role="heading" aria-level="2">${sk.esc(dog.name)}'s current stage</div>
    <div class="chip-group">
      ${sk.SKILL_STATES.map(st=>`<button type="button" class="chip skillStateChip${st===state?' selected':''}" data-val="${st}" style="${st===state?'background:'+sk.STATE_COLOR[st]+';border-color:'+sk.STATE_COLOR[st]+';':''}">${st}</button>`).join("")}
    </div>
    <p style="font-size:11.5px; color:var(--ink-soft);">Measured by: ${sk.esc(s.measurement)}</p>
    ${linked ? `<button class="btn btn-secondary btn-block" id="goLessonBtn" style="margin-top:8px;">Open "${sk.esc(linked.title)}" lesson</button>` : ""}
  `;
  sk.openModal(html);
  const root = document.getElementById("modalSheet");
  root.querySelectorAll(".skillStateChip").forEach(chip=>{
    chip.addEventListener("click", ()=>{
      sk.setDogSkillState(dog.id, skillId, chip.dataset.val);
      sk.closeModal();
      sk.render();
    });
  });
  if(linked) root.querySelector("#goLessonBtn").addEventListener("click", ()=>{ sk.closeModal(); sk.openLessonDetail(linked.lesson_id); });
}

sk.SCREEN_RENDERERS.skills = renderSkills;
window.__sk.findMatchingLesson = findMatchingLesson;
})();

/* ============================================================
   MORE (dogs, daily programmes, safety, myths, data)
   ============================================================ */
(function(){
const sk = window.__sk;

function storageEstimateText(){
  try{
    const bytes = new Blob([JSON.stringify(sk.DB)]).size;
    return (bytes/1024).toFixed(0)+" KB used";
  }catch(e){ return ""; }
}

// A side-by-side comparison for households with more than one dog --
// reuses the same per-dog calculations as the individual Training Journey
// view, so the numbers here always agree with each dog's own page.
function openCompareDogs(){
  const dogs = sk.DB.dogs;
  sk.openModal(`
    <h3 style="text-align:center; margin-bottom:16px;">Compare dogs</h3>
    ${dogs.map(d=>{
      const pct = sk.overallProgressPercent(d.id);
      const streak = sk.trainingStreak(d.id);
      const lessons = sk.totalLessonsCompleted(d.id);
      const counts = sk.skillSummary(d.id);
      const reliableOrAbove = (counts["Reliable"]||0) + (counts["Generalising"]||0) + (counts["Life-ready"]||0);
      return `
        <div class="card">
          <div style="display:flex; align-items:center; gap:10px; margin-bottom:10px;">
            ${sk.dogAvatarHTML(d)}
            <div style="font-weight:700; font-size:15px;">${sk.esc(d.name)}</div>
          </div>
          <div style="display:flex; gap:8px;">
            <div style="flex:1; text-align:center; background:var(--canvas-raised); border-radius:10px; padding:8px 4px;">
              <div style="font-size:17px; font-weight:700; font-family:var(--font-display); color:var(--forest);">${pct}%</div>
              <div style="font-size:10px; color:var(--ink-soft);">progress</div>
            </div>
            <div style="flex:1; text-align:center; background:var(--canvas-raised); border-radius:10px; padding:8px 4px;">
              <div style="font-size:17px; font-weight:700; font-family:var(--font-display);">🔥 ${streak}</div>
              <div style="font-size:10px; color:var(--ink-soft);">streak</div>
            </div>
            <div style="flex:1; text-align:center; background:var(--canvas-raised); border-radius:10px; padding:8px 4px;">
              <div style="font-size:17px; font-weight:700; font-family:var(--font-display);">${lessons}</div>
              <div style="font-size:10px; color:var(--ink-soft);">lessons</div>
            </div>
            <div style="flex:1; text-align:center; background:var(--canvas-raised); border-radius:10px; padding:8px 4px;">
              <div style="font-size:17px; font-weight:700; font-family:var(--font-display);">${reliableOrAbove}</div>
              <div style="font-size:10px; color:var(--ink-soft);">reliable+</div>
            </div>
          </div>
        </div>
      `;
    }).join("")}
    <p style="font-size:11.5px; color:var(--ink-soft); text-align:center; margin-top:4px;">"Reliable+" counts skills at Reliable, Generalising, or Life-ready.</p>
  `);
}

function renderMore(container){
  sk.setTopbar("Profile", "Dog, safety & data", "");
  const dog = sk.getCurrentDog();
  const currentTheme = (sk.DB.settings && sk.DB.settings.theme) || "auto";
  const voiceOn = sk.isVoiceEnabled();
  const quietHours = sk.getQuietHours();
  const silentBypassOn = sk.isSilentModeBypassEnabled();
  container.innerHTML = `
    <div class="section-label" role="heading" aria-level="2">Dogs</div>
    <div class="row-list">
      ${sk.DB.dogs.map(d=>`
        <button class="row" data-dog="${d.id}">
          ${sk.dogAvatarHTML(d)}
          <div class="row-body"><div class="row-title">${sk.esc(d.name)}</div><div class="row-meta">${sk.esc(d.breed||d.ageStage)}</div></div>
          <span class="row-chev">›</span>
        </button>`).join("")}
      <button class="row" id="addDogRow"><div class="avatar" style="background:var(--line); color:var(--ink-soft);">+</div><div class="row-body"><div class="row-title">Add another dog</div></div></button>
      ${sk.DB.dogs.length > 1 ? `<button class="row" id="compareDogsRow"><div class="row-tab" style="background:var(--sky)"></div><div class="row-body"><div class="row-title">Compare dogs</div><div class="row-meta">Progress side by side</div></div><span class="row-chev">›</span></button>` : ""}
      <button class="row" id="trackWeightRow"><div class="row-tab" style="background:var(--ochre)"></div><div class="row-body"><div class="row-title">⚖️ Track weight</div><div class="row-meta">Log and chart weight over time</div></div><span class="row-chev">›</span></button>
    </div>

    <div class="section-label" role="heading" aria-level="2">Daily programmes</div>
    <div class="row-list">
      ${sk.KB.collections.daily_programmes.map(p=>`
        <button class="row" data-programme="${p.programme_id}">
          <div class="row-tab" style="background:var(--ochre)"></div>
          <div class="row-body"><div class="row-title">${sk.esc(p.name)}</div><div class="row-meta">${p.duration_min} min · ${sk.esc(p.route)}</div></div>
          <span class="row-chev">›</span>
        </button>`).join("")}
    </div>

    <div class="section-label" role="heading" aria-level="2">Troubleshoot</div>
    <div class="row-list">
      <button class="row" id="troubleshootRow"><div class="row-tab" style="background:var(--red)"></div><div class="row-body"><div class="row-title">My dog is...</div><div class="row-meta">Answer a couple of questions to find the right starting point</div></div><span class="row-chev">›</span></button>
    </div>

    <div class="section-label" role="heading" aria-level="2">Reference</div>
    <div class="row-list">
      <button class="row" id="safetyRow"><div class="row-tab" style="background:var(--red)"></div><div class="row-body"><div class="row-title">Safety gates</div><div class="row-meta">${sk.KB.collections.safety_gates.length} situations that need extra care</div></div><span class="row-chev">›</span></button>
      <button class="row" id="mythsRow"><div class="row-tab" style="background:var(--sky)"></div><div class="row-body"><div class="row-title">Myths & realities</div><div class="row-meta">${sk.KB.collections.myths.length} common misconceptions</div></div><span class="row-chev">›</span></button>
      <button class="row" id="bodyLangRow"><div class="row-tab" style="background:var(--ochre)"></div><div class="row-body"><div class="row-title">Dog body language guide</div><div class="row-meta">${sk.KB.collections.body_language_guide.length} states, what to look for</div></div><span class="row-chev">›</span></button>
      <button class="row" id="guidanceRow"><div class="row-tab" style="background:var(--forest)"></div><div class="row-body"><div class="row-title">Owner guidance</div><div class="row-meta">General principles for training well</div></div><span class="row-chev">›</span></button>
      <button class="row" id="evidenceRow"><div class="row-tab" style="background:var(--ochre)"></div><div class="row-body"><div class="row-title">Evidence library</div><div class="row-meta">${sk.KB.collections.evidence_cards.length} topics, what the evidence does and doesn't say</div></div><span class="row-chev">›</span></button>
      <button class="row" id="rulesRow"><div class="row-tab" style="background:var(--sky)"></div><div class="row-body"><div class="row-title">How progression works</div><div class="row-meta">The rules behind session recommendations</div></div><span class="row-chev">›</span></button>
      <button class="row" id="protocolsRow"><div class="row-tab" style="background:var(--forest)"></div><div class="row-body"><div class="row-title">Training protocols</div><div class="row-meta">${sk.KB.collections.protocols.length} core frameworks for common training situations</div></div><span class="row-chev">›</span></button>
      <button class="row" id="mediaGalleryRow"><div class="row-tab" style="background:var(--ochre)"></div><div class="row-body"><div class="row-title">Media gallery</div><div class="row-meta">Every lesson with a real photo, in one place</div></div><span class="row-chev">›</span></button>
    </div>

    <div class="section-label" role="heading" aria-level="2">Appearance</div>
    <div class="card">
      <div class="chip-group" id="themeChips" style="margin-bottom:0;">
        ${[["light","☀️ Light"],["auto","🌓 Auto"],["dark","🌙 Dark"]].map(([val,label])=>
          `<button type="button" class="chip${currentTheme===val?' selected':''}" data-val="${val}">${label}</button>`
        ).join("")}
      </div>
      <p style="font-size:11.5px; color:var(--ink-soft); margin:8px 0 0;">Auto follows your device's setting.</p>
    </div>

    <div class="section-label" role="heading" aria-level="2">Voice guidance</div>
    <div class="card">
      <div style="display:flex; align-items:center; gap:12px;">
        <div style="flex:1;">
          <div style="font-weight:600; font-size:14px;">Speak during training</div>
          <div style="font-size:12px; color:var(--ink-soft); margin-top:2px;">Hear step reminders and rep feedback out loud — useful when your hands are full.</div>
        </div>
        <button type="button" id="voiceToggle" role="switch" aria-checked="${voiceOn}" aria-label="Speak during training" style="flex:none; width:46px; height:27px; border-radius:14px; border:none; background:${voiceOn?'var(--forest)':'var(--line)'}; position:relative; cursor:pointer; padding:0;">
          <span style="position:absolute; top:2px; left:${voiceOn?'21px':'2px'}; width:23px; height:23px; border-radius:50%; background:#fff; transition:left 0.15s;"></span>
        </button>
      </div>
      ${voiceOn ? `
      <div style="margin-top:12px;">
        <label for="voiceSelect" style="font-size:12.5px; color:var(--ink-soft); display:block; margin-bottom:6px;">Voice</label>
        <select id="voiceSelect" style="width:100%; padding:10px; border-radius:8px; border:1px solid var(--line); background:var(--canvas-raised); color:var(--ink);">
          <option value="">Device default</option>
        </select>
      </div>` : ""}
      <div style="border-top:1px solid var(--line); margin-top:14px; padding-top:14px; display:flex; align-items:center; gap:12px;">
        <div style="flex:1;">
          <div style="font-weight:600; font-size:14px;">Quiet hours</div>
          <div style="font-size:12px; color:var(--ink-soft); margin-top:2px;">Stay silent during this window, even if voice guidance is on.</div>
        </div>
        <button type="button" id="quietHoursToggle" role="switch" aria-checked="${quietHours.enabled}" aria-label="Enable quiet hours" style="flex:none; width:46px; height:27px; border-radius:14px; border:none; background:${quietHours.enabled?'var(--forest)':'var(--line)'}; position:relative; cursor:pointer; padding:0;">
          <span style="position:absolute; top:2px; left:${quietHours.enabled?'21px':'2px'}; width:23px; height:23px; border-radius:50%; background:#fff; transition:left 0.15s;"></span>
        </button>
      </div>
      ${quietHours.enabled ? `
      <div style="display:flex; gap:10px; margin-top:12px; align-items:center;">
        <label for="quietHoursStart" style="font-size:12.5px; color:var(--ink-soft); flex:none;">From</label>
        <input type="time" id="quietHoursStart" value="${quietHours.start}" style="flex:1; padding:8px; border-radius:8px; border:1px solid var(--line); background:var(--canvas-raised); color:var(--ink);">
        <label for="quietHoursEnd" style="font-size:12.5px; color:var(--ink-soft); flex:none;">to</label>
        <input type="time" id="quietHoursEnd" value="${quietHours.end}" style="flex:1; padding:8px; border-radius:8px; border:1px solid var(--line); background:var(--canvas-raised); color:var(--ink);">
      </div>` : ""}
    </div>

    <div class="section-label" role="heading" aria-level="2">Clicker</div>
    <div class="card">
      <div style="display:flex; align-items:center; gap:12px;">
        <div style="flex:1;">
          <div style="font-weight:600; font-size:14px;">Try to play even on silent mode</div>
          <div style="font-size:12px; color:var(--ink-soft); margin-top:2px;">Experimental. Uses an undocumented iOS behaviour that isn't guaranteed to work on every device, and Apple could change it at any time.</div>
        </div>
        <button type="button" id="silentBypassToggle" role="switch" aria-checked="${silentBypassOn}" aria-label="Try to play the clicker even on silent mode" style="flex:none; width:46px; height:27px; border-radius:14px; border:none; background:${silentBypassOn?'var(--forest)':'var(--line)'}; position:relative; cursor:pointer; padding:0;">
          <span style="position:absolute; top:2px; left:${silentBypassOn?'21px':'2px'}; width:23px; height:23px; border-radius:50%; background:#fff; transition:left 0.15s;"></span>
        </button>
      </div>
    </div>

    <div class="section-label" role="heading" aria-level="2">Content check</div>
    <div class="card">
      <p style="font-size:13px; color:var(--ink-soft); margin-bottom:10px;">Scans the training library for broken references, missing fields, and media issues — useful after adding new lesson content.</p>
      <button class="btn btn-secondary btn-block" id="integrityBtn">Run data check</button>
      <div id="integrityResults" style="margin-top:12px;"></div>
    </div>

    <div class="section-label" role="heading" aria-level="2">Data</div>
    <div class="card">
      <p style="font-size:13px; color:var(--ink-soft); margin-bottom:10px;">${storageEstimateText()} · stored only on this device.</p>
      <button class="btn btn-secondary btn-block" id="exportBtn">Export backup (.json)</button>
      <button class="btn btn-ghost btn-block" id="importBtn" style="margin-top:8px;">Import backup</button>
      <input type="file" id="importFile" accept="application/json" style="display:none;">
      <button class="btn btn-secondary btn-block" id="reportBtn" style="margin-top:8px;">Training report (shareable summary)</button>
      <button class="btn btn-secondary btn-block" id="certBtn" style="margin-top:8px;">🏅 Certificate of achievement</button>
      <button class="btn btn-secondary btn-block" id="printLogBtn" style="margin-top:8px;">Print / export full training log</button>
      <button class="btn btn-danger btn-block" id="resetBtn" style="margin-top:8px;">Reset all data</button>
    </div>

    <div class="section-label" role="heading" aria-level="2">Sidekick</div>
    <div class="row-list">
      <button class="row" id="aboutRow"><div class="row-tab" style="background:var(--forest)"></div><div class="row-body"><div class="row-title">About Sidekick</div><div class="row-meta">Support, other apps, privacy & version</div></div><span class="row-chev">›</span></button>
    </div>
  `;

  container.querySelector("#aboutRow").addEventListener("click", ()=>sk.goScreen("about"));
  container.querySelectorAll("[data-dog]").forEach(r=>r.addEventListener("click", ()=>{
    const d = sk.DB.dogs.find(x=>x.id===r.dataset.dog);
    sk.renderDogForm(d);
  }));
  container.querySelector("#addDogRow").addEventListener("click", ()=>sk.renderDogForm(null));
  const compareBtn = container.querySelector("#compareDogsRow");
  if(compareBtn) compareBtn.addEventListener("click", openCompareDogs);
  container.querySelector("#trackWeightRow").addEventListener("click", ()=>sk.openWeightTracker());
  container.querySelectorAll("[data-programme]").forEach(r=>r.addEventListener("click", ()=>openProgrammeDetail(r.dataset.programme)));
  container.querySelector("#safetyRow").addEventListener("click", openSafetyReference);
  container.querySelector("#mythsRow").addEventListener("click", openMythsReference);
  container.querySelector("#bodyLangRow").addEventListener("click", openBodyLanguageGuide);
  container.querySelector("#guidanceRow").addEventListener("click", openGuidanceReference);
  container.querySelector("#troubleshootRow").addEventListener("click", openTroubleshootPicker);
  container.querySelector("#evidenceRow").addEventListener("click", openEvidenceReference);
  container.querySelector("#rulesRow").addEventListener("click", openRulesReference);
  container.querySelector("#protocolsRow").addEventListener("click", openProtocolsReference);
  container.querySelector("#mediaGalleryRow").addEventListener("click", openMediaGallery);
  container.querySelector("#themeChips").addEventListener("click", e=>{
    const b = e.target.closest(".chip"); if(!b) return;
    container.querySelectorAll("#themeChips .chip").forEach(c=>c.classList.remove("selected"));
    b.classList.add("selected");
    sk.setTheme(b.dataset.val);
  });
  container.querySelector("#voiceToggle").addEventListener("click", ()=>{
    const now = !sk.isVoiceEnabled();
    sk.setVoiceEnabled(now);
    renderMore(container); // repaint so the switch position and aria-checked update
    if(now) sk.speak("Voice guidance on");
  });
  const voiceSelect = container.querySelector("#voiceSelect");
  if(voiceSelect){
    function populateVoiceOptions(){
      const voices = sk.getAvailableVoices().filter(v=>v.lang && v.lang.startsWith("en"));
      const selectedURI = sk.getSelectedVoiceURI();
      const list = voices.length ? voices : sk.getAvailableVoices(); // fall back to all if no English voices reported
      voiceSelect.innerHTML = '<option value="">Device default</option>' +
        list.map(v=>`<option value="${sk.esc(v.voiceURI)}"${v.voiceURI===selectedURI?" selected":""}>${sk.esc(v.name)}${v.lang?" ("+sk.esc(v.lang)+")":""}</option>`).join("");
    }
    populateVoiceOptions();
    // Voice lists load asynchronously in some browsers -- repopulate once
    // the browser actually finishes enumerating them, so the dropdown
    // doesn't stay stuck on just "Device default" on a first-ever visit.
    if("speechSynthesis" in window) window.speechSynthesis.addEventListener("voiceschanged", populateVoiceOptions, {once:true});
    voiceSelect.addEventListener("change", ()=>{
      sk.setSelectedVoiceURI(voiceSelect.value);
      sk.speak("This is how I'll sound during training.");
    });
  }
  container.querySelector("#quietHoursToggle").addEventListener("click", ()=>{
    const q = sk.getQuietHours();
    sk.setQuietHours(!q.enabled, q.start, q.end);
    renderMore(container);
  });
  const qStart = container.querySelector("#quietHoursStart");
  const qEnd = container.querySelector("#quietHoursEnd");
  if(qStart) qStart.addEventListener("change", ()=>{
    const q = sk.getQuietHours();
    sk.setQuietHours(q.enabled, qStart.value, q.end);
  });
  if(qEnd) qEnd.addEventListener("change", ()=>{
    const q = sk.getQuietHours();
    sk.setQuietHours(q.enabled, q.start, qEnd.value);
  });
  container.querySelector("#silentBypassToggle").addEventListener("click", ()=>{
    sk.setSilentModeBypassEnabled(!sk.isSilentModeBypassEnabled());
    renderMore(container);
  });
  container.querySelector("#integrityBtn").addEventListener("click", ()=>runIntegrityCheckUI(container));
  container.querySelector("#exportBtn").addEventListener("click", exportBackup);
  container.querySelector("#printLogBtn").addEventListener("click", openPrintableLog);
  container.querySelector("#reportBtn").addEventListener("click", openTrainingReport);
  container.querySelector("#certBtn").addEventListener("click", openCertificateList);
  container.querySelector("#importBtn").addEventListener("click", ()=>container.querySelector("#importFile").click());
  container.querySelector("#importFile").addEventListener("change", importBackup);
  container.querySelector("#resetBtn").addEventListener("click", confirmReset);
}

// Curated block sequences for daily programmes. The route text in the data
// is free prose ("FND marker → COM name/check-in → SKL sit/down → CALM
// settle") — not machine-parseable, and some steps compress two lessons
// into one phrase ("name/check-in" = two separate lessons). Auto-parsing
// this the way behaviour routes are parsed would misfire the same way the
// "ASSESS"/"BARK" category-code parsing did earlier, so each programme is
// mapped explicitly to real, verified lesson_ids instead.
const PROGRAMME_LESSON_MAP = {
  "DAY-001": ["FND-002","COM-001","COM-002","SKL-001","SKL-006","CALM-003"],
  "DAY-002": ["COM-002","WAL-009","WAL-004","WAL-017"],
  "DAY-003": ["REC-003","REC-008","REC-013","REC-006"],
  "DAY-004": ["CALM-001","CALM-003","CALM-005","CALM-006","CALM-018"],
  "DAY-005": ["ENR-002","ENR-004","ENR-011","ENR-009"],
  // DAY-006 "real-world generalisation" isn't a fixed lesson list — its own
  // route is a template ("known skill → new location → low distraction →
  // reward → recovery"), meant to apply to whichever skill the dog already
  // has reliable. Resolved dynamically per dog at runtime instead — see
  // resolveGeneralisationLesson().
};

function resolveGeneralisationLesson(dog){
  // Pick a skill the dog has built up (Reliable or better) that has a
  // mapped anchor lesson, preferring one not already at the top state so
  // there's somewhere left to generalise to.
  const candidates = sk.KB.collections.skills
    .map(s=>({ s, state: sk.dogSkillState(dog.id, s.skill_id) }))
    .filter(x=>["Reliable","Generalising","Life-ready"].includes(x.state))
    .map(x=>({...x, lesson: sk.findMatchingLesson(x.s.skill_id)}))
    .filter(x=>x.lesson);
  if(!candidates.length) return null;
  candidates.sort((a,b)=>{
    const rank = {Reliable:0, Generalising:1, "Life-ready":2};
    return rank[a.state]-rank[b.state];
  });
  return candidates[0].lesson;
}

function programmeLessonList(programme, dog){
  if(programme.programme_id === "DAY-006"){
    const l = resolveGeneralisationLesson(dog);
    return l ? [l] : [];
  }
  const ids = PROGRAMME_LESSON_MAP[programme.programme_id] || [];
  return ids.map(id=>sk.IDX.lessonsById.get(id)).filter(Boolean);
}

function openProgrammeDetail(id){
  window.scrollTo(0,0);
  const p = sk.IDX.programmesById.get(id);
  const dog = sk.getCurrentDog();
  const steps = p.route.split("→").map(s=>s.trim());
  const lessons = dog ? programmeLessonList(p, dog) : [];
  const isDynamic = p.programme_id === "DAY-006";

  sk.openModal(`
    <h3>${sk.esc(p.name)}</h3>
    <p style="color:var(--ink-soft); font-size:13.5px;">${p.duration_min} minutes · ${sk.esc(p.feedback)}</p>
    <div class="card">${steps.map((s,i)=>`<div class="step-item"><div class="step-num">${i+1}</div><div>${sk.esc(s)}</div></div>`).join("")}</div>
    ${lessons.length ? `
      <div class="section-label" role="heading" aria-level="2">${isDynamic?"Chosen for "+sk.esc(dog.name)+" today":"Lessons in this programme"}</div>
      <div class="row-list" style="margin-bottom:14px;">${lessons.map(l=>`
        <div class="row" style="cursor:default;">
          <div class="row-tab" style="background:var(${sk.getCategoryVar(l.category)})"></div>
          <div class="row-body"><div class="row-title">${sk.esc(l.title)}</div><div class="row-meta">${sk.esc(l.category)}</div></div>
        </div>`).join("")}</div>
      <button class="btn btn-primary btn-block" id="startProgrammeBtn">Start programme</button>
    ` : isDynamic ? `
      <div class="banner banner-amber" style="margin-top:14px;"><span class="glyph">🎯</span><div>
        ${sk.esc(dog?dog.name:"Your dog")} doesn't have any Reliable+ skills yet to generalise.
        Build up a skill in Lessons or Skills first, then come back to this programme.
      </div></div>
    ` : `<p style="color:var(--ink-soft); font-size:13px;">Add a dog to start this programme.</p>`}
  `);
  const btn = document.getElementById("startProgrammeBtn");
  if(btn) btn.addEventListener("click", ()=>{ sk.closeModal(); startProgramme(p.programme_id); });
}

function programmeDisplayName(prog){
  return prog.displayName || sk.IDX.programmesById.get(prog.programmeId).name;
}

function startAdHocSession(name, lessons){
  if(!lessons.length){ sk.showToast("Nothing to start yet."); return; }
  sk.setTabbarVisible(false);
  sk.setActiveProgramme({ programmeId: null, displayName: name, lessons, index:0, blockResults:[] });
  renderProgrammeBlock();
}

/* ---------- Programme runner: chains several lessons into one session ---------- */
function startProgramme(programmeId){
  const p = sk.IDX.programmesById.get(programmeId);
  const dog = sk.getCurrentDog();
  const lessons = programmeLessonList(p, dog);
  if(!lessons.length){ sk.showToast("Nothing to start yet."); return; }
  sk.setTabbarVisible(false); // in-progress reps — don't let a stray tab tap discard them
  sk.setActiveProgramme({ programmeId, lessons, index:0, blockResults:[] });
  renderProgrammeBlock();
}

function renderProgrammeBlock(){
  const prog = sk.activeProgramme;
  const pName = programmeDisplayName(prog);
  const l = prog.lessons[prog.index];
  const dog = sk.getCurrentDog();
  const steps = sk.splitPipe(l.steps);
  const reps = [];
  sk.setTopbar(pName, "Block "+(prog.index+1)+" of "+prog.lessons.length, `<button class="icon-btn" id="endProgBtn" aria-label="End programme">✕</button>`);
  const container = document.getElementById("screens");
  container.innerHTML = `<div class="screen active">
    <div class="progress-track" style="margin-bottom:16px;"><div class="progress-fill" style="width:${(prog.index/prog.lessons.length*100).toFixed(0)}%"></div></div>
    <div class="card" style="text-align:center;">
      <div class="badge" style="background:var(${sk.getCategoryVar(l.category)});color:#fff;">${sk.getCategoryIcon(l.category)} ${sk.esc(l.category)}</div>
      <h3 style="margin-top:10px;">${sk.esc(l.title)}</h3>
      <p style="font-size:13px; color:var(--ink-soft);">${sk.esc(l.objective)}</p>
      <div style="font-size:40px; font-weight:700; font-family:var(--font-display); margin:12px 0 4px;" id="repCounter">0</div>
      <div style="display:flex; align-items:center; justify-content:center; gap:8px; margin-bottom:16px;">
        <div style="font-size:13px; color:var(--ink-soft);" id="repBreakdown">0 successful</div>
        <button type="button" id="undoRepBtn" aria-label="Undo last rep" style="display:none; border:none; background:none; color:var(--ink-soft); font-size:12px; text-decoration:underline; cursor:pointer; padding:0;">↩ Undo</button>
      </div>
      <div style="display:flex; gap:10px;">
        <button class="btn btn-primary btn-block" id="repSuccess">✓ Success</button>
        <button class="btn btn-ghost btn-block" id="repMiss">✗ No luck</button>
      </div>
      <button class="btn btn-secondary btn-block" id="clickerBtn" style="margin-top:10px;">🔨 Click</button>
    </div>

    <div class="section-label" role="heading" aria-level="2">
      What to do
      <button class="icon-btn" id="repeatStepsBtn" aria-label="Read steps aloud again" style="float:right; width:28px; height:28px; font-size:13px;">🔊</button>
    </div>
    <div class="card" id="stepsCard">
      ${steps.map((s,i)=>`<div class="step-item" data-step-idx="${i}"><div class="step-num-lg" style="background:var(${sk.getCategoryVar(l.category)});">${i+1}</div><div style="padding-top:4px;">${sk.esc(s)}</div></div>`).join("")}
    </div>

    <button class="btn btn-secondary btn-block" id="nextBlockBtn" style="margin-top:16px;">
      ${prog.index === prog.lessons.length-1 ? "Finish programme" : "Next block"}
    </button>
  </div>`;

  const stepsSpoken = steps.map((s,i)=>`Step ${i+1}: ${s}`).join(". ");
  function speakSteps(){ sk.speak(`Block ${prog.index+1} of ${prog.lessons.length}: ${l.title}. ${stepsSpoken}`); }
  speakSteps();

  let highlightTimer = null;
  function highlightStepsInSequence(){
    clearTimeout(highlightTimer);
    const items = container.querySelectorAll("#stepsCard .step-item");
    items.forEach(it=>it.classList.remove("step-active"));
    let i = 0;
    const advance = ()=>{
      items.forEach(it=>it.classList.remove("step-active"));
      if(i >= items.length) return;
      items[i].classList.add("step-active");
      const words = steps[i].split(" ").length;
      const ms = Math.max(1400, words * 320);
      i++;
      highlightTimer = setTimeout(advance, ms);
    };
    advance();
  }
  if(sk.isVoiceEnabled()) highlightStepsInSequence();

  function paint(){
    const succ = reps.filter(r=>r).length;
    container.querySelector("#repCounter").textContent = reps.length;
    container.querySelector("#repBreakdown").textContent = succ+" successful";
    container.querySelector("#undoRepBtn").style.display = reps.length ? "inline" : "none";
  }
  container.querySelector("#repSuccess").addEventListener("click", ()=>{ reps.push(true); paint(); sk.speak(sk.praiseWordFor(dog)); });
  container.querySelector("#repMiss").addEventListener("click", ()=>{ reps.push(false); paint(); sk.speak("Okay, next one"); });
  container.querySelector("#undoRepBtn").addEventListener("click", ()=>{
    if(!reps.length) return;
    reps.pop();
    paint();
    sk.speak("Undone");
  });
  container.querySelector("#clickerBtn").addEventListener("click", sk.playClickSound);
  container.querySelector("#repeatStepsBtn").addEventListener("click", ()=>{ speakSteps(); if(sk.isVoiceEnabled()) highlightStepsInSequence(); });
  container.querySelector("#nextBlockBtn").addEventListener("click", ()=>{
    clearTimeout(highlightTimer);
    prog.blockResults.push({ lessonId: l.lesson_id, reps: reps.slice() });
    if(prog.index === prog.lessons.length-1){
      renderProgrammeFeedback();
    }else{
      prog.index++;
      renderProgrammeBlock();
    }
  });
  document.getElementById("endProgBtn").addEventListener("click", ()=>{
    clearTimeout(highlightTimer);
    const wasAdHoc = !prog.programmeId;
    sk.setActiveProgramme(null);
    sk.goScreen(wasAdHoc ? "home" : "more");
  });
}

function renderProgrammeFeedback(){
  const prog = sk.activeProgramme;
  const pName = programmeDisplayName(prog);
  const totalReps = prog.blockResults.reduce((n,b)=>n+b.reps.length,0);
  const totalSucc = prog.blockResults.reduce((n,b)=>n+b.reps.filter(r=>r).length,0);

  sk.setTopbar(pName, "How did the session go overall?", "");
  const container = document.getElementById("screens");
  container.innerHTML = `<div class="screen active">
    <div class="card" style="text-align:center;">
      <div style="font-size:28px; font-family:var(--font-display); font-weight:700;">${totalSucc}/${totalReps||0}</div>
      <div style="color:var(--ink-soft); font-size:13.5px;">successful repetitions across ${prog.blockResults.length} blocks</div>
    </div>
    <p style="font-size:12.5px; color:var(--ink-soft);">One rating applies to every block — each lesson still keeps its own individual progress the next time you train it on its own.</p>
    <div class="chip-group" id="feedbackChips">
      ${sk.ADAPTIVE_FEEDBACK.map(f=>`<button type="button" class="chip" data-val="${f}">${sk.FEEDBACK_DISPLAY[f]}</button>`).join("")}
    </div>
    <button class="btn btn-primary btn-block" id="saveProgBtn" disabled>Save programme</button>
  </div>`;
  let feedback = null;
  container.querySelector("#feedbackChips").addEventListener("click", e=>{
    const b = e.target.closest(".chip"); if(!b) return;
    container.querySelectorAll("#feedbackChips .chip").forEach(c=>c.classList.remove("selected"));
    b.classList.add("selected"); feedback = b.dataset.val;
    container.querySelector("#saveProgBtn").disabled = false;
  });
  container.querySelector("#saveProgBtn").addEventListener("click", ()=>saveProgramme(feedback));
}

function saveProgramme(feedback){
  const prog = sk.activeProgramme;
  const pName = programmeDisplayName(prog);
  const dog = sk.getCurrentDog();
  const results = prog.blockResults.map(b=>{
    const l = sk.IDX.lessonsById.get(b.lessonId);
    return { l, result: sk.recordLessonAttempt(dog, l, b.reps, feedback, prog.programmeId) };
  });
  sk.saveDB();
  sk.setActiveProgramme(null);

  sk.setTopbar("Session complete", "", "");
  const container = document.getElementById("screens");
  container.innerHTML = `<div class="screen active" style="text-align:center; padding-top:24px;">
    <div style="font-size:44px;">🎉</div>
    <h2>${sk.esc(pName)} done!</h2>
    <p style="color:var(--ink-soft);">${sk.esc(dog.name)} worked through ${results.length} block${results.length===1?"":"s"}.</p>
    <div style="text-align:left;">
      ${results.map(({l,result})=>`
        <div class="banner ${result.cls}" style="margin-bottom:8px;">
          <span class="glyph">${result.verdict==="progress"?"📈":result.verdict==="repeat"?"🔁":"🌱"}</span>
          <div><strong>${sk.esc(l.title)}:</strong> ${sk.esc(result.verdictText)}</div>
        </div>`).join("")}
    </div>
    <button class="btn btn-primary btn-block" id="doneProgBtn">Done</button>
  </div>`;
  container.querySelector("#doneProgBtn").addEventListener("click", ()=>sk.goScreen("home"));
}

window.__sk.openProgrammeDetail = openProgrammeDetail;
window.__sk.startProgramme = startProgramme;
window.__sk.startAdHocSession = startAdHocSession;

function openSafetyReference(){
  const gates = sk.KB.collections.safety_gates;
  sk.openModal(`
    <h3>Safety gates</h3>
    <div class="row-list">${gates.map(g=>{
      const cls = sk.severityClass(g.severity);
      return `<div class="banner ${cls}" style="margin-bottom:8px;"><span class="glyph">⚠️</span><div><strong>${sk.esc(g.name)}</strong><br><span style="font-size:12.5px;">${sk.esc(g.trigger)}</span><br><span style="font-size:12.5px;">${sk.esc(g.action)}</span></div></div>`;
    }).join("")}</div>
  `);
}
function openBodyLanguageGuide(targetStateId){
  const states = sk.KB.collections.body_language_guide;
  const tierColor = { green: "var(--forest)", amber: "var(--ochre)", red: "var(--red)" };
  const tierLabel = { green: "Good to go", amber: "Consider easing off", red: "Stop and create space" };
  sk.openModal(`
    <h3>Dog body language guide</h3>
    <p style="color:var(--ink-soft); font-size:13px; margin-bottom:14px;">A quick visual reference for common states — helpful for deciding whether to continue, ease off, or stop.</p>
    ${states.map(s=>`
      <div class="card" id="blg-${sk.esc(s.state_id)}" style="padding:0; overflow:hidden;">
        <div style="padding:14px 14px 0;">
          <div style="display:flex; align-items:center; gap:8px; margin-bottom:10px;">
            <span style="width:9px; height:9px; border-radius:50%; background:${tierColor[s.tier]}; flex:none;"></span>
            <strong>${sk.esc(s.state)}</strong>
            <span style="margin-left:auto; font-size:11.5px; color:${tierColor[s.tier]}; font-weight:600;">${tierLabel[s.tier]}</span>
          </div>
        </div>
        <img src="${sk.esc(s.image)}" alt="" loading="lazy" style="width:100%; aspect-ratio:4/3; object-fit:cover; display:block;">
        <div style="padding:14px;">${s.signals.map(sig=>`<div class="checklist-item"><span class="dot"></span>${sk.esc(sig)}</div>`).join("")}</div>
      </div>
    `).join("")}
  `);
  if(targetStateId){
    const target = document.getElementById("blg-"+targetStateId);
    if(target) target.scrollIntoView({block:"start"});
  }
}

function openMythsReference(){
  const myths = sk.KB.collections.myths;
  sk.openModal(`
    <h3>Myths & realities</h3>
    ${myths.map(m=>{
      const srcs = sk.sourcesLine(m.source_ids);
      return `<div class="card"><strong>${sk.esc(m.myth)}</strong><p style="margin-top:6px; margin-bottom:0; font-size:13.5px; color:var(--ink-soft);">${sk.esc(m.reality)}</p>${srcs?`<p style="margin:8px 0 0; font-size:11px; color:var(--ink-soft);">Sources:</p>${sk.sourcesPillsHTML(m.source_ids)}`:""}</div>`;
    }).join("")}
  `);
}
/* ---------- Troubleshooter wizard ---------- */
function openTroubleshootPicker(){
  const trees = sk.KB.collections.troubleshooting_trees;
  sk.openModal(`
    <h3>My dog is...</h3>
    <p style="color:var(--ink-soft); font-size:13px; margin-bottom:12px;">Pick what's going on, then answer a couple of quick questions.</p>
    <div class="row-list">
      ${trees.map(t=>`
        <button class="row" data-tree="${t.tree_id}">
          <div class="row-tab" style="background:var(--red)"></div>
          <div class="row-body"><div class="row-title">${t.icon} ${sk.esc(t.title)}</div></div>
          <span class="row-chev">›</span>
        </button>`).join("")}
    </div>
  `);
  document.querySelectorAll("[data-tree]").forEach(btn=>{
    btn.addEventListener("click", ()=>runTroubleshootNode(btn.dataset.tree, null));
  });
}

function runTroubleshootNode(treeId, nodeId){
  const tree = sk.KB.collections.troubleshooting_trees.find(t=>t.tree_id===treeId);
  const currentNodeId = nodeId || tree.start;
  const node = tree.nodes[currentNodeId];

  if(node.type === "question"){
    sk.openModal(`
      <h3>${tree.icon} ${sk.esc(tree.title)}</h3>
      <p style="font-size:15px; font-weight:600; margin:12px 0;">${sk.esc(node.text)}</p>
      <div class="row-list">
        ${node.options.map((opt,i)=>`<button class="row" data-goto="${opt.goto}"><div class="row-body"><div class="row-title">${sk.esc(opt.label)}</div></div><span class="row-chev">›</span></button>`).join("")}
      </div>
      <button class="btn btn-ghost btn-block" id="twBack" style="margin-top:12px;">← Choose a different topic</button>
    `);
    document.querySelectorAll("[data-goto]").forEach(btn=>{
      btn.addEventListener("click", ()=>runTroubleshootNode(treeId, btn.dataset.goto));
    });
    document.getElementById("twBack").addEventListener("click", openTroubleshootPicker);
    return;
  }

  // result node
  const relatedHtml = (node.related_lessons||[]).map(lid=>{
    const l = sk.IDX.lessonsById.get(lid);
    if(!l) return "";
    return `<button class="row" data-lesson="${lid}"><div class="row-tab" style="background:var(${sk.getCategoryVar(l.category)})"></div><div class="row-body"><div class="row-title">${sk.esc(l.title)}</div><div class="row-meta">${sk.esc(l.category)}</div></div><span class="row-chev">›</span></button>`;
  }).join("");

  sk.openModal(`
    <h3>${tree.icon} ${sk.esc(tree.title)}</h3>
    ${node.professional_help ? `<div class="banner banner-red" style="margin-top:10px;"><span class="glyph">⚠️</span><div>${sk.esc(node.summary)}</div></div>` : `<p style="font-size:14px; color:var(--ink-soft); margin:12px 0;">${sk.esc(node.summary)}</p>`}
    <div class="section-label" role="heading" aria-level="2">Where to start</div>
    <div class="row-list">${relatedHtml}</div>
    <button class="btn btn-ghost btn-block" id="twRestart" style="margin-top:14px;">← Ask about something else</button>
  `);
  document.querySelectorAll("[data-lesson]").forEach(btn=>{
    btn.addEventListener("click", ()=>{ sk.closeModal(); sk.openLessonDetail(btn.dataset.lesson); });
  });
  document.getElementById("twRestart").addEventListener("click", openTroubleshootPicker);
}

window.__sk.openTroubleshootPicker = openTroubleshootPicker;

function openGuidanceReference(){
  const items = sk.KB.collections.owner_guidance;
  sk.openModal(`
    <h3>Owner guidance</h3>
    ${items.map(g=>{
      const srcs = sk.sourcesLine(g.source_ids);
      return `<div class="card"><strong>${sk.esc(g.topic)}</strong><p style="margin-top:6px; margin-bottom:0; font-size:13.5px; color:var(--ink-soft);">${sk.esc(g.guidance)}</p>${srcs?`<p style="margin:8px 0 0; font-size:11px; color:var(--ink-soft);">Sources:</p>${sk.sourcesPillsHTML(g.source_ids)}`:""}</div>`;
    }).join("")}
  `);
}
function openEvidenceReference(){
  const items = sk.KB.collections.evidence_cards;
  sk.openModal(`
    <h3>Evidence library</h3>
    <p style="font-size:12.5px; color:var(--ink-soft); margin-bottom:14px;">What the evidence supports, and what it doesn't mean.</p>
    ${items.map(e=>{
      const srcs = sk.sourcesLine(e.source_ids);
      return `<div class="card">
        <span class="badge badge-outline">${e.evidence_level}</span>
        <strong style="display:block; margin-top:6px;">${sk.esc(e.topic)}</strong>
        <p style="margin:6px 0 0; font-size:13.5px; color:var(--ink-soft);">${sk.esc(e.summary)}</p>
        <p style="margin:8px 0 0; font-size:12.5px; color:var(--ink-soft);"><strong>Doesn't mean:</strong> ${sk.esc(e.does_not_mean)}</p>
        ${srcs ? `<p style="margin:8px 0 0; font-size:11px; color:var(--ink-soft);">Sources:</p>${sk.sourcesPillsHTML(e.source_ids)}` : ""}
      </div>`;
    }).join("")}
  `);
}
function openRulesReference(){
  const rules = sk.KB.collections.progression_rules;
  sk.openModal(`
    <h3>How progression works</h3>
    <p style="font-size:12.5px; color:var(--ink-soft); margin-bottom:14px;">The rules Sidekick uses after each session — welfare always overrides a percentage target.</p>
    ${rules.map(r=>`<div class="card">
      <strong>${sk.esc(r.name)}</strong>
      <p style="margin:6px 0 0; font-size:13.5px;"><span style="color:var(--ink-soft);">When:</span> ${sk.esc(r.condition)}</p>
      <p style="margin:4px 0 0; font-size:13.5px;"><span style="color:var(--ink-soft);">Then:</span> ${sk.esc(r.action)}</p>
      <p style="margin:8px 0 0; font-size:12px; color:var(--ink-soft);">${sk.esc(r.note)}</p>
    </div>`).join("")}
  `);
}

function openMediaGallery(){
  const lessons = sk.KB.collections.lessons.filter(l=>l.media && l.media.image);
  const bodyLang = sk.KB.collections.body_language_guide || [];
  sk.openModal(`
    <h3>Media gallery</h3>
    <p style="color:var(--ink-soft); font-size:13px; margin-bottom:14px;">${lessons.length} lesson${lessons.length===1?"":"s"} with a real photo, plus the ${bodyLang.length}-state body language guide. Tap any lesson to open it.</p>
    <div class="section-label" role="heading" aria-level="2" style="margin-top:0;">Lessons</div>
    <div class="row-list">
      ${lessons.map(l=>{
        const stepCount = (l.media.steps||[]).length;
        return `<button class="row" data-gallery-lesson="${l.lesson_id}" style="padding:8px;">
          <img src="${sk.esc(l.media.image)}" alt="" loading="lazy" style="width:52px; height:52px; border-radius:10px; object-fit:cover; flex:none;">
          <div class="row-body">
            <div class="row-title">${sk.esc(l.title)}</div>
            <div class="row-meta">${sk.esc(l.category)}${stepCount?` · +${stepCount} step image${stepCount===1?"":"s"}`:""}</div>
          </div>
          <span class="row-chev">›</span>
        </button>`;
      }).join("")}
    </div>
    ${bodyLang.length ? `<div class="section-label" role="heading" aria-level="2">Body language guide</div>
    <div class="row-list" style="margin-bottom:14px;">
      ${bodyLang.map(s=>`<button class="row" data-gallery-guide="${sk.esc(s.state_id)}" style="padding:8px;">
        <img src="${sk.esc(s.image)}" alt="" loading="lazy" style="width:52px; height:52px; border-radius:10px; object-fit:cover; flex:none;">
        <div class="row-body"><div class="row-title">${sk.esc(s.state)}</div></div>
        <span class="row-chev">›</span>
      </button>`).join("")}
    </div>` : ""}
  `);
  document.querySelectorAll("[data-gallery-lesson]").forEach(btn=>{
    btn.addEventListener("click", ()=>{ sk.closeModal(); sk.openLessonDetail(btn.dataset.galleryLesson); });
  });
  document.querySelectorAll("[data-gallery-guide]").forEach(btn=>{
    btn.addEventListener("click", ()=>{ sk.closeModal(); openBodyLanguageGuide(btn.dataset.galleryGuide); });
  });
}

function openProtocolsReference(){
  const protocols = sk.KB.collections.protocols;
  sk.openModal(`
    <h3>Training protocols</h3>
    <p style="font-size:12.5px; color:var(--ink-soft); margin-bottom:14px;">The core frameworks behind Sidekick's approach — the overall shape of a plan, not a single lesson's steps.</p>
    ${protocols.map(p=>{
      const gateIds = sk.splitSemi(p.safety_gate_ids);
      const gateBanners = gateIds.map(gid=>{
        const g = sk.IDX.safetyGatesById.get(gid);
        if(!g) return "";
        const cls = sk.severityClass(g.severity);
        return `<div class="banner ${cls}" style="margin:8px 0 0;"><span class="glyph">⚠️</span><div style="font-size:12.5px;"><strong>${sk.esc(g.name)}</strong></div></div>`;
      }).join("");
      return `<div class="card">
        <strong>${sk.esc(p.name)}</strong>
        <p style="margin:6px 0 0; font-size:13.5px;"><span style="color:var(--ink-soft);">Use when:</span> ${sk.esc(p.trigger)}</p>
        <p style="margin:6px 0 0; font-size:13px; color:var(--ink-soft);">${sk.esc(p.route)}</p>
        <p style="margin:8px 0 0; font-size:12.5px;"><span style="color:var(--ink-soft);">Success looks like:</span> ${sk.esc(p.success)}</p>
        ${gateBanners}
      </div>`;
    }).join("")}
  `);
}

function exportBackup(){
  const blob = new Blob([JSON.stringify(sk.DB, null, 2)], {type:"application/json"});
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = "sidekick-backup-"+new Date().toISOString().slice(0,10)+".json";
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
  sk.showToast("Backup downloaded.");
}
function importBackup(e){
  const file = e.target.files[0]; if(!file) return;
  const reader = new FileReader();
  reader.onload = ()=>{
    try{
      const data = JSON.parse(reader.result);
      if(!data.dogs) throw new Error("Not a Sidekick backup file.");
      sk.DB = data;
      sk.saveDB();
      sk.ensureCurrentDog();
      sk.showToast("Backup restored.");
      sk.goScreen("home");
    }catch(err){
      sk.showToast("Couldn't read that file — is it a Sidekick backup?");
    }
  };
  reader.readAsText(file);
}
const APP_VERSION = "7.1.0";

const CHANGELOG = [
  { version: "7.1.0", notes: [
    "Certificate visuals corrected per feedback: the holographic icon is now a fully-visible image in the bottom-right corner rather than a faded watermark, and the new decorative background (with its own subtle S mark and line art) fills the whole certificate instead",
    "The \"Duffers\" signature now tries an image first (for a genuine hand-drawn look once one's provided), falling back cleanly to styled text if the image isn't there yet — no broken-image icon either way",
    "New: 🎮 Games Master certificate — unlocks once every game in the Games section has been played at least once",
    "Fixed a layout bug caught in testing: the holo icon and the certificate's own footer text were briefly overlapping in the bottom-right corner",
  ]},
  { version: "7.0.0", notes: [
    "Certificates redesigned: a subtle holographic watermark of the Sidekick icon, the full wordmark logo in the corner, and a \"Duffers\" signature in a handwriting-style font (loaded on demand, with a clean fallback if offline)",
    "New: Certificate categories — instead of just one generic \"10 lessons\" certificate, there's now a full Certificates screen listing an Overall Achievement certificate plus one for every major training category (Foundation, Recall, Walking, Reactivity, and 18 more), each unlocking once every lesson in that category is completed",
    "Locked certificates show real progress (\"14 / 28 lessons\") rather than just a lock icon with no context",
  ]},
  { version: "6.4.0", notes: [
    "29 more lessons given real photos across two large batches: novel-object shaping, child-dog greetings, toilet training (outdoor and indoor-pad variants), furniture access boundaries, redirect-to-chew, ear handling, clippers introduction, plus 8 more Settle variants (handler movement, mild distraction, extended duration, owner walking away) and 8 more Threshold-distance variants (joggers, delivery vans, cyclists, dog-to-dog at various distances)",
    "125 lessons now have a real photo, up from 96",
  ]},
  { version: "6.3.0", notes: [
    "13 more lessons given real photos: 4 additional Recall contexts (open field, whistle cue, past sniffing, toy reward), plus Leaving dropped food, Find it enrichment, Muzzle training, Paw handling, Recall from another room, Pairing household sounds (vacuum), Crate resting, Trading a familiar chew, and Staying calm around runners",
  ]},
  { version: "6.2.0", notes: [
    "Games now shows real photos on all 13 tiles instead of colored placeholder circles — applied as proper lesson media, so the same images also show on those lessons' own detail pages, not just the tile grid",
  ]},
  { version: "6.1.0", notes: [
    "Refreshed the app icon everywhere it appears — the PWA install icons (all 3 sizes, including a properly re-centred maskable version), and the small icon in the top bar, which now matches the wordmark logo's letterform exactly",
    "Fixed a real inconsistency caught in the process: the old top bar icon actually inverted its colours in dark mode (a darker S on a lighter green), while the full logo lockup used a constant forest-green-with-cream-S treatment in both themes. The new icon now matches the wordmark's consistent approach in both themes",
    "The certificate now shows a proper gold seal-and-ribbon medallion instead of a generic medal emoji",
    "The weight tracker now opens with a real photo header instead of straight into a form",
  ]},
  { version: "6.0.0", notes: [
    "New: Games (Home → 🎮 Games) — a playful, illustrated grid into 13 curated Enrichment and Tricks & Games lessons already in the library (cardboard searching, hide and seek, the cup game, recall races, and more). Not new content — a more fun front door onto lessons that already existed, each tile opens the real lesson with a ✓ Done badge once completed",
    "New: Certificate of achievement (Profile → 🏅) — a landscape, decoratively-bordered certificate reflecting the dog's actual completed-lesson count and top categories, printable/saveable as a PDF the same way as the training report. Unlocks after 10 completed lessons, with a friendly progress message before that",
    "New: Track weight (Profile → ⚖️) — log weight entries with date and kg/lb, view them as a dependency-free SVG trend chart once there are at least two entries, and delete entries from a history list",
    "Fixed a real bug caught before it ever shipped: the Games feature's \"already completed\" check was called with the wrong function signature, which would have silently failed to show the done badge for any completed game",
    "Fixed a genuine layout bug in the certificate: the on-screen preview used the same fixed landscape aspect ratio as the print version, which overflowed and clipped the title on a narrow phone screen. The landscape ratio now applies only when actually printing",
  ]},
  { version: "5.5.0", notes: [
    "Fixed a real dark-mode bug: the highlighted \"current step\" during a session used a light background with light text, at a contrast ratio of roughly 1:1 — effectively invisible. Now uses a dark green that reads clearly against the highlight in both themes",
    "New: a Voice picker (Profile → Voice guidance) — choose from whatever voices your browser and device offer, rather than being stuck with the system default",
    "Fixed a genuine bug caught while building the voice picker: if a saved voice preference ever failed to apply for any reason, the entire spoken message was being silently dropped instead of falling back to the default voice — the exact opposite of what a reliability feature should do. Voice assignment now fails safely on its own, separate from whether the message gets spoken at all",
  ]},
  { version: "5.4.0", notes: [
    "New: Undo last rep — a small \"↩ Undo\" link appears next to the rep count as soon as you've logged one, for fixing a stray tap without finishing the whole session. Works in both single-lesson sessions and daily-programme blocks",
  ]},
  { version: "5.3.0", notes: [
    "New: Gender (Male / Female / Unknown) when adding or editing a dog — voice guidance now says \"Good boy\", \"Good girl\", or \"Good dog\" on a successful rep to match, defaulting sensibly to \"Good dog\" for existing profiles saved before this existed. \"Okay, next one\" on a miss is unchanged either way",
    "New, experimental: a \"try to play even on silent mode\" toggle for the clicker (Profile → Clicker), off by default. This uses an undocumented iOS Safari behaviour — keeping a barely-audible looping sound actively playing can sometimes bump the whole page's audio out of the category that respects the mute switch. It's genuinely not guaranteed to work on every device, and Apple could change this at any time, so it's opt-in and labelled clearly as experimental rather than promised as a fix",
  ]},
  { version: "5.2.0", notes: [
    "New: Print this lesson — a single-page, print-formatted version of any lesson's goal, setup, steps, success criteria, and common mistakes, for a paper backup when a phone isn't practical outdoors",
    "New: a training-days heatmap on the Training Journey view — a GitHub-style contribution grid built from session history already being tracked",
    "New: Compare dogs (Profile, shown only with more than one dog) — progress, streak, lessons trained, and reliable-or-above skills side by side, using the exact same calculations as each dog's individual journey view so the two can never disagree",
    "Fixed a real bug caught in testing: the new lesson-print button initially threw \"openLessonPrintView is not defined\" — a cross-module scoping issue, the same category of bug that's come up a few times in this project. Also tidied up an unrelated overlay that was reusing another one's DOM id",
  ]},
  { version: "5.1.0", notes: [
    "Fixed the clicker not making a sound: the audio context's resume() is asynchronous, and the click was being scheduled before it finished — a suspended AudioContext doesn't process anything scheduled against it. Now waits properly for resume to complete first",
    "New: Quiet hours (Profile → Voice guidance) — set a time window where voice guidance stays silent even if it's turned on, correctly handling overnight ranges that cross midnight",
    "New: a second home-screen shortcut for the Clicker, alongside the existing \"Start today's suggestion\" one — long-press the app icon to jump straight to it",
    "Note: a true home-screen widget showing live content isn't possible in a web app without native platform code — the shortcut above is the closest equivalent a PWA can offer",
  ]},
  { version: "5.0.0", notes: [
    "New: step-by-step guidance during training — the numbered steps are now visible on screen during a real session (not just before starting), with the current step highlighted in time with the voice reading it aloud",
    "New: a 🔊 button to re-hear the steps at any point mid-session, and a repeat-the-instructions flow if voice guidance is on",
    "New: a clicker — synthesised entirely with the Web Audio API, no audio file needed. Available as a standalone tool from Home (\"🔨 Clicker\"), and as a button during both single-lesson sessions and daily-programme blocks",
    "Both features work in the single-lesson session screen and the multi-lesson programme runner",
  ]},
  { version: "4.9.0", notes: [
    "Fixed the onboarding screen's top bar still showing the small icon-plus-text combo instead of the full logo — it now matches Home, on both the normal first-run path and the \"all dogs removed\" reset path",
  ]},
  { version: "4.8.0", notes: [
    "Accessibility pass: added missing labels on the voice-guidance toggle and all form inputs (onboarding and add/edit dog), linked chip-group selections to their headings, added aria-current to the active tab, retrofitted heading semantics onto all 48 section headers so screen readers can navigate between them, and fixed a genuine color contrast failure on the amber \"Consider\" badge text",
    "Verified rather than assumed several things were already solid: modal focus-trap, Escape-to-close, focus-visible outlines, and toast announcements all checked and confirmed working correctly",
    "Replaced the outdated circular \"S\" icon in the top bar with the rounded-square shape matching the new logo, and removed an orphaned, unused copy of the old circular icon",
    "Fixed the Home screen's full logo appearing smaller than intended — the source image had built-in transparent padding eating into its own height budget; cropped it out and sized the logo up slightly for better presence",
  ]},
  { version: "4.7.0", notes: [
    "Fixed a real bug: both light and dark logo versions were showing at once on Home in dark mode — same root cause as an earlier bug (an inline style beating the CSS rule that hides the wrong one), just in a new spot",
    "Fixed unreadable black stat numbers (developing/streak/progress) on Home in dark mode — they were inheriting the browser's default black button text color instead of the app's theme color",
    "Updated the light-mode logo with better text contrast, per new artwork",
  ]},
  { version: "4.6.0", notes: [
    "New: Training report (Profile → Data) — a curated, one-page shareable summary (overall progress, streaks, skills by stage, category progress, recent activity), distinct from the existing full session-by-session log",
    "Built on the same calculations as the Training Journey view on Home, so the numbers always match between them",
    "Print / Save as PDF works the same way as the existing training log export",
  ]},
  { version: "4.5.0", notes: [
    "Fixed the logo lockup being clipped at the bottom in both light and dark mode — replaced with correctly-bounded versions",
    "Replaced all 6 Body Language Guide images with better-framed landscape versions that fit the 4:3 card crop cleanly, with nothing important trimmed",
    "Added a dark/light mode toggle directly in the header on every screen — stays in sync with the full picker in Profile settings in both directions, and updates live if your device's theme changes while \"Auto\" is selected",
    "Home now shows the full \"Sidekick\" logo lockup in the top-left instead of the small icon plus text — every other screen keeps its normal icon and page title",
  ]},
  { version: "4.4.0", notes: [
    "Fixed a real navigation bug: tapping a specific state in Media Gallery's body-language list always opened the guide at the top entry regardless of which one you tapped — it now jumps to the exact one you selected",
    "Reordered the body language guide cards: title and status now appear above the image, with the detail list below — image no longer pushes the identifying info off-screen first",
    "Every modal now has a visible × close button in the top-right corner, in addition to the existing swipe-down and tap-outside-to-close",
  ]},
  { version: "4.3.0", notes: [
    "Added the full \"Sidekick\" logo lockup (icon + wordmark) to the onboarding welcome screen and the About page, replacing a generic paw emoji and a separate icon-plus-heading combo",
    "Correctly switches between light and dark-background versions depending on your theme setting, including \"Auto\" mode",
    "Kept the existing plain forest-green icon (matching the app icon and top bar) rather than the ochre/sage colour variants also provided, to stay visually consistent with branding already used everywhere else in the app",
    "Fixed a real bug caught in testing: an inline style was overriding the dark-mode CSS rule, so both the light and dark logo images were briefly showing at once in dark mode",
  ]},
  { version: "4.2.0", notes: [
    "Retrieve now has real photos — the one mechanic that had genuinely zero coverage is closed out, across all 3 Retrieve/Carrying/Toy-clean-up lessons",
    "19 more lessons given real photo sequences: marker word, chin rest duration and handling, hand target from a distance, redirecting puppy mouthing, food puzzles, the \"this way\" cue indoors and in the garden, drop during play, rewarding independent chewing and soft body language, greeting at the doorway, recognising toileting signals, calm exposure to unfamiliar people, recall in a new location, and generalising calmness",
    "Found a genuine content-organisation surprise while reviewing: two composites labelled for other lessons contained retrieve content instead, and one image better suited a different lesson (\"rewarding independent chewing\") than originally planned — caught by viewing every panel before mapping, not assuming from filenames",
    "71 lessons now have a real photo",
  ]},
  { version: "4.1.0", notes: [
    "New: Voice guidance (Profile → Voice guidance) — when turned on, Sidekick speaks the session reminder aloud at the start, a quick \"Yes\" or \"Okay, next one\" after each rep, and a wrap-up when you finish — useful when your hands are full with a treat and a lead",
    "Works in both single-lesson sessions and the daily-programme block runner",
    "Off by default, silent if your browser doesn't support speech, and never blocks or slows anything down if it fails — this is a convenience layer only",
  ]},
  { version: "4.0.0", notes: [
    "New: Training Journey — the dog's photo on Home now has a tappable stats row (skills developing, streak, overall progress) leading to a full journey view: overall progress, lessons trained, current and longest streak, skills by stage, and progress by category",
    "This was the original vision from the very first design review, finally built — every number was already tracked somewhere in the app, this just brings it together in one motivating place instead of scattering it",
    "Fixed a real design flaw caught during testing: the overall-progress percentage started every dog at 20% before any training at all, since the default \"Acquiring\" state was carrying positive weight — a completely untrained dog now correctly starts at 0%",
  ]},
  { version: "3.21.0", notes: [
    "9 more flagship sequences added: Redirect to approved chew, Chin rest foundation, first capturing session, Looking at the handler's hand, Four paws on floor when greeting, first shaping session, Toilet schedule foundation, Emergency U-turn, and a corrected Name response",
    "Name response's image set was replaced entirely — the previous single photo is now a full 3-image sequence, and a mismatched dog breed in an earlier upload was caught and swapped for the correct one before shipping",
    "Every single diagram type in the library now has at least its flagship lesson covered with a real photo — 51 lessons total",
  ]},
  { version: "3.20.0", notes: [
    "Added 5 more flagship sequences in one batch: Approaching the harness, Pairing a novel object with reward, Step away and return, Building a reliable drop cue, and Basic food scatter",
    "Verified every step count against the actual lesson text before applying media this time — all 5 matched exactly, zero integrity warnings",
    "43 lessons now have a real photo",
  ]},
  { version: "3.19.0", notes: [
    "Added Leave It Fundamentals — \"Leave it: closed hand\" now shows the full real photo sequence (present the fist, investigate, disengage, reward from the other hand)",
    "Double-checked the step count against the lesson text before applying this time (5 steps, 5 images) — no integrity warnings this round",
    "38 lessons now have a real photo",
  ]},
  { version: "3.18.0", notes: [
    "Added Settle & Calm Mat Fundamentals and Threshold Distance Fundamentals — the two flagship lessons for the two highest-usage mechanics in the whole library (\"Introducing a calm mat\" and \"Finding the working threshold distance\") now show full real photo sequences",
    "Fixed two off-by-one mismatches caught by the integrity checker before shipping: both lessons have 6 steps but were only given 5 step images, meaning the final step in each would have silently shown no image",
    "One image (dog being walked away from a trigger) was originally left unused — moved it to \"Increasing trigger distance when needed,\" which is exactly what it shows",
    "37 lessons now have a real photo",
  ]},
  { version: "3.17.0", notes: [
    "Added Lure & Fade Fundamentals and Loose-Lead Fundamentals — both flagship lessons (\"Your dog's first lure-and-fade session\" and \"Stop when the lead tightens\") now show a full real photo step sequence, same treatment as the marker-timing lesson",
    "These two mechanics cover 51 lessons between them, the two largest remaining gaps that had no real photos at all",
    "35 lessons now have a real photo overall",
  ]},
  { version: "3.16.0", notes: [
    "Added the Recall in Action, Wait & Release, and Settle & Calm sets — 12 more real images, all mapped to specific lessons",
    "Caught and avoided a real mismatch before shipping: one settle image showed an active hand cue, but the lesson I'd initially picked (\"Capturing calm, with no cue at all\") is specifically about NOT cueing — moved it to a more fitting lesson instead",
    "33 lessons now have a real photo, all viewable in Profile → Media gallery",
  ]},
  { version: "3.15.0", notes: [
    "New: Media gallery in Profile — every lesson with a real photo shown as a tappable thumbnail list, so new images can be checked at a glance instead of hunting through individual lessons",
  ]},
  { version: "3.14.0", notes: [
    "Added 11 more real images from a second cropped composite, all filling genuine gaps rather than replacing anything — Keeping cues consistent, Paw presentation, first marker session, Finding the working threshold distance, Responding to fear signals, and 6 more",
    "\"Finding the working threshold distance\" — one of the highest-usage lessons in the library — now shows a real dog noticing another dog at a distance instead of an abstract dot diagram",
    "3 images from the composite (clock+treat, dog assessing a ramp, nose-to-nose bonding) held back — no confident single-lesson match found, noted for discussion rather than force-fit",
  ]},
  { version: "3.13.0", notes: [
    "Added the Training Fundamentals image set — cropped from a single composite into 6 individual panels (Get ready, Wait, Mark, Reward, Repeat, Increase difficulty)",
    "\"Practising marker timing\" now shows a real step-by-step photo sequence, one image per instruction, matching the original visual style design exactly",
    "Fixed a real bug found while wiring this up: per-step lesson images weren't rendering at all — the display function expected an object but was being given a plain file path",
  ]},
  { version: "3.12.0", notes: [
    "Added your first 14 real illustrated images — compressed from ~7MB down to under 800KB total with no visible quality loss",
    "New: Dog body language guide in Profile — 6 states (relaxed, ready to learn, getting distracted, frustrated, fearful, over threshold) each with a real image and what to look for",
    "8 images placed on their best-matching lessons: the 4 Troubleshooting \"common mistake\" lessons, plus Paw, The sniff walk, Reward delivery position, and Understanding positive reinforcement",
  ]},
  { version: "3.11.0", notes: [
    "The why-it-matters content fill is complete — all 556 lessons now have a genuine, individually-written explanation of why that specific lesson matters, not a generic placeholder",
    "This closes out the content gap first found while auditing the animated diagrams: what started as 352 lessons needing real content is now fully done",
  ]},
  { version: "3.10.0", notes: [
    "250 lessons done total on the why-it-matters fill (Socialisation and Advanced/Real World now complete) — 111 of 556 remain, less than a third of the original 352 left",
  ]},
  { version: "3.9.0", notes: [
    "217 lessons done total on the why-it-matters fill (Reactivity and Assessment now complete) — 144 of 556 remain, well past the halfway point of the original 352",
  ]},
  { version: "3.8.0", notes: [
    "182 lessons done total on the why-it-matters fill (Handling & Cooperative Care and Tricks & Games now complete) — 179 of 556 remain, just past the halfway point of the original 352",
  ]},
  { version: "3.7.0", notes: [
    "144 lessons done total on the why-it-matters fill (Life Skills and Calmness & Regulation now complete, alongside Basic Skills, Walking, Foundation, Recall) — 218 of 556 remain, down from 352 at the start",
  ]},
  { version: "3.6.0", notes: [
    "92 lessons done total on the why-it-matters fill (Basic Skills, Walking, Foundation, Recall now complete) — 267 of 556 remain with the generic placeholder, down from 352",
  ]},
  { version: "3.5.0", notes: [
    "Started the why-it-matters content fill: 48 lessons done (all of Basic Skills and Walking) — 304 of 556 lessons remain with the generic placeholder, down from 352",
    "Each rewrite explains the specific reason that lesson exists — why this exact difficulty step, distraction, or context matters — rather than a one-size-fits-all statement",
  ]},
  { version: "3.4.0", notes: [
    "Fixed the boilerplate content gap in all 18 Behaviour Assessment lessons — the objective field was already genuine, but why_it_matters, setup, steps, success_criteria, and equipment were still generic placeholders shared identically across all 18",
    "Found and fixed a further 48 lessons where success_criteria was a mismatched \"4/5 successful repetitions\" template — nonsensical for diagnostic/audit lessons that have no reps at all",
    "Found a larger, separate issue while checking: 352 of 556 lessons (63%) still carry a generic why_it_matters placeholder. This is a genuine content gap, not yet fixed given its scale — flagged clearly as a follow-up",
  ]},
  { version: "3.3.0", notes: [
    "354 of 556 lessons now have an animated diagram — final mop-up pass, reading full untruncated step text for all remaining lessons rather than titles or summaries",
    "This is considered the final state for diagram coverage: the remaining 202 lessons are genuinely explanatory frameworks, diagnostic audits, decision-tree engines, or generic multi-skill/generic-context tests without one fixed technique to illustrate",
  ]},
  { version: "3.2.0", notes: [
    "350 of 556 lessons now have an animated diagram — did a systematic content-level scan (not just titles) across every remaining lesson to catch matches hiding in unexpected categories",
    "Found genuine technique lessons filed under Safety & Referral and Troubleshooting that read as conceptual by title alone — \"Building a separate emergency recall\" is literally a recall technique, \"Responding to fear signals\" is threshold-distance work",
  ]},
  { version: "3.1.0", notes: [
    "343 of 556 lessons now have an animated diagram — added a dedicated retrieve diagram (throw, pick up, bring back) rather than force-fitting it into an existing type",
    "Went back through Advanced/Real World, Foundation, Home Manners, Chewing, and Resource Guarding at the content level (not just titles) and found a handful of genuine remaining matches, including \"Responding to accidents\" sharing the same beats as toilet training",
    "These five categories are now considered closed out — everything remaining in them is genuinely management, policy, or diagnostic content without a technique to illustrate",
  ]},
  { version: "3.0.0", notes: [
    "335 of 556 lessons now have an animated diagram — completed an honest full pass through every remaining lesson to catch genuine matches vs. correctly diagram-free conceptual content",
    "Found and fixed a real gap: the entire Chasing & Predatory Behaviour category had been missed in earlier passes despite having several clear technique matches",
    "The 221 lessons intentionally left without a diagram are conceptual, diagnostic, or measurement-based (e.g. Assessment audits, Safety recognition guidance, Owner Skills theory, Troubleshooting FAQs) — a diagram wouldn't illustrate anything actionable for these",
  ]},
  { version: "2.9.0", notes: [
    "300 of 556 lessons now have an animated diagram (up from 263) — past the halfway mark",
    "Socialisation, Resource Guarding, Mouthing, and most of Foundation/Enrichment/Walking now covered using existing diagram types",
  ]},
  { version: "2.8.0", notes: [
    "263 of 556 lessons now have an animated diagram (up from 218) — Tricks & Games, Home Manners, and Communication & Engagement now largely covered",
    "New toilet-training diagram, built entirely from already-tested icons",
  ]},
  { version: "2.7.0", notes: [
    "218 of 556 lessons now have an animated diagram (up from 150) — expanded Life Skills, Calmness & Regulation into existing types, and added touch-acceptance and equipment-introduction for Handling & Cooperative Care",
    "Both new diagram types reused already-tested icons (hand, calm face, sparkle) rather than introducing new ones — no new visual risk",
  ]},
  { version: "2.6.0", notes: [
    "Working toward full diagram coverage: expanded existing diagram types (recall, loose-lead, lure-fade, wait/release, trade, settle, emergency-turn) to every lesson that genuinely fits — 150 lessons now covered, up from 78",
    "2 new diagram types: alone-time (step away, dog settles, return calmly) and scent search (scatter, sniff, find)",
    "Found and fixed a real gap: LESSON_DIAGRAM wasn't actually accessible for testing/verification outside the app itself — fixed the module scoping so it can be properly checked",
  ]},
  { version: "2.5.0", notes: [
    "5 more animated diagrams: redirect-to-chew, pairing (novel object/sound with reward), shaping, emergency turn-away, and name response — now 18 diagram types covering 78 lessons",
    "Caught and fixed two icons that accidentally looked identical to an unrelated \"key\" shape before shipping",
  ]},
  { version: "2.4.0", notes: [
    "5 more animated diagrams: four-paws greeting, chin rest (cooperative care start-button), wait/release, capturing, and threshold distance — now 13 diagram types covering 63 lessons",
    "Fixed a mismatch caught before shipping: chin rest's \"free to lift away\" beat looked identical to an unrelated \"wait\" icon in an earlier draft — redesigned for clarity",
  ]},
  { version: "2.3.0", notes: [
    "Full audit of safety warnings across every category — found the same blanket category-level tagging pattern in Assessment, Barking, Behaviour Assessment, Chasing, Handling & Cooperative Care, Reactivity, and Socialisation (following on from the Chewing/Resource Guarding/Recall fixes in the last update)",
    "Over 300 incorrect or disproportionate warnings removed across 556 lessons; genuine gaps filled in too (e.g. Muzzle training previously had no safety note at all)",
    "Warnings now reflect what each specific lesson actually involves, not just what category it happens to sit in",
  ]},
  { version: "2.2.0", notes: [
    "5 more animated concept diagrams: lure-fade, recall, leave it, hand target, loose-lead walking — now 8 total, covering 43 lessons",
    "Fixed: navigating between lesson/behaviour/skill/programme detail pages no longer leaves you scrolled partway down — now always starts at the top",
    "Fixed incorrect safety warnings on Chewing & Destruction, Resource Guarding, and Recall lessons — several benign lessons (e.g. \"Trading for a household object\") were showing severe warnings that had been blanket-applied to an entire category rather than reflecting that lesson's actual content; also added a genuinely missing warning to \"Recall away from wildlife\"",
  ]},
  { version: "2.1.0", notes: [
    "New: animated concept diagrams for lessons that teach a specific mechanic (marker timing, trading, settling) — a real illustration instead of a placeholder icon, with a static fallback for reduced-motion settings",
    "Reduced card overuse on the lesson and session screens — mistakes and reminders are now clean typography, not cards inside cards",
    "This completes the priority list from the last review: adaptive session messaging, quick 5-minute sessions, the Learn/Do-it lesson restructure, and card reduction",
  ]},
  { version: "2.0.0", notes: [
    "Replaced all emoji navigation icons with a consistent set of custom line icons — bottom tab bar and Home's quick-action rows",
    "Behaviour guide now shows genuine severity: only bite/guarding/reactivity-type behaviours get a prominent red warning; common everyday behaviours (jumping, pulling, barking) show a small \"Consider\" note instead of an alarming warning",
    "Fixed internal category shorthand (COM, CALM, WAL etc.) leaking into the Behaviour guide's suggested training routes — now shown in plain English",
    "Category and difficulty filters on Train now both scroll horizontally instead of wrapping across multiple rows",
  ]},
  { version: "1.9.2", notes: [
    "Fixed: the top bar overlapped the iPhone status bar when launched from the home screen — now respects the safe area",
    "Updated the About page's content note — the old wording defensively explained Woofz's role, which no longer reflects how diverse the content actually is; it now credits the real sources (Dogs Trust, RSPCA, Blue Cross, Battersea, ABTC, AVSAB) directly",
    "Updated the content status message to reflect reality: all 556 lessons now have individually written, sourced content, with a note that safety-critical guidance still benefits from professional review",
  ]},
  { version: "1.9.1", notes: [
    "Full project audit: extended the data integrity checker to also validate source references on myths, owner guidance, and evidence cards (previously only lessons were checked)",
    "No user-facing issues found in the audit — this was a defensive improvement for future edits",
  ]},
  { version: "1.9.0", notes: [
    "New logo: replaced the circles-forming-a-paw mark with a custom swash \"S\" — updated everywhere it appears (app icon, top bar, About page, favicon)",
    "New app icon includes a properly safe-zoned version for Android's adaptive icon shapes",
  ]},
  { version: "1.8.0", notes: [
    "Visual refresh: cards now have soft depth and larger, more generous rounded corners; buttons are fully rounded pills with a subtle lift",
    "Kept the existing colour palette and typography — this was about shape and depth, not a colour change",
    "Refined the radius scale so buttons, cards, and inputs each read at an appropriately different roundness rather than one size fits all",
  ]},
  { version: "1.7.0", notes: [
    "Add a real photo for your dog — during setup or any time after from Profile → edit dog",
    "Photos are automatically compressed to keep everything fast and safe for on-device storage (typically under 2KB, compared to a multi-megabyte phone photo)",
    "Photo appears everywhere your dog's avatar does: Home, top bar, dog switcher, Profile",
    "An emoji avatar remains as backup if you'd rather not add a photo, or if it fails to load",
  ]},
  { version: "1.6.2", notes: [
    "Redesigned the lesson screen: a clear \"today's goal\" statement, a visual hero panel (even lessons without photos/video yet get a themed placeholder instead of empty space), and bigger, clearer step numbers",
    "Difficulty now sits alongside time and equipment as a single glanceable row instead of a separate badge",
  ]},
  { version: "1.6.1", notes: [
    "Simplified navigation from 7 tabs to 5: Home, Train, Behaviour, Progress, Profile",
    "\"Lessons\" renamed to \"Train\" — now includes a prominent link to Skills at the top, not a separate tab",
    "\"More\" renamed to \"Profile\"; About Sidekick moved inside it rather than its own tab",
  ]},
  { version: "1.6.0", notes: [
    "Home screen rebuilt around your dog: photo/avatar, name, and a real 3-exercise \"today's session\" instead of a single suggestion",
    "New: interactive troubleshooting wizard — pick a problem, answer 1-2 questions, get a diagnosis and starting lessons",
    "\"Help with a behaviour\" and \"What should I train?\" quick actions on Home",
    "Progress-by-category preview on Home, not just raw counts",
    "Session recommendations no longer include reference/assessment lessons (only real hands-on exercises)",
  ]},
  { version: "1.5.0", notes: [
    "Modal dialogs now support screen readers and keyboard navigation (focus trap, Escape to close)",
    "Added Apple PWA meta tags for a cleaner install on iOS",
    "Session history: paginated, and you can now delete an individual session (progress recalculates correctly)",
    "Personal notes on any lesson, per dog",
    "Search added to the Behaviour and Skills tabs",
    "New PWA shortcut: long-press the app icon to jump straight into today's suggestion",
    "About page: added an Evidence base section listing the real welfare/training sources behind the app (not just the Woofz UX-inspiration note), and made clear that data doesn't sync between devices",
  ]},
  { version: "1.4.1", notes: [
    "Fixed: Home screen's \"This week\" stats were actually all-time — relabelled to Overview",
    "Fixed: the suggested lesson could recommend something before its prerequisites were done",
    "Added: \"Using it in real life\" guidance now shown on lessons that have it",
  ]},
  { version: "1.4.0", notes: [
    "Data integrity check tool (More → Data)",
    "Printable / exportable training log",
    "This version history screen",
    "Accessibility contrast pass across light and dark themes",
    "Lesson search now also matches success criteria and common mistakes",
  ]},
  { version: "1.3.0", notes: [
    "Training protocols reference screen",
    "Safety gate banners now show when each one applies, not just what to do",
    "Evidence sources are tappable — see the key finding, limitations and a link out",
    "Lessons can carry optional images or video",
    "New Progress tab: weekly chart, category breakdown, full session history",
    "Favourite/bookmark any lesson",
  ]},
  { version: "1.2.0", notes: [
    "About page with support link and links to other Duffers apps",
    "Light / dark / auto appearance setting",
    "Persistent home logo in the top bar",
    "Fixed a bug where a screen could show a previous screen's title",
  ]},
  { version: "1.1.0", notes: [
    "Lesson prerequisites shown before you start",
    "Tab bar hidden during onboarding and mid-session so progress can't be lost by mistake",
    "Loading state on first launch",
    "Source citations added to Myths and Owner guidance",
  ]},
  { version: "1.0.0", notes: [
    "Initial release: dog profiles, 530-lesson library, adaptive training sessions, behaviour guide, skills tracker, daily programmes, safety gates, evidence library",
  ]},
];

// Excludes Woofz deliberately: the data's own evidence_type field already
// classifies it as "Product/topic inspiration" / "Commercial educational
// material", not welfare/training evidence — it's disclosed separately via
// copyright_note. This list is specifically the genuine evidence base.
function sourceOrgSummary(){
  const counts = {};
  sk.KB.collections.evidence_sources.forEach(s=>{
    if(s.organisation === "Woofz") return;
    counts[s.organisation] = (counts[s.organisation]||0) + 1;
  });
  return Object.entries(counts).sort((a,b)=>b[1]-a[1]);
}

function renderAbout(container){
  const kb = sk.KB;
  const reviewStatus = kb.content_review_status;
  container.innerHTML = `
    <div class="about-hero" style="text-align:center; margin-bottom:18px;">
      <div style="margin-bottom:8px;">${sk.logoLockupHTML(220)}</div>
      <p style="color:var(--ink-soft); font-size:13.5px; margin-bottom:0;">A calm, reward-based training companion for you and your dog.</p>
    </div>

    <div class="card" style="text-align:center;">
      <h3 style="margin-bottom:6px;">☕ Enjoying Sidekick?</h3>
      <p style="font-size:13.5px; color:var(--ink-soft);">This app is free and ad-free. If it's made training easier, a coffee would be very much appreciated!</p>
      <a href="https://buymeacoffee.com/duffers" target="_blank" rel="noopener" style="display:inline-block; background:#FFDD00; color:#1a1a1a; font-size:14px; font-weight:800; padding:11px 22px; border-radius:10px; text-decoration:none;">☕ Buy Duffers a Coffee</a>
    </div>

    <div class="card">
      <p style="font-size:13.5px; margin-bottom:0;">${sk.esc(kb.purpose || "A reward-based, welfare-centred dog training companion.")}</p>
    </div>

    <div class="stat-grid" style="grid-template-columns:repeat(3,1fr);">
      <div class="stat-box"><div class="num" style="font-size:18px;">${kb.collections.lessons.length}</div><div class="lbl">Lessons</div></div>
      <div class="stat-box"><div class="num" style="font-size:18px;">${kb.collections.skills.length}</div><div class="lbl">Skills</div></div>
      <div class="stat-box"><div class="num" style="font-size:18px;">${kb.collections.behaviours.length}</div><div class="lbl">Behaviours</div></div>
    </div>

    ${reviewStatus ? `<div class="banner banner-amber"><span class="glyph">📋</span><div><strong>Content status:</strong> ${sk.esc(reviewStatus)}</div></div>` : ""}

    ${kb.copyright_note ? `<div class="section-label" role="heading" aria-level="2">A note on content</div>
    <p style="font-size:13px; color:var(--ink-soft);">${sk.esc(kb.copyright_note)}</p>` : ""}

    ${kb.progression_note ? `<div class="section-label" role="heading" aria-level="2">A note on progression</div>
    <p style="font-size:13px; color:var(--ink-soft);">${sk.esc(kb.progression_note)}</p>` : ""}

    <div class="section-label" role="heading" aria-level="2">Evidence base</div>
    <div class="card">
      <p style="font-size:13px; color:var(--ink-soft); margin-bottom:10px;">Sidekick's lessons and safety guidance draw on published welfare and training guidance from:</p>
      ${sourceOrgSummary().map(([org,count])=>`
        <div style="display:flex; justify-content:space-between; padding:6px 0; border-bottom:1px solid var(--line); font-size:13.5px;">
          <span>${sk.esc(org)}</span>
          <span style="color:var(--ink-soft);">${count} source${count===1?"":"s"}</span>
        </div>`).join("")}
      <p style="font-size:12px; color:var(--ink-soft); margin-top:10px; margin-bottom:0;">Individual citations, with what each finding does and doesn't mean, are in More → Evidence library.</p>
    </div>

    <div class="section-label" role="heading" aria-level="2">More from Duffers</div>
    <div class="card">
      <h3 style="margin-bottom:4px;">🧭 Also logging your travels?</h3>
      <p style="font-size:13px; color:var(--ink-soft);">Waypoints is a personal travel log — everywhere you've been, and everywhere you're going. Same no-accounts, no-tracking approach.</p>
      <a href="https://dirtyduffers.github.io/waypoints/" target="_blank" rel="noopener" style="display:inline-block; background:#2F6B5E; color:#fff; font-size:13px; font-weight:700; padding:9px 16px; border-radius:10px; text-decoration:none;">Open Waypoints ↗</a>
    </div>
    <div class="card">
      <h3 style="margin-bottom:4px;">⚽ Follow Liverpool FC?</h3>
      <p style="font-size:13px; color:var(--ink-soft);">LFC Fixtures covers every result back to 1894, head-to-head records, and an away-day trip planner.</p>
      <a href="https://dirtyduffers.github.io/LFC-Fixtures/" target="_blank" rel="noopener" style="display:inline-block; background:#C8102E; color:#fff; font-size:13px; font-weight:700; padding:9px 16px; border-radius:10px; text-decoration:none;">Open LFC Fixtures ↗</a>
    </div>
    <div class="card">
      <h3 style="margin-bottom:4px;">🥷 Have a Ninja appliance?</h3>
      <p style="font-size:13px; color:var(--ink-soft);">Ninja Hub covers cook guides for the Blender, Air Fryer, and Woodfire Grill, all in one place.</p>
      <a href="https://dirtyduffers.github.io/Ninja-Hub/" target="_blank" rel="noopener" style="display:inline-block; background:#C08A2B; color:#fff; font-size:13px; font-weight:700; padding:9px 16px; border-radius:10px; text-decoration:none;">Open Ninja Hub ↗</a>
    </div>

    <div class="section-label" role="heading" aria-level="2">Add to Home Screen</div>
    <div class="card">
      <div style="margin-bottom:10px;">
        <div style="font-size:13px; font-weight:700; margin-bottom:3px;">🍎 iPhone / iPad (Safari)</div>
        <div style="background:var(--canvas); border:1px solid var(--line); border-radius:8px; padding:8px 10px; font-size:12.5px;">Tap Share → Add to Home Screen → Add</div>
      </div>
      <div style="margin-bottom:10px;">
        <div style="font-size:13px; font-weight:700; margin-bottom:3px;">🤖 Android (Chrome)</div>
        <div style="background:var(--canvas); border:1px solid var(--line); border-radius:8px; padding:8px 10px; font-size:12.5px;">Tap ⋮ → Add to Home screen or Install app</div>
      </div>
      <div>
        <div style="font-size:13px; font-weight:700; margin-bottom:3px;">🪟 Windows / Mac</div>
        <div style="background:var(--canvas); border:1px solid var(--line); border-radius:8px; padding:8px 10px; font-size:12.5px;">Chrome/Edge: click the install icon in the address bar</div>
      </div>
    </div>

    <div class="section-label" role="heading" aria-level="2">Data & privacy</div>
    <div class="card">
      <p style="font-size:13px; margin-bottom:0;">Everything you enter — dog profiles, sessions, skill progress — stays on this device in your browser's local storage. Nothing is sent anywhere.</p>
      <p style="font-size:13px; margin:10px 0 0;"><strong>This means it doesn't sync between devices.</strong> Training on your phone and your tablet keeps two separate histories. To move to a new device or keep a backup, use More → Data → Export backup, then Import backup on the other device.</p>
    </div>

    <div class="section-label" role="heading" aria-level="2">Author</div>
    <div class="card">
      <p style="font-size:13px; margin-bottom:0;">Created by <strong>Duffers</strong> — built for training with care, not for training data.</p>
    </div>

    <p id="versionFooter" style="text-align:center; font-size:11.5px; color:var(--ink-soft); margin-top:8px; cursor:pointer;">Sidekick v${APP_VERSION} · by Duffers</p>
  `;
  document.getElementById("versionFooter").addEventListener("click", openChangelog);
}

function openChangelog(){
  sk.openModal(`
    <h3>Version history</h3>
    ${CHANGELOG.map(v=>`
      <div class="card">
        <strong>v${v.version}</strong>
        <ul style="margin:8px 0 0; padding-left:18px; font-size:13px; color:var(--ink-soft);">
          ${v.notes.map(n=>`<li style="margin-bottom:4px;">${sk.esc(n)}</li>`).join("")}
        </ul>
      </div>`).join("")}
  `);
}

sk.SCREEN_RENDERERS.about = renderAbout;

/* ---------- Content / data integrity check ---------- */
function runDataIntegrityCheck(){
  const KB = sk.KB, IDX = sk.IDX;
  const errors = [], warnings = [];
  const seenIds = new Set();

  KB.collections.lessons.forEach(l=>{
    if(seenIds.has(l.lesson_id)) errors.push(`Duplicate lesson ID: ${l.lesson_id}`);
    seenIds.add(l.lesson_id);

    ["title","objective","steps","success_criteria"].forEach(f=>{
      if(!l[f] || !String(l[f]).trim()) errors.push(`${l.lesson_id}: missing required field "${f}"`);
    });

    sk.splitPipe(l.prerequisites).forEach(pid=>{
      if(!IDX.lessonsById.has(pid)) errors.push(`${l.lesson_id}: prerequisite "${pid}" doesn't exist`);
    });
    sk.splitPipe(l.related_lessons).forEach(rid=>{
      if(!IDX.lessonsById.has(rid)) errors.push(`${l.lesson_id}: related lesson "${rid}" doesn't exist`);
    });
    sk.splitSemi(l.safety_gate_ids).forEach(gid=>{
      if(!IDX.safetyGatesById.has(gid)) errors.push(`${l.lesson_id}: safety gate "${gid}" doesn't exist`);
    });
    const srcIds = sk.splitSemi(l.source_ids).length ? sk.splitSemi(l.source_ids) : sk.splitPipe(l.source_ids);
    srcIds.forEach(sid=>{
      if(!IDX.sourcesById.has(sid)) warnings.push(`${l.lesson_id}: source "${sid}" doesn't exist`);
    });
    if(!sk.CATEGORY_COLOR_VARS[l.category]) warnings.push(`${l.lesson_id}: category "${l.category}" has no colour mapping (will show as grey)`);

    if(l.media){
      const stepCount = sk.splitPipe(l.steps).length;
      if(l.media.steps && Array.isArray(l.media.steps) && l.media.steps.length !== stepCount){
        warnings.push(`${l.lesson_id}: media.steps has ${l.media.steps.length} entries but there are ${stepCount} steps`);
      }
      const checkUrl = (u, label)=>{
        if(u && u.startsWith("data:")) warnings.push(`${l.lesson_id}: ${label} is base64-embedded — consider a real file/URL instead to keep the library small`);
      };
      checkUrl(l.media.image||l.media.hero_image, "hero image");
      checkUrl(l.media.video||l.media.hero_video, "hero video");
      (l.media.steps||[]).forEach((s,i)=>{ if(s){ checkUrl(s.image,`step ${i+1} image`); checkUrl(s.video,`step ${i+1} video`); } });
    }
  });

  KB.collections.behaviours.forEach(b=>{
    sk.splitSemi(b.safety_gate_ids).forEach(gid=>{
      if(!IDX.safetyGatesById.has(gid)) errors.push(`Behaviour ${b.behaviour_id}: safety gate "${gid}" doesn't exist`);
    });
  });
  KB.collections.protocols.forEach(p=>{
    sk.splitSemi(p.safety_gate_ids).forEach(gid=>{
      if(!IDX.safetyGatesById.has(gid)) errors.push(`Protocol ${p.protocol_id}: safety gate "${gid}" doesn't exist`);
    });
  });
  KB.collections.skills.forEach(s=>{
    if(!sk.findMatchingLesson(s.skill_id)) warnings.push(`Skill ${s.skill_id} (${s.skill_name}) has no linked lesson`);
  });

  // Source references on the reference collections (myths, owner guidance,
  // evidence cards) weren't checked before — only lessons were. Added after
  // noticing the gap during a full project audit.
  const checkSources = (list, idField, label)=>{
    list.forEach(item=>{
      const raw = item.source_ids || "";
      const ids = raw.split(/[|;]/).map(s=>s.trim()).filter(Boolean);
      ids.forEach(sid=>{
        if(!IDX.sourcesById.has(sid)) warnings.push(`${label} ${item[idField]}: source "${sid}" doesn't exist`);
      });
    });
  };
  checkSources(KB.collections.myths, "myth_id", "Myth");
  checkSources(KB.collections.owner_guidance, "guidance_id", "Owner guidance");
  if(KB.collections.evidence_cards.length){
    const evidenceIdField = Object.keys(KB.collections.evidence_cards[0]).find(k=>k.endsWith("_id")) || "topic";
    checkSources(KB.collections.evidence_cards, evidenceIdField, "Evidence card");
  }

  (KB.collections.troubleshooting_trees||[]).forEach(tree=>{
    if(!tree.nodes[tree.start]) errors.push(`Troubleshoot tree ${tree.tree_id}: missing start node "${tree.start}"`);
    Object.entries(tree.nodes).forEach(([nodeId, node])=>{
      if(node.type === "question"){
        (node.options||[]).forEach(opt=>{
          if(!tree.nodes[opt.goto]) errors.push(`Troubleshoot tree ${tree.tree_id}/${nodeId}: broken link to "${opt.goto}"`);
        });
      } else if(node.type === "result"){
        (node.related_lessons||[]).forEach(lid=>{
          if(!IDX.lessonsById.has(lid)) errors.push(`Troubleshoot tree ${tree.tree_id}/${nodeId}: related lesson "${lid}" doesn't exist`);
        });
      } else {
        errors.push(`Troubleshoot tree ${tree.tree_id}/${nodeId}: unknown node type "${node.type}"`);
      }
    });
  });

  return { errors, warnings };
}

function runIntegrityCheckUI(container){
  const result = runDataIntegrityCheck();
  console.log("Sidekick data integrity check:", result);
  const resultsEl = container.querySelector("#integrityResults");
  const total = result.errors.length + result.warnings.length;
  if(total === 0){
    resultsEl.innerHTML = `<div class="banner banner-green"><span class="glyph">✅</span><div>All clear — no broken references or missing fields found.</div></div>`;
    return;
  }
  const list = (items, label, cls)=> items.length ? `
    <div class="banner ${cls}" style="flex-direction:column; align-items:stretch;">
      <strong style="margin-bottom:6px;">${items.length} ${label}</strong>
      <div style="max-height:180px; overflow-y:auto; font-size:12px; line-height:1.6;">
        ${items.slice(0,50).map(m=>`<div>• ${sk.esc(m)}</div>`).join("")}
        ${items.length>50 ? `<div style="margin-top:4px; opacity:0.8;">…and ${items.length-50} more — full list logged to console.</div>` : ""}
      </div>
    </div>` : "";
  resultsEl.innerHTML = list(result.errors, "error(s)", "banner-red") + list(result.warnings, "warning(s)", "banner-amber");
}

/* ---------- Printable / exportable training log ---------- */
// A curated, one-page shareable snapshot -- distinct from the exhaustive
// session-by-session Printable Log below. Reuses the same calculations as
// the Training Journey modal so the numbers are always consistent between them.
// A single lesson formatted for a paper backup -- useful outdoors where
// checking a phone mid-session isn't practical. Reuses the same print
// classes as the training report and full log for visual consistency.
function openLessonPrintView(l){
  const steps = sk.splitPipe(l.steps);
  const mistakes = sk.splitPipe(l.common_mistakes);
  const overlay = document.createElement("div");
  overlay.id = "lessonPrintOverlay";
  overlay.className = "print-overlay";
  overlay.innerHTML = `
    <div class="print-toolbar no-print">
      <button class="btn btn-ghost" id="lessonPrintClose">← Back</button>
      <button class="btn btn-primary" id="lessonPrintGo">🖨️ Print / Save as PDF</button>
    </div>
    <div class="print-page">
      <h1>${sk.esc(l.title)}</h1>
      <p class="print-sub">${sk.esc(l.category)} · ${sk.esc(l.difficulty||"")} · ${l.session_length_min?l.session_length_min+" min":""}</p>

      <h2>Today's goal</h2>
      <p>${sk.esc(l.objective)}</p>

      ${l.setup ? `<h2>Setup</h2><p>${sk.esc(l.setup)}</p>` : ""}

      <h2>Steps</h2>
      <table class="print-table">
        ${steps.map((s,i)=>`<tr><td style="width:26px; font-weight:700;">${i+1}</td><td>${sk.esc(s)}</td></tr>`).join("")}
      </table>

      <h2>Success looks like</h2>
      <p>${sk.esc(l.success_criteria)}</p>

      ${mistakes.length ? `<h2>Common mistakes</h2>
      <table class="print-table">
        ${mistakes.map(m=>`<tr><td>✗ ${sk.esc(m)}</td></tr>`).join("")}
      </table>` : ""}

      ${l.equipment ? `<h2>Equipment</h2><p>${sk.esc(l.equipment)}</p>` : ""}

      <p class="print-footer">Printed from Sidekick — a reward-based dog training companion.</p>
    </div>
  `;
  document.body.appendChild(overlay);
  document.getElementById("lessonPrintClose").addEventListener("click", ()=>overlay.remove());
  document.getElementById("lessonPrintGo").addEventListener("click", ()=>window.print());
}

// A landscape, decoratively-bordered certificate -- printable/saveable as a
// PDF using the same browser print mechanism as the other print views.
// Gated on a modest lesson-count threshold so it reflects genuine progress
// rather than being available from the very first session.
const CERTIFICATE_THRESHOLD = 10;

// Every possible certificate for this dog: the general "X lessons completed"
// one, plus one per eligible category, each requiring that category's
// lessons be fully completed -- a clean, unambiguous bar rather than an
// arbitrary percentage.
function getCertificateProgress(dogId){
  const lessons = sk.KB.collections.lessons;
  const progress = sk.DB.lessonProgress[dogId] || {};
  const totalCompleted = sk.totalLessonsCompleted(dogId);

  const list = [{
    type: "general", category: null, label: "Overall Achievement",
    completed: totalCompleted, total: CERTIFICATE_THRESHOLD,
    unlocked: totalCompleted >= CERTIFICATE_THRESHOLD,
  }];

  const gamesDone = sk.GAMES_LIST.filter(g=>progress[g.lessonId]).length;
  list.push({
    type: "games", category: null, label: "🎮 Games Master",
    completed: gamesDone, total: sk.GAMES_LIST.length,
    unlocked: gamesDone === sk.GAMES_LIST.length,
  });

  sk.CERTIFICATE_CATEGORIES.forEach(cat=>{
    const inCat = lessons.filter(l=>l.category===cat);
    const done = inCat.filter(l=>progress[l.lesson_id]).length;
    list.push({
      type: "category", category: cat, label: cat,
      completed: done, total: inCat.length,
      unlocked: inCat.length>0 && done === inCat.length,
    });
  });
  return list;
}

// A browsable list of every certificate this dog could earn -- unlocked ones
// open straight into the generated certificate; locked ones show progress
// so there's a visible reason to keep training toward them.
function openCertificateList(){
  const dog = sk.getCurrentDog();
  if(!dog){ sk.showToast("Add a dog first."); return; }
  const certs = getCertificateProgress(dog.id);
  sk.openModal(`
    <h3 style="text-align:center; margin-bottom:4px;">Certificates</h3>
    <p style="text-align:center; color:var(--ink-soft); font-size:13px; margin-bottom:16px;">Earn a certificate for ${sk.esc(dog.name)}'s overall progress, or for fully completing a category.</p>
    <div class="row-list">
      ${certs.map((c,i)=>{
        const pct = c.total ? Math.round(c.completed/c.total*100) : 0;
        return `
        <button class="row" data-cert-idx="${i}" style="${c.unlocked?'':'opacity:0.75;'}">
          <div class="row-tab" style="background:${c.unlocked?'var(--ochre)':'var(--line)'}"></div>
          <div class="row-body">
            <div class="row-title">${c.unlocked?'🏅 ':'🔒 '}${sk.esc(c.label)}</div>
            <div class="row-meta">${c.unlocked ? "Ready to view" : `${c.completed} / ${c.total} lessons (${pct}%)`}</div>
          </div>
          <span class="row-chev">›</span>
        </button>`;
      }).join("")}
    </div>
  `);
  document.querySelectorAll("[data-cert-idx]").forEach(btn=>{
    btn.addEventListener("click", ()=>{
      const c = certs[Number(btn.dataset.certIdx)];
      if(!c.unlocked){
        sk.showToast(`${c.completed} of ${c.total} lessons completed — keep going!`);
        return;
      }
      sk.closeModal();
      openCertificateView(dog, c);
    });
  });
}

// The actual generated, printable certificate for one specific achievement.
function openCertificateView(dog, cert){
  // The signature font is only needed here, so it's loaded on demand rather
  // than adding a network dependency to every page load.
  if(!document.getElementById("certFontLink")){
    const link = document.createElement("link");
    link.id = "certFontLink";
    link.rel = "stylesheet";
    link.href = "https://fonts.googleapis.com/css2?family=Caveat:wght@600&display=swap";
    document.head.appendChild(link);
  }

  const generatedDate = new Date().toLocaleDateString(undefined,{year:"numeric",month:"long",day:"numeric"});
  const bodyText = cert.type === "general"
    ? `has successfully completed <strong>${cert.completed} training lessons</strong>, using calm, positive, reward-based methods.`
    : cert.type === "games"
    ? `has played and completed <strong>every game</strong> in Sidekick — a true master of play, bonding, and enrichment.`
    : `has successfully completed the <strong>${sk.esc(cert.category)}</strong> training category in full, using calm, positive, reward-based methods.`;

  const overlay = document.createElement("div");
  overlay.id = "certificateOverlay";
  overlay.className = "print-overlay";
  overlay.innerHTML = `
    <div class="print-toolbar no-print">
      <button class="btn btn-ghost" id="certClose">← Back</button>
      <button class="btn btn-primary" id="certGo">🖨️ Print / Save as PDF</button>
    </div>
    <div class="certificate-page">
      <div class="certificate-inner">
        <img src="images/logo-lockup-light.png" alt="Sidekick" class="certificate-logo">
        <img src="images/holo-icon.png" alt="" class="certificate-holo">
        <img src="images/certificate-medal.png" alt="" style="width:74px; height:74px; object-fit:contain; position:relative;">
        <div class="certificate-title" style="position:relative;">Certificate of Achievement</div>
        <div class="certificate-sub" style="position:relative;">${cert.type==="general"?"Reward-Based Training":cert.type==="games"?"Play &amp; Enrichment":sk.esc(cert.category)}</div>
        <div class="certificate-dogname" style="position:relative;">${sk.esc(dog.name)}</div>
        <div class="certificate-body" style="position:relative;">${bodyText}</div>
        <div class="certificate-signoff">
          <img src="images/certificate-signature.png" alt="Duffers" class="certificate-sig-img"
               onerror="this.style.display='none'; this.nextElementSibling.style.display='block';">
          <div class="certificate-sig-text" style="display:none;">Duffers</div>
          <div class="certificate-sig-line">Awarded by</div>
        </div>
        <div class="certificate-footer">
          <div>Generated ${generatedDate}</div>
          <div>Sidekick — reward-based dog training</div>
        </div>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);
  document.getElementById("certClose").addEventListener("click", ()=>overlay.remove());
  document.getElementById("certGo").addEventListener("click", ()=>window.print());
}

function openTrainingReport(){
  const dog = sk.getCurrentDog();
  if(!dog){ sk.showToast("Add a dog first."); return; }
  const sessions = sk.DB.sessions.filter(s=>s.dogId===dog.id).sort((a,b)=>new Date(b.date)-new Date(a.date));
  const counts = sk.skillSummary(dog.id);
  const skillTotal = sk.KB.collections.skills.length;
  const overallPct = sk.overallProgressPercent(dog.id);
  const streak = sk.trainingStreak(dog.id);
  const longest = sk.longestStreakEver(dog.id);
  const lessonsCompleted = sk.totalLessonsCompleted(dog.id);
  const generatedDate = new Date().toLocaleDateString(undefined,{year:"numeric",month:"long",day:"numeric"});

  const categoryProgress = Object.entries(
    sk.KB.collections.lessons.reduce((acc,l)=>{
      const p = sk.DB.lessonProgress[dog.id]?.[l.lesson_id];
      if(!acc[l.category]) acc[l.category] = {done:0,total:0};
      acc[l.category].total++;
      if(p) acc[l.category].done++;
      return acc;
    }, {})
  ).filter(([,v])=>v.total>=4 && v.done>0).sort((a,b)=>(b[1].done/b[1].total)-(a[1].done/a[1].total));

  const recent = sessions.slice(0, 8);

  const overlay = document.createElement("div");
  overlay.id = "trainingReportOverlay";
  overlay.className = "print-overlay";
  overlay.innerHTML = `
    <div class="print-toolbar no-print">
      <button class="btn btn-ghost" id="reportClose">← Back</button>
      <button class="btn btn-primary" id="reportGo">🖨️ Print / Save as PDF</button>
    </div>
    <div class="print-page">
      <h1>${sk.esc(dog.name)}'s Training Report</h1>
      <p class="print-sub">${sk.esc(dog.breed || dog.ageStage)} · Generated ${generatedDate} · Sidekick v${APP_VERSION}</p>

      <div class="report-stat-row">
        <div class="report-stat"><div class="num">${overallPct}%</div><div class="lbl">Overall progress</div></div>
        <div class="report-stat"><div class="num">${streak}</div><div class="lbl">Current streak</div></div>
        <div class="report-stat"><div class="num">${longest}</div><div class="lbl">Longest streak</div></div>
        <div class="report-stat"><div class="num">${lessonsCompleted}</div><div class="lbl">Lessons trained</div></div>
      </div>

      <h2>Skills by stage</h2>
      <table class="print-table">
        ${sk.SKILL_STATES.map(st=>`<tr><td>${sk.esc(st)}</td><td>${counts[st]||0}</td></tr>`).join("")}
      </table>
      <p style="font-size:11.5px; color:var(--ink-soft); margin-top:-4px;">${skillTotal} skills tracked in total</p>

      ${categoryProgress.length ? `
      <h2>Progress by category</h2>
      <table class="print-table">
        ${categoryProgress.map(([cat,v])=>`<tr><td>${sk.esc(cat)}</td><td>${Math.round(v.done/v.total*100)}% (${v.done}/${v.total})</td></tr>`).join("")}
      </table>` : ""}

      <h2>Recent activity</h2>
      ${recent.length ? `
      <table class="print-table">
        <tr><th>Date</th><th>Lesson</th><th>Result</th></tr>
        ${recent.map(s=>{
          const l = sk.IDX.lessonsById.get(s.lessonId);
          return `<tr><td>${sk.fmtDate(s.date)}</td><td>${sk.esc(l?l.title:"—")}</td><td>${s.successCount}/${s.repCount} (${Math.round(s.rate*100)}%)</td></tr>`;
        }).join("")}
      </table>` : `<p>No sessions logged yet.</p>`}

      <p class="print-footer">Generated by Sidekick — a reward-based dog training companion. For a full session-by-session record, use "Print / export full training log" in Profile.</p>
    </div>
  `;
  document.body.appendChild(overlay);
  document.getElementById("reportClose").addEventListener("click", ()=>overlay.remove());
  document.getElementById("reportGo").addEventListener("click", ()=>window.print());
}

function openPrintableLog(){
  const dog = sk.getCurrentDog();
  if(!dog){ sk.showToast("Add a dog first."); return; }
  const sessions = sk.DB.sessions.filter(s=>s.dogId===dog.id).sort((a,b)=>new Date(b.date)-new Date(a.date));
  const skillRows = sk.KB.collections.skills.map(s=>({ s, state: sk.dogSkillState(dog.id, s.skill_id) }));
  const bySub = {};
  skillRows.forEach(r=>{ (bySub[r.s.subcategory]=bySub[r.s.subcategory]||[]).push(r); });
  const totalSessions = sessions.length;
  const uniqueDays = new Set(sessions.map(s=>s.date.slice(0,10))).size;
  const avgRate = sessions.length ? sessions.reduce((sum,s)=>sum+s.rate,0)/sessions.length : 0;
  const generatedDate = new Date().toLocaleDateString(undefined,{year:"numeric",month:"long",day:"numeric"});

  const overlay = document.createElement("div");
  overlay.id = "printLogOverlay";
  overlay.className = "print-overlay";
  overlay.innerHTML = `
    <div class="print-toolbar no-print">
      <button class="btn btn-ghost" id="printLogClose">← Back</button>
      <button class="btn btn-primary" id="printLogGo">🖨️ Print / Save as PDF</button>
    </div>
    <div class="print-page">
      <h1>${sk.esc(dog.name)}'s Training Log</h1>
      <p class="print-sub">${sk.esc(dog.breed || dog.ageStage)} · Generated ${generatedDate} · Sidekick v${APP_VERSION}</p>

      <h2>Summary</h2>
      <table class="print-table">
        <tr><td>Total sessions</td><td>${totalSessions}</td></tr>
        <tr><td>Training days</td><td>${uniqueDays}</td></tr>
        <tr><td>Average success rate</td><td>${Math.round(avgRate*100)}%</td></tr>
      </table>

      <h2>Skill progress</h2>
      ${Object.keys(bySub).map(sub=>`
        <h3>${sk.esc(sub)}</h3>
        <table class="print-table">
          ${bySub[sub].map(r=>`<tr><td>${sk.esc(r.s.skill_name)}</td><td>${r.state}</td></tr>`).join("")}
        </table>
      `).join("")}

      <h2>Session history</h2>
      ${sessions.length ? `
      <table class="print-table print-table-wide">
        <tr><th>Date</th><th>Lesson</th><th>Reps</th><th>Success</th><th>Felt</th></tr>
        ${sessions.map(s=>{
          const l = sk.IDX.lessonsById.get(s.lessonId);
          return `<tr><td>${sk.fmtDate(s.date)}</td><td>${sk.esc(l?l.title:"—")}</td><td>${s.successCount}/${s.repCount}</td><td>${Math.round(s.rate*100)}%</td><td>${sk.esc(s.feedback||"—")}</td></tr>`;
        }).join("")}
      </table>` : `<p>No sessions logged yet.</p>`}

      <p class="print-footer">Generated by Sidekick — a reward-based dog training companion.</p>
    </div>
  `;
  document.body.appendChild(overlay);
  document.getElementById("printLogClose").addEventListener("click", ()=>overlay.remove());
  document.getElementById("printLogGo").addEventListener("click", ()=>window.print());
}

function confirmReset(){
  sk.openModal(`
    <h3>Reset all data?</h3>
    <p style="color:var(--ink-soft); font-size:14px;">This removes every dog, session and skill record from this device. Export a backup first if you want to keep it.</p>
    <button class="btn btn-danger btn-block" id="confirmResetBtn">Reset everything</button>
    <button class="btn btn-ghost btn-block" style="margin-top:8px;" id="cancelResetBtn">Cancel</button>
  `);
  document.getElementById("confirmResetBtn").addEventListener("click", ()=>{
    localStorage.removeItem("sidekick.v1");
    sk.DB = sk.loadDB();
    sk.closeModal();
    sk.goScreen("onboarding");
  });
  document.getElementById("cancelResetBtn").addEventListener("click", sk.closeModal);
}

sk.SCREEN_RENDERERS.more = renderMore;
window.__sk.openLessonPrintView = openLessonPrintView;
})();

/* ============================================================
   PROGRESS TAB — training history, trends, category breakdown
   ============================================================ */
(function(){
const sk = window.__sk;

function weeklySessionCounts(dogId, weeks){
  const now = new Date();
  const dayMs = 86400000;
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const currentWeekStart = new Date(todayStart.getTime() - todayStart.getDay()*dayMs);
  const buckets = [];
  for(let i=weeks-1;i>=0;i--){
    const weekStart = new Date(currentWeekStart.getTime() - i*7*dayMs);
    const weekEnd = new Date(weekStart.getTime() + 7*dayMs);
    const count = sk.DB.sessions.filter(s=>{
      if(s.dogId!==dogId) return false;
      const d = new Date(s.date);
      return d>=weekStart && d<weekEnd;
    }).length;
    buckets.push({ label: weekStart.toLocaleDateString(undefined,{month:"short",day:"numeric"}), count });
  }
  return buckets;
}

function categoryBreakdown(dogId){
  const counts = {};
  sk.DB.sessions.filter(s=>s.dogId===dogId).forEach(s=>{
    const l = sk.IDX.lessonsById.get(s.lessonId);
    if(!l) return;
    counts[l.category] = (counts[l.category]||0) + 1;
  });
  return Object.entries(counts).sort((a,b)=>b[1]-a[1]);
}

function overallStats(dogId){
  const sessions = sk.DB.sessions.filter(s=>s.dogId===dogId);
  const uniqueDays = new Set(sessions.map(s=>s.date.slice(0,10))).size;
  const avgRate = sessions.length ? sessions.reduce((sum,s)=>sum+s.rate,0)/sessions.length : 0;
  return { total: sessions.length, days: uniqueDays, avgRate };
}

function renderProgress(container){
  const dog = sk.getCurrentDog();
  if(!dog){
    container.innerHTML = '<div class="empty-state"><span class="glyph">📈</span>Add a dog to start tracking progress.</div>';
    return;
  }
  const sessions = sk.DB.sessions.filter(s=>s.dogId===dog.id).sort((a,b)=>new Date(b.date)-new Date(a.date));
  if(!sessions.length){
    container.innerHTML = `<div class="empty-state"><span class="glyph">📈</span>No sessions logged yet for ${sk.esc(dog.name)}.<br>Complete a lesson to start building a history.</div>`;
    return;
  }

  const stats = overallStats(dog.id);
  const streak = sk.trainingStreak(dog.id);
  const weekly = weeklySessionCounts(dog.id, 8);
  const maxWeekly = Math.max(1, ...weekly.map(w=>w.count));
  const categories = categoryBreakdown(dog.id);
  const maxCat = Math.max(1, ...categories.map(c=>c[1]));

  container.innerHTML = `
    <div class="stat-grid">
      <div class="stat-box"><div class="num">${stats.total}</div><div class="lbl">Sessions</div></div>
      <div class="stat-box"><div class="num">${stats.days}</div><div class="lbl">Training days</div></div>
      <div class="stat-box"><div class="num">${streak}</div><div class="lbl">Day streak</div></div>
    </div>
    <div class="card" style="text-align:center;">
      <div style="font-family:var(--font-display); font-size:26px; font-weight:700; color:var(--forest);">${Math.round(stats.avgRate*100)}%</div>
      <div style="font-size:12.5px; color:var(--ink-soft);">average success rate across all sessions</div>
    </div>

    <div class="section-label" role="heading" aria-level="2">Last 8 weeks</div>
    <div class="card">
      <div style="display:flex; align-items:flex-end; gap:6px; height:100px;">
        ${weekly.map(w=>`
          <div style="flex:1; display:flex; flex-direction:column; align-items:center; justify-content:flex-end; height:100%;">
            <div style="width:100%; max-width:28px; background:var(--forest); border-radius:4px 4px 0 0; height:${Math.max(3, w.count/maxWeekly*76)}px;"></div>
          </div>`).join("")}
      </div>
      <div style="display:flex; gap:6px; margin-top:6px;">
        ${weekly.map(w=>`<div style="flex:1; text-align:center; font-size:9.5px; color:var(--ink-soft);">${w.label}</div>`).join("")}
      </div>
    </div>

    <div class="section-label" role="heading" aria-level="2">By category</div>
    <div class="card">
      ${categories.map(([cat,count])=>`
        <div style="display:flex; align-items:center; gap:10px; margin-bottom:8px;">
          <div style="width:96px; font-size:12px; color:var(--ink-soft); overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${sk.esc(cat)}</div>
          <div class="progress-track" style="flex:1;"><div class="progress-fill" style="width:${(count/maxCat*100).toFixed(0)}%; background:var(${sk.getCategoryVar(cat)})"></div></div>
          <div style="width:20px; text-align:right; font-size:12px; font-weight:700;">${count}</div>
        </div>`).join("")}
    </div>

    <div class="section-label" role="heading" aria-level="2">Session history</div>
    <div id="sessionHistoryList"></div>
    <button class="btn btn-ghost btn-block" id="loadMoreSessions" style="display:none; margin-top:4px;">Show more</button>
  `;

  const PAGE_SIZE = 15;
  let shown = PAGE_SIZE;
  function paintHistory(){
    const listEl = container.querySelector("#sessionHistoryList");
    const visible = sessions.slice(0, shown);
    listEl.innerHTML = `<div class="row-list">${visible.map(s=>{
      const l = sk.IDX.lessonsById.get(s.lessonId);
      return `<div class="row" style="cursor:default;" data-session-id="${s.id}">
        <div class="row-tab" style="background:var(${l?sk.getCategoryVar(l.category):'--ink-soft'})"></div>
        <button class="row-body" data-id="${s.lessonId}" style="background:none; border:none; text-align:left; padding:0; cursor:pointer; font-family:inherit; color:inherit;">
          <div class="row-title">${sk.esc(l?l.title:"Deleted lesson")}</div>
          <div class="row-meta">${sk.fmtDate(s.date)} · ${s.successCount}/${s.repCount} reps · ${Math.round(s.rate*100)}% · felt ${sk.esc(s.feedback||"—")}</div>
        </button>
        <button class="icon-btn" data-delete-session="${s.id}" aria-label="Delete this session" style="width:30px;height:30px;font-size:14px;flex:none;">🗑️</button>
      </div>`;
    }).join("")}</div>`;
    listEl.querySelectorAll("[data-id]").forEach(r=>{
      r.addEventListener("click", ()=>sk.openLessonDetail(r.dataset.id));
    });
    listEl.querySelectorAll("[data-delete-session]").forEach(btn=>{
      btn.addEventListener("click", (e)=>{
        e.stopPropagation();
        const sessionId = btn.dataset.deleteSession;
        sk.openModal(`
          <h3>Delete this session?</h3>
          <p style="color:var(--ink-soft); font-size:14px;">This removes it from history and recalculates that lesson's progress from what's left. This can't be undone.</p>
          <button class="btn btn-danger btn-block" id="confirmDeleteSession">Delete session</button>
          <button class="btn btn-ghost btn-block" style="margin-top:8px;" id="cancelDeleteSession">Cancel</button>
        `);
        document.getElementById("confirmDeleteSession").addEventListener("click", ()=>{
          sk.deleteSession(sessionId);
          sk.closeModal();
          sk.showToast("Session deleted.");
          sk.render(); // full re-render so stats/charts reflect the change too
        });
        document.getElementById("cancelDeleteSession").addEventListener("click", sk.closeModal);
      });
    });
    const moreBtn = container.querySelector("#loadMoreSessions");
    moreBtn.style.display = shown < sessions.length ? "block" : "none";
  }
  container.querySelector("#loadMoreSessions").addEventListener("click", ()=>{
    shown += PAGE_SIZE;
    paintHistory();
  });
  paintHistory();
}

sk.SCREEN_RENDERERS.progress = renderProgress;
})();
