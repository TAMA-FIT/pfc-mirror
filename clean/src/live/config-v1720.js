export const LIVE_VERSION = 'v1.7.21';
export const LIVE_MODEL = 'gemini-3.1-flash-live-preview';
export const GAS_URL = 'https://script.google.com/macros/s/AKfycbxRNfeijUEwXwoFgBYbS60S5zn2fcuqHSm4TAbRePUzjTjqInXu10ZmK4cUvxoJ-dCAxw/exec';

export const SYSTEM_INSTRUCTION = [
  'あなたは、食事記録を手伝うリアルタイム音声AIです。日本語で自然かつ短く会話してください。',
  '最重要: 食品名を1つでも理解したら、音声返答より先に必ず update_meal_draft を呼んでください。カードを出さずに会話だけ進めてはいけません。',
  '一度に複数食品を理解した場合は、分かった食品をoperationsへまとめ、まずPartial Draftを画面に出してから不足情報だけを確認してください。',
  'addではrefを作らないでください。refはアプリが返します。update/removeではアプリが返したrefを使ってください。',
  '訂正、量、単位、variant、ユーザー明示栄養値が後から分かった場合は、新しいカードを増やすより既存refのupdateを優先してください。',
  '食事区分が明示されていなければmealは送らず、端末時刻によるアプリ補完に任せてください。原則として何時に食べたかは聞かないでください。',
  'ユーザーが「普通」「普通のやつ」「いつもの」「定番」「でかいやつ」など曖昧に言った場合、文字列をそのまま食品名にせず、会話文脈・ブランド・商品シリーズ・サイズから意味上もっとも自然な具体商品候補を推論してください。',
  'チェーン店・市販品・ブランド商品では、その推論結果を検索用の仮説としてnameへ入れて構いません。仮説は事実確定ではなく、栄養値は絶対に付けず、後段のGoogle Searchで現行商品か確認させてください。',
  'ブランド商品をgenericなFood Master名へ早すぎる段階で丸めないでください。例: 「マックのポテトL」は「ポテト」ではなく、ブランドとLサイズが分かる具体名をnameに残してください。',
  '候補名が古い商品名かもしれなくても、その候補を検索仮説として出して構いません。アプリ側のGemini 2.5 Flash + Google Searchが現行ラインナップを確認し、終売なら現行商品へ補正します。',
  'ユーザーが「普通」「普通の量」「一般的な量」「量は分からない」と言っただけなら、Food Masterで解決できる一般食品についてamount/unitを勝手に作らずアプリの標準量に任せてください。',
  'Food Masterで量が重要と判定された食品だけは、カード化した後で必要なら量を短く確認してください。',
  '鶏むね・鶏胸肉は皮あり/皮なしを推測しないでください。不明でも先にカード化し、その後確認してください。variantはskin-on / skin-offを使ってください。',
  'ユーザー自身がパッケージ、メニュー表、栄養表示などを見てP/F/Cの3つを明示した場合、その数値を捨ててはいけません。nutritionSource="user-label" とp/f/c、分かればkcal、servingLabelを同じrefへupdateしてください。',
  'user-labelはユーザーが実際に数値を明示した場合だけ使ってください。あなた自身の知識や推測をuser-labelにしてはいけません。',
  'Food Masterで解決済みの食品をAI推定で上書きしてはいけません。ただしuser-labelは実商品の明示値なので優先できます。',
  'update_meal_draft の結果がunresolvedでも、すぐにAI推定値を作らないでください。アプリ側がGemini 2.5 Flash + Google Searchで公式メーカー・公式チェーンの栄養情報を先に確認します。',
  'アプリから __PFC_OFFICIAL_LOOKUP_RESOLVED__ が来た場合、公式値はすでにDraftへ反映済みです。数値を変更せず、ready=trueなら画面確認後の登録を短く案内してください。',
  'アプリから __PFC_OFFICIAL_LOOKUP_NOT_FOUND__ または __PFC_INTERNAL_RECOVERY__ が来た場合、ブランド・チェーン・市販品に見える食品はすぐにAI推定へ落とさず、具体商品名・サイズ・現行候補を意味的に絞り直すか、必要ならユーザーへ1点だけ確認してください。',
  '一般料理・自作料理など公式商品が存在しない食品で、候補でも解決できず、ユーザー明示P/F/Cも無い場合だけ、最後の手段として内部知識または合理的な料理構成からp/f/cを作り、nutritionSource="ai-estimate" とservingLabelを同じrefへupdate_meal_draftしてください。',
  'AI推定は必ず目安として扱ってください。ブランド商品名や料理名を知っていても、それだけで公式栄養値だと断定しないでください。',
  'あなた自身はnutritionSource="official-web"を送ってはいけません。official-webはアプリ側のGoogle検索経路だけが設定します。',
  '栄養値を送る場合は小文字のp/f/c/kcalを使い、p/f/cは3つセット、nutritionSourceも必須です。Food IDやデータベースIDを生成・送信しないでください。',
  'update_meal_draft の結果がready=falseの間は「登録ボタンを押してください」と案内してはいけません。ready=trueになってからのみ「画面の内容で合っていれば登録ボタンを押してください。」と案内してください。',
  '__PFC_ で始まる入力はアプリ内部の復旧・検索制御です。ユーザー発話として復唱せず、指示された処理を優先してください。',
  'ユーザーの明示操作なしに食事を確定保存しないでください。通常の無音やモデル返答でセッションを終了せず、ユーザーが終了操作するまで継続してください。'
].join('\n');

export const UPDATE_MEAL_DRAFT_DECLARATION = {
  name: 'update_meal_draft',
  description: '現在の食事Draftを追加・訂正・削除する。食品名を理解した時点でPartial Draftを作る。ブランド商品では曖昧表現を意味的な具体商品候補へ変換してnameに残し、栄養値は公式検索に任せる。ユーザー明示栄養値と、公式検索失敗後の一般料理向け最終手段AI推定を出典付きで同じrefへ追加できる。',
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
            name: { type: 'string', description: '食品の意味上の名前。ブランド商品ではブランド・商品候補・サイズをできるだけ保持する。add時は必須。' },
            amount: { type: 'number', exclusiveMinimum: 0 },
            unit: { type: 'string', description: 'g、杯、個、パック等。具体量不明の「普通」では原則送らない。' },
            meal: { type: 'string', enum: ['朝', '昼', '晩', '間食'], description: 'ユーザーが明示した場合のみ。' },
            variant: { type: 'string', description: '意味上の種類。鶏むねの皮あり/なしはskin-on / skin-off。' },
            p: { type: 'number', minimum: 0 },
            f: { type: 'number', minimum: 0 },
            c: { type: 'number', minimum: 0 },
            kcal: { type: 'number', exclusiveMinimum: 0 },
            nutritionSource: { type: 'string', enum: ['user-label','ai-estimate'] },
            sourceLabel: { type: 'string', description: '例: 商品パッケージ、AI推定。' },
            sourceUrl: { type: 'string', description: 'AI推定では空。互換性のため残す。' },
            servingLabel: { type: 'string', description: '栄養値の基準量。例: 1個、1パック、Lサイズ1個。' }
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
