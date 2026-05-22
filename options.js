const STORAGE_KEY = "srfRecords";

const sampleRecords = [
  {
    venue: "IEEE Transactions on Cybernetics",
    abbreviation: "",
    aliases: ["T Cybernetics", "IEEE T Cybernetics"],
    system: "JCR",
    rank: "Q1",
    score: 10,
    type: "journal",
    field: "custom",
    note: "Replace with verified target-year data"
  },
  {
    venue: "Your Custom Conference",
    abbreviation: "YCC",
    aliases: ["YCC", "Your Custom Conference"],
    system: "LOCAL",
    rank: "A",
    score: 10,
    type: "conference",
    field: "custom",
    note: "Optional override/addition"
  }
];

const textarea = document.querySelector("#records");
const statusEl = document.querySelector("#status");

init();

async function init() {
  const stored = await chrome.storage.local.get(STORAGE_KEY);
  textarea.value = JSON.stringify(stored[STORAGE_KEY] || sampleRecords, null, 2);

  document.querySelector("#save").addEventListener("click", save);
  document.querySelector("#sample").addEventListener("click", () => {
    textarea.value = JSON.stringify(sampleRecords, null, 2);
    setStatus("Sample records inserted. Click Save to apply.");
  });
  document.querySelector("#clear").addEventListener("click", async () => {
    await chrome.storage.local.remove(STORAGE_KEY);
    textarea.value = JSON.stringify(sampleRecords, null, 2);
    setStatus("Local extra records cleared. Built-in CCF records remain enabled.");
  });
}

async function save() {
  try {
    const records = parseInput(textarea.value);
    validateRecords(records);
    await chrome.storage.local.set({ [STORAGE_KEY]: records });
    setStatus(`Saved ${records.length} extra records. Refresh Google Scholar to apply.`);
  } catch (error) {
    setStatus(error.message, true);
  }
}

function parseInput(raw) {
  const text = raw.trim();
  if (!text) return [];
  if (text.startsWith("[") || text.startsWith("{")) {
    const parsed = JSON.parse(text);
    return Array.isArray(parsed) ? parsed : [parsed];
  }
  return parseCsv(text);
}

function parseCsv(text) {
  const lines = text.split(/\r?\n/).filter(Boolean);
  const header = splitCsvLine(lines.shift()).map((cell) => cell.trim());
  const required = ["venue", "system", "rank", "score"];
  for (const name of required) {
    if (!header.includes(name)) throw new Error(`CSV is missing column: ${name}`);
  }

  return lines.map((line) => {
    const cells = splitCsvLine(line);
    const row = Object.fromEntries(header.map((name, index) => [name, cells[index] || ""]));
    return {
      venue: row.venue.trim(),
      abbreviation: row.abbreviation?.trim() || "",
      aliases: row.aliases ? row.aliases.split("|").map((x) => x.trim()).filter(Boolean) : [],
      system: row.system.trim(),
      rank: row.rank.trim(),
      score: Number(row.score || 0),
      type: row.type?.trim() || "",
      field: row.field?.trim() || "",
      note: row.note?.trim() || ""
    };
  });
}

function splitCsvLine(line) {
  const cells = [];
  let current = "";
  let quoted = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    const next = line[i + 1];
    if (char === '"' && next === '"') {
      current += '"';
      i += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === "," && !quoted) {
      cells.push(current);
      current = "";
    } else {
      current += char;
    }
  }
  cells.push(current);
  return cells;
}

function validateRecords(records) {
  if (!Array.isArray(records)) throw new Error("The ranking table must be an array.");
  for (const [index, record] of records.entries()) {
    if (!record.venue) throw new Error(`Record ${index + 1} is missing venue.`);
    if (!Number.isFinite(Number(record.score))) throw new Error(`Record ${index + 1} has a non-numeric score.`);
    record.aliases = Array.isArray(record.aliases) ? record.aliases : [];
    record.score = Number(record.score);
  }
}

function setStatus(message, isError = false) {
  statusEl.textContent = message;
  statusEl.style.color = isError ? "#82071e" : "#116329";
}
