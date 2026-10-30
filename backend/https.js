const fs = require('fs');
const os = require('os');
const path = require('path');
const https = require('https');
const { execFile } = require('child_process');

const DIR = path.join(__dirname, 'certs');

// Every address this machine answers on. The certificate names them all, so a
// phone that opens https://192.168.x.x:4443 is talking to a name the
// certificate actually covers.
function localAddresses() {
  const out = new Set(['127.0.0.1']);
  for (const list of Object.values(os.networkInterfaces())) {
    for (const a of list || []) if (a.family === 'IPv4' && !a.internal) out.add(a.address);
  }
  return [...out].sort();
}

/**
 * A certificate for this machine, made once and reused. Browsers only hand out
 * the file-sharing sheet (the thing that attaches a PDF to WhatsApp) on https,
 * and a shop has no domain name to get a real certificate for — so this one is
 * self-signed: the phone shows a warning the first time and remembers the answer.
 *
 * It is made again only when the machine's addresses change, since a certificate
 * that does not name the address in the URL is refused outright.
 */
async function certificate() {
  const addresses = localAddresses();
  const keyFile = path.join(DIR, 'key.pem');
  const certFile = path.join(DIR, 'cert.pem');
  const stampFile = path.join(DIR, 'addresses.json');

  try {
    const stamp = JSON.parse(fs.readFileSync(stampFile, 'utf8'));
    if (JSON.stringify(stamp) === JSON.stringify(addresses)) {
      return { key: fs.readFileSync(keyFile), cert: fs.readFileSync(certFile) };
    }
  } catch {
    // Nothing made yet, or unreadable: make it.
  }

  await new Promise((resolve, reject) => {
    execFile(
      process.execPath,
      [path.join(__dirname, 'make-cert.js'), DIR, JSON.stringify(addresses)],
      (err, _out, stderr) => (err ? reject(new Error(stderr.trim() || err.message)) : resolve())
    );
  });
  return { key: fs.readFileSync(keyFile), cert: fs.readFileSync(certFile) };
}

/**
 * Serves `app` over https as well as http. Never fatal: if the certificate
 * cannot be made or the port is taken the shop carries on over plain http, and
 * the only thing lost is attaching the PDF in one tap.
 */
async function listenSecure(app, port) {
  try {
    const server = https.createServer(await certificate(), app);
    server.on('error', (err) => {
      console.log(`  (https on ${port} is off: ${err.code || err.message})`);
    });
    server.listen(port, () => {
      const all = localAddresses().filter((a) => a !== '127.0.0.1');
      // The shop wi-fi, not a VPN address, is the one a phone on the counter uses.
      const first = all.find((a) => /^(192\.168|10\.|172\.(1[6-9]|2\d|3[01])\.)/.test(a)) || all[0];
      console.log(`Phones that need to share the PDF: https://${first || 'localhost'}:${port}`);
    });
    return server;
  } catch (err) {
    console.log(`  (https is off: ${err.message})`);
    return null;
  }
}

module.exports = { listenSecure };
