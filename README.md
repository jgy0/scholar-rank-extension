# Scholar CCF Rank Filter

Scholar CCF Rank Filter is a local Chrome extension that annotates, filters, and sorts Google Scholar results with the CCF 2026 recommended journal and conference catalog.

It is designed for researchers who want to quickly spot whether a Google Scholar result appears in the CCF A/B/C list while scanning literature.

## What It Does

- Includes 678 records extracted from the CCF 2026 7th edition PDF.
- Shows `CCF-A`, `CCF-B`, or `CCF-C` badges next to matched Scholar results.
- Uses distinct badge colors:
  - `CCF-A`: red, highest priority.
  - `CCF-B`: orange, medium priority.
  - `CCF-C`: blue, lower priority.
- Filters by minimum rank, exact rank, and venue type.
- Sorts the current Scholar result page by ranking score.
- Allows extra JSON/CSV records for JCR, CAS, or local lab rules.

## Screenshots

Open Google Scholar after installing the extension. Matched search results will show ranking badges next to paper titles.

## Limits

- Google Scholar does not expose CCF/JCR/CAS rank fields, so matching is best-effort against the title and metadata text on the current page.
- The extension reorders only the current visible Scholar page. It does not crawl later pages.
- CAS/JCR data is not bundled. Add it through the options page if needed.

## Install

### Load Locally

1. Open `chrome://extensions/`.
2. Enable Developer mode.
3. Click "Load unpacked".
4. Select this directory: `scholar-rank-extension`.
5. Open or refresh Google Scholar.

### Use On Google Scholar

1. Search on Google Scholar as usual.
2. Use the toolbar inserted above the search results:
   - `Min rank`: show all results, CCF C+, CCF B+, or CCF A only.
   - `Exact`: show only CCF A, B, or C.
   - `Type`: show journals, conferences, or both.
   - `Sort by rank`: move higher ranked matches to the top of the current result page.
3. Click `Import extras` to add local JCR, CAS, or lab-specific ranking records.

## Extra CSV Format

The built-in CCF data is already enabled. Use CSV only for extra records.

```csv
venue,abbreviation,aliases,system,rank,score,type,field,note
Ocean Engineering,,Ocean Engineering,CAS,Large category 2 / small category 1,7,journal,engineering,Verify target-year CAS data
IEEE Transactions on Cybernetics,,T Cybernetics|IEEE T Cybernetics,JCR,Q1,10,journal,AI,Verify target-year JCR data
```

`aliases` are separated by `|`. Higher score sorts earlier.

## Built-in Score Rules

- CCF A: 10
- CCF B: 8
- CCF C: 5

## Project Structure

```text
scholar-rank-extension/
  manifest.json          Chrome extension manifest
  content.js             Google Scholar page matching/filtering logic
  content.css            Toolbar and badge styles
  options.html           Options page
  options.js             Extra ranking import logic
  data/ccf-2026.js       Built-in CCF 2026 records
  tools/extract_ccf.py   One-off PDF extraction script
```

## Notes On Data

The bundled CCF data was extracted from the CCF 2026 7th edition PDF provided by the project author. If you redistribute this repository publicly, make sure your use of the CCF catalog data complies with the original publisher's terms.

For lower redistribution risk, you can remove `data/ccf-2026.js` and use the options page to import a local ranking table instead.
