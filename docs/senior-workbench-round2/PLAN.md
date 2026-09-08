# vNext Implementation Plan

## Phase 0 — Freeze

Baseline commit: `72d65255705ac0681a06dc993a47b50467a20c14` (v1.5.1).
実装時はmainが進んでいないか再確認する。

## Phase 1 — Senior UI foundation

共通の文字サイズ、タップ領域、カード余白、戻る/閉じる、横はみ出し防止を先に固定。AI/voice coreは触らない。

## Phase 2 — Target presets

1200/1600/2000/2400 + 標準/ローファット/筋肥大/ケトを追加。既存 `tf_tg` の `cal/p/f/c/mode/label` を利用し、新しいstorage schemaを増やさない。

## Phase 3 — Automatic alcohol presentation

recordの `A` を利用し、A>0の日だけ表示。栄養計算用の別酒モードを作らない。

## Phase 4 — Today record cards

食品名、量、kcal、P/F/C/A、修正、削除、Undoを高齢者向けに整理。

## Phase 5 — Favorites / Quick input

Food ID + いつもの量 + 使用回数 + 並び順。旧巨大DB画面ではなく現行Food Masterを検索正本にする。

## Phase 6 — History / Backup

既存storage keysとバックアップ互換を維持。

## Phase 7 — Statistics / Body

必要最小限のみ復元。写真は入れない。

## Phase 8 — Developer Manager

30/90日リアルデコイ、アルコール日、体重変動、isDummy削除。

## Phase 9 — Voice redesign

「ユーザーが送るまで録音」を保証するcapture方式を決めてから独立実装。SpeechRecognitionへの継ぎ足し修正は禁止。

## Merge gate

- syntax/import/export
- storage互換
- Food ID境界
- P/F/C/A計算
- 360〜430px幅
- 戻る/閉じる
- 既存履歴
- backup
- voice core非破壊
