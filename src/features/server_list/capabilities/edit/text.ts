export const EDIT_TEXT = Object.freeze({
  changedWord: 'Changed',
  officialNotEditable: 'the official server cannot be edited',
  nothingToChange: 'nothing to change: key=value …',
  usage: 'servers edit <n | name> key=value …',
  desc: 'Change a saved server (address, fingerprint, nickname, password, name)',
  about: ['Only the keys given change. password= with nothing after it removes the password.', 'A new address or fingerprint drops the saved password unless password= is given too.'],
  examples: [['servers edit 1 nickname=Pal2', 'another nickname'], ['servers edit paul password=newpw', 'by name']],
});
