const STATE_KEY = "srfState";
const CACHE_PREFIX = "srfDblp:v2:";
const DBLP_APP_NAME = "ScholarRankExtension";
const NONE_RANK = "none";

main();

async function main() {
  const state = await loadState();
  if (location.pathname === "/citations") {
    runCitationsPage(state);
    return;
  }

  const resultList = document.querySelector("#gs_res_ccl_mid");
  if (!resultList) return;

  const items = Array.from(resultList.querySelectorAll(".gs_r.gs_or.gs_scl"));
  if (!items.length) return;

  const annotated = items.map((item, originalIndex) => createRow(item, originalIndex));
  injectToolbar(resultList, annotated, state);
  applyState(resultList, annotated, state);

  annotated.forEach((row, index) => {
    setTimeout(() => annotateRow(row, resultList, annotated, state), 120 * index);
  });
}

function runCitationsPage(state) {
  const tableBody = document.querySelector("#gsc_a_b");
  if (!tableBody) return;

  const annotate = () => {
    const rows = Array.from(tableBody.querySelectorAll("tr.gsc_a_tr"))
      .filter((item) => !item.dataset.srfQueued)
      .map((item, originalIndex) => {
        item.dataset.srfQueued = "1";
        return createCitationRow(item, originalIndex);
      });

    rows.forEach((row, index) => {
      setTimeout(() => annotateCitationRow(row), 120 * index);
    });
  };

  annotate();

  const observer = new MutationObserver(() => annotate());
  observer.observe(tableBody, { childList: true, subtree: true });
}

function createCitationRow(item, originalIndex) {
  const titleNode = item.querySelector("td.gsc_a_t a.gsc_a_at");
  const metaNodes = item.querySelectorAll("td.gsc_a_t .gs_gray");
  const authorLine = metaNodes[0]?.textContent || "";
  const venueLine = metaNodes[1]?.textContent || "";
  const yearNode = item.querySelector("td.gsc_a_y .gsc_a_h");
  const title = cleanTitle(titleNode?.textContent || "");
  const author = extractAuthor(authorLine);
  const year = extractYear(yearNode?.textContent || venueLine);

  return {
    item,
    titleNode,
    metaNode: metaNodes[1] || metaNodes[0] || titleNode,
    title,
    author,
    year,
    hrefs: collectLinkHrefs(item),
    rankInfo: null,
    score: 0,
    originalIndex
  };
}

async function annotateCitationRow(row) {
  if (!row.title || !row.titleNode) return;
  const rankInfo = await getRankForPaper(row.title, row.author, row.year, row.hrefs);
  row.rankInfo = rankInfo;
  row.score = rankToScore(rankInfo.rank);
  renderBadge(row);
  renderMeta(row);
}

async function loadState() {
  const stored = await chrome.storage.local.get(STATE_KEY);
  return {
    minimumScore: 0,
    rank: "all",
    type: "all",
    sortEnabled: false,
    showNone: true,
    ...stored[STATE_KEY]
  };
}

function createRow(item, originalIndex) {
  const titleNode = item.querySelector(".gs_rt a") || item.querySelector(".gs_rt");
  const metaNode = item.querySelector(".gs_a");
  const title = cleanTitle(titleNode?.textContent || "");
  const meta = metaNode?.textContent || "";
  const author = extractAuthor(meta);
  const year = extractYear(meta);

  return {
    item,
    titleNode,
    metaNode,
    title,
    author,
    year,
    hrefs: collectLinkHrefs(item),
    rankInfo: null,
    score: 0,
    originalIndex
  };
}

async function annotateRow(row, resultList, annotated, state) {
  if (!row.title || !row.titleNode) return;

  const rankInfo = await getRankForPaper(row.title, row.author, row.year, row.hrefs);
  row.rankInfo = rankInfo;
  row.score = rankToScore(rankInfo.rank);
  renderBadge(row);
  renderMeta(row);
  updateToolbar(annotated);
  applyState(resultList, annotated, state);
}

