import json
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / ".python-packages"))

from pypdf import PdfReader


PDF_PATH = Path("D:/Users/Desktop/中国计算机学会推荐国际学术会议和期刊目录第七版（2026年3月更新）.pdf")
ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "data" / "ccf-2026.js"

PUBLISHERS = [
    "ACM/USENIX",
    "IEEE/ACM",
    "IEEE/CVF",
    "CCF&IEEE",
    "ACM SIGPLAN",
    "ACM SIGOPS",
    "USENIX Association",
    "USENIX",
    "Springer Springer",
    "Springer",
    "Elsevier",
    "IEEE Computer Society",
    "IEEE",
    "ACM",
    "AAAI",
    "ACL",
    "SIAM",
    "MIT Press",
    "Morgan Kaufmann",
    "Wiley",
    "Oxford University Press",
    "Cambridge University Press",
    "IOS Press",
    "Oxford",
    "VLDB",
    "AAAI Press",
    "ACM Press",
    "IEEE Press",
    "Science China Press",
    "World Scientific",
    "CCF",
    "IET",
]

URL_RE = re.compile(r"https?://\S+")
RECORD_START_RE = re.compile(r"^\d+\s+")
CATEGORY_RE = re.compile(r"^[一二三]、\s*([ABC])\s*类")


def clean_text(value):
    return re.sub(r"\s+", " ", value.replace("\u3000", " ")).strip()


def strip_noise(line):
    line = clean_text(line)
    line = line.replace("https://dblp.uni- trier.de", "https://dblp.uni-trier.de")
    line = line.replace("http://dblp.uni- trier.de", "http://dblp.uni-trier.de")
    return line


def publisher_pattern():
    escaped = sorted((re.escape(x) for x in PUBLISHERS), key=len, reverse=True)
    return re.compile(r"\s+(" + "|".join(escaped) + r")\s*$", re.I)


PUB_RE = publisher_pattern()


def split_record(text, current):
    raw = clean_text(text)
    url_match = URL_RE.search(raw)
    url = url_match.group(0) if url_match else ""
    before_url = clean_text(raw[: url_match.start()] if url_match else raw)
    before_url = re.sub(r"^\d+\s+", "", before_url)

    publisher = ""
    pub_match = PUB_RE.search(before_url)
    if pub_match:
        publisher = clean_text(pub_match.group(1))
        before_url = clean_text(before_url[: pub_match.start()])

    canonical = before_url
    abbreviation, name = split_abbreviation(before_url)
    aliases = []
    for item in [abbreviation, name, canonical]:
        item = clean_text(item)
        if item and item not in aliases:
            aliases.append(item)

    if not name:
        name = abbreviation

    score = {"A": 10, "B": 8, "C": 5}.get(current["rank"], 0)
    return {
        "venue": name,
        "abbreviation": abbreviation,
        "aliases": aliases,
        "system": "CCF",
        "rank": current["rank"],
        "score": score,
        "type": current["type"],
        "field": current["field"],
        "publisher": publisher,
        "url": url,
    }


def split_abbreviation(value):
    value = clean_text(value)
    if not value:
        return "", ""

    tokens = value.split(" ")
    abbrev_parts = []
    rest_parts = []
    in_abbrev = True

    for index, token in enumerate(tokens):
        token_clean = token.strip()
        if (
            index > 0
            and abbrev_parts
            and (
                token_clean in {"ACM", "IEEE", "AAAI", "IEEE/CVF"}
                and abbrev_parts[0] != token_clean
                or token_clean == abbrev_parts[-1]
            )
        ):
            in_abbrev = False
            rest_parts.append(token_clean)
            continue
        if in_abbrev and looks_like_abbrev(token_clean, index):
            abbrev_parts.append(token_clean)
            continue
        in_abbrev = False
        rest_parts.append(token_clean)

    if not abbrev_parts:
        return "", value

    abbreviation = clean_text(" ".join(abbrev_parts))
    name = clean_text(" ".join(rest_parts))
    if not name:
        return "", abbreviation
    return abbreviation, name


def looks_like_abbrev(token, index):
    token = token.strip("()")
    if not token:
        return False
    if any(ch.isdigit() for ch in token):
        return len(token) <= 12
    if "-" in token or "+" in token:
        return len(token) <= 18
    if token.isupper() and len(token) <= 14:
        return True
    if index == 0 and re.fullmatch(r"[A-Z][A-Za-z]*", token) and len(token) <= 14:
        return True
    return False


def extract_records():
    reader = PdfReader(str(PDF_PATH))
    current = {"type": "", "field": "", "rank": ""}
    records = []
    buffer = ""

    for page in reader.pages:
        text = page.extract_text() or ""
        for raw_line in text.splitlines():
            line = strip_noise(raw_line)
            if not line:
                continue
            if "中国计算机学会推荐国际学术期刊" in line:
                current["type"] = "journal"
                continue
            if "中国计算机学会推荐国际学术会议" in line:
                current["type"] = "conference"
                continue
            cat = CATEGORY_RE.match(line)
            if cat:
                current["rank"] = cat.group(1)
                continue
            if line.startswith("序号 ") or line.startswith("***") or line == "中国计算机学会":
                continue
            if (
                line.startswith("（")
                and line.endswith("）")
                and "原 " not in line
                and "2022" not in line
                and "中国" not in line
                and "年" not in line
            ):
                current["field"] = line.strip("（）")
                continue

            if RECORD_START_RE.match(line):
                if buffer:
                    maybe_add_record(records, buffer, current)
                buffer = line
            elif buffer:
                buffer = f"{buffer} {line}"

            if buffer and URL_RE.search(buffer):
                maybe_add_record(records, buffer, current)
                buffer = ""

    if buffer:
        maybe_add_record(records, buffer, current)

    return dedupe(records)


def maybe_add_record(records, buffer, current):
    if not current["type"] or not current["rank"]:
        return
    record = split_record(buffer, current)
    if record["venue"] and record["rank"]:
        records.append(record)


def dedupe(records):
    seen = set()
    out = []
    for record in records:
        key = (record["type"], record["rank"], record["venue"].lower(), record["abbreviation"].lower())
        if key in seen:
            continue
        seen.add(key)
        out.append(record)
    return out


def main():
    records = extract_records()
    OUT.parent.mkdir(parents=True, exist_ok=True)
    payload = json.dumps(records, ensure_ascii=False, indent=2)
    OUT.write_text(f"self.SRF_CCF_2026 = {payload};\n", encoding="utf-8")

    by_type = {}
    for record in records:
        by_type.setdefault((record["type"], record["rank"]), 0)
        by_type[(record["type"], record["rank"])] += 1
    print(f"Wrote {len(records)} records to {OUT}")
    for key in sorted(by_type):
        print(f"{key[0]} {key[1]}: {by_type[key]}")


if __name__ == "__main__":
    main()
