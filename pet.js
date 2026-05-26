(function () {
  "use strict";

  const DASHBOARD_STORAGE = "classroom-dashboard-v1";
  const SLOT_COUNT = 22;

  function getSlotIdFromUrl() {
    const n = parseInt(new URLSearchParams(window.location.search).get("slot"), 10);
    if (Number.isNaN(n) || n < 1 || n > SLOT_COUNT) return 0;
    return n;
  }

  const slotId = getSlotIdFromUrl();
  if (!slotId) {
    window.location.href = "index.html";
    return;
  }

  function getDashboardSlot() {
    try {
      const raw = localStorage.getItem(DASHBOARD_STORAGE);
      if (!raw) return null;
      const data = JSON.parse(raw);
      return (data.slots || []).find(function (s) {
        return s.id === slotId;
      });
    } catch (e) {
      return null;
    }
  }

  const dashSlot = getDashboardSlot();
  if (!dashSlot || !dashSlot.hatched) {
    alert("此學生尚未在總覽頁孵化，請先回全班總覽完成孵化！");
    window.location.href = "index.html";
    return;
  }

  const animalName = dashSlot.animal || "crab";
  const modelSrc = "models/animal-" + animalName + ".glb";

  function key(base) {
    return base + "-slot-" + slotId;
  }

  /* ── 常數 ── */
  const STORAGE = {
    score: key("language-energy-score"),
    hunger: key("pet-hunger"),
    energy: key("pet-energy"),
    knowledge: key("pet-knowledge"),
    hatched: key("pet-hatched"),
    scholar: key("pet-scholar-beast"),
    evoFlag: key("hasTriggeredEvo"),
  };

  const TEACHER_PASSWORD = "1234";
  const HATCH_THRESHOLD = 20;
  const EVOLUTION_THRESHOLD = 100;
  const LOW_STAT = 40;
  const HIGH_STAT = 70;
  const STAT_MAX = 100;

  const STUDY_REWARD = 10;
  const FEED_LANG_COST = 20;
  const FEED_HUNGER_GAIN = 30;
  const TRAIN_ENERGY_COST = 20;
  const TRAIN_KNOWLEDGE_GAIN = 25;

  const TICK_MS = 10000;
  const HUNGER_DECAY = 5;
  const ENERGY_DECAY = 3;

  const ANIM = {
    idle: "idle",
    eat: "eat",
    dance: "dance",
    walk: "walk",
    tired: "gesture-negative",
    happy: "gesture-positive",
  };

  const FEED_ANIM_MS = 2500;
  const TRAIN_ANIM_MS = 3000;
  const STUDY_ANIM_MS = 2500;

  const QUIZ_BANK = [
    {
      prompt: "「[ ]吞虎嚥」— 請選出正確的成語用字：",
      options: ["(1) 狼", "(2) 狗"],
      answer: 0,
      explain: "正確答案：狼吞虎嚥",
    },
    {
      prompt: "錯別字修正：「畫蛇[ ]足」應填入哪個字？",
      options: ["(1) 添", "(2) 天"],
      answer: 0,
      explain: "正確寫法：畫蛇添足",
    },
    {
      prompt: "「一[ ]莫展」— 請選出正確的成語用字：",
      options: ["(1) 籌", "(2) 愁"],
      answer: 0,
      explain: "正確答案：一籌莫展",
    },
  ];

  const MSG_NOT_ENOUGH =
    "語文能量不足喔！快去完成任務找老師加分吧！";

  /* ── DOM ── */
  const stageWrap = document.getElementById("stage-wrap");
  const stageBadge = document.getElementById("stage-badge");
  const stageStatus = document.getElementById("stage-status");
  const panelSubtitle = document.getElementById("panel-subtitle");
  const petStudentTitle = document.getElementById("pet-student-title");
  const viewer = document.getElementById("beast-viewer");

  const energyScoreEl = document.getElementById("energy-score");
  const hungerValueEl = document.getElementById("hunger-value");
  const energyValueEl = document.getElementById("energy-value");
  const knowledgeValueEl = document.getElementById("knowledge-value");
  const barLang = document.getElementById("bar-lang");
  const barHunger = document.getElementById("bar-hunger");
  const barEnergyStat = document.getElementById("bar-energy");
  const barKnowledge = document.getElementById("bar-knowledge");

  const btnStudy = document.getElementById("btn-study");
  const btnFeed = document.getElementById("btn-feed");
  const btnTrain = document.getElementById("btn-train");
  const btnSleep = document.getElementById("btn-sleep");
  const btnTeacher = document.getElementById("btn-teacher");
  const teacherTrigger = document.getElementById("teacher-trigger");
  const evoOverlay = document.getElementById("evo-overlay");
  const hatchOverlay = document.getElementById("hatch-overlay");
  const btnEvoClose = document.getElementById("btn-evo-close");
  const toastEl = document.getElementById("toast");
  const quizOverlay = document.getElementById("quiz-overlay");
  const quizTitle = document.getElementById("quiz-title");
  const quizOptions = document.getElementById("quiz-options");
  const btnQuizClose = document.getElementById("btn-quiz-close");

  /* ── 狀態 ── */
  let score = 0;
  let hunger = STAT_MAX;
  let energy = STAT_MAX;
  let knowledge = 0;
  let hatched = false;
  let isScholar = false;
  let hasTriggeredEvo = false;
  let isAsleep = false;
  let isAnimLocked = false;
  let animationTimerId = null;
  let currentQuiz = null;
  let toastTimerId = null;
  let tickIntervalId = null;
  let hatchOverlayTimerId = null;

  /* ── 儲存讀寫 ── */
  function loadInt(key, fallback) {
    const raw = localStorage.getItem(key);
    if (raw === null) return fallback;
    const n = parseInt(raw, 10);
    return Number.isNaN(n) ? fallback : n;
  }

  function loadBool(key) {
    return localStorage.getItem(key) === "1";
  }

  function saveAll() {
    localStorage.setItem(STORAGE.score, String(score));
    localStorage.setItem(STORAGE.hunger, String(hunger));
    localStorage.setItem(STORAGE.energy, String(energy));
    localStorage.setItem(STORAGE.knowledge, String(knowledge));
    localStorage.setItem(STORAGE.hatched, hatched ? "1" : "0");
    localStorage.setItem(STORAGE.scholar, isScholar ? "1" : "0");
    localStorage.setItem(STORAGE.evoFlag, hasTriggeredEvo ? "1" : "0");
  }

  function clampStat(v) {
    return Math.max(0, Math.min(STAT_MAX, v));
  }

  /* ── UI ── */
  function showToast(msg, type) {
    if (!toastEl) {
      alert(msg);
      return;
    }
    toastEl.textContent = msg;
    toastEl.hidden = false;
    toastEl.classList.remove("is-success");
    if (type === "success") toastEl.classList.add("is-success");
    toastEl.classList.add("is-visible");
    if (toastTimerId) clearTimeout(toastTimerId);
    toastTimerId = setTimeout(function () {
      toastEl.classList.remove("is-visible");
      setTimeout(function () {
        toastEl.hidden = true;
        toastTimerId = null;
      }, 350);
    }, 3200);
  }

  function setBarTier(barEl, value, max, useTierColors) {
    if (!barEl) return;
    const pct = Math.max(0, Math.min(100, (value / max) * 100));
    barEl.style.width = pct + "%";
    barEl.classList.remove("is-low", "is-mid", "is-high");
    if (!useTierColors) return;
    if (value < LOW_STAT) barEl.classList.add("is-low");
    else if (value > HIGH_STAT) barEl.classList.add("is-high");
    else barEl.classList.add("is-mid");
  }

  function isAnimationLocked() {
    return isAnimLocked || animationTimerId !== null;
  }

  function renderUI() {
    if (energyScoreEl) energyScoreEl.textContent = String(score);
    if (hungerValueEl) hungerValueEl.textContent = String(hunger);
    if (energyValueEl) energyValueEl.textContent = String(energy);
    if (knowledgeValueEl) knowledgeValueEl.textContent = String(knowledge);

    const langBarValue = Math.min(score, EVOLUTION_THRESHOLD);
    setBarTier(barLang, langBarValue, EVOLUTION_THRESHOLD, true);
    setBarTier(barHunger, hunger, STAT_MAX, true);
    setBarTier(barEnergyStat, energy, STAT_MAX, true);
    setBarTier(barKnowledge, knowledge, EVOLUTION_THRESHOLD, true);

    if (stageWrap) {
      stageWrap.classList.toggle("is-egg-mode", false);
      stageWrap.classList.toggle("is-sleeping", isAsleep && hatched);
    }

    if (viewer) {
      viewer.classList.toggle("is-scholar-beast", isScholar);
      if (hatched) {
        viewer.removeAttribute("data-egg-locked");
      }
    }

    if (petStudentTitle && dashSlot) {
      petStudentTitle.textContent =
        slotId + " 號 · " + (dashSlot.name || "待命名") + " 的神獸";
    }

    if (stageBadge) {
      if (!hatched) {
        stageBadge.textContent = "階段一：吸收語文能量中";
      } else if (isScholar) {
        stageBadge.textContent = "階段三：學霸神獸";
      } else {
        stageBadge.textContent = "階段二：幼體成長中";
      }
    }

    if (panelSubtitle) {
      if (!hatched) {
        panelSubtitle.textContent = "雙擊頂部老師後台加分，滿 20 分即可孵化";
      } else if (isScholar) {
        panelSubtitle.textContent = "已進化為學霸神獸，持續學習吧！";
      } else {
        panelSubtitle.textContent = "照顧飽食與精力，累積知識進化！";
      }
    }

    updateStageStatus();
    updateActionButtons();
    saveAll();
  }

  function updateStageStatus() {
    if (!stageStatus) return;
    stageStatus.classList.remove("is-calm");

    if (!hatched) {
      stageStatus.textContent =
        score < HATCH_THRESHOLD
          ? "🥚 蛋正在吸收語文能量…（需 " + HATCH_THRESHOLD + " 分孵化）"
          : "🥚 能量足夠，即將破殼！";
      return;
    }

    if (isAsleep) {
      stageStatus.textContent = "💤 正在呼呼大睡，精力恢復中…";
      stageStatus.classList.add("is-calm");
      return;
    }

    const msgs = [];
    if (hunger < LOW_STAT) msgs.push("肚子餓了！");
    if (energy < LOW_STAT) msgs.push("睏了！");

    if (msgs.length) {
      stageStatus.textContent = "⚠ " + msgs.join(" ");
    } else {
      stageStatus.textContent = "✨ 神獸狀態良好！";
      stageStatus.classList.add("is-calm");
    }
  }

  function updateActionButtons() {
    const juvenile = hatched;
    const locked = !juvenile;

    if (btnStudy) {
      btnStudy.disabled = isAsleep || isAnimationLocked();
    }

    [btnFeed, btnTrain, btnSleep].forEach(function (btn) {
      if (!btn) return;
      btn.disabled = locked || isAsleep || isAnimationLocked();
    });

    if (btnSleep && juvenile) {
      btnSleep.disabled = false;
      btnSleep.textContent = isAsleep
        ? "☀️ 起床"
        : "💤 睡覺（精力回滿）";
    }
  }

  /* ── 生命階段 ── */
  function showHatchOverlay() {
    if (!hatchOverlay) return;
    hatchOverlay.style.display = "flex";
    hatchOverlay.classList.add("is-visible");
    if (hatchOverlayTimerId) clearTimeout(hatchOverlayTimerId);
    hatchOverlayTimerId = setTimeout(hideHatchOverlay, 2800);
  }

  function hideHatchOverlay() {
    if (!hatchOverlay) return;
    hatchOverlay.style.display = "none";
    hatchOverlay.classList.remove("is-visible");
    hatchOverlayTimerId = null;
  }

  function hatch() {
    if (hatched) return;
    hatched = true;
    if (stageWrap) stageWrap.classList.remove("is-egg-mode");
    showHatchOverlay();
    showToast("🎉 破殼孵化！生理互動功能已解鎖！");
    renderUI();
    syncNeedAnimation();
  }

  function tryHatch() {
    if (!hatched && score >= HATCH_THRESHOLD) {
      hatch();
    }
  }

  function showEvolutionModal() {
    if (!evoOverlay) return;
    evoOverlay.style.display = "flex";
    evoOverlay.classList.add("is-visible");
    document.body.classList.add("evo-open");
  }

  function hideEvolutionModal() {
    if (!evoOverlay) return;
    evoOverlay.style.display = "none";
    evoOverlay.classList.remove("is-visible");
    document.body.classList.remove("evo-open");
    applyScholarBeast();
  }

  function applyScholarBeast() {
    isScholar = true;
    if (viewer) viewer.classList.add("is-scholar-beast");
    renderUI();
  }

  function tryTriggerEvolution(prevScore, prevKnowledge) {
    if (hasTriggeredEvo || !hatched) return;
    const scoreCross =
      prevScore < EVOLUTION_THRESHOLD && score >= EVOLUTION_THRESHOLD;
    const knowCross =
      prevKnowledge < EVOLUTION_THRESHOLD &&
      knowledge >= EVOLUTION_THRESHOLD;
    if (scoreCross || knowCross) {
      hasTriggeredEvo = true;
      saveAll();
      showEvolutionModal();
    }
  }

  function addKnowledge(amount, prevKnowledge) {
    const prev = prevKnowledge !== undefined ? prevKnowledge : knowledge;
    knowledge = Math.max(0, knowledge + amount);
    tryTriggerEvolution(score, prev);
    renderUI();
  }

  function applyScore(next, options) {
    const opts = options || {};
    const prev = score;
    score = Math.max(0, next);
    if (!opts.skipChecks) {
      tryHatch();
      if (!opts.skipEvo) {
        tryTriggerEvolution(prev, knowledge);
      }
    }
    renderUI();
  }

  /* ── 生理倒數 ── */
  function startStatTick() {
    if (tickIntervalId) clearInterval(tickIntervalId);
    tickIntervalId = setInterval(function () {
      if (!hatched || isAsleep) return;

      hunger = clampStat(hunger - HUNGER_DECAY);
      energy = clampStat(energy - ENERGY_DECAY);
      renderUI();
      if (!isAnimationLocked()) {
        syncNeedAnimation();
      }
    }, TICK_MS);
  }

  /* ── 3D 動畫 ── */
  function setViewerAnimation(name) {
    if (!viewer) return;
    const anim = name || ANIM.idle;
    try {
      viewer.animationName = anim;
      viewer.setAttribute("animation-name", anim);
    } catch (err) {
      console.warn("[動畫]", anim, err);
    }
  }

  function clearAnimTimer() {
    if (animationTimerId) {
      clearTimeout(animationTimerId);
      animationTimerId = null;
    }
    isAnimLocked = false;
  }

  function playTempAnimation(tempName, durationMs, thenSync) {
    if (!viewer || isAsleep) return;
    if (!hatched && tempName !== ANIM.happy && tempName !== ANIM.tired) return;

    clearAnimTimer();
    isAnimLocked = true;
    setViewerAnimation(tempName);
    updateActionButtons();

    animationTimerId = setTimeout(function () {
      animationTimerId = null;
      isAnimLocked = false;
      if (thenSync !== false && hatched && !isAsleep) {
        syncNeedAnimation();
      } else if (hatched && !isAsleep) {
        setViewerAnimation(ANIM.idle);
      }
      updateActionButtons();
    }, durationMs);
  }

  function syncNeedAnimation() {
    if (!hatched || isAsleep || isAnimationLocked()) return;

    if (hunger < LOW_STAT) {
      setViewerAnimation(ANIM.walk);
    } else if (energy < LOW_STAT) {
      setViewerAnimation(ANIM.tired);
    } else {
      setViewerAnimation(ANIM.idle);
    }
  }

  function wakeUp() {
    isAsleep = false;
    if (viewer) viewer.setAttribute("auto-rotate", "");
    syncNeedAnimation();
    renderUI();
  }

  function goToSleep() {
    isAsleep = true;
    clearAnimTimer();
    isAnimLocked = false;
    energy = STAT_MAX;
    if (viewer) {
      viewer.removeAttribute("auto-rotate");
      setViewerAnimation(ANIM.idle);
    }
    renderUI();
    showToast("💤 睡覺中…精力已回滿！點「起床」繼續玩。");
  }

  /* ── 互動 ── */
  function onFeed() {
    if (!hatched || isAsleep) return;
    if (score < FEED_LANG_COST) {
      showToast(MSG_NOT_ENOUGH);
      return;
    }
    applyScore(score - FEED_LANG_COST, { skipEvo: false });
    hunger = clampStat(hunger + FEED_HUNGER_GAIN);
    renderUI();
    playTempAnimation(ANIM.eat, FEED_ANIM_MS);
  }

  function onTrain() {
    if (!hatched || isAsleep) return;
    if (energy < TRAIN_ENERGY_COST) {
      showToast("精力不足，先睡覺補充精力再訓練吧！");
      return;
    }
    const prevKnow = knowledge;
    energy = clampStat(energy - TRAIN_ENERGY_COST);
    knowledge = Math.max(0, knowledge + TRAIN_KNOWLEDGE_GAIN);
    tryTriggerEvolution(score, prevKnow);
    renderUI();
    playTempAnimation(ANIM.dance, TRAIN_ANIM_MS);
    showToast("訓練完成！知識值 +" + TRAIN_KNOWLEDGE_GAIN);
  }

  function onSleepToggle() {
    if (!hatched) return;
    if (isAsleep) {
      wakeUp();
      showToast("☀️ 起床囉！");
    } else {
      goToSleep();
    }
  }

  /* ── 讀書學習測驗 ── */
  function pickRandomQuiz() {
    return QUIZ_BANK[Math.floor(Math.random() * QUIZ_BANK.length)];
  }

  function hideQuizModal() {
    if (!quizOverlay) return;
    quizOverlay.style.display = "none";
    quizOverlay.classList.remove("is-visible");
    currentQuiz = null;
  }

  function showQuizModal() {
    if (!quizOverlay || !quizTitle || !quizOptions) return;
    currentQuiz = pickRandomQuiz();
    quizTitle.textContent = currentQuiz.prompt;
    quizOptions.innerHTML = "";

    currentQuiz.options.forEach(function (label, index) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "quiz-option";
      btn.textContent = label;
      btn.addEventListener("click", function () {
        onQuizAnswer(index);
      });
      quizOptions.appendChild(btn);
    });

    quizOverlay.style.display = "flex";
    quizOverlay.classList.add("is-visible");
  }

  function onQuizAnswer(choiceIndex) {
    if (!currentQuiz) return;
    hideQuizModal();

    if (choiceIndex === currentQuiz.answer) {
      applyScore(score + STUDY_REWARD);
      showToast("答對了！語文能量 +" + STUDY_REWARD + " 分！", "success");
      if (hatched) {
        playTempAnimation(ANIM.happy, STUDY_ANIM_MS);
      } else {
        playTempAnimation(ANIM.happy, STUDY_ANIM_MS, false);
      }
    } else {
      showToast("答錯了～" + currentQuiz.explain);
      if (hatched) {
        playTempAnimation(ANIM.tired, STUDY_ANIM_MS);
      } else {
        playTempAnimation(ANIM.tired, STUDY_ANIM_MS, false);
      }
    }
  }

  function onStudy() {
    if (isAsleep) {
      showToast("小螃蟹正在睡覺，先起床再讀書吧！");
      return;
    }
    if (isAnimationLocked()) return;
    showQuizModal();
  }

  function openTeacherPanel() {
    const pwd = prompt("請輸入老師暗號：");
    if (pwd === null) return;
    if (pwd !== TEACHER_PASSWORD) {
      alert("暗號錯誤！");
      return;
    }

    const input = prompt("請輸入要增加的語文能量積分：");
    if (input === null) return;

    const add = parseInt(input, 10);
    if (Number.isNaN(add) || add <= 0) {
      alert("請輸入有效的正整數！");
      return;
    }

    const prevKnow = knowledge;
    applyScore(score + add);
    if (hatched) {
      addKnowledge(add, prevKnow);
    }
    alert(
      "已成功增加 " +
        add +
        " 分！目前語文能量：" +
        score +
        (hatched ? "，知識值：" + knowledge : "")
    );
  }

  /* ── 初始化 ── */
  function loadState() {
    score = loadInt(STORAGE.score, 0);
    hunger = clampStat(loadInt(STORAGE.hunger, STAT_MAX));
    energy = clampStat(loadInt(STORAGE.energy, STAT_MAX));
    knowledge = loadInt(STORAGE.knowledge, 0);
    hatched = loadBool(STORAGE.hatched);
    isScholar = loadBool(STORAGE.scholar);
    hasTriggeredEvo = loadBool(STORAGE.evoFlag);

    if ((score >= EVOLUTION_THRESHOLD || knowledge >= EVOLUTION_THRESHOLD) && !hasTriggeredEvo) {
      hasTriggeredEvo = true;
    }

    if (hasTriggeredEvo && !isScholar) {
      isScholar = true;
    }
  }

  function bindEvents() {
    if (btnStudy) btnStudy.addEventListener("click", onStudy);
    if (btnFeed) btnFeed.addEventListener("click", onFeed);
    if (btnTrain) btnTrain.addEventListener("click", onTrain);
    if (btnSleep) btnSleep.addEventListener("click", onSleepToggle);

    if (btnQuizClose) {
      btnQuizClose.addEventListener("click", hideQuizModal);
    }

    if (quizOverlay) {
      quizOverlay.addEventListener("click", function (e) {
        if (e.target === quizOverlay) hideQuizModal();
      });
    }

    if (btnTeacher) {
      btnTeacher.addEventListener("click", function () {
        showToast("雙擊畫面最上方進入老師後台（暗號 1234）");
      });
    }

    if (teacherTrigger) {
      teacherTrigger.addEventListener("dblclick", openTeacherPanel);
    }

    if (btnEvoClose) {
      btnEvoClose.addEventListener("click", function (e) {
        e.preventDefault();
        e.stopPropagation();
        hideEvolutionModal();
      });
    }

    if (evoOverlay) {
      evoOverlay.addEventListener("click", function (e) {
        if (e.target === evoOverlay) hideEvolutionModal();
      });
    }

    if (viewer) {
      viewer.addEventListener("load", function () {
        if (hatched) syncNeedAnimation();
        else setViewerAnimation(ANIM.idle);
      });
    }
  }

  function boot() {
    if (viewer) {
      viewer.src = modelSrc;
      viewer.alt = (dashSlot.name || "學生") + " 的神獸";
    }

    loadState();
    bindEvents();
    hideEvolutionModal();
    hideHatchOverlay();

    if (!hatched && score >= HATCH_THRESHOLD) {
      hatch();
    } else {
      renderUI();
    }

    startStatTick();

    if (hatched && !isAsleep) {
      syncNeedAnimation();
    } else if (viewer) {
      setViewerAnimation(ANIM.idle);
    }
  }

  boot();
})();
