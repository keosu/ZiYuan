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
  let page = null, heroTimer = null, relayout = null;
  function route() {
    const [, a = "", b = ""] = (location.hash.slice(1) || "/").split("/");
    const ch = decodeURIComponent(b);
    if (a === "char" && byChar[ch]) {
      if (!page) renderPage("home");
      openDetail(byChar[ch]);
      return;
    }
    closeDetail();
    renderPage(["quiz", "fav"].includes(a) ? a : "home");
  }

  function renderPage(name) {
    if (page === name && name !== "fav") return;
    page = name;
    clearInterval(heroTimer);
    relayout = null;
    $$(".tabbar a").forEach((t) => t.classList.toggle("active", t.dataset.tab === name));
    ({ home: renderHome, quiz: () => quiz.start(), fav: renderFav })[name]();
  }

  // ---------- 字格分页（铺满可视区域，不滚动） ----------
  function cardHTML(d) {
    const old = stagesOf(d).find((s) => s.kind === "img");
    return `<a class="card" href="#/char/${d.c}">
      ${old ? `<div class="card-ancient">${glyph(d, old.id)}</div>` : ""}
      ${favs.has(d.c) ? '<i class="card-fav">♥</i>' : ""}
      <div class="card-char">${d.c}</div>
      <div class="card-meta"><b>${d.py}</b>${d.m ? `<span>${d.m}</span>` : ""}</div>
    </a>`;
  }

  // 按字格容器的实际尺寸决定一页放几列几行
  function fillGrid(list, state) {
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
      ? slice.map(cardHTML).join("")
      : `<div class="empty"><div class="big">无</div><p>没有找到相关汉字</p></div>`;
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
          <label class="search">${ICON.search}<input id="q" placeholder="查字：汉字、拼音或含义" autocomplete="off"></label>
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
  const favState = { page: 0 };
  function favList() { return favs.list().map((c) => byChar[c]).filter(Boolean); }
  function renderFavGrid() { fillGrid(favList(), favState); }

  function renderFav() {
    const list = favList();
    const head = `<header class="top"><div class="page-title"><h2>收藏</h2><span>${list.length} 字</span></div><span class="spacer"></span>${fsBtn()}</header>`;
    if (!list.length) {
      view.innerHTML = `<div class="fit no-chips">${head}<div class="center-empty"><div class="big">藏</div><p>在汉字详情页点 ♡，把喜欢的字收进来</p><a class="btn-primary" href="#/">去翻翻六卷</a></div></div>`;
      return;
    }
    view.innerHTML = `
      <div class="fit no-chips">
        ${head}
        <div class="grid" id="grid"></div>
        ${pagerHTML()}
      </div>`;
    $("#pgPrev").onclick = () => { favState.page--; renderFavGrid(); };
    $("#pgNext").onclick = () => { favState.page++; renderFavGrid(); };
    relayout = renderFavGrid;
    renderFavGrid();
  }

  // ---------- 详情 ----------
  const det = { d: null, i: 0, timer: null, mode: "evo", stages: [], shown: 0, strokeN: 0 };
  const strokeCache = {};

  // 上一个 / 下一个沿着进入详情前所在的列表走
  function neighborList(d) {
    let list = null;
    if (page === "fav") list = favList();
    else if (page === "home" && homeState.mode === "list") list = homeList();
    if (!list || !list.includes(d)) list = volById.qimeng.set.has(d.c) ? volById.qimeng.list : ALL;
    return list;
  }

  function openDetail(d) {
    stopPlay();
    Object.assign(det, { d, i: 0, mode: "evo", stages: stagesOf(d), shown: 0, strokeN: 0 });
    const list = neighborList(d), idx = list.indexOf(d);
    const prev = list[(idx - 1 + list.length) % list.length], next = list[(idx + 1) % list.length];
    const vol = volumeOf(d);
    const cells = [["拼音", d.py], ["卷目", vol ? vol.name : "—"]];
    if (d.type) cells.push(["造字法", d.type]);
    if (d.t && d.t !== d.c) cells.push(["繁体", d.t]);
    detail.innerHTML = `
      <div class="detail-bg"></div>
      <header class="detail-top">
        <a class="back-link" href="#/${page === "home" ? "" : page}">${ICON.back}返回</a>
        <div class="dt-title"><b>${d.c}</b><span>${d.py}${d.m ? " · " + d.m : ""}</span></div>
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
        <div class="info-row" style="grid-template-columns:repeat(${cells.length},1fr)">${cells.map(([k, v]) => `<div class="info"><small>${k}</small><b>${v}</b></div>`).join("")}</div>
        ${d.s ? `<div class="block story"><h4>字源故事</h4><p>${d.s}</p></div>` : ""}
      </div>`;

    $("#favBtn").onclick = (e) => {
      const on = favs.toggle(d.c), b = e.currentTarget;
      b.classList.toggle("on", on);
      b.classList.remove("bump"); void b.offsetWidth; b.classList.add("bump");
    };
    $("#modeEvo").onclick = enterEvo;
    $("#modeStroke").onclick = enterStroke;
    $("#prevStage").onclick = () => step(-1);
    $("#nextStage").onclick = () => step(1);
    $("#playBtn").onclick = togglePlay;
    bindSwipe($("#stage"));

    detail.setAttribute("aria-hidden", "false");
    shell.classList.add("detail-open");
    buildTimeline();
    setStage(0);
    setTimeout(() => { if (det.d === d && det.mode === "evo" && !det.timer && det.i === 0) togglePlay(); }, 700);
  }

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
      else if (e.key === "Escape") location.hash = `#/${page === "home" ? "" : page}`;
      return;
    }
    if ((e.key === "ArrowRight" || e.key === "ArrowLeft") && document.activeElement?.tagName !== "INPUT") {
      const dir = e.key === "ArrowRight" ? 1 : -1;
      if (page === "home" && $("#grid")) { homeState.page += dir; renderGrid(); }
      else if (page === "fav" && $("#grid")) { favState.page += dir; renderFavGrid(); }
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
    pick() {
      const d = QUIZ_POOL[Math.floor(Math.random() * QUIZ_POOL.length)];
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
      $(".score").innerHTML = this.scoreHTML();
      $(".progress i").style.width = `${(this.round / this.total) * 100}%`;
      setTimeout(() => {
        if (!$(".options")) return;
        $(".options").style.display = "none";
        $("#fb").innerHTML = `<div class="feedback ${ok ? "ok" : "no"}">
          <div class="fb-main"><b class="fb-char">${d.c}</b><div><div class="fb-title">${ok ? "答对了" : "答案是这个字"}</div><div class="fb-py">${d.py}${d.m ? " · " + d.m : ""}</div></div></div>
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
