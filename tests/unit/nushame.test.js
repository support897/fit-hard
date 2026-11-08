/* Phase 5 content review as a test: user-facing English copy must not shame, punish, moralise food,
   judge bodies or use coercive streak/loss language. Scans the EN i18n table, Wally lines, every
   quoted string in app.js (fallback copy) and static index.html text. */
const test = require('node:test'), assert = require('node:assert'), path = require('path'), fs = require('fs');
const APP = path.join(__dirname, '..', '..', 'app');
global.window = global.window || {};
const I = require(path.join(APP, 'i18n.js'));
const BANNED = [
  [/\blazy\b/i, 'lazy'], [/\bfailed? (to|your)\b|\byou failed\b/i, 'failure framing'], [/\bshame\b|\bashamed\b|\bguilt(y)?\b/i, 'shame/guilt'],
  [/\bpunish/i, 'punish'], [/\bcheat( day| meal)?\b/i, 'cheat'], [/\bsinful\b|\bbad food\b|\bgood food\b|\bclean eating\b|\bjunk\b/i, 'food morality'],
  [/\bburn (it )?off\b|\bearn (your|that|the) (food|meal|treat|dessert)\b|\bwork off\b/i, 'earn/burn off food'],
  [/\bstreak (lost|broken)\b|\blost your streak\b|\bbroke your streak\b|\bbroken streak\b|\bdon'?t break\b|\bstreak (is )?(at risk|in danger)\b/i, 'streak loss'],
  [/\bfat\b(?! \()|\bobese\b|\boverweight\b|\bunderweight\b|\bskinny\b|\bflabby\b/i, 'body judgement'], [/\byou missed\b|\bmissed (your|a|the) (workout|session|day|goal)\b/i, 'missed-X shaming'],
  [/\bbehind\b(?! you)|\bfall(en)? behind\b|\bslack(ing)?\b|\bno excuses\b|\bgive up\b/i, 'pressure'], [/\bdisappoint/i, 'disappointed'], [/\bhurry\b|\bdon'?t miss out\b|\blast chance\b|\bact now\b/i, 'urgency'],
  [/\bdiet\b(?! (or|of|type|pattern|plan))/i, 'diet-culture (review)'], [/\bcalorie deficit\b|\bover (your )?budget\b/i, 'budget shaming'], [/\bred\b.*\b(day|week|goal)\b/i, 'red status'],
];
const ALLOW = [/hard challenge/i];
function strings() {
  const out = [];
  Object.entries(I.EN).forEach(([k, v]) => { if (typeof v === 'string') out.push(['i18n:' + k, v]); });
  const w = fs.readFileSync(path.join(APP, 'wally.js'), 'utf8'); const m = w.match(/var BUBBLES = \{([\s\S]*?)\};/)[1];
  [...m.matchAll(/:\s*"([^"]+)"/g)].forEach(x => out.push(['wally', x[1]]));
  const app = fs.readFileSync(path.join(APP, 'app.js'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  [...app.matchAll(/"((?:[^"\\\n]|\\.){12,})"/g)].forEach(x => { if (/\s/.test(x[1]) && /[a-z]{3}/i.test(x[1]) && !/^[.#\[<]/.test(x[1]) && !/function|return|=>|querySelector/.test(x[1])) out.push(['app.js', x[1]]); });
  const html = fs.readFileSync(path.join(APP, 'index.html'), 'utf8').replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/g, '');
  [...html.matchAll(/>([^<>]{12,})</g)].forEach(x => out.push(['index.html', x[1].trim()]));
  return out;
}
test('no-shame copy review: EN table, Wally, app.js strings, static HTML', () => {
  const hits = [];
  strings().forEach(([src, s]) => { if (ALLOW.some(a => a.test(s))) return; BANNED.forEach(([re, why]) => { if (re.test(s)) hits.push(why + ' | ' + src + ' | ' + s.slice(0, 120)); }); });
  assert.deepStrictEqual(hits, []);
});
test('Wally lines: max 6 words per line, no dashes, no negative emotion toward the user', () => {
  const w = fs.readFileSync(path.join(APP, 'wally.js'), 'utf8'); const m = w.match(/var BUBBLES = \{([\s\S]*?)\};/)[1];
  const lines = [...m.matchAll(/:\s*"([^"]+)"/g)].map(x => x[1]); assert(lines.length >= 8);
  lines.forEach(l => { assert(l.split(/\s+/).length <= 6, l); assert(!/[-\u2013\u2014]/.test(l), l); assert(!/sad|disappoint|sorry you|worry|miss(ed)? you|where were you/i.test(l), l); });
});
test('Wally never changes shape by user behaviour: one art set, poses map to the same figure family', () => {
  const w = fs.readFileSync(path.join(APP, 'wally.js'), 'utf8');
  ['welcome', 'rest', 'rough', 'celebrate'].forEach(p => assert(fs.existsSync(path.join(APP, 'assets', 'wally-' + p + '.webp')), p));
  assert(!/thin|fat|sick|hungry|cry|tear/i.test(w.replace(/\/\*[\s\S]*?\*\//g, '')));
});
