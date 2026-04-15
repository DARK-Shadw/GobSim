const NAMES = [
  'Grub', 'Nix', 'Bonk', 'Mog', 'Spud', 'Twig', 'Ruk', 'Fizz',
  'Gnar', 'Pip', 'Dob', 'Kaz', 'Mub', 'Snig', 'Wort', 'Blix',
  'Nub', 'Grit', 'Pok', 'Zag', 'Lug', 'Dreg', 'Skab', 'Yuk',
  'Glob', 'Rix', 'Thud', 'Vex', 'Jib', 'Crud',
];

const FAMILY_NAMES = [
  'Ironpick', 'Mossbark', 'Stonefoot', 'Mudgut', 'Thornback',
  'Grimjaw', 'Bogsniff', 'Rustclaw', 'Ashknee', 'Rotholm',
  'Cinderbrow', 'Slagmaw', 'Dirtfang', 'Blacktoe', 'Fungalcap',
  'Boneknack', 'Gobsworth', 'Wartsnout', 'Muckrake', 'Spindleleg',
];

export const FAMILY_COLORS = [
  0xffcccc, 0xccffcc, 0xccccff, 0xffffcc,
  0xffccff, 0xccffff, 0xffeedd, 0xeeddff,
  0xddfffe, 0xffeed8, 0xd8eeff, 0xeeffd8,
  0xffd8ee, 0xd8ffee, 0xeeffd8, 0xffeedd,
  0xddffee, 0xeeddff, 0xffdde8, 0xe8ddff,
];

export function getGoblinName(id) {
  return NAMES[id % NAMES.length];
}

export function getFamilyName(index) {
  return FAMILY_NAMES[index % FAMILY_NAMES.length];
}
