async function loadData(){
  // 优先从同目录 memories.json 读取（线上/HTTP 环境）
  try{
    const res = await fetch("./memories.json?v=" + Date.now());
    if(res.ok) return await res.json();
  }catch(e){
    // 本地 file:// 直接打开时，浏览器可能会拦截 fetch
  }

  // 兜底：从 index.html 内嵌的 JSON 读取（保证本地也能显示时间/内容）
  const el = document.getElementById("embeddedData");
  if(el && el.textContent){
    try{ return JSON.parse(el.textContent); }catch(e){}
  }

  // 最后兜底：最小默认数据（避免页面空白）
  return {
    couple:{
      title:"guoguoandmiemie",
      names:"果果（张津硕） & 咩咩（陈鑫旸）",
      startDateChina:"2026-01-04 09:44:00",
      startInstantUTC:"2026-01-04T01:44:00Z",
      subtitle:"我想把我们每一个小瞬间，都认真收藏。等你哪天累了，就来这里充电。"
    },
    memories:[],
    bucketList:[]
  };
}


function escapeHtml(s){
  return (s ?? "").replace(/[&<>"']/g, (c)=>({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
  }[c]));
}

function pad2(n){ return String(n).padStart(2,"0"); }

function formatInTimeZone(date, timeZone){
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year:"numeric", month:"2-digit", day:"2-digit",
    hour:"2-digit", minute:"2-digit", second:"2-digit",
    hour12:false
  }).formatToParts(date);

  const get = (t)=> parts.find(p=>p.type===t)?.value || "";
  // en-CA gives YYYY-MM-DD, but we construct ourselves for stability
  return `${get("year")}-${get("month")}-${get("day")} ${get("hour")}:${get("minute")}:${get("second")}`;
}

