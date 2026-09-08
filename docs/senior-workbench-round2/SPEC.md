# PFC Mirror Senior — Product / UX Specification

Status: Draft
Baseline: production v1.5.1

## Product goal

高齢者でも迷わず、食べたものを話す・押すだけで記録できるPFCアプリにする。

基本経路:

`自然言語/音声 -> AI解釈 -> validated Food ID -> Food Master/MEXT -> deterministic P/F/C/A/kcal -> 確認 -> 登録`

AIは食品名・量・文脈・言い直し・修正・削除意図を理解するが、認識済み食品の栄養値を自由生成しない。

## 残す

- 現在の緑UI
- 現在の柔軟AI
- Food ID / Food Masterを栄養正本とする構造
- 目標プリセット
- PFCモード
- アルコール自動対応
- 手入力
- お気に入り / クイック入力
- 今日の記録
- 履歴
- 統計（簡潔）
- 体重 / 体脂肪 / ウエスト
- JSONバックアップ / 復元
- Developer Manager Mode

## 外す

- チートデイ
- ハイカーボ
- 献立ガチャ / 献立提案
- 食品カメラ / 成分表スキャナ
- 体型写真 / 写真アルバム
- 旧複雑AIコマンド体系
- 一般ユーザー向けManager UI
- 不要なAIモデル選択

## 目標設定

カロリープリセット:

- 1200 kcal — 女性小食
- 1600 kcal — 女性減量
- 2000 kcal — 男性減量
- 2400 kcal — 活動・増量

PFCモード:

- 標準 3:2:5
- ローファット 3:1:6
- 筋肥大 4:2:4
- ケト 3:6:1

P/F/Cグラムを通常ユーザーに直接入力させない。kcalとモードから自動計算する。

## アルコール

事前の「酒飲みモードON」を基本不要にする。

酒がFood IDへ解決され、recordの `A > 0` になった場合のみホーム/履歴にAを自動表示する。栄養値とkcalはFood Masterを正本とする。

## UI

- 本文16px以上を原則
- 主要数字24〜36px以上
- 主要ボタン高さ52px程度以上
- 押せる場所を見た目で明確にする
- 戻る != ホーム
- 開いた画面には必ず戻る/閉じる導線
- 横はみ出し禁止
- 誤削除Undoを優先

## Voice

現在の柔軟AI + Food ID構造は維持する。

Android ChromeがSpeechRecognitionをブラウザ都合で終了する問題は、局所的なrestartパッチを重ねず別タスクとしてキャプチャ方式を再設計する。このworkbenchではproduction voice codeを変更しない。

## Developer Manager

一般ユーザーには非表示。

- 30日 / 90日デコイ
- 日別kcal/P/F/Cの現実的な揺れ
- 少ない日 / 多い日
- アルコール日
- 食事抜け
- 体重の上下 / 停滞
- 全デコイに `isDummy:true`
- ダミーだけ一括削除
