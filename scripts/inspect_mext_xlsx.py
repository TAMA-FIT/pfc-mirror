#!/usr/bin/env python3
"""Inspect the official MEXT main-table XLSX using only the Python standard library."""
from __future__ import annotations

import sys
import zipfile
import xml.etree.ElementTree as ET
from pathlib import Path

NS = {"m": "http://schemas.openxmlformats.org/spreadsheetml/2006/main", "r": "http://schemas.openxmlformats.org/officeDocument/2006/relationships"}
PKG_REL = {"p": "http://schemas.openxmlformats.org/package/2006/relationships"}


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
    out = []
    for si in root.findall('m:si', NS):
        out.append(''.join(t.text or '' for t in si.iterfind('.//m:t', NS)))
    return out


def sheets(zf: zipfile.ZipFile) -> list[tuple[str, str]]:
    wb = ET.fromstring(zf.read('xl/workbook.xml'))
    rels = ET.fromstring(zf.read('xl/_rels/workbook.xml.rels'))
    rel_map = {r.attrib['Id']: r.attrib['Target'] for r in rels.findall('p:Relationship', PKG_REL)}
    out = []
    for s in wb.findall('m:sheets/m:sheet', NS):
        rid = s.attrib['{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id']
        target = rel_map[rid]
        if not target.startswith('xl/'):
            target = 'xl/' + target.lstrip('/')
        out.append((s.attrib['name'], target))
    return out


def row_values(zf: zipfile.ZipFile, sheet_path: str, shared: list[str], max_rows: int = 35) -> list[list[str]]:
    root = ET.fromstring(zf.read(sheet_path))
    rows = []
    for row in root.findall('.//m:sheetData/m:row', NS)[:max_rows]:
        vals: dict[int, str] = {}
        for c in row.findall('m:c', NS):
            ref = c.attrib.get('r', '')
            idx = col_index(ref)
            typ = c.attrib.get('t', '')
            v = c.find('m:v', NS)
            is_node = c.find('m:is', NS)
            raw = ''
            if typ == 'inlineStr' and is_node is not None:
                raw = ''.join(t.text or '' for t in is_node.iterfind('.//m:t', NS))
            elif v is not None and v.text is not None:
                raw = v.text
                if typ == 's':
                    try:
                        raw = shared[int(raw)]
                    except Exception:
                        pass
            vals[idx] = raw
        width = max(vals.keys(), default=-1) + 1
        rows.append([vals.get(i, '') for i in range(width)])
    return rows


def main() -> int:
    path = Path(sys.argv[1] if len(sys.argv) > 1 else 'mext.xlsx')
    with zipfile.ZipFile(path) as zf:
        ss = shared_strings(zf)
        sh = sheets(zf)
        print('SHEETS', sh)
        print('SHARED_STRINGS', len(ss))
        for name, target in sh:
            print(f'\n=== SHEET {name!r} {target} ===')
            for i, row in enumerate(row_values(zf, target, ss), start=1):
                print(f'{i:03d}: ' + ' | '.join(row[:30]))
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
