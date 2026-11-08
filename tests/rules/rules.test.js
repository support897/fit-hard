const { initializeTestEnvironment, assertFails, assertSucceeds } = require('@firebase/rules-unit-testing');
const { doc, getDoc, setDoc, updateDoc, deleteDoc, getDocs, collection, setLogLevel } = require('firebase/firestore');
const fs = require('fs'), path = require('path'), test = require('node:test'), assert = require('node:assert');
setLogLevel('silent');
let env;
const SLICES = ['peptides', 'body', 'sessions', 'plan', 'settings', 'todos', 'appointments', 'reflections', 'restDays'];
test.before(async () => {
  env = await initializeTestEnvironment({ projectId: 'demo-fit-hard', firestore: { host: '127.0.0.1', port: 8089, rules: fs.readFileSync(path.join(__dirname, '../../app/firestore.rules'), 'utf8') } });
});
test.after(async () => { await env.cleanup(); });
test.beforeEach(async () => { await env.clearFirestore(); });
let ca = null, cb = null, cn = null;
test.beforeEach(() => { ca = env.authenticatedContext('alice').firestore(); cb = env.authenticatedContext('bob').firestore(); cn = env.unauthenticatedContext().firestore(); });
const A = () => ca, B = () => cb, N = () => cn;
async function seed() { await env.withSecurityRulesDisabled(async (c) => { const db = c.firestore(); await setDoc(doc(db, 'users/alice'), { state: { profile: { firstSeenAt: '2026-01-01' } } });
  for (const s of SLICES) await setDoc(doc(db, 'users/alice/slices/' + s), { value: { secret: 'alice-' + s } }); await setDoc(doc(db, 'users/bob'), { state: {} }); }); }

