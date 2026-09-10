import { resolveFood, searchFoods, defaultAmount } from '../nutrition/catalog.js';
import { autoMeal } from '../storage.js';

const FORBIDDEN = new Set([
  'p','P','f','F','c','C','a','A','kcal','cal','Cal','foodId','food_id',
  'canonicalId','canonical_id','nutrition','macros','protein','fat','carbs','carbohydrate'
]);
const ALLOWED = new Set(['op','ref','name','amount','unit','meal','variant']);

function own(o, k) { return Object.prototype.hasOwnProperty.call(o, k); }
function text(v) { return String(v ?? '').trim(); }
function clone(v) { return JSON.parse(JSON.stringify(v)); }
function isChickenBreast(name) {
  return /^(鶏胸|鶏胸肉|鶏むね|鶏むね肉|鳥胸|鳥胸肉|とりむね|とりむね肉)$/.test(text(name));
}
function normalizeChickenVariant(v) {
  const s = text(v).toLowerCase();
  if (!s) return '';
  if (s === 'skin-on' || /皮\s*(あり|有り|付き|つき)|皮付き|皮つき/.test(s)) return 'skin-on';
  if (s === 'skin-off' || /皮\s*(なし|無し)|皮なし|皮無し|皮を?(取|除|外)/.test(s)) return 'skin-off';
  return s;
}

function assertNoForbidden(value, path='args') {
  if (!value || typeof value !== 'object') return;
  if (Array.isArray(value)) {
    value.forEach((x,i)=>assertNoForbidden(x, `${path}[${i}]`));
    return;
  }
  for (const [k,v] of Object.entries(value)) {
    if (FORBIDDEN.has(k)) throw new Error(`forbidden field: ${path}.${k}`);
    assertNoForbidden(v, `${path}.${k}`);
  }
}

function validateArgs(raw) {
  assertNoForbidden(raw);
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error('tool args must be object');
  if (Object.keys(raw).some(k=>k!=='operations')) throw new Error('only operations is allowed');
  if (!Array.isArray(raw.operations) || !raw.operations.length) throw new Error('operations must be non-empty array');

  return raw.operations.map((op,i)=>{
    if (!op || typeof op !== 'object' || Array.isArray(op)) throw new Error(`operations[${i}] invalid`);
    for (const k of Object.keys(op)) if (!ALLOWED.has(k)) throw new Error(`unsupported field: ${k}`);
    const kind = text(op.op);
    if (!['add','update','remove'].includes(kind)) throw new Error(`unsupported op: ${kind}`);
    const ref = text(op.ref);
    const name = text(op.name);
    if (kind === 'add') {
      if (ref) throw new Error('add must not provide ref');
      if (!name) throw new Error('add requires name');
    } else if (!ref) {
      throw new Error(`${kind} requires ref`);
    }
    if (own(op,'amount')) {
      const n=Number(op.amount);
      if (!Number.isFinite(n) || n<=0) throw new Error('amount must be positive');
    }
    if (own(op,'meal') && !['朝','昼','晩','間食'].includes(text(op.meal))) throw new Error('invalid meal');
    return {
      op: kind,
      ...(ref ? {ref} : {}),
      ...(own(op,'name') ? {name} : {}),
      ...(own(op,'amount') ? {amount:Number(op.amount)} : {}),
      ...(own(op,'unit') ? {unit:text(op.unit)} : {}),
      ...(own(op,'meal') ? {meal:text(op.meal)} : {}),
      ...(own(op,'variant') ? {variant:text(op.variant)} : {})
    };
  });
}

let refSeq = 0;
function nextRef() {
  refSeq += 1;
  return `live-${Date.now().toString(36)}-${refSeq}`;
}

