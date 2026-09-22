const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(
  path.join(root, 'src/features/role-wise-features/hostel/components/HostelPage.tsx'),
  'utf8',
);

test('hostel staff roles receive the governed operational workspace', () => {
  assert.match(source, /\['super_admin', 'admin', 'principal', 'hostel_warden'\]\.includes\(activeRole/);
  assert.match(source, /selectedRole\?\.baseRole/);
  assert.match(source, /Allocate Room/);
});

test('hostel allocation uses dynamic students and academic years', () => {
  assert.match(source, /type="students"/);
  assert.match(source, /type="academicYears"/);
  assert.match(source, /hostel\/allocations/);
  assert.doesNotMatch(source, /MongoDB ObjectId|Student ID \*|Room ID \*/);
});

test('student allocation uses the owned endpoint', () => {
  assert.match(
    source,
    /isStudent \? 'hostel\/allocations\/my' : 'hostel\/allocations'/,
  );
});

test('visitor, complaint and fee payloads match authoritative contracts', () => {
  assert.match(source, /visitorPhone/);
  assert.match(source, /value="cleanliness"/);
  assert.match(source, /status: 'resolved', resolution:/);
  assert.match(source, /allocation.*approved fee terms/i);
  assert.doesNotMatch(source, /getFieldProps\('receiptNo'\)/);
});

test('room availability and receipts are derived instead of manually edited', () => {
  assert.match(source, /room\.occupancy >= room\.capacity/);
  assert.match(source, /official receipt number is generated automatically/i);
});
