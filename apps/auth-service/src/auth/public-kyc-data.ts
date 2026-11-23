/** Provider responses can include an unrelated identity when a submitted PAN mismatches. */
export function publicKycData(value: unknown): unknown {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return value;
  const data = value as Record<string, any>;
  if (!data.alankitLookup) return value;
  const { response: _response, ...lookup } = data.alankitLookup;
  return { ...data, alankitLookup: lookup };
}
