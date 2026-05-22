# Scholar Rank Extension English Docs

Scholar Rank Extension is a local Chrome extension for Google Scholar. It annotates, filters, and sorts search results with the CCF recommended journal and conference rankings.

The extension is useful when you are scanning literature and want to quickly check whether a result appears in the CCF A/B/C catalog.

## Features

- Includes 678 records extracted from the CCF 2026 7th edition catalog.
- Shows rank badges next to matched Google Scholar results:
  - `CCF-A`: red, highest priority.
  - `CCF-B`: orange, medium priority.
  - `CCF-C`: blue, lower priority.
- Filters results by rank: all, CCF C+, CCF B+, or CCF A.
- Filters by venue type: journal or conference.
- Sorts the current result page by ranking score.
- Supports extra local ranking records for JCR, CAS, or lab-specific rules.

## What It Looks Like

After installation, search on Google Scholar as usual. The extension adds `CCF-A`, `CCF-B`, or `CCF-C` badges next to matched result titles and inserts a filtering toolbar above the result list.

The extension only filters and sorts the current visible Google Scholar result page. It does not crawl later pages.

## Installation

### 1. Download The Project

Clone this repository:

```bash
git clone https://github.com/jgy0/scholar-rank-extension.git
```

Or click `Code` -> `Download ZIP` on GitHub and unzip the package.

### 2. Load The Extension In Chrome

1. Open Chrome.
2. Visit:

```text
chrome://extensions/
```

3. Enable `Developer mode`.
4. Click `Load unpacked`.
5. Select the project folder:

```text
scholar-rank-extension
```

6. Open or refresh Google Scholar.

## Usage

Open Google Scholar and search as usual, for example:

```text
underwater image polarization
```

The extension shows a toolbar above the search results:

| Control | Description |
| --- | --- |
| `Min rank` | Set the minimum rank, such as CCF B+ or CCF A only |
| `Exact` | Show only one exact rank, such as CCF A |
| `Type` | Show all venues, journals only, or conferences only |
| `Sort by rank` | Move higher-ranked matches to the top of the current page |
| `Import extras` | Import extra local ranking records |

## Import Extra Data

Built-in CCF 2026 data is enabled by default. You can add JCR, CAS, or lab-specific rules through `Import extras` with JSON or CSV.

CSV example:

```csv
venue,abbreviation,aliases,system,rank,score,type,field,note
Ocean Engineering,,Ocean Engineering,CAS,Large category 2 / small category 1,7,journal,engineering,Verify target-year CAS data
IEEE Transactions on Cybernetics,,T Cybernetics|IEEE T Cybernetics,JCR,Q1,10,journal,AI,Verify target-year JCR data
```

Field descriptions:

| Field | Description |
| --- | --- |
| `venue` | Full journal or conference name |
| `abbreviation` | Short name, such as CVPR, AAAI, or TOCS |
| `aliases` | Alternative names separated by `|` |
| `system` | Ranking system, such as CCF, JCR, CAS, or LOCAL |
| `rank` | Rank value, such as A, B, C, or Q1 |
| `score` | Sorting score. Higher values sort earlier |
| `type` | `journal` or `conference` |
| `field` | Research field |
| `note` | Optional notes |

## Built-in Score Rules

| Rank | Score |
| --- | --- |
| CCF A | 10 |
| CCF B | 8 |
| CCF C | 5 |

## Project Structure

```text
scholar-rank-extension/
  manifest.json          Chrome extension manifest
  content.js             Google Scholar matching/filtering/sorting logic
  content.css            Toolbar and badge styles
  options.html           Options page
  options.js             Extra ranking import logic
  data/ccf-2026.js       Built-in CCF 2026 records
  tools/extract_ccf.py   One-off PDF extraction script
```

## How It Works

Google Scholar does not provide CCF, JCR, or CAS ranking fields, and it does not expose an official rank-based sorting API.

This extension works by:

1. Reading the title and metadata text from the current Google Scholar result page.
2. Matching that text against the built-in CCF catalog.
3. Adding rank badges to matched results.
4. Hiding or reordering current-page results according to user settings.

Because matching is based on visible page text, a result may be unmatched or mismatched if Google Scholar does not show the complete venue name.

## Data Notes

The bundled CCF data was extracted from the CCF 2026 7th edition recommended journal and conference catalog and converted into local JSON data.

If you redistribute or republish this project, make sure your use of the CCF catalog data complies with the original publisher's terms.

For lower redistribution risk, remove:

```text
data/ccf-2026.js
```

Then use `Import extras` to import your own local ranking table.

## License

The project code is released under the MIT License. Rights to the bundled catalog data belong to the original publisher.
