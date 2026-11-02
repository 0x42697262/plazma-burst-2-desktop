export const ADD_TEXT = Object.freeze({
  savedWord: 'Saved',
  usage: 'servers add address=<a> fingerprint=<fp | fetch> nickname=<you> [password=<p>] [name="<name>"]',
  desc: 'Save a private server',
  about: ['address and fingerprint come from the server\'s terminal. fingerprint=fetch asks', 'the server for it; compare it with the one the host sent you. A value with spaces', 'goes in "double quotes". The password is kept out of the history and the log.'],
  examples: [['servers add address=192.168.1.20:2053 fingerprint=fetch nickname=Pal password=pw name="Paulbase"', 'save one']],
});
