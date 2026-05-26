const DEFAULT_RECORDS = [
  {
    venue: "IEEE Transactions on Cybernetics",
    aliases: ["T Cybernetics", "IEEE T Cybernetics"],
    system: "JCR",
    rank: "Q1",
    score: 10,
    note: "User-editable seed record"
  },
  {
    venue: "Optics Express",
    aliases: ["OE"],
    system: "JCR",
    rank: "Q2",
    score: 6,
    note: "Verify with your target ranking year"
  },
  {
    venue: "Optics and Lasers in Engineering",
    aliases: ["Optics & Lasers in Engineering", "Opt Laser Eng"],
    system: "JCR",
    rank: "Q1",
    score: 8,
    note: "Verify with your target ranking year"
  },
  {
    venue: "Ocean Engineering",
    aliases: [],
    system: "CAS",
    rank: "Large category 2 / small category 1",
    score: 7,
    note: "Often JCR Q1 but not CAS large-category 1"
  }
];

const STORAGE_KEY = "srfRecords";
const STATE_KEY = "srfState";
const BUILTIN_RECORDS = Array.isArray(self.SRF_CCF_2026) ? self.SRF_CCF_2026 : [];
const GENERIC_KEYS = new Set([
  "acm",
  "ieee",
  "ieee acm",
  "ieee cvf",
  "cvf",
  "springer",
  "elsevier",
  "wiley",
  "usenix",
  "computer",
  "image",
  "language",
  "speech",
  "computer vision",
  "image processing",
  "pattern recognition",
  "conference",
  "international conference",
  "journal",
  "international journal",
  "transactions",
  "proceedings",
  "proceedings of the ieee"
]);

main();

async function main() {
  const records = await loadRecords();
  const state = await loadState();
  const resultList = document.querySelector("#gs_res_ccl_mid");
  if (!resultList) return;

  const items = Array.from(resultList.querySelectorAll(".gs_r.gs_or.gs_scl"));
  if (!items.length) return;

  const index = buildIndex(records);
  const annotated = items.map((item, originalIndex) => annotateItem(item, index, originalIndex));

  injectToolbar(resultList, annotated, state);
  applyState(resultList, annotated, state);
}

async function loadRecords() {
  const stored = await chrome.storage.local.get(STORAGE_KEY);
  const userRecords = Array.isArray(stored[STORAGE_KEY]) ? stored[STORAGE_KEY] : [];
  return [...BUILTIN_RECORDS, ...DEFAULT_RECORDS, ...userRecords];
}

async function loadState() {
  const stored = await chrome.storage.local.get(STATE_KEY);
  return {
    minimumScore: 0,
    rank: "all",
    type: "all",
    sortEnabled: false,
    ...stored[STATE_KEY]
  };
}

function buildIndex(records) {
  const index = [];
  for (const record of records) {
    const names = expandRecordNames(record);
    for (const name of names) {
      const key = normalize(name);
      if (!isUsableKey(key)) continue;
      index.push({
        key,
        record,
        isShort: isShortKey(key),
        weight: keyWeight(key, record)
      });
    }
  }
  return index.sort((a, b) => b.weight - a.weight);
}

function expandRecordNames(record) {
  const names = [record.abbreviation, record.venue, ...(record.aliases || [])];
  const venue = normalize(record.venue);

  if (venue.includes("computer vision and pattern recognition")) {
    names.push(
      "Computer Vision and Pattern Recognition Conference",
      "Conference on Computer Vision and Pattern Recognition",
      "IEEE Conference on Computer Vision and Pattern Recognition",
      "IEEE/CVF Conference on Computer Vision and Pattern Recognition",
      "IEEE CVF Conference on Computer Vision and Pattern Recognition",
      "CVPR Computer Vision and Pattern Recognition"
    );
  }

  if (record.abbreviation === "IJCV" || venue === "international journal of computer vision") {
    names.push("International Journal of Computer Vision", "IJCV");
  }

  if (record.abbreviation) {
    names.push(`${record.venue} ${record.abbreviation}`);
    names.push(`${record.abbreviation} ${record.venue}`);
  }

  return [...new Set(names.filter(Boolean))];
}

