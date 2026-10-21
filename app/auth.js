/* Fit App — accounts door (Phase 6).
   NOT LOADED by index.html in the dormant build. This module is
   loaded only after HQ wires this app's own Firebase project and
   pastes the config into accounts-config.js (see
   ACCOUNTS-PHASE-PLAN.md). It uses the Firebase JS SDK as ES
   modules, per the Skills Scout ruling for this desk: no build
   step, no bundler, dormant-gated.
   The door set, as ruled 15 Oct 2026 (programme-wide,
   superseding the 14 Oct §5 shape by her direct word):
   email + a password the user chooses (Firebase Auth),
   beside Google + Apple. The passwordless email link door
   is retired. Apple parks until the Apple Developer
   credential wall clears, like the other apps.
   Data shape (Security desk flag F1, ruled 14 Oct 2026):
   sliced storage WITH a size watch. The root document
   users/{uid} holds only the small slices (profile,
   disclaimer) plus updatedAt. Every other top-level slice
   of the state lives in its own document at
   users/{uid}/slices/{slice}, so no single document can
   reach Firestore's 1 MiB document ceiling while history
   grows; FitLogic.oversizedSlices watches every slice's
   size on save and reports any slice nearing the ceiling.
   Rules live in firestore.rules (owner-only at both levels).
   Merging cloud and device copies is Fit logic
   (FitLogic.mergeStates), which never drops user data. */
import { initializeApp } from "./sdk/firebase-app.js";
import {
  getAuth, initializeAuth, indexedDBLocalPersistence, onAuthStateChanged, signOut, deleteUser,
  createUserWithEmailAndPassword, signInWithEmailAndPassword,
  sendPasswordResetEmail, EmailAuthProvider, reauthenticateWithCredential,
  signInAnonymously,
  GoogleAuthProvider, OAuthProvider, signInWithPopup, signInWithCredential,
  reauthenticateWithPopup
} from "./sdk/firebase-auth.js";
import {
  getFirestore, doc, getDoc, getDocs, collection, setDoc, deleteDoc
} from "./sdk/firebase-firestore.js";

let app = null, auth = null, db = null;

function initDoor(config) {
  if (!config) return false;
  if (!app) {
    app = initializeApp(config);
    /* THE DOOR CURE (the fleet bisect of record, 21 Oct 2026):
       on native, plain getAuth() leaves sign-in results and
       the auth-state listener hanging in iPhone Capacitor
       apps — the system sheet completes and the app never
       registers it (her films, three apps). Native takes
       initializeAuth with IndexedDB persistence, the plugin
       guide's required shape; the web keeps getAuth. */
    auth = (window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform())
      ? initializeAuth(app, { persistence: indexedDBLocalPersistence })
      : getAuth(app);
    db = getFirestore(app);
  }
  return true;
}

function watchUser(callback) {
  if (!auth) return function () {};
  return onAuthStateChanged(auth, function (u) {
    /* F1 (QA, build 5): the free month anchors to the AUTH
       account's creation time — a fact that lives on the
       account and can never re-stamp per device. */
    try {
      noteAuthAnchor(u && !u.isAnonymous && u.metadata ? u.metadata.creationTime : null);
    } catch (e) {}
    callback(u);
  });
}

/* Door 1: email + a password the user chooses (the
   ruling, 15 Oct 2026). Firebase holds the password; the
   app never stores it. A reset email covers the forgotten
   case, so nobody is locked out by a lost password. */
async function signUpWithEmail(email, password) {
  return withDoorTimeout(createUserWithEmailAndPassword(auth, email, password), 30000);
}

async function signInWithEmail(email, password) {
  return withDoorTimeout(signInWithEmailAndPassword(auth, email, password), 30000);
}

async function resetPassword(email) {
  return withDoorTimeout(sendPasswordResetEmail(auth, email), 30000);
}

/* §5 door 2: Google. §5 door 3: Apple (parked on the Apple
   Developer credential wall; the call is here so P2 only
   wires the button when the door is live). */
/* Native door (packaged app only, the native-door fix):
   inside the store wraps the web popup cannot finish, so
   on a native platform the Google and Apple doors run on
   the native layer through the Capacitor Firebase
   Authentication plugin and complete the session here on
   the web layer from the credential the plugin hands back:
   the plugin's own Firebase JavaScript SDK pattern
   (signInWithCredential with the OAuth credential built
   from the returned tokens). The plugin config
   (capacitor.config.json) carries the skip-native-auth
   setting for the whole plugin, the documented shape
   when the JavaScript SDK owns the session, so the
   plugin fetches credentials only and creates no
   parallel native session; both calls take no options.
   Apple's nonce
   comes back on the result's credential and passes to
   the OAuth credential as rawNonce verbatim, never
   hashed again. Browsers never take this road: the popup doors
   below stay exactly as they were, and the email door and
   the demo door are untouched on every platform. A native
   failure or cancel rejects, and the door shows the same
   generic line it shows for a popup that did not finish. */
