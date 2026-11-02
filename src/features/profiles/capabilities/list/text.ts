export const LIST_TEXT = Object.freeze({
  noProfiles: 'No profiles.',
  profilesTitle: (count: number) => `Profiles: ${count}`,
  listRow: (name: string, summary: string) => `  ${name} ${summary}`,
  listMaps: (maps: string, mark: string) => `  maps: ${maps || 'none'}${mark}`,
  thisMap: '  (this map)',
  usage: 'profile list',
  desc: 'Every profile and the maps that use it',
  see: ['profile'],
});