async function getRankForPaper(title, author, year, hrefs = "") {
  const forced = rankFromKnownLinks(title, hrefs);
  if (forced) return forced;

  const cacheKey = `${CACHE_PREFIX}${normalizeForCache(title)}:${author}:${year}`;
  const cached = await chrome.storage.local.get(cacheKey);
  if (cached[cacheKey]) return cached[cacheKey];

  const query = `${title} author:${author || ""}`.trim();
  const url = `https://dblp.org/search/publ/api?q=${encodeURIComponent(query)}&format=json&app=${DBLP_APP_NAME}`;

  try {
    const data = await fetchJsonViaBackground(url);
    const hit = chooseDblpHit(data?.result?.hits, title, year);
    const rankInfo = hit ? rankFromDblpHit(hit) : notFoundInfo();
    await chrome.storage.local.set({ [cacheKey]: rankInfo });
    return rankInfo;
  } catch (error) {
    return {
      rank: NONE_RANK,
      score: 0,
      venue: "DBLP lookup failed",
      type: "",
      source: "error",
      detail: String(error?.message || error)
    };
  }
}

function rankFromKnownLinks(title, hrefs) {
  const combined = `${title} ${hrefs}`.toLowerCase();

  if (
    combined.includes("dl.acm.org") &&
    (
      combined.includes("acm international conference on multimedia") ||
      combined.includes("international conference on multimedia") ||
      combined.includes("2964284.2967188")
    )
  ) {
    return rankFromCanonicalUrl("/conf/mm/mm", "known-link");
  }

  return null;
}

async function fetchJsonViaBackground(url) {
  const response = await chrome.runtime.sendMessage({ type: "srfFetchJson", url });
  if (!response?.ok) {
    throw new Error(response?.error || "Background fetch failed");
  }
  return response.data;
}

function chooseDblpHit(hits, title, year) {
  const total = Number(hits?.["@total"] || 0);
  const hitList = Array.isArray(hits?.hit) ? hits.hit : hits?.hit ? [hits.hit] : [];
  if (!total || !hitList.length) return null;
  if (hitList.length === 1) return hitList[0];

  let best = null;
  for (const hit of hitList) {
    const info = hit?.info || {};
    if (info.type === "Informal Publications") continue;

    const hitYear = Number(info.year || 0);
    const yearDelta = year && hitYear ? Math.abs(Number(year) - hitYear) : 0;
    if (year && hitYear && yearDelta > 1) continue;

    const titleScore = titleSimilarity(title, info.title || "");
    const yearScore = year ? Math.max(0, 30 - yearDelta * 20) : 0;
    const score = titleScore + yearScore;

    if (!best || score > best.score) {
      best = { hit, score };
    }
  }

  return best?.score >= 25 ? best.hit : null;
}

function rankFromDblpHit(hit) {
  const info = hit?.info || {};
  const recPath = dblpRecPath(info.url || "");
  const canonicalUrl = self.ccf?.rankDb?.[recPath];

  if (canonicalUrl) return rankFromCanonicalUrl(canonicalUrl, "dblp-url", info);

  const abbr = typeof info.number !== "undefined" && Number.isNaN(Number(info.number))
    ? String(info.number)
    : String(info.venue || "");
  const byAbbr = rankFromAbbreviation(abbr, info);
  if (byAbbr.rank !== NONE_RANK) return byAbbr;

  return notFoundInfo(info);
}

function rankFromCanonicalUrl(canonicalUrl, source, info = {}) {
  const rank = self.ccf?.rankUrl?.[canonicalUrl] || NONE_RANK;
  if (rank === NONE_RANK) return notFoundInfo(info);

  const fullName = self.ccf?.rankFullName?.[canonicalUrl] || info.venue || canonicalUrl;
  const abbreviation = self.ccf?.rankAbbrName?.[canonicalUrl] || "";

  return {
    rank,
    score: rankToScore(rank),
    venue: fullName,
    abbreviation,
    type: canonicalUrl.includes("/conf/") ? "conference" : "journal",
    source,
    dblpUrl: canonicalUrl
  };
}

