// PFC_GAS_V13_NUTRITION_LOOKUP_PATCH
// Additive patch for the existing PFC GAS V12 deployment.
// Existing permanent API key stays in Script Properties; it is never returned to the browser.
//
// In the existing doPost(e), add these TWO lines at the very top of the function body:
//   var pfcNutritionResponse = pfcTryNutritionLookupV13_(e);
//   if (pfcNutritionResponse) return pfcNutritionResponse;
//
// Then add the helper functions below as a new .gs file in the same Apps Script project.

var PFC_NUTRITION_LOOKUP_BUILD_V13_ = 'PFC_GAS_NUTRITION_LOOKUP_V13';
var PFC_NUTRITION_LOOKUP_MODEL_V13_ = 'gemini-2.5-flash';
var PFC_NUTRITION_LOOKUP_DEFAULT_DAILY_CAP_V13_ = 450;

function pfcTryNutritionLookupV13_(e) {
  var payload;
  try { payload = JSON.parse((e && e.postData && e.postData.contents) || '{}'); }
  catch (err) { return null; }
  if (!payload || payload.taskType !== 'nutritionLookup') return null;
  return pfcHandleNutritionLookupV13_(payload);
}

function pfcHandleNutritionLookupV13_(payload) {
  try {
    var foodName = pfcTextV13_(payload.foodName).slice(0, 120);
    var contextText = pfcTextV13_(payload.contextText).slice(0, 240);
    var candidates = Array.isArray(payload.candidateNames) ? payload.candidateNames.slice(0, 5).map(pfcTextV13_) : [];
    if (!foodName) return pfcJsonV13_({ok:false,status:'error',message:'foodName is required',gasBuild:PFC_NUTRITION_LOOKUP_BUILD_V13_});

    var quota = pfcTakeDailyQuotaV13_();
    if (!quota.ok) return pfcJsonV13_({ok:false,status:'quota_exhausted',message:'nutrition lookup daily safety cap reached',gasBuild:PFC_NUTRITION_LOOKUP_BUILD_V13_,dailyCap:quota.limit});

    var props = PropertiesService.getScriptProperties();
    var apiKey = props.getProperty('GEMMA_API_KEY') || props.getProperty('GEMINI_API_KEY');
    if (!apiKey) return pfcJsonV13_({ok:false,status:'error',message:'Gemini API key is not configured',gasBuild:PFC_NUTRITION_LOOKUP_BUILD_V13_});

    var prompt = pfcBuildNutritionPromptV13_(foodName, contextText, candidates);
    var endpoint = 'https://generativelanguage.googleapis.com/v1beta/models/' + encodeURIComponent(PFC_NUTRITION_LOOKUP_MODEL_V13_) + ':generateContent';
    var requestBody = {
      contents: [{role:'user',parts:[{text:prompt}]}],
      tools: [{google_search:{}}],
      generationConfig: {temperature:0.0, maxOutputTokens:1200}
    };
    var response = UrlFetchApp.fetch(endpoint, {
      method:'post',contentType:'application/json',headers:{'x-goog-api-key':apiKey},
      payload:JSON.stringify(requestBody),muteHttpExceptions:true
    });
    var httpStatus = response.getResponseCode();
    var raw = response.getContentText();
    var googleBody;
    try { googleBody = JSON.parse(raw); } catch (err2) { googleBody = null; }
    if (httpStatus < 200 || httpStatus >= 300 || !googleBody) {
      return pfcJsonV13_({ok:false,status:'error',message:'Gemini search request failed',httpStatus:httpStatus,googleStatus:pfcGoogleStatusV13_(googleBody),gasBuild:PFC_NUTRITION_LOOKUP_BUILD_V13_});
    }

    var candidate = googleBody.candidates && googleBody.candidates[0];
    var answerText = pfcCandidateTextV13_(candidate);
    var parsed = pfcParseJsonAnswerV13_(answerText);
    var metadata = candidate && candidate.groundingMetadata ? candidate.groundingMetadata : {};
    var webQueries = Array.isArray(metadata.webSearchQueries) ? metadata.webSearchQueries.slice(0, 8) : [];
    var chunks = pfcGroundingChunksV13_(metadata);

    if (!parsed || parsed.status !== 'verified') {
      return pfcJsonV13_({ok:true,status:'not_found',grounded:webQueries.length>0 && chunks.length>0,model:PFC_NUTRITION_LOOKUP_MODEL_V13_,webSearchQueries:webQueries,gasBuild:PFC_NUTRITION_LOOKUP_BUILD_V13_});
    }

    var checked = pfcValidateVerifiedNutritionV13_(parsed, metadata);
    if (!checked.ok) {
      return pfcJsonV13_({ok:true,status:'not_found',grounded:webQueries.length>0 && chunks.length>0,model:PFC_NUTRITION_LOOKUP_MODEL_V13_,message:checked.reason,webSearchQueries:webQueries,gasBuild:PFC_NUTRITION_LOOKUP_BUILD_V13_});
    }

    return pfcJsonV13_({
      ok:true,status:'verified',grounded:true,officialSource:true,
      brand:checked.brand,productName:checked.productName,servingLabel:checked.servingLabel,
      kcal:checked.kcal,p:checked.p,f:checked.f,c:checked.c,
      sourceLabel:checked.sourceLabel,sourceUrl:checked.sourceUrl,sourceDomain:checked.sourceDomain,
      model:PFC_NUTRITION_LOOKUP_MODEL_V13_,verifiedAt:new Date().toISOString(),webSearchQueries:webQueries,
      gasBuild:PFC_NUTRITION_LOOKUP_BUILD_V13_
    });
  } catch (err) {
    return pfcJsonV13_({ok:false,status:'error',message:String(err && err.message ? err.message : err),gasBuild:PFC_NUTRITION_LOOKUP_BUILD_V13_});
  }
}

