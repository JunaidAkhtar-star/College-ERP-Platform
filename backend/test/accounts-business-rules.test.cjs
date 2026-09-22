const assert = require("node:assert/strict");
const test = require("node:test");
const {
  financialYearForDate,
  manualJournalLines,
} = require("../build/services/accounts.service.js");

test("maps transaction dates to the Indian April-March financial year", () => {
  assert.equal(financialYearForDate(new Date(2026, 2, 31)), "2025-26");
  assert.equal(financialYearForDate(new Date(2026, 3, 1)), "2026-27");
});

test("posts manual cash income as asset debit and income credit", () => {
  const lines = manualJournalLines({
    transactionType: "income",
    category: "Grant",
    amount: 1250.555,
    paymentMode: "cash",
  });
  assert.deepEqual(
    lines.map(({ accountCode, debit = 0, credit = 0 }) => ({ accountCode, debit, credit })),
    [
      { accountCode: "1000-CASH", debit: 1250.56, credit: 0 },
      { accountCode: "49-GRANT", debit: 0, credit: 1250.56 },
    ],
  );
});

test("posts manual bank expense as expense debit and asset credit", () => {
  const lines = manualJournalLines({
    transactionType: "expense",
    category: "IT & Software",
    amount: 500,
    paymentMode: "upi",
  });
  assert.equal(lines[0].accountCode, "59-IT-SOFTWARE");
  assert.equal(lines[0].debit, 500);
  assert.equal(lines[1].accountCode, "1010-BANK");
  assert.equal(lines[1].credit, 500);
});
