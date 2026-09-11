// PFC_GAS_V13_1_NUTRITION_LOOKUP_PATCH
// Additive patch for the existing PFC GAS V12 deployment.
// Existing permanent API key stays in Script Properties; it is never returned to the browser.
//
// In the existing doPost(e), after parsing data/taskType, route nutritionLookup before normal chat handling:
//   if (taskType === "nutritionLookup") {
//     return pfcHandleNutritionLookupV13_(data);
//   }
//
// If you prefer routing before the existing JSON parse block, these two lines also work:
//   var pfcNutritionResponse = pfcTryNutritionLookupV13_(e);
//   if (pfcNutritionResponse) return pfcNutritionResponse;
//
// Then add the helper functions below in the same Apps Script project.

function pfcTryNutritionLookupV13_(e) {
  var payload;
  try { payload = JSON.parse((e && e.postData && e.postData.contents) || '{}'); }
  catch (err) { return null; }
  if (!payload || payload.taskType !== 'nutritionLookup') return null;
  return pfcHandleNutritionLookupV13_(payload);
}

var PFC_NUTRITION_LOOKUP_BUILD_V13_ = 'PFC_GAS_NUTRITION_LOOKUP_V13_1_FLEX';
var PFC_NUTRITION_LOOKUP_MODEL_V13_ = 'gemini-2.5-flash';
var PFC_NUTRITION_LOOKUP_DEFAULT_DAILY_CAP_V13_ = 450;

function pfcHandleNutritionLookupV13_(payload) {
  try {
    var foodName = pfcTextV13_(payload.foodName).slice(0, 120);
    var contextText = pfcTextV13_(payload.contextText).slice(0, 240);
    var candidates = Array.isArray(payload.candidateNames)
      ? payload.candidateNames.slice(0, 5).map(pfcTextV13_)
      : [];

    if (!foodName) {
      return pfcJsonV13_({
        ok:false,
        status:'error',
        message:'foodName is required',
        gasBuild:PFC_NUTRITION_LOOKUP_BUILD_V13_
      });
    }

    var quota = pfcTakeDailyQuotaV13_();
    if (!quota.ok) {
      return pfcJsonV13_({
        ok:false,
        status:'quota_exhausted',
        message:'nutrition lookup daily safety cap reached',
        gasBuild:PFC_NUTRITION_LOOKUP_BUILD_V13_,
        dailyCap:quota.limit
      });
    }

    var props = PropertiesService.getScriptProperties();
    var apiKey = props.getProperty('GEMMA_API_KEY') || props.getProperty('GEMINI_API_KEY');
    if (!apiKey) {
      return pfcJsonV13_({
        ok:false,
        status:'error',
        message:'Gemini API key is not configured',
        gasBuild:PFC_NUTRITION_LOOKUP_BUILD_V13_
      });
    }

    var prompt = pfcBuildNutritionPromptV13_(foodName, contextText, candidates);
    var endpoint =
      'https://generativelanguage.googleapis.com/v1beta/models/' +
      encodeURIComponent(PFC_NUTRITION_LOOKUP_MODEL_V13_) +
      ':generateContent';

    var requestBody = {
      contents: [{role:'user', parts:[{text:prompt}]}],
      tools: [{google_search:{}}],
      generationConfig: {
        temperature:0.0,
        maxOutputTokens:1200
      }
    };

    var response = UrlFetchApp.fetch(endpoint, {
      method:'post',
      contentType:'application/json',
      headers:{'x-goog-api-key':apiKey},
      payload:JSON.stringify(requestBody),
      muteHttpExceptions:true
    });

    var httpStatus = response.getResponseCode();
    var raw = response.getContentText();
    var googleBody;

    try {
      googleBody = JSON.parse(raw);
    } catch (err2) {
      googleBody = null;
    }

    if (httpStatus < 200 || httpStatus >= 300 || !googleBody) {
      return pfcJsonV13_({
        ok:false,
        status:'error',
        message:'Gemini search request failed',
        httpStatus:httpStatus,
        googleStatus:pfcGoogleStatusV13_(googleBody),
        gasBuild:PFC_NUTRITION_LOOKUP_BUILD_V13_
      });
    }

    var candidate = googleBody.candidates && googleBody.candidates[0];
    var answerText = pfcCandidateTextV13_(candidate);
    var parsed = pfcParseJsonAnswerV13_(answerText);
    var metadata =
      candidate && candidate.groundingMetadata
        ? candidate.groundingMetadata
        : {};

    var webQueries = Array.isArray(metadata.webSearchQueries)
      ? metadata.webSearchQueries.slice(0, 8)
      : [];

    var chunks = pfcGroundingChunksV13_(metadata);

    if (!parsed || parsed.status !== 'verified') {
      return pfcJsonV13_({
        ok:true,
        status:'not_found',
        grounded:webQueries.length > 0 && chunks.length > 0,
        model:PFC_NUTRITION_LOOKUP_MODEL_V13_,
        webSearchQueries:webQueries,
        gasBuild:PFC_NUTRITION_LOOKUP_BUILD_V13_
      });
    }

    var checked = pfcValidateVerifiedNutritionV13_(parsed, metadata);

    if (!checked.ok) {
      return pfcJsonV13_({
        ok:true,
        status:'not_found',
        grounded:webQueries.length > 0 && chunks.length > 0,
        model:PFC_NUTRITION_LOOKUP_MODEL_V13_,
        message:checked.reason,
        webSearchQueries:webQueries,
        gasBuild:PFC_NUTRITION_LOOKUP_BUILD_V13_
      });
    }

    return pfcJsonV13_({
      ok:true,
      status:'verified',
      grounded:true,
      officialSource:true,
      brand:checked.brand,
      productName:checked.productName,
      servingLabel:checked.servingLabel,
      kcal:checked.kcal,
      p:checked.p,
      f:checked.f,
      c:checked.c,
      sourceLabel:checked.sourceLabel,
      sourceUrl:checked.sourceUrl,
      sourceDomain:checked.sourceDomain,
      resolutionNote:checked.resolutionNote || '',
      model:PFC_NUTRITION_LOOKUP_MODEL_V13_,
      verifiedAt:new Date().toISOString(),
      webSearchQueries:webQueries,
      gasBuild:PFC_NUTRITION_LOOKUP_BUILD_V13_
    });

  } catch (err) {
    return pfcJsonV13_({
      ok:false,
      status:'error',
      message:String(err && err.message ? err.message : err),
      gasBuild:PFC_NUTRITION_LOOKUP_BUILD_V13_
    });
  }
}

