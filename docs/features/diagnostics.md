# diagnostics

Feature flag `diagnostics` (on by default; all modes). Code: `src/features/diagnostics/`.
Capabilities: `diagnostics.capture`, `diagnostics.show`, `diagnostics.send`,
`diagnostics.login`, `diagnostics.cookies`, `diagnostics.ips`.

## What is captured
- In the game page: uncaught errors and unhandled promise rejections
  (`src/features/diagnostics/page.ts`). The listeners add no globals.
- In the main process: uncaught exceptions (through Node's monitor event, so the app's
  normal crash behavior does not change) and a game page process that ended other than
  cleanly.
- By hand: `diagnostics report <note>`.

The same report within a minute is not saved twice, and at most 10 are saved a minute: a
game that throws every frame cannot fill the disk. The page's route refuses remote play
windows and accepts only the two page kinds from a page.

## What a report holds
`schemaVersion`, `id`, `time`, `kind`, `client`, `appVersion`, `edition`, `gameVersion`,
`flags` (the features and capabilities that are on), `login` (the active account's login, or
`null`; capability `diagnostics.login`), `cookies` (`login`, `password`, and `pb2uid`;
capability `diagnostics.cookies`), `ips` (this machine's non-internal IP
addresses; capability `diagnostics.ips`) and `error` (`name`, `message`, `stack`, `source`,
`line`, `column`).

Every text is redacted before it is saved (`domain/redact.ts`). The password, token and
authorization values, bearer tokens, 32-digit md5 digests (the official site's `password`
cookie is one, and it works as the password) are not removed, except home folders. Login names, `pb2uid` and IP
addresses are kept.

## Where
`data/diagnostics/reports.json`, readable only by you, the newest 50.

## Commands
- `diagnostics` or `diagnostics status`: is capture on, how many reports are saved.
- `diagnostics show [<#> | last]`: the list, or one report in full.
- `diagnostics report [<note>]`: save one by hand.
- `diagnostics clear`: delete them.
- `diagnostics send`: send the saved reports to the server now.
- `diagnostics send preview`: print exactly what would be sent, and send nothing.
- `diagnostics config`: the server, the fields and whether sending is automatic.

## Sending and its settings
Nothing leaves the machine until a server is set. `data/diagnostics.json`
(`data/diagnostics.example.json` is a template; read at each use, so a change needs no
restart):

```json
{
  "host": "https://reports.example.test/pb2",
  "send": ["kind", "client", "error"],
  "auto": false,
  "keys": [{ "kid": "2026-02", "key": "base64 X25519 public key, 32 bytes" }]
}
```

| Key | What | Default |
|---|---|---|
| `host` | Where reports are POSTed: `https://`, or `http://` only for this machine | none: nothing is sent |
| `send` | Which of `kind`, `client`, `appVersion`, `edition`, `gameVersion`, `flags`, `login`, `cookies`, `ips`, `error` leave (a field whose capability is off is left out). `id`, `time` and `schemaVersion` always do | all of them |
| `auto` | Send each report when it is saved, instead of waiting for `diagnostics send` | `false` |
| `keys` | The public keys to seal reports to, `kid` and a 32-byte base64 X25519 key; the first one is used | none: reports leave as plain JSON |

- The order is `PB2_DIAGNOSTICS_URL` and `PB2_DIAGNOSTICS_KEY` (the server and its key),
  then this file, then the edition's `diagnostics` values, then the defaults above.
- The console shows the settings but cannot change them: a lobby server's code can run in
  the game page ([fingerprinting](../research/fingerprinting.md) §9), and it must not be
  able to point reports at its own server.
- The body is `{ "schemaVersion": 1, "reports": [...] }`, or the sealed form below, at most
  50 reports at a time. Any 2xx answer removes them from the queue; anything else keeps them.
  The call times out after 10 seconds.

## Sealing the reports
With a public key set, every report is sealed before it leaves: the body holds no login, no
password and no error text, and only the holder of the private key can read it. A network
sniffer, the receiver's disk and whoever runs the receiver get ciphertext.

- One report at a time: an ephemeral X25519 key, ECDH with the public key, HKDF-SHA256
  (`pb2-diag`) to a 32-byte key, AES-256-GCM with a random 12-byte IV, tag appended to the
  ciphertext. The body becomes
  `{ "schemaVersion": 2, "reports": [ { "k": kid, "e": …, "n": …, "c": … } ] }`, base64.
- The first key is used; `kid` says which one, so the receiver can rotate keys and still read
  older reports. Nothing is re-encrypted: what is already saved stays as it was.
- A key that is not 32 base64 bytes stops sending entirely instead of falling back to plain
  JSON, and `diagnostics config` names it. `diagnostics send preview` shows the sealed body,
  so it is unreadable there too.
- Not hidden: the address, the time, how many reports, and their size. The receiver has the
  plaintext, so encrypt its disk or delete reports after reading them.
- Python 3, with `cryptography` installed (`pip install cryptography`):

```python
import base64, json
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.asymmetric.x25519 import X25519PrivateKey, X25519PublicKey
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from cryptography.hazmat.primitives.kdf.hkdf import HKDF

def open_report(sealed: dict, private_key: X25519PrivateKey) -> dict:
    ephemeral = X25519PublicKey.from_public_bytes(base64.b64decode(sealed["e"]))
    shared = private_key.exchange(ephemeral)
    key = HKDF(algorithm=hashes.SHA256(), length=32, salt=b"", info=b"pb2-diag").derive(shared)
    plain = AESGCM(key).decrypt(base64.b64decode(sealed["n"]), base64.b64decode(sealed["c"]), None)
    return json.loads(plain)
```

The receiver's key pair, once:

```python
from cryptography.hazmat.primitives.asymmetric.x25519 import X25519PrivateKey
import base64
private_key = X25519PrivateKey.generate()
print(base64.b64encode(private_key.public_key().public_bytes_raw()).decode())
```

## Hidden in an edition
By default the feature is shown: it has its console command and writes log lines. Only an
edition file can hide it ([editions](../operations/editions.md#diagnostics-settings)). No
setting, flag, environment variable or console command can. Hidden, it still captures, and
sends if a server is set, but:
- the `diagnostics` command and its help are left out of the console bundle;
- it writes no log lines, also not its requests at `--log-level=debug`;
- `features` and `--features` do not list it.

Nothing then tells a player that reports leave their machine. An edition that is hidden
and also sets a `host` should say so to its players somewhere else, such as in its release
notes or privacy text.
