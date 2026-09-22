const assert = require("node:assert/strict");
const test = require("node:test");

const { invoiceMatch, validateQuoteTotals } = require("../build/services/procure-to-pay.service");

test("quotation totals must reconcile exactly to subtotal plus tax", () => {
  assert.deepEqual(validateQuoteTotals({ subtotal: 1000, taxAmount: 180, totalAmount: 1180 }), {
    subtotal: 1000,
    taxAmount: 180,
    totalAmount: 1180,
  });
  assert.throws(
    () => validateQuoteTotals({ subtotal: 1000, taxAmount: 180, totalAmount: 1200 }),
    /subtotal and tax must equal/i,
  );
});

test("three-way match requires accepted quantity and bounded invoice value", () => {
  assert.deepEqual(
    invoiceMatch({
      invoiceTotal: 1180,
      remainingPoAmount: 1180,
      acceptedQuantity: 10,
      poQuantity: 10,
    }),
    { variance: 0, matched: true },
  );
  assert.equal(
    invoiceMatch({
      invoiceTotal: 1180,
      remainingPoAmount: 1180,
      acceptedQuantity: 9,
      poQuantity: 10,
    }).matched,
    false,
  );
  assert.equal(
    invoiceMatch({
      invoiceTotal: 1300,
      remainingPoAmount: 1180,
      acceptedQuantity: 10,
      poQuantity: 10,
    }).matched,
    false,
  );
});
