(function () {
  const G = globalThis.G = globalThis.G || {};

  // mulberry32. O estado vive em G.S.rng, então um save recarregado continua a mesma sequência.
  function next() {
    let t = (G.S.rng = (G.S.rng + 0x6D2B79F5) | 0);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  G.rng = {
    next,
    range: (a, b) => a + (b - a) * next(),
    int: (a, b) => Math.floor(a + (b - a + 1) * next()),
    chance: p => next() < p,
    normal() {
      let u = 0;
      while (u === 0) u = next();
      return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * next());
    },
    // weights: { chave: peso }
    pick(weights) {
      let total = 0;
      for (const k in weights) total += weights[k];
      let r = next() * total;
      for (const k in weights) {
        r -= weights[k];
        if (r <= 0) return k;
      }
      return Object.keys(weights)[0];
    },
    item: arr => arr[Math.floor(next() * arr.length)],
  };
})();
