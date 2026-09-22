const test = require("node:test");
const assert = require("node:assert/strict");
const { validateFormPayload } = require("../build/services/form-workflow.service.js");

const fields = [
  { key: "email", label: "Email", type: "email", required: true },
  { key: "amount", label: "Amount", type: "number", required: true, min: 1, max: 1000 },
  { key: "category", label: "Category", type: "select", required: true, options: ["A", "B"] },
  { key: "confirmed", label: "Confirmed", type: "checkbox", required: false },
];

test("form payload validation normalizes governed values", () => {
  assert.deepEqual(
    validateFormPayload(fields, {
      email: " user@example.edu ",
      amount: "125.50",
      category: "A",
      confirmed: true,
    }),
    { email: "user@example.edu", amount: 125.5, category: "A", confirmed: true },
  );
});

test("form payload rejects unknown fields and invalid select values", () => {
  assert.throws(
    () => validateFormPayload(fields, { email: "x@y.com", amount: 5, category: "A", injected: true }),
    /Unknown form fields/,
  );
  assert.throws(
    () => validateFormPayload(fields, { email: "x@y.com", amount: 5, category: "C" }),
    /invalid selection/,
  );
});
