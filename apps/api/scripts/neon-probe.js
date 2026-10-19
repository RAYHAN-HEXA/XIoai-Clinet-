// Layered Neon connectivity probe: TCP → SSLRequest → TLS → StartupMessage.
// Prints exactly which layer fails. No credentials used; never prints secrets.
const net = require('net');
const tls = require('tls');

const hosts = process.argv.slice(2);
if (hosts.length === 0) {
  console.error('usage: node neon-probe.js <host1> [host2...]');
  process.exit(1);
}

function probe(host) {
  return new Promise((resolve) => {
    const log = (m) => console.log(`  ${m}`);
    const done = (verdict) => {
      log(`VERDICT[${host}]: ${verdict}`);
      resolve();
    };
    log(`--- probing ${host}:5432 ---`);
    const sock = net.connect(5432, host);
    const timer = setTimeout(() => {
      sock.destroy();
      done('STALL at/after SSLRequest (TLS never completed) → likely network/middlebox interference on 5432-TLS, or suspended proxy');
    }, 15000);

    sock.on('error', (e) => {
      clearTimeout(timer);
      done(`TCP ERROR: ${e.message}`);
    });

    sock.on('connect', () => {
      log('TCP connected ✓  → sending Postgres SSLRequest…');
      sock.write(Buffer.from([0, 0, 0, 8, 4, 0xd2, 0x16, 0x2f]));
    });

    sock.once('data', function first(buf) {
      const reply = buf.toString('utf8');
      if (reply.trim() !== 'S') {
        clearTimeout(timer);
        done(`server REJECTED SSL (reply: ${JSON.stringify(reply)})`);
        return;
      }
      log('server said "S" (TLS required) ✓ → starting TLS handshake (SNI on)…');
      const tlsSock = tls.connect(
        { socket: sock, servername: host, rejectUnauthorized: false },
        () => {
          clearTimeout(timer);
          log(`TLS HANDSHAKE OK ✓ (cipher ${tlsSock.getCipher() && tlsSock.getCipher().name})`);
          // Postgres StartupMessage: user/database are dummies — we only need the server's reaction
          const user = 'probe_user';
          const db = 'postgres';
          const body = Buffer.from(`user\0${user}\0database\0${db}\0\0`, 'utf8');
          const len = Buffer.alloc(4);
          len.writeInt32BE(body.length + 4, 0);
          tlsSock.write(Buffer.concat([len, body]));
          let responded = false;
          tlsSock.on('data', (d) => {
            responded = true;
            const code = d.length > 0 ? String.fromCharCode(d[0]) : '?';
            // 'E' = error (expected: password auth request 'R' or role-not-found 'E' both prove protocol works)
            log(`server responded to StartupMessage ✓ (message type '${code}') — Postgres protocol fully reachable`);
            tlsSock.end();
            clearTimeout(timer);
            done('FULL PATH OK — TCP+TLS+PG protocol all work; Prisma issue must be auth/config-level');
          });
          tlsSock.on('close', () => {
            if (!responded) {
              clearTimeout(timer);
              done('TLS ok but server closed before StartupMessage reply — compute suspended/waking or proxy misroute');
            }
          });
        }
      );
      tlsSock.on('error', (e) => {
        clearTimeout(timer);
        done(`TLS HANDSHAKE FAILED: ${e.message} → middlebox resetting TLS on 5432, or proxy unreachable`);
      });
    });
  });
}

(async () => {
  for (const h of hosts) await probe(h);
  process.exit(0);
})();
