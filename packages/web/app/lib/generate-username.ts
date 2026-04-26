/**
 * Generates a random username by combining an adjective, noun, and random number.
 * Example: "happyclimber2847"
 */
export function generateRandomUsername(): string {
  const adjectives = [
    'happy',
    'speedy',
    'strong',
    'keen',
    'bold',
    'swift',
    'sharp',
    'clever',
    'brave',
    'nimble',
    'quick',
    'mighty',
    'fierce',
    'sleek',
    'vivid',
    'wild',
    'keen',
    'solid',
    'bright',
    'cosmic',
  ];

  const nouns = [
    'climber',
    'ascender',
    'sender',
    'crusher',
    'athlete',
    'warrior',
    'explorer',
    'seeker',
    'chaser',
    'rider',
    'diver',
    'flyer',
    'jumper',
    'runner',
    'walker',
    'wanderer',
    'adventurer',
    'challenger',
    'contender',
    'performer',
  ];

  const randomAdjective = adjectives[Math.floor(Math.random() * adjectives.length)];
  const randomNoun = nouns[Math.floor(Math.random() * nouns.length)];
  const randomNumber = Math.floor(Math.random() * 10000);

  return `${randomAdjective}${randomNoun}${randomNumber}`;
}
