#!/usr/bin/env python3
"""Build a compact browser runtime table from the official MEXT main-table XLSX.

Only the P/F/C/kcal fields needed by the PFC app are emitted. The source workbook
is the corrected Japan Standard Tables of Food Composition main table published
by MEXT. Values are per edible 100 g.

MEXT symbol handling:
- numeric and parenthesized numeric values -> numeric value
- Tr / (Tr) -> 0, with trace metadata counted in generated meta
- 0 / (0) -> 0
- '-' or blank -> missing; rows missing any kcal/P/F/C are excluded from automatic
  nutrition truth rather than silently treating an unmeasured component as zero.
"""
from __future__ import annotations

import json
import math
import re
import sys
import zipfile
import xml.etree.ElementTree as ET
from pathlib import Path

NS = {"m": "http://schemas.openxmlformats.org/spreadsheetml/2006/main"}
RNS = "http://schemas.openxmlformats.org/officeDocument/2006/relationships"
PKG_REL = {"p": "http://schemas.openxmlformats.org/package/2006/relationships"}
SOURCE_URL = "https://www.mext.go.jp/content/20260327-mxt_kagsei-mext-000029402_02.xlsx"
SOURCE_LABEL = "文部科学省 日本食品標準成分表（八訂）増補2023年・2026年3月27日訂正版"
CORRECTION_DATE = "2026-03-27"

# Fixed columns from MEXT sheet `表全体`, confirmed by component identifiers row 12.
COL_ITEM_NO = 1   # B 食品番号
COL_NAME = 3      # D 食品名
COL_KCAL = 6      # G ENERC_KCAL
COL_PROTEIN = 9   # J PROT-
COL_FAT = 12      # M FAT-
COL_CARBS = 20    # U CHOCDF-
DATA_START_ROW = 13


def col_index(ref: str) -> int:
    letters = ''.join(ch for ch in ref if ch.isalpha())
    n = 0
    for ch in letters:
        n = n * 26 + (ord(ch.upper()) - 64)
    return n - 1


def shared_strings(zf: zipfile.ZipFile) -> list[str]:
    try:
        root = ET.fromstring(zf.read('xl/sharedStrings.xml'))
    except KeyError:
        return []
    out: list[str] = []
    for si in root.findall('m:si', NS):
        out.append(''.join(t.text or '' for t in si.iterfind('.//m:t', NS)))
    return out


def sheet_path(zf: zipfile.ZipFile, wanted: str) -> str:
    wb = ET.fromstring(zf.read('xl/workbook.xml'))
    rels = ET.fromstring(zf.read('xl/_rels/workbook.xml.rels'))
    rel_map = {r.attrib['Id']: r.attrib['Target'] for r in rels.findall('p:Relationship', PKG_REL)}
    for s in wb.findall('m:sheets/m:sheet', NS):
        if s.attrib.get('name') != wanted:
            continue
        rid = s.attrib[f'{{{RNS}}}id']
        target = rel_map[rid]
        return target if target.startswith('xl/') else 'xl/' + target.lstrip('/')
    raise RuntimeError(f'sheet not found: {wanted}')


def cell_text(cell: ET.Element, shared: list[str]) -> str:
    typ = cell.attrib.get('t', '')
    if typ == 'inlineStr':
        node = cell.find('m:is', NS)
        return '' if node is None else ''.join(t.text or '' for t in node.iterfind('.//m:t', NS))
    v = cell.find('m:v', NS)
    if v is None or v.text is None:
        return ''
    raw = v.text
    if typ == 's':
        try:
            return shared[int(raw)]
        except Exception:
            return raw
    return raw


def iter_rows(zf: zipfile.ZipFile, path: str, shared: list[str]):
    # iterparse avoids holding the ~2500-row worksheet plus formatting in memory.
    with zf.open(path) as fh:
        for event, elem in ET.iterparse(fh, events=('end',)):
            if elem.tag != f'{{{NS["m"]}}}row':
                continue
            row_num = int(elem.attrib.get('r', '0') or 0)
            vals: dict[int, str] = {}
            for cell in elem.findall('m:c', NS):
                vals[col_index(cell.attrib.get('r', ''))] = cell_text(cell, shared)
            yield row_num, vals
            elem.clear()


