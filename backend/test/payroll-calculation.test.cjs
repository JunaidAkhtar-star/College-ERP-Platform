const assert = require("node:assert/strict");
const test = require("node:test");
const { calculatePayrollFromPolicy } = require("../build/services/payroll.service.js");

const policy = {
  daPercent: 10,
  hraPercent: 20,
  transportAllowance: 3100,
  employeePfPercent: 12,
  pfWageCeiling: 15000,
  professionalTax: 200,
  standardDeduction: 0,
  taxSlabs: [
    { from: 0, to: 300000, ratePercent: 0 },
    { from: 300000, to: 600000, ratePercent: 10 },
    { from: 600000, ratePercent: 20 },
  ],
};

test("prorates payroll components using actual calendar and payable days", () => {
  const result = calculatePayrollFromPolicy(31000, 15, 7, 2026, policy);
  assert.equal(result.earnedBasic, 15000);
  assert.equal(result.da, 1500);
  assert.equal(result.hra, 3000);
  assert.equal(result.ta, 1500);
  assert.equal(result.pf, 1800);
  assert.equal(result.pt, 200);
  assert.equal(result.grossPay, 21000);
  assert.equal(result.netPay, result.grossPay - result.totalDeductions);
});

test("applies progressive annual tax slabs and converts annual tax to monthly TDS", () => {
  const result = calculatePayrollFromPolicy(50000, 31, 7, 2026, policy);
  // Gross = 50,000 + 5,000 + 10,000 + 3,100 = 68,100; annual = 817,200.
  // Tax = 30,000 on 300k-600k + 43,440 on the remaining 217,200.
  assert.equal(result.tds, Math.round(73440 / 12));
});

test("rejects payable days greater than the selected calendar month", () => {
  assert.throws(
    () => calculatePayrollFromPolicy(30000, 30, 2, 2026, policy),
    /Payable days must be between 0 and 28/,
  );
});
