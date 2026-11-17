/**
 * Remember a computation on an immutable input: the same array or object (same reference) is
 * computed once, whichever screen asks. Entries go away with their input (WeakMap).
 */
export function memoByRef<I extends object, A extends string | number | undefined, R>(fn: (input: I, arg: A) => R): (input: I, arg: A) => R {
  const cache = new WeakMap<I, Map<A, R>>();
  return (input, arg) => {
    let m = cache.get(input);
    if (!m) cache.set(input, (m = new Map()));
    if (m.has(arg)) return m.get(arg)!;
    const r = fn(input, arg);
    m.set(arg, r);
    return r;
  };
}