function pfcBuildNutritionPromptV13_(foodName, contextText, candidates) {
  return [
    'あなたはPFC記録アプリの公式栄養情報検索専用エージェントです。必ずGoogle Searchを使ってください。',
    'ユーザーの曖昧な言い方をそのまま検索語にせず、意味を理解して検索向けの商品候補へ変換してください。',
    '対象食品: ' + foodName,
    contextText
      ? '直前の会話文脈（ブランド・店名・サイズ・「普通のやつ」等の意味解釈に使用）: ' + contextText
      : '',
    candidates.length
      ? 'Live側が考えた商品候補。これは仮説であり、必ず検索で現行商品か確認すること: ' + candidates.join(' / ')
      : '',
    '',
    '検索方針:',
    '1. まず発話と文脈から、ブランド・現行商品名・サイズ/規格の検索候補を推定する。',
    '2. 「普通のやつ」「いつもの」「定番」「大きいやつ」等は文字列一致で検索せず、現在の公式メニュー/商品一覧を確認して最も自然な現行候補へ解釈する。',
    '3. 候補名が旧商品・終売・古い名称だった場合は、そのまま採用せず、公式の現行ラインナップを再検索して現行商品へ補正する。',
    '4. 必要ならGoogle Searchを複数回使い、(a) 現行商品特定 → (b) 公式栄養情報確認 の順に進める。',
    '5. メーカー・飲食チェーン・商品ブランド等の公式Webサイト、公式PDF、公式栄養表を最優先する。',
    '6. 公式情報が複数ページに分かれていても、同一ブランド公式サイト内で商品・サイズが一致していれば組み合わせてよい。',
    '7. 個人ブログ、まとめサイト、SNS、Wikipedia、一般カロリーDB、検索スニペットだけの数値は verified にしない。',
    '8. あなたの学習済み知識からP/F/C/kcalを補完・推測しない。数字は検索で確認できた公式値だけを返す。',
    '9. 商品・サイズが1つに絞れない場合のみ not_found。明確な第一候補があり、公式の現行商品と確認できた場合は verified にしてよい。',
    '10. sourceUrlは確認に使った公式ページのURL、sourceDomainはその公式ドメイン。',
    '11. 出力は説明文やMarkdownを付けずJSONオブジェクト1個だけ。',
    '',
    '{"status":"verified","brand":"ブランド名","productName":"現在の公式商品名","servingLabel":"基準量・サイズ","kcal":0,"p":0,"f":0,"c":0,"sourceLabel":"○○公式","sourceUrl":"https://公式URL","sourceDomain":"example.com","resolutionNote":"曖昧表現をどう現行商品へ解釈したかを短く"}',
    '本当に公式値まで確認できない場合だけ {"status":"not_found"} を返してください。'
  ].filter(Boolean).join('\n');
}

