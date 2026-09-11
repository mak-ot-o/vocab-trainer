(() => {
  "use strict";

  const DATA_VERSION_KEY = "vocabTrainer.ngslDataVersion.v1";
  const WORDS_KEY = "vocabTrainer.words.v1";
  const SOURCE_KEY = "vocabTrainer.sourceName.v1";
  const CURRENT_NGSL_DATA_VERSION = "ngsl-1.2-ja-pos-2026-09-12";

  const sourceName = localStorage.getItem(SOURCE_KEY) || "";
  const storedVersion = localStorage.getItem(DATA_VERSION_KEY) || "";

  if (sourceName === "NGSL.csv" && storedVersion !== CURRENT_NGSL_DATA_VERSION) {
    // Refresh vocabulary metadata/glosses only. Review results live under a separate key and are preserved.
    localStorage.removeItem(WORDS_KEY);
  }

  localStorage.setItem(DATA_VERSION_KEY, CURRENT_NGSL_DATA_VERSION);
})();
