const NAMES = [
  'Grub', 'Nix', 'Bonk', 'Mog', 'Spud', 'Twig', 'Ruk', 'Fizz',
  'Gnar', 'Pip', 'Dob', 'Kaz', 'Mub', 'Snig', 'Wort', 'Blix',
  'Nub', 'Grit', 'Pok', 'Zag', 'Lug', 'Dreg', 'Skab', 'Yuk',
  'Glob', 'Rix', 'Thud', 'Vex', 'Jib', 'Crud',
];

export function getGoblinName(id) {
  return NAMES[id % NAMES.length];
}