function nativeDoorPlugin() {
  try {
    return (window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform()
      && window.Capacitor.Plugins && window.Capacitor.Plugins.FirebaseAuthentication) || null;
  } catch (e) { return null; }
}

async function nativeSignInWithGoogle(plugin) {
  const result = await plugin.signInWithGoogle();
  const credential = result.credential || {};
  return signInWithCredential(auth, GoogleAuthProvider.credential(credential.idToken));
}

async function nativeSignInWithApple(plugin) {
  const result = await plugin.signInWithApple();
  const credential = result.credential || {};
  const provider = new OAuthProvider("apple.com");
  return signInWithCredential(auth, provider.credential({ idToken: credential.idToken, rawNonce: credential.nonce }));
}

/* BOUNDED DOORS (fleet census, 19 Oct 2026): a native sheet
   or popup promise that never settles must not hang the door
   forever — every door promise races a clock, and a timeout
   rejects with fit/door-timeout so the caller's catch speaks
   the honest fail line and the user can tap again. The clock
   only fires when the promise NEVER settles; a person
   completing the sheet settles it first. */
function withDoorTimeout(promise, ms) {
  return Promise.race([
    promise,
    new Promise(function (resolve, reject) {
      setTimeout(function () {
        const e = new Error("The sign-in did not finish in time.");
        e.code = "fit/door-timeout";
        reject(e);
      }, ms);
    })
  ]);
}

async function signInWithGoogle() {
  const plugin = nativeDoorPlugin();
  if (plugin) return withDoorTimeout(nativeSignInWithGoogle(plugin), 60000);
  return withDoorTimeout(signInWithPopup(auth, new GoogleAuthProvider()), 30000);
}

async function signInWithApple() {
  const plugin = nativeDoorPlugin();
  if (plugin) return withDoorTimeout(nativeSignInWithApple(plugin), 60000);
  return withDoorTimeout(signInWithPopup(auth, new OAuthProvider("apple.com")), 30000);
}

async function signOutUser() {
  return signOut(auth);
}

/* Small slices stay in the root document; everything else is
   one document per slice under users/{uid}/slices (F1). */
const ROOT_KEYS = ["profile", "disclaimer"];

async function loadCloudState(uid) {
  const root = await getDoc(doc(db, "users", uid));
  if (!root.exists()) return null;
  const state = Object.assign({}, root.data().state || {});
  if (typeof root.data().unlockHash === "string" && root.data().unlockHash) state.demoUnlock = root.data().unlockHash;
  const slices = await getDocs(collection(db, "users", uid, "slices"));
  slices.forEach(function (s) { if (s.id !== "demoUnlock") state[s.id] = s.data().value; });
  return state;
}

/* Saves every slice, then reports the size watch: the names
   of any slices over FitLogic's warn line (700000 bytes,
   well under the 1 MiB ceiling). P2 surfaces a kind Settings
   line when the list is not empty; saves never block on it. */
async function saveCloudState(uid, state) {
  const rootState = {};
  const sliceData = [];
  Object.keys(state).forEach(function (k) {
    if (k === "demoUnlock") return; /* rides in the root doc, never a slice */
    if (ROOT_KEYS.indexOf(k) >= 0) rootState[k] = state[k];
    else sliceData.push([k, state[k]]); /* DATA only — no calls yet */
  });
  const rootDocData = { state: rootState, updatedAt: new Date().toISOString() };
  /* P4 demo unlock: only a real hash is written. Writing the
     key at all when it is empty would trip the rules gate
     (presence is the signal), so it is simply absent. */
  if (typeof state.demoUnlock === "string" && state.demoUnlock) rootDocData.unlockHash = state.demoUnlock;
  /* ROOT FIRST — invoked AND awaited — and only then are the
     slice writes INVOKED (QA Phase 6 P4 F1, proven live
     14 Oct 2026, twice): the rules gate reads the root doc
     with get() on every slice write, so a first save whose
     slices are judged before the root exists loses every
     slice. setDoc SENDS ON INVOCATION, not on await — an
     earlier version of this fix moved the awaits and left
     the calls inside the build loop above, and the wire
     order never changed. The slice setDoc calls therefore
     live BELOW this line, constructed from sliceData only
     after the root has landed. */
  await setDoc(doc(db, "users", uid), rootDocData);
  var sliceErrs = await Promise.all(sliceData.map(function (pair) {
    return setDoc(doc(db, "users", uid, "slices", pair[0]), { value: pair[1] }).then(function () { return null; }, function (e) {
      /* THE DESIGNED REFUSAL IS NOT A FAILURE (21 Oct 2026,
         the Test chair's flash observation): the tier slice's
         "pro" claim is refused BY DESIGN whenever no _comp
         record stands — that refusal IS the entitlement
         resolution, and it must never fail the mirror (the
         account note would flash a failure during a healthy
         sign-in settle, for a save that then succeeds). Every
         other refusal still fails the batch, and the note
         still tells the truth when data is at risk. */
      if (pair[0] === "tier" && pair[1] && pair[1].plan === "pro" && e && e.code === "permission-denied") return null;
      return e || new Error("slice write failed");
    });
  }));
  var badSlice = sliceErrs.filter(Boolean);
  if (badSlice.length) throw badSlice[0];
  let warnings = [];
  if (typeof window !== "undefined" && window.FitLogic && window.FitLogic.oversizedSlices) {
    warnings = window.FitLogic.oversizedSlices(state);
  }
  return { warnings: warnings };
}

