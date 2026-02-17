const ALLOWED_LITERAL = /^[A-Z0-9\-_/\.]*$/;
const MAX_RESULT_LENGTH = 32;
const MAX_SEQUENCE = 99999999;

function sanitizeBizSlug(name) {
  const source = typeof name === "string" ? name : "";
  const upper = source.toUpperCase();
  const dashed = upper.replace(/\s+/g, "-");
  const cleaned = dashed.replace(/[^A-Z0-9-]/g, "");
  return cleaned;
}

function validateInvoicePattern({ pattern, resetPeriod, bizName }) {
  if (typeof pattern !== "string" || pattern.length === 0) {
    return { ok: false, error: "PATTERN_INVALID_CHARS" };
  }

  const seqMatches = [...pattern.matchAll(/\{SEQ:(\d+)\}/g)];
  if (seqMatches.length === 0) {
    return { ok: false, error: "PATTERN_MISSING_SEQ" };
  }
  if (seqMatches.length > 1) {
    return { ok: false, error: "PATTERN_MULTIPLE_SEQ" };
  }

  const seqPad = Number(seqMatches[0][1]);
  if (!Number.isInteger(seqPad) || seqPad < 2 || seqPad > 8) {
    return { ok: false, error: "SEQ_PADDING_INVALID" };
  }

  const hasYYYY = pattern.includes("{YYYY}");
  const hasYY = pattern.includes("{YY}");
  const hasMM = pattern.includes("{MM}");
  const hasDD = pattern.includes("{DD}");
  const hasBIZ = pattern.includes("{BIZ}");

  if (hasYYYY && hasYY) {
    return { ok: false, error: "PATTERN_CONFLICT_YEAR" };
  }

  if ((hasMM || hasDD) && !(hasYYYY || hasYY)) {
    return { ok: false, error: "PATTERN_DATE_WITHOUT_YEAR" };
  }

  if (resetPeriod === "monthly" && !hasMM) {
    return { ok: false, error: "PATTERN_MONTH_REQUIRED" };
  }

  if (resetPeriod === "yearly" && !(hasYYYY || hasYY)) {
    return { ok: false, error: "PATTERN_YEAR_REQUIRED" };
  }

  if (hasBIZ) {
    const slug = sanitizeBizSlug(bizName);
    if (!slug) {
      return { ok: false, error: "BIZ_SLUG_EMPTY" };
    }
  }

  const stripped = pattern
    .replace(/\{YYYY\}/g, "")
    .replace(/\{YY\}/g, "")
    .replace(/\{MM\}/g, "")
    .replace(/\{DD\}/g, "")
    .replace(/\{BIZ\}/g, "")
    .replace(/\{SEQ:\d+\}/g, "");

  if (/[{}]/.test(stripped)) {
    return { ok: false, error: "PATTERN_INVALID_CHARS" };
  }

  if (!ALLOWED_LITERAL.test(stripped)) {
    return { ok: false, error: "PATTERN_INVALID_CHARS" };
  }

  return { ok: true };
}

function previewInvoiceNumber({ pattern, resetPeriod, issueDate, sequence, bizName }) {
  const validation = validateInvoicePattern({ pattern, resetPeriod, bizName });
  if (!validation.ok) {
    return validation;
  }

  const seq = Number(sequence);
  if (!Number.isInteger(seq) || seq < 0) {
    return { ok: false, error: "SEQ_PADDING_INVALID" };
  }

  if (seq > MAX_SEQUENCE) {
    return { ok: false, error: "SEQ_OVERFLOW" };
  }

  const seqMatch = pattern.match(/\{SEQ:(\d+)\}/);
  const pad = Number(seqMatch[1]);
  const paddedSeq = seq.toString().padStart(pad, "0");

  const date = issueDate ? new Date(issueDate) : new Date();
  const year = date.getUTCFullYear().toString();
  const year2 = year.slice(-2);
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  const bizSlug = pattern.includes("{BIZ}") ? sanitizeBizSlug(bizName) : "";

  let result = pattern;
  result = result.replace(/\{YYYY\}/g, year);
  result = result.replace(/\{YY\}/g, year2);
  result = result.replace(/\{MM\}/g, month);
  result = result.replace(/\{DD\}/g, day);
  result = result.replace(/\{BIZ\}/g, bizSlug);
  result = result.replace(/\{SEQ:\d+\}/g, paddedSeq);

  if (result.length > MAX_RESULT_LENGTH) {
    return { ok: false, error: "PATTERN_TOO_LONG" };
  }

  return { ok: true, value: result };
}

module.exports = {
  validateInvoicePattern,
  previewInvoiceNumber,
  sanitizeBizSlug,
};
