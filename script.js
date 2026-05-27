(function () {
  "use strict";

  const STORAGE_KEY = "classroom-dashboard-v1";
  const EMOJI_DAY_STORAGE_KEY = "classroom-dashboard-emoji-day-v1";
  const SLOT_COUNT = 22;
  const DEFAULT_NAME = "待命名";
  const DEFAULT_EMOJI = "😄";
  const SCORE_MIN = 0;
  const SCORE_MAX = 999;
  const TEACHER_PASSWORD = "1234";

  /** 23 種動物（與 models/animal-*.glb 檔名一致）：1~22 號依序對應前 22 種 */
  const ANIMALS = [
    "beaver",
    "bee",
    "bunny",
    "cat",
    "caterpillar",
    "chick",
    "cow",
    "crab",
    "deer",
    "dog",
    "elephant",
    "fish",
    "fox",
    "giraffe",
    "tiger", // 15 號固定為 tiger
    "koala",
    "lion",
    "monkey",
    "panda",
    "parrot",
    "penguin",
    "polar",
    "hog",
  ];

  const EMOJI_OPTIONS = [
    "😢",
    "😄",
    "😍",
    "🎉",
    "💢",
    "😱",
    "😴",
    "💩",
  ];

  const IDLE_ANIM = "idle";
  const IDLE_PHASE_MS = 10000;
  const SPECIAL_PHASE_MS = 2500;
  const SPECIAL_ANIMATIONS = [
    "run",
    "walk",
    "eat",
    "dance",
    "gesture-positive",
    "gesture-negative",
    "static",
    "jump",
  ];

  const QUICK_ADD_VALUES = [1, 2, 3, 4, 5];
  // 繽紛鮮明漸層（半透明 + 磨砂），適合低年級、襯托 3D 動物
  const SLOT_GRADIENTS = [
    "linear-gradient(145deg, rgba(255, 107, 129, 0.55) 0%, rgba(255, 183, 77, 0.55) 100%)",
    "linear-gradient(145deg, rgba(77, 208, 255, 0.55) 0%, rgba(92, 124, 250, 0.55) 100%)",
    "linear-gradient(145deg, rgba(105, 240, 174, 0.55) 0%, rgba(56, 203, 137, 0.55) 100%)",
    "linear-gradient(145deg, rgba(255, 238, 88, 0.55) 0%, rgba(255, 171, 64, 0.55) 100%)",
    "linear-gradient(145deg, rgba(206, 147, 255, 0.55) 0%, rgba(151, 117, 250, 0.55) 100%)",
    "linear-gradient(145deg, rgba(255, 158, 205, 0.55) 0%, rgba(255, 107, 180, 0.55) 100%)",
    "linear-gradient(145deg, rgba(72, 219, 251, 0.55) 0%, rgba(0, 184, 148, 0.55) 100%)",
    "linear-gradient(145deg, rgba(255, 159, 67, 0.55) 0%, rgba(255, 99, 132, 0.55) 100%)",
    "linear-gradient(145deg, rgba(162, 155, 254, 0.55) 0%, rgba(116, 185, 255, 0.55) 100%)",
    "linear-gradient(145deg, rgba(255, 217, 61, 0.55) 0%, rgba(255, 107, 107, 0.55) 100%)",
    "linear-gradient(145deg, rgba(129, 236, 236, 0.55) 0%, rgba(116, 185, 255, 0.55) 100%)",
    "linear-gradient(145deg, rgba(255, 154, 162, 0.55) 0%, rgba(250, 177, 160, 0.55) 100%)",
  ];

  const ANIMAL_LABELS = {
    beaver: "河狸",
    bee: "蜜蜂",
    bunny: "兔子",
    cat: "小貓",
    caterpillar: "毛毛蟲",
    chick: "小雞",
    cow: "乳牛",
    crab: "螃蟹",
    deer: "小鹿",
    dog: "小狗",
    elephant: "大象",
    fish: "小魚",
    fox: "狐狸",
    giraffe: "長頸鹿",
    tiger: "老虎",
    koala: "無尾熊",
    lion: "獅子",
    monkey: "猴子",
    panda: "熊貓",
    parrot: "鸚鵡",
    penguin: "企鵝",
    polar: "北極熊",
    hog: "小豬",
  };

  const LUCKY_DRAW_MS = 5000;
  const LUCKY_DRAW_TICK_MS = 75;

  const gridEl = document.getElementById("dashboard-grid");
  const btnTeacherMode = document.getElementById("btn-teacher-mode");

  let slots = [];
  let teacherMode = false;
  let animCycleTimeoutId = null;
  let activeScoreMenuSlotId = null;

  let webAudioCtx = null;
  let luckyDrawRunning = false;
  let luckyDrawTimerId = null;
  let luckyDrawFlashId = null;
  let luckyDrawWinnerIds = [];

  let timerMode = "stopwatch";
  let timerRunning = false;
  let timerIntervalId = null;
  let stopwatchElapsedMs = 0;
  let stopwatchStartTs = 0;
  let countdownRemainingMs = 0;
  let countdownEndTs = 0;
  let timerAlarmPlayed = false;

  function animalForSlot(id) {
    return ANIMALS[(id - 1) % ANIMALS.length];
  }

  function isValidAnimal(name) {
    return ANIMALS.indexOf(name) >= 0;
  }

  function eggHueForSlot(id) {
    return Math.round(((id - 1) / SLOT_COUNT) * 360);
  }

  function slotGradientByPosition(id) {
    const idx = id - 1;
    const row = Math.floor(idx / 6);
    const col = idx % 6;
    // 以列/欄混合跳步，避免左右上下顏色接近
    const paletteIndex =
      (row * 5 + col * 7 + row * col * 3) % SLOT_GRADIENTS.length;
    return SLOT_GRADIENTS[paletteIndex];
  }

  function clampScore(v) {
    const n = Number.isFinite(v) ? v : 0;
    return Math.max(SCORE_MIN, Math.min(SCORE_MAX, n));
  }

  function createDefaultSlots() {
    return Array.from({ length: SLOT_COUNT }, function (_, i) {
      const id = i + 1;
      return {
        id: id,
        name: DEFAULT_NAME,
        hatched: false,
        animal: animalForSlot(id),
        emoji: DEFAULT_EMOJI,
        score: 0,
      };
    });
  }

  function loadSlots() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        slots = createDefaultSlots();
        saveSlots();
        return;
      }
      const data = JSON.parse(raw);
      if (!data.slots || data.slots.length !== SLOT_COUNT) {
        slots = createDefaultSlots();
        saveSlots();
        return;
      }
      slots = data.slots.map(function (s, i) {
        const id = i + 1;
        const savedAnimal = s.animal;
        const savedEmoji = s.emoji;
        const savedScore =
          typeof s.score === "number" ? clampScore(s.score) : 0;
        return {
          id: id,
          name: s.name || DEFAULT_NAME,
          hatched: !!s.hatched,
          animal:
            savedAnimal && isValidAnimal(savedAnimal)
              ? savedAnimal
              : animalForSlot(id),
          emoji:
            typeof savedEmoji === "string" && savedEmoji.length
              ? savedEmoji
              : DEFAULT_EMOJI,
          score: savedScore,
        };
      });
    } catch (e) {
      slots = createDefaultSlots();
      saveSlots();
    }
  }

  function saveSlots() {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ slots: slots, updatedAt: Date.now() })
    );
  }

  function getSlotById(id) {
    return slots.find(function (s) {
      return s.id === id;
    });
  }

  function setViewerAnimation(mv, animName) {
    if (!mv || !animName) return;
    try {
      mv.animationName = animName;
      mv.setAttribute("animation-name", animName);
    } catch (e) {
      console.warn("[動畫] 切換失敗：", animName, e);
    }
  }

  function forEachHatchedViewer(callback) {
    document
      .querySelectorAll(".slot.is-hatched model-viewer")
      .forEach(callback);
  }

  function pickRandomSpecialAnimation() {
    return SPECIAL_ANIMATIONS[
      Math.floor(Math.random() * SPECIAL_ANIMATIONS.length)
    ];
  }

  function applyIdlePhase() {
    forEachHatchedViewer(function (mv) {
      setViewerAnimation(mv, IDLE_ANIM);
    });
  }

  function applySpecialPhase() {
    forEachHatchedViewer(function (mv) {
      setViewerAnimation(mv, pickRandomSpecialAnimation());
    });
  }

  /** 階段 A：idle 10 秒 → 階段 B：大招 2.5 秒 → 循環 */
  function runAnimationCycle() {
    if (animCycleTimeoutId !== null) {
      clearTimeout(animCycleTimeoutId);
      animCycleTimeoutId = null;
    }

    applyIdlePhase();

    animCycleTimeoutId = setTimeout(function () {
      applySpecialPhase();

      animCycleTimeoutId = setTimeout(function () {
        runAnimationCycle();
      }, SPECIAL_PHASE_MS);
    }, IDLE_PHASE_MS);
  }

  function startAnimationCycle() {
    runAnimationCycle();
  }

  // ===============================
  // ====== Freesound 聯網音效 ======
  // ===============================
  const FREESOUND_API_BASE = "https://freesound.org/apiv2/search/";
  const FREESOUND_TOKEN =
    (typeof window !== "undefined" && window.FREESOUND_API_KEY) || "";

  const FREESOUND_EFFECTS = {
    cheer: {
      query: "applause cheer short",
      filter: "tag:(applause OR cheer) duration:[0 TO 5]",
      fallbackFilters: ["tag:applause duration:[0 TO 5]", "duration:[0 TO 4]"],
      sort: "duration_asc",
      volume: 0.8,
    },
    rocket: {
      query: "level up powerup win",
      filter: "duration:[0 TO 8]",
      fallbackFilters: [
        "tag:arcade duration:[0 TO 8]",
        "tag:retro duration:[0 TO 8]",
      ],
      sort: "rating_desc",
      volume: 0.48,
    },
    hatch: {
      query: "magic sparkle pop",
      filter: "tag:(magic OR sparkle OR pop) duration:[0 TO 5]",
      fallbackFilters: ["tag:cartoon duration:[0 TO 4]"],
      sort: "rating_desc",
      volume: 0.72,
    },
    wrong: {
      query: "oops error wrong",
      filter: "tag:(oops OR wrong OR error) duration:[0 TO 4]",
      fallbackFilters: [
        "tag:oops duration:[0 TO 4]",
        "tag:wrong duration:[0 TO 4]",
      ],
      sort: "duration_asc",
      volume: 0.52,
    },
  };

  const freesoundUrlCache = {};
  const freesoundFetchPromises = {};
  const freesoundPreloadedAudio = {};
  let activeFreesoundPlayer = null;
  let cheerAudioPlayer = null;

  function pickPreviewUrlFromResults(results) {
    if (!Array.isArray(results)) return null;
    for (let i = 0; i < results.length; i++) {
      const sound = results[i];
      const previews = sound && sound.previews;
      const url =
        previews &&
        (previews["preview-hq-mp3"] || previews["preview-lq-mp3"]);
      if (url) return url;
    }
    return null;
  }

  async function searchFreesoundOnce(query, filter, sort) {
    const params = new URLSearchParams({
      query: query,
      token: FREESOUND_TOKEN,
      fields: "id,name,previews",
      page_size: "8",
      sort: sort || "rating_desc",
    });
    if (filter) params.set("filter", filter);

    const res = await fetch(FREESOUND_API_BASE + "?" + params.toString());
    if (!res.ok) throw new Error("Freesound HTTP " + res.status);
    const data = await res.json();
    return pickPreviewUrlFromResults(data.results);
  }

  async function fetchFreesoundPreviewUrl(effectKey) {
    if (!FREESOUND_TOKEN) return null;
    if (freesoundUrlCache[effectKey]) return freesoundUrlCache[effectKey];
    if (freesoundFetchPromises[effectKey]) return freesoundFetchPromises[effectKey];

    const spec = FREESOUND_EFFECTS[effectKey];
    if (!spec) return null;

    const filtersToTry = [spec.filter]
      .concat(spec.fallbackFilters || [])
      .filter(Boolean);

    freesoundFetchPromises[effectKey] = (async function () {
      try {
        for (let i = 0; i < filtersToTry.length; i++) {
          const url = await searchFreesoundOnce(
            spec.query,
            filtersToTry[i],
            spec.sort
          );
          if (url) {
            freesoundUrlCache[effectKey] = url;
            return url;
          }
        }
        const queryOnlyUrl = await searchFreesoundOnce(
          spec.query,
          "",
          spec.sort
        );
        if (queryOnlyUrl) {
          freesoundUrlCache[effectKey] = queryOnlyUrl;
          return queryOnlyUrl;
        }
        throw new Error("No preview URL in search results");
      } catch (err) {
        console.warn("[Freesound] 搜尋失敗:", effectKey, err);
        return null;
      } finally {
        delete freesoundFetchPromises[effectKey];
      }
    })();

    return freesoundFetchPromises[effectKey];
  }

  async function ensureFreesoundPreloaded(effectKey) {
    if (!FREESOUND_TOKEN) return null;

    try {
      const spec = FREESOUND_EFFECTS[effectKey];
      if (!spec) return null;

      const existing = freesoundPreloadedAudio[effectKey];
      if (existing && existing.dataset.ready === "1") return existing;

      const url = await fetchFreesoundPreviewUrl(effectKey);
      if (!url) return null;

      const player = existing || new Audio();
      player.preload = "auto";
      player.volume = spec.volume != null ? spec.volume : 0.8;
      freesoundPreloadedAudio[effectKey] = player;

      if (player.src !== url) {
        player.dataset.ready = "0";
        player.src = url;
        player.load();
      }

      await new Promise(function (resolve) {
        if (player.readyState >= 3) {
          player.dataset.ready = "1";
          resolve();
          return;
        }
        const done = function () {
          player.dataset.ready = "1";
          resolve();
        };
        player.addEventListener("canplaythrough", done, { once: true });
        player.addEventListener("error", resolve, { once: true });
        setTimeout(resolve, 2500);
      });

      return player;
    } catch (err) {
      console.warn("[Freesound] 預載失敗:", effectKey, err);
      return null;
    }
  }

  async function preloadCheerSound() {
    if (!FREESOUND_TOKEN) return;
    try {
      const player = await ensureFreesoundPreloaded("cheer");
      if (player) cheerAudioPlayer = player;
    } catch (err) {
      console.warn("[Freesound] 歡呼預載失敗:", err);
    }
  }

  function getWebAudioContext() {
    if (!webAudioCtx) {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return null;
      webAudioCtx = new Ctx();
    }
    if (webAudioCtx.state === "suspended") {
      webAudioCtx.resume().catch(function () {});
    }
    return webAudioCtx;
  }

  /** 加分：短促上揚電子「叮叮」，可重疊播放 */
  function playScoreDing() {
    const ctx = getWebAudioContext();
    if (!ctx) return;

    const t = ctx.currentTime;
    const notes = [
      { freq: 620, at: 0, dur: 0.12 },
      { freq: 880, at: 0.1, dur: 0.14 },
      { freq: 1180, at: 0.22, dur: 0.18 },
    ];

    notes.forEach(function (note) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(note.freq, t + note.at);
      gain.gain.setValueAtTime(0.0001, t + note.at);
      gain.gain.exponentialRampToValueAtTime(0.28, t + note.at + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + note.at + note.dur);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(t + note.at);
      osc.stop(t + note.at + note.dur + 0.05);
    });
  }

  /** 倒計時結束：清脆提示音 */
  function playTimerAlarm() {
    const ctx = getWebAudioContext();
    if (!ctx) return;

    const t = ctx.currentTime;
    [0, 0.15, 0.3].forEach(function (offset, i) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = i === 2 ? "triangle" : "sine";
      const freq = i === 2 ? 1320 : 880;
      osc.frequency.setValueAtTime(freq, t + offset);
      gain.gain.setValueAtTime(0.0001, t + offset);
      gain.gain.exponentialRampToValueAtTime(0.35, t + offset + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + offset + 0.2);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(t + offset);
      osc.stop(t + offset + 0.25);
    });
  }

  async function playFreesoundEffect(effectKey) {
    try {
      const spec = FREESOUND_EFFECTS[effectKey];
      if (!spec || !FREESOUND_TOKEN) return;

      let url = freesoundUrlCache[effectKey] || null;
      const preloaded = freesoundPreloadedAudio[effectKey];
      if (preloaded && preloaded.src) {
        url = preloaded.src;
      }
      if (!url) {
        url = await fetchFreesoundPreviewUrl(effectKey);
      }
      if (!url) return;

      if (activeFreesoundPlayer) {
        try {
          activeFreesoundPlayer.pause();
        } catch (_) {
          /* ignore */
        }
      }

      const player =
        preloaded && preloaded.src === url ? preloaded : new Audio(url);
      player.volume = spec.volume != null ? spec.volume : 0.8;
      player.currentTime = 0;
      activeFreesoundPlayer = player;
      await player.play();
    } catch (err) {
      console.warn("[Freesound] 播放失敗:", effectKey, err);
    }
  }

  function preloadFreesoundEffects() {
    if (!FREESOUND_TOKEN) return;
    preloadCheerSound();
    Object.keys(FREESOUND_EFFECTS).forEach(function (key) {
      if (key === "cheer") return;
      ensureFreesoundPreloaded(key).catch(function () {});
    });
  }

  function todayDateKey() {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return y + "-" + m + "-" + day;
  }

  function hashSlotDay(slotId, dateKey) {
    let h = 2166136261;
    const str = dateKey + ":" + slotId;
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return Math.abs(h);
  }

  function pickDailyEmoji(slotId, dateKey) {
    const idx = hashSlotDay(slotId, dateKey) % EMOJI_OPTIONS.length;
    return EMOJI_OPTIONS[idx];
  }

  function syncDailyEmojiSlot(slotId, emoji) {
    const today = todayDateKey();
    let pack = null;
    try {
      pack = JSON.parse(localStorage.getItem(EMOJI_DAY_STORAGE_KEY));
    } catch (e) {
      pack = null;
    }
    if (!pack || pack.date !== today || !Array.isArray(pack.emojis)) {
      return;
    }
    pack.emojis[slotId - 1] = emoji;
    localStorage.setItem(EMOJI_DAY_STORAGE_KEY, JSON.stringify(pack));
  }

  function applyDailyEmojiStates() {
    const today = todayDateKey();
    let pack = null;
    try {
      pack = JSON.parse(localStorage.getItem(EMOJI_DAY_STORAGE_KEY));
    } catch (e) {
      pack = null;
    }

    if (
      pack &&
      pack.date === today &&
      Array.isArray(pack.emojis) &&
      pack.emojis.length === SLOT_COUNT
    ) {
      slots.forEach(function (s) {
        s.emoji = pack.emojis[s.id - 1] || pickDailyEmoji(s.id, today);
      });
      return;
    }

    const emojis = [];
    for (let id = 1; id <= SLOT_COUNT; id++) {
      emojis.push(pickDailyEmoji(id, today));
    }
    slots.forEach(function (s) {
      s.emoji = emojis[s.id - 1];
    });
    localStorage.setItem(
      EMOJI_DAY_STORAGE_KEY,
      JSON.stringify({ date: today, emojis: emojis })
    );
    saveSlots();
  }

  function beastDisplayName(slot) {
    if (!slot.hatched) return "🥚 神獸蛋";
    const label = ANIMAL_LABELS[slot.animal] || slot.animal;
    return label + " 神獸";
  }

  function getSlotElement(slotId) {
    return document.querySelector('[data-slot-id="' + slotId + '"]');
  }

  function applySlotDrawClasses(el, slotId) {
    if (!el) return;
    el.classList.toggle("slot--draw-flash", luckyDrawFlashId === slotId);
    el.classList.toggle("slot--draw-winner", luckyDrawWinnerIds.indexOf(slotId) >= 0);
  }

  function refreshAllSlotDrawClasses() {
    document.querySelectorAll(".slot").forEach(function (el) {
      const id = parseInt(el.dataset.slotId, 10);
      if (!Number.isNaN(id)) applySlotDrawClasses(el, id);
    });
  }

  function clearLuckyDrawVisuals() {
    luckyDrawFlashId = null;
    luckyDrawWinnerIds = [];
    refreshAllSlotDrawClasses();
  }

  function setLuckyDrawFlash(slotId) {
    const prev = luckyDrawFlashId;
    luckyDrawFlashId = slotId;
    if (prev !== slotId) {
      applySlotDrawClasses(getSlotElement(prev), prev);
      applySlotDrawClasses(getSlotElement(slotId), slotId);
    }
  }

  function pickRandomSlotId() {
    return Math.floor(Math.random() * SLOT_COUNT) + 1;
  }

  function pickUniqueWinnerIds(count) {
    const pool = [];
    for (let i = 1; i <= SLOT_COUNT; i++) pool.push(i);
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const tmp = pool[i];
      pool[i] = pool[j];
      pool[j] = tmp;
    }
    return pool.slice(0, count);
  }

  function showLuckyResultModal(winnerIds) {
    const modal = document.getElementById("lucky-result-modal");
    const listEl = document.getElementById("lucky-modal-list");
    if (!modal || !listEl) return;

    listEl.innerHTML = "";
    winnerIds.forEach(function (id) {
      const slot = getSlotById(id);
      if (!slot) return;
      const li = document.createElement("li");
      li.className = "lucky-modal__item";
      li.innerHTML =
        '<span class="lucky-modal__item-num">' +
        id +
        "</span>" +
        '<div class="lucky-modal__item-body"><strong>' +
        (slot.name || DEFAULT_NAME) +
        "</strong><span>" +
        beastDisplayName(slot) +
        "</span></div>";
      listEl.appendChild(li);
    });

    modal.hidden = false;
    document.body.classList.add("lucky-modal-open");
  }

  function closeLuckyResultModal() {
    const modal = document.getElementById("lucky-result-modal");
    if (modal) modal.hidden = true;
    document.body.classList.remove("lucky-modal-open");
    clearLuckyDrawVisuals();
  }

  function finishLuckyDraw(count) {
    luckyDrawRunning = false;
    document.body.classList.remove("lucky-draw-running");
    luckyDrawFlashId = null;

    luckyDrawWinnerIds = pickUniqueWinnerIds(count);
    refreshAllSlotDrawClasses();
    showLuckyResultModal(luckyDrawWinnerIds);

    const btn = document.getElementById("btn-lucky-start");
    if (btn) {
      btn.disabled = false;
      btn.textContent = "🌟 開始抽籤";
    }
  }

  function startLuckyDraw() {
    if (luckyDrawRunning) return;

    const input = document.getElementById("lucky-count");
    let count = input ? parseInt(input.value, 10) : 1;
    if (Number.isNaN(count)) count = 1;
    count = Math.max(1, Math.min(SLOT_COUNT, count));

    if (input) input.value = String(count);

    closeLuckyResultModal();
    clearLuckyDrawVisuals();

    luckyDrawRunning = true;
    document.body.classList.add("lucky-draw-running");

    const btn = document.getElementById("btn-lucky-start");
    if (btn) {
      btn.disabled = true;
      btn.textContent = "✨ 抽籤中…";
    }

    const startedAt = Date.now();
    setLuckyDrawFlash(pickRandomSlotId());

    if (luckyDrawTimerId !== null) {
      clearInterval(luckyDrawTimerId);
    }

    luckyDrawTimerId = setInterval(function () {
      if (Date.now() - startedAt >= LUCKY_DRAW_MS) {
        clearInterval(luckyDrawTimerId);
        luckyDrawTimerId = null;
        finishLuckyDraw(count);
        return;
      }
      setLuckyDrawFlash(pickRandomSlotId());
    }, LUCKY_DRAW_TICK_MS);
  }

  function formatTimerMs(ms, showHours) {
    const totalSec = Math.max(0, Math.floor(ms / 1000));
    const h = Math.floor(totalSec / 3600);
    const m = Math.floor((totalSec % 3600) / 60);
    const s = totalSec % 60;
    const mm = String(m).padStart(2, "0");
    const ss = String(s).padStart(2, "0");
    if (showHours || h > 0) {
      return String(h).padStart(2, "0") + ":" + mm + ":" + ss;
    }
    return mm + ":" + ss;
  }

  function getCountdownSetupMs() {
    const minEl = document.getElementById("timer-min");
    const secEl = document.getElementById("timer-sec");
    let min = minEl ? parseInt(minEl.value, 10) : 1;
    let sec = secEl ? parseInt(secEl.value, 10) : 30;
    if (Number.isNaN(min)) min = 0;
    if (Number.isNaN(sec)) sec = 0;
    min = Math.max(0, Math.min(99, min));
    sec = Math.max(0, Math.min(59, sec));
    return (min * 60 + sec) * 1000;
  }

  function updateTimerDisplay() {
    const display = document.getElementById("timer-display");
    if (!display) return;

    let ms = 0;
    if (timerMode === "stopwatch") {
      ms = stopwatchElapsedMs;
      if (timerRunning) {
        ms += Date.now() - stopwatchStartTs;
      }
      display.textContent = formatTimerMs(ms, ms >= 3600000);
      display.classList.remove("is-urgent");
      return;
    }

    ms = countdownRemainingMs;
    if (timerRunning) {
      ms = Math.max(0, countdownEndTs - Date.now());
    }
    display.textContent = formatTimerMs(ms, false);

    const urgent = timerRunning && ms > 0 && ms <= 10000;
    display.classList.toggle("is-urgent", urgent);

    if (timerRunning && ms <= 0 && !timerAlarmPlayed) {
      timerAlarmPlayed = true;
      timerRunning = false;
      if (timerIntervalId !== null) {
        clearInterval(timerIntervalId);
        timerIntervalId = null;
      }
      countdownRemainingMs = 0;
      display.textContent = "00:00";
      display.classList.remove("is-urgent");
      playTimerAlarm();
    }
  }

  function stopTimerLoop() {
    if (timerIntervalId !== null) {
      clearInterval(timerIntervalId);
      timerIntervalId = null;
    }
  }

  function startTimerLoop() {
    stopTimerLoop();
    timerIntervalId = setInterval(updateTimerDisplay, 100);
    updateTimerDisplay();
  }

  function timerStart() {
    getWebAudioContext();
    timerAlarmPlayed = false;

    if (timerMode === "stopwatch") {
      if (!timerRunning) {
        stopwatchStartTs = Date.now();
        timerRunning = true;
        startTimerLoop();
      }
      return;
    }

    if (!timerRunning) {
      if (countdownRemainingMs <= 0) {
        countdownRemainingMs = getCountdownSetupMs();
      }
      if (countdownRemainingMs <= 0) {
        countdownRemainingMs = 1000;
      }
      countdownEndTs = Date.now() + countdownRemainingMs;
      timerRunning = true;
      startTimerLoop();
    }
  }

  function timerPause() {
    if (!timerRunning) return;

    if (timerMode === "stopwatch") {
      stopwatchElapsedMs += Date.now() - stopwatchStartTs;
    } else {
      countdownRemainingMs = Math.max(0, countdownEndTs - Date.now());
    }
    timerRunning = false;
    stopTimerLoop();
    updateTimerDisplay();
  }

  function timerReset() {
    timerRunning = false;
    timerAlarmPlayed = false;
    stopTimerLoop();

    if (timerMode === "stopwatch") {
      stopwatchElapsedMs = 0;
      stopwatchStartTs = 0;
    } else {
      countdownRemainingMs = getCountdownSetupMs();
      countdownEndTs = 0;
    }
    updateTimerDisplay();
  }

  function setTimerMode(mode) {
    timerMode = mode;
    timerRunning = false;
    timerAlarmPlayed = false;
    stopTimerLoop();

    document.querySelectorAll(".timer-mode-tab").forEach(function (tab) {
      const active = tab.dataset.timerMode === mode;
      tab.classList.toggle("is-active", active);
      tab.setAttribute("aria-selected", active ? "true" : "false");
    });

    const setup = document.getElementById("countdown-setup");
    if (setup) setup.hidden = mode !== "countdown";

    if (mode === "countdown") {
      countdownRemainingMs = getCountdownSetupMs();
    } else {
      stopwatchElapsedMs = 0;
    }
    updateTimerDisplay();
  }

  function openToolsSidebar() {
    const sidebar = document.getElementById("tools-sidebar");
    const overlay = document.getElementById("tools-overlay");
    const toggle = document.getElementById("btn-tools-toggle");
    if (!sidebar) return;

    sidebar.classList.add("is-open");
    sidebar.setAttribute("aria-hidden", "false");
    if (overlay) {
      overlay.hidden = false;
      overlay.classList.add("is-visible");
      overlay.setAttribute("aria-hidden", "false");
    }
    if (toggle) toggle.setAttribute("aria-expanded", "true");
    document.body.classList.add("tools-sidebar-open");
  }

  function closeToolsSidebar() {
    const sidebar = document.getElementById("tools-sidebar");
    const overlay = document.getElementById("tools-overlay");
    const toggle = document.getElementById("btn-tools-toggle");
    if (!sidebar) return;

    sidebar.classList.remove("is-open");
    sidebar.setAttribute("aria-hidden", "true");
    if (overlay) {
      overlay.classList.remove("is-visible");
      overlay.setAttribute("aria-hidden", "true");
      setTimeout(function () {
        if (!sidebar.classList.contains("is-open")) overlay.hidden = true;
      }, 300);
    }
    if (toggle) toggle.setAttribute("aria-expanded", "false");
    document.body.classList.remove("tools-sidebar-open");
  }

  function toggleToolsSidebar() {
    const sidebar = document.getElementById("tools-sidebar");
    if (sidebar && sidebar.classList.contains("is-open")) {
      closeToolsSidebar();
    } else {
      openToolsSidebar();
    }
  }

  function initToolsSidebar() {
    const toggle = document.getElementById("btn-tools-toggle");
    const closeBtn = document.getElementById("btn-tools-close");
    const overlay = document.getElementById("tools-overlay");
    const luckyBtn = document.getElementById("btn-lucky-start");
    const luckyModalClose = document.getElementById("btn-lucky-modal-close");
    const timerStartBtn = document.getElementById("btn-timer-start");
    const timerPauseBtn = document.getElementById("btn-timer-pause");
    const timerResetBtn = document.getElementById("btn-timer-reset");

    if (toggle) toggle.addEventListener("click", toggleToolsSidebar);
    if (closeBtn) closeBtn.addEventListener("click", closeToolsSidebar);
    if (overlay) overlay.addEventListener("click", closeToolsSidebar);
    if (luckyBtn) luckyBtn.addEventListener("click", startLuckyDraw);
    if (luckyModalClose) luckyModalClose.addEventListener("click", closeLuckyResultModal);

    const luckyModal = document.getElementById("lucky-result-modal");
    if (luckyModal) {
      luckyModal.addEventListener("click", function (ev) {
        if (ev.target === luckyModal) closeLuckyResultModal();
      });
    }

    document.querySelectorAll(".timer-mode-tab").forEach(function (tab) {
      tab.addEventListener("click", function () {
        setTimerMode(tab.dataset.timerMode || "stopwatch");
      });
    });

    if (timerStartBtn) timerStartBtn.addEventListener("click", timerStart);
    if (timerPauseBtn) timerPauseBtn.addEventListener("click", timerPause);
    if (timerResetBtn) timerResetBtn.addEventListener("click", timerReset);

    ["timer-min", "timer-sec"].forEach(function (id) {
      const el = document.getElementById(id);
      if (el) {
        el.addEventListener("change", function () {
          if (timerMode === "countdown" && !timerRunning) {
            countdownRemainingMs = getCountdownSetupMs();
            updateTimerDisplay();
          }
        });
      }
    });

    setTimerMode("stopwatch");
  }

  function renderSlotElement(slot) {
    let el = document.querySelector('[data-slot-id="' + slot.id + '"]');
    if (!el) {
      el = document.createElement("article");
      el.className = "slot";
      el.dataset.slotId = String(slot.id);
      el.setAttribute("role", "button");
      el.setAttribute("tabindex", "0");
      el.innerHTML =
        '<span class="slot__num"></span>' +
        '<div class="slot__teacher-tools">' +
        '  <button type="button" class="slot__teacher-btn slot__teacher-btn--hatch" title="強制孵化" aria-label="強制孵化">⚡</button>' +
        '  <button type="button" class="slot__teacher-btn slot__teacher-btn--egg" title="變回蛋" aria-label="變回蛋">🥚</button>' +
        "</div>" +
        '<div class="slot__stage"></div>' +
        '<div class="slot__footer">' +
        '  <button type="button" class="slot__footer-part slot__footer-part--emoji" aria-label="狀態表情"></button>' +
        '  <div class="slot__footer-part slot__footer-part--name"></div>' +
        '  <button type="button" class="slot__footer-part slot__footer-part--score" aria-label="得分"></button>' +
        "</div>" +
        '<div class="score-quick-menu"></div>';

      const btnForceHatch = el.querySelector(".slot__teacher-btn--hatch");
      const btnForceEgg = el.querySelector(".slot__teacher-btn--egg");
      if (btnForceHatch) {
        btnForceHatch.addEventListener("click", function (ev) {
          ev.stopPropagation();
          forceHatchSlot(slot.id);
        });
      }
      if (btnForceEgg) {
        btnForceEgg.addEventListener("click", function (ev) {
          ev.stopPropagation();
          forceEggSlot(slot.id);
        });
      }

      el.addEventListener("click", function () {
        onSlotClick(slot.id);
      });
      el.addEventListener("keydown", function (e) {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSlotClick(slot.id);
        }
      });
      gridEl.appendChild(el);
    }

    el.style.setProperty("--slot-gradient", slotGradientByPosition(slot.id));

    el.classList.toggle("is-hatched", slot.hatched);
    el.querySelector(".slot__num").textContent = String(slot.id);

    const footerEmoji = el.querySelector(".slot__footer-part--emoji");
    const footerName = el.querySelector(".slot__footer-part--name");
    const footerScore = el.querySelector(".slot__footer-part--score");
    const quickMenu = el.querySelector(".score-quick-menu");

    if (footerEmoji) {
      footerEmoji.textContent = slot.emoji || DEFAULT_EMOJI;
      footerEmoji.onclick = function (ev) {
        ev.stopPropagation();
        onEmojiClick(slot.id);
      };
    }

    if (footerName) {
      footerName.textContent = slot.name;
    }

    if (footerScore) {
      footerScore.textContent = String(slot.score).padStart(1, "0");
      footerScore.onclick = function (ev) {
        ev.stopPropagation();
        onScoreClick(slot.id);
      };
    }

    if (quickMenu) {
      quickMenu.innerHTML = "";
      QUICK_ADD_VALUES.forEach(function (delta) {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "score-quick-btn";
        btn.textContent = "+" + delta;
        btn.addEventListener("click", function (ev) {
          ev.stopPropagation();
          applyQuickScore(slot.id, delta);
        });
        quickMenu.appendChild(btn);
      });
      const isOpen = activeScoreMenuSlotId === slot.id && !teacherMode;
      quickMenu.classList.toggle("is-open", isOpen);
      quickMenu.setAttribute("aria-hidden", isOpen ? "false" : "true");
    }

    const stage = el.querySelector(".slot__stage");
    stage.innerHTML = "";

    if (slot.hatched) {
      const mv = document.createElement("model-viewer");
      mv.className = "slot__viewer";
      mv.src = "models/animal-" + slot.animal + ".glb";
      mv.alt = slot.name + " 的神獸";
      mv.setAttribute("autoplay", "");
      mv.setAttribute("camera-orbit", "0deg 75deg auto");
      mv.setAttribute("shadow-intensity", "0.8");
      mv.setAttribute("environment-image", "neutral");
      setViewerAnimation(mv, IDLE_ANIM);
      stage.appendChild(mv);
    } else {
      const egg = document.createElement("div");
      egg.className = "slot__egg";
      egg.style.setProperty("--egg-hue", String(eggHueForSlot(slot.id)));
      stage.appendChild(egg);
    }

    applySlotDrawClasses(el, slot.id);
  }

  function renderAll() {
    if (!gridEl) return;
    slots.forEach(renderSlotElement);
  }

  function closeQuickScoreMenu() {
    if (activeScoreMenuSlotId === null) return;
    const prev = getSlotById(activeScoreMenuSlotId);
    activeScoreMenuSlotId = null;
    if (prev) renderSlotElement(prev);
  }

  function applyQuickScore(slotId, delta) {
    const slot = getSlotById(slotId);
    if (!slot) return;
    slot.score = clampScore(slot.score + delta);
    saveSlots();
    activeScoreMenuSlotId = null;
    renderSlotElement(slot);
    playScoreDing();
  }

  function forceHatchSlot(slotId) {
    if (!teacherMode && !ensureTeacherModeOn()) return;
    const slot = getSlotById(slotId);
    if (!slot) return;
    slot.hatched = true;
    saveSlots();
    renderSlotElement(slot);
    void playFreesoundEffect("rocket");
  }

  function forceEggSlot(slotId) {
    if (!teacherMode && !ensureTeacherModeOn()) return;
    const slot = getSlotById(slotId);
    if (!slot) return;
    slot.hatched = false;
    saveSlots();
    renderSlotElement(slot);
  }

  function refreshTeacherModeUI() {
    document.body.classList.toggle("teacher-mode-active", teacherMode);
    if (btnTeacherMode) {
      btnTeacherMode.classList.toggle("is-active", teacherMode);
      btnTeacherMode.title = teacherMode ? "教師模式（已開啟）" : "教師模式";
    }
    renderAll();
  }

  function ensureTeacherModeOn() {
    if (teacherMode) return true;
    const pwd = prompt("請輸入教師密碼：");
    if (pwd === null) return false;
    if (pwd !== TEACHER_PASSWORD) {
      alert("密碼錯誤。");
      return false;
    }
    teacherMode = true;
    refreshTeacherModeUI();
    alert(
      "教師模式已開啟：可使用 ⚡ 強制孵化、🥚 變回蛋，以及表情／分數管理。"
    );
    return true;
  }

  function toggleTeacherMode() {
    if (!teacherMode) {
      ensureTeacherModeOn();
      return;
    }
    teacherMode = false;
    closeQuickScoreMenu();
    refreshTeacherModeUI();
    alert("教師模式已關閉。");
  }

  function onEmojiClick(slotId) {
    if (!teacherMode && !ensureTeacherModeOn()) return;
    const slot = getSlotById(slotId);
    if (!slot) return;

    const menu =
      "請選擇表情編號：\n" +
      EMOJI_OPTIONS.map(function (e, idx) {
        return idx + 1 + " = " + e;
      }).join("\n");

    const input = prompt(menu, "2");
    if (input === null) return;
    const n = parseInt(input, 10);
    if (Number.isNaN(n) || n < 1 || n > EMOJI_OPTIONS.length) {
      alert("請輸入 1～" + EMOJI_OPTIONS.length + " 之間的數字。");
      return;
    }
    slot.emoji = EMOJI_OPTIONS[n - 1];
    syncDailyEmojiSlot(slotId, slot.emoji);
    saveSlots();
    renderSlotElement(slot);
  }

  function onScoreClick(slotId) {
    const slot = getSlotById(slotId);
    if (!slot) return;

    if (teacherMode) {
      closeQuickScoreMenu();
      const input = prompt(
        "請輸入新的分數（0～" + SCORE_MAX + "）：",
        String(slot.score)
      );
      if (input === null) return;
      const n = parseInt(input, 10);
      if (Number.isNaN(n)) {
        alert("請輸入數字。");
        return;
      }
      slot.score = clampScore(n);
      saveSlots();
      renderSlotElement(slot);
      return;
    }
    if (activeScoreMenuSlotId === slotId) {
      activeScoreMenuSlotId = null;
    } else {
      const prev = activeScoreMenuSlotId;
      activeScoreMenuSlotId = slotId;
      if (prev !== null && prev !== slotId) {
        const prevSlot = getSlotById(prev);
        if (prevSlot) renderSlotElement(prevSlot);
      }
    }
    renderSlotElement(slot);
  }

  function onSlotTeacherAction(slotId) {
    if (!ensureTeacherModeOn()) return;
    const slot = getSlotById(slotId);
    if (!slot) return;

    const menu =
      slot.id +
      " 號「" +
      slot.name +
      "」\n\n請輸入操作編號：\n" +
      "1 = 修改學生姓名\n" +
      "2 = 變回蛋（取消孵化）\n" +
      "3 = 與其他號碼交換神獸物種";

    const choice = prompt(menu, "1");
    if (choice === null) return;

    if (choice.trim() === "1") {
      const defaultName = slot.name === DEFAULT_NAME ? "" : slot.name;
      const nameInput = prompt("請輸入新的學生姓名：", defaultName);
      if (nameInput === null) return;
      slot.name = nameInput.trim() || DEFAULT_NAME;
      saveSlots();
      renderSlotElement(slot);
      alert("已更新為：「" + slot.name + "」");
      return;
    }

    if (choice.trim() === "2") {
      if (!slot.hatched) {
        alert("此插槽已是蛋狀態。");
        return;
      }
      const ok = confirm(
        "確定要將 " + slot.id + " 號「" + slot.name + "」變回蛋嗎？"
      );
      if (!ok) return;
      slot.hatched = false;
      saveSlots();
      renderSlotElement(slot);
      alert("已變回蛋狀。");
      return;
    }

    if (choice.trim() === "3") {
      const otherRaw = prompt(
        "要與哪一號交換神獸？（輸入 1～22 的數字）",
        ""
      );
      if (otherRaw === null) return;
      const otherId = parseInt(otherRaw, 10);
      if (Number.isNaN(otherId) || otherId < 1 || otherId > SLOT_COUNT) {
        alert("請輸入有效的號碼（1～22）。");
        return;
      }
      if (otherId === slot.id) {
        alert("不能與自己交換。");
        return;
      }
      const other = getSlotById(otherId);
      if (!other) return;

      const tmpAnimal = slot.animal;
      slot.animal = other.animal;
      other.animal = tmpAnimal;

      saveSlots();
      renderSlotElement(slot);
      renderSlotElement(other);
      alert(
        "已交換：" +
          slot.id +
          " 號（" +
          slot.animal +
          "）↔ " +
          other.id +
          " 號（" +
          other.animal +
          "）"
      );
      return;
    }

    alert("無效的操作編號。");
  }

  function onSlotClick(slotId) {
    const slot = getSlotById(slotId);
    if (!slot) return;

    if (teacherMode) {
      closeQuickScoreMenu();
      onSlotTeacherAction(slotId);
      return;
    }

    if (slot.hatched) {
      window.location.href = "pet.html?slot=" + slot.id;
      return;
    }

    const defaultName = slot.name === DEFAULT_NAME ? "" : slot.name;
    const nameInput = prompt(
      "請輸入 " + slot.id + " 號學生的中文姓名：",
      defaultName
    );
    if (nameInput === null) return;

    const trimmed = nameInput.trim();
    slot.name = trimmed || DEFAULT_NAME;
    saveSlots();
    renderSlotElement(slot);

    const hatchInput = prompt(
      slot.id +
        " 號「" +
        slot.name +
        "」\n\n若要讓神獸破蛋而出，請輸入「孵化」：\n（取消或輸入其他文字則暫不孵化）"
    );
    if (hatchInput === null) return;

    if (hatchInput.trim() === "孵化") {
      slot.hatched = true;
      saveSlots();
      renderSlotElement(slot);
      void playFreesoundEffect("hatch");
      alert("🎉 " + slot.id + " 號 " + slot.name + " 的神獸孵化成功！");
    }
  }

  function boot() {
    if (!gridEl) return;

    loadSlots();

    slots.forEach(function (s) {
      if (s.id === 15) {
        s.animal = "tiger";
      }
      if (typeof s.score !== "number") s.score = 0;
    });
    applyDailyEmojiStates();
    saveSlots();
    preloadFreesoundEffects();
    initToolsSidebar();

    if (btnTeacherMode) {
      btnTeacherMode.addEventListener("click", toggleTeacherMode);
    }
    document.addEventListener("click", function (ev) {
      if (activeScoreMenuSlotId === null) return;
      const current = document.querySelector(
        '[data-slot-id="' + activeScoreMenuSlotId + '"]'
      );
      if (!current) {
        activeScoreMenuSlotId = null;
        return;
      }
      if (!current.contains(ev.target)) {
        closeQuickScoreMenu();
      }
    });

    renderAll();
    startAnimationCycle();
  }

  boot();
})();
