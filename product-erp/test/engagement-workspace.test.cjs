const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.join(__dirname, '..', 'src');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

test('engagement pages expose one connected plan-to-participation journey', () => {
  const pages = [
    'features/role-wise-features/communication-hub/components/CommunicationHubPage.tsx',
    'features/role-wise-features/notice/components/NoticePage.tsx',
    'features/role-wise-features/event/components/EventPage.tsx',
    'features/role-wise-features/clubs/components/ClubsPage.tsx',
    'features/role-wise-features/meeting/components/MeetingPage.tsx',
    'features/role-wise-features/collaboration/components/CollaborationPage.tsx',
  ];
  for (const page of pages) {
    assert.match(read(page), /EngagementWorkflowBar/);
  }
});

test('event and notice workflows use governed fields and live targeting', () => {
  const modal = read('features/role-wise-features/event/components/EventModal.tsx');
  const notice = read('features/role-wise-features/notice/components/NoticeModal.tsx');
  assert.match(modal, /eventType/);
  assert.match(modal, /targetAudience/);
  assert.match(modal, /type="users"/);
  assert.doesNotMatch(modal, /name="organizer"|name="status"/);
  assert.match(notice, /communication-hub\/metadata/);
  assert.doesNotMatch(notice, /Department IDs|comma-separated|dept_id/);
});

test('clubs and campaigns use searchable people instead of technical identifiers', () => {
  const clubs = read('features/role-wise-features/clubs/components/ClubsPage.tsx');
  const campaigns = read(
    'features/role-wise-features/communication-hub/components/CommunicationHubPage.tsx',
  );
  assert.match(clubs, /type="faculty"/);
  assert.match(clubs, /type="students"/);
  assert.match(clubs, /type="users"/);
  assert.doesNotMatch(clubs, /Open form to add new club/);
  assert.match(campaigns, /specific_users/);
  assert.match(campaigns, /targetUserIds/);
  assert.match(campaigns, /Delivery failures/);
});

test('collaboration is a guided searchable workspace with evidence and governed moderation', () => {
  const collaboration = read(
    'features/role-wise-features/collaboration/components/CollaborationPage.tsx',
  );
  assert.match(collaboration, /Search collaboration workspace/);
  assert.match(collaboration, /No matching conversations/);
  assert.match(collaboration, /Supporting files \(optional\)/);
  assert.match(collaboration, /Whole institution/);
  assert.match(collaboration, /isPinned/);
  assert.match(collaboration, /isLocked/);
  assert.doesNotMatch(collaboration, /Department IDs|User IDs|Mongo/);
});