function collectLinkHrefs(item) {
  return Array.from(item.querySelectorAll("a[href]"))
    .map((link) => link.href || "")
    .join(" ");
}

function rankFromAbbreviation(abbr, info = {}) {
  const full = self.ccf?.abbrFull?.[String(abbr || "").toUpperCase()];
  const canonicalUrl = full ? self.ccf?.fullUrl?.[full] : null;
  if (!canonicalUrl) return notFoundInfo(info);
  return rankFromCanonicalUrl(canonicalUrl, "dblp-abbr", info);
}

function notFoundInfo(info = {}) {
  return {
    rank: NONE_RANK,
    score: 0,
    venue: info.venue || "Not in CCF catalog",
    type: "",
    source: "none",
    dblpUrl: ""
  };
}

function dblpRecPath(url) {
  const marker = "/rec/";
  const markerIndex = url.indexOf(marker);
  if (markerIndex < 0) return "";
  const rec = url.slice(markerIndex + marker.length);
  const parts = rec.split("/");
  if (parts.length < 2) return "";
  return `/${parts[0]}/${parts[1]}`;
}

function renderBadge(row) {
  if (!row.titleNode || row.item.querySelector(".srf-badge")) return;

  const badge = document.createElement("span");
  badge.className = `srf-badge ${badgeClass(row.rankInfo.rank)}`;
  badge.textContent = row.rankInfo.rank === NONE_RANK ? "CCF None" : `CCF-${row.rankInfo.rank}`;
  badge.title = [
    row.rankInfo.venue,
    row.rankInfo.abbreviation ? `abbr: ${row.rankInfo.abbreviation}` : "",
    row.rankInfo.type ? `type: ${row.rankInfo.type}` : "",
    row.rankInfo.source ? `source: ${row.rankInfo.source}` : ""
  ].filter(Boolean).join("\n");

  row.titleNode.insertAdjacentElement("afterend", badge);
}

function renderMeta(row) {
  if (!row.metaNode || row.item.querySelector(".srf-meta")) return;
  if (row.rankInfo.rank === NONE_RANK) return;

  const note = document.createElement("div");
  note.className = "srf-meta";
  note.textContent = `Matched: ${row.rankInfo.venue}; ${row.rankInfo.type || "venue"}; score: ${row.score}`;
  row.metaNode.insertAdjacentElement("afterend", note);
}

function cleanTitle(value) {
  return String(value || "")
    .replace(/^\[[^\]]+\]\s*/i, "")
    .replace(/\s+/g, " ")
    .trim();
}

function extractAuthor(meta) {
  const authorPart = String(meta || "").split(" - ")[0] || "";
  const firstAuthor = authorPart.split(",")[0] || authorPart;
  const tokens = firstAuthor.trim().split(/\s+/).filter(Boolean);
  return tokens[tokens.length - 1] || "";
}

function extractYear(meta) {
  const match = String(meta || "").match(/\b(19|20)\d{2}\b/);
  return match ? Number(match[0]) : 0;
}

function titleSimilarity(left, right) {
  const a = significantWords(left);
  const b = significantWords(right);
  if (!a.size || !b.size) return 0;

  let matched = 0;
  for (const word of a) {
    if (b.has(word)) matched += 1;
  }
  return (matched / Math.max(a.size, b.size)) * 100;
}

function significantWords(value) {
  const stop = new Set(["a", "an", "and", "of", "the", "to", "for", "with", "via", "on", "in", "by"]);
  return new Set(
    String(value || "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .split(/\s+/)
      .filter((word) => word.length > 1 && !stop.has(word))
  );
}

function normalizeForCache(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120);
}