function pfcBuildNutritionPromptV13_(foodName, contextText, candidates) {
  return [
    'あなたはPFC記録アプリの公式栄養情報検索専用エージェントです。必ずGoogle Searchを使ってください。',
    '対象食品: ' + foodName,
    contextText ? '直前の会話文脈（ブランド・サイズ特定のみに使用）: ' + contextText : '',
    candidates.length ? 'ローカルDB候補（公式商品が見つからない場合の参考のみ）: ' + candidates.join(' / ') : '',
    '',
    '絶対ルール:',
    '1. あなたの学習済み知識から栄養値を補完・推測しない。',
    '2. メーカー、飲食チェーン、商品ブランド等の公式WebページにP/F/C/kcalが確認できる場合だけ verified。',
    '3. 個人ブログ、まとめサイト、カロリーDB、SNS、Wikipedia、検索スニペットだけでは verified にしない。',
    '4. 商品名・サイズ・基準量が一致する同一商品の値だけを使う。サイズ不明や商品候補が複数なら not_found。',
    '5. 公式値が1項目でも不足している場合は not_found。',
    '6. sourceUrlは確認した公式ページの直接URL、sourceDomainはその公式ドメインだけを書く。',
    '7. 出力は説明文やMarkdownを付けず、次のJSONオブジェクト1個だけ。',
    '',
    '{"status":"verified","brand":"ブランド名","productName":"公式商品名","servingLabel":"基準量・サイズ","kcal":0,"p":0,"f":0,"c":0,"sourceLabel":"○○公式","sourceUrl":"https://公式URL","sourceDomain":"example.com"}',
    '見つからない場合は {"status":"not_found"} だけを返してください。'
  ].filter(Boolean).join('\n');
}

function pfcCandidateTextV13_(candidate) {
  var parts = candidate && candidate.content && candidate.content.parts;
  if (!Array.isArray(parts)) return '';
  return parts.map(function(part){ return pfcTextV13_(part && part.text); }).filter(Boolean).join('\n');
}

function pfcParseJsonAnswerV13_(value) {
  var s = pfcTextV13_(value).replace(/^```(?:json)?\s*/i,'').replace(/```\s*$/,'').trim();
  var first = s.indexOf('{');
  var last = s.lastIndexOf('}');
  if (first < 0 || last <= first) return null;
  try { return JSON.parse(s.slice(first,last+1)); } catch (err) { return null; }
}

function pfcGroundingChunksV13_(metadata) {
  var chunks = metadata && metadata.groundingChunks;
  if (!Array.isArray(chunks)) return [];
  return chunks.map(function(chunk){
    var web = chunk && chunk.web;
    return web ? {uri:pfcTextV13_(web.uri),title:pfcTextV13_(web.title)} : null;
  }).filter(Boolean);
}

