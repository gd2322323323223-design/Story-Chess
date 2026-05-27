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
    "eat",
    "dance",
    "gesture-positive",
    "gesture-negative",
    "static",
  ];

  const gridEl = document.getElementById("dashboard-grid");
  const btnTeacherMode = document.getElementById("btn-teacher-mode");

  let slots = [];
  let teacherMode = false;
  let animCycleTimeoutId = null;

  function animalForSlot(id) {
    return ANIMALS[(id - 1) % ANIMALS.length];
  }

  function isValidAnimal(name) {
    return ANIMALS.indexOf(name) >= 0;
  }

  function eggHueForSlot(id) {
    return Math.round(((id - 1) / SLOT_COUNT) * 360);
  }

  function randomSlotGradient(id) {
    const baseHue = (id * 37) % 360;
    const h1 = baseHue;
    const h2 = (baseHue + 30) % 360;
    return (
      "linear-gradient(135deg," +
      " hsl(" +
      h1 +
      ", 55%, 20%)," +
      " hsl(" +
      h2 +
      ", 55%, 10%))"
    );
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
    const special = pickRandomSpecialAnimation();
    forEachHatchedViewer(function (mv) {
      setViewerAnimation(mv, special);
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
        '<div class="slot__stage"></div>' +
        '<div class="slot__footer">' +
        '  <button type="button" class="slot__footer-part slot__footer-part--emoji" aria-label="狀態表情"></button>' +
        '  <div class="slot__footer-part slot__footer-part--name"></div>' +
        '  <button type="button" class="slot__footer-part slot__footer-part--score" aria-label="得分"></button>' +
        "</div>";

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

    el.style.backgroundImage = randomSlotGradient(slot.id);

    el.classList.toggle("is-hatched", slot.hatched);
    el.querySelector(".slot__num").textContent = String(slot.id);

    const footerEmoji = el.querySelector(".slot__footer-part--emoji");
    const footerName = el.querySelector(".slot__footer-part--name");
    const footerScore = el.querySelector(".slot__footer-part--score");

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

  function ensureTeacherModeOn() {
    if (teacherMode) return true;
    const pwd = prompt("請輸入教師密碼：");
    if (pwd === null) return false;
    if (pwd !== TEACHER_PASSWORD) {
      alert("密碼錯誤。");
      return false;
    }
    teacherMode = true;
    document.body.classList.add("teacher-mode-active");
    if (btnTeacherMode) {
      btnTeacherMode.classList.add("is-active");
      btnTeacherMode.title = "教師模式（已開啟）";
    }
    alert("教師模式已開啟：點擊插槽底部可以管理表情與分數。");
    return true;
  }

  function toggleTeacherMode() {
    if (!teacherMode) {
      ensureTeacherModeOn();
      return;
    }
    teacherMode = false;
    document.body.classList.remove("teacher-mode-active");
    if (btnTeacherMode) {
      btnTeacherMode.classList.remove("is-active");
      btnTeacherMode.title = "教師模式";
    }
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

    const deltaStr = prompt(
      "快速加分：輸入 1～5 將 +1～+5 分（目前：" + slot.score + "）",
      "1"
    );
    if (deltaStr === null) return;
    const d = parseInt(deltaStr, 10);
    if (Number.isNaN(d) || d < 1 || d > 5) {
      alert("請輸入 1～5 之間的數字。");
      return;
    }
    slot.score = clampScore(slot.score + d);
    saveSlots();
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

    renderAll();
    startAnimationCycle();
  }

  boot();
})();
