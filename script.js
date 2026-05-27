(function () {
  "use strict";

  const STORAGE_KEY = "classroom-dashboard-v1";
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
  // 低飽和、柔和深色漸層（莫蘭迪系），襯托 3D 模型細節
  const SLOT_GRADIENTS = [
    "linear-gradient(145deg, rgba(43, 61, 82, 0.82) 0%, rgba(26, 37, 51, 0.82) 100%)",
    "linear-gradient(145deg, rgba(42, 74, 63, 0.82) 0%, rgba(27, 47, 40, 0.82) 100%)",
    "linear-gradient(145deg, rgba(58, 63, 71, 0.82) 0%, rgba(36, 42, 49, 0.82) 100%)",
    "linear-gradient(145deg, rgba(74, 69, 56, 0.82) 0%, rgba(46, 43, 36, 0.82) 100%)",
    "linear-gradient(145deg, rgba(61, 53, 80, 0.82) 0%, rgba(37, 32, 51, 0.82) 100%)",
    "linear-gradient(145deg, rgba(51, 64, 85, 0.82) 0%, rgba(33, 40, 54, 0.82) 100%)",
    "linear-gradient(145deg, rgba(47, 74, 79, 0.82) 0%, rgba(29, 49, 53, 0.82) 100%)",
    "linear-gradient(145deg, rgba(63, 58, 74, 0.82) 0%, rgba(39, 35, 48, 0.82) 100%)",
    "linear-gradient(145deg, rgba(53, 66, 63, 0.82) 0%, rgba(34, 44, 41, 0.82) 100%)",
    "linear-gradient(145deg, rgba(74, 66, 56, 0.82) 0%, rgba(45, 40, 34, 0.82) 100%)",
    "linear-gradient(145deg, rgba(62, 58, 50, 0.82) 0%, rgba(38, 35, 30, 0.82) 100%)",
    "linear-gradient(145deg, rgba(74, 58, 53, 0.82) 0%, rgba(44, 33, 30, 0.82) 100%)",
  ];

  const gridEl = document.getElementById("dashboard-grid");
  const btnTeacherMode = document.getElementById("btn-teacher-mode");

  let slots = [];
  let teacherMode = false;
  let animCycleTimeoutId = null;
  let activeScoreMenuSlotId = null;

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
  }

  function forceHatchSlot(slotId) {
    if (!teacherMode && !ensureTeacherModeOn()) return;
    const slot = getSlotById(slotId);
    if (!slot) return;
    slot.hatched = true;
    saveSlots();
    renderSlotElement(slot);
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
      if (!s.emoji) s.emoji = DEFAULT_EMOJI;
      if (typeof s.score !== "number") s.score = 0;
    });
    saveSlots();

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