function calcTogether(now, startInstantUTC){
  const start = new Date(startInstantUTC);
  const diffMs = now.getTime() - start.getTime();
  const safe = Math.max(0, diffMs);

  const totalSeconds = Math.floor(safe / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const rem1 = totalSeconds - days*86400;
  const hours = Math.floor(rem1 / 3600);
  const rem2 = rem1 - hours*3600;
  const minutes = Math.floor(rem2 / 60);
  const seconds = rem2 - minutes*60;

  const dayCount = days + 1; // 第1天从起点那一刻开始算
  return { dayCount, days, hours, minutes, seconds };
}

function applyBackground(bg){
  if(!bg){
    document.documentElement.style.setProperty("--bg-image", "none");
    return;
  }
  // bg can be dataURL or URL
  document.documentElement.style.setProperty("--bg-image", `url("${bg}")`);
}


function chinaDateKey(now){
  // 以北京时间的“今天”为准
  const s = formatInTimeZone(now, "Asia/Shanghai"); // YYYY-MM-DD HH:MM:SS
  return s.slice(0,10);
}

function setupDailyMemory(data, couple){
  const modal = document.getElementById("dailyModal");
  const openBtn = document.getElementById("openDaily");
  const closeBtn = document.getElementById("closeDaily");
  const anotherBtn = document.getElementById("anotherDaily");

  const hint = document.getElementById("dailyHint");
  const dDate = document.getElementById("dailyDate");
  const dTitle = document.getElementById("dailyTitle");
  const dText = document.getElementById("dailyText");
  const dTags = document.getElementById("dailyTags");

  const memories = (data.memories || []).filter(m => (m.title && m.text));
  if(memories.length === 0){
    if(openBtn) openBtn.style.display = "none";
    return;
  }

  const now = new Date();
  const day = chinaDateKey(now);
  const KEY_PICK = `guoguoandmiemie_daily_pick_${day}`;
  const KEY_SEEN = `guoguoandmiemie_daily_seen_${day}`;

  function pickRandomIndex(){
    return Math.floor(Math.random() * memories.length);
  }

  function getPick(){
    const saved = localStorage.getItem(KEY_PICK);
    if(saved !== null){
      const idx = Number(saved);
      if(Number.isFinite(idx) && idx >= 0 && idx < memories.length) return idx;
    }
    const idx = pickRandomIndex();
    localStorage.setItem(KEY_PICK, String(idx));
    return idx;
  }

  function renderPick(idx){
    const m = memories[idx];
    if(hint) hint.textContent = `今日（按北京时间 ${day}）随机抽到的一条回忆。`;
    if(dDate) dDate.textContent = m.date || "—";
    if(dTitle) dTitle.textContent = m.title || "—";
    if(dText) dText.textContent = m.text || "—";
    if(dTags) dTags.innerHTML = (m.tags||[]).map(t=>`<span class="tag">${escapeHtml(t)}</span>`).join("");
  }

  function open(){
    if(!modal) return;
    modal.classList.add("open");
  }
  function close(){
    if(!modal) return;
    modal.classList.remove("open");
    localStorage.setItem(KEY_SEEN, "1");
  }

  const current = getPick();
  renderPick(current);

  // open once per day automatically (if not seen)
  if(!localStorage.getItem(KEY_SEEN)){
    open();
  }

  openBtn?.addEventListener("click", open);
  closeBtn?.addEventListener("click", close);
  modal?.addEventListener("click", (e)=>{ if(e.target === modal) close(); });

  anotherBtn?.addEventListener("click", ()=>{
    const idx = pickRandomIndex();
    localStorage.setItem(KEY_PICK, String(idx)); // 允许“换一条”，会覆盖今日抽取
    localStorage.removeItem(KEY_SEEN); // 仍在弹窗里，不算关闭
    renderPick(idx);
  });
}

function setupBackgroundUI(){
  const KEY = "guoguoandmiemie_bg";
  const saved = localStorage.getItem(KEY);
  if(saved) applyBackground(saved);

  const modal = document.getElementById("bgModal");
  const openBtn = document.getElementById("openBg");
  const closeBtn = document.getElementById("closeBg");
  const file = document.getElementById("bgFile");
  const urlInput = document.getElementById("bgUrl");
  const saveUrlBtn = document.getElementById("saveBgUrl");
  const resetBtn = document.getElementById("resetBg");

  const open = ()=> modal.classList.add("open");
  const close = ()=> modal.classList.remove("open");

  openBtn?.addEventListener("click", open);
  closeBtn?.addEventListener("click", close);
  modal?.addEventListener("click", (e)=>{ if(e.target === modal) close(); });

  file?.addEventListener("change", ()=>{
    const f = file.files?.[0];
    if(!f) return;
    const reader = new FileReader();
    reader.onload = ()=>{
      const dataUrl = String(reader.result || "");
      localStorage.setItem(KEY, dataUrl);
      applyBackground(dataUrl);
    };
    reader.readAsDataURL(f);
  });

  saveUrlBtn?.addEventListener("click", ()=>{
    const url = (urlInput?.value || "").trim();
    if(!url) return;
    localStorage.setItem(KEY, url);
    applyBackground(url);
  });

  resetBtn?.addEventListener("click", ()=>{
    localStorage.removeItem(KEY);
    applyBackground(null);
    if(urlInput) urlInput.value = "";
    if(file) file.value = "";
  });

  // presets (pure gradients, no external dependencies)
  document.querySelectorAll("[data-bg]").forEach(el=>{
    el.addEventListener("click", ()=>{
      const v = el.getAttribute("data-bg");
      if(!v) return;
      localStorage.setItem(KEY, v);
      applyBackground(v);
    });
  });
}

function renderStaticSections(data){
  const { couple, memories, bucketList } = data;

  document.title = couple.title || "Our Memories";
  document.getElementById("names").textContent = couple.names || "Us";
  document.getElementById("subtitle").textContent = couple.subtitle || "";

  // Timeline
  const wrap = document.getElementById("timeline");
  wrap.innerHTML = "";
  const sorted = [...(memories||[])].sort((a,b)=> (b.date||"").localeCompare(a.date||""));
  for(const m of sorted){
    const tags = (m.tags||[]).map(t=>`<span class="tag">${escapeHtml(t)}</span>`).join("");
    wrap.innerHTML += `
      <div class="item">
        <div class="meta">
          <div class="date">${escapeHtml(m.date || "—")}</div>
        </div>
        <h3>${escapeHtml(m.title || "")}</h3>
        <p>${escapeHtml(m.text || "")}</p>
        <div class="tags">${tags}</div>
      </div>
    `;
  }

  // Bucket list
  const list = document.getElementById("bucket");
  list.innerHTML = "";
  (bucketList||[]).forEach((b)=>{
    list.innerHTML += `
      <label class="todo">
        <input type="checkbox" ${b.done ? "checked":""} disabled />
        <div>
          <div>${escapeHtml(b.text)}</div>
          <div class="small">（以后想升级：这里可以做成可点选并保存）</div>
        </div>
      </label>
    `;
  });

  // show start time note
  const startNote = document.getElementById("startNote");
  if(startNote){
    startNote.textContent = `起点（按中国时间）：${couple.startDateChina}  ·  统一换算UTC：${couple.startInstantUTC}`;
  }

  document.getElementById("year").textContent = new Date().getFullYear();

  return couple;
}

function startClocks(couple){
  const chinaEl = document.getElementById("chinaTime");
  const ukEl = document.getElementById("ukTime");
  const togetherEl = document.getElementById("togetherTime");
  const dayCountEl = document.getElementById("dayCount");
  const dayInline = document.getElementById("dayCountInline");

  const tick = ()=>{
    const now = new Date();
    if(chinaEl) chinaEl.textContent = formatInTimeZone(now, "Asia/Shanghai");
    if(ukEl) ukEl.textContent = formatInTimeZone(now, "Europe/London");

    const t = calcTogether(now, couple.startInstantUTC);
    const hh = pad2(t.hours), mm = pad2(t.minutes), ss = pad2(t.seconds);
    if(togetherEl) togetherEl.textContent = `${t.days}天 ${hh}:${mm}:${ss}`;
    if(dayCountEl) dayCountEl.textContent = t.dayCount;
    if(dayInline) dayInline.textContent = t.dayCount;
  };

  tick();
  setInterval(tick, 1000);
}

loadData().then((data)=>{
  const couple = renderStaticSections(data);
  setupBackgroundUI();
  setupDailyMemory(data, couple);
  startClocks(couple);
});