function pfcValidateVerifiedNutritionV13_(parsed, metadata) {
  var p = Number(parsed.p), f = Number(parsed.f), c = Number(parsed.c), kcal = Number(parsed.kcal);
  if (![p,f,c,kcal].every(function(n){return isFinite(n);}) || p<0 || f<0 || c<0 || kcal<=0) return {ok:false,reason:'invalid nutrition numbers'};
  var servingLabel = pfcTextV13_(parsed.servingLabel);
  var productName = pfcTextV13_(parsed.productName);
  var brand = pfcTextV13_(parsed.brand);
  var sourceUrl = pfcTextV13_(parsed.sourceUrl);
  var sourceDomain = pfcNormalizeDomainV13_(parsed.sourceDomain);
  if (!servingLabel || !productName || !brand || !sourceUrl || !sourceDomain) return {ok:false,reason:'official identity/source fields missing'};
  if (!/^https:\/\//i.test(sourceUrl)) return {ok:false,reason:'sourceUrl must be https'};
  var sourceHost = pfcUrlHostV13_(sourceUrl);
  if (!sourceHost || !(sourceHost === sourceDomain || sourceHost.slice(-(sourceDomain.length+1)) === '.'+sourceDomain)) return {ok:false,reason:'source URL/domain mismatch'};
  if (pfcBlockedSourceDomainV13_(sourceDomain)) return {ok:false,reason:'non-official source domain'};

  var queries = metadata && metadata.webSearchQueries;
  var chunks = pfcGroundingChunksV13_(metadata);
  if (!Array.isArray(queries) || !queries.length || !chunks.length) return {ok:false,reason:'missing Google Search grounding metadata'};
  var domainSeen = chunks.some(function(chunk){
    var title = pfcTextV13_(chunk.title).toLowerCase();
    var host = pfcUrlHostV13_(chunk.uri);
    return title.indexOf(sourceDomain) >= 0 || host === sourceDomain || (host && host.slice(-(sourceDomain.length+1)) === '.'+sourceDomain);
  });
  if (!domainSeen) return {ok:false,reason:'official domain not present in grounding sources'};

  var macroKcal = p*4 + f*9 + c*4;
  var diff = Math.abs(macroKcal-kcal);
  if (diff > Math.max(60,kcal*0.20)) return {ok:false,reason:'PFC/kcal consistency check failed'};

  return {
    ok:true,brand:brand,productName:productName,servingLabel:servingLabel,
    kcal:Math.round(kcal),p:Math.round(p*10)/10,f:Math.round(f*10)/10,c:Math.round(c*10)/10,
    sourceLabel:pfcTextV13_(parsed.sourceLabel) || brand+'公式',sourceUrl:sourceUrl,sourceDomain:sourceDomain
  };
}

function pfcBlockedSourceDomainV13_(domain) {
  var d = pfcNormalizeDomainV13_(domain);
  var blocked = [
    'wikipedia.org','reddit.com','x.com','twitter.com','instagram.com','facebook.com','tiktok.com','youtube.com',
    'tabelog.com','cookpad.com','ameblo.jp','note.com','myfitnesspal.com','fatsecret.jp','fatsecret.com'
  ];
  return blocked.some(function(x){return d===x || d.slice(-(x.length+1))==='.'+x;});
}

function pfcNormalizeDomainV13_(value) {
  return pfcTextV13_(value).toLowerCase().replace(/^https?:\/\//,'').replace(/^www\./,'').split('/')[0].split(':')[0];
}
function pfcUrlHostV13_(value) {
  var match = pfcTextV13_(value).match(/^https?:\/\/([^\/?#]+)/i);
  return match ? pfcNormalizeDomainV13_(match[1]) : '';
}

function pfcTakeDailyQuotaV13_() {
  var props = PropertiesService.getScriptProperties();
  var configured = Number(props.getProperty('PFC_NUTRITION_LOOKUP_DAILY_CAP') || PFC_NUTRITION_LOOKUP_DEFAULT_DAILY_CAP_V13_);
  var limit = isFinite(configured) && configured > 0 ? Math.min(Math.floor(configured), 500) : PFC_NUTRITION_LOOKUP_DEFAULT_DAILY_CAP_V13_;
  var dateKey = Utilities.formatDate(new Date(), 'GMT', 'yyyy-MM-dd');
  var key = 'PFC_NUTRITION_LOOKUP_COUNT_' + dateKey;
  var lock = LockService.getScriptLock();
  lock.waitLock(5000);
  try {
    var count = Number(props.getProperty(key) || 0);
    if (count >= limit) return {ok:false,count:count,limit:limit};
    props.setProperty(key, String(count+1));
    return {ok:true,count:count+1,limit:limit};
  } finally { lock.releaseLock(); }
}

function pfcGoogleStatusV13_(body) { return pfcTextV13_(body && body.error && (body.error.status || body.error.message)); }
function pfcTextV13_(value) { return String(value == null ? '' : value).trim(); }
function pfcJsonV13_(obj) { return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON); }
