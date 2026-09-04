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
  "Troubleshooting":"--cat-trouble","Behaviour Assessment":"--cat-assess"
};
const CATEGORY_ICON = {
  "Foundation":"🌱","Communication & Engagement":"👀","Basic Skills":"🐾","Life Skills":"🏠",
  "Calmness & Regulation":"🧘","Walking":"🚶","Recall":"📣","Socialisation":"🐕‍🦺",
  "Handling & Cooperative Care":"🩺","Home Manners":"🛋️","Alone Time":"🚪","Barking":"🔊",
  "Chewing & Destruction":"🦴","Resource Guarding":"🍖","Chasing & Predatory Behaviour":"🏃",
  "Reactivity":"⚡","Enrichment":"🧩","Tricks & Games":"🎉","Owner Skills":"🧑‍🏫",
  "Assessment":"📋","Safety & Referral":"🚨","Advanced / Real World":"🌍","Troubleshooting":"🔧",
  "Behaviour Assessment":"📋"
};
const SKILL_STATES = ["Acquiring","Developing","Reliable","Generalising","Life-ready"];
const STATE_COLOR = {"Acquiring":"var(--ink-soft)","Developing":"var(--sky)","Reliable":"var(--ochre)","Generalising":"var(--forest)","Life-ready":"var(--forest-dark)"};
const ADAPTIVE_FEEDBACK = ["too easy","about right","difficult","too difficult"];
const AVATAR_COLORS = ["#2F5233","#3E6E82","#C08A2B","#6B4E9A","#B23A2E","#4E7A8C","#8A6D3A"];
const DOG_EMOJI = ["🐕","🐶","🐩","🦮","🐕‍🦺"];
const AGE_STAGES = ["Puppy","Adolescent","Adult","Senior"];

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
    if(raw) return JSON.parse(raw);
  }catch(e){ console.error("Sidekick: failed to parse local data, starting fresh.", e); }
  return { dogs:[], activeDogId:null, sessions:[], skillStates:{}, lessonProgress:{}, settings:{} };
}
function applyTheme(theme){
  document.body.dataset.theme = theme; // "light" | "dark" | "auto" — CSS handles all three
}
function setTheme(theme){
  if(!DB.settings) DB.settings = {};
  DB.settings.theme = theme;
  saveDB();
  applyTheme(theme);
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

/* ---------------- Utility ---------------- */
function uid(){ return Date.now().toString(36)+Math.random().toString(36).slice(2,8); }
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
function openModal(html){
  document.getElementById("modalSheet").innerHTML = '<div class="handle"></div>' + html;
  document.getElementById("modalOverlay").classList.add("active");
}
function closeModal(){
  document.getElementById("modalOverlay").classList.remove("active");
}
document.addEventListener("click", (e)=>{
  if(e.target.id === "modalOverlay") closeModal();
});

/* ---------------- Router ---------------- */
const SCREEN_RENDERERS = {}; // filled in by other sections: name -> function(container)
const TAB_SCREENS = ["home","lessons","behaviours","skills","more","about"];
// Baseline topbar content per screen, applied before the renderer runs.
// This exists so a screen can never show another screen's leftover title —
// a real bug: onboarding never called setTopbar, so reaching it via Reset
// or "remove last dog" left whatever title the previous screen had set.
// Renderers that need dynamic content (e.g. Home's "Hey Bramble!") still
// override this immediately after.
const SCREEN_TOPBAR_DEFAULTS = {
  onboarding: ["Sidekick", "Let's get set up"],
  home: ["Sidekick", "Reward-based training"],
  lessons: ["Lessons", ""],
  behaviours: ["Behaviour guide", "Find management & training routes"],
  skills: ["Skills", ""],
  more: ["More", "Programmes, safety & data"],
  about: ["About", "Sidekick"],
};

function setTabbarVisible(visible){
  document.getElementById("tabbar").style.display = visible ? "flex" : "none";
}

function goScreen(name, opts){
  opts = opts || {};
  currentScreen = name;
  document.querySelectorAll(".tab").forEach(t=>t.classList.toggle("active", t.dataset.screen===name));
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
  CATEGORY_COLOR_VARS, CATEGORY_ICON, SKILL_STATES, STATE_COLOR, ADAPTIVE_FEEDBACK,
  AVATAR_COLORS, DOG_EMOJI, AGE_STAGES,
  splitPipe, splitSemi, getCategoryVar, getCategoryIcon,
  getCurrentDog, ensureCurrentDog, dogSkillState, setDogSkillState, dogLessonProgress,
  uid, esc, fmtDate, daysAgo, showToast, openModal, closeModal, setTheme,
  goScreen, render, SCREEN_RENDERERS, saveDB, loadKnowledgeBase, loadDB, setTabbarVisible
};

/* ---------------- Boot ---------------- */
async function boot(){
  DB = loadDB();
  ensureCurrentDog();
  applyTheme((DB.settings && DB.settings.theme) || "auto");
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
  return '<div class="'+cls+'" style="background:'+color+'">'+ (dog.emoji||"🐕") +'</div>';
}

function renderOnboarding(container){
  sk.setTopbar("Sidekick", "Let's get set up", "");
  container.innerHTML = `
    <div style="padding-top:8px;">
      <div style="text-align:center; margin-bottom:24px;">
        <div style="font-size:44px; margin-bottom:6px;">🐾</div>
        <h1 style="font-size:24px;">Welcome to Sidekick</h1>
        <p style="color:var(--ink-soft); font-size:14.5px;">A calm, reward-based training companion.<br>Let's set up your dog's profile.</p>
      </div>
      <form id="onboardForm">
        <label>Dog's name</label>
        <input type="text" id="ob_name" placeholder="e.g. Bramble" required maxlength="30">

        <label>Breed <span style="font-weight:400;color:var(--ink-soft)">(optional)</span></label>
        <input type="text" id="ob_breed" placeholder="e.g. Cocker Spaniel">

        <label>Life stage</label>
        <div class="chip-group" id="ob_stage">
          ${sk.AGE_STAGES.map((s,i)=>`<button type="button" class="chip${i===1?' selected':''}" data-val="${s}">${s}</button>`).join("")}
        </div>

        <label>Pick an avatar</label>
        <div class="chip-group" id="ob_emoji">
          ${sk.DOG_EMOJI.map((e,i)=>`<button type="button" class="chip${i===0?' selected':''}" data-val="${e}" style="font-size:18px;">${e}</button>`).join("")}
        </div>
        <div class="chip-group" id="ob_color">
          ${sk.AVATAR_COLORS.map((c,i)=>`<button type="button" class="chip${i===0?' selected':''}" data-val="${c}" style="width:34px;height:34px;padding:0;border-radius:50%;background:${c};border-color:${c};"></button>`).join("")}
        </div>

        <button type="submit" class="btn btn-primary btn-block" style="margin-top:8px;">Start training</button>
      </form>
    </div>
  `;
  let stage = sk.AGE_STAGES[1];
  let emoji = sk.DOG_EMOJI[0];
  let color = sk.AVATAR_COLORS[0];
  container.querySelector("#ob_stage").addEventListener("click", e=>{
    const b = e.target.closest(".chip"); if(!b) return;
    container.querySelectorAll("#ob_stage .chip").forEach(c=>c.classList.remove("selected"));
    b.classList.add("selected"); stage = b.dataset.val;
  });
  container.querySelector("#ob_emoji").addEventListener("click", e=>{
    const b = e.target.closest(".chip"); if(!b) return;
    container.querySelectorAll("#ob_emoji .chip").forEach(c=>c.classList.remove("selected"));
    b.classList.add("selected"); emoji = b.dataset.val;
  });
  container.querySelector("#ob_color").addEventListener("click", e=>{
    const b = e.target.closest(".chip"); if(!b) return;
    container.querySelectorAll("#ob_color .chip").forEach(c=>c.classList.remove("selected"));
    b.classList.add("selected"); color = b.dataset.val;
  });
  container.querySelector("#onboardForm").addEventListener("submit", e=>{
    e.preventDefault();
    const name = container.querySelector("#ob_name").value.trim();
    if(!name) return;
    const dog = {
      id: sk.uid(), name, breed: container.querySelector("#ob_breed").value.trim(),
      ageStage: stage, emoji, color, createdAt: new Date().toISOString()
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
  let stage = dog.ageStage, emoji = dog.emoji, color = dog.color;
  const html = `
    <h3>${isNew?"Add a dog":"Edit "+sk.esc(dog.name)}</h3>
    <form id="dogForm">
      <label>Name</label>
      <input type="text" id="df_name" value="${sk.esc(dog.name)}" maxlength="30" required>
      <label>Breed <span style="font-weight:400;color:var(--ink-soft)">(optional)</span></label>
      <input type="text" id="df_breed" value="${sk.esc(dog.breed||"")}">
      <label>Life stage</label>
      <div class="chip-group" id="df_stage">
        ${sk.AGE_STAGES.map(s=>`<button type="button" class="chip${s===stage?' selected':''}" data-val="${s}">${s}</button>`).join("")}
      </div>
      <label>Avatar</label>
      <div class="chip-group" id="df_emoji">
        ${sk.DOG_EMOJI.map(e=>`<button type="button" class="chip${e===emoji?' selected':''}" data-val="${e}" style="font-size:18px;">${e}</button>`).join("")}
      </div>
      <div class="chip-group" id="df_color">
        ${sk.AVATAR_COLORS.map(c=>`<button type="button" class="chip${c===color?' selected':''}" data-val="${c}" style="width:34px;height:34px;padding:0;border-radius:50%;background:${c};border-color:${c};"></button>`).join("")}
      </div>
      <button type="submit" class="btn btn-primary btn-block">${isNew?"Add dog":"Save changes"}</button>
      ${!isNew?'<button type="button" id="df_delete" class="btn btn-danger btn-block" style="margin-top:8px;">Remove '+sk.esc(dog.name)+'</button>':""}
    </form>
  `;
  sk.openModal(html);
  const root = document.getElementById("modalSheet");
  root.querySelector("#df_stage").addEventListener("click", e=>{
    const b=e.target.closest(".chip"); if(!b) return;
    root.querySelectorAll("#df_stage .chip").forEach(c=>c.classList.remove("selected"));
    b.classList.add("selected"); stage=b.dataset.val;
  });
  root.querySelector("#df_emoji").addEventListener("click", e=>{
    const b=e.target.closest(".chip"); if(!b) return;
    root.querySelectorAll("#df_emoji .chip").forEach(c=>c.classList.remove("selected"));
    b.classList.add("selected"); emoji=b.dataset.val;
  });
  root.querySelector("#df_color").addEventListener("click", e=>{
    const b=e.target.closest(".chip"); if(!b) return;
    root.querySelectorAll("#df_color .chip").forEach(c=>c.classList.remove("selected"));
    b.classList.add("selected"); color=b.dataset.val;
  });
  root.querySelector("#dogForm").addEventListener("submit", e=>{
    e.preventDefault();
    const name = root.querySelector("#df_name").value.trim();
    if(!name) return;
    const breed = root.querySelector("#df_breed").value.trim();
    if(isNew){
      const nd = {id:sk.uid(), name, breed, ageStage:stage, emoji, color, createdAt:new Date().toISOString()};
      sk.DB.dogs.push(nd);
      sk.setCurrentDogId(nd.id);
    }else{
      Object.assign(dog, {name, breed, ageStage:stage, emoji, color});
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
window.__sk.renderDogForm = renderDogForm;
window.__sk.openDogSwitcher = openDogSwitcher;
})();

/* ============================================================
   HOME SCREEN
   ============================================================ */
(function(){
const sk = window.__sk;

function setTopbar(title, sub, actionsHTML){
  document.getElementById("topbarTitle").textContent = title;
  document.getElementById("topbarSub").textContent = sub||"";
  document.getElementById("topbarActions").innerHTML = actionsHTML||"";
}

function suggestedLesson(dog){
  const IDX = sk.IDX, KB = sk.KB;
  // Prefer a Foundation/Comms lesson the dog hasn't completed yet; fall back to least-recently-practised.
  // Note: lesson.age_stage isn't a real exclusion filter in this dataset — 506/530 lessons are
  // "All life stages" and the remaining 24 just say "Puppy to adult, adapted to individual" (a
  // note to adapt technique, not a stage to match against), so there's nothing meaningful to
  // filter on here. All lessons are eligible for all dogs regardless of ageStage.
  const progress = sk.DB.lessonProgress[dog.id] || {};
  const candidates = KB.collections.lessons;
  let notStarted = candidates.filter(l=>!progress[l.lesson_id]);
  let pool = notStarted.length ? notStarted : candidates;
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

function skillSummary(dogId){
  const counts = {}; sk.SKILL_STATES.forEach(s=>counts[s]=0);
  sk.KB.collections.skills.forEach(sObj=>{
    const st = sk.dogSkillState(dogId, sObj.skill_id);
    counts[st] = (counts[st]||0)+1;
  });
  return counts;
}

function recentSessions(dogId, n){
  return sk.DB.sessions.filter(s=>s.dogId===dogId).sort((a,b)=>new Date(b.date)-new Date(a.date)).slice(0,n||3);
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
  setTopbar("Sidekick", "Hey "+dog.name+" 👋",
    `<button class="icon-btn" id="switchDogBtn" aria-label="Switch dog">${dog.emoji}</button>`);

  const lesson = suggestedLesson(dog);
  const counts = skillSummary(dog.id);
  const streak = trainingStreak(dog.id);
  const recent = recentSessions(dog.id, 3);
  const totalSessions = sk.DB.sessions.filter(s=>s.dogId===dog.id).length;

  container.innerHTML = `
    <div class="section-label">Today's suggestion</div>
    <div class="card" id="suggestCard" style="cursor:pointer;">
      <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:10px;">
        <div>
          <div class="badge" style="background:var(${sk.getCategoryVar(lesson.category)});color:#fff;">${sk.getCategoryIcon(lesson.category)} ${sk.esc(lesson.category)}</div>
          <h3 style="margin-top:10px;">${sk.esc(lesson.title)}</h3>
          <p style="color:var(--ink-soft); font-size:13.5px; margin-bottom:0;">${sk.esc(lesson.objective)}</p>
        </div>
      </div>
      <div style="display:flex; gap:14px; margin-top:12px; font-size:12.5px; color:var(--ink-soft);">
        <span>⏱ ${sk.esc(lesson.session_length_min)} min</span>
        <span>${sk.esc(lesson.difficulty)}</span>
      </div>
      <button class="btn btn-primary btn-block" style="margin-top:14px;" id="startSuggested">Start session</button>
    </div>

    <div class="section-label">This week</div>
    <div class="stat-grid">
      <div class="stat-box"><div class="num">${streak}</div><div class="lbl">Day streak</div></div>
      <div class="stat-box"><div class="num">${totalSessions}</div><div class="lbl">Total sessions</div></div>
      <div class="stat-box"><div class="num">${counts["Life-ready"]}</div><div class="lbl">Life-ready skills</div></div>
    </div>

    <div class="section-label">Skill progress <a href="#" id="seeSkills" style="font-size:11px;text-transform:none;letter-spacing:0;font-weight:600;color:var(--forest);">View all →</a></div>
    <div class="card">
      ${sk.SKILL_STATES.map(st=>`
        <div style="display:flex; align-items:center; gap:10px; margin-bottom:8px;">
          <div style="width:78px; font-size:12px; color:var(--ink-soft);">${st}</div>
          <div class="progress-track" style="flex:1;"><div class="progress-fill" style="width:${(counts[st]/sk.KB.collections.skills.length*100).toFixed(0)}%; background:${sk.STATE_COLOR[st]}"></div></div>
          <div style="width:20px; text-align:right; font-size:12px; font-weight:700;">${counts[st]}</div>
        </div>`).join("")}
    </div>

    <div class="section-label">Recent sessions</div>
    ${recent.length ? `<div class="row-list">${recent.map(s=>{
      const l = sk.IDX.lessonsById.get(s.lessonId);
      return `<div class="row" style="cursor:default;">
        <div class="row-tab" style="background:var(${sk.getCategoryVar(l?l.category:'')})"></div>
        <div class="row-body">
          <div class="row-title">${sk.esc(l?l.title:"Deleted lesson")}</div>
          <div class="row-meta">${sk.fmtDate(s.date)} · ${s.successCount}/${s.repCount} reps · felt ${s.feedback}</div>
        </div>
      </div>`;
    }).join("")}</div>` : `<div class="empty-state"><span class="glyph">🐾</span>No sessions logged yet — start with the suggestion above.</div>`}
  `;

  container.querySelector("#suggestCard").addEventListener("click", (e)=>{
    if(e.target.id==="startSuggested") return;
    sk.openLessonDetail(lesson.lesson_id);
  });
  container.querySelector("#startSuggested").addEventListener("click", (e)=>{
    e.stopPropagation();
    sk.startSession(lesson.lesson_id);
  });
  document.getElementById("switchDogBtn").addEventListener("click", sk.openDogSwitcher);
  container.querySelector("#seeSkills").addEventListener("click", (e)=>{ e.preventDefault(); sk.goScreen("skills"); });
}

sk.SCREEN_RENDERERS.home = renderHome;
window.__sk.setTopbar = setTopbar;
})();

/* ============================================================
   LESSON LIBRARY (list + filter/search)
   ============================================================ */
(function(){
const sk = window.__sk;

function renderLessons(container){
  sk.setTopbar("Lessons", sk.KB.collections.lessons.length+" in the library", "");
  const f = sk.lessonFilter;

  container.innerHTML = `
    <div class="search-input-wrap">
      <span class="sicon">🔍</span>
      <input type="text" id="lessonSearch" placeholder="Search lessons…" value="${sk.esc(f.query)}">
    </div>
    <div class="chip-group" id="catChips" style="flex-wrap:nowrap; overflow-x:auto; padding-bottom:4px; margin-bottom:10px;">
      <button class="chip${f.category==='All'?' selected':''}" data-val="All">All</button>
      ${sk.IDX.categories.map(c=>`<button class="chip${f.category===c?' selected':''}" data-val="${sk.esc(c)}">${sk.getCategoryIcon(c)} ${sk.esc(c)}</button>`).join("")}
    </div>
    <div class="chip-group" id="diffChips">
      ${["All","Beginner","Intermediate","Advanced"].map(d=>`<button class="chip${f.difficulty===d?' selected':''}" data-val="${d}">${d}</button>`).join("")}
    </div>
    <div id="lessonResults"></div>
  `;

  function applyFilter(){
    let list = sk.KB.collections.lessons;
    if(f.category!=="All") list = list.filter(l=>l.category===f.category);
    if(f.difficulty!=="All") list = list.filter(l=>l.difficulty===f.difficulty);
    if(f.query.trim()){
      const q = f.query.trim().toLowerCase();
      list = list.filter(l=> l.title.toLowerCase().includes(q) || (l.objective||"").toLowerCase().includes(q));
    }
    return list;
  }

  function paint(){
    const list = applyFilter();
    const resultsEl = container.querySelector("#lessonResults");
    if(!list.length){
      resultsEl.innerHTML = `<div class="empty-state"><span class="glyph">🔎</span>No lessons match. Try another search or category.</div>`;
      return;
    }
    const dog = sk.getCurrentDog();
    const progress = dog ? (sk.DB.lessonProgress[dog.id]||{}) : {};
    resultsEl.innerHTML = `<div class="row-list">${list.map(l=>{
      const p = progress[l.lesson_id];
      const done = p && p.timesCompleted;
      return `<button class="row" data-id="${l.lesson_id}">
        <div class="row-tab" style="background:var(${sk.getCategoryVar(l.category)})"></div>
        <div class="row-body">
          <div class="row-title">${sk.esc(l.title)}</div>
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
    return `<div class="banner ${cls}"><span class="glyph">⚠️</span><div><strong>${sk.esc(g.name)}</strong><br>${sk.esc(g.action)}</div></div>`;
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

function openLessonDetail(lessonId){
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

  sk.setTopbar(l.title, l.category, `<button class="icon-btn" id="backBtn" aria-label="Back">←</button>`);

  const container = document.getElementById("screens");
  container.innerHTML = `<div class="screen active" id="detailScreen">
    <div class="badge" style="background:var(${sk.getCategoryVar(l.category)});color:#fff;">${sk.getCategoryIcon(l.category)} ${sk.esc(l.category)}</div>
    <span class="badge badge-outline" style="margin-left:6px;">${sk.esc(l.difficulty)}</span>
    <span class="badge badge-outline">${sk.esc(l.evidence_level||"")}</span>

    ${safetyGateBanners(l.safety_gate_ids)}

    <p style="margin-top:14px; font-size:15px;">${sk.esc(l.objective)}</p>
    <p style="color:var(--ink-soft); font-size:13.5px;"><strong>Why it matters:</strong> ${sk.esc(l.why_it_matters)}</p>

    <div class="stat-grid" style="grid-template-columns:repeat(2,1fr);">
      <div class="stat-box"><div class="num" style="font-size:16px;">${sk.esc(l.session_length_min)} min</div><div class="lbl">Session length</div></div>
      <div class="stat-box"><div class="num" style="font-size:16px;">${sk.esc(l.equipment||"None")}</div><div class="lbl">Equipment</div></div>
    </div>

    ${progress ? `<div class="card" style="background:var(--green-soft); border-color:#b9cca9;">
      <strong>Your progress</strong>
      <div style="font-size:13px; color:var(--forest-dark); margin-top:4px;">
        Trained ${progress.timesCompleted}× · last ${sk.daysAgo(progress.lastPracticed)===0?"today":sk.daysAgo(progress.lastPracticed)+"d ago"} · avg success ${Math.round(progress.avgSuccess*100)}%
      </div>
    </div>` : ""}

    ${prerequisites.length ? `
    <div class="section-label">Before this lesson</div>
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

    <div class="section-label">Setup</div>
    <p style="font-size:14.5px;">${sk.esc(l.setup)}</p>

    <div class="section-label">Steps</div>
    <div class="card">${steps.map((s,i)=>`<div class="step-item"><div class="step-num">${i+1}</div><div>${sk.esc(s)}</div></div>`).join("")}</div>

    <div class="section-label">Success criteria</div>
    <p style="font-size:14.5px;">${sk.esc(l.success_criteria)}</p>

    ${mistakes.length ? `<div class="section-label">Common mistakes</div>
    <div class="card">${mistakes.map(m=>`<div class="checklist-item"><span class="dot"></span>${sk.esc(m)}</div>`).join("")}</div>` : ""}

    <div class="section-label">If it's too hard</div>
    <p style="font-size:14px; color:var(--ink-soft);">${regression.join(" · ")}</p>
    <div class="section-label">Ready for more?</div>
    <p style="font-size:14px; color:var(--ink-soft);">${progression.join(" · ")}</p>

    ${l.professional_help_if ? `<div class="banner banner-amber"><span class="glyph">🩺</span><div><strong>Get professional help if:</strong><br>${sk.esc(l.professional_help_if)}</div></div>` : ""}

    ${related.length ? `<div class="section-label">Related lessons</div>
    <div>${related.map(id=>{
      const rl = sk.IDX.lessonsById.get(id);
      return rl ? `<span class="link-pill" data-id="${id}">${sk.esc(rl.title)}</span>` : "";
    }).join("")}</div>` : ""}

    ${sourcesLine(l.source_ids) ? `<p style="font-size:11.5px; color:var(--ink-soft); margin-top:18px;">Sources: ${sk.esc(sourcesLine(l.source_ids))}</p>` : ""}

    <div style="height:12px;"></div>
    <button class="btn btn-primary btn-block" id="startBtn">Start session</button>
  </div>`;

  document.getElementById("backBtn").addEventListener("click", ()=>sk.goScreen(sk.currentScreen));
  document.getElementById("startBtn").addEventListener("click", ()=>sk.startSession(lessonId));
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
  sk.setTopbar(l.title, "Training session", `<button class="icon-btn" id="endBtn" aria-label="End session">✕</button>`);
  const container = document.getElementById("screens");
  container.innerHTML = `<div class="screen active">
    <div class="card" style="text-align:center;">
      <div class="badge" style="background:var(${sk.getCategoryVar(l.category)});color:#fff;">${sk.getCategoryIcon(l.category)} ${sk.esc(l.category)}</div>
      <p style="font-size:14px; margin:12px 0 4px; color:var(--ink-soft);">Tap after each repetition</p>
      <div style="font-size:40px; font-weight:700; font-family:var(--font-display); margin:8px 0;" id="repCounter">0</div>
      <div style="font-size:13px; color:var(--ink-soft); margin-bottom:16px;" id="repBreakdown">0 successful</div>
      <div style="display:flex; gap:10px;">
        <button class="btn btn-primary btn-block" id="repSuccess">✓ Success</button>
        <button class="btn btn-ghost btn-block" id="repMiss">✗ No luck</button>
      </div>
    </div>

    <div class="section-label">Reminders</div>
    <div class="card">
      <div class="checklist-item"><span class="dot"></span>${sk.esc(l.success_criteria)}</div>
    </div>

    <button class="btn btn-secondary btn-block" id="finishBtn" style="margin-top:8px;">Finish session</button>
  </div>`;

  function paint(){
    const succ = session.reps.filter(r=>r).length;
    container.querySelector("#repCounter").textContent = session.reps.length;
    container.querySelector("#repBreakdown").textContent = succ+" successful";
  }
  container.querySelector("#repSuccess").addEventListener("click", ()=>{ session.reps.push(true); paint(); });
  container.querySelector("#repMiss").addEventListener("click", ()=>{ session.reps.push(false); paint(); });
  container.querySelector("#finishBtn").addEventListener("click", renderFeedbackStep);
  document.getElementById("endBtn").addEventListener("click", ()=>{
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
  sk.DB.lessonProgress[dog.id][l.lesson_id] = { timesCompleted, avgSuccess, lastPracticed: rec.date };
  const {verdict, verdictText, cls} = computeVerdict(l, dog, rate, feedback);
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
    <div class="section-label">How did ${sk.getCurrentDog().name} find it?</div>
    <div class="chip-group" id="feedbackChips">
      ${sk.ADAPTIVE_FEEDBACK.map(f=>`<button type="button" class="chip" data-val="${f}">${f}</button>`).join("")}
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
window.__sk.recordLessonAttempt = recordLessonAttempt;
window.__sk.computeVerdict = computeVerdict;
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
  container.innerHTML = `<div class="row-list">${list.map(b=>`
    <button class="row" data-id="${b.behaviour_id}">
      <div class="row-tab" style="background:var(--sky)"></div>
      <div class="row-body">
        <div class="row-title">${sk.esc(b.name)}</div>
        <div class="row-meta">${sk.esc(b.category)}${b.safety_gate_ids?' · <span style="color:var(--red)">⚠ safety note</span>':''}</div>
      </div>
      <span class="row-chev">›</span>
    </button>`).join("")}</div>`;
  container.querySelectorAll(".row[data-id]").forEach(r=>r.addEventListener("click", ()=>openBehaviourDetail(r.dataset.id)));
}

function openBehaviourDetail(id){
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

  const container = document.getElementById("screens");
  container.innerHTML = `<div class="screen active">
    ${gateIds.map(gid=>{
      const g = sk.IDX.safetyGatesById.get(gid); if(!g) return "";
      const cls = sk.severityClass(g.severity);
      return `<div class="banner ${cls}"><span class="glyph">⚠️</span><div><strong>${sk.esc(g.name)}</strong><br>${sk.esc(g.action)}</div></div>`;
    }).join("")}

    <div class="section-label">Possible functions</div>
    <p style="font-size:14.5px;">${sk.esc(b.possible_functions)}</p>

    <div class="section-label">Management (do this now)</div>
    <p style="font-size:14.5px;">${sk.esc(b.management)}</p>

    ${decisionTreeLesson ? `
    <div class="section-label">Start with this assessment</div>
    <button class="row" data-id="${decisionTreeLesson.lesson_id}" style="background:var(--canvas-raised); border:1px solid var(--line); border-radius:var(--radius-m); margin-bottom:4px;">
      <div class="row-tab" style="background:var(--ochre)"></div>
      <div class="row-body"><div class="row-title">${sk.esc(decisionTreeLesson.title)}</div><div class="row-meta">Figure out the right path before diving into lessons</div></div>
      <span class="row-chev">›</span>
    </button>` : ""}

    <div class="section-label">Suggested training route</div>
    <p style="font-size:13px; color:var(--ink-soft);">${sk.esc(b.training_route)}</p>
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
  const bySub = {};
  sk.KB.collections.skills.forEach(s=>{
    (bySub[s.subcategory] = bySub[s.subcategory]||[]).push(s);
  });
  container.innerHTML = Object.keys(bySub).map(sub=>`
    <div class="section-label">${sk.esc(sub)}</div>
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
  container.querySelectorAll(".row[data-id]").forEach(r=>r.addEventListener("click", ()=>openSkillDetail(r.dataset.id)));
}

function openSkillDetail(skillId){
  const s = sk.IDX.skillsById.get(skillId);
  const dog = sk.getCurrentDog();
  const state = sk.dogSkillState(dog.id, skillId);
  const linked = findMatchingLesson(s.skill_id);
  const html = `
    <h3>${sk.esc(s.skill_name)}</h3>
    <p style="color:var(--ink-soft); font-size:14px;">${sk.esc(s.definition)}</p>
    <div class="section-label">${sk.esc(dog.name)}'s current stage</div>
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

function renderMore(container){
  sk.setTopbar("More", "Programmes, safety & data", "");
  const dog = sk.getCurrentDog();
  const currentTheme = (sk.DB.settings && sk.DB.settings.theme) || "auto";
  container.innerHTML = `
    <div class="section-label">Dogs</div>
    <div class="row-list">
      ${sk.DB.dogs.map(d=>`
        <button class="row" data-dog="${d.id}">
          ${sk.dogAvatarHTML(d)}
          <div class="row-body"><div class="row-title">${sk.esc(d.name)}</div><div class="row-meta">${sk.esc(d.breed||d.ageStage)}</div></div>
          <span class="row-chev">›</span>
        </button>`).join("")}
      <button class="row" id="addDogRow"><div class="avatar" style="background:var(--line); color:var(--ink-soft);">+</div><div class="row-body"><div class="row-title">Add another dog</div></div></button>
    </div>

    <div class="section-label">Daily programmes</div>
    <div class="row-list">
      ${sk.KB.collections.daily_programmes.map(p=>`
        <button class="row" data-programme="${p.programme_id}">
          <div class="row-tab" style="background:var(--ochre)"></div>
          <div class="row-body"><div class="row-title">${sk.esc(p.name)}</div><div class="row-meta">${p.duration_min} min · ${sk.esc(p.route)}</div></div>
          <span class="row-chev">›</span>
        </button>`).join("")}
    </div>

    <div class="section-label">Reference</div>
    <div class="row-list">
      <button class="row" id="safetyRow"><div class="row-tab" style="background:var(--red)"></div><div class="row-body"><div class="row-title">Safety gates</div><div class="row-meta">${sk.KB.collections.safety_gates.length} situations that need extra care</div></div><span class="row-chev">›</span></button>
      <button class="row" id="mythsRow"><div class="row-tab" style="background:var(--sky)"></div><div class="row-body"><div class="row-title">Myths & realities</div><div class="row-meta">${sk.KB.collections.myths.length} common misconceptions</div></div><span class="row-chev">›</span></button>
      <button class="row" id="guidanceRow"><div class="row-tab" style="background:var(--forest)"></div><div class="row-body"><div class="row-title">Owner guidance</div><div class="row-meta">General principles for training well</div></div><span class="row-chev">›</span></button>
      <button class="row" id="evidenceRow"><div class="row-tab" style="background:var(--ochre)"></div><div class="row-body"><div class="row-title">Evidence library</div><div class="row-meta">${sk.KB.collections.evidence_cards.length} topics, what the evidence does and doesn't say</div></div><span class="row-chev">›</span></button>
      <button class="row" id="rulesRow"><div class="row-tab" style="background:var(--sky)"></div><div class="row-body"><div class="row-title">How progression works</div><div class="row-meta">The rules behind session recommendations</div></div><span class="row-chev">›</span></button>
    </div>

    <div class="section-label">Appearance</div>
    <div class="card">
      <div class="chip-group" id="themeChips" style="margin-bottom:0;">
        ${[["light","☀️ Light"],["auto","🌓 Auto"],["dark","🌙 Dark"]].map(([val,label])=>
          `<button type="button" class="chip${currentTheme===val?' selected':''}" data-val="${val}">${label}</button>`
        ).join("")}
      </div>
      <p style="font-size:11.5px; color:var(--ink-soft); margin:8px 0 0;">Auto follows your device's setting.</p>
    </div>

    <div class="section-label">Data</div>
    <div class="card">
      <p style="font-size:13px; color:var(--ink-soft); margin-bottom:10px;">${storageEstimateText()} · stored only on this device.</p>
      <button class="btn btn-secondary btn-block" id="exportBtn">Export backup (.json)</button>
      <button class="btn btn-ghost btn-block" id="importBtn" style="margin-top:8px;">Import backup</button>
      <input type="file" id="importFile" accept="application/json" style="display:none;">
      <button class="btn btn-danger btn-block" id="resetBtn" style="margin-top:8px;">Reset all data</button>
    </div>
  `;

  container.querySelectorAll("[data-dog]").forEach(r=>r.addEventListener("click", ()=>{
    const d = sk.DB.dogs.find(x=>x.id===r.dataset.dog);
    sk.renderDogForm(d);
  }));
  container.querySelector("#addDogRow").addEventListener("click", ()=>sk.renderDogForm(null));
  container.querySelectorAll("[data-programme]").forEach(r=>r.addEventListener("click", ()=>openProgrammeDetail(r.dataset.programme)));
  container.querySelector("#safetyRow").addEventListener("click", openSafetyReference);
  container.querySelector("#mythsRow").addEventListener("click", openMythsReference);
  container.querySelector("#guidanceRow").addEventListener("click", openGuidanceReference);
  container.querySelector("#evidenceRow").addEventListener("click", openEvidenceReference);
  container.querySelector("#rulesRow").addEventListener("click", openRulesReference);
  container.querySelector("#themeChips").addEventListener("click", e=>{
    const b = e.target.closest(".chip"); if(!b) return;
    container.querySelectorAll("#themeChips .chip").forEach(c=>c.classList.remove("selected"));
    b.classList.add("selected");
    sk.setTheme(b.dataset.val);
  });
  container.querySelector("#exportBtn").addEventListener("click", exportBackup);
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
      <div class="section-label">${isDynamic?"Chosen for "+sk.esc(dog.name)+" today":"Lessons in this programme"}</div>
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
  const p = sk.IDX.programmesById.get(prog.programmeId);
  const l = prog.lessons[prog.index];
  const reps = [];
  sk.setTopbar(p.name, "Block "+(prog.index+1)+" of "+prog.lessons.length, `<button class="icon-btn" id="endProgBtn" aria-label="End programme">✕</button>`);
  const container = document.getElementById("screens");
  container.innerHTML = `<div class="screen active">
    <div class="progress-track" style="margin-bottom:16px;"><div class="progress-fill" style="width:${(prog.index/prog.lessons.length*100).toFixed(0)}%"></div></div>
    <div class="card" style="text-align:center;">
      <div class="badge" style="background:var(${sk.getCategoryVar(l.category)});color:#fff;">${sk.getCategoryIcon(l.category)} ${sk.esc(l.category)}</div>
      <h3 style="margin-top:10px;">${sk.esc(l.title)}</h3>
      <p style="font-size:13px; color:var(--ink-soft);">${sk.esc(l.objective)}</p>
      <div style="font-size:40px; font-weight:700; font-family:var(--font-display); margin:12px 0 4px;" id="repCounter">0</div>
      <div style="font-size:13px; color:var(--ink-soft); margin-bottom:16px;" id="repBreakdown">0 successful</div>
      <div style="display:flex; gap:10px;">
        <button class="btn btn-primary btn-block" id="repSuccess">✓ Success</button>
        <button class="btn btn-ghost btn-block" id="repMiss">✗ No luck</button>
      </div>
    </div>
    <button class="btn btn-secondary btn-block" id="nextBlockBtn" style="margin-top:8px;">
      ${prog.index === prog.lessons.length-1 ? "Finish programme" : "Next block"}
    </button>
  </div>`;
  function paint(){
    const succ = reps.filter(r=>r).length;
    container.querySelector("#repCounter").textContent = reps.length;
    container.querySelector("#repBreakdown").textContent = succ+" successful";
  }
  container.querySelector("#repSuccess").addEventListener("click", ()=>{ reps.push(true); paint(); });
  container.querySelector("#repMiss").addEventListener("click", ()=>{ reps.push(false); paint(); });
  container.querySelector("#nextBlockBtn").addEventListener("click", ()=>{
    prog.blockResults.push({ lessonId: l.lesson_id, reps: reps.slice() });
    if(prog.index === prog.lessons.length-1){
      renderProgrammeFeedback();
    }else{
      prog.index++;
      renderProgrammeBlock();
    }
  });
  document.getElementById("endProgBtn").addEventListener("click", ()=>{
    sk.setActiveProgramme(null);
    sk.goScreen("more");
  });
}

function renderProgrammeFeedback(){
  const prog = sk.activeProgramme;
  const p = sk.IDX.programmesById.get(prog.programmeId);
  const totalReps = prog.blockResults.reduce((n,b)=>n+b.reps.length,0);
  const totalSucc = prog.blockResults.reduce((n,b)=>n+b.reps.filter(r=>r).length,0);

  sk.setTopbar(p.name, "How did the session go overall?", "");
  const container = document.getElementById("screens");
  container.innerHTML = `<div class="screen active">
    <div class="card" style="text-align:center;">
      <div style="font-size:28px; font-family:var(--font-display); font-weight:700;">${totalSucc}/${totalReps||0}</div>
      <div style="color:var(--ink-soft); font-size:13.5px;">successful repetitions across ${prog.blockResults.length} blocks</div>
    </div>
    <p style="font-size:12.5px; color:var(--ink-soft);">One rating applies to every block — each lesson still keeps its own individual progress the next time you train it on its own.</p>
    <div class="chip-group" id="feedbackChips">
      ${sk.ADAPTIVE_FEEDBACK.map(f=>`<button type="button" class="chip" data-val="${f}">${f}</button>`).join("")}
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
  const p = sk.IDX.programmesById.get(prog.programmeId);
  const dog = sk.getCurrentDog();
  const results = prog.blockResults.map(b=>{
    const l = sk.IDX.lessonsById.get(b.lessonId);
    return { l, result: sk.recordLessonAttempt(dog, l, b.reps, feedback, prog.programmeId) };
  });
  sk.saveDB();
  sk.setActiveProgramme(null);

  sk.setTopbar("Programme complete", "", "");
  const container = document.getElementById("screens");
  container.innerHTML = `<div class="screen active" style="text-align:center; padding-top:24px;">
    <div style="font-size:44px;">🎉</div>
    <h2>${sk.esc(p.name)} done!</h2>
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

function openSafetyReference(){
  const gates = sk.KB.collections.safety_gates;
  sk.openModal(`
    <h3>Safety gates</h3>
    <div class="row-list">${gates.map(g=>{
      const cls = sk.severityClass(g.severity);
      return `<div class="banner ${cls}" style="margin-bottom:8px;"><span class="glyph">⚠️</span><div><strong>${sk.esc(g.name)}</strong><br><span style="font-size:12.5px;">${sk.esc(g.action)}</span></div></div>`;
    }).join("")}</div>
  `);
}
function openMythsReference(){
  const myths = sk.KB.collections.myths;
  sk.openModal(`
    <h3>Myths & realities</h3>
    ${myths.map(m=>{
      const srcs = sk.sourcesLine(m.source_ids);
      return `<div class="card"><strong>${sk.esc(m.myth)}</strong><p style="margin-top:6px; margin-bottom:0; font-size:13.5px; color:var(--ink-soft);">${sk.esc(m.reality)}</p>${srcs?`<p style="margin:8px 0 0; font-size:11px; color:var(--ink-soft);">Sources: ${sk.esc(srcs)}</p>`:""}</div>`;
    }).join("")}
  `);
}
function openGuidanceReference(){
  const items = sk.KB.collections.owner_guidance;
  sk.openModal(`
    <h3>Owner guidance</h3>
    ${items.map(g=>{
      const srcs = sk.sourcesLine(g.source_ids);
      return `<div class="card"><strong>${sk.esc(g.topic)}</strong><p style="margin-top:6px; margin-bottom:0; font-size:13.5px; color:var(--ink-soft);">${sk.esc(g.guidance)}</p>${srcs?`<p style="margin:8px 0 0; font-size:11px; color:var(--ink-soft);">Sources: ${sk.esc(srcs)}</p>`:""}</div>`;
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
        ${srcs ? `<p style="margin:8px 0 0; font-size:11px; color:var(--ink-soft);">Sources: ${sk.esc(srcs)}</p>` : ""}
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
const APP_VERSION = "1.2.0";

function pawLogoSVG(size){
  return `<svg viewBox="0 0 100 100" width="${size}" height="${size}" aria-hidden="true">
    <circle cx="50" cy="50" r="50" fill="var(--forest)"/>
    <circle cx="50" cy="60" r="19" fill="var(--canvas)"/>
    <circle cx="27" cy="38" r="9.5" fill="var(--canvas)"/>
    <circle cx="41" cy="24" r="10" fill="var(--canvas)"/>
    <circle cx="59" cy="24" r="10" fill="var(--canvas)"/>
    <circle cx="73" cy="38" r="9.5" fill="var(--canvas)"/>
  </svg>`;
}

function renderAbout(container){
  const kb = sk.KB;
  const reviewStatus = kb.collections.lessons[0] && kb.collections.lessons[0].review_status;
  container.innerHTML = `
    <div class="about-hero" style="text-align:center; margin-bottom:18px;">
      ${pawLogoSVG(72)}
      <h2 style="margin:12px 0 2px;">Sidekick</h2>
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

    ${kb.copyright_note ? `<div class="section-label">A note on content</div>
    <p style="font-size:13px; color:var(--ink-soft);">${sk.esc(kb.copyright_note)}</p>` : ""}

    ${kb.progression_note ? `<div class="section-label">A note on progression</div>
    <p style="font-size:13px; color:var(--ink-soft);">${sk.esc(kb.progression_note)}</p>` : ""}

    <div class="section-label">More from Duffers</div>
    <div class="card">
      <h3 style="margin-bottom:4px;">🐾 Also logging your travels?</h3>
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

    <div class="section-label">Add to Home Screen</div>
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

    <div class="section-label">Data & privacy</div>
    <div class="card">
      <p style="font-size:13px; margin-bottom:0;">Everything you enter — dog profiles, sessions, skill progress — stays on this device in your browser's local storage. Nothing is sent anywhere. Back up or move devices anytime from More → Data → Export backup.</p>
    </div>

    <div class="section-label">Author</div>
    <div class="card">
      <p style="font-size:13px; margin-bottom:0;">Created by <strong>Duffers</strong> — built for training with care, not for training data.</p>
    </div>

    <p style="text-align:center; font-size:11.5px; color:var(--ink-soft); margin-top:8px;">Sidekick v${APP_VERSION} · by Duffers</p>
  `;
}

sk.SCREEN_RENDERERS.about = renderAbout;

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
})();
