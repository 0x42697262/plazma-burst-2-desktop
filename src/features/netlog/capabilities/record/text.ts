export const RECORD_TEXT = Object.freeze({
  on: Object.freeze({
    usage: 'netlog on',
    description: 'Record the network log (net_log on, the default)',
    about: ['The same as "net_log on". Connections already open are recorded from now on.'],
    see: ['net_log'],
  }),
  off: Object.freeze({
    usage: 'netlog off',
    description: 'Stop recording the network log (net_log off)',
    about: ['The same as "net_log off". The game\'s connections are left exactly as they were.'],
    examples: [['netlog off', 'stop recording (net_log off)']],
    see: ['net_log'],
  }),
  hint: (on: boolean) => `"netlog ${on ? 'off' : 'on'}"`,
});
