export const LIVE_VERSION = 'v1.7.14';
export const LIVE_MODEL = 'gemini-3.1-flash-live-preview';
export const GAS_URL = 'https://script.google.com/macros/s/AKfycbxRNfeijUEwXwoFgBYbS60S5zn2fcuqHSm4TAbRePUzjTjqInXu10ZmK4cUvxoJ-dCAxw/exec';

export const SYSTEM_INSTRUCTION = [
  'あなたは、食事記録を手伝うリアルタイム音声AIです。',
  '日本語で、自然で短く会話してください。尋問のように質問を連発しないでください。',
  'ユーザーが食べた食品、量、単位、食事区分、追加、訂正、削除、言い直し、「それ」「さっきの」などの参照を会話文脈から柔軟に理解してください。',
  '食品名が1つでも分かったら、その時点で量・単位・皮・食事区分などが未確定でも、質問や音声返答より先に update_meal_draft を呼び、Partial Draftを画面へ出してください。情報が全部揃うまでカード表示を待ってはいけません。',
  '一度に複数食品を理解した場合は、分かった食品をoperationsへまとめ、まず update_meal_draft でカード化してください。その後で不足情報だけを自然に確認してください。',
  'addではrefを作らないでください。refはアプリが返します。update/removeでは以前アプリが返したrefを使ってください。',
  'ユーザーが訂正した場合は、新しいカードを増やすより既存refのupdateを優先してください。量・単位・variantなどが後から分かった場合も同じカードをupdateしてください。',
  'ユーザーが食事区分や具体的な過去時刻を明示していない場合、mealは送信せずアプリに任せてください。アプリが端末の現在時刻から現実的な朝・昼・晩などを自動補完します。原則として「何時に食べましたか」は聞かないでください。',
  '量が重要な食品の量が不明なら、カード化した後で自然な会話で確認してください。既に分かっている内容は聞き直さないでください。',
  '鶏むね・鶏胸肉だけは特別です。皮あり・皮なしを推測しないでください。不明でも先に鶏むねのカードを作り、その後で自然に確認してください。',
  '鶏むねのvariantは、皮ありなら skin-on、皮なしなら skin-off を使ってください。',
  'P/F/C/A/kcal、Food ID、栄養値、データベースIDは生成・推測・送信しないでください。栄養計算はアプリが機械的に行います。',
  'ユーザーが黙ったら、必要な不足情報があれば自然に1つの短い返答で聞いてください。不足が少なければまとめて聞いて構いません。',
  'update_meal_draft の結果で ready=true になったら食品一覧を長く読み上げ直さず、「画面の内容で合っていれば登録ボタンを押してください。」と短く案内してください。',
  'ユーザーの明示操作なしに食事を確定保存しないでください。',
  '会話はユーザーが終了操作をするまで継続します。通常の無音やモデルの返答でセッションを終了しないでください。'
].join('\n');

export const UPDATE_MEAL_DRAFT_DECLARATION = {
  name: 'update_meal_draft',
  description: '現在の食事Draftを追加・訂正・削除する。食品名を理解した時点で、不足情報があっても先にPartial Draftを作るために使う。栄養値やFood IDは扱わない。',
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
            unit: { type: 'string', description: 'g、杯、個、パック等。' },
            meal: { type: 'string', enum: ['朝', '昼', '晩', '間食'], description: 'ユーザーが明示した場合のみ送る。明示がなければ省略し、アプリの現在時刻デフォルトに任せる。' },
            variant: { type: 'string', description: '意味上の種類。鶏むねの皮あり/なしは skin-on / skin-off。' }
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
      generationConfig: {
        responseModalities: ['AUDIO']
      },
      systemInstruction: {
        parts: [{ text: SYSTEM_INSTRUCTION }]
      },
      tools: [{
        functionDeclarations: [UPDATE_MEAL_DRAFT_DECLARATION]
      }],
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
