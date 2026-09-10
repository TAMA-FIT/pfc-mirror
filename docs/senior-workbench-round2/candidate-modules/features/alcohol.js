const n = value => Number.isFinite(Number(value)) ? Number(value) : 0;

export function alcoholTotal(records = []) {
  return records.reduce((sum, record) => sum + Math.max(0, n(record?.A)), 0);
}

export function alcoholKcalEstimate(records = []) {
  return Math.round(alcoholTotal(records) * 7);
}

export function shouldShowAlcohol(records = []) {
  return alcoholTotal(records) > 0.01;
}

export function alcoholUiModel(records = []) {
  const grams = Math.round(alcoholTotal(records) * 10) / 10;
  return {
    visible: grams > 0,
    grams,
    estimatedKcal: Math.round(grams * 7),
    label: 'アルコール'
  };
}
