export const FINGERPRINT_TEXT = Object.freeze({
  fingerprintUsage: 'usage: servers fingerprint <address>',
  fingerprintLine: (address: string, fingerprint: string) => `${address}: ${fingerprint}`,
  usage: 'servers fingerprint <address>',
  desc: 'The certificate fingerprint a server shows (compare it with the host\'s)',
  about: ['Only the TLS handshake: nothing is sent to the server.'],
  examples: [['servers fingerprint 192.168.1.20:2053', '']],
});
