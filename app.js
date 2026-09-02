(() => {
  "use strict";

  const STORAGE_KEYS = {
    words: "vocabTrainer.words.v1",
    results: "vocabTrainer.results.v1",
    sourceName: "vocabTrainer.sourceName.v1"
  };

  const LONG_PRESS_MS = 450;
  const SWIPE_X_THRESHOLD = 80;
  const SWIPE_UP_THRESHOLD = 80;
  const POS_PRIORITY = ["noun", "verb", "adjective", "adverb"];

  const state = {
    words: [],
    results: {},
    queue: [],
    currentIndex: 0,
    order: "frequency",
    partOfSpeech: "all",
    pointerId: null,
    startX: 0,
    startY: 0,
    currentX: 0,
    currentY: 0,
    dragging: false,
    longPressTimer: null,
    longPressTriggered: false
  };

  const els = {
    setupView: document.getElementById("setupView"),
    studyView: document.getElementById("studyView"),
    doneView: document.getElementById("doneView"),
    wordCount: document.getElementById("wordCount"),
    reviewedCount: document.getElementById("reviewedCount"),
    posFilter: document.getElementById("posFilter"),
    startButton: document.getElementById("startButton"),
    csvInput: document.getElementById("csvInput"),
    exportButton: document.getElementById("exportButton"),
    resetButton: document.getElementById("resetButton"),
    setupMessage: document.getElementById("setupMessage"),
    backButton: document.getElementById("backButton"),
    rankLabel: document.getElementById("rankLabel"),
    progressLabel: document.getElementById("progressLabel"),
    wordCard: document.getElementById("wordCard"),
    wordText: document.getElementById("wordText"),
    translationText: document.getElementById("translationText"),
    studyMessage: document.getElementById("studyMessage"),
    doneStats: document.getElementById("doneStats"),
    doneExportButton: document.getElementById("doneExportButton"),
    restartButton: document.getElementById("restartButton")
  };

  function normalizeHeader(value) {
    return String(value || "").trim().toLowerCase().replace(/^\ufeff/, "");
  }

  function parseCsv(text) {
    const rows = [];
    let row = [];
    let cell = "";
    let quoted = false;

    for (let i = 0; i < text.length; i += 1) {
      const char = text[i];
      const next = text[i + 1];

      if (char === '"' && quoted && next === '"') {
        cell += '"';
        i += 1;
      } else if (char === '"') {
        quoted = !quoted;
      } else if (char === "," && !quoted) {
        row.push(cell);
        cell = "";
      } else if ((char === "\n" || char === "\r") && !quoted) {
        if (char === "\r" && next === "\n") i += 1;
        row.push(cell);
        if (row.some((value) => value.trim() !== "")) rows.push(row);
        row = [];
        cell = "";
      } else {
        cell += char;
      }
    }

    row.push(cell);
    if (row.some((value) => value.trim() !== "")) rows.push(row);
    return rows;
  }

  function csvToWords(text) {
    const rows = parseCsv(text);
    if (rows.length < 2) throw new Error("CSV has no vocabulary rows.");

    const headers = rows[0].map(normalizeHeader);
    const rankIndex = headers.indexOf("rank");
    const wordIndex = headers.indexOf("word");
    const japaneseIndex = headers.indexOf("japanese");
    const partOfSpeechIndex = headers.indexOf("part_of_speech");

    if (rankIndex < 0 || wordIndex < 0 || japaneseIndex < 0) {
      throw new Error("CSV must contain rank, word, japanese columns.");
    }

    const words = rows.slice(1).map((row, index) => {
      const rank = Number.parseInt(String(row[rankIndex] || "").trim(), 10);
      const word = String(row[wordIndex] || "").trim();
      const japanese = String(row[japaneseIndex] || "").trim();
      const partOfSpeech = partOfSpeechIndex >= 0
        ? String(row[partOfSpeechIndex] || "").trim().toLowerCase()
        : "";
      return { rank, word, japanese, part_of_speech: partOfSpeech, sourceRow: index + 2 };
    }).filter((item) => Number.isFinite(item.rank) && item.word);

    const rankSet = new Set();
    const deduped = [];
    for (const item of words) {
      if (rankSet.has(item.rank)) continue;
      rankSet.add(item.rank);
      deduped.push(item);
    }

    if (!deduped.length) throw new Error("No valid vocabulary rows found.");
    return deduped.sort((a, b) => a.rank - b.rank);
  }

  function loadStoredState() {
    try {
      state.words = JSON.parse(localStorage.getItem(STORAGE_KEYS.words) || "[]");
      state.results = JSON.parse(localStorage.getItem(STORAGE_KEYS.results) || "{}");
    } catch {
      state.words = [];
      state.results = {};
    }
  }

  function getStoredSourceName() {
    return localStorage.getItem(STORAGE_KEYS.sourceName) || "";
  }

  function saveWords(sourceName) {
    localStorage.setItem(STORAGE_KEYS.words, JSON.stringify(state.words));
    localStorage.setItem(STORAGE_KEYS.sourceName, sourceName || "imported.csv");
  }

  function saveResults() {
    localStorage.setItem(STORAGE_KEYS.results, JSON.stringify(state.results));
  }

  function resultKey(word) {
    return `${word.rank}::${word.word.toLowerCase()}`;
  }

  function hasPartOfSpeechData(words = state.words) {
    return words.some((word) => String(word.part_of_speech || "").trim() !== "");
  }

  function formatPartOfSpeech(value) {
    return String(value || "").replace(/\b\w/g, (char) => char.toUpperCase());
  }

  function getPartOfSpeechCounts() {
    const counts = new Map();
    for (const word of state.words) {
      const partOfSpeech = String(word.part_of_speech || "").trim().toLowerCase();
      if (!partOfSpeech) continue;
      counts.set(partOfSpeech, (counts.get(partOfSpeech) || 0) + 1);
    }
    return counts;
  }

  function sortPartsOfSpeech(parts) {
    return [...parts].sort((a, b) => {
      const aPriority = POS_PRIORITY.indexOf(a);
      const bPriority = POS_PRIORITY.indexOf(b);
      const aRank = aPriority >= 0 ? aPriority : POS_PRIORITY.length;
      const bRank = bPriority >= 0 ? bPriority : POS_PRIORITY.length;
      return aRank - bRank || a.localeCompare(b);
    });
  }

  function updatePartOfSpeechOptions(resetSelection = false) {
    const counts = getPartOfSpeechCounts();
    const requested = resetSelection ? "all" : (state.partOfSpeech || els.posFilter.value || "all");
    els.posFilter.replaceChildren();

    const allOption = document.createElement("option");
    allOption.value = "all";
    allOption.textContent = `All (${state.words.length})`;
    els.posFilter.appendChild(allOption);

    for (const partOfSpeech of sortPartsOfSpeech(counts.keys())) {
      const option = document.createElement("option");
      option.value = partOfSpeech;
      option.textContent = `${formatPartOfSpeech(partOfSpeech)} (${counts.get(partOfSpeech)})`;
      els.posFilter.appendChild(option);
    }

    const availableValues = new Set([...els.posFilter.options].map((option) => option.value));
    state.partOfSpeech = availableValues.has(requested) ? requested : "all";
    els.posFilter.value = state.partOfSpeech;
  }

  function getSelectedWords() {
    if (state.partOfSpeech === "all") return state.words;
    return state.words.filter((word) => word.part_of_speech === state.partOfSpeech);
  }

  function getReviewedCount(words = getSelectedWords()) {
    return words.reduce((count, word) => count + (state.results[resultKey(word)] ? 1 : 0), 0);
  }

  function updateSetupStats() {
    const selectedWords = getSelectedWords();
    els.wordCount.textContent = String(selectedWords.length);
    els.reviewedCount.textContent = String(getReviewedCount(selectedWords));
    els.startButton.disabled = selectedWords.length === 0;
  }

  function showView(name) {
    els.setupView.hidden = name !== "setup";
    els.studyView.hidden = name !== "study";
    els.doneView.hidden = name !== "done";
  }

  function shuffled(items) {
    const copy = [...items];
    for (let i = copy.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  }

  function startStudy() {
    state.partOfSpeech = els.posFilter.value || "all";
    const selectedWords = getSelectedWords();
    if (!selectedWords.length) {
      els.setupMessage.textContent = "No words match the selected part of speech.";
      return;
    }

    state.order = document.querySelector('input[name="order"]:checked')?.value || "frequency";
    state.queue = state.order === "random"
      ? shuffled(selectedWords)
      : [...selectedWords].sort((a, b) => a.rank - b.rank);
    state.currentIndex = 0;
    els.setupMessage.textContent = "";
    els.studyMessage.textContent = "";
    showView("study");
    renderCard();
  }

  function currentWord() {
    return state.queue[state.currentIndex] || null;
  }

  function renderCard() {
    const word = currentWord();
    if (!word) {
      showDone();
      return;
    }

    els.rankLabel.textContent = `Rank ${word.rank}`;
    els.progressLabel.textContent = `${state.currentIndex + 1} / ${state.queue.length}`;
    els.wordText.textContent = word.word;
    els.translationText.textContent = word.japanese;
    hideTranslation();
    resetCardTransform();
  }

  function showTranslation() {
    els.translationText.classList.add("visible");
    els.translationText.setAttribute("aria-hidden", "false");
  }

  function hideTranslation() {
    els.translationText.classList.remove("visible");
    els.translationText.setAttribute("aria-hidden", "true");
  }

  function record(status) {
    const word = currentWord();
    if (!word) return;

    const key = resultKey(word);
    const previous = state.results[key] || {};
    state.results[key] = {
      status,
      last_reviewed: new Date().toISOString(),
      review_count: Number(previous.review_count || 0) + 1
    };
    saveResults();
  }

  function classifyAndAdvance(status, exitX, exitY, rotation) {
    record(status);
    els.wordCard.classList.remove("dragging");
    els.wordCard.style.transform = `translate3d(${exitX}px, ${exitY}px, 0) rotate(${rotation}deg)`;
    els.wordCard.style.opacity = "0";
    window.setTimeout(() => {
      state.currentIndex += 1;
      renderCard();
    }, 180);
  }

  function resetCardTransform() {
    els.wordCard.classList.remove("dragging");
    els.wordCard.style.transform = "translate3d(0,0,0) rotate(0deg)";
    els.wordCard.style.opacity = "1";
  }

  function clearLongPress() {
    if (state.longPressTimer) {
      window.clearTimeout(state.longPressTimer);
      state.longPressTimer = null;
    }
  }

  function onPointerDown(event) {
    if (!currentWord() || state.pointerId !== null) return;
    state.pointerId = event.pointerId;
    state.startX = event.clientX;
    state.startY = event.clientY;
    state.currentX = event.clientX;
    state.currentY = event.clientY;
    state.dragging = false;
    state.longPressTriggered = false;
    els.wordCard.setPointerCapture?.(event.pointerId);

    clearLongPress();
    state.longPressTimer = window.setTimeout(() => {
      state.longPressTriggered = true;
      showTranslation();
    }, LONG_PRESS_MS);
  }

  function onPointerMove(event) {
    if (event.pointerId !== state.pointerId) return;
    state.currentX = event.clientX;
    state.currentY = event.clientY;
    const dx = state.currentX - state.startX;
    const dy = state.currentY - state.startY;

    if (Math.hypot(dx, dy) > 10) {
      state.dragging = true;
      clearLongPress();
      if (!state.longPressTriggered) hideTranslation();
    }

    if (state.longPressTriggered) return;

    els.wordCard.classList.add("dragging");
    const rotation = Math.max(-10, Math.min(10, dx / 20));
    els.wordCard.style.transform = `translate3d(${dx}px, ${Math.min(dy, 30)}px, 0) rotate(${rotation}deg)`;
  }

  function finishPointer(event) {
    if (event.pointerId !== state.pointerId) return;
    clearLongPress();
    const dx = state.currentX - state.startX;
    const dy = state.currentY - state.startY;
    state.pointerId = null;

    if (state.longPressTriggered) {
      window.setTimeout(hideTranslation, 120);
      resetCardTransform();
      return;
    }

    if (dy <= -SWIPE_UP_THRESHOLD && Math.abs(dy) > Math.abs(dx) * 0.8) {
      classifyAndAdvance("unsure", dx * 2, -window.innerHeight, 0);
    } else if (dx <= -SWIPE_X_THRESHOLD) {
      classifyAndAdvance("known", -window.innerWidth, dy, -12);
    } else if (dx >= SWIPE_X_THRESHOLD) {
      classifyAndAdvance("unknown", window.innerWidth, dy, 12);
    } else {
      resetCardTransform();
    }
  }

  function cancelPointer(event) {
    if (event.pointerId !== state.pointerId) return;
    clearLongPress();
    state.pointerId = null;
    hideTranslation();
    resetCardTransform();
  }

  function csvEscape(value) {
    const text = String(value ?? "");
    return /[",\n\r]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
  }

  function exportResults() {
    if (!state.words.length) {
      els.setupMessage.textContent = "Import a vocabulary CSV first.";
      return;
    }

    const header = ["rank", "word", "japanese", "status", "last_reviewed", "review_count"];
    const lines = [header.join(",")];

    for (const word of [...state.words].sort((a, b) => a.rank - b.rank)) {
      const result = state.results[resultKey(word)] || {};
      lines.push([
        word.rank,
        word.word,
        word.japanese,
        result.status || "",
        result.last_reviewed || "",
        result.review_count || 0
      ].map(csvEscape).join(","));
    }

    const blob = new Blob(["\ufeff" + lines.join("\r\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    const date = new Date().toISOString().slice(0, 10);
    link.href = url;
    link.download = `vocab-results-${date}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  function showDone() {
    const counts = { known: 0, unknown: 0, unsure: 0 };
    for (const word of state.queue) {
      const status = state.results[resultKey(word)]?.status;
      if (status && Object.hasOwn(counts, status)) counts[status] += 1;
    }

    els.doneStats.innerHTML = [
      ["Known", counts.known],
      ["Unknown", counts.unknown],
      ["Unsure", counts.unsure]
    ].map(([label, count]) => `<div class="done-stat-row"><span>${label}</span><strong>${count}</strong></div>`).join("");
    updateSetupStats();
    showView("done");
  }

  async function importCsvFile(file) {
    if (!file) return;
    try {
      const text = await file.text();
      const words = csvToWords(text);
      state.words = words;
      state.partOfSpeech = "all";
      saveWords(file.name);
      saveResults();
      updatePartOfSpeechOptions(true);
      updateSetupStats();
      els.setupMessage.textContent = hasPartOfSpeechData(words)
        ? `Imported ${words.length} words from ${file.name}.`
        : `Imported ${words.length} words. No part_of_speech column was found, so only All is available.`;
    } catch (error) {
      els.setupMessage.textContent = error instanceof Error ? error.message : "Could not import CSV.";
    } finally {
      els.csvInput.value = "";
    }
  }

  async function loadDefaultCsvIfNeeded(forceReload = false) {
    if (state.words.length && !forceReload) return;

    const candidates = [
      { url: "data/NGSL.csv", name: "NGSL.csv" },
      { url: "data/sample.csv", name: "sample.csv" }
    ];

    for (const candidate of candidates) {
      try {
        const response = await fetch(candidate.url, { cache: "no-store" });
        if (!response.ok) continue;
        const text = await response.text();
        state.words = csvToWords(text);
        saveWords(candidate.name);
        return;
      } catch {
        // Try the next source; manual CSV import remains available.
      }
    }
  }

  function resetResults() {
    if (!window.confirm("Reset all saved vocabulary results?")) return;
    state.results = {};
    saveResults();
    updateSetupStats();
    els.setupMessage.textContent = "Results reset.";
  }

  function bindEvents() {
    els.startButton.addEventListener("click", startStudy);
    els.posFilter.addEventListener("change", () => {
      state.partOfSpeech = els.posFilter.value || "all";
      updateSetupStats();
      els.setupMessage.textContent = "";
    });
    els.csvInput.addEventListener("change", (event) => importCsvFile(event.target.files?.[0]));
    els.exportButton.addEventListener("click", exportResults);
    els.doneExportButton.addEventListener("click", exportResults);
    els.resetButton.addEventListener("click", resetResults);
    els.backButton.addEventListener("click", () => {
      updateSetupStats();
      showView("setup");
    });
    els.restartButton.addEventListener("click", () => showView("setup"));

    els.wordCard.addEventListener("pointerdown", onPointerDown);
    els.wordCard.addEventListener("pointermove", onPointerMove);
    els.wordCard.addEventListener("pointerup", finishPointer);
    els.wordCard.addEventListener("pointercancel", cancelPointer);
    els.wordCard.addEventListener("contextmenu", (event) => event.preventDefault());
  }

  async function init() {
    loadStoredState();
    const shouldRefreshStoredNgsl = state.words.length > 0
      && getStoredSourceName() === "NGSL.csv"
      && !hasPartOfSpeechData();
    await loadDefaultCsvIfNeeded(shouldRefreshStoredNgsl);
    updatePartOfSpeechOptions();
    bindEvents();
    updateSetupStats();
    showView("setup");

    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("service-worker.js").catch(() => {});
    }
  }

  init();
})();
