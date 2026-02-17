const test = require("node:test");
const assert = require("node:assert/strict");
const { validateInvoicePattern, previewInvoiceNumber } = require("../src/invoice-numbering/validator");

test("monthly reset requires MM", () => {
  const result = validateInvoicePattern({
    pattern: "INV-{YYYY}-{SEQ:4}",
    resetPeriod: "monthly",
  });
  assert.deepStrictEqual(result, { ok: false, error: "PATTERN_MONTH_REQUIRED" });
});

test("yearly reset with YY/MM is valid", () => {
  const result = validateInvoicePattern({
    pattern: "INV-{YY}{MM}-{SEQ:4}",
    resetPeriod: "yearly",
  });
  assert.deepStrictEqual(result, { ok: true });
});

test("date token without year is invalid", () => {
  const result = validateInvoicePattern({
    pattern: "INV-{MM}-{SEQ:4}",
    resetPeriod: "none",
  });
  assert.deepStrictEqual(result, { ok: false, error: "PATTERN_DATE_WITHOUT_YEAR" });
});

test("SEQ padding below minimum is invalid", () => {
  const result = validateInvoicePattern({
    pattern: "INV-{YYYY}-{SEQ:1}",
    resetPeriod: "yearly",
  });
  assert.deepStrictEqual(result, { ok: false, error: "SEQ_PADDING_INVALID" });
});

test("SEQ padding above maximum is invalid", () => {
  const result = validateInvoicePattern({
    pattern: "INV-{YYYY}-{SEQ:10}",
    resetPeriod: "yearly",
  });
  assert.deepStrictEqual(result, { ok: false, error: "SEQ_PADDING_INVALID" });
});

test("multiple SEQ tokens are invalid", () => {
  const result = validateInvoicePattern({
    pattern: "INV-{YYYY}-{SEQ:4}-{SEQ:4}",
    resetPeriod: "yearly",
  });
  assert.deepStrictEqual(result, { ok: false, error: "PATTERN_MULTIPLE_SEQ" });
});

test("conflicting year tokens are invalid", () => {
  const result = validateInvoicePattern({
    pattern: "INV-{YYYY}-{YY}-{SEQ:4}",
    resetPeriod: "yearly",
  });
  assert.deepStrictEqual(result, { ok: false, error: "PATTERN_CONFLICT_YEAR" });
});

test("BIZ token requires non-empty slug", () => {
  const result = validateInvoicePattern({
    pattern: "INV-{BIZ}-{SEQ:4}",
    resetPeriod: "none",
    bizName: "",
  });
  assert.deepStrictEqual(result, { ok: false, error: "BIZ_SLUG_EMPTY" });
});

test("sequence longer than padding is not truncated", () => {
  const result = previewInvoiceNumber({
    pattern: "INV-{YYYY}-{SEQ:4}",
    resetPeriod: "yearly",
    issueDate: "2026-02-05",
    sequence: 10000,
  });
  assert.equal(result.ok, true);
  assert.equal(result.value.endsWith("-10000"), true);
});

test("sequence overflow fails", () => {
  const result = previewInvoiceNumber({
    pattern: "INV-{YYYY}-{SEQ:8}",
    resetPeriod: "yearly",
    issueDate: "2026-02-05",
    sequence: 100000000,
  });
  assert.deepStrictEqual(result, { ok: false, error: "SEQ_OVERFLOW" });
});
