/**
 * Deterministic sorting utilities for KB Labs Mind Pack
 */

/**
 * Create a deterministic sort function using seed
 */
export function createDeterministicSort<T>(seed?: number): (a: T, b: T) => number {
  if (seed === undefined) {
    return (a: T, b: T) => String(a).localeCompare(String(b));
  }

  // Simple seeded random number generator
  let currentSeed = seed;
  function seededRandom() {
    currentSeed = (currentSeed * 9301 + 49297) % 233280;
    return currentSeed / 233280;
  }

  return (a: T, b: T) => {
    const aStr = String(a);
    const bStr = String(b);
    
    // If strings are equal, return 0
    if (aStr === bStr) {return 0;}
    
    // Use seeded random to determine order
    return seededRandom() < 0.5 ? -1 : 1;
  };
}

/**
 * Sort array deterministically using seed
 */
export function sortDeterministically<T>(array: T[], seed?: number): T[] {
  const sortFn = createDeterministicSort<T>(seed);
  return [...array].sort(sortFn);
}

/**
 * Sort object entries deterministically using seed
 */
export function sortEntriesDeterministically<T>(
  entries: [string, T][], 
  seed?: number
): [string, T][] {
  const sortFn = createDeterministicSort<[string, T]>(seed);
  return [...entries].sort(sortFn);
}
