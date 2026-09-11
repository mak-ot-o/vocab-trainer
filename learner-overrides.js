(() => {
  "use strict";

  const priorFetch = window.fetch.bind(window);
  const OVERRIDE_CANDIDATES = [
    "data/NGSL_learner_overrides.csv",
    "../../vocabulary/ngsl/NGSL_learner_overrides.csv"
  ];
  let overridePromise = null;

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
        if (row.some((value) => String(value).trim() !== "")) rows.push(row);
        row = [];
        cell = "";
      } else {
        cell += char;
      }
    }

    row.push(cell);
    if (row.some((value) => String(value).trim() !== "")) rows.push(row);
    return rows;
  }

  function csvEscape(value) {
    const text = String(value ?? "");
    return /[",\n\r]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
  }

  function serializeCsv(rows) {
    return rows.map((row) => row.map(csvEscape).join(",")).join("\n");
  }

  function isNgslRequest(url) {
    const path = new URL(url, window.location.href).pathname;
    return path.endsWith("/data/NGSL.csv") || path.endsWith("/areas/english/vocabulary/ngsl/NGSL.csv");
  }

  async function loadOverrideText() {
    if (!overridePromise) {
      overridePromise = (async () => {
        for (const candidate of OVERRIDE_CANDIDATES) {
          try {
            const response = await priorFetch(candidate, { cache: "no-store" });
            if (response.ok) return response.text();
          } catch {
            // Try the next canonical/distribution location.
          }
        }
        return "";
      })();
    }
    return overridePromise;
  }

  function applyOverrides(baseText, overrideText) {
    const baseRows = parseCsv(baseText);
    const overrideRows = parseCsv(overrideText);
    if (baseRows.length < 2 || overrideRows.length < 2) return baseText;

    const baseHeaders = baseRows[0].map(normalizeHeader);
    const rankIndex = baseHeaders.indexOf("rank");
    const wordIndex = baseHeaders.indexOf("word");
    const posIndex = baseHeaders.indexOf("part_of_speech");
    const japaneseIndex = baseHeaders.indexOf("japanese");
    if (rankIndex < 0 || wordIndex < 0 || posIndex < 0 || japaneseIndex < 0) return baseText;

    const overrideHeaders = overrideRows[0].map(normalizeHeader);
    const oRank = overrideHeaders.indexOf("rank");
    const oWord = overrideHeaders.indexOf("word");
    const oPos = overrideHeaders.indexOf("study_part_of_speech");
    const oJapanese = overrideHeaders.indexOf("japanese");
    if (oRank < 0 || oWord < 0 || oJapanese < 0) return baseText;

    const overrides = new Map();
    for (const row of overrideRows.slice(1)) {
      const rank = String(row[oRank] || "").trim();
      const word = String(row[oWord] || "").trim().toLowerCase();
      if (!rank || !word) continue;
      overrides.set(`${rank}::${word}`, {
        partOfSpeech: oPos >= 0 ? String(row[oPos] || "").trim().toLowerCase() : "",
        japanese: String(row[oJapanese] || "").trim()
      });
    }

    for (const row of baseRows.slice(1)) {
      const rank = String(row[rankIndex] || "").trim();
      const word = String(row[wordIndex] || "").trim().toLowerCase();
      const override = overrides.get(`${rank}::${word}`);
      if (!override) continue;
      if (override.partOfSpeech) row[posIndex] = override.partOfSpeech;
      if (override.japanese) row[japaneseIndex] = override.japanese;
    }

    return serializeCsv(baseRows);
  }

  window.fetch = async (input, init) => {
    const inputUrl = typeof input === "string"
      ? input
      : input instanceof Request
        ? input.url
        : String(input);
    const response = await priorFetch(input, init);
    if (!response.ok || !isNgslRequest(inputUrl)) return response;

    try {
      const baseText = await response.text();
      const overrideText = await loadOverrideText();
      const mergedText = overrideText ? applyOverrides(baseText, overrideText) : baseText;
      const headers = new Headers(response.headers);
      headers.set("Content-Type", "text/csv; charset=utf-8");
      headers.delete("Content-Length");
      return new Response(mergedText, {
        status: response.status,
        statusText: response.statusText,
        headers
      });
    } catch {
      return response;
    }
  };
})();
