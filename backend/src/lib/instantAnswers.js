// Resolve common answers locally. The current server handler still sends
// the query to configured search providers after calling this helper.

const UNIT_TABLE = {
  m: 1, meter: 1, meters: 1, metre: 1, metres: 1,
  km: 1000, kilometer: 1000, kilometers: 1000,
  cm: 0.01, centimeter: 0.01, centimeters: 0.01,
  mm: 0.001, millimeter: 0.001, millimeters: 0.001,
  mi: 1609.344, mile: 1609.344, miles: 1609.344,
  yd: 0.9144, yard: 0.9144, yards: 0.9144,
  ft: 0.3048, foot: 0.3048, feet: 0.3048,
  in: 0.0254, inch: 0.0254, inches: 0.0254,
  g: 1, gram: 1, grams: 1,
  kg: 1000, kilogram: 1000, kilograms: 1000,
  lb: 453.592, lbs: 453.592, pound: 453.592, pounds: 453.592,
  oz: 28.3495, ounce: 28.3495, ounces: 28.3495,
};
const LENGTH_UNITS = new Set(["m","meter","meters","metre","metres","km","kilometer","kilometers","cm","centimeter","centimeters","mm","millimeter","millimeters","mi","mile","miles","yd","yard","yards","ft","foot","feet","in","inch","inches"]);
const MASS_UNITS = new Set(["g","gram","grams","kg","kilogram","kilograms","lb","lbs","pound","pounds","oz","ounce","ounces"]);

function tryUnitConversion(query) {
  const m = query.trim().toLowerCase().match(/^([\d.,]+)\s*([a-z]+)\s+(?:to|in)\s+([a-z]+)$/);
  if (!m) return null;
  const [, numStr, fromRaw, toRaw] = m;
  const amount = parseFloat(numStr.replace(/,/g, ""));
  if (!(fromRaw in UNIT_TABLE) || !(toRaw in UNIT_TABLE)) return null;

  const bothLength = LENGTH_UNITS.has(fromRaw) && LENGTH_UNITS.has(toRaw);
  const bothMass = MASS_UNITS.has(fromRaw) && MASS_UNITS.has(toRaw);
  if (!bothLength && !bothMass) return null;

  const base = amount * UNIT_TABLE[fromRaw];
  const converted = base / UNIT_TABLE[toRaw];
  return { type: "unit-conversion", text: `${amount} ${fromRaw} = ${Number(converted.toPrecision(6))} ${toRaw}` };
}

function tryCalculator(query) {
  const q = query.trim();
  if (!/^[\d\s.+\-*/^%()]+$/.test(q) || !/\d/.test(q)) return null;
  if (!/[+\-*/^%]/.test(q)) return null;
  try {
    const safe = q.replace(/\^/g, "**");
    const tokens = safe.match(/\d+(\.\d+)?|\*\*|[+\-*/%()]/g);
    if (!tokens) return null;
    const rebuilt = tokens.join(" ");
    const result = Function(`"use strict"; return (${rebuilt});`)();
    if (typeof result !== "number" || !Number.isFinite(result)) return null;
    return { type: "calculator", text: `${q} = ${result}` };
  } catch {
    return null;
  }
}

function tryTimeDate(query) {
  const q = query.trim().toLowerCase();
  if (!/^(what('?s| is)? the )?(time|date|day)( is it)?( today| now)?\??$/.test(q)) return null;
  const now = new Date();
  return { type: "time", text: now.toUTCString() + " (server time, UTC — your device clock may differ)" };
}

export function resolveInstantAnswer(query) {
  return tryUnitConversion(query) || tryCalculator(query) || tryTimeDate(query) || null;
}
