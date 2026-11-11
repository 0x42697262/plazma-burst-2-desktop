export const SEND_TEXT = Object.freeze({
  sendUsage: 'diagnostics send [preview]',
  sendDescription: 'Send the saved reports to the server, or print what would be sent',
  sendAbout: ['Sends the saved reports to the server in data/diagnostics.json. With "preview", or with no server set, prints exactly what would be sent and sends nothing.'],
  configUsage: 'diagnostics config',
  configDescription: 'The server, what is sent, and whether sending is automatic',
  configAbout: ['Set in data/diagnostics.json ("host", "send", "auto", "keys"). PB2_DIAGNOSTICS_URL overrides the server and PB2_DIAGNOSTICS_KEY the key. The console shows them but cannot change them.'],
  host: (host: string | null) => `Server: ${host ?? 'none, so nothing is sent'}`,
  fields: (fields: readonly string[]) => `Sent: id, time, schemaVersion, ${fields.join(', ')}`,
  auto: (isOn: boolean) => `Automatic: ${isOn ? 'on, each report as it is saved' : 'off, only with diagnostics send'}`,
  sealed: (kids: readonly string[]) => (kids.length
    ? `Encryption: on, sealed to the key ${kids.join(', ')} (x25519, AES-256-GCM)`
    : 'Encryption: off, the reports leave as plain JSON'),
  problem: (problem: string) => `Problem: ${problem}`,
  sent: (count: number, pending: number, host: string) => `Sent ${count} to ${host}; ${pending} left.`,
  noServer: 'No server set (data/diagnostics.json "host"). This is what would be sent:',
  nothing: 'No reports to send.',
  failed: (message: string, pending: number) => `Not sent: ${message}. ${pending} kept.`,
  couldNot: (message: string) => `Diagnostics: ${message || 'desktop wrapper only'}`,
});