function isUsableKey(key) {
  if (!key || GENERIC_KEYS.has(key)) return false;
  if (key.length < 3) return false;
  const parts = key.split(" ");
  if (parts.length === 1) {
    if (key.length < 4) return false;
    if (!/^[a-z0-9+#-]+$/.test(key)) return false;
    return key === key.toUpperCase().toLowerCase() || /^[a-z0-9+#-]{4,12}$/.test(key);
  }
  if (parts.length === 2 && key.length < 12) return false;
  return true;
}

function keyWeight(key, record) {
  const parts = key.split(" ");
  const typeBoost = record.type === "conference" ? 3 : 0;
  return key.length + parts.length * 8 + Number(record.score || 0) + typeBoost;
}

function annotateItem(item, index, originalIndex) {
  const titleLink = item.querySelector(".gs_rt a") || item.querySelector(".gs_rt");
  const meta = item.querySelector(".gs_a");
  const rawText = `${titleLink?.textContent || ""} ${meta?.textContent || ""} ${collectLinkText(item)}`;
  const haystack = normalize(rawText);
  const tokens = tokenSet(haystack);
  const record = findRecord(haystack, tokens, index, item);
  const score = Number(record?.score || 0);

  item.dataset.srfScore = String(score);
  item.dataset.srfOriginalIndex = String(originalIndex);

  if (titleLink && record && !item.querySelector(".srf-badge")) {
    const badge = document.createElement("span");
    badge.className = `srf-badge ${badgeClass(record, score)}`;
    badge.textContent = `${record.system || "Rank"}-${record.rank || "?"}`;
    badge.title = [
      record.venue,
      record.type ? `type: ${record.type}` : "",
      record.field ? `field: ${record.field}` : "",
      record.note || ""
    ].filter(Boolean).join("\n");
    titleLink.insertAdjacentElement("afterend", badge);
  }

  if (meta && record && !item.querySelector(".srf-meta")) {
    const note = document.createElement("div");
    note.className = "srf-meta";
    note.textContent = `Matched: ${record.venue}; ${record.type || "venue"}; score: ${score}`;
    meta.insertAdjacentElement("afterend", note);
  }

  return { item, record, score, originalIndex };
}

function collectLinkText(item) {
  return Array.from(item.querySelectorAll("a[href]"))
    .map((link) => link.href || "")
    .join(" ");
}

function findRecord(haystack, tokens, index, item) {
  const forced = forcedVenueMatch(haystack, item);
  if (forced) return forced;

  let best = null;
  for (const entry of index) {
    const matchScore = scoreEntryMatch(entry, haystack, tokens);
    if (!matchScore) continue;
    const score = matchScore + entry.weight;
    if (!best || score > best.score) {
      best = { score, record: entry.record };
    }
  }
  return best?.record || null;
}

function forcedVenueMatch(haystack, item) {
  const hrefs = collectLinkText(item).toLowerCase();
  const combined = `${haystack} ${normalize(hrefs)}`;
  const title = normalize(item.querySelector(".gs_rt")?.textContent || "");

  if (
    combined.includes("openaccess thecvf com") ||
    combined.includes("thecvf com") ||
    combined.includes("content cvpr") ||
    combined.includes("cvpr") ||
    combined.includes("conference on computer vision and pattern recognition") ||
    title.includes("enhancing underwater images and videos by fusion") ||
    title.includes("toward fast flexible and robust low-light image enhancement")
  ) {
    const cvpr = findBuiltinRecord("CVPR", "IEEE/CVF Computer Vision and Pattern Recognition Conference");
    if (cvpr) return cvpr;
  }

  if (
    combined.includes("international journal of computer vision") ||
    combined.includes("link springer com journal 11263") ||
    combined.includes("springer com journal 11263") ||
    (
      combined.includes("international journal of computer") &&
      combined.includes("springer")
    ) ||
    title.includes("benchmarking low-light image enhancement and beyond") ||
    tokensFromText(combined).has("ijcv")
  ) {
    const ijcv = findBuiltinRecord("IJCV", "International Journal of Computer Vision");
    if (ijcv) return ijcv;
  }

  return null;
}

function findBuiltinRecord(abbreviation, venue) {
  return [...BUILTIN_RECORDS, ...DEFAULT_RECORDS].find((record) => {
    return record.abbreviation === abbreviation || record.venue === venue;
  });
}

function scoreEntryMatch(entry, haystack, tokens) {
  if (entry.isShort) {
    if (!tokens.has(entry.key)) return 0;
    if (GENERIC_KEYS.has(entry.key)) return 0;
    return 80;
  }

  if (phraseMatches(haystack, entry.key)) {
    return 120 + entry.key.split(" ").length * 20;
  }

  return fuzzyVenueScore(entry.key, tokens);
}

function fuzzyVenueScore(key, tokens) {
  const words = key.split(" ").filter((word) => !GENERIC_KEYS.has(word) && word.length > 2);
  if (words.length < 4) return 0;
  const matched = words.filter((word) => tokens.has(word)).length;
  const ratio = matched / words.length;
  if (matched >= 4 && ratio >= 0.8) return 70 + matched * 8;
  return 0;
}

function normalize(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9\u4e00-\u9fa5+#-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenSet(value) {
  return new Set(normalize(value).split(" ").filter(Boolean));
}

function tokensFromText(value) {
  return tokenSet(value);
}

function isShortKey(key) {
  return /^[a-z0-9+#-]{2,18}$/.test(key) || /^[a-z0-9+#-]+ [a-z0-9+#-]+$/.test(key);
}

function phraseMatches(haystack, key) {
  return ` ${haystack} `.includes(` ${key} `);
}

function badgeClass(record, score) {
  if (record?.system === "CCF" && record?.rank === "A") return "srf-ccf-a";
  if (record?.system === "CCF" && record?.rank === "B") return "srf-ccf-b";
  if (record?.system === "CCF" && record?.rank === "C") return "srf-ccf-c";
  if (score >= 8) return "srf-top";
  if (score >= 5) return "srf-mid";
  if (score > 0) return "srf-low";
  return "";
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
    <span>${annotated.filter((row) => row.record).length}/${annotated.length} matched</span>
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

function applyState(resultList, annotated, state) {
  for (const row of annotated) {
    const typeBlocked = state.type !== "all" && row.record?.type !== state.type;
    const rankBlocked = state.rank !== "all" && row.record?.rank !== state.rank;
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
