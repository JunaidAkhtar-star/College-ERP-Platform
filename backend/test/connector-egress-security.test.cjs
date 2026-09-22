const assert = require("node:assert/strict");
const test = require("node:test");

const {
  isPrivateConnectorAddress,
  safeConnectorUrl,
} = require("../build/services/external-connector.service");

test("connector egress rejects private, special and IPv4-mapped addresses", () => {
  for (const address of [
    "127.0.0.1",
    "10.1.2.3",
    "100.64.0.1",
    "169.254.169.254",
    "172.31.0.1",
    "192.168.1.1",
    "198.18.0.1",
    "::1",
    "fd00::1",
    "fe80::1",
    "::ffff:127.0.0.1",
  ])
    assert.equal(isPrivateConnectorAddress(address), true, address);
  assert.equal(isPrivateConnectorAddress("8.8.8.8"), false);
  assert.equal(isPrivateConnectorAddress("2606:4700:4700::1111"), false);
});

test("connector URLs require HTTPS and reject literal private hosts", () => {
  assert.equal(safeConnectorUrl("https://api.example.com/hook"), "https://api.example.com/hook");
  assert.throws(() => safeConnectorUrl("http://api.example.com/hook"), /HTTPS/i);
  assert.throws(() => safeConnectorUrl("https://169.254.169.254/latest"), /private network/i);
});
