export const ALL_TEXT = Object.freeze({
  usage: 'netlog all [on | off]',
  description: 'Log everything: every packet (PKT) and every state update (net_log_all, off by default)',
  about: [
    'The same as "net_log_all". On, every packet sent and received gets a PKT line (its',
    'size, ack, how many parts its state has, which reliable messages it carries), and',
    'every unreliable state update is written decoded (STATE), and no message is cut',
    '(without it a part over 2000 characters is). Alone it says on or off.',
    '60 to 250 packets a second each way in a match: the files grow fast.',
  ],
  examples: [['netlog all on', 'log everything: every packet and state update']],
  see: ['net_log_all', 'net_log_state'],
  value: (on: boolean) => `net_log_all = ${on ? 'on' : 'off'}`,
  header: (on: boolean) => `Everything (every packet and state update): ${on ? 'on' : 'off'} (net_log_all).`,
});
