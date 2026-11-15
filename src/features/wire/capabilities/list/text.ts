export const LIST_TEXT = Object.freeze({
  usage: 'wire list',
  desc: 'List every protocol message and its direction',
  row: (name: string, direction: string) => `  ${name}  ${direction}`,
  receiveOnlyMark: '  [receive only]',
  about: ['Every message, in opcode order, with its direction. The ones marked',
    '[receive only] are sent by the server; "wire" refuses to originate them.'],
  see: ['wire', 'wire help'],
});