def parse_component(raw: str) -> tuple[float | None, bool, bool]:
    """Return (value, trace, estimated). Missing/unmeasured returns None."""
    s = str(raw or '').strip().replace('−', '-').replace('―', '-').replace('ー', '-')
    if not s or s == '-':
        return None, False, False
    estimated = s.startswith('(') and s.endswith(')')
    core = s[1:-1].strip() if estimated else s
    if core.lower() == 'tr':
        return 0.0, True, estimated
    # Some spreadsheets expose values like '*', which mean a related calculation note,
    # not a numeric composition value. Treat those as unavailable.
    if core in {'*', '…', '...'}:
        return None, False, estimated
    try:
        value = float(core)
    except ValueError:
        return None, False, estimated
    if not math.isfinite(value):
        return None, False, estimated
    return value, False, estimated


def clean_number(value: float) -> int | float:
    if abs(value - round(value)) < 1e-10:
        return int(round(value))
    return round(value, 4)


def build_rows(xlsx: Path):
    all_count = 0
    usable_count = 0
    excluded_missing = 0
    trace_cells = 0
    estimated_cells = 0
    rows: list[list[object]] = []
    seen: set[str] = set()

    with zipfile.ZipFile(xlsx) as zf:
        shared = shared_strings(zf)
        path = sheet_path(zf, '表全体')
        for row_num, vals in iter_rows(zf, path, shared):
            if row_num < DATA_START_ROW:
                continue
            item_no = str(vals.get(COL_ITEM_NO, '')).strip()
            name = re.sub(r'\s+', ' ', str(vals.get(COL_NAME, '')).replace('\u3000', ' ')).strip()
            if not item_no or not name or not item_no.isdigit():
                continue
            all_count += 1
            if item_no in seen:
                raise RuntimeError(f'duplicate item number {item_no} at row {row_num}')
            seen.add(item_no)

            parsed = [
                parse_component(vals.get(COL_PROTEIN, '')),
                parse_component(vals.get(COL_FAT, '')),
                parse_component(vals.get(COL_CARBS, '')),
                parse_component(vals.get(COL_KCAL, '')),
            ]
            trace_cells += sum(1 for _, trace, _ in parsed if trace)
            estimated_cells += sum(1 for _, _, estimated in parsed if estimated)
            values = [x[0] for x in parsed]
            if any(v is None for v in values):
                excluded_missing += 1
                continue
            p, f, c, kcal = (clean_number(float(v)) for v in values)  # type: ignore[arg-type]
            rows.append([item_no.zfill(5), name, p, f, c, kcal])
            usable_count += 1

    rows.sort(key=lambda x: str(x[0]))
    meta = {
        'sourceLabel': SOURCE_LABEL,
        'sourceUrl': SOURCE_URL,
        'correctionDate': CORRECTION_DATE,
        'basis': 'per100g-edible-portion',
        'allFoodRows': all_count,
        'usableFoodRows': usable_count,
        'excludedMissingPfcOrKcal': excluded_missing,
        'traceCellsMappedToZero': trace_cells,
        'estimatedCellsAccepted': estimated_cells,
        'columns': {'itemNo': 'B', 'name': 'D', 'kcal': 'G', 'protein': 'J', 'fat': 'M', 'carbs': 'U'},
    }
    return rows, meta


def emit_js(rows: list[list[object]], meta: dict[str, object]) -> str:
    meta_json = json.dumps(meta, ensure_ascii=False, separators=(',', ':'))
    # One row per line keeps diffs inspectable while remaining compact enough for Pages.
    body = ',\n'.join(json.dumps(r, ensure_ascii=False, separators=(',', ':')) for r in rows)
    return (
        '// AUTO-GENERATED by scripts/build_mext_runtime.py from the official MEXT XLSX.\n'
        '// Do not hand-edit nutrition values in this file.\n'
        f'export const MEXT_FULL_META=Object.freeze({meta_json});\n'
        'export const MEXT_FULL_ROWS=Object.freeze([\n'
        f'{body}\n'
        '].map(row=>Object.freeze(row)));\n'
    )


def main() -> int:
    if len(sys.argv) < 3:
        print('usage: build_mext_runtime.py INPUT.xlsx OUTPUT.js', file=sys.stderr)
        return 2
    src = Path(sys.argv[1])
    dst = Path(sys.argv[2])
    rows, meta = build_rows(src)
    if len(rows) < 2000:
        raise RuntimeError(f'unsafe generated row count: {len(rows)}')
    dst.parent.mkdir(parents=True, exist_ok=True)
    dst.write_text(emit_js(rows, meta), encoding='utf-8')
    print(json.dumps(meta, ensure_ascii=False, indent=2))
    print(f'wrote {len(rows)} usable MEXT rows -> {dst}')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