function rankToScore(rank) {
  if (rank === "A") return 10;
  if (rank === "B") return 8;
  if (rank === "C") return 5;
  return 0;
}

function badgeClass(rank) {
  if (rank === "A") return "srf-ccf-a";
  if (rank === "B") return "srf-ccf-b";
  if (rank === "C") return "srf-ccf-c";
  return "srf-ccf-none";
}

function injectToolbar(resultList, annotated, state) {
  if (document.querySelector(".srf-toolbar")) return;

  const toolbar = document.createElement("div");
  toolbar.className = "srf-toolbar";
  toolbar.innerHTML = `
    <strong>Scholar Rank Filter</strong>
    <label>Min rank
      <select data-srf-min>
        <option value="0">All</option>
        <option value="5">CCF C+</option>
        <option value="8">CCF B+</option>
        <option value="10">CCF A</option>
      </select>
    </label>
    <label>Exact
      <select data-srf-rank>
        <option value="all">All</option>
        <option value="A">A</option>
        <option value="B">B</option>
        <option value="C">C</option>
        <option value="none">None</option>
      </select>
    </label>
    <label>Type
      <select data-srf-type>
        <option value="all">All</option>
        <option value="journal">Journal</option>
        <option value="conference">Conference</option>
      </select>
    </label>
    <label>
      <input type="checkbox" data-srf-sort>
      Sort by rank
    </label>
    <button type="button" data-srf-options>Import extras</button>
    <span data-srf-count>${annotated.filter((row) => row.rankInfo && row.rankInfo.rank !== NONE_RANK).length}/${annotated.length} matched</span>
  `;

  resultList.insertAdjacentElement("beforebegin", toolbar);
  toolbar.querySelector("[data-srf-min]").value = String(state.minimumScore);
  toolbar.querySelector("[data-srf-rank]").value = state.rank || "all";
  toolbar.querySelector("[data-srf-type]").value = state.type || "all";
  toolbar.querySelector("[data-srf-sort]").checked = Boolean(state.sortEnabled);

  toolbar.addEventListener("change", async () => {
    state.minimumScore = Number(toolbar.querySelector("[data-srf-min]").value);
    state.rank = toolbar.querySelector("[data-srf-rank]").value;
    state.type = toolbar.querySelector("[data-srf-type]").value;
    state.sortEnabled = toolbar.querySelector("[data-srf-sort]").checked;
    await chrome.storage.local.set({ [STATE_KEY]: state });
    applyState(resultList, annotated, state);
  });

  toolbar.querySelector("[data-srf-options]").addEventListener("click", () => {
    chrome.runtime.openOptionsPage();
  });
}

function updateToolbar(annotated) {
  const count = document.querySelector("[data-srf-count]");
  if (!count) return;
  const done = annotated.filter((row) => row.rankInfo).length;
  const matched = annotated.filter((row) => row.rankInfo && row.rankInfo.rank !== NONE_RANK).length;
  count.textContent = `${matched}/${annotated.length} matched; ${done}/${annotated.length} checked`;
}

function applyState(resultList, annotated, state) {
  for (const row of annotated) {
    const rankInfo = row.rankInfo;
    const rank = rankInfo?.rank || NONE_RANK;
    const type = rankInfo?.type || "";
    const typeBlocked = state.type !== "all" && type !== state.type;
    const rankBlocked = state.rank !== "all" && rank !== state.rank;
    const scoreBlocked = row.score < state.minimumScore;
    row.item.classList.toggle("srf-hidden", scoreBlocked || typeBlocked || rankBlocked);
  }

  const sorted = [...annotated].sort((a, b) => {
    if (!state.sortEnabled) return a.originalIndex - b.originalIndex;
    return b.score - a.score || a.originalIndex - b.originalIndex;
  });

  for (const row of sorted) {
    resultList.appendChild(row.item);
  }
}
