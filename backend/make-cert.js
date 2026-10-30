// Run on its own by https.js, never required by the server. The certificate
// library is loaded here, in a process of its own, because loading it next to
// better-sqlite3 in the server's process made Node crash on this machine.
const fs = require('fs');
const path = require('path');
const selfsigned = require('selfsigned');

const [dir, addressesJson] = process.argv.slice(2);
const addresses = JSON.parse(addressesJson);

(async () => {
  const now = Date.now();
  const pems = await selfsigned.generate([{ name: 'commonName', value: 'Order Bill Manager' }], {
    algorithm: 'sha256',
    notBeforeDate: new Date(now - 24 * 3600 * 1000),
    notAfterDate: new Date(now + 3650 * 24 * 3600 * 1000),
    extensions: [
      { name: 'basicConstraints', cA: false },
      { name: 'keyUsage', digitalSignature: true, keyEncipherment: true, critical: true },
      { name: 'extKeyUsage', serverAuth: true },
      {
        name: 'subjectAltName',
        altNames: [
          { type: 2, value: 'localhost' },
          { type: 7, ip: '::1' },
          ...addresses.map((ip) => ({ type: 7, ip })),
        ],
      },
    ],
  });
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'key.pem'), pems.private, { mode: 0o600 });
  fs.writeFileSync(path.join(dir, 'cert.pem'), pems.cert);
  fs.writeFileSync(path.join(dir, 'addresses.json'), JSON.stringify(addresses));
})().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
