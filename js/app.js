(() => {
  const CURATED = window.HAN_DATA;
  const DATA = CURATED.concat(window.HAN_EXTRA || []);
  const STAGES = window.HAN_STAGES;
  const VOLUMES = window.HAN_VOLUMES;
  const MASK = window.HAN_MASK || {};
  const ANCIENT_BIT = { oracle: 1, bronze: 2, seal: 4 };
  const INITIALS = ["a", "o", "e", "b", "p", "m", "f", "d", "t", "n", "l", "g", "k", "h", "j", "q", "x", "zh", "ch", "sh", "r", "z", "c", "s", "y", "w"];
  const ACCENTS = { oracle: "#e8a54b", bronze: "#2fc6a8", seal: "#e0553a", clerical: "#8a96ff", regular: "#e2bd72", running: "#c77dff", modern: "#4cc8f0" };
  const byChar = Object.fromEntries(DATA.map((d) => [d.c, d]));

  const rankOf = {};
  [...(window.HAN_RANK || "")].forEach((c, i) => { rankOf[c] = i; });
  const rank = (d) => rankOf[d.c] ?? 1e9;
  VOLUMES.forEach((v) => {
    if (v.id === "qimeng") v.list = CURATED.slice();
    else v.list = (v.size ? DATA.filter((d) => rank(d) < v.size) : DATA.slice()).sort((a, b) => rank(a) - rank(b));
    v.set = new Set(v.list.map((d) => d.c));
  });
  const volById = Object.fromEntries(VOLUMES.map((v) => [v.id, v]));
  const ALL = volById.shuowen.list;

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const shell = $("#shell"), view = $("#view"), detail = $("#detail");
  const ICON = {
    back: '<svg viewBox="0 0 24 24"><path d="M15 5l-7 7 7 7"/></svg>',
    heart: '<svg viewBox="0 0 24 24"><path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/></svg>',
    prev: '<svg viewBox="0 0 24 24"><path d="M15 5l-7 7 7 7"/></svg>',
    next: '<svg viewBox="0 0 24 24"><path d="M9 5l7 7-7 7"/></svg>',
    play: '<svg viewBox="0 0 24 24"><path d="M8 5.5v13l11-6.5z"/></svg>',
    pause: '<svg viewBox="0 0 24 24"><path d="M7 5h4v14H7zM13 5h4v14h-4z"/></svg>',
    dice: '<svg viewBox="0 0 24 24"><rect x="4" y="4" width="16" height="16" rx="4"/><path d="M9 9h.01M15 15h.01M15 9h.01M9 15h.01"/></svg>',
    search: '<svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/></svg>',
    expand: '<svg viewBox="0 0 24 24"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/></svg>',
    collapse: '<svg viewBox="0 0 24 24"><path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5"/></svg>',
    speaker: '<svg viewBox="0 0 24 24"><path d="M4 9.5v5h3.5L12 18V6L7.5 9.5H4z"/><path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11"/></svg>',
  };

  // ---------- 全屏 ----------
  // iPhone Safari 不支持网页全屏，那里不显示按钮
  const root = document.documentElement;
  const fsSupported = !!(document.fullscreenEnabled || document.webkitFullscreenEnabled);
  const fsActive = () => !!(document.fullscreenElement || document.webkitFullscreenElement);
  function fsBtn() {
    if (!fsSupported) return "";
    const on = fsActive();
    return `<button class="icon-btn fs-btn" aria-label="${on ? "退出全屏" : "全屏"}" title="${on ? "退出全屏" : "全屏"}">${on ? ICON.collapse : ICON.expand}</button>`;
  }
  function toggleFullscreen() {
    if (fsActive()) (document.exitFullscreen || document.webkitExitFullscreen).call(document);
    else (root.requestFullscreen || root.webkitRequestFullscreen).call(root);
  }
  document.addEventListener("click", (e) => { if (e.target.closest(".fs-btn")) toggleFullscreen(); });
  ["fullscreenchange", "webkitfullscreenchange"].forEach((ev) => document.addEventListener(ev, () => {
    $$(".fs-btn").forEach((b) => b.outerHTML = fsBtn());
  }));

  // 楷书 / 行书字体按精选字做子集加载；其余字回退到系统楷体或思源宋
  const usedChars = [...new Set(CURATED.flatMap((d) => [d.c, d.t || ""]))].join("");
  const fontLink = document.createElement("link");
  fontLink.rel = "stylesheet";
  fontLink.href = `https://fonts.googleapis.com/css2?family=LXGW+WenKai+TC&family=Zhi+Mang+Xing&display=swap&text=${encodeURIComponent(usedChars)}`;
  document.head.appendChild(fontLink);

  // ---------- 收藏 ----------
  const favs = {
    list() { try { return JSON.parse(localStorage.getItem("han.fav") || "[]"); } catch { return []; } },
    has(c) { return this.list().includes(c); },
    toggle(c) {
      const l = this.list(), i = l.indexOf(c);
      i < 0 ? l.push(c) : l.splice(i, 1);
      localStorage.setItem("han.fav", JSON.stringify(l));
      return i < 0;
    },
  };

  // ---------- 学习记录 ----------
  // 每字：lv 熟悉度（0 未标，1–4 见 LEVELS）、v 查看次数、t 最近查看时间、r / w 答对 / 答错次数
  const LEVELS = [
    { lv: 1, name: "生疏", color: "#e0553a" },
    { lv: 2, name: "初识", color: "#e2a54b" },
    { lv: 3, name: "熟悉", color: "#4ec896" },
    { lv: 4, name: "精通", color: "#4cc8f0" },
  ];
  const levelOf = (lv) => LEVELS.find((l) => l.lv === lv);
  const study = (() => {
    let data;
    try { data = JSON.parse(localStorage.getItem("han.study") || "{}"); } catch { data = {}; }
    return {
      get: (c) => data[c] || {},
      level: (c) => (data[c] && data[c].lv) || 0,
      update(c, fn) {
        const s = data[c] || (data[c] = {});
        fn(s);
        localStorage.setItem("han.study", JSON.stringify(data));
        return s;
      },
    };
  })();

  // 答错降一级；答对升一级，最多自动升到「熟悉」，「精通」只由自己标
  function recordAnswer(c, ok) {
    const before = study.level(c);
    const after = ok ? (before === 0 ? 2 : before >= 3 ? before : before + 1) : before === 0 ? 1 : Math.max(1, before - 1);
    study.update(c, (s) => {
      s.lv = after;
      if (ok) s.r = (s.r || 0) + 1;
      else s.w = (s.w || 0) + 1;
    });
    return { before, after };
  }

  // ---------- 字形 ----------
  // 某个古文字阶段字体里没有，就不进入时间轴
  function stagesOf(d) {
    const m = MASK[d.c] || 0;
    return STAGES.filter((s) => s.kind === "font" || (m & ANCIENT_BIT[s.id]));
  }

  function glyph(d, stageId) {
    const ancient = stageId in ANCIENT_BIT || stageId === "modern";
    return `<span class="glyph-font f-${stageId}">${ancient ? d.c : d.t || d.c}</span>`;
  }

  function plainPy(py) {
    return py.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  }

  function initialOf(py) {
    const s = plainPy(py);
    const two = s.slice(0, 2);
    return ["zh", "ch", "sh"].includes(two) ? two : s[0] || "";
  }

  function volumeOf(d) {
    return VOLUMES.find((v) => v.set.has(d.c));
  }

  // ---------- 拼音 / 同音字 ----------
  // 音节键去掉声调、ü 记作 v；声调 1–4，轻声 5
  const TONE_MARK = { "\u0304": 1, "\u0301": 2, "\u030c": 3, "\u0300": 4 };
  function sylOf(py) {
    return py.toLowerCase().normalize("NFD").replace(/u\u0308/g, "v").replace(/[\u0300-\u036f]/g, "");
  }
  function toneOf(py) {
    const m = py.normalize("NFD").match(/[\u0304\u0301\u030c\u0300]/);
    return m ? TONE_MARK[m[0]] : 5;
  }
  const showSyl = (s) => s.replace(/v/g, "ü");
  const bySyl = {};
  ALL.forEach((d) => { (bySyl[sylOf(d.py)] ||= []).push(d); });
  const SYLLABLES = Object.keys(bySyl).sort();

  // ---------- 发音 ----------
  // 用系统自带的中文语音朗读；没有中文语音的设备由系统按 zh-CN 尽量处理
  const canSpeak = "speechSynthesis" in window && "SpeechSynthesisUtterance" in window;
  let zhVoice = null;
  function pickVoice() {
    const vs = speechSynthesis.getVoices();
    zhVoice = vs.find((v) => /zh[-_]CN/i.test(v.lang)) || vs.find((v) => /^zh/i.test(v.lang)) || null;
  }
  if (canSpeak) {
    pickVoice();
    speechSynthesis.addEventListener?.("voiceschanged", pickVoice);
  }
  function speak(text, btn) {
    if (!canSpeak || !text) return;
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "zh-CN";
    if (zhVoice) u.voice = zhVoice;
    u.rate = 0.75;
    if (btn) {
      btn.classList.add("speaking");
      u.onend = u.onerror = () => btn.classList.remove("speaking");
    }
    speechSynthesis.speak(u);
  }
  function speakBtn(text, extra = "") {
    return canSpeak ? `<button class="speak-btn ${extra}" data-say="${text}" aria-label="朗读" title="朗读">${ICON.speaker}</button>` : "";
  }
  document.addEventListener("click", (e) => {
    const b = e.target.closest(".speak-btn");
    if (b) { e.preventDefault(); e.stopPropagation(); speak(b.dataset.say, b); }
  });

  const LUNAR_DAY = "一二三四五六七八九十";
  function lunarDay(n) {
    if (n === 10) return "初十";
    if (n === 20) return "二十";
    if (n === 30) return "三十";
    return ["初", "十", "廿"][Math.floor(n / 10)] + LUNAR_DAY[(n % 10) - 1];
  }
  function lunarDate() {
    try {
      const parts = new Intl.DateTimeFormat("zh-CN-u-ca-chinese", { year: "numeric", month: "long", day: "numeric" }).formatToParts(new Date());
      const get = (t) => (parts.find((p) => p.type === t) || {}).value || "";
      const day = parseInt(get("day"), 10);
      return `${get("yearName")}年 ${get("month")}${Number.isNaN(day) ? get("day") : lunarDay(day)}`.trim();
    } catch {
      return "";
    }
  }

  // ---------- 路由 ----------
  let page = null, heroTimer = null, relayout = null, lastHash = "";
  function route() {
    const [, a = "", b = ""] = (location.hash.slice(1) || "/").split("/");
    const key = decodeURIComponent(b);
    if (a === "char" && byChar[key]) {
      if (!page) renderPage("home");
      openDetail(byChar[key]);
    } else if (a === "py" && bySyl[key]) {
      // 记下从哪来，「返回」时回到那里；同音字页之间切换不覆盖
      if (page !== "py") {
        pyState.from = lastHash || "#/";
        pyState.base = page || "home";
      }
      if (pyState.syl !== key) Object.assign(pyState, { syl: key, tone: 0, page: 0 });
      closeDetail();
      renderPage("py", true);
    } else {
      closeDetail();
      renderPage(["quiz", "fav"].includes(a) ? a : "home");
    }
    lastHash = location.hash;
  }

  function renderPage(name, force) {
    if (!force && page === name && name !== "fav") return;
    page = name;
    clearInterval(heroTimer);
    relayout = null;
    const tab = name === "py" ? "home" : name;
    $$(".tabbar a").forEach((t) => t.classList.toggle("active", t.dataset.tab === tab));
    ({ home: renderHome, quiz: () => quiz.start(), fav: renderFav, py: renderPy })[name]();
  }

  function pageHash() {
    if (page === "py") return `#/py/${pyState.syl}`;
    return `#/${page === "home" ? "" : page}`;
  }

  // ---------- 字格分页（铺满可视区域，不滚动） ----------
  function cardHTML(d, withStats) {
    const old = stagesOf(d).find((s) => s.kind === "img");
    const s = study.get(d.c), lv = levelOf(s.lv);
    const note = withStats ? (s.v ? `${s.v}次` : "未看") : d.m;
    return `<a class="card" href="#/char/${d.c}">
      ${old ? `<div class="card-ancient">${glyph(d, old.id)}</div>` : ""}
      ${favs.has(d.c) ? '<i class="card-fav">♥</i>' : ""}
      <div class="card-char">${d.c}</div>
      <div class="card-meta"><b>${d.py}</b>${note ? `<span>${note}</span>` : ""}</div>
      ${lv ? `<i class="card-lv" style="--lc:${lv.color}" title="${lv.name}"></i>` : ""}
    </a>`;
  }

  // 按字格容器的实际尺寸决定一页放几列几行
  function fillGrid(list, state, withStats) {
    const grid = $("#grid");
    if (!grid || grid.clientWidth < 10 || grid.clientHeight < 10) return;
    const h = grid.clientHeight;
    const cols = Math.max(3, Math.floor(grid.clientWidth / 82));
    const rows = Math.max(1, Math.floor(h / (h < 260 ? 74 : 98)));
    grid.style.setProperty("--cols", cols);
    grid.style.setProperty("--rows", rows);
    const per = cols * rows;
    const pages = Math.max(1, Math.ceil(list.length / per));
    state.page = Math.min(Math.max(state.page, 0), pages - 1);
    const slice = list.slice(state.page * per, state.page * per + per);
    grid.innerHTML = slice.length
      ? slice.map((d) => cardHTML(d, withStats)).join("")
      : `<div class="empty"><div class="big">无</div><p>${state.emptyText || "没有找到相关汉字"}</p></div>`;
    const label = $("#pgLabel"), prev = $("#pgPrev"), next = $("#pgNext");
    if (label) label.innerHTML = list.length ? `<b>${state.page + 1}</b> / ${pages} 页 · ${list.length} 字` : "0 字";
    if (prev) prev.disabled = state.page <= 0;
    if (next) next.disabled = state.page >= pages - 1;
  }

  function pagerHTML() {
    return `<div class="pager"><button class="icon-btn" id="pgPrev" aria-label="上一页">${ICON.prev}</button><span id="pgLabel"></span><button class="icon-btn" id="pgNext" aria-label="下一页">${ICON.next}</button></div>`;
  }

  window.addEventListener("resize", () => requestAnimationFrame(() => relayout && relayout()));

  // ---------- 首页 ----------
  const homeState = { mode: "dash", vol: "qimeng", init: "all", q: "", page: 0 };

  function todayChar() {
    return CURATED[Math.floor(Date.now() / 86400000) % CURATED.length];
  }

  function volumeBase() {
    return volById[homeState.vol].list;
  }

  function homeList() {
    const q = homeState.q.toLowerCase();
    return volumeBase().filter((d) =>
      (homeState.init === "all" || initialOf(d.py) === homeState.init) &&
      (!q || d.c === q || (d.t || "") === q || plainPy(d.py).startsWith(plainPy(q)) || (d.m || "").includes(q)));
  }

  function renderGrid() { fillGrid(homeList(), homeState); }

  function renderHome() {
    if (homeState.mode === "list") renderBrowse();
    else renderDash();
  }

  function openVolume(id, q = "") {
    Object.assign(homeState, { mode: "list", vol: id, init: "all", q, page: 0 });
    renderBrowse(!!q);
  }

  function renderDash() {
    const d = todayChar();
    const stages = stagesOf(d);
    view.innerHTML = `
      <div class="fit dash">
        <header class="top">
          <div class="brand"><span class="seal">字</span>字源</div>
          <label class="search">${ICON.search}<input id="q" placeholder="汉字或拼音" autocomplete="off"></label>
          <button class="icon-btn" id="randomBtn" title="随机一字">${ICON.dice}</button>
          ${fsBtn()}
        </header>
        <a class="hero" href="#/char/${d.c}" style="--accent:${ACCENTS[stages[0].id]}">
          <div class="hero-head"><span class="eyebrow">今日一字</span><span class="hero-date">${lunarDate()}</span></div>
          <div class="hero-main">
            <div class="hero-copy">
              <div class="hero-char">${d.c}</div>
              <div class="hero-py">${d.py}${d.m ? `<span> · ${d.m}</span>` : ""}</div>
              <p>${d.s}</p>
            </div>
            <div class="hero-glyph">
              <div class="halo"></div><div class="ring"></div>
              ${stages.map((s, i) => `<div class="layer${i === 0 ? " active" : ""}">${glyph(d, s.id)}</div>`).join("")}
            </div>
          </div>
          <div class="hero-strip" style="--n:${stages.length}">
            ${stages.map((s, i) => `<span class="hs${i === 0 ? " on" : ""}"><i>${glyph(d, s.id)}</i><small>${s.name}</small></span>`).join("")}
          </div>
        </a>
        <section class="vols">
          <div class="sec-head"><h3>六卷</h3><span>由浅入深，后卷含前卷</span></div>
          <div class="vol-grid">
            ${VOLUMES.map((v) => `
              <button class="vol" data-v="${v.id}" style="--c:${v.color}">
                <span class="vol-mark">${glyph({ c: v.mark }, v.markStage)}</span>
                <span class="vol-text">
                  <span class="vol-no">${v.no}<em>${v.list.length} 字</em></span>
                  <b class="vol-name">${v.name}</b>
                  <span class="vol-sub">${v.sub}</span>
                </span>
              </button>`).join("")}
          </div>
        </section>
      </div>`;

    let hi = 0;
    const hero = $(".hero"), layers = $$(".hero-glyph .layer"), strip = $$(".hero-strip .hs");
    heroTimer = setInterval(() => {
      layers[hi].classList.remove("active");
      strip[hi].classList.remove("on");
      hi = (hi + 1) % layers.length;
      layers[hi].classList.add("active");
      strip[hi].classList.add("on");
      hero.style.setProperty("--accent", ACCENTS[stages[hi].id]);
    }, 1800);
    $("#randomBtn").onclick = () => { location.hash = `#/char/${ALL[Math.floor(Math.random() * ALL.length)].c}`; };
    $("#q").oninput = (e) => {
      const q = e.target.value.trim();
      if (q) openVolume("shuowen", q);
    };
    $$(".vol").forEach((el) => el.onclick = () => openVolume(el.dataset.v));
    relayout = null;
  }

  function renderBrowse(focusSearch) {
    clearInterval(heroTimer);
    const v = volById[homeState.vol];
    const present = new Set(v.list.map((d) => initialOf(d.py)));
    const inits = ["all", ...INITIALS.filter((k) => present.has(k))];
    view.innerHTML = `
      <div class="fit browse" style="--c:${v.color}">
        <header class="top">
          <button class="back-link" id="backDash">${ICON.back}卷目</button>
          <div class="page-title"><h2>${v.name}</h2><span>${v.no}</span></div>
          <label class="search">${ICON.search}<input id="q" placeholder="在本卷查字" value="${homeState.q}" autocomplete="off"></label>
          ${fsBtn()}
        </header>
        <div class="chips">${inits.map((k) => `<button class="chip${k === homeState.init ? " active" : ""}" data-k="${k}">${k === "all" ? "全部" : k}</button>`).join("")}</div>
        <div class="grid" id="grid"></div>
        ${pagerHTML()}
      </div>`;
    $("#backDash").onclick = () => {
      Object.assign(homeState, { mode: "dash", q: "", init: "all", page: 0 });
      renderDash();
    };
    $("#q").oninput = (e) => { homeState.q = e.target.value.trim(); homeState.page = 0; renderGrid(); };
    $$(".chip").forEach((el) => el.onclick = () => {
      homeState.init = el.dataset.k;
      homeState.page = 0;
      $$(".chip").forEach((c) => c.classList.toggle("active", c === el));
      renderGrid();
    });
    $("#pgPrev").onclick = () => { homeState.page--; renderGrid(); };
    $("#pgNext").onclick = () => { homeState.page++; renderGrid(); };
    relayout = renderGrid;
    renderGrid();
    if (focusSearch) {
      const input = $("#q");
      input.focus();
      input.setSelectionRange(input.value.length, input.value.length);
    }
  }

  // ---------- 收藏 ----------
  // 筛选：全部收藏、按熟悉度、未标，以及不限收藏的「答错过」
  const favState = { page: 0, filter: "all", sort: "weak" };
  const SORTS = [
    { id: "weak", name: "生疏优先" },
    { id: "recent", name: "最近查看" },
    { id: "views", name: "查看最多" },
  ];
  function favList() { return favs.list().map((c) => byChar[c]).filter(Boolean); }
  function wrongList() { return ALL.filter((d) => study.get(d.c).w); }

  function favFilters() {
    const list = favList();
    const count = (lv) => list.filter((d) => study.level(d.c) === lv).length;
    return [
      { id: "all", name: "全部", n: list.length },
      ...LEVELS.map((l) => ({ id: String(l.lv), name: l.name, n: count(l.lv), color: l.color })),
      { id: "0", name: "未标", n: count(0) },
      { id: "wrong", name: "答错过", n: wrongList().length, color: "#e0553a" },
    ];
  }

  function favView() {
    const f = favState.filter;
    let list = f === "wrong" ? wrongList() : favList();
    if (f !== "all" && f !== "wrong") list = list.filter((d) => study.level(d.c) === +f);
    const weakKey = (d) => { const lv = study.level(d.c); return lv === 0 ? 2.5 : lv; };
    const sorters = {
      weak: (a, b) => weakKey(a) - weakKey(b) || (study.get(b.c).w || 0) - (study.get(a.c).w || 0) || (study.get(b.c).t || 0) - (study.get(a.c).t || 0),
      recent: (a, b) => (study.get(b.c).t || 0) - (study.get(a.c).t || 0),
      views: (a, b) => (study.get(b.c).v || 0) - (study.get(a.c).v || 0),
    };
    return list.slice().sort(sorters[favState.sort]);
  }

  function renderFavGrid() {
    favState.emptyText = favState.filter === "wrong" ? "还没有答错过的字" : "这一类还没有字";
    fillGrid(favView(), favState, true);
  }

  function renderFav() {
    const filters = favFilters();
    const sort = SORTS.find((s) => s.id === favState.sort);
    const head = `<header class="top"><div class="page-title"><h2>收藏</h2><span>${filters[0].n} 字</span></div><span class="spacer"></span>
      <button class="sort-btn" id="sortBtn" title="切换排序">${sort.name}</button>${fsBtn()}</header>`;
    if (!filters[0].n && !filters[filters.length - 1].n) {
      view.innerHTML = `<div class="fit no-chips">${head}<div class="center-empty"><div class="big">藏</div><p>在汉字详情页点 ♡ 收藏，标上熟悉度，<br>这里就会按你的掌握情况排好</p><a class="btn-primary" href="#/">去翻翻六卷</a></div></div>`;
      $("#sortBtn").hidden = true;
      return;
    }
    view.innerHTML = `
      <div class="fit">
        ${head}
        <div class="chips">${filters.map((f) => `<button class="chip lv-chip${f.id === favState.filter ? " active" : ""}" data-f="${f.id}"${f.color ? ` style="--c:${f.color}"` : ""}>${f.color ? '<i class="dot"></i>' : ""}${f.name}<em>${f.n}</em></button>`).join("")}</div>
        <div class="grid" id="grid"></div>
        ${pagerHTML()}
      </div>`;
    $$(".lv-chip").forEach((el) => el.onclick = () => {
      favState.filter = el.dataset.f;
      favState.page = 0;
      $$(".lv-chip").forEach((c) => c.classList.toggle("active", c === el));
      renderFavGrid();
    });
    $("#sortBtn").onclick = (e) => {
      const i = SORTS.findIndex((s) => s.id === favState.sort);
      favState.sort = SORTS[(i + 1) % SORTS.length].id;
      e.currentTarget.textContent = SORTS.find((s) => s.id === favState.sort).name;
      favState.page = 0;
      renderFavGrid();
    };
    $("#pgPrev").onclick = () => { favState.page--; renderFavGrid(); };
    $("#pgNext").onclick = () => { favState.page++; renderFavGrid(); };
    relayout = renderFavGrid;
    renderFavGrid();
  }

  // ---------- 同音字 ----------
  const pyState = { syl: "", tone: 0, page: 0, from: "#/", base: "home" };
  function pyList() {
    const list = bySyl[pyState.syl] || [];
    return pyState.tone ? list.filter((d) => toneOf(d.py) === pyState.tone) : list;
  }
  function renderPyGrid() { fillGrid(pyList(), pyState); }

  function renderPy() {
    const syl = pyState.syl, list = bySyl[syl] || [], init = initialOf(syl);
    const sample = (t) => list.find((d) => toneOf(d.py) === t);
    const tones = [1, 2, 3, 4, 5].filter(sample);
    const inits = INITIALS.filter((k) => SYLLABLES.some((s) => initialOf(s) === k));
    const syls = SYLLABLES.filter((s) => initialOf(s) === init);
    const first = (pyList()[0] || list[0]).c;
    view.innerHTML = `
      <div class="fit pyfit">
        <header class="top">
          <button class="back-link" id="pyBack">${ICON.back}返回</button>
          <div class="page-title"><h2 class="py-title">${showSyl(syl)}</h2><span>同音 ${list.length} 字</span></div>
          ${speakBtn(first, "big")}
          <span class="spacer"></span>
          ${fsBtn()}
        </header>
        <div class="chips tone-row">
          <button class="chip${pyState.tone ? "" : " active"}" data-t="0">全部声调</button>
          ${tones.map((t) => `<button class="chip tone-chip${pyState.tone === t ? " active" : ""}" data-t="${t}">${sample(t).py}<em>${list.filter((d) => toneOf(d.py) === t).length}</em></button>`).join("")}
        </div>
        <div class="chips init-row">${inits.map((k) => `<button class="chip${k === init ? " active" : ""}" data-i="${k}">${k}</button>`).join("")}</div>
        <div class="chips syl-row">${syls.map((s) => `<button class="chip syl-chip${s === syl ? " active" : ""}" data-s="${s}">${showSyl(s)}<em>${bySyl[s].length}</em></button>`).join("")}</div>
        <div class="grid" id="grid"></div>
        ${pagerHTML()}
      </div>`;
    const go = (s) => location.replace(`#/py/${s}`);
    $("#pyBack").onclick = () => {
      const to = pyState.from || "#/";
      if (to.startsWith("#/char/")) renderPage(pyState.base === "py" ? "home" : pyState.base, true);
      location.hash = to;
    };
    $$(".tone-row .chip").forEach((el) => el.onclick = () => {
      pyState.tone = +el.dataset.t;
      pyState.page = 0;
      $$(".tone-row .chip").forEach((c) => c.classList.toggle("active", c === el));
      const sb = $(".pyfit .speak-btn");
      if (sb) sb.dataset.say = (pyList()[0] || list[0]).c;
      renderPyGrid();
    });
    $$(".init-row .chip").forEach((el) => el.onclick = () => {
      if (el.dataset.i !== init) go(SYLLABLES.find((s) => initialOf(s) === el.dataset.i));
    });
    $$(".syl-row .chip").forEach((el) => el.onclick = () => { if (el.dataset.s !== syl) go(el.dataset.s); });
    ["init-row", "syl-row"].forEach((cls) => {
      const row = $(`.${cls}`), on = $(`.${cls} .active`);
      if (row && on) row.scrollLeft = on.offsetLeft - row.offsetLeft - row.clientWidth / 2 + on.offsetWidth / 2;
    });
    $("#pgPrev").onclick = () => { pyState.page--; renderPyGrid(); };
    $("#pgNext").onclick = () => { pyState.page++; renderPyGrid(); };
    relayout = renderPyGrid;
    renderPyGrid();
  }

  // ---------- 详情 ----------
  const det = { d: null, i: 0, timer: null, mode: "evo", stages: [], shown: 0, strokeN: 0 };
  const strokeCache = {};

  // 上一个 / 下一个沿着进入详情前所在的列表走
  function neighborList(d) {
    let list = null;
    if (page === "fav") list = favView();
    else if (page === "py") list = pyList();
    else if (page === "home" && homeState.mode === "list") list = homeList();
    if (!list || !list.includes(d)) list = volById.qimeng.set.has(d.c) ? volById.qimeng.list : ALL;
    return list;
  }

  function openDetail(d) {
    stopPlay();
    Object.assign(det, { d, i: 0, mode: "evo", stages: stagesOf(d), shown: 0, strokeN: 0 });
    const list = neighborList(d), idx = list.indexOf(d);
    study.update(d.c, (s) => { s.v = (s.v || 0) + 1; s.t = Date.now(); });
    const prev = list[(idx - 1 + list.length) % list.length], next = list[(idx + 1) % list.length];
    const vol = volumeOf(d);
    const cells = [["拼音", d.py], ["卷目", vol ? vol.name : "—"]];
    if (d.type) cells.push(["造字法", d.type]);
    if (d.t && d.t !== d.c) cells.push(["繁体", d.t]);
    detail.innerHTML = `
      <div class="detail-bg"></div>
      <header class="detail-top">
        <a class="back-link" href="${pageHash()}">${ICON.back}返回</a>
        <div class="dt-title"><b>${d.c}</b><a class="py-link" href="#/py/${sylOf(d.py)}" title="查看同音字">${d.py}</a>${speakBtn(d.c)}${d.m ? `<span>${d.m}</span>` : ""}</div>
        <button class="icon-btn fav-btn${favs.has(d.c) ? " on" : ""}" id="favBtn" aria-label="收藏">${ICON.heart}</button>
        ${fsBtn()}
      </header>
      <div class="stage-wrap" id="stage">
        <a class="char-jump" href="#/char/${prev.c}"><small>上一字</small><b>${prev.c}</b></a>
        <div class="stage-ring">
          <div class="stage" id="evoStage">${det.stages.map((s) => `<div class="layer" data-id="${s.id}">${glyph(d, s.id)}</div>`).join("")}</div>
          <div class="stroke-board" id="strokeBoard"></div>
        </div>
        <a class="char-jump" href="#/char/${next.c}"><small>下一字</small><b>${next.c}</b></a>
      </div>
      <div class="detail-side">
        <div class="mode-switch">
          <button id="modeEvo" class="on">演化</button>
          <button id="modeStroke">笔顺</button>
        </div>
        <div class="stage-caption" id="caption"></div>
        <div class="timeline"></div>
        <div class="controls">
          <button class="icon-btn" id="prevStage" aria-label="上一步">${ICON.prev}</button>
          <button class="play" id="playBtn" aria-label="播放">${ICON.play}</button>
          <button class="icon-btn" id="nextStage" aria-label="下一步">${ICON.next}</button>
        </div>
        <p class="stage-desc" id="stageDesc"></p>
        <div class="info-row" style="grid-template-columns:repeat(${cells.length},1fr)">${cells.map(([k, v], i) => i === 0
          ? `<a class="info py" href="#/py/${sylOf(d.py)}" title="查看同音字"><small>${k}<i>同音 ${bySyl[sylOf(d.py)].length} ›</i></small><b>${v}</b></a>`
          : `<div class="info"><small>${k}</small><b>${v}</b></div>`).join("")}</div>
        <div class="mastery">
          <span class="ms-label">熟悉度</span>
          <div class="ms-levels">${LEVELS.map((l) => `<button data-lv="${l.lv}" style="--lc:${l.color}">${l.name}</button>`).join("")}</div>
          <span class="ms-stat" id="msStat"></span>
        </div>
        ${d.s ? `<div class="block story"><h4>字源故事</h4><p>${d.s}</p></div>` : ""}
        <div class="block forms"><h4>字形一览</h4><div class="forms-grid" style="--n:${det.stages.length}">
          ${det.stages.map((s, i) => `<button class="fm" data-i="${i}" style="--sc:${ACCENTS[s.id]}"><i>${glyph(d, s.id)}</i><small>${s.name}</small></button>`).join("")}
        </div></div>
      </div>`;
    detail.classList.toggle("has-story", !!d.s);

    $("#favBtn").onclick = (e) => {
      const on = favs.toggle(d.c), b = e.currentTarget;
      b.classList.toggle("on", on);
      b.classList.remove("bump"); void b.offsetWidth; b.classList.add("bump");
    };
    $("#modeEvo").onclick = enterEvo;
    $("#modeStroke").onclick = enterStroke;
    $$(".ms-levels button", detail).forEach((el) => el.onclick = () => {
      const lv = +el.dataset.lv;
      study.update(d.c, (s) => { s.lv = s.lv === lv ? 0 : lv; });
      renderMastery();
    });
    renderMastery();
    $$(".fm", detail).forEach((el) => el.onclick = () => {
      if (det.mode === "stroke") enterEvo();
      stopPlay();
      setStage(+el.dataset.i);
    });
    $("#prevStage").onclick = () => step(-1);
    $("#nextStage").onclick = () => step(1);
    $("#playBtn").onclick = togglePlay;
    bindSwipe($("#stage"));

    detail.setAttribute("aria-hidden", "false");
    shell.classList.add("detail-open");
    buildTimeline();
    setStage(0);
    layoutForms();
    setTimeout(() => { if (det.d === d && det.mode === "evo" && !det.timer && det.i === 0) togglePlay(); }, 700);
  }

  function renderMastery() {
    const s = study.get(det.d.c);
    $$(".ms-levels button", detail).forEach((b) => b.classList.toggle("on", +b.dataset.lv === (s.lv || 0)));
    const parts = [`看过 ${s.v || 0} 次`];
    if (s.r || s.w) parts.push(`答对 ${s.r || 0} · 错 ${s.w || 0}`);
    $("#msStat").textContent = parts.join(" · ");
  }

  // 字形一览：按面板实际尺寸挑列数，让每个字形尽量大
  function layoutForms() {
    const grid = $(".forms-grid", detail);
    if (!grid || !grid.clientWidth || !grid.clientHeight) return;
    const n = det.stages.length, W = grid.clientWidth, H = grid.clientHeight;
    let best = n, size = 0;
    for (let c = 1; c <= n; c++) {
      const r = Math.ceil(n / c), s = Math.min(W / c, H / r - 20);
      if (s > size + 0.5) { size = s; best = c; }
    }
    grid.style.setProperty("--fc", best);
    grid.style.setProperty("--fr", Math.ceil(n / best));
  }
  window.addEventListener("resize", () => requestAnimationFrame(() => det.d && layoutForms()));

  function step(dir) {
    stopPlay();
    if (det.mode === "stroke") stepStroke(dir);
    else setStage(det.i + dir);
  }

  function buildTimeline() {
    const stages = det.stages, n = stages.length;
    const pos = (i) => `calc(11px + (100% - 22px) * ${n <= 1 ? 0 : i / (n - 1)})`;
    $(".timeline", detail).innerHTML = `
      <div class="tl-track"><div class="tl-fill"></div>${stages.map((s, i) => `<button class="tl-node" data-i="${i}" style="left:${pos(i)}" aria-label="${s.name}"></button>`).join("")}</div>
      <div class="tl-labels">${stages.map((s, i) => `<span data-i="${i}" style="left:${pos(i)}">${s.name}</span>`).join("")}</div>`;
    $$(".tl-node", detail).forEach((el) => el.onclick = () => { stopPlay(); setStage(+el.dataset.i); });
  }

  function closeDetail() {
    stopPlay();
    det.d = null;
    shell.classList.remove("detail-open");
    detail.setAttribute("aria-hidden", "true");
    if (page === "fav") renderFav();
    else if (page === "home" && $("#grid")) renderGrid();
    else if (page === "py" && $("#grid")) renderPyGrid();
  }

  function setStage(i) {
    if (!det.d || det.mode !== "evo") return;
    const n = det.stages.length;
    i = Math.max(0, Math.min(n - 1, i));
    det.i = i;
    const s = det.stages[i];
    detail.style.setProperty("--accent", ACCENTS[s.id]);
    $$(".stage .layer", detail).forEach((l, k) => {
      l.classList.toggle("active", k === i);
      l.classList.toggle("before", k < i);
    });
    $(".tl-fill", detail).style.width = `calc((100% - 22px) * ${n <= 1 ? 0 : i / (n - 1)})`;
    $$(".tl-node", detail).forEach((node, k) => { node.classList.toggle("active", k === i); node.classList.toggle("done", k < i); });
    $$(".tl-labels span", detail).forEach((node, k) => node.classList.toggle("active", k === i));
    $$(".fm", detail).forEach((node, k) => node.classList.toggle("on", k === i));
    $("#caption").innerHTML = `<div class="sc-name">${s.name}</div><div class="sc-era">${s.era} · ${s.year}</div>`;
    $("#stageDesc").textContent = s.desc;
  }

  function togglePlay() {
    if (det.mode === "stroke") return playStrokes();
    if (det.timer) return stopPlay();
    if (det.i >= det.stages.length - 1) setStage(0);
    setPlayIcon(true);
    det.timer = setInterval(() => {
      if (det.i >= det.stages.length - 1) return stopPlay();
      setStage(det.i + 1);
    }, 1500);
  }

  function setPlayIcon(playing) {
    const b = $("#playBtn");
    if (b) b.innerHTML = playing ? ICON.pause : ICON.play;
  }

  function stopPlay() {
    clearInterval(det.timer);
    clearTimeout(det.timer);
    det.timer = null;
    setPlayIcon(false);
  }

  function enterEvo() {
    if (!det.d || det.mode === "evo") return;
    det.mode = "evo";
    det.strokeN = 0;
    stopPlay();
    $("#strokeBoard").classList.remove("on");
    $("#strokeBoard").innerHTML = "";
    $("#evoStage").hidden = false;
    $("#modeStroke").classList.remove("on");
    $("#modeEvo").classList.add("on");
    buildTimeline();
    setStage(det.i);
  }

  // ---------- 笔顺 ----------
  // 笔顺数据来自 Make Me a Hanzi：1024 见方、y 轴朝上，基线在 900
  function strokeFile(ch) {
    return `assets/strokes/${ch.codePointAt(0).toString(16)}.json`;
  }

  // 404 记为未收录；网络或读取失败不缓存，下次再试
  function loadStrokes(ch) {
    if (strokeCache[ch] !== undefined) return Promise.resolve(strokeCache[ch]);
    return fetch(strokeFile(ch)).then((r) => {
      if (r.status === 404) return (strokeCache[ch] = null);
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return r.json().then((d) => (strokeCache[ch] = d && d.s && d.s.length ? d : null));
    });
  }

  function strokeSVG(data) {
    const rice = `<g class="rice"><rect x="4" y="4" width="1016" height="1016"/><path d="M4 4L1020 1020M1020 4L4 1020M512 4V1020M4 512H1020"/></g>`;
    const ghosts = data.s.map((p) => `<path class="ghost" d="${p}"/>`).join("");
    const traces = data.s.map((p, i) => {
      const pts = (data.m && data.m[i]) || [];
      const line = pts.map((pt, k) => `${k ? "L" : "M"}${pt[0]} ${pt[1]}`).join("");
      return `<clipPath id="sk${i}"><path d="${p}"/></clipPath><path class="trace" data-i="${i}" clip-path="url(#sk${i})" d="${line}"/>`;
    }).join("");
    return `<svg class="stroke-svg" viewBox="0 0 1024 1024">${rice}<g transform="translate(0 900) scale(1 -1)">${ghosts}${traces}</g></svg>`;
  }

  function strokeTimeline() {
    $(".timeline", detail).innerHTML = det.strokeN
      ? `<div class="sp">${Array.from({ length: det.strokeN }, (_, i) => `<i data-i="${i}"></i>`).join("")}</div><div class="sp-label"><span>起笔</span><span>收笔</span></div>`
      : `<div class="sp"><i></i></div><div class="sp-label"><span></span></div>`;
  }

  function enterStroke() {
    if (!det.d || (det.mode === "stroke" && det.strokeN)) return;
    const d = det.d;
    det.mode = "stroke";
    stopPlay();
    $("#evoStage").hidden = true;
    const board = $("#strokeBoard");
    board.classList.add("on");
    board.innerHTML = `<div class="stroke-empty">正在读取笔顺…</div>`;
    $("#modeEvo").classList.remove("on");
    $("#modeStroke").classList.add("on");
    detail.style.setProperty("--accent", ACCENTS.regular);
    det.strokeN = 0;
    strokeTimeline();
    $("#caption").innerHTML = `<div class="sc-name">笔顺</div><div class="sc-era">读取中</div>`;
    $("#stageDesc").textContent = "";
    loadStrokes(d.c).then((data) => {
      if (det.mode !== "stroke" || det.d !== d) return;
      if (!data) {
        board.innerHTML = `<div class="stroke-empty"><b>${d.c}</b>笔顺库暂未收录这个字</div>`;
        $("#caption").innerHTML = `<div class="sc-name">笔顺</div><div class="sc-era">暂无数据</div>`;
        return;
      }
      det.strokeN = data.s.length;
      det.shown = 0;
      board.innerHTML = strokeSVG(data);
      $$(".trace", board).forEach((p) => {
        const len = Math.ceil(p.getTotalLength()) + 200;
        p.dataset.len = len;
        p.style.strokeDasharray = `${len} ${len}`;
        p.style.strokeDashoffset = len;
      });
      strokeTimeline();
      updateStrokeUI();
      playStrokes();
    }).catch(() => {
      if (det.mode !== "stroke" || det.d !== d) return;
      const hint = location.protocol === "file:" ? "请用网页服务器打开本应用" : "请检查网络后再点一次笔顺";
      board.innerHTML = `<div class="stroke-empty"><b>${d.c}</b>笔顺读取失败<br>${hint}</div>`;
      $("#caption").innerHTML = `<div class="sc-name">笔顺</div><div class="sc-era">读取失败</div>`;
    });
  }

  // 前 k 笔直接写好，其余隐藏
  function paintStrokes(k) {
    $$("#strokeBoard .trace").forEach((p) => {
      const on = +p.dataset.i < k;
      p.style.transition = "none";
      p.classList.toggle("on", on);
      p.classList.remove("cur");
      p.style.strokeDashoffset = on ? 0 : p.dataset.len;
    });
  }

  function animateStroke(i) {
    const p = $(`#strokeBoard .trace[data-i="${i}"]`);
    if (!p) return 0;
    $$("#strokeBoard .trace.cur").forEach((x) => x.classList.remove("cur"));
    const len = +p.dataset.len, dur = Math.round(len * 0.55 + 160);
    p.style.transition = "none";
    p.style.strokeDashoffset = len;
    p.classList.add("on", "cur");
    void p.getBoundingClientRect();
    p.style.transition = `stroke-dashoffset ${dur}ms cubic-bezier(.45, 0, .55, 1)`;
    p.style.strokeDashoffset = 0;
    return dur;
  }

  function updateStrokeUI() {
    const n = det.strokeN, k = det.shown;
    $$(".sp i", detail).forEach((el, i) => {
      el.classList.toggle("done", i < k - 1 || (i === k - 1 && !det.timer));
      el.classList.toggle("cur", i === k - 1 && !!det.timer);
    });
    $("#caption").innerHTML = `<div class="sc-name">笔顺</div><div class="sc-era">${k ? `第 ${k} 笔 · ` : ""}共 ${n} 笔</div>`;
    $("#stageDesc").textContent = k >= n ? "写完了，点播放可以再写一遍。" : k ? "左右键或箭头逐笔查看。" : "点播放，跟着一笔一笔写。";
  }

  function stepStroke(dir) {
    if (!det.strokeN) return;
    if (dir > 0) {
      if (det.shown >= det.strokeN) return;
      const i = det.shown++;
      paintStrokes(i);
      animateStroke(i);
    } else {
      det.shown = Math.max(0, det.shown - 1);
      paintStrokes(det.shown);
    }
    updateStrokeUI();
  }

  function playStrokes() {
    if (det.mode !== "stroke" || !det.strokeN) return;
    if (det.timer) { stopPlay(); updateStrokeUI(); return; }
    if (det.shown >= det.strokeN) det.shown = 0;
    paintStrokes(det.shown);
    setPlayIcon(true);
    const tick = () => {
      if (det.mode !== "stroke") return;
      if (det.shown >= det.strokeN) {
        $$("#strokeBoard .trace.cur").forEach((x) => x.classList.remove("cur"));
        stopPlay();
        updateStrokeUI();
        return;
      }
      const i = det.shown++;
      const dur = animateStroke(i);
      updateStrokeUI();
      det.timer = setTimeout(tick, dur + 90);
    };
    det.timer = setTimeout(tick, 260);
    updateStrokeUI();
  }

  function bindSwipe(el) {
    let x0 = null;
    el.addEventListener("pointerdown", (e) => { x0 = e.clientX; });
    el.addEventListener("pointerup", (e) => {
      if (x0 === null) return;
      const dx = e.clientX - x0;
      x0 = null;
      if (Math.abs(dx) > 40) step(dx < 0 ? 1 : -1);
    });
  }

  document.addEventListener("keydown", (e) => {
    if (det.d) {
      if (e.key === "ArrowRight") step(1);
      else if (e.key === "ArrowLeft") step(-1);
      else if (e.key === " ") { e.preventDefault(); togglePlay(); }
      else if (e.key === "Escape") location.hash = pageHash();
      return;
    }
    if ((e.key === "ArrowRight" || e.key === "ArrowLeft") && document.activeElement?.tagName !== "INPUT") {
      const dir = e.key === "ArrowRight" ? 1 : -1;
      if (page === "home" && $("#grid")) { homeState.page += dir; renderGrid(); }
      else if (page === "fav" && $("#grid")) { favState.page += dir; renderFavGrid(); }
      else if (page === "py" && $("#grid")) { pyState.page += dir; renderPyGrid(); }
    }
  });

  // ---------- 识古字测验 ----------
  // 从「千文」卷出题，选项也取自同一卷，避免全是生僻字
  const QUIZ_POOL = volById.qianwen.list.filter((d) => stagesOf(d).some((s) => s.kind === "img"));
  const quiz = {
    total: 10,
    start() {
      Object.assign(this, { round: 0, score: 0, streak: 0, best: 0, correct: 0 });
      this.next();
    },
    // 约四成题目从「生疏」或答错多于答对的字里出
    pick() {
      const weak = ALL.filter((x) => {
        const s = study.get(x.c);
        return (s.lv === 1 || (s.w || 0) > (s.r || 0)) && stagesOf(x).some((st) => st.kind === "img") && x !== (this.q && this.q.d);
      });
      const pool = weak.length && Math.random() < 0.4 ? weak : QUIZ_POOL;
      const d = pool[Math.floor(Math.random() * pool.length)];
      const ancient = stagesOf(d).filter((s) => s.kind === "img");
      const stage = ancient[Math.floor(Math.random() * ancient.length)].id;
      const opts = [d];
      while (opts.length < 4) {
        const o = QUIZ_POOL[Math.floor(Math.random() * QUIZ_POOL.length)];
        if (!opts.includes(o)) opts.push(o);
      }
      return { d, stage, opts: opts.sort(() => Math.random() - 0.5) };
    },
    next() {
      if (this.round >= this.total) return this.result();
      this.q = this.pick();
      this.render();
    },
    scoreHTML() {
      return `<span>得分 <b>${this.score}</b></span><span>连对 <b>${this.streak}</b></span>`;
    },
    render() {
      const { d, stage, opts } = this.q;
      const st = STAGES.find((s) => s.id === stage);
      view.innerHTML = `
        <div class="fit quiz-fit" style="--accent:${ACCENTS[stage]}">
          <div class="quiz-head"><h2>识古字</h2><div class="score">${this.scoreHTML()}</div>${fsBtn()}</div>
          <div class="progress"><i style="width:${(this.round / this.total) * 100}%"></i></div>
          <section class="quiz-card">
            <div class="q"><span>第 ${this.round + 1} 题</span>这个<b>${st.name}</b>是哪个字？</div>
            <div class="quiz-glyph"><div class="halo"></div>${glyph(d, stage)}</div>
            <div class="options">${opts.map((o) => `<button class="opt" data-c="${o.c}"><b>${o.c}</b><small>${o.py}</small></button>`).join("")}</div>
            <div id="fb"></div>
          </section>
        </div>`;
      $$(".opt").forEach((b) => b.onclick = () => this.answer(b));
    },
    answer(btn) {
      const { d } = this.q, ok = btn.dataset.c === d.c;
      $$(".opt").forEach((b) => { b.disabled = true; if (b.dataset.c === d.c) b.classList.add("right"); });
      if (!ok) btn.classList.add("wrong");
      if (ok) { this.score += 10 + this.streak * 2; this.streak++; this.best = Math.max(this.best, this.streak); this.correct++; }
      else this.streak = 0;
      this.round++;
      const { before, after } = recordAnswer(d.c, ok);
      const lvName = (lv) => (levelOf(lv) || { name: "未标" }).name;
      const lvNote = before === after
        ? `熟悉度 <b style="color:${levelOf(after).color}">${lvName(after)}</b>`
        : `熟悉度 ${lvName(before)} → <b style="color:${levelOf(after).color}">${lvName(after)}</b>`;
      $(".score").innerHTML = this.scoreHTML();
      $(".progress i").style.width = `${(this.round / this.total) * 100}%`;
      setTimeout(() => {
        if (!$(".options")) return;
        $(".options").style.display = "none";
        $("#fb").innerHTML = `<div class="feedback ${ok ? "ok" : "no"}">
          <div class="fb-main"><b class="fb-char">${d.c}</b><div><div class="fb-title">${ok ? "答对了" : "答案是这个字"}</div><div class="fb-py">${d.py}${speakBtn(d.c)}${d.m ? " · " + d.m : ""}</div><div class="fb-lv">${lvNote}</div></div></div>
          ${d.s ? `<p class="fb-story">${d.s}</p>` : ""}
          <div class="row"><a class="btn-ghost" href="#/char/${d.c}">看演化</a><button class="btn-primary" id="nextQ">${this.round >= this.total ? "查看成绩" : "下一题"}</button></div></div>`;
        $("#nextQ").onclick = () => this.next();
      }, 650);
    },
    result() {
      const c = this.correct, p = Math.round((c / this.total) * 100);
      const title = p >= 90 ? "甲骨学者" : p >= 60 ? "金石同好" : "初识古字";
      view.innerHTML = `
        <div class="fit quiz-fit">
          <div class="quiz-head"><h2>识古字</h2><span class="spacer"></span>${fsBtn()}</div>
          <div class="progress"><i style="width:100%"></i></div>
          <section class="quiz-card result">
            <span class="eyebrow">一轮已毕</span>
            <div class="ringscore" style="--p:${p}"><div>${c}<small>/${this.total}</small></div></div>
            <h2>${title}</h2>
            <p>总分 ${this.score} · 最高连对 ${this.best}</p>
            <button class="btn-primary" id="again">再来一轮</button>
          </section>
        </div>`;
      $("#again").onclick = () => this.start();
    },
  };

  // 已在字库里时再点「字库」，回到卷目
  $('.tabbar a[data-tab="home"]').addEventListener("click", () => {
    if (page === "home" && !det.d && homeState.mode === "list") {
      Object.assign(homeState, { mode: "dash", q: "", init: "all", page: 0 });
      renderDash();
    }
  });

  window.addEventListener("hashchange", route);
  route();

  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => navigator.serviceWorker.register("sw.js").catch(() => {}));
  }
})();