function resolveItem(item) {
  const base = {
    ...item,
    foodId: null,
    canonicalName: '',
    unresolved: false,
    needsAmount: false,
    needsSkin: false,
    assumed: false,
    candidateNames: []
  };

  let query = text(base.name);
  if (isChickenBreast(base.name)) {
    const variant = normalizeChickenVariant(base.variant);
    base.variant = variant;
    if (!variant) {
      base.needsSkin = true;
      base.needsAmount = base.amount == null;
      base.candidateNames = ['鶏むね(皮あり)', '鶏むね(皮なし)'];
      return base;
    }
    query = variant === 'skin-on' ? '鶏むね(皮あり)'
      : variant === 'skin-off' ? '鶏むね(皮なし)'
      : '';
    if (!query) {
      base.needsSkin = true;
      base.needsAmount = base.amount == null;
      base.candidateNames = ['鶏むね(皮あり)', '鶏むね(皮なし)'];
      return base;
    }
  }

  const food = resolveFood(query);
  if (!food) {
    base.unresolved = true;
    base.candidateNames = searchFoods(query, 5).map(x=>x.name);
    return base;
  }

  base.foodId = food.id;
  base.canonicalName = food.name;

  if (base.amount == null) {
    if (food.criticalAmount) {
      base.needsAmount = true;
    } else {
      const d = defaultAmount(food);
      base.amount = d.amount;
      base.unit = base.unit || d.unit;
      base.assumed = true;
    }
  } else if (!base.unit) {
    base.unit = defaultAmount(food).unit;
  }
  return base;
}

function publicItem(item) {
  return {
    ref:item.ref,
    name:item.name,
    amount:item.amount,
    unit:item.unit,
    meal:item.meal,
    variant:item.variant,
    status:item.needsSkin?'needs-skin':item.unresolved?'unresolved':item.needsAmount?'needs-amount':'ready',
    needsSkin:!!item.needsSkin,
    needsAmount:!!item.needsAmount,
    ...(item.candidateNames?.length ? {candidateNames:[...item.candidateNames]} : {})
  };
}

export class LiveMealDraft {
  constructor() {
    this.items = [];
    this.callSnapshots = new Map();
    this.mutationSeq = 0;
  }
  snapshot() { return clone(this.items); }
  clear() {
    this.items = [];
    this.callSnapshots.clear();
    this.mutationSeq += 1;
  }
  applyFunctionCall(call) {
    const callId = text(call?.id);
    const operations = validateArgs(call?.args || {});
    const before = this.snapshot();

    for (const op of operations) {
      if (op.op === 'add') {
        this.items.push(resolveItem({
          ref: nextRef(),
          name: text(op.name),
          amount: own(op,'amount') ? op.amount : null,
          unit: text(op.unit),
          meal: op.meal || autoMeal(),
          variant: normalizeChickenVariant(op.variant)
        }));
        continue;
      }

      const index = this.items.findIndex(x=>x.ref===op.ref);
      if (index < 0) throw new Error(`unknown ref: ${op.ref}`);
      if (op.op === 'remove') {
        this.items.splice(index,1);
        continue;
      }

      const current = this.items[index];
      const next = {...current};
      if (own(op,'name')) {
        const newName=text(op.name);
        if (!newName) throw new Error('updated name must not be empty');
        if (newName !== current.name && !own(op,'variant')) next.variant='';
        next.name=newName;
      }
      if (own(op,'amount')) next.amount=op.amount;
      if (own(op,'unit')) next.unit=op.unit;
      if (own(op,'meal')) next.meal=op.meal;
      if (own(op,'variant')) next.variant=normalizeChickenVariant(op.variant);
      this.items[index]=resolveItem(next);
    }

    this.mutationSeq += 1;
    if (callId) this.callSnapshots.set(callId, {before, appliedSeq:this.mutationSeq});
    return this.toolResult();
  }
  cancelCall(id) {
    const snap=this.callSnapshots.get(text(id));
    if (!snap || snap.appliedSeq !== this.mutationSeq) return false;
    this.items=clone(snap.before);
    this.mutationSeq += 1;
    this.callSnapshots.delete(text(id));
    return true;
  }
  removeLocal(ref) {
    const i=this.items.findIndex(x=>x.ref===ref);
    if (i<0) return false;
    this.items.splice(i,1);
    this.mutationSeq += 1;
    return true;
  }
  toolResult() {
    return {ok:true,draft:this.items.map(publicItem),ready:this.isReady()};
  }
  isReady() {
    return this.items.length>0 && this.items.every(x=>
      x.foodId && !x.unresolved && !x.needsSkin && !x.needsAmount && Number(x.amount)>0
    );
  }
  resolvedItems() {
    if (!this.isReady()) return [];
    return this.snapshot();
  }
}
