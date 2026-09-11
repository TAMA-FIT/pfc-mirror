export const LIVE_VERSION = 'v1.7.16';
export const LIVE_MODEL = 'gemini-3.1-flash-live-preview';
export const GAS_URL = 'https://script.google.com/macros/s/AKfycbxRNfeijUEwXwoFgBYbS60S5zn2fcuqHSm4TAbRePUzjTjqInXu10ZmK4cUvxoJ-dCAxw/exec';

export const SYSTEM_INSTRUCTION = [
  'あなたは、食事記録を手伝うリアルタイム音声AIです。',
  '日本語で、自然で短く会話してください。尋問のように質問を連発しないでください。',
  'ユーザーが食べた食品、量、単位、食事区分、追加、訂正、削除、言い直し、「それ」「さっきの」などの参照を会話文脈から柔軟に理解してください。',
  '食品名が1つでも分かったら、その時点で量・単位・皮・食事区分などが未確定でも、質問・Google検索・音声返答より先に update_meal_draft を呼び、Partial Draftを画面へ出してください。情報が全部揃うまでカード表示を待ってはいけません。',
  '一度に複数食品を理解した場合は、分かった食品をoperationsへまとめ、まず update_meal_draft でカード化してください。その後で不足情報だけを自然に確認してください。',
  'addではrefを作らないでください。refはアプリが返します。update/removeでは以前アプリが返したrefを使ってください。',
  'ユーザーが訂正した場合は、新しいカードを増やすより既存refのupdateを優先してください。量・単位・variantなどが後から分かった場合も同じカードをupdateしてください。',
  'ユーザーが食事区分や具体的な過去時刻を明示していない場合、mealは送信せずアプリに任せてください。アプリが端末の現在時刻から現実的な朝・昼・晩などを自動補完します。原則として「何時に食べましたか」は聞かないでください。',
  'ユーザーが「普通」「普通の量」「一般的な量」「量は分からない」のように具体量を示していない場合、amount/unitを推測して送らず、アプリのFood Master標準量に任せてください。',
  'Food Masterで量が重要と判定された食品の量が不明なら、カード化した後で自然な会話で確認してください。既に分かっている内容は聞き直さないでください。',
  '鶏むね・鶏胸肉だけは特別です。皮あり・皮なしを推測しないでください。不明でも先に鶏むねのカードを作り、その後で自然に確認してください。',
  '鶏むねのvariantは、皮ありなら skin-on、皮なしなら skin-off を使ってください。',
  'ユーザー自身がパッケージ、メニュー表、栄養表示などを見てP/F/Cの3つを明示した場合、その数値を捨ててはいけません。まず食品カードを作り、返されたrefへ nutritionSource="user-label" とP/F/C、分かればkcal、servingLabelをupdateしてください。kcalだけでP/F/Cが不明な場合は、この栄養値候補として確定しないでください。',
  'user-labelはユーザーが実際に数値を明示した場合だけ使ってください。あなた自身の知識・推測をuser-labelとして送ってはいけません。',
  'update_meal_draft の結果が unresolved の食品だけ、Google Searchを使って公式メーカー・公式チェーン・公式商品ページの栄養情報を探してください。Food Masterで解決済みの食品をWeb検索値やAI推定で上書きしないでください。ただしuser-labelは実商品の明示値なので優先できます。',
  '公式の正確な商品栄養情報を確認できた場合だけ nutritionSource="official-web" とし、P/F/C、分かればkcal、servingLabel、sourceLabel、sourceUrlを同じrefへupdateしてください。公式でないブログ・口コミ・まとめサイトをofficial-webとして使ってはいけません。',
  'Food Masterで未解決かつ公式情報も確認できない場合は、最後の手段として一般的な料理構成から現実的なP/F/C/kcalを推定し nutritionSource="ai-estimate" として同じrefへupdateできます。AI推定は必ず目安として扱い、公式値のように断定しないでください。',
  '栄養値を送る場合は小文字の p/f/c/kcal と nutritionSource を使ってください。p/f/cは3つをセットで送り、kcalは表示値が無ければ省略できます。P/F/C/A、Food ID、データベースIDを生成・送信しないでください。',
  'ユーザーが黙ったら、必要な不足情報があれば自然に1つの短い返答で聞いてください。不足が少なければまとめて聞いて構いません。',
  'update_meal_draft の結果で ready=true になったら食品一覧を長く読み上げ直さず、「画面の内容で合っていれば登録ボタンを押してください。」と短く案内してください。',
  'ユーザーの明示操作なしに食事を確定保存しないでください。',
  '会話はユーザーが終了操作をするまで継続します。通常の無音やモデルの返答でセッションを終了しないでください。'
].join('\n');