/* Account deletion (the user's own right, in-app). Order is
   Security desk flag F3, as HQ ruled: re-auth-then-delete, so
   a stale session can never half-delete (data gone, auth
   user alive). Re-auth means: a session signed in within
   the last 5 minutes is fresh enough; Google and Apple
   users re-auth in their provider popup; email + password
   users get a typed "fit/reauth-password" error unless the
   app passes the password the user just typed to confirm,
   which re-auths with the credential. Only with a fresh
   session: delete the cloud documents, then the auth user.
   The app wipes the device copy ONLY after this resolves;
   if any step throws, nothing on the device is touched and
   the whole delete is safe to retry (cloud deletes are
   idempotent). */
function sessionIsFresh(user) {
  const t = new Date(user.metadata.lastSignInTime).getTime();
  return isFinite(t) && (Date.now() - t) < 5 * 60 * 1000;
}

async function deleteAccount(uid, password) {
  const user = auth.currentUser;
  if (!user || user.uid !== uid) throw new Error("not signed in as this account");
  if (!sessionIsFresh(user)) {
    const pid = user.providerData.length ? user.providerData[0].providerId : "";
    if (pid === "google.com") await reauthenticateWithPopup(user, new GoogleAuthProvider());
    else if (pid === "apple.com") await reauthenticateWithPopup(user, new OAuthProvider("apple.com"));
    else if (pid === "password") {
      if (!password) {
        const err = new Error("password needed to confirm deleting");
        err.code = "fit/reauth-password";
        throw err;
      }
      await reauthenticateWithCredential(user, EmailAuthProvider.credential(user.email, password));
    }
  }
  const slices = await getDocs(collection(db, "users", uid, "slices"));
  const deletes = [];
  slices.forEach(function (s) { deletes.push(deleteDoc(s.ref)); });
  deletes.push(deleteDoc(doc(db, "users", uid)));
  await Promise.all(deletes);
  await deleteUser(user);
}

/* Demo entry (P4, SPARK SHAPE): an anonymous-auth session.
   The app seeds it client-side from the invented fixture;
   there is no shared demo account and no server. Anonymous
   sessions are created ONLY through this door. */
/* Two-hat plan sync (pattern v2 §0; spec TWO-HAT-INSTANCE
   -SPEC.md). The comp lives OUTSIDE the user record, in a
   console-written _comp/{uid} doc no client can read or
   write. The tier slice in the user's own space is the
   only entitlement the app reads, and the rules accept a
   "pro" value there only while the comp record exists —
   so this function ASKS for pro once, when no tier slice
   exists yet: if the record is there, the write lands;
   if not, the denial lands the honest "free" instead.
   Called only after the account's root doc exists (the
   caller runs it after a cloud load or a completed first
   save — the CS order), never for demo sessions. */
async function syncPlan(uid, isAnonymous) {
  if (isAnonymous) return null;
  const ref = doc(db, "users", uid, "slices", "tier");
  let current = null;
  try {
    const snap = await getDoc(ref);
    if (snap.exists()) {
      const v = snap.data().value || {};
      current = v.plan === "pro" ? "pro" : "free";
    }
  } catch (e) { return null; }
  /* The ask happens EVERY sync, not only when the slice is
     missing — this is the revocation half (Security TW-3R).
     A comp granted after a "free" slice exists must take
     effect, and a comp revoked behind a "pro" slice must
     resolve back to free on the next sign-in: the pro
     write is re-attempted, and only the live _comp record
     lets it land. On denial a stale "pro" is reset to
     "free" here; a slice that was already "free" needs no
     write; a missing slice gets its honest "free". */
  try {
    await setDoc(ref, { value: { plan: "pro" } });
    resolvedPlan = "pro";
    return "pro";
  } catch (e) {
    if (current === "free") { resolvedPlan = "free"; return "free"; }
    try { await setDoc(ref, { value: { plan: "free" } }); resolvedPlan = "free"; return "free"; }
    catch (e2) { return current === "pro" ? "pro" : null; }
  }
}
/* Display mirror ONLY (pattern ruling, Personal Brand,
   14 Oct 2026): the tier slice may show the plan, it never
   grants it. A plan-shaped field smuggled anywhere else
   (a profile field, say) is inert — TW-3's fence — because
   nothing ever reads it. Features must call entitlement(),
   never this. */
