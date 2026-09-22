const assert = require("node:assert/strict");
const test = require("node:test");
const { generalLedgerService } = require("../build/services/general-ledger.service.js");

const base = {
  date: new Date("2026-07-18T00:00:00.000Z"),
  financialYear: "2026-27",
  description: "Invariant test",
  sourceType: "Test",
  sourceId: "507f1f77bcf86cd799439011",
  sourceEvent: "test-event",
  postedBy: "507f1f77bcf86cd799439012",
};

test("rejects an unbalanced journal before database posting", async () => {
  await assert.rejects(
    generalLedgerService.postJournal({
      ...base,
      lines: [
        {
          accountCode: "1000-CASH",
          accountName: "Cash",
          accountType: "asset",
          debit: 100,
        },
        {
          accountCode: "4000-INCOME",
          accountName: "Income",
          accountType: "income",
          credit: 99,
        },
      ],
    }),
    (error) => error.status === 400 && /balance/.test(error.message),
  );
});

test("rejects a journal line containing both debit and credit", async () => {
  await assert.rejects(
    generalLedgerService.postJournal({
      ...base,
      lines: [
        {
          accountCode: "1000-CASH",
          accountName: "Cash",
          accountType: "asset",
          debit: 100,
          credit: 100,
        },
        {
          accountCode: "4000-INCOME",
          accountName: "Income",
          accountType: "income",
          credit: 100,
        },
      ],
    }),
    (error) => error.status === 400 && /one positive debit or credit/.test(error.message),
  );
});
