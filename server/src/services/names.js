const ADJ = [
  "Calm",
  "Swift",
  "Bright",
  "Clever",
  "Brave",
  "Merry",
  "Zesty",
  "Chill",
  "Witty",
  "Fuzzy",
];
const NOUN = [
  "Panda",
  "Falcon",
  "Otter",
  "Tiger",
  "Koala",
  "Python",
  "Swift",
  "Eagle",
  "Moose",
  "Wombat",
];
export function randomName() {
  const a = ADJ[Math.floor(Math.random() * ADJ.length)];
  const n = NOUN[Math.floor(Math.random() * NOUN.length)];
  const num = Math.floor(Math.random() * 900 + 100);
  return `${a}${n}${num}`;
}
