// Shared setup for the resident app (index.html) and the call-center screen (admin.html)
export const firebaseConfig = window.__FIREBASE_CONFIG__;
const FB = "https://www.gstatic.com/firebasejs/12.4.0/";

export const STATUS = {
  new:         { label: "התקבל",      color: "#d9822b" },
  in_progress: { label: "בטיפול",     color: "#2f6fb0" },
  done:        { label: "טופל",       color: "#2e8b57" },
  rejected:    { label: "לא לטיפול",  color: "#8a8f98" }
};

// Default categories, used until the call center saves its own list in the admin screen.
// kind: "hazard" = a hazard at a location (shown on the public map), "request" = a request/inquiry (private, no map)
export const DEFAULT_CATEGORIES = [
  { kind: "hazard",  name: "תאורת רחוב",          dept: "חשמל ותאורה",     subs: ["פנס לא דולק", "פנס דולק ביום", "עמוד פגוע", "חוטים חשופים"] },
  { kind: "hazard",  name: "כבישים ומדרכות",      dept: "הנדסה",           subs: ["בור בכביש", "מדרכה שבורה", "מכסה ביוב חסר", "שקיעה בכביש"] },
  { kind: "hazard",  name: "ניקיון ותברואה",       dept: "תברואה",          subs: ["פסולת ברחוב", "פח מלא / שבור", "גזם", "פסולת בניין", "ריח רע"] },
  { kind: "hazard",  name: "מים וביוב",            dept: "תאגיד המים",      subs: ["נזילת מים", "הצפה", "ביוב עולה", "אין מים"] },
  { kind: "hazard",  name: "גינון ועצים",          dept: "גנים ונוף",       subs: ["עץ נפל / מסוכן", "גיזום נדרש", "השקיה תקולה", "מתקן משחקים פגוע"] },
  { kind: "hazard",  name: "אחזקת תעבורה",         dept: "אחזקת תעבורה",    subs: ["רמזור תקול", "תמרור חסר / פגוע", "סימון כביש דהוי", "מעקה בטיחות פגוע", "פס האטה"] },
  { kind: "hazard",  name: "פיקוח חניה",           dept: "פיקוח חניה",      subs: ["חניה על מדרכה", "חסימת חניה / שער", "חניה בחניית נכים", "חניה במעבר חצייה", "רכב נטוש"] },
  { kind: "hazard",  name: "פיקוח עירוני",         dept: "פיקוח עירוני",    subs: ["רעש", "עבודות בשעות אסורות", "השלכת פסולת", "פלישה לשטח ציבורי", "עסק מפריע"] },
  { kind: "hazard",  name: "וטרינריה ובעלי חיים",  dept: "וטרינריה",        subs: ["בעל חיים חולה / פצוע", "כלב משוטט", "חיה מתה", "אחזקת בעלי חיים מטרידה", "נשיכה", "מכרסמים / מזיקים"] },
  { kind: "hazard",  name: "מפגעי בטיחות",         dept: "ביטחון ובטיחות",  subs: ["גדר / מעקה פגוע", "מבנה מסוכן", "בור פתוח"] },
  { kind: "hazard",  name: "מפגע אחר",             dept: "מוקד",            subs: [] },
  { kind: "request", name: "רווחה",                dept: "רווחה",           subs: ["בקשה לשיחה עם עו\"ס תורן", "סיוע לקשיש", "פנייה בנושא משפחה", "אחר"] },
  { kind: "request", name: "בקשת מידע",            dept: "מוקד",            subs: ["ארנונה", "חינוך ורישום", "תכנון ובנייה", "תרבות ואירועים", "שעות פעילות ומחלקות", "תיאום פינוי גזם / גרוטאות", "אחר"] },
  { kind: "request", name: "פנייה כללית",          dept: "מוקד",            subs: [] }
];
export const kindOf = c => (c && c.kind === "request") ? "request" : "hazard";

export const ASHKELON = [31.6688, 34.5743];

export async function initFirebase(){
  const [appM, authM, fsM] = await Promise.all([
    import(FB + "firebase-app.js"), import(FB + "firebase-auth.js"), import(FB + "firebase-firestore.js")
  ]);
  const app = appM.initializeApp(firebaseConfig);
  const auth = authM.getAuth(app);
  const db = fsM.getFirestore(app);
  try { await authM.getRedirectResult(auth); } catch(e){}
  return { auth, db, A: authM, F: fsM };
}

export async function googleSignIn(fb){
  const p = new fb.A.GoogleAuthProvider();
  try { await fb.A.signInWithPopup(fb.auth, p); }
  catch(e){
    if (e.code === "auth/popup-blocked" || e.code === "auth/operation-not-supported-in-this-environment") return fb.A.signInWithRedirect(fb.auth, p);
    if (e.code !== "auth/popup-closed-by-user" && e.code !== "auth/cancelled-popup-request") throw e;
  }
}

export async function loadCategories(fb){
  try {
    const s = await fb.F.getDoc(fb.F.doc(fb.db, "config", "categories"));
    const list = s.exists() && Array.isArray(s.data().list) ? s.data().list : null;
    if (list && list.length) return list;
  } catch(e){}
  return DEFAULT_CATEGORIES;
}

export function fmtDate(ts){
  const d = ts && ts.toDate ? ts.toDate() : (ts instanceof Date ? ts : null);
  if (!d) return "";
  return d.toLocaleDateString("he-IL", { day: "numeric", month: "numeric", year: "2-digit" }) + " " +
         d.toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit" });
}

export function esc(s){ const d = document.createElement("div"); d.textContent = s == null ? "" : String(s); return d.innerHTML; }

// Shrink a photo so it fits comfortably inside a Firestore document (free plan, no Storage needed)
export async function compressImage(file, maxBytes = 180000){
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = url; });
    let side = 1100, q = 0.72, out = "";
    for (let i = 0; i < 8; i++) {
      const scale = Math.min(1, side / Math.max(img.width, img.height));
      const c = document.createElement("canvas");
      c.width = Math.round(img.width * scale); c.height = Math.round(img.height * scale);
      c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
      out = c.toDataURL("image/jpeg", q);
      if (out.length * 0.75 <= maxBytes) return out;
      if (q > 0.5) q -= 0.1; else side = Math.round(side * 0.8);
    }
    return out.length * 0.75 <= maxBytes * 1.5 ? out : null;
  } finally { URL.revokeObjectURL(url); }
}

export function statusPill(st){
  const s = STATUS[st] || STATUS.new;
  return `<span class="pill" style="--c:${s.color}">${s.label}</span>`;
}
