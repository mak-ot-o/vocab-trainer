(() => {
  "use strict";

  const nativeFetch = window.fetch.bind(window);
  const ngslUrl = new URL("data/NGSL.csv", window.location.href).href;
  const chunkUrls = Array.from(
    { length: 29 },
    (_, index) => `data/chunks/${String(index + 1).padStart(3, "0")}.csv`
  );

  window.fetch = async (input, init) => {
    const inputUrl = typeof input === "string"
      ? input
      : input instanceof Request
        ? input.url
        : String(input);
    const resolvedUrl = new URL(inputUrl, window.location.href).href;

    if (resolvedUrl !== ngslUrl) {
      return nativeFetch(input, init);
    }

    try {
      const responses = await Promise.all(
        chunkUrls.map((url) => nativeFetch(url, { cache: "no-store" }))
      );

      if (responses.some((response) => !response.ok)) {
        throw new Error("One or more NGSL chunks could not be loaded.");
      }

      const chunks = await Promise.all(responses.map((response) => response.text()));
      return new Response(chunks.join("\n"), {
        status: 200,
        headers: { "Content-Type": "text/csv; charset=utf-8" }
      });
    } catch {
      return new Response("", { status: 503, statusText: "NGSL unavailable" });
    }
  };
})();