test('owner can read and write own root and every slice', async () => {
  await seed(); const db = A();
  await assertSucceeds(getDoc(doc(db, 'users/alice')));
  for (const s of SLICES) { await assertSucceeds(getDoc(doc(db, 'users/alice/slices/' + s))); await assertSucceeds(setDoc(doc(db, 'users/alice/slices/' + s), { value: { n: 1 } })); }
  await assertSucceeds(setDoc(doc(db, 'users/alice/slices/newslice'), { value: [] }));
});
test('another signed-in user cannot read, write, update or delete ANY of the owner data (incl. health slices)', async () => {
  await seed(); const db = B();
  await assertFails(getDoc(doc(db, 'users/alice')));
  await assertFails(setDoc(doc(db, 'users/alice'), { state: {} }));
  await assertFails(updateDoc(doc(db, 'users/alice'), { state: {} }));
  await assertFails(deleteDoc(doc(db, 'users/alice')));
  for (const s of SLICES) {
    await assertFails(getDoc(doc(db, 'users/alice/slices/' + s)));
    await assertFails(setDoc(doc(db, 'users/alice/slices/' + s), { value: { hacked: true } }));
    await assertFails(updateDoc(doc(db, 'users/alice/slices/' + s), { value: { hacked: true } }));
    await assertFails(deleteDoc(doc(db, 'users/alice/slices/' + s)));
  }
  await assertFails(getDocs(collection(db, 'users/alice/slices')));
  await assertFails(setDoc(doc(db, 'users/alice/slices/brandnew'), { value: 1 }));
});
test('signed-out visitors get nothing', async () => {
  await seed(); const db = N();
  await assertFails(getDoc(doc(db, 'users/alice'))); await assertFails(getDoc(doc(db, 'users/alice/slices/peptides')));
  await assertFails(setDoc(doc(db, 'users/alice/slices/x'), { value: 1 })); await assertFails(getDocs(collection(db, 'users/alice/slices')));
});
test('user cannot create a root doc under someone else uid', async () => { await assertFails(setDoc(doc(B(), 'users/carol'), { state: {} })); await assertSucceeds(setDoc(doc(B(), 'users/bob'), { state: {} })); });
test('bob own data stays invisible to alice (both directions)', async () => {
  await env.withSecurityRulesDisabled(async (c) => { const d = c.firestore(); await setDoc(doc(d, 'users/bob'), { state: {} }); await setDoc(doc(d, 'users/bob/slices/peptides'), { value: [{ name: 'x' }] }); });
  await assertFails(getDoc(doc(A(), 'users/bob/slices/peptides'))); await assertSucceeds(getDoc(doc(B(), 'users/bob/slices/peptides')));
});
test('collections outside users/ are closed: random paths, _comp, _owner, demoAccess', async () => {
  await seed(); const db = A();
  for (const p of ['public/x', 'admin/x', '_comp/alice', '_owner/config', '_owner/dash', 'demoAccess/current', 'users/alice/other/x', 'users/alice/slices/peptides/deep/x']) {
    await assertFails(getDoc(doc(db, p))); await assertFails(setDoc(doc(db, p), { a: 1 }));
  }
});
test('plan gate: a user cannot grant themselves "pro" in the tier slice', async () => {
  await seed(); const db = A();
  await assertFails(setDoc(doc(db, 'users/alice/slices/tier'), { value: { plan: 'pro' } }));
  await assertSucceeds(setDoc(doc(db, 'users/alice/slices/tier'), { value: { plan: 'free' } }));
  await env.withSecurityRulesDisabled(async (c) => { await setDoc(doc(c.firestore(), '_comp/alice'), { ok: true }); });
  await assertSucceeds(setDoc(doc(db, 'users/alice/slices/tier'), { value: { plan: 'pro' } }));
});
test('free-month anchor cannot be moved or dropped once stamped', async () => {
  await seed(); const db = A();
  await assertFails(updateDoc(doc(db, 'users/alice'), { state: { profile: { firstSeenAt: '2026-11-01' } } }));
  await assertFails(updateDoc(doc(db, 'users/alice'), { state: { profile: {} } }));
  await assertSucceeds(updateDoc(doc(db, 'users/alice'), { state: { profile: { firstSeenAt: '2026-01-01', name: 'A' } } }));
});
test('new account: root saved with null profile/disclaimer can still be updated once setup stamps the profile (regression)', async () => {
  await env.withSecurityRulesDisabled(async (c) => { await setDoc(doc(c.firestore(), 'users/alice'), { state: { profile: null, disclaimer: null } }); });
  const db = A();
  await assertSucceeds(setDoc(doc(db, 'users/alice'), { state: { profile: { firstSeenAt: '2026-01-01', name: 'A' }, disclaimer: null } }));
  await assertFails(setDoc(doc(db, 'users/alice'), { state: { profile: { firstSeenAt: '2026-02-02' } } }));
  await assertFails(setDoc(doc(db, 'users/alice'), { state: { profile: null } }));
});
test('root doc with no state map at all is updatable (null-safe)', async () => {
  await env.withSecurityRulesDisabled(async (c) => { await setDoc(doc(c.firestore(), 'users/alice'), { updatedAt: 'x' }); });
  await assertSucceeds(setDoc(doc(A(), 'users/alice'), { state: { profile: { firstSeenAt: '2026-01-01' } } }));
});
test('demo-unlock sessions: slices refused while the desk record is missing', async () => {
  await env.withSecurityRulesDisabled(async (c) => { const d = c.firestore(); await setDoc(doc(d, 'users/alice'), { unlockHash: 'abc' }); await setDoc(doc(d, 'users/alice/slices/s'), { value: 1 }); });
  await assertFails(getDoc(doc(A(), 'users/alice/slices/s')));
});
test('owner can delete own data (right to erasure)', async () => {
  await seed(); const db = A();
  for (const s of SLICES) await assertSucceeds(deleteDoc(doc(db, 'users/alice/slices/' + s)));
  await assertSucceeds(deleteDoc(doc(db, 'users/alice')));
});
