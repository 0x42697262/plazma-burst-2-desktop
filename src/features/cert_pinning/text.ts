export const TEXT = Object.freeze({
  notPinned: (hostPort: string, fingerprint: string) => `Private server: the certificate at ${hostPort} is not the saved one (got ${fingerprint || 'none'}); not connecting`,
});
