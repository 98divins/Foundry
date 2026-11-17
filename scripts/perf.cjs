const { chromium, devices } = require('playwright');
// Performance check (docs/SYNC_V2.md, section 2): 5 years of fictional data, CPU slowed 4×.
// Usage: npm run build (with VITE_SUPABASE_URL=https://mock.supabase.co), npx vite preview --port 4174,
// then: node scripts/fake-years.cjs 5 > /tmp/years5.json && node scripts/perf.cjs /tmp/years5.json
// Fails (exit 1) if the median startup is over 1 s.
const big = JSON.parse(require('fs').readFileSync(process.argv[2], 'utf8'));
// Same split as src/db.ts, to put 5 years straight into IndexedDB (localStorage could not hold them).
async function seedIdb(p) {
  await p.evaluate(async (s) => {
    await new Promise((res, rej) => {
      const r = indexedDB.open('foundry');
      
      r.onsuccess = () => {
        const tx = r.result.transaction(['items', 'docs'], 'readwrite');
        const it = tx.objectStore('items'); const dc = tx.objectStore('docs');
        for (const w of s.workouts) it.put(w, 'workout|' + w.id);
        for (const l of s.nutrition.log) it.put(l, 'log|' + l.id);
        for (const w of s.nutrition.weights) it.put(w, 'weight|' + w.date);
        for (const k of Object.keys(s)) if (!['workouts', 'routines', 'folders', 'customExercises', 'nutrition'].includes(k)) dc.put(s[k], 'state:' + k);
        const plan = {}; for (const [k, v] of Object.entries(s.nutrition)) if (!['foods', 'savedMeals', 'log', 'weights', 'checkIns', 'favorites', 'incompleteDays'].includes(k)) plan[k] = v;
        dc.put(plan, 'nutrition'); dc.put({ at: Date.now(), from: 'test' }, 'meta:migrated');
        tx.oncomplete = res; tx.onerror = rej;
      };
    });
  }, big);
}
(async () => {
  const b = await chromium.launch();
  const c = await b.newContext({ ...devices['iPhone 13'], deviceScaleFactor: 1, locale: 'fr-FR' });
  const p = await c.newPage();
  await p.goto('http://localhost:4174/'); await p.waitForTimeout(800);
  await seedIdb(p);
  const cdp = await c.newCDPSession(p);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  const runs = [];
  for (let i = 0; i < 5; i++) {
    const t0 = Date.now();
    await p.reload();
    await p.getByRole('button', { name: /déjà un compte|Créer mon compte/ }).first().waitFor();
    runs.push(Date.now() - t0);
    console.log('  parts', JSON.stringify(await p.evaluate(() => Object.fromEntries(['foundry-read', 'foundry-join'].map((n) => [n, Math.round(performance.getEntriesByName(n).pop()?.duration ?? -1)])))), 'nav', await p.evaluate(() => Math.round(performance.getEntriesByType('navigation')[0].domContentLoadedEventEnd)));
  }
  console.log('STARTUP ms (CPU x4, 5 years)', JSON.stringify(runs), '(the first one converts the old format)');
  const usual = runs.slice(1).sort((a, b) => a - b);
  const median = usual[Math.floor(usual.length / 2)];
  console.log('median', median, 'ms', median <= 1000 ? 'OK' : 'TOO SLOW');
  if (median > 1000) process.exitCode = 1;
  await b.close();
})();