function planOf(state) {
  return state && state.tier && state.tier.plan === "pro" ? "pro" : "free";
}
/* ENTITLEMENT — resolves at read time. The comp leg still
   resolves from the server-side record through the sync
   ask: syncPlan's pro write is accepted only while
   _comp/{uid} exists, so its outcome IS the comp
   resolution, and until a sync resolves this session that
   leg is "free" (fail-closed, so a stale mirror left
   behind by a removed comp grants nothing). Tranche B
   added the second leg under it: the free month, read
   from the account-age fact the app hands over. The tier
   SLICE still mirrors only the sync ask: the rules gate
   any client "pro" claim on the comp record, so the free
   month resolves here at read time and is never written
   as a pro claim. */
let resolvedPlan = null;
/* TIER-MACHINE-BEGIN — the account-age slot + the pure
   resolver. The node suite and the desk probe extract this
   exact block to run its truth table, so keep it
   self-contained: no imports, no Firestore, nothing beyond
   its arguments and the FREE_MONTH_DAYS constant. */
const FREE_MONTH_DAYS = 30;
let accountAgeStart = null;
let authAnchorIso = null;
function noteAuthAnchor(iso) {
  /* The AUTH account's creation time, captured at the door.
     When it exists it WINS over the profile stamp: a fresh
     device can re-stamp the profile, it can never move the
     account's creation time (QA finding F1, build 5). */
  authAnchorIso = (typeof iso === "string" && iso) ? iso : null;
}
function setAccountAge(iso) {
  /* The app hands over the profile's account-age fact
     (firstSeenAt, stamped when the account was created and
     carried forward on every repair, never dropped). It is
     the fallback anchor only — the auth fact wins. */
  accountAgeStart = (typeof iso === "string" && iso) ? iso : null;
}
function resolveTier(compPlan, firstSeenAt, nowMs) {
  /* Resolution order (Tranche B, resolving the CAP HOLD):
     the comp resolution wins outright; else the free month
     (Tier 0: the full app for 30 days from the account-age
     stamp, no card asked); else Free Forever. */
  if (compPlan === "pro") return { plan: "pro", reason: "comp", daysLeft: 0 };
  const t = Date.parse(firstSeenAt || "");
  if (isFinite(t)) {
    let diff = nowMs - t; if (diff < 0) diff = 0;
    const used = Math.floor(diff / 86400000);
    if (used < FREE_MONTH_DAYS) return { plan: "pro", reason: "freemonth", daysLeft: FREE_MONTH_DAYS - used };
  }
  return { plan: "free", reason: "free", daysLeft: 0 };
}
function entitlementDetail() {
  return resolveTier(resolvedPlan, authAnchorIso || accountAgeStart, Date.now());
}
/* TIER-MACHINE-END */
function entitlement() {
  /* What features call (nothing enforces a cap in this
     build: caps land only after the TW-3R live case
     passes). Fail-closed on the comp leg: until a sync
     resolves, resolvedPlan is null, so only a live free
     month can resolve pro; with no account-age fact handed
     over, the answer is "free". */
  return entitlementDetail().plan;
}

/* The demo door may be reached before the account door is
   wired on some paths; make sure the door exists first.
   (Restored 15 Oct: the call stood in enterDemoSession
   with no definition behind it.) */
function ensureDoor() {
  if (!app && window.FIT_ACCOUNT_CONFIG) initDoor(window.FIT_ACCOUNT_CONFIG);
}

async function enterDemoSession() {
  ensureDoor();
  const cred = await withDoorTimeout(signInAnonymously(auth), 20000);
  return cred.user;
}

window.FitAuth = {
  initDoor, watchUser, signUpWithEmail, signInWithEmail, resetPassword,
  signInWithGoogle, signInWithApple, enterDemoSession,
  signOutUser, loadCloudState, saveCloudState, deleteAccount,
  syncPlan, planOf, entitlement,
  setAccountAge, resolveTier, entitlementDetail
};
/* app.js (a classic script) always runs before this module;
   the ready event is how it learns the door exists. If the
   module cannot load (no connection), no event fires and the
   app shows its honest on-device account state. */
try { window.dispatchEvent(new Event("fit-auth-ready")); } catch (e) {}
