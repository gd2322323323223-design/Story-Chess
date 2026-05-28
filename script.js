(function () {
  "use strict";

  const STORAGE_KEY = "classroom-dashboard-v1";
  const EMOJI_DAY_STORAGE_KEY = "classroom-dashboard-emoji-day-v1";
  const GROUPS_STORAGE_KEY = "classroom-dashboard-groups-v1";
  const TIMER_MINUTE_CUE_STORAGE_KEY = "classroom-dashboard-timer-minute-cue-v1";
  const MAX_GROUPS = 10;
  const SLOT_COUNT = 22;
  const DEFAULT_NAME = "待命名";
  const DEFAULT_EMOJI = "😄";
  const SCORE_MIN = 0;
  const SCORE_MAX = 999;
  const TEACHER_PASSWORD = "1234";
  const SITE_ACCESS_PASSWORD = "2756";
  const SITE_ACCESS_SESSION_KEY = "classroom-site-access-ok-v1";

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
    "🤔",
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

  const LUCKY_DRAW_MS = 3340;
  const LUCKY_DRAW_TICK_MS = 75;

  const gridEl = document.getElementById("dashboard-grid");
  const btnTeacherMode = document.getElementById("btn-teacher-mode");

  let slots = [];
  let teacherMode = false;
  let animCycleTimeoutId = null;
  let activeScoreMenuSlotId = null;
  let activeGroupScoreMenuId = null;

  let webAudioCtx = null;
  let luckyDrawRunning = false;
  let luckyDrawTimerId = null;
  let luckyDrawSuspenseTimer = null;
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
  let timerAlarmActive = false;
  let timerAlarmAudio = null;
  let timerAlarmIntervalId = null;
  let countdownInitialMs = 0;
  let countdownMinuteThresholds = [];
  let countdownMinuteCuesPlayed = [];
  let timerMinuteCueEnabled = true;
  let bulkSelectedIds = [];
  let bulkPickActive = false;
  let bulkSuccessIds = [];
  let bulkSuccessTimerId = null;
  let bulkUiBindingsDone = false;
  let groups = [];
  let scoreToastTimeoutId = null;
  let groupPanelInitialized = false;

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
            savedEmoji === "💩"
              ? "🤔"
              : typeof savedEmoji === "string" && savedEmoji.length
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

  // 針對指定 Sound ID 的快取（避免每次重新打 Freesound）
  const SOUND_ID_SCORE = 241809;
  const SOUND_ID_LUCKY = 139005;
  const SOUND_ID_TIMER = 81159;
  const SOUND_ID_TIMER_MINUTE = 383602;
  const freesoundIdUrlCache = {};
  const freesoundIdAudioCache = {};
  const freesoundIdFetchPromises = {};

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
    // Freesound: Cute1.mp3 (約 2.27 秒，可用於加分音效)
    scoreCute: {
      query: "Cute1.mp3",
      filter: "duration:[0 TO 3]",
      fallbackFilters: ["Cute1"],
      sort: "duration_asc",
      volume: 0.85,
    },
    // Freesound: [Synth seq] \"cute\" sine tone pluck sequence - E5->C4
    timerCute: {
      query: "\"cute\" sine tone pluck sequence E5 C4",
      filter: "duration:[0 TO 5]",
      fallbackFilters: ["cute sine pluck sequence"],
      sort: "rating_desc",
      volume: 0.9,
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

  async function fetchFreesoundPreviewUrlById(soundId) {
    if (!FREESOUND_TOKEN) return null;
    if (freesoundIdUrlCache[soundId]) return freesoundIdUrlCache[soundId];
    if (freesoundIdFetchPromises[soundId]) {
      return freesoundIdFetchPromises[soundId];
    }

    freesoundIdFetchPromises[soundId] = (async function () {
      try {
        const params = new URLSearchParams({
          token: FREESOUND_TOKEN,
          fields: "id,name,previews",
        });
        const res = await fetch(
          "https://freesound.org/apiv2/sounds/" +
            soundId +
            "/?" +
            params.toString()
        );
        if (!res.ok) throw new Error("Freesound sound HTTP " + res.status);
        const data = await res.json();
        const previews = data && data.previews;
        const url =
          previews &&
          (previews["preview-hq-mp3"] || previews["preview-lq-mp3"] || null);
        if (url) {
          freesoundIdUrlCache[soundId] = url;
          return url;
        }
        return null;
      } catch (err) {
        console.warn("[Freesound] 以 ID 取得預覽失敗:", soundId, err);
        return null;
      } finally {
        delete freesoundIdFetchPromises[soundId];
      }
    })();

    return freesoundIdFetchPromises[soundId];
  }

  async function ensureFreesoundAudioById(soundId, volume) {
    if (!FREESOUND_TOKEN) return null;

    const url = await fetchFreesoundPreviewUrlById(soundId);
    if (!url) return null;

    let audio = freesoundIdAudioCache[soundId];
    if (!audio) {
      audio = new Audio();
      audio.preload = "auto";
      freesoundIdAudioCache[soundId] = audio;
    }

    if (audio.src !== url) {
      audio.src = url;
      audio.load();
    }

    audio.volume = volume != null ? volume : 0.9;
    return audio;
  }

  async function playFreesoundById(soundId, volume) {
    if (!FREESOUND_TOKEN) return false;
    try {
      const audio = await ensureFreesoundAudioById(soundId, volume);
      if (!audio) return false;
      audio.currentTime = 0;
      await audio.play();
      return true;
    } catch (err) {
      console.warn("[Freesound] 以 ID 播放失敗:", soundId, err);
      return false;
    }
  }

  function preloadFreesoundByIds() {
    if (!FREESOUND_TOKEN) return;
    [
      SOUND_ID_SCORE,
      SOUND_ID_LUCKY,
      SOUND_ID_TIMER,
      SOUND_ID_TIMER_MINUTE,
    ].forEach(function (soundId) {
      fetchFreesoundPreviewUrlById(soundId)
        .then(function (url) {
          if (url) return ensureFreesoundAudioById(soundId);
        })
        .catch(function () {});
    });
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

  /** 加分用的本地合成短促「叮！」（在沒有 Freesound 金鑰時使用） */
  function playScoreDingFallback() {
    const ctx = getWebAudioContext();
    if (!ctx) return;

    const t = ctx.currentTime;
    const dur = 0.1;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = "sine";
    osc.frequency.setValueAtTime(1200, t);
    osc.frequency.exponentialRampToValueAtTime(1800, t + dur);

    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(0.32, t + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  function playScoreDing() {
    if (FREESOUND_TOKEN) {
      void playFreesoundById(SOUND_ID_SCORE, 0.9);
      return;
    }
    playScoreDingFallback();
  }

  /** 孵化：Q 彈雙音節卡通魔法感 */
  function playHatchSound() {
    const ctx = getWebAudioContext();
    if (!ctx) return;

    const t = ctx.currentTime;

    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = "triangle";
    osc1.frequency.setValueAtTime(400, t);
    osc1.frequency.exponentialRampToValueAtTime(600, t + 0.05);
    gain1.gain.setValueAtTime(0.0001, t);
    gain1.gain.exponentialRampToValueAtTime(0.34, t + 0.008);
    gain1.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(t);
    osc1.stop(t + 0.06);

    const t2 = t + 0.055;
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = "triangle";
    osc2.frequency.setValueAtTime(800, t2);
    osc2.frequency.exponentialRampToValueAtTime(1500, t2 + 0.14);
    gain2.gain.setValueAtTime(0.0001, t2);
    gain2.gain.exponentialRampToValueAtTime(0.38, t2 + 0.01);
    gain2.gain.exponentialRampToValueAtTime(0.0001, t2 + 0.18);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(t2);
    osc2.stop(t2 + 0.22);
  }

  function playLuckyDrawPulse() {
    const ctx = getWebAudioContext();
    if (!ctx) return;

    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = "sine";
    osc.frequency.setValueAtTime(95, t);
    osc.frequency.exponentialRampToValueAtTime(58, t + 0.09);

    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(0.42, t + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.11);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(t);
    osc.stop(t + 0.13);
  }

  function stopLuckyDrawSuspense() {
    if (luckyDrawSuspenseTimer !== null) {
      clearTimeout(luckyDrawSuspenseTimer);
      luckyDrawSuspenseTimer = null;
    }
  }

  function scheduleLuckyDrawSuspense(startedAt) {
    const elapsed = Date.now() - startedAt;
    if (elapsed >= LUCKY_DRAW_MS || !luckyDrawRunning) {
      stopLuckyDrawSuspense();
      return;
    }

    if (!FREESOUND_TOKEN) {
      playLuckyDrawPulse();
    }
    const progress = elapsed / LUCKY_DRAW_MS;
    const interval = Math.max(100, 500 - progress * 400);

    luckyDrawSuspenseTimer = setTimeout(function () {
      scheduleLuckyDrawSuspense(startedAt);
    }, interval);
  }

  function playLuckyDrawSound() {
    if (FREESOUND_TOKEN) {
      void playFreesoundById(SOUND_ID_LUCKY, 0.9);
      return;
    }
    playLuckyWinFanfare();
  }

  /** 抽籤揭曉：本地後備慶祝音 */
  function playLuckyWinFanfare() {
    const ctx = getWebAudioContext();
    if (!ctx) return;

    const t = ctx.currentTime;
    const dur = 0.22;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "triangle";
    osc.frequency.setValueAtTime(880, t);
    osc.frequency.exponentialRampToValueAtTime(1760, t + dur);
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(0.45, t + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(t);
    osc.stop(t + dur + 0.05);

    const t2 = t + 0.08;
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = "sine";
    osc2.frequency.setValueAtTime(1320, t2);
    osc2.frequency.exponentialRampToValueAtTime(2093, t2 + 0.15);
    gain2.gain.setValueAtTime(0.0001, t2);
    gain2.gain.exponentialRampToValueAtTime(0.35, t2 + 0.015);
    gain2.gain.exponentialRampToValueAtTime(0.0001, t2 + 0.16);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(t2);
    osc2.stop(t2 + 0.18);
  }

  /** 倒計時結束：Frequent tone，本地後備提示音 */
  function playTimerAlarmFallback() {
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

  function showTimerAlarmModal() {
    const modal = document.getElementById("timer-alarm-modal");
    if (modal) modal.hidden = false;
    document.body.classList.add("timer-alarm-open");
  }

  function hideTimerAlarmModal() {
    const modal = document.getElementById("timer-alarm-modal");
    if (modal) modal.hidden = true;
    document.body.classList.remove("timer-alarm-open");
  }

  function stopTimerAlarmLoop() {
    timerAlarmActive = false;
    hideTimerAlarmModal();
    if (timerAlarmAudio) {
      timerAlarmAudio.loop = false;
      timerAlarmAudio.pause();
      timerAlarmAudio.currentTime = 0;
      timerAlarmAudio = null;
    }
    if (timerAlarmIntervalId !== null) {
      clearInterval(timerAlarmIntervalId);
      timerAlarmIntervalId = null;
    }
  }

  async function startTimerAlarmLoop() {
    if (timerAlarmActive) return;
    timerAlarmActive = true;
    showTimerAlarmModal();

    if (FREESOUND_TOKEN) {
      try {
        const audio = await ensureFreesoundAudioById(SOUND_ID_TIMER, 0.9);
        if (audio) {
          timerAlarmAudio = audio;
          audio.loop = true;
          audio.currentTime = 0;
          await audio.play();
          return;
        }
      } catch (err) {
        console.warn("[Freesound] 倒計時循環音效失敗:", err);
      }
    }

    playTimerAlarmFallback();
    timerAlarmIntervalId = setInterval(playTimerAlarmFallback, 1400);
  }

  function playTimerMinuteCue() {
    if (!timerMinuteCueEnabled) return;
    if (FREESOUND_TOKEN) {
      void playFreesoundById(SOUND_ID_TIMER_MINUTE, 0.85);
      return;
    }
    playScoreDingFallback();
  }

  function loadTimerMinuteCueSetting() {
    try {
      const raw = localStorage.getItem(TIMER_MINUTE_CUE_STORAGE_KEY);
      if (raw === "0") timerMinuteCueEnabled = false;
      else if (raw === "1") timerMinuteCueEnabled = true;
    } catch (e) {
      timerMinuteCueEnabled = true;
    }
  }

  function saveTimerMinuteCueSetting() {
    localStorage.setItem(
      TIMER_MINUTE_CUE_STORAGE_KEY,
      timerMinuteCueEnabled ? "1" : "0"
    );
  }

  function updateTimerMinuteCueButtonUI() {
    const btn = document.getElementById("btn-timer-minute-cue");
    if (!btn) return;
    btn.hidden = timerMode !== "countdown";
    btn.classList.toggle("is-on", timerMinuteCueEnabled);
    btn.setAttribute("aria-pressed", timerMinuteCueEnabled ? "true" : "false");
    btn.textContent = timerMinuteCueEnabled
      ? "🔔 分鐘提示：開"
      : "🔕 分鐘提示：關";
  }

  function setupCountdownMinuteCues(initialMs) {
    countdownInitialMs = initialMs;
    countdownMinuteCuesPlayed = [];
    countdownMinuteThresholds = [];
    if (
      timerMinuteCueEnabled &&
      timerMode === "countdown" &&
      initialMs >= 5 * 60 * 1000
    ) {
      countdownMinuteThresholds = [240000, 180000, 120000, 60000];
    }
  }

  function checkCountdownMinuteCues(ms) {
    if (!timerRunning || timerMode !== "countdown") return;
    if (!countdownMinuteThresholds.length) return;

    countdownMinuteThresholds.forEach(function (threshold) {
      if (
        ms <= threshold &&
        countdownMinuteCuesPlayed.indexOf(threshold) < 0
      ) {
        countdownMinuteCuesPlayed.push(threshold);
        playTimerMinuteCue();
      }
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
    preloadFreesoundByIds();
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

  function ensureSiteAccess() {
    try {
      if (sessionStorage.getItem(SITE_ACCESS_SESSION_KEY) === "1") return true;
    } catch (e) {}

    while (true) {
      const input = prompt("請輸入網站進入密碼：");
      if (input === null) {
        document.body.innerHTML =
          '<main style="min-height:100vh;display:flex;align-items:center;justify-content:center;padding:2rem;">' +
          '<div style="max-width:420px;padding:1rem 1.25rem;border-radius:12px;background:#fff7ed;color:#7c2d12;border:2px solid #fdba74;font-weight:700;text-align:center;">' +
          "未輸入正確密碼，已停止進入網站。" +
          "</div></main>";
        return false;
      }
      if (input.trim() === SITE_ACCESS_PASSWORD) {
        try {
          sessionStorage.setItem(SITE_ACCESS_SESSION_KEY, "1");
        } catch (e) {}
        return true;
      }
      alert("密碼錯誤，請再試一次。");
    }
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

  function loadGroups() {
    try {
      const raw = localStorage.getItem(GROUPS_STORAGE_KEY);
      if (!raw) {
        groups = [];
        return;
      }
      const data = JSON.parse(raw);
      if (!Array.isArray(data)) {
        groups = [];
        return;
      }
      groups = data.slice(0, MAX_GROUPS).map(function (g, idx) {
        const memberIds = Array.isArray(g.memberIds)
          ? g.memberIds.filter(function (id) {
              return Number.isInteger(id) && id >= 1 && id <= SLOT_COUNT;
            })
          : [];
        return {
          id: typeof g.id === "number" ? g.id : idx + 1,
          name:
            typeof g.name === "string" && g.name.trim()
              ? g.name.trim()
              : "組別 " + (idx + 1),
          memberIds: memberIds,
        };
      });
    } catch (e) {
      groups = [];
    }
  }

  function saveGroups() {
    localStorage.setItem(GROUPS_STORAGE_KEY, JSON.stringify(groups));
  }

  function nextGroupId() {
    let max = 0;
    groups.forEach(function (g) {
      if (g.id > max) max = g.id;
    });
    return max + 1;
  }

  function getGroupById(groupId) {
    return groups.find(function (g) {
      return g.id === groupId;
    });
  }

  function formatScoreDelta(delta) {
    return (delta > 0 ? "+" : "") + delta + "分";
  }

  function showScoreToast(slot, delta) {
    if (!delta) return;
    const toast = document.getElementById("score-toast");
    const textEl = document.getElementById("score-toast-text");
    if (!toast || !textEl) return;

    const name =
      slot.name && slot.name !== DEFAULT_NAME ? slot.name : slot.id + "號學生";
    textEl.textContent = name + "表現佳！" + formatScoreDelta(delta) + "！";

    if (scoreToastTimeoutId !== null) {
      clearTimeout(scoreToastTimeoutId);
      scoreToastTimeoutId = null;
    }

    toast.hidden = false;
    const card = toast.querySelector(".score-toast__card");
    if (card) {
      card.style.animation = "none";
      void card.offsetWidth;
      card.style.animation = "";
    }

    scoreToastTimeoutId = setTimeout(function () {
      toast.hidden = true;
      scoreToastTimeoutId = null;
    }, 2200);
  }

  function showGroupScoreToast(group, delta) {
    if (!delta || !group) return;
    const toast = document.getElementById("score-toast");
    const textEl = document.getElementById("score-toast-text");
    if (!toast || !textEl) return;

    textEl.textContent =
      "「" + group.name + "」全組表現佳！" + formatScoreDelta(delta) + "！";

    if (scoreToastTimeoutId !== null) {
      clearTimeout(scoreToastTimeoutId);
    }
    toast.hidden = false;
    const card = toast.querySelector(".score-toast__card");
    if (card) {
      card.style.animation = "none";
      void card.offsetWidth;
      card.style.animation = "";
    }
    scoreToastTimeoutId = setTimeout(function () {
      toast.hidden = true;
      scoreToastTimeoutId = null;
    }, 2200);
  }

  function slotDisplayLabel(slot) {
    const name =
      slot.name && slot.name !== DEFAULT_NAME ? slot.name : "待命名";
    return slot.id + "號 · " + name;
  }

  function updateBulkPickUI() {
    normalizeBulkSelectedIds();
    const count = bulkSelectedIds.length;
    const showBulkScore = bulkPickActive && count > 0;

    const countEl = document.getElementById("bulk-pick-count");
    if (countEl) {
      countEl.hidden = !showBulkScore;
      countEl.textContent = showBulkScore ? "已揀 " + count + " 人" : "";
    }

    const inline = document.getElementById("bulk-score-inline");
    const inlineLabel = document.getElementById("bulk-score-inline-label");
    if (inline) inline.hidden = !showBulkScore;
    if (inlineLabel && showBulkScore) {
      inlineLabel.textContent = "已揀選 " + count + " 人，點擊加分：";
    }

    const bar = document.getElementById("bulk-score-bar");
    if (bar) bar.hidden = true;

    document.body.classList.toggle("bulk-pick-active", bulkPickActive);
    slots.forEach(renderSlotElement);
  }

  function openBulkPickModal() {
    const modal = document.getElementById("bulk-pick-modal");
    const list = document.getElementById("bulk-pick-list");
    if (!modal || !list) return;

    list.innerHTML = "";
    slots.forEach(function (slot) {
      const li = document.createElement("li");
      li.className = "bulk-pick-item";
      const checked = bulkSelectedIds.indexOf(slot.id) >= 0;
      li.innerHTML =
        '<input type="checkbox" class="bulk-pick-item__check" data-bulk-slot-id="' +
        slot.id +
        '"' +
        (checked ? " checked" : "") +
        " />" +
        "<span>" +
        slotDisplayLabel(slot) +
        "</span>";
      const input = li.querySelector(".bulk-pick-item__check");
      li.addEventListener("click", function (ev) {
        if (ev.target === input) return;
        input.checked = !input.checked;
      });
      list.appendChild(li);
    });

    modal.hidden = false;
    document.body.classList.add("bulk-pick-modal-open");
  }

  function closeBulkPickModal() {
    const modal = document.getElementById("bulk-pick-modal");
    if (modal) modal.hidden = true;
    document.body.classList.remove("bulk-pick-modal-open");
  }

  function getBulkPickModalSelectedIds() {
    const list = document.getElementById("bulk-pick-list");
    if (!list) return [];
    const ids = [];
    list.querySelectorAll(".bulk-pick-item__check:checked").forEach(function (el) {
      const id = parseInt(el.getAttribute("data-bulk-slot-id"), 10);
      if (!Number.isNaN(id)) ids.push(id);
    });
    return ids;
  }

  function confirmBulkPick() {
    bulkSelectedIds = getBulkPickModalSelectedIds();
    if (!bulkSelectedIds.length) {
      alert("請至少揀選一位學生。");
      return;
    }
    bulkPickActive = true;
    closeBulkPickModal();
    closeAllQuickScoreMenus();
    updateBulkPickUI();
  }

  function cancelBulkPick() {
    bulkPickActive = false;
    bulkSelectedIds = [];
    closeBulkPickModal();
    updateBulkPickUI();
  }

  function toggleBulkSlot(slotId) {
    if (!bulkPickActive) return;
    const idx = bulkSelectedIds.indexOf(slotId);
    if (idx >= 0) {
      bulkSelectedIds.splice(idx, 1);
    } else {
      bulkSelectedIds.push(slotId);
    }
    if (!bulkSelectedIds.length) {
      bulkPickActive = false;
    }
    updateBulkPickUI();
  }

  function showBulkScoreToast(count, delta) {
    const toast = document.getElementById("score-toast");
    const textEl = document.getElementById("score-toast-text");
    if (!toast || !textEl) return;

    textEl.textContent =
      "已為 " + count + " 位學生各加" + formatScoreDelta(delta) + "！";

    if (scoreToastTimeoutId !== null) {
      clearTimeout(scoreToastTimeoutId);
    }
    toast.hidden = false;
    const card = toast.querySelector(".score-toast__card");
    if (card) {
      card.style.animation = "none";
      void card.offsetWidth;
      card.style.animation = "";
    }
    scoreToastTimeoutId = setTimeout(function () {
      toast.hidden = true;
      scoreToastTimeoutId = null;
    }, 2200);
  }

  function normalizeBulkSelectedIds() {
    const seen = {};
    bulkSelectedIds = bulkSelectedIds
      .map(function (id) {
        return parseInt(id, 10);
      })
      .filter(function (id) {
        if (Number.isNaN(id) || id < 1 || id > SLOT_COUNT || seen[id]) {
          return false;
        }
        seen[id] = true;
        return true;
      });
  }

  function applyBulkQuickScore(delta) {
    normalizeBulkSelectedIds();
    if (!bulkSelectedIds.length || !delta) return;

    let applied = 0;
    bulkSelectedIds.forEach(function (id) {
      const s = getSlotById(id);
      if (s) {
        s.score = clampScore(s.score + delta);
        applied += 1;
      }
    });
    if (!applied) {
      alert("找不到已揀選的學生資料，請重新揀選。");
      cancelBulkPick();
      return;
    }

    saveSlots();
    bulkSuccessIds = bulkSelectedIds.slice();
    if (bulkSuccessTimerId !== null) {
      clearTimeout(bulkSuccessTimerId);
    }
    bulkSuccessTimerId = setTimeout(function () {
      const ids = bulkSuccessIds.slice();
      bulkSuccessIds = [];
      ids.forEach(function (id) {
        const slot = getSlotById(id);
        if (slot) renderSlotElement(slot);
      });
      bulkSuccessTimerId = null;
    }, 850);

    bulkSelectedIds.forEach(function (id) {
      const slot = getSlotById(id);
      if (slot) renderSlotElement(slot);
    });
    renderGroupButtons();
    updateBulkPickUI();
    playScoreDing();
    showBulkScoreToast(applied, delta);
  }

  function onBulkScoreAction(defaultDelta) {
    if (!bulkSelectedIds.length) {
      cancelBulkPick();
      return;
    }
    applyBulkQuickScore(defaultDelta);
  }

  function initBulkUiBindings() {
    if (bulkUiBindingsDone) return;
    bulkUiBindingsDone = true;

    const btnBulkPick = document.getElementById("btn-bulk-pick");
    if (btnBulkPick) {
      btnBulkPick.addEventListener("click", function (ev) {
        ev.preventDefault();
        ev.stopPropagation();
        openBulkPickModal();
      });
    }

    const btnBulkConfirm = document.getElementById("btn-bulk-pick-confirm");
    if (btnBulkConfirm) {
      btnBulkConfirm.addEventListener("click", function (ev) {
        ev.preventDefault();
        confirmBulkPick();
      });
    }

    const btnBulkClose = document.getElementById("btn-bulk-pick-close");
    if (btnBulkClose) {
      btnBulkClose.addEventListener("click", function () {
        closeBulkPickModal();
      });
    }

    const btnBulkCancel = document.getElementById("btn-bulk-pick-cancel");
    if (btnBulkCancel) {
      btnBulkCancel.addEventListener("click", function (ev) {
        ev.preventDefault();
        cancelBulkPick();
      });
    }

    const btnBulkAll = document.getElementById("btn-bulk-select-all");
    if (btnBulkAll) {
      btnBulkAll.addEventListener("click", function () {
        document.querySelectorAll(".bulk-pick-item__check").forEach(function (el) {
          el.checked = true;
        });
      });
    }

    const btnBulkNone = document.getElementById("btn-bulk-select-none");
    if (btnBulkNone) {
      btnBulkNone.addEventListener("click", function () {
        document.querySelectorAll(".bulk-pick-item__check").forEach(function (el) {
          el.checked = false;
        });
      });
    }

    const bulkModal = document.getElementById("bulk-pick-modal");
    if (bulkModal) {
      bulkModal.addEventListener("click", function (ev) {
        if (ev.target === bulkModal) closeBulkPickModal();
      });
    }

    const btnAlarmClose = document.getElementById("btn-timer-alarm-close");
    if (btnAlarmClose) {
      btnAlarmClose.addEventListener("click", function () {
        stopTimerAlarmLoop();
        timerAlarmPlayed = true;
      });
    }
  }

  function ensureGroupPanel() {
    if (!gridEl || groupPanelInitialized) return;

    const panel = document.createElement("section");
    panel.id = "group-score-panel";
    panel.className = "group-score-panel";
    panel.setAttribute("aria-label", "組別加分");
    panel.innerHTML =
      '<div class="group-score-panel__bulk">' +
      '<button type="button" id="btn-bulk-pick" class="group-score-panel__bulk-btn" title="自由揀選學生批量加分">☑ 批量揀選</button>' +
      '<span id="bulk-pick-count" class="group-score-panel__bulk-count" hidden></span>' +
      "</div>" +
      '<div id="bulk-score-inline" class="group-score-panel__bulk-score" hidden>' +
      '<p id="bulk-score-inline-label" class="group-score-panel__bulk-score-label">已揀選 0 人</p>' +
      '<div id="bulk-score-inline-btns" class="group-score-panel__bulk-btns">' +
      '<button type="button" class="bulk-score-quick-btn" data-bulk-delta="1">+1</button>' +
      '<button type="button" class="bulk-score-quick-btn" data-bulk-delta="2">+2</button>' +
      '<button type="button" class="bulk-score-quick-btn" data-bulk-delta="3">+3</button>' +
      '<button type="button" class="bulk-score-quick-btn" data-bulk-delta="4">+4</button>' +
      '<button type="button" class="bulk-score-quick-btn" data-bulk-delta="5">+5</button>' +
      "</div>" +
      '<button type="button" id="btn-bulk-pick-cancel" class="group-score-panel__bulk-cancel">取消揀選</button>' +
      "</div>" +
      '<div class="group-score-panel__head">' +
      '<span class="group-score-panel__label">組別加分</span>' +
      '<button type="button" id="btn-group-manage" class="group-score-panel__manage" title="管理組別">⚙ 管理</button>' +
      "</div>" +
      '<div id="group-buttons" class="group-score-panel__buttons"></div>';

    gridEl.appendChild(panel);

    panel.querySelectorAll(".bulk-score-quick-btn").forEach(function (btn) {
      btn.addEventListener("click", function (ev) {
        ev.preventDefault();
        ev.stopPropagation();
        const delta = parseInt(btn.getAttribute("data-bulk-delta"), 10);
        if (!Number.isNaN(delta)) {
          onBulkScoreAction(delta);
        }
      });
    });

    document.getElementById("btn-group-manage").addEventListener("click", function () {
      if (!teacherMode && !ensureTeacherModeOn()) return;
      openGroupManageModal();
    });

    const modal = document.getElementById("group-manage-modal");
    if (modal) {
      modal.addEventListener("click", function (ev) {
        if (ev.target === modal) closeGroupManageModal();
      });
    }
    const btnClose = document.getElementById("btn-group-manage-close");
    if (btnClose) btnClose.addEventListener("click", closeGroupManageModal);
    const btnAdd = document.getElementById("btn-group-add");
    if (btnAdd) btnAdd.addEventListener("click", onAddGroup);

    groupPanelInitialized = true;
  }

  function renderGroupButtons() {
    const wrap = document.getElementById("group-buttons");
    if (!wrap) return;
    wrap.innerHTML = "";

    if (!groups.length) {
      const empty = document.createElement("p");
      empty.className = "group-score-panel__empty";
      empty.textContent = "尚無組別，請點「管理」新增";
      wrap.appendChild(empty);
      return;
    }

    groups.forEach(function (g) {
      const count = g.memberIds.length;
      const wrapItem = document.createElement("div");
      wrapItem.className = "group-btn-wrap";
      wrapItem.dataset.groupId = String(g.id);

      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "group-btn";
      btn.textContent = g.name + (count ? " (" + count + ")" : "");
      btn.title = count
        ? "為「" + g.name + "」" + count + " 位成員加分"
        : "此組尚無成員";
      if (!count) btn.classList.add("is-empty");
      btn.addEventListener("click", function (ev) {
        ev.stopPropagation();
        onGroupButtonClick(g.id);
      });

      const quickMenu = document.createElement("div");
      quickMenu.className = "group-score-quick-menu";
      quickMenu.setAttribute("role", "menu");
      QUICK_ADD_VALUES.forEach(function (delta) {
        const qb = document.createElement("button");
        qb.type = "button";
        qb.className = "group-score-quick-btn";
        qb.textContent = "+" + delta;
        qb.setAttribute("role", "menuitem");
        qb.addEventListener("click", function (ev) {
          ev.stopPropagation();
          applyGroupQuickScore(g.id, delta);
        });
        quickMenu.appendChild(qb);
      });
      const menuOpen = activeGroupScoreMenuId === g.id && !teacherMode;
      quickMenu.classList.toggle("is-open", menuOpen);
      quickMenu.setAttribute("aria-hidden", menuOpen ? "false" : "true");

      wrapItem.appendChild(btn);
      wrapItem.appendChild(quickMenu);
      wrap.appendChild(wrapItem);
    });
  }

  function openGroupManageModal() {
    const modal = document.getElementById("group-manage-modal");
    if (!modal) return;
    renderGroupManageList();
    modal.hidden = false;
    document.body.classList.add("group-manage-open");
  }

  function closeGroupManageModal() {
    const modal = document.getElementById("group-manage-modal");
    if (modal) modal.hidden = true;
    document.body.classList.remove("group-manage-open");
    renderGroupButtons();
  }

  function renderGroupManageList() {
    const list = document.getElementById("group-manage-list");
    if (!list) return;
    list.innerHTML = "";

    if (!groups.length) {
      const li = document.createElement("li");
      li.className = "group-manage-item";
      li.textContent = "尚無組別";
      list.appendChild(li);
      return;
    }

    groups.forEach(function (g) {
      const li = document.createElement("li");
      li.className = "group-manage-item";
      li.innerHTML =
        '<span class="group-manage-item__name">' +
        g.name +
        "</span>" +
        '<span class="group-manage-item__count">' +
        g.memberIds.length +
        " 人</span>";
      const btnRename = document.createElement("button");
      btnRename.type = "button";
      btnRename.className = "group-manage-item__btn group-manage-item__btn--rename";
      btnRename.textContent = "改名";
      btnRename.addEventListener("click", function () {
        onRenameGroup(g.id);
      });
      const btnDelete = document.createElement("button");
      btnDelete.type = "button";
      btnDelete.className = "group-manage-item__btn group-manage-item__btn--delete";
      btnDelete.textContent = "刪除";
      btnDelete.addEventListener("click", function () {
        onDeleteGroup(g.id);
      });
      li.appendChild(btnRename);
      li.appendChild(btnDelete);
      list.appendChild(li);
    });

    const btnAdd = document.getElementById("btn-group-add");
    if (btnAdd) btnAdd.disabled = groups.length >= MAX_GROUPS;
  }

  function onAddGroup() {
    if (groups.length >= MAX_GROUPS) {
      alert("最多只能建立 " + MAX_GROUPS + " 個組別。");
      return;
    }
    const nameInput = prompt("請輸入新組別名稱：", "組別 " + (groups.length + 1));
    if (nameInput === null) return;
    const name = nameInput.trim() || "組別 " + (groups.length + 1);
    groups.push({ id: nextGroupId(), name: name, memberIds: [] });
    saveGroups();
    renderGroupManageList();
    renderGroupButtons();
  }

  function onRenameGroup(groupId) {
    const g = getGroupById(groupId);
    if (!g) return;
    const input = prompt("請輸入新的組別名稱：", g.name);
    if (input === null) return;
    g.name = input.trim() || g.name;
    saveGroups();
    renderGroupManageList();
    renderGroupButtons();
  }

  function onDeleteGroup(groupId) {
    const g = getGroupById(groupId);
    if (!g) return;
    if (!confirm('確定要刪除組別「' + g.name + '」嗎？')) return;
    groups = groups.filter(function (x) {
      return x.id !== groupId;
    });
    saveGroups();
    renderGroupManageList();
    renderGroupButtons();
  }

  function assignSlotToGroup(slotId) {
    if (!groups.length) {
      alert("尚無組別，請先點「組別加分」旁的「管理」新增組別。");
      return;
    }

    const lines = groups.map(function (g, idx) {
      return idx + 1 + " = " + g.name + "（" + g.memberIds.length + " 人）";
    });
    const menu =
      "請選擇要加入的組別：\n" +
      lines.join("\n") +
      "\n\n0 = 不加入任何組別\n" +
      "（輸入組別編號）";
    const raw = prompt(menu, "1");
    if (raw === null) return;

    const n = parseInt(raw, 10);
    if (Number.isNaN(n) || n < 0 || n > groups.length) {
      alert("請輸入有效編號。");
      return;
    }

    groups.forEach(function (g) {
      g.memberIds = g.memberIds.filter(function (id) {
        return id !== slotId;
      });
    });

    if (n === 0) {
      saveGroups();
      alert(slotId + " 號已移出所有組別。");
      return;
    }

    const target = groups[n - 1];
    if (target.memberIds.indexOf(slotId) < 0) {
      target.memberIds.push(slotId);
    }
    saveGroups();
    renderGroupButtons();
    alert(slotId + " 號已加入「" + target.name + "」。");
  }

  function closeGroupQuickScoreMenu() {
    if (activeGroupScoreMenuId === null) return;
    activeGroupScoreMenuId = null;
    renderGroupButtons();
  }

  function applyGroupScoreDelta(group, delta) {
    if (!group || !delta) return;
    group.memberIds.forEach(function (id) {
      const s = getSlotById(id);
      if (s) s.score = clampScore(s.score + delta);
    });
    saveSlots();
    renderAll();
    playScoreDing();
    showGroupScoreToast(group, delta);
  }

  function onGroupButtonClick(groupId) {
    const group = getGroupById(groupId);
    if (!group) return;
    if (!group.memberIds.length) {
      alert(
        "「" +
          group.name +
          "」目前沒有成員，請先在教師模式下指定學生加入組別。"
      );
      return;
    }

    if (teacherMode) {
      closeGroupQuickScoreMenu();
      closeQuickScoreMenu();
      const raw = prompt(
        "要為「" + group.name + "」全組加幾分？（可輸入正負整數，0 取消）",
        "1"
      );
      if (raw === null) return;
      const delta = parseInt(raw, 10);
      if (!Number.isFinite(delta) || delta === 0) {
        if (raw !== "0") alert("請輸入非 0 的整數。");
        return;
      }
      applyGroupScoreDelta(group, delta);
      return;
    }

    closeQuickScoreMenu();
    if (activeGroupScoreMenuId === groupId) {
      activeGroupScoreMenuId = null;
    } else {
      activeGroupScoreMenuId = groupId;
    }
    renderGroupButtons();
  }

  function applyGroupQuickScore(groupId, delta) {
    const group = getGroupById(groupId);
    if (!group || !group.memberIds.length) return;
    activeGroupScoreMenuId = null;
    applyGroupScoreDelta(group, delta);
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
    return document.querySelector('.slot[data-slot-id="' + slotId + '"]');
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

  function buildLuckyWinnerRow(slot) {
    const row = document.createElement("div");
    row.className = "lucky-winner-row";

    const nameCol = document.createElement("div");
    nameCol.className = "lucky-winner-row__name";
    nameCol.innerHTML =
      '<span class="lucky-winner-row__slot-num">第 ' +
      slot.id +
      " 號</span>" +
      '<span class="lucky-winner-row__student">' +
      (slot.name || DEFAULT_NAME) +
      "</span>";

    const beastCol = document.createElement("div");
    beastCol.className = "lucky-winner-row__beast";

    if (slot.hatched) {
      const mv = document.createElement("model-viewer");
      mv.className = "lucky-winner-row__viewer";
      mv.src = "models/animal-" + slot.animal + ".glb";
      mv.alt = slot.name + " 的神獸";
      mv.setAttribute("autoplay", "");
      mv.setAttribute("auto-rotate", "");
      mv.setAttribute("rotation-per-second", "18deg");
      mv.setAttribute("camera-orbit", "0deg 75deg auto");
      mv.setAttribute("shadow-intensity", "0.85");
      mv.setAttribute("environment-image", "neutral");
      setViewerAnimation(mv, IDLE_ANIM);
      beastCol.appendChild(mv);
    } else {
      const egg = document.createElement("div");
      egg.className = "lucky-winner-row__egg";
      egg.style.setProperty("--egg-hue", String(eggHueForSlot(slot.id)));
      beastCol.appendChild(egg);
    }

    row.appendChild(nameCol);
    row.appendChild(beastCol);
    return row;
  }

  function showLuckyResultModal(winnerIds) {
    const modal = document.getElementById("lucky-result-modal");
    const bodyEl = document.getElementById("lucky-modal-body");
    if (!modal || !bodyEl) return;

    bodyEl.innerHTML = "";
    winnerIds.forEach(function (id) {
      const slot = getSlotById(id);
      if (!slot) return;
      bodyEl.appendChild(buildLuckyWinnerRow(slot));
    });

    modal.hidden = false;
    document.body.classList.add("lucky-modal-open");
  }

  function closeLuckyResultModal() {
    const modal = document.getElementById("lucky-result-modal");
    const bodyEl = document.getElementById("lucky-modal-body");
    if (bodyEl) bodyEl.innerHTML = "";
    if (modal) modal.hidden = true;
    document.body.classList.remove("lucky-modal-open");
    clearLuckyDrawVisuals();
  }

  function finishLuckyDraw(count) {
    stopLuckyDrawSuspense();
    luckyDrawRunning = false;
    document.body.classList.remove("lucky-draw-running");
    luckyDrawFlashId = null;

    luckyDrawWinnerIds = pickUniqueWinnerIds(count);
    refreshAllSlotDrawClasses();
    if (!FREESOUND_TOKEN) {
      playLuckyWinFanfare();
    }
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

    closeToolsSidebar();
    closeLuckyResultModal();
    clearLuckyDrawVisuals();
    getWebAudioContext();

    luckyDrawRunning = true;
    document.body.classList.add("lucky-draw-running");

    const btn = document.getElementById("btn-lucky-start");
    if (btn) {
      btn.disabled = true;
      btn.textContent = "✨ 抽籤中…";
    }

    const startedAt = Date.now();
    setLuckyDrawFlash(pickRandomSlotId());
    stopLuckyDrawSuspense();
    playLuckyDrawSound();
    if (!FREESOUND_TOKEN) {
      scheduleLuckyDrawSuspense(startedAt);
    }

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

    checkCountdownMinuteCues(ms);

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
      void startTimerAlarmLoop();
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
    stopTimerAlarmLoop();

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
      setupCountdownMinuteCues(countdownRemainingMs);
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
    stopTimerAlarmLoop();
    stopTimerLoop();
    countdownMinuteThresholds = [];
    countdownMinuteCuesPlayed = [];

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
    stopTimerAlarmLoop();
    stopTimerLoop();
    countdownMinuteThresholds = [];
    countdownMinuteCuesPlayed = [];
    updateTimerMinuteCueButtonUI();

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

    const minuteCueBtn = document.getElementById("btn-timer-minute-cue");
    if (minuteCueBtn) {
      minuteCueBtn.addEventListener("click", function () {
        timerMinuteCueEnabled = !timerMinuteCueEnabled;
        saveTimerMinuteCueSetting();
        updateTimerMinuteCueButtonUI();
      });
    }

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

    loadTimerMinuteCueSetting();
    updateTimerMinuteCueButtonUI();
    setTimerMode("stopwatch");
  }

  function renderSlotElement(slot) {
    let el = document.querySelector('.slot[data-slot-id="' + slot.id + '"]');
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

    const btnForceHatch = el.querySelector(".slot__teacher-btn--hatch");
    const btnForceEgg = el.querySelector(".slot__teacher-btn--egg");
    if (btnForceHatch) {
      btnForceHatch.onclick = function (ev) {
        ev.stopPropagation();
        ev.preventDefault();
        forceHatchSlot(slot.id);
      };
    }
    if (btnForceEgg) {
      btnForceEgg.onclick = function (ev) {
        ev.stopPropagation();
        ev.preventDefault();
        forceEggSlot(slot.id);
      };
    }

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
    el.classList.toggle(
      "slot--bulk-selected",
      bulkPickActive && bulkSelectedIds.indexOf(slot.id) >= 0
    );
    el.classList.toggle("slot--bulk-success", bulkSuccessIds.indexOf(slot.id) >= 0);
  }

  function renderAll() {
    if (!gridEl) return;
    slots.forEach(renderSlotElement);
    renderGroupButtons();
  }

  function closeQuickScoreMenu() {
    if (activeScoreMenuSlotId === null) return;
    const prev = getSlotById(activeScoreMenuSlotId);
    activeScoreMenuSlotId = null;
    if (prev) renderSlotElement(prev);
  }

  function closeAllQuickScoreMenus() {
    closeQuickScoreMenu();
    closeGroupQuickScoreMenu();
  }

  function applyQuickScore(slotId, delta) {
    const slot = getSlotById(slotId);
    if (!slot) return;
    slot.score = clampScore(slot.score + delta);
    saveSlots();
    activeScoreMenuSlotId = null;
    renderSlotElement(slot);
    playScoreDing();
    showScoreToast(slot, delta);
  }

  function forceHatchSlot(slotId) {
    if (!teacherMode && !ensureTeacherModeOn()) return;
    const slot = getSlotById(slotId);
    if (!slot) return;
    if (slot.hatched) {
      alert(slot.id + " 號「" + slot.name + "」已經孵化過了。");
      return;
    }
    slot.hatched = true;
    saveSlots();
    renderSlotElement(slot);
    playHatchSound();
    alert("⚡ 已強制孵化 " + slot.id + " 號「" + slot.name + "」！");
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
    closeAllQuickScoreMenus();
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
        "請輸入分數：\n" +
          "• 輸入 +20 或 -20：在目前分數上加減\n" +
          "• 只輸入數字（如 0）：直接設為該分數\n\n" +
          "目前分數：" +
          slot.score,
        String(slot.score)
      );
      if (input === null) return;
      const raw = input.trim();
      if (!raw) return;

      const oldScore = slot.score;
      let delta = 0;

      if (/^[+-]/.test(raw)) {
        const change = parseInt(raw, 10);
        if (Number.isNaN(change)) {
          alert("請輸入有效的加減分數字。");
          return;
        }
        if (change === 0) return;
        slot.score = clampScore(slot.score + change);
        delta = slot.score - oldScore;
      } else {
        const target = parseInt(raw, 10);
        if (Number.isNaN(target)) {
          alert("請輸入數字。");
          return;
        }
        slot.score = clampScore(target);
        delta = slot.score - oldScore;
      }

      if (delta === 0) {
        saveSlots();
        renderSlotElement(slot);
        return;
      }

      saveSlots();
      renderSlotElement(slot);
      playScoreDing();
      showScoreToast(slot, delta);
      return;
    }
    closeGroupQuickScoreMenu();
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
      "3 = 與其他號碼交換神獸物種\n" +
      "4 = 指定／變更組別";

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

    if (choice.trim() === "4") {
      assignSlotToGroup(slot.id);
      return;
    }

    alert("無效的操作編號。");
  }

  function onSlotClick(slotId) {
    const slot = getSlotById(slotId);
    if (!slot) return;

    if (bulkPickActive) {
      toggleBulkSlot(slotId);
      return;
    }

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
      playHatchSound();
      alert("🎉 " + slot.id + " 號 " + slot.name + " 的神獸孵化成功！");
    }
  }

  function boot() {
    if (!gridEl) return;
    if (!ensureSiteAccess()) return;

    loadSlots();
    loadGroups();

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
      if (activeScoreMenuSlotId !== null) {
        const current = document.querySelector(
          '.slot[data-slot-id="' + activeScoreMenuSlotId + '"]'
        );
        if (!current) {
          activeScoreMenuSlotId = null;
        } else if (!current.contains(ev.target)) {
          closeQuickScoreMenu();
        }
      }
      if (activeGroupScoreMenuId !== null) {
        const groupWrap = document.querySelector(
          '[data-group-id="' + activeGroupScoreMenuId + '"]'
        );
        if (!groupWrap) {
          activeGroupScoreMenuId = null;
        } else if (!groupWrap.contains(ev.target)) {
          closeGroupQuickScoreMenu();
        }
      }
    });

    renderAll();
    ensureGroupPanel();
    initBulkUiBindings();
    renderGroupButtons();
    startAnimationCycle();
  }

  boot();
})();
