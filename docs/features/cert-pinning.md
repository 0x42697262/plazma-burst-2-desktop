# cert_pinning

Feature flag `cert_pinning` (on by default; local mode only). Code: `src/features/cert_pinning/`.

- The private server being played on is trusted with exactly the certificate saved with
  it in the server list (its SHA-256 fingerprint), and with nothing else.
- Every other site, and that address when no private server is chosen, is checked as
  usual.
- A certificate that is not the saved one is refused, and the error is logged once per
  server.
- In host and p2p-host modes nothing is pinned; those modes log in to the official site
  instead.
- With the flag off, private servers are checked as usual, so a self-signed one cannot
  be joined.