export const UPDATE_MEAL_DRAFT_DECLARATION = {
  name: 'update_meal_draft',
  description: '現在の食事Draftを追加・訂正・削除する。食品名を理解した時点で先にPartial Draftを作る。ユーザー明示の栄養表示、公式Web栄養情報、最終手段のAI推定は出典種別付きで同じrefへ追加できる。Food IDは扱わない。',
  parametersJsonSchema: {
    type: 'object',
    additionalProperties: false,
    properties: {
      operations: {
        type: 'array',
        minItems: 1,
        items: {
          type: 'object',
          additionalProperties: false,
          properties: {
            op: { type: 'string', enum: ['add', 'update', 'remove'] },
            ref: { type: 'string', description: 'update/remove時のみ。アプリが以前返したref。addでは送らない。' },
            name: { type: 'string', description: '食品の意味上の名前。add時は必須。' },
            amount: { type: 'number', exclusiveMinimum: 0 },
            unit: { type: 'string', description: 'g、杯、個、パック等。具体量が分からない「普通」では送らない。' },
            meal: { type: 'string', enum: ['朝', '昼', '晩', '間食'], description: 'ユーザーが明示した場合のみ送る。明示がなければ省略。' },
            variant: { type: 'string', description: '意味上の種類。鶏むねの皮あり/なしは skin-on / skin-off。' },
            p: { type: 'number', minimum: 0, description: 'nutritionSourceを伴う栄養値候補のたんぱく質g。f/cとセット。' },
            f: { type: 'number', minimum: 0, description: 'nutritionSourceを伴う栄養値候補の脂質g。p/cとセット。' },
            c: { type: 'number', minimum: 0, description: 'nutritionSourceを伴う栄養値候補の炭水化物g。p/fとセット。' },
            kcal: { type: 'number', exclusiveMinimum: 0, description: '表示に明記されたkcal。無い場合は省略可。' },
            nutritionSource: { type: 'string', enum: ['user-label','official-web','ai-estimate'] },
            sourceLabel: { type: 'string', description: '例：マクドナルド公式、商品パッケージ。' },
            sourceUrl: { type: 'string', description: 'official-webでは確認した公式URL。' },
            servingLabel: { type: 'string', description: 'その栄養値の基準量。例：1個、1パック、並盛1食。' }
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
      tools: [
        { googleSearch: {} },
        { functionDeclarations: [UPDATE_MEAL_DRAFT_DECLARATION] }
      ],
      realtimeInputConfig: {
        automaticActivityDetection: {
          disabled: false,
          prefixPaddingMs: 100,
          silenceDurationMs: 1400
        },
        activityHandling: 'START_OF_ACTIVITY_INTERRUPTS'
      },
      inputAudioTranscription: {},
      outputAudioTranscription: {}
    }
  };
}

export function buildOpeningMessage() {
  return {
    realtimeInput: {
      text: '__PFC_LIVE_START__ 食事記録を開始しました。最初の一言だけ「何を食べましたか？」と短く尋ねてください。この開始信号だけでは食事Draftを更新しないでください。食事区分が明示されなければmealは省略し、現在時刻によるアプリの自動補完に任せてください。'
    }
  };
}