function pfcCandidateTextV13_(candidate) {
  var parts = candidate && candidate.content && candidate.content.parts;
  if (!Array.isArray(parts)) return '';
  return parts
    .map(function(part) {
      return pfcTextV13_(part && part.text);
    })
    .filter(Boolean)
    .join('\n');
}

function pfcParseJsonAnswerV13_(value) {
  var s = pfcTextV13_(value)
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/```\s*$/, '')
    .trim();

  var first = s.indexOf('{');
  var last = s.lastIndexOf('}');
  if (first < 0 || last <= first) return null;

  try {
    return JSON.parse(s.slice(first, last + 1));
  } catch (err) {
    return null;
  }
}

function pfcGroundingChunksV13_(metadata) {
  var chunks = metadata && metadata.groundingChunks;
  if (!Array.isArray(chunks)) return [];

  return chunks
    .map(function(chunk) {
      var web = chunk && chunk.web;
      return web
        ? {
            uri:pfcTextV13_(web.uri),
            title:pfcTextV13_(web.title)
          }
        : null;
    })
    .filter(Boolean);
}

function pfcValidateVerifiedNutritionV13_(parsed, metadata) {
  var p = Number(parsed.p);
  var f = Number(parsed.f);
  var c = Number(parsed.c);
  var kcal = Number(parsed.kcal);

  if (
    ![p, f, c, kcal].every(function(n) { return isFinite(n); }) ||
    p < 0 || f < 0 || c < 0 || kcal <= 0
  ) {
    return {ok:false, reason:'invalid nutrition numbers'};
  }

  var servingLabel = pfcTextV13_(parsed.servingLabel);
  var productName = pfcTextV13_(parsed.productName);
  var brand = pfcTextV13_(parsed.brand);
  var sourceUrl = pfcTextV13_(parsed.sourceUrl);
  var sourceDomain = pfcNormalizeDomainV13_(parsed.sourceDomain);

  if (!servingLabel || !productName || !brand || !sourceUrl || !sourceDomain) {
    return {ok:false, reason:'official identity/source fields missing'};
  }

  if (!/^https:\/\//i.test(sourceUrl)) {
    return {ok:false, reason:'sourceUrl must be https'};
  }

  var sourceHost = pfcUrlHostV13_(sourceUrl);
  if (
    !sourceHost ||
    !(
      sourceHost === sourceDomain ||
      sourceHost.slice(-(sourceDomain.length + 1)) === '.' + sourceDomain
    )
  ) {
    return {ok:false, reason:'source URL/domain mismatch'};
  }

  if (pfcBlockedSourceDomainV13_(sourceDomain)) {
    return {ok:false, reason:'non-official source domain'};
  }

  var queries = metadata && metadata.webSearchQueries;
  var chunks = pfcGroundingChunksV13_(metadata);

  if (!Array.isArray(queries) || !queries.length || !chunks.length) {
    return {ok:false, reason:'missing Google Search grounding metadata'};
  }

  var haystack = [];
  queries.forEach(function(q) { haystack.push(pfcTextV13_(q)); });
  chunks.forEach(function(chunk) { haystack.push(pfcTextV13_(chunk.title)); });
  var searchText = haystack.join(' ').toLowerCase();

  var brandTokens = pfcSearchTokensV13_(brand);
  var productTokens = pfcSearchTokensV13_(productName);

  var brandSeen = brandTokens.length === 0 || brandTokens.some(function(t) {
    return searchText.indexOf(t) >= 0;
  });

  var productSeen = productTokens.length === 0 || productTokens.some(function(t) {
    return searchText.indexOf(t) >= 0;
  });

  if (!brandSeen && !productSeen) {
    return {ok:false, reason:'grounding does not appear related to resolved product'};
  }

  var macroKcal = p * 4 + f * 9 + c * 4;
  var diff = Math.abs(macroKcal - kcal);

  if (diff > Math.max(90, kcal * 0.28)) {
    return {ok:false, reason:'PFC/kcal consistency check failed'};
  }

  return {
    ok:true,
    brand:brand,
    productName:productName,
    servingLabel:servingLabel,
    kcal:Math.round(kcal),
    p:Math.round(p * 10) / 10,
    f:Math.round(f * 10) / 10,
    c:Math.round(c * 10) / 10,
    sourceLabel:
      pfcTextV13_(parsed.sourceLabel) || brand + '公式',
    sourceUrl:sourceUrl,
    sourceDomain:sourceDomain,
    resolutionNote:pfcTextV13_(parsed.resolutionNote)
  };
}

function pfcSearchTokensV13_(value) {
  var s = pfcTextV13_(value)
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[®™©]/g, '')
    .replace(/[()（）【】\[\]「」『』・／/,_\-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (!s) return [];

  var stop = {
    '公式':1,'株式会社':1,'有限会社':1,'メニュー':1,'商品':1,'サイズ':1,
    'the':1,'and':1,'of':1,'inc':1,'co':1,'ltd':1
  };

  var tokens = s.split(' ').filter(function(t) {
    return t && !stop[t] && t.length >= 2;
  });

  if (!tokens.length && s.length >= 2) tokens = [s];
  return tokens.slice(0, 8);
}

function pfcBlockedSourceDomainV13_(domain) {
  var d = pfcNormalizeDomainV13_(domain);
  var blocked = [
    'wikipedia.org',
    'reddit.com',
    'x.com',
    'twitter.com',
    'instagram.com',
    'facebook.com',
    'tiktok.com',
    'youtube.com',
    'tabelog.com',
    'cookpad.com',
    'ameblo.jp',
    'note.com',
    'myfitnesspal.com',
    'fatsecret.jp',
    'fatsecret.com'
  ];

  return blocked.some(function(x) {
    return d === x || d.slice(-(x.length + 1)) === '.' + x;
  });
}

function pfcNormalizeDomainV13_(value) {
  return pfcTextV13_(value)
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .split('/')[0]
    .split(':')[0];
}

function pfcUrlHostV13_(value) {
  var match = pfcTextV13_(value).match(
    /^https?:\/\/([^\/?#]+)/i
  );

  return match
    ? pfcNormalizeDomainV13_(match[1])
    : '';
}

function pfcTakeDailyQuotaV13_() {
  var props = PropertiesService.getScriptProperties();

  var configured = Number(
    props.getProperty('PFC_NUTRITION_LOOKUP_DAILY_CAP') ||
    PFC_NUTRITION_LOOKUP_DEFAULT_DAILY_CAP_V13_
  );

  var limit =
    isFinite(configured) && configured > 0
      ? Math.min(Math.floor(configured), 500)
      : PFC_NUTRITION_LOOKUP_DEFAULT_DAILY_CAP_V13_;

  var dateKey = Utilities.formatDate(new Date(), 'GMT', 'yyyy-MM-dd');
  var key = 'PFC_NUTRITION_LOOKUP_COUNT_' + dateKey;

  var lock = LockService.getScriptLock();
  lock.waitLock(5000);

  try {
    var count = Number(props.getProperty(key) || 0);

    if (count >= limit) {
      return {ok:false, count:count, limit:limit};
    }

    props.setProperty(key, String(count + 1));
    return {ok:true, count:count + 1, limit:limit};

  } finally {
    lock.releaseLock();
  }
}

function pfcGoogleStatusV13_(body) {
  return pfcTextV13_(
    body && body.error && (body.error.status || body.error.message)
  );
}

function pfcTextV13_(value) {
  return String(value == null ? '' : value).trim();
}

function pfcJsonV13_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
