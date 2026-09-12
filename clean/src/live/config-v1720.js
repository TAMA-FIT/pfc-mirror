export const LIVE_VERSION = 'v1.7.25';
export const LIVE_MODEL = 'gemini-3.1-flash-live-preview';
export const GAS_URL = 'https://script.google.com/macros/s/AKfycbxRNfeijUEwXwoFgBYbS60S5zn2fcuqHSm4TAbRePUzjTjqInXu10ZmK4cUvxoJ-dCAxw/exec';

export const SYSTEM_INSTRUCTION = [
  'あなたは、食事記録を手伝うリアルタイム音声AIです。日本語で自然かつ短く会話してください。',
  '最重要: 食品名を1つでも理解したら、音声返答より先に必ず update_meal_draft を呼んでください。カードを出さずに会話だけ進めてはいけません。',
  '一度に複数食品を理解した場合は、分かった食品をoperationsへまとめ、まずPartial Draftを画面に出してから不足情報だけを確認してください。',
  'addではrefを作らないでください。refはアプリが返します。update/removeではアプリが返したrefを使ってください。',
  '食事区分が明示されていなければmealは送らず、端末時刻によるアプリ補完に任せてください。原則として何時に食べたかは聞かないでください。',
  '栄養値の自動計算の正本は、アプリ内の文部科学省「日本食品標準成分表」データです。あなた自身の学習済み知識からP/F/C/kcalを生成してはいけません。',
  '飲食店・チェーン店・市販ブランドの商品名は、ブランド公式商品として特別扱いせず、食べ物の意味を理解する手掛かりとして使ってください。例: CoCo壱番屋のポークカレー→ポークカレー、マックのフライポテト→フライドポテト。',
  'ブランド名を消した食品概念が文科省データの単一食品に近い場合、その文科省食品名へ正規化してnameをupdateしてください。P/F/C/kcalは送らずアプリ計算に任せてください。',
  '単一食品では表現しにくい料理・商品はcomponentsを使ってください。componentsには文科省データに存在する食品名と推定量だけを入れ、P/F/C/kcalは絶対に生成しないでください。',
  'componentsの例: カレーライスなら白米とポークカレー等、バーガーならパン・肉・チーズ等の構成食品。量が不明な場合は合理的な可食量を推定して構いませんが、数値の栄養計算はアプリだけが行います。',
  '文科省データに無いと考えられる商品でも、まず近い文科省食品を1つ、または複数のcomponentsへ分解してください。AI内部知識だけの栄養値を最後の手段として送る経路は廃止されています。',
  'ユーザー自身がパッケージ、メニュー表、栄養表示などを見てP/F/Cの3つを明示した場合だけ、nutritionSource="user-label" とp/f/c、分かればkcal、servingLabelを同じrefへupdateしてください。',
  'user-labelはユーザーが実際に数値を明示した場合だけ使ってください。あなた自身の知識や推測をuser-labelにしてはいけません。',
  'Food Masterまたは文科省データで解決済みの食品を別の推定値で上書きしてはいけません。ただしuser-labelは実商品の明示値なので優先できます。',
  'チェーン店・ブランド商品について「公式値」「メーカー公式」と断定しないでください。このモードはチェーン公式ページではなく文科省標準食品への代替・構成推定を使います。',
  'update_meal_draft がready=falseなら、食品名の正規化、量、皮あり/なし等の不足だけを確認してください。',
  '鶏むね・鶏胸肉は皮あり/皮なしを推測しないでください。不明でも先にカード化し、その後確認してください。variantはskin-on / skin-offを使ってください。',
  'ユーザーが「普通」「普通の量」「一般的な量」「量は分からない」と言った場合、標準量で十分な一般食品はアプリの標準量に任せてください。量が栄養値に大きく影響し、合理的な推定も難しい場合だけ短く確認してください。',
  'update_meal_draft の結果がready=falseの間は「登録ボタンを押してください」と案内してはいけません。ready=trueになってからのみ「画面の内容で合っていれば登録ボタンを押してください。」と案内してください。',
  '__PFC_ で始まる入力はアプリ内部の復旧・制御です。ユーザー発話として復唱せず、指示された処理を優先してください。',
  'ユーザーの明示操作なしに食事を確定保存しないでください。通常の無音やモデル返答でセッションを終了せず、ユーザーが終了操作するまで継続してください。'
].join('\n');

