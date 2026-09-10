function joinWithoutDuplicateBoundary(current, addition) {
  const max = Math.min(current.length, addition.length);
  for (let size = max; size >= 2; size--) {
    if (current.slice(-size) === addition.slice(0, size)) {
      return current + addition.slice(size);
    }
  }
  const needsSpace = /[A-Za-z0-9]$/.test(current) && /^[A-Za-z0-9]/.test(addition);
  return current + (needsSpace ? ' ' : '') + addition;
}

export function mergeTranscriptFragment(current, addition) {
  const base = String(current || '').trim();
  const next = String(addition || '').trim();
  if (!next) return base;
  if (!base) return next;
  if (base === next) return base;
  if (next.startsWith(base)) return next;
  if (base.startsWith(next)) return base;
  if (base.endsWith(next)) return base;
  if (next.length >= 4 && base.includes(next)) return base;
  if (base.length >= 4 && next.includes(base)) return next;
  return joinWithoutDuplicateBoundary(base, next);
}