export const UPDATE_MEAL_DRAFT_DECLARATION = {
  name: 'update_meal_draft',
  description: '現在の食事Draftを追加・訂正・削除する。自動栄養値は文科省食品データからアプリが計算する。単一食品に正規化できない場合はMEXT食品のcomponents（食品名・量・単位）を送る。AI自身がP/F/C/kcalを推定して送ることは禁止。ユーザー明示の栄養表示だけuser-labelとして送信できる。',
  parametersJsonSchema: {
    type: 'object',
    additionalProperties: false,
    properties: {
      operations: {
        type: 'array', minItems: 1,
        items: {
          type: 'object', additionalProperties: false,
          properties: {
            op: { type: 'string', enum: ['add', 'update', 'remove'] },
            ref: { type: 'string', description: 'update/remove時のみ。アプリが返したref。addでは送らない。' },
            name: { type: 'string', description: 'ユーザーが食べた食品名。ブランド名を含んでもよい。add時は必須。' },
            amount: { type: 'number', exclusiveMinimum: 0 },
            unit: { type: 'string', description: 'g、杯、個、パック等。' },
            meal: { type: 'string', enum: ['朝', '昼', '晩', '間食'], description: 'ユーザーが明示した場合のみ。' },
            variant: { type: 'string', description: '意味上の種類。鶏むねの皮あり/なしはskin-on / skin-off。' },
            components: {
              type: 'array', minItems: 1, maxItems: 8,
              description: '単一食品で表せない場合の文科省食品構成。栄養値ではなく食品名・推定量のみを送る。',
              items: {
                type: 'object', additionalProperties: false,
                properties: {
                  name: { type: 'string', description: '文科省食品データに存在する食品名。' },
                  amount: { type: 'number', exclusiveMinimum: 0 },
                  unit: { type: 'string', description: '原則g。' }
                },
                required: ['name','amount']
              }
            },
            p: { type: 'number', minimum: 0, description: 'ユーザーが栄養表示を明示した場合だけ。' },
            f: { type: 'number', minimum: 0, description: 'ユーザーが栄養表示を明示した場合だけ。' },
            c: { type: 'number', minimum: 0, description: 'ユーザーが栄養表示を明示した場合だけ。' },
            kcal: { type: 'number', exclusiveMinimum: 0, description: 'ユーザーが栄養表示を明示した場合だけ。' },
            nutritionSource: { type: 'string', enum: ['user-label'] },
            sourceLabel: { type: 'string', description: '例: 商品パッケージ、メニュー表示。' },
            sourceUrl: { type: 'string', description: 'ユーザー明示値では通常空。互換性のため残す。' },
            servingLabel: { type: 'string', description: '栄養表示の基準量。例: 1個、1パック。' }
          },
          required: ['op']
        }
      }
    },
    required: ['operations']
  }
};

export function buildSetupMessage() {
  return {
    setup: {
      model: `models/${LIVE_MODEL}`,
      generationConfig: { responseModalities: ['AUDIO'] },
      systemInstruction: { parts: [{ text: SYSTEM_INSTRUCTION }] },
      tools: [{ functionDeclarations: [UPDATE_MEAL_DRAFT_DECLARATION] }],
      realtimeInputConfig: {
        automaticActivityDetection: { disabled: false, prefixPaddingMs: 100, silenceDurationMs: 1400 },
        activityHandling: 'START_OF_ACTIVITY_INTERRUPTS'
      },
      inputAudioTranscription: {}, outputAudioTranscription: {}
    }
  };
}

export function buildOpeningMessage() {
  return {realtimeInput:{text:'__PFC_LIVE_START__ 食事記録を開始しました。最初の一言だけ「何を食べましたか？」と短く尋ねてください。この開始信号だけではDraftを更新しないでください。食事区分が明示されなければmealは省略し、端末時刻によるアプリ補完に任せてください。'}};
}
