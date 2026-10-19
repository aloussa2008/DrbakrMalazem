/* ==========================================================================
   LEDGER — Math Exam Question Bank
   Vanilla JS, no frameworks. Organized into small modules on one file:
   CONFIG, Store, Utils, Toast, Modal, Auth, Router, Views, Charts.
   ========================================================================== */

/* ============================== CONFIG ============================== */
const CONFIG = (() => {
  const CHAPTERS = [
    "Expressions",
    "Linear Functions",
    "Linear Systems",
    "Linear Inequalities",
    "Composition of Functions and Function Notation",
    "Exponents and Radicals",
    "Absolute Value",
    "Quadratics",
    "Exponential Functions",
    "Rates and Ratios",
    "Percent",
    "Probability",
    "Reading Data",
    "Statistics",
    "Angles",
    "Triangles and Trigonometry",
    "Circles",
    "Unit Circle",
    "Areas and Perimeters",
    "Volumes",
  ];

  // Seeded once into the Users store on first run. fullName/username/password/role.
  const DEFAULT_USERS = [
    { fullName: "Eng Aloussa",        username: "Engaloussa",          password: "Aloussa2008",  role: "admin" },
    { fullName: "Mariam Mohammed",    username: "Muhendesmariam",      password: "201147982750", role: "user"  },
    { fullName: "Eyad Essam",         username: "MrEyadEssam",         password: "201041234738", role: "user"  },
    { fullName: "Mahmoud Hani",       username: "Eng7oda",             password: "201284423963", role: "user"  },
    { fullName: "Mohammed Ahmed",     username: "MrMohammedAhmedBhae", password: "201001590172", role: "user"  },
    { fullName: "Mariam Ahmed Galal", username: "DrMariamahmed",       password: "966564296120", role: "user"  },
  ];

  const DIFFICULTIES = ["Easy", "Medium", "Hard"];

  const CHAPTER_COLOR_VARS = [
    "--accent","--good","--gold","--ink-soft","--hard","--easy","--medium"
  ];

  return { CHAPTERS, DEFAULT_USERS, DIFFICULTIES };
})();

/* ============================== UTILS ============================== */
const Utils = (() => {
  function uid(prefix = "id") {
    return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  }
  function escapeHtml(str) {
    if (str === null || str === undefined) return "";
    return String(str)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }
  function debounce(fn, ms = 200) {
    let t;
    return (...args) => {
      clearTimeout(t);
      t = setTimeout(() => fn(...args), ms);
    };
  }
  function formatDate(iso) {
    if (!iso) return "—";
    const d = new Date(iso);
    if (isNaN(d.getTime())) return "—";
    return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
  }
  function todayISO() {
    return new Date().toISOString();
  }
  function download(filename, content, mime = "application/json") {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }
  function clamp(n, min, max) {
    return Math.max(min, Math.min(max, n));
  }
  function chapterSlug(name) {
    return encodeURIComponent(name);
  }
  function csvEscape(val) {
    const s = String(val ?? "");
    if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  }
  return { uid, escapeHtml, debounce, formatDate, todayISO, download, clamp, chapterSlug, csvEscape };
})();

/* ============================== STORE ============================== */
const Store = (() => {
  const KEYS = {
    quizzes: "ledger_quizzes",
    questions: "ledger_questions",
    theme: "ledger_theme",
    users: "ledger_users",
    session: "ledger_session",
    activity: "ledger_activity",
    drafts: "ledger_drafts",
    tasks: "ledger_tasks",
  };

  // In-memory cache so reads never depend on localStorage being available.
  const cache = new Map();

  function _get(key, fallback) {
    try {
      if (cache.has(key)) {
        const c = cache.get(key);
        return c === undefined ? fallback : JSON.parse(c);
      }
      const raw = localStorage.getItem(key);
      if (raw === null) return fallback;
      cache.set(key, raw);
      return JSON.parse(raw);
    } catch (e) {
      console.error("Store read failed for", key, e);
      return fallback;
    }
  }
  function _set(key, value) {
    const raw = JSON.stringify(value);
    cache.set(key, raw);              // always succeeds
    let lsOk = true;
    try {
      localStorage.setItem(key, raw); // fast synchronous copy
    } catch (e) {
      lsOk = false;
      console.error("localStorage write failed for", key, e);
    }
    Persist.mirror(key, raw, lsOk);   // durable IndexedDB copy
    return true;
  }
  function _hydrate(key, raw) { cache.set(key, raw); }

  return {
    getQuizzes: () => _get(KEYS.quizzes, []),
    setQuizzes: (v) => _set(KEYS.quizzes, v),
    getQuestions: () => _get(KEYS.questions, []),
    setQuestions: (v) => _set(KEYS.questions, v),
    getTheme: () => _get(KEYS.theme, "light"),
    setTheme: (v) => _set(KEYS.theme, v),
    getUsers: () => _get(KEYS.users, []),
    setUsers: (v) => _set(KEYS.users, v),
    getTasks: () => _get(KEYS.tasks, []),
    setTasks: (v) => _set(KEYS.tasks, v),
    getSession: () => _get(KEYS.session, null),
    setSession: (v) => _set(KEYS.session, v),
    getActivity: () => _get(KEYS.activity, []),
    setActivity: (v) => _set(KEYS.activity, v),
    getDrafts: () => _get(KEYS.drafts, {}),
    setDrafts: (v) => _set(KEYS.drafts, v),
    KEYS,
    _hydrate,
    _rawAll: () => Object.values(KEYS).map((k) => [k, cache.has(k) ? cache.get(k) : localStorage.getItem(k)]),
  };
})();

/* ============================== PERSIST (IndexedDB durable mirror) ============================== */
// Every Store write is mirrored into IndexedDB. On startup, anything missing from
// localStorage (cleared by the browser, quota problems, etc.) is restored from IndexedDB.
// No TTL, no expiry, no sessionStorage. Data is only removed when the app explicitly deletes it.
const Persist = (() => {
  const DB_NAME = "ledger_db";
  const STORE = "kv";
  let dbPromise = null;
  let warned = false;

  function openDB() {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise((resolve) => {
      try {
        if (!("indexedDB" in window)) return resolve(null);
        const req = indexedDB.open(DB_NAME, 1);
        req.onupgradeneeded = () => {
          if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE);
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => resolve(null);
        req.onblocked = () => resolve(null);
      } catch (e) {
        resolve(null);
      }
    });
    return dbPromise;
  }

  function idbGetAll(db) {
    return new Promise((resolve) => {
      try {
        const out = {};
        const req = db.transaction(STORE, "readonly").objectStore(STORE).openCursor();
        req.onsuccess = () => {
          const cur = req.result;
          if (cur) { out[cur.key] = cur.value; cur.continue(); } else resolve(out);
        };
        req.onerror = () => resolve(out);
      } catch (e) { resolve({}); }
    });
  }

  async function mirror(key, raw, lsOk = true) {
    const db = await openDB();
    if (!db) {
      if (!lsOk && !warned) {
        warned = true;
        Toast.show("Browser storage is unavailable — changes may not be saved.", "error");
      }
      return;
    }
    try {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).put(raw, key);
      tx.onerror = () => console.error("IndexedDB write failed for", key);
    } catch (e) {
      console.error("IndexedDB write failed for", key, e);
    }
  }

  // Runs once before the app boots.
  async function init() {
    try {
      if (navigator.storage && navigator.storage.persist) {
        // Ask the browser never to evict this site's data automatically.
        navigator.storage.persist().catch(() => {});
      }
    } catch (e) {}
    const db = await openDB();
    if (!db) return;
    const saved = await idbGetAll(db);
    for (const key of Object.values(Store.KEYS)) {
      let lsRaw = null;
      try { lsRaw = localStorage.getItem(key); } catch (e) {}
      if (lsRaw === null && saved[key] !== undefined) {
        // localStorage lost it, so restore from IndexedDB.
        Store._hydrate(key, saved[key]);
        try { localStorage.setItem(key, saved[key]); } catch (e) {}
      } else if (lsRaw !== null && saved[key] !== lsRaw) {
        // Existing data (or first run after this update) — back it up to IndexedDB.
        mirror(key, lsRaw, true);
      }
    }
  }

  function flushAll() {
    Store._rawAll().forEach(([k, raw]) => { if (raw !== null && raw !== undefined) mirror(k, raw, true); });
  }

  return { init, mirror, flushAll };
})();

/* ============================== FIREBASE CLOUD SYNC ============================== */
const FirebaseSync = (() => {
  const CONFIG_KEY = "ledger_firebase_config";
  let db = null;
  let app = null;
  let status = "disconnected"; // "disconnected", "connecting", "connected", "error"
  let errorMessage = "";
  let isRemoteSync = false;
  let unsubscribeListeners = [];

  function getConfig() {
    try {
      if (typeof localStorage !== "undefined") {
        const stored = localStorage.getItem(CONFIG_KEY);
        if (stored) return JSON.parse(stored);
      }
    } catch (e) {}
    if (typeof window !== "undefined" && window.FIREBASE_CONFIG && window.FIREBASE_CONFIG.apiKey && window.FIREBASE_CONFIG.projectId) {
      return window.FIREBASE_CONFIG;
    }
    return null;
  }

  function setConfig(cfg) {
    if (typeof localStorage === "undefined") return;
    if (cfg && cfg.apiKey && cfg.projectId) {
      localStorage.setItem(CONFIG_KEY, JSON.stringify(cfg));
    } else {
      localStorage.removeItem(CONFIG_KEY);
    }
  }

  function updateStatusUI() {
    if (typeof document === "undefined") return;
    const dot = document.getElementById("sync-dot");
    const label = document.getElementById("sync-label");
    const btn = document.getElementById("cloud-sync-btn");
    if (!dot || !label) return;

    dot.className = "sync-dot " + (status === "syncing" ? "syncing" : status === "connected" ? "connected" : status === "error" ? "error" : "");
    if (status === "connected") {
      const cfg = getConfig();
      label.textContent = "Cloud: Online";
      if (btn) btn.title = `Connected to Firebase (${cfg ? cfg.projectId : "Online"}). Click to manage sync.`;
    } else if (status === "syncing") {
      label.textContent = "Cloud: Syncing…";
      if (btn) btn.title = "Syncing with Firebase…";
    } else if (status === "error") {
      label.textContent = "Cloud: Error";
      if (btn) btn.title = `Firebase error: ${errorMessage}. Click to check configuration.`;
    } else {
      label.textContent = "Cloud: Local";
      if (btn) btn.title = "Running locally. Click to connect Firebase.";
    }
  }

  async function init() {
    if (typeof firebase === "undefined") {
      status = "disconnected";
      updateStatusUI();
      return;
    }
    const config = getConfig();
    if (!config || !config.apiKey || !config.projectId) {
      status = "disconnected";
      updateStatusUI();
      return;
    }

    try {
      status = "syncing";
      updateStatusUI();

      if (!firebase.apps || !firebase.apps.length) {
        app = firebase.initializeApp(config);
      } else {
        app = firebase.app();
      }
      db = firebase.firestore();

      // Test connectivity
      await db.collection("system").doc("ping").set({ lastPing: Date.now() }, { merge: true });
      status = "connected";
      errorMessage = "";
      updateStatusUI();
      setupRealtimeListeners();

      // If Firestore is completely fresh/empty and we have local data, seed it to cloud automatically
      try {
        const qzSnap = await db.collection("quizzes").limit(1).get();
        if (qzSnap.empty && Store.getQuizzes().length > 0) {
          console.log("Firestore empty on first connect, seeding local data to cloud...");
          await pushAll();
        }
      } catch (seedErr) {
        console.warn("Auto-seed check note:", seedErr);
      }
    } catch (err) {
      console.warn("Firebase init warning:", err);
      status = "error";
      if (err.code === "permission-denied" || (err.message && err.message.toLowerCase().includes("permission"))) {
        errorMessage = "Firestore permission denied. In Firebase Console → Firestore Database → Rules, set 'allow read, write: if true;'.";
      } else if (err.code === "not-found" || (err.message && err.message.toLowerCase().includes("not-found"))) {
        errorMessage = "Firestore database not created yet. In Firebase Console → Build → Firestore Database, click 'Create database'.";
      } else {
        errorMessage = err.message || "Could not connect to Firebase";
      }
      updateStatusUI();
    }
  }

  function setupRealtimeListeners() {
    unsubscribeListeners.forEach((unsub) => { try { unsub(); } catch (e) {} });
    unsubscribeListeners = [];

    if (!db || status !== "connected") return;

    const collections = [
      { name: "quizzes", get: Store.getQuizzes, set: Store.setQuizzes, key: "quizzes" },
      { name: "questions", get: Store.getQuestions, set: Store.setQuestions, key: "questions" },
      { name: "tasks", get: Store.getTasks, set: Store.setTasks, key: "tasks" },
      { name: "users", get: Store.getUsers, set: Store.setUsers, key: "users" },
    ];

    collections.forEach(({ name, get, set, key }) => {
      try {
        const unsub = db.collection(name).onSnapshot((snapshot) => {
          if (isRemoteSync) return;
          if (snapshot.empty) return;

          const remoteDocs = [];
          snapshot.forEach((doc) => {
            remoteDocs.push({ id: doc.id, ...doc.data() });
          });

          const localData = get();
          if (JSON.stringify(remoteDocs) !== JSON.stringify(localData)) {
            isRemoteSync = true;
            set(remoteDocs);
            isRemoteSync = false;
            if (typeof Router !== "undefined" && Router.rerender) {
              Router.rerender();
            }
            if ((key === "quizzes" || key === "questions") && typeof renderChapterNav === "function") {
              renderChapterNav();
            }
            if (key === "tasks" && typeof TaskNotifier !== "undefined") {
              TaskNotifier.checkForNewTasks();
            }
          }
        }, (err) => {
          console.warn(`Firestore onSnapshot error on ${name}:`, err);
        });
        unsubscribeListeners.push(unsub);
      } catch (e) {
        console.warn(`Failed to listen to ${name}:`, e);
      }
    });
  }

  async function syncDoc(colName, docId, data, isDelete = false) {
    if (!db || status !== "connected" || isRemoteSync) return;
    try {
      if (isDelete) {
        await db.collection(colName).doc(docId).delete();
      } else {
        await db.collection(colName).doc(docId).set(data, { merge: true });
      }
    } catch (err) {
      console.warn(`Firebase write failed for ${colName}/${docId}:`, err);
    }
  }

  async function pushAll() {
    if (!db || status !== "connected") {
      throw new Error("Firebase is not connected. Please enter valid Firebase credentials first.");
    }
    status = "syncing";
    updateStatusUI();

    try {
      const quizzes = Store.getQuizzes();
      const questions = Store.getQuestions();
      const tasks = Store.getTasks();
      const users = Store.getUsers();

      async function commitInBatches(colName, items) {
        if (!items || !items.length) return;
        const CHUNK_SIZE = 450;
        for (let i = 0; i < items.length; i += CHUNK_SIZE) {
          const chunk = items.slice(i, i + CHUNK_SIZE);
          const batch = db.batch();
          chunk.forEach((item) => {
            const ref = db.collection(colName).doc(item.id);
            batch.set(ref, item, { merge: true });
          });
          await batch.commit();
        }
      }

      await commitInBatches("quizzes", quizzes);
      await commitInBatches("questions", questions);
      await commitInBatches("tasks", tasks);
      await commitInBatches("users", users);

      status = "connected";
      updateStatusUI();
      return {
        quizzes: quizzes.length,
        questions: questions.length,
        tasks: tasks.length,
        users: users.length,
      };
    } catch (err) {
      status = "error";
      errorMessage = err.message;
      updateStatusUI();
      throw err;
    }
  }

  async function pullAll() {
    if (!db || status !== "connected") {
      throw new Error("Firebase is not connected. Please enter valid Firebase credentials first.");
    }
    status = "syncing";
    updateStatusUI();

    try {
      isRemoteSync = true;
      const qzSnap = await db.collection("quizzes").get();
      if (!qzSnap.empty) {
        const quizzes = [];
        qzSnap.forEach((doc) => quizzes.push({ id: doc.id, ...doc.data() }));
        Store.setQuizzes(quizzes);
      }

      const qSnap = await db.collection("questions").get();
      if (!qSnap.empty) {
        const questions = [];
        qSnap.forEach((doc) => questions.push({ id: doc.id, ...doc.data() }));
        Store.setQuestions(questions);
      }

      const tSnap = await db.collection("tasks").get();
      if (!tSnap.empty) {
        const tasks = [];
        tSnap.forEach((doc) => tasks.push({ id: doc.id, ...doc.data() }));
        Store.setTasks(tasks);
      }

      const uSnap = await db.collection("users").get();
      if (!uSnap.empty) {
        const users = [];
        uSnap.forEach((doc) => users.push({ id: doc.id, ...doc.data() }));
        Store.setUsers(users);
      }

      isRemoteSync = false;
      status = "connected";
      updateStatusUI();
      if (typeof Router !== "undefined" && Router.rerender) Router.rerender();
      if (typeof renderChapterNav === "function") renderChapterNav();
      return true;
    } catch (err) {
      isRemoteSync = false;
      status = "error";
      errorMessage = err.message;
      updateStatusUI();
      throw err;
    }
  }

  function disconnect() {
    unsubscribeListeners.forEach((unsub) => { try { unsub(); } catch (e) {} });
    unsubscribeListeners = [];
    db = null;
    app = null;
    status = "disconnected";
    errorMessage = "";
    setConfig(null);
    updateStatusUI();
  }

  return {
    init,
    getConfig,
    setConfig,
    getStatus: () => status,
    getError: () => errorMessage,
    syncDoc,
    pushAll,
    pullAll,
    disconnect,
    updateStatusUI,
  };
})();

/* ============================== DRAFTS (autosave while typing) ============================== */
// Everything typed into a form modal is saved on every keystroke and restored if the
// modal is closed by accident, the page refreshes, or the browser is reopened.
// A draft is only removed when the form is successfully submitted.
const Draft = (() => {
  function attach(modalEl, key) {
    if (!modalEl || !key) return;
    const fields = () => modalEl.querySelectorAll("input[id], textarea[id], select[id]");
    const saved = Store.getDrafts()[key];
    if (saved) {
      let restored = false;
      fields().forEach((el) => {
        if (Object.prototype.hasOwnProperty.call(saved, el.id) && el.value !== saved[el.id]) {
          el.value = saved[el.id];
          restored = true;
        }
      });
      const hid = modalEl.querySelector("#qf-difficulty");
      if (hid) {
        modalEl.querySelectorAll("#qf-diff-picker .diff-opt").forEach((b) => {
          b.dataset.active = String(b.dataset.level === hid.value);
        });
      }
      if (restored) Toast.show("Restored your unsaved entries.", "info");
    }
    const save = () => {
      const snapshot = {};
      fields().forEach((el) => { snapshot[el.id] = el.value; });
      const all = Store.getDrafts();
      all[key] = snapshot;
      Store.setDrafts(all);
    };
    modalEl.addEventListener("input", save);
    modalEl.addEventListener("change", save);
    modalEl.addEventListener("click", (e) => { if (e.target.closest(".diff-opt")) save(); });
  }
  function clear(key) {
    const all = Store.getDrafts();
    if (key in all) { delete all[key]; Store.setDrafts(all); }
  }
  return { attach, clear };
})();

/* ============================== ACTIVITY LOG ============================== */
const Activity = (() => {
  // userOverride lets Auth log a logout for the user who just got cleared
  // from the session, since by then Auth.currentUser() would return null.
  function log(action, details = "", userOverride = undefined) {
    const user = userOverride !== undefined ? userOverride : Auth.currentUser();
    const entries = Store.getActivity();
    entries.unshift({
      id: Utils.uid("act"),
      userId: user ? user.id : null,
      userName: user ? user.fullName : "Unknown",
      role: user ? user.role : "",
      action,
      details,
      at: Utils.todayISO(),
    });
    Store.setActivity(entries);
  }

  function getAll() {
    return Store.getActivity();
  }

  function clear() {
    Store.setActivity([]);
  }

  return { log, getAll, clear };
})();

/* ============================== TOAST ============================== */
const Toast = (() => {
  function show(message, type = "info", ms = 3200, { onClick = null } = {}) {
    const stack = document.getElementById("toast-stack");
    if (!stack) return;
    const el = document.createElement("div");
    el.className = `toast ${type}`;
    el.textContent = message;
    if (onClick) {
      el.style.cursor = "pointer";
      el.addEventListener("click", () => {
        onClick();
        el.remove();
      });
    }
    stack.appendChild(el);
    setTimeout(() => {
      el.style.transition = "opacity .2s ease, transform .2s ease";
      el.style.opacity = "0";
      el.style.transform = "translateX(12px)";
      setTimeout(() => el.remove(), 220);
    }, ms);
  }
  return { show };
})();

/* ============================== MODAL ============================== */
const Modal = (() => {
  let onCloseCb = null;

  function open(innerHtml, { wide = false, onClose = null, draftKey = null } = {}) {
    onCloseCb = onClose;
    const root = document.getElementById("modal-root");
    root.innerHTML = `
      <div class="modal-overlay" id="modal-overlay">
        <div class="modal ${wide ? "modal-wide" : ""}" role="dialog" aria-modal="true">${innerHtml}</div>
      </div>
    `;
    const overlay = document.getElementById("modal-overlay");
    overlay.addEventListener("mousedown", (e) => {
      if (e.target === overlay) close();
    });
    document.addEventListener("keydown", escListener);
    if (draftKey) Draft.attach(overlay.querySelector(".modal"), draftKey);
  }

  function escListener(e) {
    if (e.key === "Escape") close();
  }

  function close() {
    const root = document.getElementById("modal-root");
    root.innerHTML = "";
    document.removeEventListener("keydown", escListener);
    if (onCloseCb) onCloseCb();
    onCloseCb = null;
  }

  function confirmDialog({ title, message, confirmLabel = "Delete", danger = true, onConfirm }) {
    open(`
      <div class="modal-body confirm-modal">
        <div class="confirm-icon">${danger ? "⚠" : "?"}</div>
        <h3 style="margin-bottom:8px;">${Utils.escapeHtml(title)}</h3>
        <p style="color:var(--ink-soft); font-size:13.5px; line-height:1.5;">${message}</p>
      </div>
      <div class="modal-foot">
        <button class="btn btn-secondary" id="confirm-cancel">Cancel</button>
        <button class="btn ${danger ? "btn-danger" : "btn-primary"}" id="confirm-ok">${confirmLabel}</button>
      </div>
    `);
    document.getElementById("confirm-cancel").addEventListener("click", close);
    document.getElementById("confirm-ok").addEventListener("click", () => {
      close();
      onConfirm();
    });
  }

  return { open, close, confirmDialog };
})();

/* ============================== AUTH ============================== */
const Auth = (() => {
  function ensureSeedUsers() {
    try {
      if (localStorage.getItem("ledger_users_seeded") === "true") return;
      const existing = Store.getUsers();
      if (existing && existing.length) {
        localStorage.setItem("ledger_users_seeded", "true");
        return;
      }
      localStorage.setItem("ledger_users_seeded", "true");
    } catch (e) {}
    const seeded = CONFIG.DEFAULT_USERS.map((u) => ({
      id: Utils.uid("user"),
      fullName: u.fullName,
      username: u.username,
      password: u.password,
      role: u.role,
      status: "active",
      notes: "",
      lastLogin: null,
      createdAt: Utils.todayISO(),
    }));
    Store.setUsers(seeded);
  }

  function findByUsername(username) {
    const term = String(username || "").trim().toLowerCase();
    if (!term) return null;
    return Store.getUsers().find((u) => u.username.toLowerCase() === term) || null;
  }

  function currentUser() {
    const session = Store.getSession();
    if (!session || !session.userId) return null;
    const user = Store.getUsers().find((u) => u.id === session.userId);
    if (!user || user.status === "inactive") return null;
    return user;
  }

  function isAdmin() {
    const u = currentUser();
    return !!u && u.role === "admin";
  }

  function login(username, password) {
    const user = findByUsername(username);
    if (!user) return { ok: false, error: "No account with that username." };
    if (user.status === "inactive") return { ok: false, error: "This account has been deactivated. Contact an administrator." };
    if (user.password !== password) return { ok: false, error: "Incorrect password." };
    Store.setSession({ userId: user.id });
    const users = Store.getUsers();
    const idx = users.findIndex((u) => u.id === user.id);
    let updated = user;
    if (idx !== -1) {
      users[idx] = { ...users[idx], lastLogin: Utils.todayISO() };
      Store.setUsers(users);
      updated = users[idx];
    }
    Activity.log("Logged in", "", updated);
    if (typeof TaskNotifier !== "undefined") {
      TaskNotifier.resetSession();
      TaskNotifier.checkForNewTasks();
    }
    return { ok: true, user: updated };
  }

  function logout() {
    const user = currentUser();
    Store.setSession(null);
    if (typeof TaskNotifier !== "undefined") TaskNotifier.resetSession();
    if (user) Activity.log("Logged out", "", user);
  }

  return { ensureSeedUsers, findByUsername, currentUser, isAdmin, login, logout };
})();

/* ============================== DATA (business logic) ============================== */
const Data = (() => {
  function getQuizzes() {
    return Store.getQuizzes().slice().sort((a, b) => new Date(b.dateCreated) - new Date(a.dateCreated));
  }
  function getQuizById(id) {
    return Store.getQuizzes().find((q) => q.id === id) || null;
  }
  function createQuiz({ name, numQuestions, notes }) {
    const quizzes = Store.getQuizzes();
    const quiz = {
      id: Utils.uid("quiz"),
      name: name.trim(),
      numQuestions: Number(numQuestions) || 0,
      notes: (notes || "").trim(),
      dateCreated: Utils.todayISO(),
    };
    quizzes.push(quiz);
    Store.setQuizzes(quizzes);
    FirebaseSync.syncDoc("quizzes", quiz.id, quiz);
    return quiz;
  }
  function updateQuiz(id, patch) {
    const quizzes = Store.getQuizzes();
    const idx = quizzes.findIndex((q) => q.id === id);
    if (idx === -1) return null;
    quizzes[idx] = { ...quizzes[idx], ...patch };
    Store.setQuizzes(quizzes);
    FirebaseSync.syncDoc("quizzes", id, quizzes[idx]);
    return quizzes[idx];
  }
  function deleteQuiz(id) {
    Store.setQuizzes(Store.getQuizzes().filter((q) => q.id !== id));
    Store.setQuestions(Store.getQuestions().filter((q) => q.quizId !== id));
    FirebaseSync.syncDoc("quizzes", id, null, true);
  }

  function getQuestions() {
    return Store.getQuestions();
  }
  function getQuestionsForQuiz(quizId) {
    return Store.getQuestions().filter((q) => q.quizId === quizId).sort((a, b) => a.qNumInQuiz - b.qNumInQuiz);
  }
  function getQuestionsForChapter(chapter) {
    return Store.getQuestions()
      .filter((q) => q.chapter === chapter)
      .sort((a, b) => a.chapterQNum - b.chapterQNum);
  }

  // returns {ok:true} or {ok:false, errors:{field: msg}}
  function validateQuestion({ quizId, qNumInQuiz, chapter, chapterQNum, difficulty }, excludeId = null) {
    const errors = {};
    const quiz = getQuizById(quizId);
    if (!quizId || !quiz) errors.quizId = "Choose a quiz.";
    if (!chapter || !CONFIG.CHAPTERS.includes(chapter)) errors.chapter = "Choose a chapter.";
    if (!difficulty || !CONFIG.DIFFICULTIES.includes(difficulty)) errors.difficulty = "Choose a difficulty.";

    const qNum = Number(qNumInQuiz);
    if (!qNum || qNum < 1) {
      errors.qNumInQuiz = "Enter a positive question number.";
    } else if (quiz && qNum > quiz.numQuestions) {
      errors.qNumInQuiz = `Quiz only has ${quiz.numQuestions} questions.`;
    }

    const cNum = Number(chapterQNum);
    if (!cNum || cNum < 1) errors.chapterQNum = "Enter a positive chapter number.";

    if (quizId && qNum) {
      const dupQuiz = Store.getQuestions().find(
        (q) => q.quizId === quizId && q.qNumInQuiz === qNum && q.id !== excludeId
      );
      if (dupQuiz) errors.qNumInQuiz = `Question ${qNum} already exists in this quiz.`;
    }
    if (chapter && cNum) {
      const dupChapter = Store.getQuestions().find(
        (q) => q.chapter === chapter && q.chapterQNum === cNum && q.id !== excludeId
      );
      if (dupChapter) errors.chapterQNum = `Chapter question #${cNum} is already taken in ${chapter}.`;
    }

    return { ok: Object.keys(errors).length === 0, errors };
  }

  function createQuestion(payload) {
    const questions = Store.getQuestions();
    const question = {
      id: Utils.uid("q"),
      quizId: payload.quizId,
      qNumInQuiz: Number(payload.qNumInQuiz),
      chapter: payload.chapter,
      chapterQNum: Number(payload.chapterQNum),
      difficulty: payload.difficulty,
      bookName: (payload.bookName || "").trim(),
      answer: (payload.answer || "").trim(),
      notes: (payload.notes || "").trim(),
      dateAdded: Utils.todayISO(),
    };
    questions.push(question);
    Store.setQuestions(questions);
    FirebaseSync.syncDoc("questions", question.id, question);
    return question;
  }
  function updateQuestion(id, patch) {
    const questions = Store.getQuestions();
    const idx = questions.findIndex((q) => q.id === id);
    if (idx === -1) return null;
    const merged = { ...questions[idx], ...patch };
    if (patch.qNumInQuiz !== undefined) merged.qNumInQuiz = Number(patch.qNumInQuiz);
    if (patch.chapterQNum !== undefined) merged.chapterQNum = Number(patch.chapterQNum);
    if (patch.bookName !== undefined) merged.bookName = (patch.bookName || "").trim();
    if (patch.answer !== undefined) merged.answer = (patch.answer || "").trim();
    if (patch.notes !== undefined) merged.notes = (patch.notes || "").trim();
    questions[idx] = merged;
    Store.setQuestions(questions);
    FirebaseSync.syncDoc("questions", id, merged);
    return merged;
  }
  function deleteQuestion(id) {
    Store.setQuestions(Store.getQuestions().filter((q) => q.id !== id));
    FirebaseSync.syncDoc("questions", id, null, true);
  }

  function quizStats(quiz) {
    const entered = getQuestionsForQuiz(quiz.id).length;
    const missing = Math.max(0, quiz.numQuestions - entered);
    const pct = quiz.numQuestions > 0 ? Math.round((entered / quiz.numQuestions) * 100) : 0;
    const missingNums = [];
    if (quiz.numQuestions > 0) {
      const present = new Set(getQuestionsForQuiz(quiz.id).map((q) => q.qNumInQuiz));
      for (let i = 1; i <= quiz.numQuestions; i++) if (!present.has(i)) missingNums.push(i);
    }
    return { entered, missing, pct, missingNums };
  }

  function chapterCounts() {
    const questions = Store.getQuestions();
    const counts = {};
    CONFIG.CHAPTERS.forEach((c) => (counts[c] = 0));
    questions.forEach((q) => {
      if (counts[q.chapter] !== undefined) counts[q.chapter]++;
    });
    return counts;
  }

  function globalStats() {
    const quizzes = Store.getQuizzes();
    const questions = Store.getQuestions();
    const totalCapacity = quizzes.reduce((s, q) => s + (Number(q.numQuestions) || 0), 0);
    const entered = questions.length;
    const remaining = Math.max(0, totalCapacity - entered);
    const counts = chapterCounts();
    const chapterEntries = Object.entries(counts);
    const missingChapters = chapterEntries.filter(([, c]) => c === 0).map(([name]) => name);
    let most = null, least = null;
    const nonZero = chapterEntries.filter(([, c]) => c > 0);
    if (nonZero.length) {
      most = nonZero.reduce((a, b) => (b[1] > a[1] ? b : a));
      least = nonZero.reduce((a, b) => (b[1] < a[1] ? b : a));
    }
    const progressPct = totalCapacity > 0 ? Math.round((entered / totalCapacity) * 100) : 0;
    const avgPerQuiz = quizzes.length ? (entered / quizzes.length) : 0;
    return {
      totalQuizzes: quizzes.length,
      totalCapacity,
      entered,
      remaining,
      counts,
      missingChapters,
      most,
      least,
      progressPct,
      avgPerQuiz,
    };
  }

  function search(term) {
    term = (term || "").trim().toLowerCase();
    if (!term) return [];
    const quizzesById = {};
    Store.getQuizzes().forEach((qz) => (quizzesById[qz.id] = qz));
    return Store.getQuestions()
      .filter((q) => {
        const quiz = quizzesById[q.quizId];
        const haystack = [
          quiz ? quiz.name : "",
          String(q.qNumInQuiz),
          q.chapter,
          String(q.chapterQNum),
          q.bookName || "",
          q.answer || "",
          q.difficulty,
          q.notes,
        ]
          .join(" ")
          .toLowerCase();
        return haystack.includes(term);
      })
      .map((q) => ({ ...q, quizName: quizzesById[q.quizId] ? quizzesById[q.quizId].name : "(deleted quiz)" }));
  }

  function exportJSON() {
    return JSON.stringify({
      quizzes: Store.getQuizzes(),
      questions: Store.getQuestions(),
      users: Store.getUsers(),
      tasks: Store.getTasks(),
      exportedAt: Utils.todayISO(),
    }, null, 2);
  }
  function importJSON(jsonStr) {
    const data = JSON.parse(jsonStr);
    if (!Array.isArray(data.quizzes) || !Array.isArray(data.questions)) {
      throw new Error("File does not look like a Ledger export.");
    }
    Store.setQuizzes(data.quizzes);
    Store.setQuestions(data.questions);
    if (Array.isArray(data.users) && data.users.length) {
      Store.setUsers(data.users);
    }
    if (Array.isArray(data.tasks)) {
      Store.setTasks(data.tasks);
    }
  }

  /* ---------- Users ---------- */
  function getUsers() {
    return Store.getUsers().slice().sort((a, b) => a.fullName.localeCompare(b.fullName));
  }
  function getUserById(id) {
    return Store.getUsers().find((u) => u.id === id) || null;
  }
  function validateUser({ fullName, username, password }, excludeId = null) {
    const errors = {};
    if (!fullName || !fullName.trim()) errors.fullName = "Enter a full name.";
    const uname = (username || "").trim();
    if (!uname) {
      errors.username = "Enter a username.";
    } else {
      const dupe = Store.getUsers().find((u) => u.username.toLowerCase() === uname.toLowerCase() && u.id !== excludeId);
      if (dupe) errors.username = "That username is already taken.";
    }
    if (!password || !password.trim()) errors.password = "Password cannot be empty.";
    return { ok: Object.keys(errors).length === 0, errors };
  }
  function createUser({ fullName, username, password, role, notes }) {
    const users = Store.getUsers();
    const user = {
      id: Utils.uid("user"),
      fullName: fullName.trim(),
      username: username.trim(),
      password: password.trim(),
      role: role === "admin" ? "admin" : "user",
      status: "active",
      notes: (notes || "").trim(),
      lastLogin: null,
      createdAt: Utils.todayISO(),
    };
    users.push(user);
    Store.setUsers(users);
    FirebaseSync.syncDoc("users", user.id, user);
    return user;
  }
  function updateUser(id, patch) {
    const users = Store.getUsers();
    const idx = users.findIndex((u) => u.id === id);
    if (idx === -1) return null;
    users[idx] = { ...users[idx], ...patch };
    Store.setUsers(users);
    FirebaseSync.syncDoc("users", id, users[idx]);
    return users[idx];
  }
  function deleteUser(id) {
    Store.setUsers(Store.getUsers().filter((u) => u.id !== id));
    FirebaseSync.syncDoc("users", id, null, true);
  }
  function exportCSV() {
    const quizzesById = {};
    Store.getQuizzes().forEach((qz) => (quizzesById[qz.id] = qz));
    const rows = [["Quiz", "Question # in Quiz", "Chapter", "Chapter Question #", "Book Name", "Answer", "Difficulty", "Notes", "Date Added"]];
    Store.getQuestions().forEach((q) => {
      rows.push([
        quizzesById[q.quizId] ? quizzesById[q.quizId].name : "(deleted quiz)",
        q.qNumInQuiz,
        q.chapter,
        q.chapterQNum,
        q.bookName || "",
        q.answer || "",
        q.difficulty,
        q.notes,
        Utils.formatDate(q.dateAdded),
      ]);
    });
    return rows.map((r) => r.map(Utils.csvEscape).join(",")).join("\n");
  }

  /* ---------- Tasks (Admin Only) ---------- */
  function ensureSeedTasks() {
    try {
      if (localStorage.getItem("ledger_tasks_seeded") === "true") return;
      const existing = Store.getTasks();
      if (existing && existing.length) {
        localStorage.setItem("ledger_tasks_seeded", "true");
        return;
      }
      localStorage.setItem("ledger_tasks_seeded", "true");
    } catch (e) {}
    const seeded = [
      {
        id: Utils.uid("task"),
        title: "Review Linear Functions questions & answers",
        description: "Double check all question numbers and answers from Dr Bakr study material.",
        assignedTo: "All",
        priority: "High",
        status: "In Progress",
        dueDate: "",
        createdBy: "Eng Aloussa",
        createdAt: Utils.todayISO(),
        completedAt: null,
      },
      {
        id: Utils.uid("task"),
        title: "Log remaining questions for Actual May INT B",
        description: "Complete entering questions from Module 2.",
        assignedTo: "Eng Aloussa",
        priority: "Medium",
        status: "Pending",
        dueDate: "",
        createdBy: "Eng Aloussa",
        createdAt: Utils.todayISO(),
        completedAt: null,
      },
    ];
    Store.setTasks(seeded);
  }

  function getTasks() {
    ensureSeedTasks();
    return Store.getTasks().slice().sort((a, b) => {
      if (a.status === "Completed" && b.status !== "Completed") return 1;
      if (a.status !== "Completed" && b.status === "Completed") return -1;
      const pMap = { "High": 3, "Medium": 2, "Low": 1 };
      const pd = (pMap[b.priority] || 2) - (pMap[a.priority] || 2);
      if (pd !== 0) return pd;
      return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
    });
  }
  function getTaskById(id) {
    return Store.getTasks().find((t) => t.id === id) || null;
  }
  function validateTask({ title }) {
    const errors = {};
    if (!title || !title.trim()) errors.title = "Enter a task title.";
    return { ok: Object.keys(errors).length === 0, errors };
  }
  function createTask({ title, description, assignedTo, priority, dueDate, status }) {
    const tasks = Store.getTasks();
    const me = Auth.currentUser();
    const isAdmin = Auth.isAdmin();
    let finalAssignedTo = (assignedTo || "").trim();
    if (!isAdmin) {
      finalAssignedTo = me ? me.fullName : "";
    }
    const task = {
      id: Utils.uid("task"),
      title: title.trim(),
      description: (description || "").trim(),
      assignedTo: finalAssignedTo,
      priority: priority || "Medium",
      status: status || "Pending",
      dueDate: dueDate || "",
      createdBy: me ? me.fullName : "Admin",
      createdAt: Utils.todayISO(),
      completedAt: status === "Completed" ? Utils.todayISO() : null,
    };
    tasks.unshift(task);
    Store.setTasks(tasks);
    FirebaseSync.syncDoc("tasks", task.id, task);
    if (typeof TaskNotifier !== "undefined") TaskNotifier.checkForNewTasks();
    return task;
  }
  function updateTask(id, patch) {
    const tasks = Store.getTasks();
    const idx = tasks.findIndex((t) => t.id === id);
    if (idx === -1) return null;
    const existing = tasks[idx];
    const me = Auth.currentUser();
    const isAdmin = Auth.isAdmin();

    if (!isAdmin) {
      const isMine = me && (existing.assignedTo === me.fullName || existing.createdBy === me.fullName);
      if (!isMine) {
        Toast.show("You can only edit your own tasks.", "error");
        return null;
      }
    }

    const updated = { ...existing, ...patch };
    if (patch.title !== undefined) updated.title = patch.title.trim();
    if (patch.description !== undefined) updated.description = patch.description.trim();
    if (patch.assignedTo !== undefined) {
      if (!isAdmin) {
        updated.assignedTo = me ? me.fullName : existing.assignedTo;
      } else {
        updated.assignedTo = patch.assignedTo.trim();
      }
    }
    if (patch.status !== undefined) {
      updated.status = patch.status;
      if (patch.status === "Completed" && existing.status !== "Completed") {
        updated.completedAt = Utils.todayISO();
      } else if (patch.status !== "Completed") {
        updated.completedAt = null;
      }
    }
    tasks[idx] = updated;
    Store.setTasks(tasks);
    FirebaseSync.syncDoc("tasks", id, updated);
    if (typeof TaskNotifier !== "undefined") TaskNotifier.updateBadge();
    return updated;
  }
  function toggleTaskStatus(id) {
    const task = getTaskById(id);
    if (!task) return null;
    const me = Auth.currentUser();
    const isAdmin = Auth.isAdmin();
    if (!isAdmin) {
      const canToggle = me && (task.assignedTo === me.fullName || task.assignedTo === "All" || task.createdBy === me.fullName);
      if (!canToggle) {
        Toast.show("You cannot change the status of another member's task.", "error");
        return null;
      }
    }
    const nextStatus = task.status === "Completed" ? "Pending" : "Completed";
    return updateTask(id, { status: nextStatus });
  }
  function deleteTask(id) {
    const task = getTaskById(id);
    if (!task) return;
    const me = Auth.currentUser();
    const isAdmin = Auth.isAdmin();
    if (!isAdmin) {
      const canDelete = me && (task.assignedTo === me.fullName || task.createdBy === me.fullName);
      if (!canDelete) {
        Toast.show("You can only delete your own tasks.", "error");
        return;
      }
    }
    Store.setTasks(Store.getTasks().filter((t) => t.id !== id));
    FirebaseSync.syncDoc("tasks", id, null, true);
    if (typeof TaskNotifier !== "undefined") TaskNotifier.updateBadge();
  }

  return {
    getQuizzes, getQuizById, createQuiz, updateQuiz, deleteQuiz,
    getQuestions, getQuestionsForQuiz, getQuestionsForChapter,
    validateQuestion, createQuestion, updateQuestion, deleteQuestion,
    quizStats, chapterCounts, globalStats, search,
    exportJSON, importJSON, exportCSV,
    getUsers, getUserById, validateUser, createUser, updateUser, deleteUser,
    getTasks, getTaskById, validateTask, createTask, updateTask, toggleTaskStatus, deleteTask,
  };
})();

/* ============================== CHARTS (canvas, no deps) ============================== */
const Charts = (() => {
  function cssVar(name) {
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  }
  const palette = () => [
    cssVar("--accent"), cssVar("--good"), cssVar("--gold"),
    cssVar("--ink"), cssVar("--accent-deep") || "#780000", "#669BBC", "#C1121F", "#003049",
  ];

  function setupCanvas(canvas) {
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    const ctx = canvas.getContext("2d");
    ctx.scale(dpr, dpr);
    return { ctx, w: rect.width, h: rect.height };
  }

  function barChart(canvas, labels, values) {
    const { ctx, w, h } = setupCanvas(canvas);
    ctx.clearRect(0, 0, w, h);
    const max = Math.max(1, ...values);
    const padLeft = 6, padBottom = 34, padTop = 10;
    const barGap = 6;
    const barW = Math.max(4, (w - padLeft - 6) / values.length - barGap);
    const colors = palette();
    ctx.font = "10px 'JetBrains Mono', monospace";
    ctx.fillStyle = cssVar("--ink-faint");
    values.forEach((v, i) => {
      const x = padLeft + i * (barW + barGap);
      const barH = ((h - padTop - padBottom) * v) / max;
      const y = h - padBottom - barH;
      ctx.fillStyle = v === 0 ? cssVar("--line-strong") : colors[i % colors.length];
      ctx.beginPath();
      const r = 3;
      ctx.moveTo(x, y + barH);
      ctx.lineTo(x, y + r);
      ctx.arcTo(x, y, x + r, y, r);
      ctx.lineTo(x + barW - r, y);
      ctx.arcTo(x + barW, y, x + barW, y + r, r);
      ctx.lineTo(x + barW, y + barH);
      ctx.closePath();
      ctx.fill();

      ctx.save();
      ctx.fillStyle = cssVar("--ink-faint");
      ctx.font = "9px 'JetBrains Mono', monospace";
      ctx.translate(x + barW / 2, h - padBottom + 8);
      ctx.rotate(-Math.PI / 3.2);
      ctx.textAlign = "right";
      const label = labels[i].length > 14 ? labels[i].slice(0, 13) + "…" : labels[i];
      ctx.fillText(label, 0, 0);
      ctx.restore();

      if (v > 0) {
        ctx.fillStyle = cssVar("--ink-soft");
        ctx.font = "10px 'JetBrains Mono', monospace";
        ctx.textAlign = "center";
        ctx.fillText(String(v), x + barW / 2, y - 4);
      }
    });
  }

  function pieChart(canvas, labels, values) {
    const { ctx, w, h } = setupCanvas(canvas);
    ctx.clearRect(0, 0, w, h);
    const total = values.reduce((a, b) => a + b, 0);
    const cx = w / 2, cy = h / 2, r = Math.min(w, h) / 2 - 6;
    const colors = palette();
    if (total === 0) {
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.strokeStyle = cssVar("--line-strong");
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.fillStyle = cssVar("--ink-faint");
      ctx.font = "12px Inter, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("No data yet", cx, cy + 4);
      return;
    }
    let start = -Math.PI / 2;
    values.forEach((v, i) => {
      if (v === 0) return;
      const slice = (v / total) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, r, start, start + slice);
      ctx.closePath();
      ctx.fillStyle = colors[i % colors.length];
      ctx.fill();
      start += slice;
    });
    // donut hole
    ctx.globalCompositeOperation = "destination-out";
    ctx.beginPath();
    ctx.arc(cx, cy, r * 0.55, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalCompositeOperation = "source-over";
  }

  return { barChart, pieChart, palette };
})();

/* ============================== QUESTION FORM (shared modal) ============================== */
const QuestionForm = (() => {
  function open({ question = null, presetQuizId = null } = {}) {
    const quizzes = Data.getQuizzes();
    const isEdit = !!question;
    const draftKey = isEdit ? `question:${question.id}` : "question:new";
    const q = question || { quizId: presetQuizId || "", qNumInQuiz: "", chapter: "", chapterQNum: "", bookName: "", answer: "", difficulty: "", notes: "" };
    const existingBooks = [...new Set(Data.getQuestions().map((item) => (item.bookName || "").trim()).filter(Boolean))].sort();

    if (quizzes.length === 0) {
      Modal.open(`
        <div class="modal-body empty-state">
          <div class="empty-ico">▤</div>
          <h3>Create a quiz first</h3>
          <p>You need at least one quiz before adding questions to it.</p>
          <div style="margin-top:16px;"><button class="btn btn-primary" id="go-make-quiz">New Quiz</button></div>
        </div>
      `);
      document.getElementById("go-make-quiz").addEventListener("click", () => {
        Modal.close();
        QuizForm.open();
      });
      return;
    }

    Modal.open(`
      <div class="modal-head">
        <h3>${isEdit ? "Edit Question" : "Add Question"}</h3>
        <button class="icon-btn" id="qf-close">✕</button>
      </div>
      <div class="modal-body">
        <form id="question-form">
          <div class="form-row" id="row-quizId">
            <label>Quiz</label>
            <select id="qf-quizId">
              <option value="">Select a quiz…</option>
              ${quizzes.map((qz) => `<option value="${qz.id}" ${qz.id === q.quizId ? "selected" : ""}>${Utils.escapeHtml(qz.name)}</option>`).join("")}
            </select>
            <div class="err-msg" data-err="quizId"></div>
          </div>

          <div class="form-grid-2">
            <div class="form-row" id="row-qNumInQuiz">
              <label>Question # in Quiz</label>
              <input type="number" min="1" id="qf-qNumInQuiz" value="${Utils.escapeHtml(q.qNumInQuiz)}" placeholder="e.g. 15" />
              <div class="err-msg" data-err="qNumInQuiz"></div>
            </div>
            <div class="form-row" id="row-chapterQNum">
              <label>Question # in Chapter</label>
              <input type="number" min="1" id="qf-chapterQNum" value="${Utils.escapeHtml(q.chapterQNum)}" placeholder="e.g. 7" />
              <div class="err-msg" data-err="chapterQNum"></div>
            </div>
          </div>

          <div class="form-row" id="row-chapter">
            <label>Chapter</label>
            <select id="qf-chapter">
              <option value="">Select a chapter…</option>
              ${CONFIG.CHAPTERS.map((c) => `<option value="${Utils.escapeHtml(c)}" ${c === q.chapter ? "selected" : ""}>${Utils.escapeHtml(c)}</option>`).join("")}
            </select>
            <div class="err-msg" data-err="chapter"></div>
          </div>

          <div class="form-grid-2">
            <div class="form-row" id="row-bookName">
              <label>Book Name</label>
              <input type="text" id="qf-bookName" list="book-suggestions" value="${Utils.escapeHtml(q.bookName || "")}" placeholder="e.g. Panda, College Board…" autocomplete="off" />
              <datalist id="book-suggestions">
                ${existingBooks.map((b) => `<option value="${Utils.escapeHtml(b)}"></option>`).join("")}
              </datalist>
              <div class="err-msg" data-err="bookName"></div>
            </div>
            <div class="form-row" id="row-answer">
              <label>Answer</label>
              <input type="text" id="qf-answer" value="${Utils.escapeHtml(q.answer || "")}" placeholder="e.g. A, B, C, D or 42" />
              <div class="err-msg" data-err="answer"></div>
            </div>
          </div>

          <div class="form-row" id="row-difficulty">
            <label>Difficulty</label>
            <div class="diff-picker" id="qf-diff-picker">
              ${CONFIG.DIFFICULTIES.map((d) => `<button type="button" class="diff-opt" data-level="${d}" data-active="${d === q.difficulty}">${d}</button>`).join("")}
            </div>
            <input type="hidden" id="qf-difficulty" value="${Utils.escapeHtml(q.difficulty)}" />
            <div class="err-msg" data-err="difficulty"></div>
          </div>

          <div class="form-row">
            <label>Notes <span style="font-weight:400; color:var(--ink-faint);">(optional)</span></label>
            <textarea id="qf-notes" placeholder="Anything worth remembering about this question…">${Utils.escapeHtml(q.notes)}</textarea>
          </div>
        </form>
      </div>
      <div class="modal-foot">
        <button class="btn btn-secondary" id="qf-cancel">Cancel</button>
        <button class="btn btn-primary" id="qf-save">${isEdit ? "Save Changes" : "Add Question"}</button>
      </div>
    `, { wide: false, draftKey });

    document.getElementById("qf-close").addEventListener("click", Modal.close);
    document.getElementById("qf-cancel").addEventListener("click", Modal.close);
    document.querySelectorAll("#qf-diff-picker .diff-opt").forEach((btn) => {
      btn.addEventListener("click", () => {
        document.querySelectorAll("#qf-diff-picker .diff-opt").forEach((b) => b.dataset.active = "false");
        btn.dataset.active = "true";
        document.getElementById("qf-difficulty").value = btn.dataset.level;
      });
    });

    document.getElementById("qf-save").addEventListener("click", () => {
      const payload = {
        quizId: document.getElementById("qf-quizId").value,
        qNumInQuiz: document.getElementById("qf-qNumInQuiz").value,
        chapter: document.getElementById("qf-chapter").value,
        chapterQNum: document.getElementById("qf-chapterQNum").value,
        bookName: document.getElementById("qf-bookName").value,
        answer: document.getElementById("qf-answer").value,
        difficulty: document.getElementById("qf-difficulty").value,
        notes: document.getElementById("qf-notes").value,
      };
      document.querySelectorAll(".err-msg").forEach((e) => (e.textContent = ""));
      document.querySelectorAll(".form-row").forEach((e) => e.classList.remove("error"));

      const { ok, errors } = Data.validateQuestion(payload, isEdit ? question.id : null);
      if (!ok) {
        Object.entries(errors).forEach(([field, msg]) => {
          const row = document.getElementById(`row-${field}`);
          if (row) {
            row.classList.add("error");
            row.querySelector(".err-msg").textContent = msg;
          }
        });
        return;
      }
      if (isEdit) {
        Data.updateQuestion(question.id, payload);
        Activity.log("Edited question", `Q${payload.qNumInQuiz} · ${payload.chapter}${payload.bookName ? ` · ${payload.bookName}` : ""}`);
        Toast.show("Question updated.", "success");
      } else {
        Data.createQuestion(payload);
        Activity.log("Added question", `Q${payload.qNumInQuiz} · ${payload.chapter}${payload.bookName ? ` · ${payload.bookName}` : ""}`);
        Toast.show("Question added.", "success");
      }
      Draft.clear(draftKey);
      Modal.close();
      Router.rerender();
    });
  }
  return { open };
})();

/* ============================== QUIZ FORM (shared modal) ============================== */
const QuizForm = (() => {
  function open({ quiz = null } = {}) {
    const isEdit = !!quiz;
    const draftKey = isEdit ? `quiz:${quiz.id}` : "quiz:new";
    const q = quiz || { name: "", numQuestions: "", notes: "" };
    Modal.open(`
      <div class="modal-head">
        <h3>${isEdit ? "Edit Quiz" : "New Quiz"}</h3>
        <button class="icon-btn" id="qz-close">✕</button>
      </div>
      <div class="modal-body">
        <form id="quiz-form">
          <div class="form-row" id="row-name">
            <label>Quiz Name</label>
            <input type="text" id="qz-name" value="${Utils.escapeHtml(q.name)}" placeholder="e.g. Actual May INT B" />
            <div class="err-msg" data-err="name"></div>
          </div>
          <div class="form-row" id="row-numQuestions">
            <label>Number of Questions</label>
            <input type="number" min="1" id="qz-numQuestions" value="${Utils.escapeHtml(q.numQuestions)}" placeholder="e.g. 44" />
            <div class="err-msg" data-err="numQuestions"></div>
            ${isEdit ? '<div class="hint">Lowering this below entered questions will just show as over 100% until you remove some.</div>' : ""}
          </div>
          <div class="form-row">
            <label>Notes <span style="font-weight:400; color:var(--ink-faint);">(optional)</span></label>
            <textarea id="qz-notes" placeholder="Session, section, anything worth flagging…">${Utils.escapeHtml(q.notes)}</textarea>
          </div>
        </form>
      </div>
      <div class="modal-foot">
        <button class="btn btn-secondary" id="qz-cancel">Cancel</button>
        <button class="btn btn-primary" id="qz-save">${isEdit ? "Save Changes" : "Create Quiz"}</button>
      </div>
    `, { draftKey });
    document.getElementById("qz-close").addEventListener("click", Modal.close);
    document.getElementById("qz-cancel").addEventListener("click", Modal.close);
    document.getElementById("qz-save").addEventListener("click", () => {
      const name = document.getElementById("qz-name").value.trim();
      const numQuestions = document.getElementById("qz-numQuestions").value;
      const notes = document.getElementById("qz-notes").value;
      document.querySelectorAll(".err-msg").forEach((e) => (e.textContent = ""));
      document.querySelectorAll(".form-row").forEach((e) => e.classList.remove("error"));

      let hasError = false;
      if (!name) {
        document.getElementById("row-name").classList.add("error");
        document.querySelector("#row-name .err-msg").textContent = "Give the quiz a name.";
        hasError = true;
      } else {
        const dupe = Data.getQuizzes().find((qz) => qz.name.toLowerCase() === name.toLowerCase() && (!isEdit || qz.id !== quiz.id));
        if (dupe) {
          document.getElementById("row-name").classList.add("error");
          document.querySelector("#row-name .err-msg").textContent = "A quiz with this name already exists.";
          hasError = true;
        }
      }
      if (!numQuestions || Number(numQuestions) < 1) {
        document.getElementById("row-numQuestions").classList.add("error");
        document.querySelector("#row-numQuestions .err-msg").textContent = "Enter how many questions this quiz has.";
        hasError = true;
      }
      if (hasError) return;

      if (isEdit) {
        Data.updateQuiz(quiz.id, { name, numQuestions: Number(numQuestions), notes });
        Activity.log("Edited quiz", name);
        Toast.show("Quiz updated.", "success");
      } else {
        Data.createQuiz({ name, numQuestions, notes });
        Activity.log("Created quiz", name);
        Toast.show("Quiz created.", "success");
      }
      Draft.clear(draftKey);
      Modal.close();
      Router.rerender();
    });
  }
  return { open };
})();

/* ============================== USER FORM (admin only, shared modal) ============================== */
const UserForm = (() => {
  function open({ user = null } = {}) {
    const isEdit = !!user;
    const draftKey = isEdit ? `user:${user.id}` : "user:new";
    const u = user || { fullName: "", username: "", password: "", role: "user", notes: "" };
    Modal.open(`
      <div class="modal-head">
        <h3>${isEdit ? "Edit User" : "New User"}</h3>
        <button class="icon-btn" id="uf-close">✕</button>
      </div>
      <div class="modal-body">
        <form id="user-form">
          <div class="form-row" id="row-fullName">
            <label>Full Name</label>
            <input type="text" id="uf-fullName" value="${Utils.escapeHtml(u.fullName)}" placeholder="e.g. Sara Ahmed" />
            <div class="err-msg" data-err="fullName"></div>
          </div>
          <div class="form-row" id="row-username">
            <label>Username</label>
            <input type="text" id="uf-username" value="${Utils.escapeHtml(u.username)}" placeholder="e.g. SaraA" />
            <div class="err-msg" data-err="username"></div>
          </div>
          <div class="form-row" id="row-password">
            <label>Password</label>
            <input type="text" id="uf-password" value="${Utils.escapeHtml(u.password)}" placeholder="Set a password" />
            <div class="err-msg" data-err="password"></div>
          </div>
          <div class="form-row" id="row-role">
            <label>Role</label>
            <select id="uf-role">
              <option value="user" ${u.role !== "admin" ? "selected" : ""}>User</option>
              <option value="admin" ${u.role === "admin" ? "selected" : ""}>Administrator</option>
            </select>
          </div>
          <div class="form-row" id="row-notes">
            <label>Notes <span style="font-weight:400; color:var(--ink-faint);">(optional)</span></label>
            <textarea id="uf-notes" placeholder="Notes, tasks, or study instructions…">${Utils.escapeHtml(u.notes || "")}</textarea>
          </div>
        </form>
      </div>
      <div class="modal-foot">
        <button class="btn btn-secondary" id="uf-cancel">Cancel</button>
        <button class="btn btn-primary" id="uf-save">${isEdit ? "Save Changes" : "Create User"}</button>
      </div>
    `, { draftKey });
    document.getElementById("uf-close").addEventListener("click", Modal.close);
    document.getElementById("uf-cancel").addEventListener("click", Modal.close);
    document.getElementById("uf-save").addEventListener("click", () => {
      const payload = {
        fullName: document.getElementById("uf-fullName").value,
        username: document.getElementById("uf-username").value,
        password: document.getElementById("uf-password").value,
        role: document.getElementById("uf-role").value,
        notes: document.getElementById("uf-notes").value,
      };
      document.querySelectorAll(".err-msg").forEach((e) => (e.textContent = ""));
      document.querySelectorAll(".form-row").forEach((e) => e.classList.remove("error"));

      const { ok, errors } = Data.validateUser(payload, isEdit ? user.id : null);
      if (!ok) {
        Object.entries(errors).forEach(([field, msg]) => {
          const row = document.getElementById(`row-${field}`);
          if (row) {
            row.classList.add("error");
            row.querySelector(".err-msg").textContent = msg;
          }
        });
        return;
      }
      if (isEdit) {
        Data.updateUser(user.id, payload);
        Activity.log("Edited user", payload.fullName);
        Toast.show("User updated.", "success");
      } else {
        Data.createUser(payload);
        Activity.log("Created user", payload.fullName);
        Toast.show("User created.", "success");
      }
      Draft.clear(draftKey);
      Modal.close();
      Router.rerender();
    });
  }
  return { open };
})();

/* ============================== RESET PASSWORD (admin only, shared modal) ============================== */
const ResetPasswordForm = (() => {
  function open(userId) {
    const user = Data.getUserById(userId);
    if (!user) return;
    Modal.open(`
      <div class="modal-head">
        <h3>Reset Password</h3>
        <button class="icon-btn" id="rp-close">✕</button>
      </div>
      <div class="modal-body">
        <p style="color:var(--ink-soft); font-size:13.5px; margin-bottom:14px;">Set a new password for <strong>${Utils.escapeHtml(user.fullName)}</strong>.</p>
        <div class="form-row" id="row-password">
          <label>New Password</label>
          <input type="text" id="rp-password" placeholder="Enter new password" />
          <div class="err-msg" data-err="password"></div>
        </div>
      </div>
      <div class="modal-foot">
        <button class="btn btn-secondary" id="rp-cancel">Cancel</button>
        <button class="btn btn-primary" id="rp-save">Reset Password</button>
      </div>
    `, { draftKey: `resetpw:${userId}` });
    document.getElementById("rp-close").addEventListener("click", Modal.close);
    document.getElementById("rp-cancel").addEventListener("click", Modal.close);
    document.getElementById("rp-save").addEventListener("click", () => {
      const password = document.getElementById("rp-password").value.trim();
      if (!password) {
        document.getElementById("row-password").classList.add("error");
        document.querySelector("#row-password .err-msg").textContent = "Password cannot be empty.";
        return;
      }
      Data.updateUser(userId, { password });
      Activity.log("Reset password", user.fullName);
      Toast.show("Password reset.", "success");
      Draft.clear(`resetpw:${userId}`);
      Modal.close();
      Router.rerender();
    });
  }
  return { open };
})();

/* ============================== CHANGE USERNAME (admin only, shared modal) ============================== */
const ChangeUsernameForm = (() => {
  function open(userId) {
    const user = Data.getUserById(userId);
    if (!user) return;
    Modal.open(`
      <div class="modal-head">
        <h3>Change Username</h3>
        <button class="icon-btn" id="cu-close">✕</button>
      </div>
      <div class="modal-body">
        <p style="color:var(--ink-soft); font-size:13.5px; margin-bottom:14px;">Update the login username for <strong>${Utils.escapeHtml(user.fullName)}</strong>.</p>
        <div class="form-row" id="row-username">
          <label>Username</label>
          <input type="text" id="cu-username" value="${Utils.escapeHtml(user.username)}" />
          <div class="err-msg" data-err="username"></div>
        </div>
      </div>
      <div class="modal-foot">
        <button class="btn btn-secondary" id="cu-cancel">Cancel</button>
        <button class="btn btn-primary" id="cu-save">Save</button>
      </div>
    `, { draftKey: `chuser:${userId}` });
    document.getElementById("cu-close").addEventListener("click", Modal.close);
    document.getElementById("cu-cancel").addEventListener("click", Modal.close);
    document.getElementById("cu-save").addEventListener("click", () => {
      const username = document.getElementById("cu-username").value.trim();
      document.getElementById("row-username").classList.remove("error");
      document.querySelector("#row-username .err-msg").textContent = "";
      if (!username) {
        document.getElementById("row-username").classList.add("error");
        document.querySelector("#row-username .err-msg").textContent = "Enter a username.";
        return;
      }
      const dupe = Store.getUsers().find((u) => u.username.toLowerCase() === username.toLowerCase() && u.id !== userId);
      if (dupe) {
        document.getElementById("row-username").classList.add("error");
        document.querySelector("#row-username .err-msg").textContent = "That username is already taken.";
        return;
      }
      Data.updateUser(userId, { username });
      Activity.log("Changed username", `${user.username} → ${username}`);
      Toast.show("Username updated.", "success");
      Draft.clear(`chuser:${userId}`);
      Modal.close();
      Router.rerender();
    });
  }
  return { open };
})();

/* ============================== USER DETAIL MODAL (Admin: Notes & Tasks) ============================== */
/* ============================== USER DETAIL MODAL (Admin & Self: Notes & Tasks) ============================== */
const UserDetailModal = (() => {
  function open(userId) {
    const user = Data.getUserById(userId);
    if (!user) {
      Toast.show("User not found.", "error");
      return;
    }

    const me = Auth.currentUser();
    const isSelf = !!(me && me.id === user.id);
    const isAdmin = Auth.isAdmin();
    if (!isAdmin && !isSelf) {
      Toast.show("You can only view your own user profile.", "error");
      return;
    }

    const pwdDisplay = (isAdmin || isSelf) ? Utils.escapeHtml(user.password) : "••••••••";

    const allTasks = Data.getTasks();
    const userTasks = allTasks.filter((t) => t.assignedTo === user.fullName || t.assignedTo === "All");
    const pendingTasks = userTasks.filter((t) => t.status !== "Completed");
    const completedTasks = userTasks.filter((t) => t.status === "Completed");
    const canAddTask = isAdmin || isSelf;

    const initials = user.fullName.split(" ").map((n) => n[0]).slice(0, 2).join("").toUpperCase() || "U";

    Modal.open(`
      <div class="modal-head">
        <div style="display:flex; align-items:center; gap:12px;">
          <div class="user-avatar-badge">${Utils.escapeHtml(initials)}</div>
          <div>
            <h3 style="margin:0; font-size:16px;">${Utils.escapeHtml(user.fullName)}</h3>
            <div style="display:flex; align-items:center; gap:8px; margin-top:3px; font-size:12px; color:var(--ink-soft); flex-wrap:wrap;">
              <span class="mono">@${Utils.escapeHtml(user.username)}</span>
              <span>·</span>
              <span class="badge ${user.role === "admin" ? "badge-medium" : "badge-easy"}"><span class="badge-dot"></span>${user.role === "admin" ? "Administrator" : "User"}</span>
              <span class="badge ${user.status === "active" ? "badge-easy" : "badge-hard"}"><span class="badge-dot"></span>${user.status === "active" ? "Active" : "Inactive"}</span>
            </div>
          </div>
        </div>
        <button class="icon-btn" id="ud-close">✕</button>
      </div>

      <div class="modal-body" style="display:flex; flex-direction:column; gap:18px;">
        <!-- User Metadata Strip -->
        <div style="display:flex; gap:14px 20px; background:var(--surface-2); border:1px solid var(--line); border-radius:var(--radius-md); padding:10px 14px; font-size:12px; color:var(--ink-soft); flex-wrap:wrap;">
          <div><strong style="color:var(--ink);">Role:</strong> ${user.role === "admin" ? "Administrator" : "User"}</div>
          <div><strong style="color:var(--ink);">Last Login:</strong> ${user.lastLogin ? Utils.formatDate(user.lastLogin) : "Never"}</div>
          <div><strong style="color:var(--ink);">Password:</strong> <span class="mono" style="background:var(--paper); padding:1px 6px; border-radius:4px; border:1px solid var(--line);">${pwdDisplay}</span></div>
          <div><strong style="color:var(--ink);">Assigned Tasks:</strong> <span style="font-weight:700; color:${pendingTasks.length > 0 ? "var(--accent)" : "var(--good)"};">${pendingTasks.length} open</span> (${completedTasks.length} done)</div>
        </div>

        <!-- Section 1: Notes -->
        <div style="background:var(--surface); border:1px solid var(--line); border-radius:var(--radius-lg); padding:16px;">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
            <div style="font-weight:700; font-size:14px; display:flex; align-items:center; gap:6px;">
              <span>📝</span> User Notes & Directives
            </div>
            <span style="font-size:11.5px; color:var(--ink-faint);">Team member notes & instructions</span>
          </div>
          <div class="form-row" style="margin-bottom:10px;">
            <textarea id="ud-notes-input" placeholder="Write private notes, guidance, topics to cover, or reminders for ${Utils.escapeHtml(user.fullName)}…" style="min-height:95px;">${Utils.escapeHtml(user.notes || "")}</textarea>
          </div>
          <div style="display:flex; justify-content:space-between; align-items:center;">
            <span id="ud-notes-status" style="font-size:12px; color:var(--good); font-weight:600;"></span>
            <button class="btn btn-primary btn-sm" id="ud-save-notes">💾 Save Notes</button>
          </div>
        </div>

        <!-- Section 2: Tasks -->
        <div style="background:var(--surface); border:1px solid var(--line); border-radius:var(--radius-lg); padding:16px;">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px; flex-wrap:wrap; gap:8px;">
            <div style="font-weight:700; font-size:14px; display:flex; align-items:center; gap:6px;">
              <span>☑</span> Assigned Tasks <span class="count-pill">${userTasks.length}</span>
            </div>
            ${canAddTask ? `<button class="btn btn-secondary btn-sm" id="ud-add-task">+ Add Task for ${Utils.escapeHtml(user.fullName)}</button>` : ""}
          </div>

          ${userTasks.length === 0 ? `
            <div style="text-align:center; padding:22px 14px; color:var(--ink-soft); font-size:13px; border:1px dashed var(--line-strong); border-radius:8px;">
              No tasks assigned to ${Utils.escapeHtml(user.fullName)} yet.
              ${canAddTask ? `
              <div style="margin-top:10px;">
                <button class="btn btn-primary btn-sm" id="ud-add-first-task">+ Create First Task</button>
              </div>
              ` : ""}
            </div>
          ` : `
            <div style="display:flex; flex-direction:column; gap:8px;">
              ${userTasks.map((t) => {
                const isDone = t.status === "Completed";
                const isAll = t.assignedTo === "All";
                const canModifyTask = isAdmin || (me && (t.assignedTo === me.fullName || t.createdBy === me.fullName));
                const canToggleTask = isAdmin || (me && (t.assignedTo === me.fullName || t.assignedTo === "All" || t.createdBy === me.fullName));

                return `
                  <div style="display:flex; align-items:flex-start; justify-content:space-between; gap:10px; padding:10px 12px; background:var(--surface-2); border:1px solid var(--line); border-radius:8px; ${isDone ? "opacity:0.7;" : ""}">
                    <div style="display:flex; align-items:flex-start; gap:10px; min-width:0; flex:1;">
                      <button class="task-check-btn ${isDone ? "checked" : ""}" data-ud-action="toggle" data-id="${t.id}" title="${isDone ? "Mark as Pending" : "Mark as Completed"}" style="margin-top:2px; ${!canToggleTask ? "cursor:not-allowed; opacity:0.5;" : ""}" ${!canToggleTask ? "disabled" : ""}>
                        ${isDone ? "✓" : ""}
                      </button>
                      <div style="min-width:0; flex:1;">
                        <div style="font-weight:600; font-size:13.5px; ${isDone ? "text-decoration:line-through;" : ""} word-break:break-word;">
                          ${Utils.escapeHtml(t.title)}
                        </div>
                        <div style="display:flex; align-items:center; gap:6px; flex-wrap:wrap; margin-top:3px; font-size:11px;">
                          ${isAll ? `<span class="badge" style="background:var(--accent-soft); color:var(--accent); font-weight:700; font-size:10px;">👥 Assigned to All</span>` : ""}
                          <span class="badge ${t.priority === "High" ? "badge-hard" : t.priority === "Medium" ? "badge-medium" : "badge-easy"}" style="font-size:10px;"><span class="badge-dot"></span>${t.priority}</span>
                          ${t.dueDate ? `<span class="mono" style="color:var(--ink-soft); font-size:11px;">Due: ${Utils.formatDate(t.dueDate)}</span>` : ""}
                        </div>
                        ${t.description ? `<div style="font-size:12px; color:var(--ink-soft); margin-top:3px; line-height:1.4;">${Utils.escapeHtml(t.description)}</div>` : ""}
                      </div>
                    </div>
                    ${canModifyTask ? `
                    <div style="display:flex; gap:4px; flex-shrink:0;">
                      <button class="icon-btn" data-ud-action="edit" data-id="${t.id}" title="Edit Task" style="width:28px; height:28px; font-size:12px;">✎</button>
                      <button class="icon-btn" data-ud-action="delete" data-id="${t.id}" title="Delete Task" style="width:28px; height:28px; font-size:12px;">🗑</button>
                    </div>
                    ` : ""}
                  </div>
                `;
              }).join("")}
            </div>
          `}
        </div>
      </div>

      <div class="modal-foot">
        <button class="btn btn-secondary" id="ud-done">Close</button>
      </div>
    `, { wide: true });

    const handleClose = () => {
      Modal.close();
      Router.rerender();
    };

    document.getElementById("ud-close").addEventListener("click", handleClose);
    document.getElementById("ud-done").addEventListener("click", handleClose);

    // Save notes handler
    const saveNotesBtn = document.getElementById("ud-save-notes");
    if (saveNotesBtn) {
      saveNotesBtn.addEventListener("click", () => {
        const notes = document.getElementById("ud-notes-input").value;
        Data.updateUser(userId, { notes });
        Activity.log("Updated notes for user", user.fullName);
        const statusEl = document.getElementById("ud-notes-status");
        if (statusEl) {
          statusEl.textContent = "✓ Notes saved!";
          setTimeout(() => { if (statusEl) statusEl.textContent = ""; }, 2500);
        }
        Toast.show("Notes saved for " + user.fullName + ".", "success");
      });
    }

    // Add task handlers
    const openNewTask = () => {
      TaskForm.open({
        presetAssignee: user.fullName,
        onComplete: () => {
          UserDetailModal.open(userId);
          Router.rerender();
        },
      });
    };
    const addTaskBtn = document.getElementById("ud-add-task");
    if (addTaskBtn) addTaskBtn.addEventListener("click", openNewTask);
    const addFirstTaskBtn = document.getElementById("ud-add-first-task");
    if (addFirstTaskBtn) addFirstTaskBtn.addEventListener("click", openNewTask);

    // Task actions within modal (toggle, edit, delete)
    const overlay = document.getElementById("modal-overlay");
    if (overlay) {
      overlay.addEventListener("click", (e) => {
        const btn = e.target.closest("[data-ud-action]");
        if (!btn) return;
        e.stopPropagation();
        const act = btn.dataset.udAction;
        const taskId = btn.dataset.id;
        const task = Data.getTaskById(taskId);
        if (!task) return;

        const canModifyTask = isAdmin || (me && (task.assignedTo === me.fullName || task.createdBy === me.fullName));
        const canToggleTask = isAdmin || (me && (task.assignedTo === me.fullName || task.assignedTo === "All" || task.createdBy === me.fullName));

        if (act === "toggle") {
          if (!canToggleTask) {
            Toast.show("You cannot change the status of another member's task.", "error");
            return;
          }
          Data.toggleTaskStatus(taskId);
          UserDetailModal.open(userId);
          Router.rerender();
        } else if (act === "edit") {
          if (!canModifyTask) {
            Toast.show("You can only edit your own tasks.", "error");
            return;
          }
          TaskForm.open({
            task,
            onComplete: () => {
              UserDetailModal.open(userId);
              Router.rerender();
            },
          });
        } else if (act === "delete") {
          if (!canModifyTask) {
            Toast.show("You can only delete your own tasks.", "error");
            return;
          }
          Modal.confirmDialog({
            title: `Delete task?`,
            message: `Permanently delete "${task.title}"?`,
            confirmLabel: "Delete Task",
            onConfirm: () => {
              Data.deleteTask(taskId);
              Activity.log("Deleted task", task.title);
              Toast.show("Task deleted.", "success");
              UserDetailModal.open(userId);
              Router.rerender();
            },
          });
        }
      });
    }
  }

  return { open };
})();

/* ============================== TASK FORM ============================== */
const TaskForm = (() => {
  function open({ task = null, presetAssignee = null, onComplete = null } = {}) {
    const me = Auth.currentUser();
    const isAdmin = Auth.isAdmin();
    const isEdit = !!task;

    if (isEdit && !isAdmin) {
      if (!me || (task.assignedTo !== me.fullName && task.createdBy !== me.fullName)) {
        Toast.show("You can only edit your own tasks.", "error");
        return;
      }
    }

    const draftKey = isEdit ? `task:${task.id}` : "task:new";
    const defaultAssignee = isAdmin
      ? (presetAssignee || "")
      : (me ? me.fullName : "");

    const t = task || {
      title: "",
      description: "",
      assignedTo: defaultAssignee,
      priority: "Medium",
      status: "Pending",
      dueDate: "",
    };
    const users = Data.getUsers();

    const assigneeFieldHtml = isAdmin
      ? `
        <select id="tf-assignedTo">
          <option value="" ${!t.assignedTo ? "selected" : ""}>Admin Only (General)</option>
          <option value="All" ${t.assignedTo === "All" ? "selected" : ""}>👥 All Users (Assigned to Everyone)</option>
          ${users.map((u) => `<option value="${Utils.escapeHtml(u.fullName)}" ${u.fullName === t.assignedTo ? "selected" : ""}>👤 ${Utils.escapeHtml(u.fullName)} (${u.role === "admin" ? "Admin" : "User"})</option>`).join("")}
        </select>
      `
      : `
        <input type="text" id="tf-assignedTo" value="${Utils.escapeHtml(me ? me.fullName : "")}" readonly style="background:var(--surface-2); cursor:not-allowed;" />
        <div style="font-size:11px; color:var(--ink-faint); margin-top:3px;">🔒 Assigned to yourself (${Utils.escapeHtml(me ? me.fullName : "")}). Non-admins cannot assign tasks to other members.</div>
      `;

    Modal.open(`
      <div class="modal-head">
        <h3>${isEdit ? "Edit Task" : "New Task"}</h3>
        <button class="icon-btn" id="tf-close">✕</button>
      </div>
      <div class="modal-body">
        <form id="task-form">
          <div class="form-row" id="row-title">
            <label>Task Title</label>
            <input type="text" id="tf-title" value="${Utils.escapeHtml(t.title)}" placeholder="e.g. Enter questions for Actual May INT B" />
            <div class="err-msg" data-err="title"></div>
          </div>

          <div class="form-row">
            <label>Description <span style="font-weight:400; color:var(--ink-faint);">(optional)</span></label>
            <textarea id="tf-description" placeholder="Instructions, question ranges, notes for the task…">${Utils.escapeHtml(t.description)}</textarea>
          </div>

          <div class="form-grid-2">
            <div class="form-row" id="row-assignedTo">
              <label>Assign To</label>
              ${assigneeFieldHtml}
            </div>

            <div class="form-row" id="row-priority">
              <label>Priority</label>
              <select id="tf-priority">
                <option value="High" ${t.priority === "High" ? "selected" : ""}>High Priority</option>
                <option value="Medium" ${t.priority === "Medium" ? "selected" : ""}>Medium Priority</option>
                <option value="Low" ${t.priority === "Low" ? "selected" : ""}>Low Priority</option>
              </select>
            </div>
          </div>

          <div class="form-grid-2">
            <div class="form-row" id="row-dueDate">
              <label>Due Date <span style="font-weight:400; color:var(--ink-faint);">(optional)</span></label>
              <input type="date" id="tf-dueDate" value="${Utils.escapeHtml(t.dueDate)}" />
            </div>

            <div class="form-row" id="row-status">
              <label>Status</label>
              <select id="tf-status">
                <option value="Pending" ${t.status === "Pending" ? "selected" : ""}>Pending</option>
                <option value="In Progress" ${t.status === "In Progress" ? "selected" : ""}>In Progress</option>
                <option value="Completed" ${t.status === "Completed" ? "selected" : ""}>Completed</option>
              </select>
            </div>
          </div>
        </form>
      </div>
      <div class="modal-foot">
        <button class="btn btn-secondary" id="tf-cancel">Cancel</button>
        <button class="btn btn-primary" id="tf-save">${isEdit ? "Save Changes" : "Create Task"}</button>
      </div>
    `, { draftKey });

    const handleClose = () => {
      Modal.close();
      if (onComplete) onComplete();
    };

    document.getElementById("tf-close").addEventListener("click", handleClose);
    document.getElementById("tf-cancel").addEventListener("click", handleClose);
    document.getElementById("tf-save").addEventListener("click", () => {
      const assignedVal = isAdmin
        ? document.getElementById("tf-assignedTo").value
        : (me ? me.fullName : "");

      const payload = {
        title: document.getElementById("tf-title").value,
        description: document.getElementById("tf-description").value,
        assignedTo: assignedVal,
        priority: document.getElementById("tf-priority").value,
        dueDate: document.getElementById("tf-dueDate").value,
        status: document.getElementById("tf-status").value,
      };
      document.querySelectorAll(".err-msg").forEach((e) => (e.textContent = ""));
      document.querySelectorAll(".form-row").forEach((e) => e.classList.remove("error"));

      const { ok, errors } = Data.validateTask(payload);
      if (!ok) {
        Object.entries(errors).forEach(([field, msg]) => {
          const row = document.getElementById(`row-${field}`);
          if (row) {
            row.classList.add("error");
            row.querySelector(".err-msg").textContent = msg;
          }
        });
        return;
      }

      if (isEdit) {
        Data.updateTask(task.id, payload);
        Activity.log("Updated task", payload.title);
        Toast.show("Task updated.", "success");
      } else {
        Data.createTask(payload);
        Activity.log("Created task", payload.title);
        Toast.show("Task created.", "success");
      }
      Draft.clear(draftKey);
      if (onComplete) {
        onComplete();
      } else {
        Modal.close();
        Router.rerender();
      }
    });
  }
  return { open };
})();

/* ============================== FIREBASE MODAL (Cloud Sync Settings) ============================== */
const FirebaseModal = (() => {
  function open() {
    const cfg = FirebaseSync.getConfig() || {
      apiKey: "",
      authDomain: "",
      projectId: "",
      storageBucket: "",
      messagingSenderId: "",
      appId: "",
    };
    const status = FirebaseSync.getStatus();
    const errorMsg = FirebaseSync.getError();
    const isConnected = status === "connected";

    Modal.open(`
      <div class="modal-head">
        <div style="display:flex; align-items:center; gap:10px;">
          <span style="font-size:22px;">☁️</span>
          <div>
            <h3 style="margin:0;">Firebase Cloud Database</h3>
            <p style="font-size:12px; color:var(--ink-soft); margin:2px 0 0;">Real-time multi-device cloud synchronization</p>
          </div>
        </div>
        <button class="icon-btn" id="fb-close">✕</button>
      </div>

      <div class="modal-body" style="max-height:76vh; overflow-y:auto;">
        <!-- Status Card -->
        <div class="firebase-status-box">
          <div style="display:flex; align-items:center; gap:10px;">
            <span class="sync-dot ${status === "connected" ? "connected" : status === "syncing" ? "syncing" : status === "error" ? "error" : ""}" style="width:12px; height:12px;"></span>
            <div>
              <div style="font-weight:700; font-size:13.5px;">
                ${status === "connected" ? "Connected to Cloud Database" : status === "syncing" ? "Connecting / Syncing…" : status === "error" ? "Connection Error" : "Not Connected (Running in Local Mode)"}
              </div>
              <div style="font-size:11.5px; color:var(--ink-faint); margin-top:2px;">
                ${status === "connected" ? `Project: <strong>${Utils.escapeHtml(cfg.projectId || "—")}</strong> · Real-time Sync Active` : status === "error" ? Utils.escapeHtml(errorMsg || "Check credentials") : "Data is currently saved only in this browser's local memory."}
              </div>
            </div>
          </div>
          ${isConnected ? `<span class="badge badge-easy">Live Active</span>` : `<span class="badge badge-hard">Offline / Local</span>`}
        </div>

        <!-- Quick Setup Instructions -->
        <details class="firebase-step-box" ${!isConnected ? "open" : ""}>
          <summary style="cursor:pointer; font-weight:700; color:var(--ink);">📖 How to get your Firebase configuration (3 steps)</summary>
          <ol style="margin-top:8px;">
            <li>Go to <a href="https://console.firebase.google.com/" target="_blank" style="color:var(--accent); font-weight:600;">console.firebase.google.com</a> and create/select a project.</li>
            <li>In <strong>Build → Firestore Database</strong>, click <em>Create Database</em> and choose <strong>Start in test mode</strong>.</li>
            <li>In Project Settings (⚙) → General, scroll down and register a <strong>Web App (&lt;/&gt;)</strong>, then copy the <code>firebaseConfig</code> object.</li>
          </ol>
        </details>

        <!-- Quick Paste Raw JSON -->
        <div class="form-row">
          <label style="display:flex; justify-content:space-between;">
            <span>Paste Firebase Config (JSON or JS object)</span>
            <span style="font-weight:400; font-size:11px; color:var(--accent); cursor:pointer;" id="fb-sample-btn">Fill Sample Format</span>
          </label>
          <textarea id="fb-raw-config" placeholder='Paste your firebaseConfig from Firebase Console here, e.g.:&#10;{&#10;  "apiKey": "AIzaSy...",&#10;  "projectId": "my-malzama-proj",&#10;  ...&#10;}' style="min-height:90px; font-family:var(--font-mono); font-size:12px;"></textarea>
        </div>

        <div style="display:flex; align-items:center; gap:10px; margin:14px 0 16px;">
          <div style="flex:1; height:1px; background:var(--line);"></div>
          <span style="font-size:11px; color:var(--ink-faint); text-transform:uppercase; font-family:var(--font-mono);">or individual fields</span>
          <div style="flex:1; height:1px; background:var(--line);"></div>
        </div>

        <div class="form-grid-2">
          <div class="form-row">
            <label>API Key (apiKey)</label>
            <input type="text" id="fb-apiKey" value="${Utils.escapeHtml(cfg.apiKey || "")}" placeholder="AIzaSy..." />
          </div>
          <div class="form-row">
            <label>Project ID (projectId)</label>
            <input type="text" id="fb-projectId" value="${Utils.escapeHtml(cfg.projectId || "")}" placeholder="e.g. malzama-app" />
          </div>
        </div>

        <div class="form-grid-2">
          <div class="form-row">
            <label>Auth Domain <span style="font-weight:400; color:var(--ink-faint);">(optional)</span></label>
            <input type="text" id="fb-authDomain" value="${Utils.escapeHtml(cfg.authDomain || "")}" placeholder="project.firebaseapp.com" />
          </div>
          <div class="form-row">
            <label>Storage Bucket <span style="font-weight:400; color:var(--ink-faint);">(optional)</span></label>
            <input type="text" id="fb-storageBucket" value="${Utils.escapeHtml(cfg.storageBucket || "")}" placeholder="project.appspot.com" />
          </div>
        </div>

        <div class="form-row">
          <label>App ID (appId) <span style="font-weight:400; color:var(--ink-faint);">(optional)</span></label>
          <input type="text" id="fb-appId" value="${Utils.escapeHtml(cfg.appId || "")}" placeholder="1:123456789:web:abcdef..." />
        </div>

        <!-- Cloud Actions -->
        <div style="background:var(--surface-2); border:1px solid var(--line); border-radius:var(--radius-md); padding:14px; margin-top:10px;">
          <div style="font-weight:700; font-size:13px; margin-bottom:8px;">Data Synchronization</div>
          <div style="display:flex; gap:8px; flex-wrap:wrap;">
            <button class="btn btn-primary btn-sm" id="fb-push-btn" ${!isConnected ? "disabled" : ""}>☁ Push All Local Data to Cloud</button>
            <button class="btn btn-secondary btn-sm" id="fb-pull-btn" ${!isConnected ? "disabled" : ""}>⬇ Pull Cloud Data to Browser</button>
            ${isConnected ? `<button class="btn btn-danger btn-sm" id="fb-disconnect-btn">Disconnect</button>` : ""}
          </div>
          <p style="font-size:11px; color:var(--ink-faint); margin:8px 0 0;">
            ${isConnected ? "When online, any changes you make in quizzes, questions, tasks, or users automatically sync to Firebase in real-time." : "Connect to Firebase above to enable real-time cloud sync."}
          </p>
        </div>
      </div>

      <div class="modal-foot">
        <button class="btn btn-secondary" id="fb-cancel">Close</button>
        <button class="btn btn-primary" id="fb-save">Save & Connect</button>
      </div>
    `, { wide: true });

    document.getElementById("fb-close").addEventListener("click", Modal.close);
    document.getElementById("fb-cancel").addEventListener("click", Modal.close);

    const rawArea = document.getElementById("fb-raw-config");
    rawArea.addEventListener("input", () => {
      const val = rawArea.value.trim();
      if (!val) return;
      try {
        let parsed = null;
        if (val.startsWith("{") && val.endsWith("}")) {
          parsed = JSON.parse(val);
        } else {
          const clean = val.replace(/const\s+firebaseConfig\s*=\s*/, "").replace(/;$/, "");
          parsed = Function("return (" + clean + ");")();
        }
        if (parsed && typeof parsed === "object") {
          if (parsed.apiKey) document.getElementById("fb-apiKey").value = parsed.apiKey;
          if (parsed.projectId) document.getElementById("fb-projectId").value = parsed.projectId;
          if (parsed.authDomain) document.getElementById("fb-authDomain").value = parsed.authDomain || "";
          if (parsed.storageBucket) document.getElementById("fb-storageBucket").value = parsed.storageBucket || "";
          if (parsed.appId) document.getElementById("fb-appId").value = parsed.appId || "";
          Toast.show("Parsed Firebase config successfully!", "success");
        }
      } catch (e) {}
    });

    const sampleBtn = document.getElementById("fb-sample-btn");
    if (sampleBtn) {
      sampleBtn.addEventListener("click", () => {
        rawArea.value = JSON.stringify({
          apiKey: "AIzaSyDummyKeyReplaceWithYours",
          authDomain: "my-malzama.firebaseapp.com",
          projectId: "my-malzama",
          storageBucket: "my-malzama.appspot.com",
          messagingSenderId: "1234567890",
          appId: "1:1234567890:web:abcdef123456"
        }, null, 2);
        rawArea.dispatchEvent(new Event("input"));
      });
    }

    document.getElementById("fb-save").addEventListener("click", async () => {
      const apiKey = document.getElementById("fb-apiKey").value.trim();
      const projectId = document.getElementById("fb-projectId").value.trim();
      const authDomain = document.getElementById("fb-authDomain").value.trim();
      const storageBucket = document.getElementById("fb-storageBucket").value.trim();
      const appId = document.getElementById("fb-appId").value.trim();

      if (!apiKey || !projectId) {
        Toast.show("Please enter at least API Key and Project ID.", "error");
        return;
      }

      const newConfig = {
        apiKey,
        projectId,
        authDomain,
        storageBucket,
        messagingSenderId: "",
        appId,
      };

      FirebaseSync.setConfig(newConfig);
      Toast.show("Connecting to Firebase…", "info");
      await FirebaseSync.init();

      if (FirebaseSync.getStatus() === "connected") {
        Toast.show("Successfully connected to Firebase!", "success");
        Activity.log("Connected to Firebase", projectId);
      } else {
        Toast.show("Connection failed: " + FirebaseSync.getError(), "error");
      }
      Modal.close();
      Router.rerender();
    });

    const pushBtn = document.getElementById("fb-push-btn");
    if (pushBtn) {
      pushBtn.addEventListener("click", async () => {
        try {
          Toast.show("Uploading local data to Firebase…", "info");
          const counts = await FirebaseSync.pushAll();
          Toast.show(`Uploaded ${counts.quizzes} quizzes, ${counts.questions} questions, and ${counts.tasks} tasks to Firebase!`, "success");
          Activity.log("Uploaded all local data to Firebase");
        } catch (err) {
          Toast.show("Upload failed: " + err.message, "error");
        }
      });
    }

    const pullBtn = document.getElementById("fb-pull-btn");
    if (pullBtn) {
      pullBtn.addEventListener("click", async () => {
        try {
          Toast.show("Fetching latest data from Firebase…", "info");
          await FirebaseSync.pullAll();
          Toast.show("Synced successfully with Firebase!", "success");
          Activity.log("Pulled cloud data from Firebase");
          Modal.close();
        } catch (err) {
          Toast.show("Download failed: " + err.message, "error");
        }
      });
    }

    const discBtn = document.getElementById("fb-disconnect-btn");
    if (discBtn) {
      discBtn.addEventListener("click", () => {
        FirebaseSync.disconnect();
        Toast.show("Disconnected from Firebase. Now using local storage.", "info");
        Activity.log("Disconnected from Firebase");
        Modal.close();
        Router.rerender();
      });
    }
  }

  return { open };
})();

/* ============================== SHARED UI BITS ============================== */
function diffBadge(level) {
  const cls = level === "Easy" ? "badge-easy" : level === "Medium" ? "badge-medium" : "badge-hard";
  return `<span class="badge ${cls}"><span class="badge-dot"></span>${level}</span>`;
}
function progressFillClass(pct) {
  if (pct >= 75) return "";
  if (pct >= 40) return "mid";
  return "low";
}
function tallyMarkup(count) {
  if (count === 0) return `<span style="color:var(--ink-faint); font-family:var(--font-mono); font-size:11px;">none yet</span>`;
  const groups = Math.floor(count / 5);
  const rem = count % 5;
  let html = "";
  for (let i = 0; i < groups; i++) {
    html += `<span class="tally-group">${'<span class="tally-stroke"></span>'.repeat(4)}<span class="tally-stroke hard-slash"></span></span>`;
  }
  if (rem > 0) html += `<span class="tally-group">${'<span class="tally-stroke"></span>'.repeat(rem)}</span>`;
  return html;
}

/* ============================== TASK NOTIFIER (User Task Notifications) ============================== */
const TaskNotifier = (() => {
  let prevTaskIds = null;
  let hasShownLoginSummary = false;

  function getMyTasks() {
    const me = Auth.currentUser();
    if (!me) return [];
    return Data.getTasks().filter((t) => t.assignedTo === me.fullName || t.assignedTo === "All");
  }

  function getMyOpenTasks() {
    return getMyTasks().filter((t) => t.status !== "Completed");
  }

  function updateBadge() {
    if (typeof document === "undefined") return;
    const me = Auth.currentUser();
    const bellBadge = document.getElementById("notif-badge");
    const sidebarBadge = document.getElementById("sidebar-task-count");
    if (!me) {
      if (bellBadge) bellBadge.style.display = "none";
      if (sidebarBadge) sidebarBadge.style.display = "none";
      return;
    }

    const openTasks = getMyOpenTasks();
    const count = openTasks.length;

    // Topbar bell badge
    if (bellBadge) {
      if (count > 0) {
        bellBadge.textContent = count > 99 ? "99+" : String(count);
        bellBadge.style.display = "inline-flex";
        bellBadge.title = `${count} task${count === 1 ? "" : "s"} waiting for you`;
      } else {
        bellBadge.style.display = "none";
      }
    }

    // Sidebar Tasks badge
    if (sidebarBadge) {
      if (count > 0) {
        sidebarBadge.textContent = String(count);
        sidebarBadge.style.display = "inline-flex";
        sidebarBadge.title = `${count} open task${count === 1 ? "" : "s"}`;
      } else {
        sidebarBadge.style.display = "none";
      }
    }
  }

  function requestBrowserPermission() {
    if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "default") {
      Notification.requestPermission().then((perm) => {
        if (perm === "granted") {
          Toast.show("✓ Task notifications enabled for your browser!", "success");
        }
      });
    }
  }

  function sendBrowserNotification(title, body) {
    if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "granted") {
      try {
        new Notification(title, {
          body,
          icon: "favicon.ico",
        });
      } catch (e) {}
    }
  }

  function checkForNewTasks() {
    const me = Auth.currentUser();
    if (!me) return;

    const myOpen = getMyOpenTasks();
    const currentIds = new Set(myOpen.map((t) => t.id));

    if (prevTaskIds === null) {
      // First check for this login session
      prevTaskIds = currentIds;
      if (!hasShownLoginSummary && myOpen.length > 0) {
        hasShownLoginSummary = true;
        const highPriority = myOpen.filter((t) => t.priority === "High").length;
        const overdue = myOpen.filter((t) => t.dueDate && new Date(t.dueDate).setHours(23, 59, 59, 999) < Date.now()).length;
        let summary = `You have ${myOpen.length} open task${myOpen.length === 1 ? "" : "s"}`;
        if (highPriority > 0) summary += ` (${highPriority} High Priority)`;
        if (overdue > 0) summary += ` · ⚠️ ${overdue} Overdue`;

        Toast.show(`🔔 ${summary}. Click to view.`, "info", 6500, {
          onClick: () => {
            TasksViewState.assigneeFilter = me.fullName;
            location.hash = "#/tasks";
            if (Router.current().name === "tasks") Router.rerender();
          }
        });
      }
      updateBadge();
      return;
    }

    // Check if any new tasks were assigned to this user
    myOpen.forEach((t) => {
      if (!prevTaskIds.has(t.id)) {
        const fromWho = t.createdBy ? ` from ${t.createdBy}` : "";
        const alertMsg = `🔔 New Task: "${t.title}"${fromWho} (${t.priority} Priority)`;
        Toast.show(alertMsg, "success", 7000, {
          onClick: () => {
            TasksViewState.assigneeFilter = me.fullName;
            location.hash = "#/tasks";
            if (Router.current().name === "tasks") Router.rerender();
          }
        });
        sendBrowserNotification("New Task Assigned - Malzama", `${t.title} (${t.priority} Priority)`);
      }
    });

    prevTaskIds = currentIds;
    updateBadge();
  }

  function resetSession() {
    prevTaskIds = null;
    hasShownLoginSummary = false;
    updateBadge();
  }

  function toggleDropdown() {
    const dd = document.getElementById("notif-dropdown");
    if (!dd) return;
    const isShowing = dd.style.display === "block";
    if (isShowing) {
      dd.style.display = "none";
    } else {
      renderDropdown();
      dd.style.display = "block";
    }
  }

  function closeDropdown() {
    const dd = document.getElementById("notif-dropdown");
    if (dd) dd.style.display = "none";
  }

  function renderDropdown() {
    const dd = document.getElementById("notif-dropdown");
    if (!dd) return;
    const me = Auth.currentUser();
    if (!me) {
      dd.innerHTML = `<div style="padding:16px; text-align:center; color:var(--ink-faint);">Please log in.</div>`;
      return;
    }

    const openTasks = getMyOpenTasks();

    dd.innerHTML = `
      <div class="notif-dropdown-head">
        <div>
          <div style="font-weight:700; font-size:13.5px; color:var(--ink);">My Tasks & Notifications</div>
          <div style="font-size:11px; color:var(--ink-faint); margin-top:1px;">
            ${openTasks.length} pending · assigned to ${Utils.escapeHtml(me.fullName)}
          </div>
        </div>
        <button class="btn btn-secondary btn-sm" id="notif-goto-tasks" style="padding:3px 8px; font-size:11px;">
          View All →
        </button>
      </div>

      <div class="notif-dropdown-body">
        ${openTasks.length === 0 ? `
          <div class="notif-empty">
            <div style="font-size:24px; margin-bottom:4px;">🎉</div>
            <div style="font-weight:600; color:var(--ink);">All caught up!</div>
            <div style="font-size:12px; color:var(--ink-soft); margin-top:2px;">You have no pending tasks right now.</div>
          </div>
        ` : `
          <div class="notif-list">
            ${openTasks.map((t) => {
              const isOverdue = t.dueDate && new Date(t.dueDate).setHours(23, 59, 59, 999) < Date.now();
              const pCls = t.priority === "High" ? "badge-hard" : t.priority === "Medium" ? "badge-medium" : "badge-easy";
              return `
                <div class="notif-item ${t.priority === "High" ? "urgent" : ""}">
                  <button class="task-check-btn" data-notif-action="done" data-id="${t.id}" title="Mark completed" style="margin-top:2px; flex-shrink:0;">
                  </button>
                  <div style="min-width:0; flex:1;">
                    <div class="notif-item-title" data-notif-action="view" data-id="${t.id}" title="Click to view task details">
                      ${Utils.escapeHtml(t.title)}
                    </div>
                    <div style="display:flex; align-items:center; gap:6px; flex-wrap:wrap; margin-top:3px;">
                      <span class="badge ${pCls}" style="font-size:9.5px; padding:1px 5px;"><span class="badge-dot"></span>${t.priority}</span>
                      ${t.assignedTo === "All" ? `<span class="badge" style="background:var(--accent-soft); color:var(--accent); font-size:9.5px; padding:1px 5px;">👥 Everyone</span>` : ""}
                      ${t.dueDate ? `<span class="mono" style="font-size:10.5px; ${isOverdue ? "color:var(--accent); font-weight:700;" : "color:var(--ink-soft);"}">📅 ${Utils.formatDate(t.dueDate)}${isOverdue ? " (Overdue!)" : ""}</span>` : ""}
                    </div>
                    ${t.description ? `<div style="font-size:11.5px; color:var(--ink-soft); margin-top:3px; line-height:1.35; max-height:36px; overflow:hidden; text-overflow:ellipsis;">${Utils.escapeHtml(t.description)}</div>` : ""}
                  </div>
                </div>
              `;
            }).join("")}
          </div>
        `}
      </div>

      <div class="notif-dropdown-foot">
        <button class="notif-perm-btn" id="notif-request-perm">
          🔔 ${typeof window !== "undefined" && "Notification" in window && Notification.permission === "granted" ? "Browser Notifications Active ✓" : "Enable Browser Alerts"}
        </button>
      </div>
    `;

    const gotoBtn = document.getElementById("notif-goto-tasks");
    if (gotoBtn) {
      gotoBtn.addEventListener("click", () => {
        closeDropdown();
        TasksViewState.assigneeFilter = me.fullName;
        location.hash = "#/tasks";
        if (Router.current().name === "tasks") Router.rerender();
      });
    }

    const permBtn = document.getElementById("notif-request-perm");
    if (permBtn) {
      permBtn.addEventListener("click", () => {
        requestBrowserPermission();
        setTimeout(renderDropdown, 500);
      });
    }

    dd.querySelectorAll("[data-notif-action]").forEach((el) => {
      el.addEventListener("click", (e) => {
        e.stopPropagation();
        const action = el.dataset.notifAction;
        const taskId = el.dataset.id;
        if (action === "done") {
          Data.toggleTaskStatus(taskId);
          Toast.show("Task marked as completed! 🎉", "success");
          updateBadge();
          renderDropdown();
          if (Router.current().name === "tasks") Router.rerender();
        } else if (action === "view") {
          closeDropdown();
          const task = Data.getTaskById(taskId);
          if (task) TaskForm.open({ task });
        }
      });
    });
  }

  return {
    getMyTasks,
    getMyOpenTasks,
    updateBadge,
    checkForNewTasks,
    resetSession,
    toggleDropdown,
    closeDropdown,
    renderDropdown,
    requestBrowserPermission,
  };
})();

/* ============================== VIEWS ============================== */
const Views = {};

Views.dashboard = function () {
  const stats = Data.globalStats();
  const chapters = CONFIG.CHAPTERS;
  const counts = stats.counts;

  const ledgerRows = chapters
    .map((c, i) => {
      const count = counts[c] || 0;
      return `
        <a href="#/chapter/${Utils.chapterSlug(c)}" class="ledger-row ${count === 0 ? "empty" : ""}">
          <span class="l-num">${String(i + 1).padStart(2, "0")}</span>
          <span class="l-name">${Utils.escapeHtml(c)}</span>
          <span class="ledger-tally">${tallyMarkup(count)}</span>
          <span class="l-count">${count}</span>
        </a>`;
    })
    .join("");

  return `
    <div class="page-head">
      <div>
        <p class="page-eyebrow">Overview</p>
        <h1 class="page-title">Dashboard</h1>
        <p class="page-sub">The full state of the ledger, at a glance.</p>
      </div>
      <div class="page-actions">
        <button class="btn btn-secondary" data-action="new-quiz">+ New Quiz</button>
        <button class="btn btn-primary" data-action="new-question">+ Add Question</button>
      </div>
    </div>

    <div class="stat-grid">
      <div class="stat-card"><div class="stat-label">Total Quizzes</div><div class="stat-value">${stats.totalQuizzes}</div></div>
      <div class="stat-card"><div class="stat-label">Total Questions (capacity)</div><div class="stat-value">${stats.totalCapacity}</div></div>
      <div class="stat-card"><div class="stat-label">Questions Entered</div><div class="stat-value good">${stats.entered}</div></div>
      <div class="stat-card"><div class="stat-label">Questions Remaining</div><div class="stat-value accent">${stats.remaining}</div></div>
      <div class="stat-card"><div class="stat-label">Most Common Chapter</div><div class="stat-value" style="font-size:16px; line-height:1.3;">${stats.most ? Utils.escapeHtml(stats.most[0]) : "—"}</div><div class="stat-foot">${stats.most ? stats.most[1] + " questions" : "No questions yet"}</div></div>
      <div class="stat-card"><div class="stat-label">Least Common Chapter</div><div class="stat-value" style="font-size:16px; line-height:1.3;">${stats.least ? Utils.escapeHtml(stats.least[0]) : "—"}</div><div class="stat-foot">${stats.least ? stats.least[1] + " questions" : "No questions yet"}</div></div>
      <div class="stat-card"><div class="stat-label">Missing Chapters</div><div class="stat-value accent">${stats.missingChapters.length}</div><div class="stat-foot">of ${chapters.length} total</div></div>
      <div class="stat-card">
        <div class="stat-label">Progress</div>
        <div class="stat-value">${stats.progressPct}%</div>
        <div class="progress-track" style="margin-top:10px;"><div class="progress-fill ${progressFillClass(stats.progressPct)}" style="width:${stats.progressPct}%"></div></div>
      </div>
    </div>

    <div class="ledger-hero">
      <div class="ledger-hero-head">
        <h2>Chapter Coverage Ledger</h2>
        <span class="pct">${stats.entered} tallied across ${chapters.length} chapters</span>
      </div>
      <div class="ledger-rows">${ledgerRows}</div>
    </div>

    <div class="section-block">
      <div class="section-title">Recent Quizzes <span class="count-pill">${stats.totalQuizzes}</span></div>
      ${Data.getQuizzes().length === 0 ? emptyState("▤", "No quizzes yet", "Create your first quiz to start logging questions.") : `
      <div class="card-grid">
        ${Data.getQuizzes().slice(0, 6).map(quizCardHtml).join("")}
      </div>`}
    </div>
  `;
};

function emptyState(icon, title, sub) {
  return `<div class="empty-state"><div class="empty-ico">${icon}</div><h3>${title}</h3><p>${sub}</p></div>`;
}

function quizCardHtml(quiz) {
  const s = Data.quizStats(quiz);
  return `
    <div class="entity-card" data-action="open-quiz" data-id="${quiz.id}">
      <div class="entity-card-top">
        <div>
          <div class="entity-card-title">${Utils.escapeHtml(quiz.name)}</div>
          <div class="entity-card-sub">${Utils.formatDate(quiz.dateCreated)}</div>
        </div>
        <span class="badge ${s.pct === 100 ? "badge-easy" : s.pct === 0 ? "badge-hard" : "badge-medium"}">${s.pct}%</span>
      </div>
      <div class="progress-track"><div class="progress-fill ${progressFillClass(s.pct)}" style="width:${s.pct}%"></div></div>
      <div class="entity-card-stats">
        <span>${s.entered} / ${quiz.numQuestions} entered</span>
        <span>${s.missing} missing</span>
      </div>
      <div class="entity-card-actions" onclick="event.stopPropagation()">
        <button class="btn btn-secondary btn-sm" data-action="edit-quiz" data-id="${quiz.id}">Edit</button>
        <button class="btn btn-danger btn-sm" data-action="delete-quiz" data-id="${quiz.id}">Delete</button>
      </div>
    </div>
  `;
}

Views.quizzes = function () {
  const quizzes = Data.getQuizzes();
  return `
    <div class="page-head">
      <div>
        <p class="page-eyebrow">Work</p>
        <h1 class="page-title">Quizzes</h1>
        <p class="page-sub">${quizzes.length} quiz${quizzes.length === 1 ? "" : "zes"} in the ledger.</p>
      </div>
      <div class="page-actions"><button class="btn btn-primary" data-action="new-quiz">+ New Quiz</button></div>
    </div>
    ${quizzes.length === 0 ? emptyState("▤", "No quizzes yet", "Create a quiz, tell it how many questions it has, then start logging them by chapter.") : `
    <div class="card-grid">${quizzes.map(quizCardHtml).join("")}</div>`}
  `;
};

Views.quizDetail = function (id) {
  const quiz = Data.getQuizById(id);
  if (!quiz) return emptyState("▨", "Quiz not found", "It may have been deleted.");
  const s = Data.quizStats(quiz);
  const questions = Data.getQuestionsForQuiz(id);
  return `
    <a href="#/quizzes" class="btn btn-ghost btn-sm" style="margin-bottom:14px; display:inline-flex;">← All Quizzes</a>
    <div class="page-head">
      <div>
        <p class="page-eyebrow">Quiz Report</p>
        <h1 class="page-title">${Utils.escapeHtml(quiz.name)}</h1>
        <p class="page-sub">${quiz.notes ? Utils.escapeHtml(quiz.notes) : "Created " + Utils.formatDate(quiz.dateCreated)}</p>
      </div>
      <div class="page-actions">
        <button class="btn btn-secondary" data-action="edit-quiz" data-id="${quiz.id}">Edit Quiz</button>
        <button class="btn btn-primary" data-action="new-question" data-quizid="${quiz.id}">+ Add Question</button>
      </div>
    </div>

    <div class="stat-grid">
      <div class="stat-card"><div class="stat-label">Questions</div><div class="stat-value">${quiz.numQuestions}</div></div>
      <div class="stat-card"><div class="stat-label">Entered</div><div class="stat-value good">${s.entered}</div></div>
      <div class="stat-card"><div class="stat-label">Missing</div><div class="stat-value accent">${s.missing}</div></div>
      <div class="stat-card">
        <div class="stat-label">Completion</div>
        <div class="stat-value">${s.pct}%</div>
        <div class="progress-track" style="margin-top:10px;"><div class="progress-fill ${progressFillClass(s.pct)}" style="width:${s.pct}%"></div></div>
      </div>
    </div>

    ${s.missingNums.length > 0 ? `
    <div class="section-block">
      <div class="section-title">Missing Questions <span class="count-pill">${s.missingNums.length}</span></div>
      <div style="display:flex; flex-wrap:wrap; gap:7px;">
        ${s.missingNums.map((n) => `<span class="chapter-chip mono">Q${n}</span>`).join("")}
      </div>
    </div>` : ""}

    <div class="section-block">
      <div class="section-title">Questions in this Quiz <span class="count-pill">${questions.length}</span></div>
      ${questions.length === 0 ? emptyState("▥", "No questions logged", "Add the first question from this quiz.") : `
      <div class="table-wrap"><table>
        <thead><tr><th class="num">Q#</th><th>Chapter</th><th class="num">Ch. Q#</th><th>Book</th><th>Answer</th><th>Difficulty</th><th>Notes</th><th></th></tr></thead>
        <tbody>
          ${questions.map((q) => `
            <tr>
              <td class="num">Q${q.qNumInQuiz}</td>
              <td><a href="#/chapter/${Utils.chapterSlug(q.chapter)}" class="chapter-chip">${Utils.escapeHtml(q.chapter)}</a></td>
              <td class="num">#${q.chapterQNum}</td>
              <td style="font-weight:500;">${Utils.escapeHtml(q.bookName) || "—"}</td>
              <td>${q.answer ? `<span class="answer-badge mono">${Utils.escapeHtml(q.answer)}</span>` : "—"}</td>
              <td>${diffBadge(q.difficulty)}</td>
              <td style="color:var(--ink-soft); max-width:200px;">${Utils.escapeHtml(q.notes) || "—"}</td>
              <td class="row-actions">
                <button class="icon-btn" data-action="edit-question" data-id="${q.id}" title="Edit">✎</button>
                <button class="icon-btn" data-action="delete-question" data-id="${q.id}" title="Delete">🗑</button>
              </td>
            </tr>`).join("")}
        </tbody>
      </table></div>`}
    </div>
  `;
};

/* ---- All Questions (search + filter + sort + paginate) ---- */
const QuestionsViewState = { page: 1, pageSize: 25, sortKey: "dateAdded", sortDir: "desc", filters: { chapter: "", quizId: "", difficulty: "" }, search: "" };
const ActivityViewState = { page: 1, pageSize: 30, filters: { userId: "" }, search: "" };

Views.questions = function () {
  const st = QuestionsViewState;
  const quizzesById = {};
  Data.getQuizzes().forEach((q) => (quizzesById[q.id] = q));
  let rows = Data.getQuestions().map((q) => ({ ...q, quizName: quizzesById[q.quizId] ? quizzesById[q.quizId].name : "(deleted quiz)" }));

  if (st.search.trim()) {
    const term = st.search.trim().toLowerCase();
    rows = rows.filter((q) => [q.quizName, q.qNumInQuiz, q.chapter, q.chapterQNum, q.bookName || "", q.answer || "", q.difficulty, q.notes || ""].join(" ").toLowerCase().includes(term));
  }
  if (st.filters.chapter) rows = rows.filter((q) => q.chapter === st.filters.chapter);
  if (st.filters.quizId) rows = rows.filter((q) => q.quizId === st.filters.quizId);
  if (st.filters.difficulty) rows = rows.filter((q) => q.difficulty === st.filters.difficulty);

  rows.sort((a, b) => {
    let av = a[st.sortKey] || "", bv = b[st.sortKey] || "";
    if (typeof av === "string") av = av.toLowerCase();
    if (typeof bv === "string") bv = bv.toLowerCase();
    if (av < bv) return st.sortDir === "asc" ? -1 : 1;
    if (av > bv) return st.sortDir === "asc" ? 1 : -1;
    return 0;
  });

  const total = rows.length;
  const totalPages = Math.max(1, Math.ceil(total / st.pageSize));
  st.page = Utils.clamp(st.page, 1, totalPages);
  const pageRows = rows.slice((st.page - 1) * st.pageSize, st.page * st.pageSize);

  const arrow = (key) => (st.sortKey === key ? `<span class="sort-arrow">${st.sortDir === "asc" ? "▲" : "▼"}</span>` : "");

  return `
    <div class="page-head">
      <div>
        <p class="page-eyebrow">Work</p>
        <h1 class="page-title">All Questions</h1>
        <p class="page-sub">${total} question${total === 1 ? "" : "s"} matching current filters, of ${Data.getQuestions().length} total.</p>
      </div>
      <div class="page-actions"><button class="btn btn-primary" data-action="new-question">+ Add Question</button></div>
    </div>

    <div class="filter-bar">
      <input type="text" id="q-search" placeholder="Search notes, book, answer, chapter, quiz…" value="${Utils.escapeHtml(st.search)}" style="min-width:220px;" />
      <select id="f-chapter">
        <option value="">All Chapters</option>
        ${CONFIG.CHAPTERS.map((c) => `<option value="${Utils.escapeHtml(c)}" ${st.filters.chapter === c ? "selected" : ""}>${Utils.escapeHtml(c)}</option>`).join("")}
      </select>
      <select id="f-quiz">
        <option value="">All Quizzes</option>
        ${Data.getQuizzes().map((q) => `<option value="${q.id}" ${st.filters.quizId === q.id ? "selected" : ""}>${Utils.escapeHtml(q.name)}</option>`).join("")}
      </select>
      <select id="f-difficulty">
        <option value="">All Difficulties</option>
        ${CONFIG.DIFFICULTIES.map((d) => `<option value="${d}" ${st.filters.difficulty === d ? "selected" : ""}>${d}</option>`).join("")}
      </select>
      ${(st.filters.chapter || st.filters.quizId || st.filters.difficulty || st.search) ? `<button class="filter-chip-clear" id="clear-filters">Clear filters</button>` : ""}
    </div>

    ${total === 0 ? emptyState("▥", "No questions match", "Try clearing filters or add a new question.") : `
    <div class="table-wrap">
      <table>
        <thead><tr>
          <th data-sort="quizName">Quiz${arrow("quizName")}</th>
          <th class="num" data-sort="qNumInQuiz">Q#${arrow("qNumInQuiz")}</th>
          <th data-sort="chapter">Chapter${arrow("chapter")}</th>
          <th class="num" data-sort="chapterQNum">Ch. Q#${arrow("chapterQNum")}</th>
          <th data-sort="bookName">Book${arrow("bookName")}</th>
          <th data-sort="answer">Answer${arrow("answer")}</th>
          <th data-sort="difficulty">Difficulty${arrow("difficulty")}</th>
          <th>Notes</th>
          <th></th>
        </tr></thead>
        <tbody>
          ${pageRows.map((q) => `
            <tr>
              <td><a href="#/quiz/${q.quizId}">${Utils.escapeHtml(q.quizName)}</a></td>
              <td class="num">Q${q.qNumInQuiz}</td>
              <td><a href="#/chapter/${Utils.chapterSlug(q.chapter)}" class="chapter-chip">${Utils.escapeHtml(q.chapter)}</a></td>
              <td class="num">#${q.chapterQNum}</td>
              <td style="font-weight:500;">${Utils.escapeHtml(q.bookName) || "—"}</td>
              <td>${q.answer ? `<span class="answer-badge mono">${Utils.escapeHtml(q.answer)}</span>` : "—"}</td>
              <td>${diffBadge(q.difficulty)}</td>
              <td style="color:var(--ink-soft); max-width:220px;">${Utils.escapeHtml(q.notes) || "—"}</td>
              <td class="row-actions">
                <button class="icon-btn" data-action="edit-question" data-id="${q.id}" title="Edit">✎</button>
                <button class="icon-btn" data-action="delete-question" data-id="${q.id}" title="Delete">🗑</button>
              </td>
            </tr>`).join("")}
        </tbody>
      </table>
      <div class="pagination">
        <span>Page ${st.page} of ${totalPages}</span>
        <div class="pg-btns">
          <button class="pg-btn" id="pg-prev" ${st.page <= 1 ? "disabled" : ""}>‹</button>
          <button class="pg-btn" id="pg-next" ${st.page >= totalPages ? "disabled" : ""}>›</button>
        </div>
      </div>
    </div>`}
  `;
};

Views.chapter = function (chapterName) {
  const chapter = CONFIG.CHAPTERS.find((c) => c === chapterName);
  if (!chapter) return emptyState("▨", "Chapter not found", "");
  const idx = CONFIG.CHAPTERS.indexOf(chapter);
  const questions = Data.getQuestionsForChapter(chapter);
  const quizzesById = {};
  Data.getQuizzes().forEach((q) => (quizzesById[q.id] = q));
  return `
    <div class="page-head">
      <div>
        <p class="page-eyebrow">Chapter ${String(idx + 1).padStart(2, "0")}</p>
        <h1 class="page-title">${Utils.escapeHtml(chapter)}</h1>
        <p class="page-sub">${questions.length} question${questions.length === 1 ? "" : "s"} collected under this chapter.</p>
      </div>
      <div class="page-actions"><button class="btn btn-primary" data-action="new-question-chapter" data-chapter="${Utils.escapeHtml(chapter)}">+ Add Question Here</button></div>
    </div>
    ${questions.length === 0 ? emptyState("▨", "Nothing collected yet", "This chapter has no questions logged. It'll show up in Missing Chapters on the dashboard until it does.") : `
    <div class="table-wrap"><table>
      <thead><tr><th class="num">Chapter Q#</th><th>Quiz</th><th class="num">Quiz Q#</th><th>Book</th><th>Answer</th><th>Difficulty</th><th>Notes</th><th></th></tr></thead>
      <tbody>
        ${questions.map((q) => `
          <tr>
            <td class="num">#${q.chapterQNum}</td>
            <td><a href="#/quiz/${q.quizId}">${quizzesById[q.quizId] ? Utils.escapeHtml(quizzesById[q.quizId].name) : "(deleted quiz)"}</a></td>
            <td class="num">Q${q.qNumInQuiz}</td>
            <td style="font-weight:500;">${Utils.escapeHtml(q.bookName) || "—"}</td>
            <td>${q.answer ? `<span class="answer-badge mono">${Utils.escapeHtml(q.answer)}</span>` : "—"}</td>
            <td>${diffBadge(q.difficulty)}</td>
            <td style="color:var(--ink-soft); max-width:240px;">${Utils.escapeHtml(q.notes) || "—"}</td>
            <td class="row-actions">
              <button class="icon-btn" data-action="edit-question" data-id="${q.id}" title="Edit">✎</button>
              <button class="icon-btn" data-action="delete-question" data-id="${q.id}" title="Delete">🗑</button>
            </td>
          </tr>`).join("")}
      </tbody>
    </table></div>`}
  `;
};

Views.missing = function () {
  const quizzes = Data.getQuizzes().map((q) => ({ quiz: q, s: Data.quizStats(q) })).filter((x) => x.s.missing > 0);
  const stats = Data.globalStats();
  return `
    <div class="page-head">
      <div>
        <p class="page-eyebrow">Work</p>
        <h1 class="page-title">Missing Report</h1>
        <p class="page-sub">${quizzes.length} quiz${quizzes.length === 1 ? "" : "zes"} with gaps · ${stats.missingChapters.length} chapters with zero questions.</p>
      </div>
    </div>

    <div class="section-block">
      <div class="section-title">Chapters with Zero Questions <span class="count-pill">${stats.missingChapters.length}</span></div>
      ${stats.missingChapters.length === 0 ? emptyState("✓", "Every chapter is covered", "At least one question has been logged for every chapter.") : `
      <div style="display:flex; flex-wrap:wrap; gap:8px;">
        ${stats.missingChapters.map((c) => `<a href="#/chapter/${Utils.chapterSlug(c)}" class="chapter-chip" style="border:1px dashed var(--accent); color:var(--accent);">${Utils.escapeHtml(c)}</a>`).join("")}
      </div>`}
    </div>

    <div class="section-block">
      <div class="section-title">Quizzes Missing Questions <span class="count-pill">${quizzes.length}</span></div>
      ${quizzes.length === 0 ? emptyState("✓", "Nothing missing", "Every quiz is fully entered.") : `
      <div class="card-grid">
        ${quizzes.map(({ quiz, s }) => `
          <div class="entity-card" data-action="open-quiz" data-id="${quiz.id}">
            <div class="entity-card-top">
              <div class="entity-card-title">${Utils.escapeHtml(quiz.name)}</div>
              <span class="badge badge-hard">${s.missing} missing</span>
            </div>
            <div class="progress-track"><div class="progress-fill ${progressFillClass(s.pct)}" style="width:${s.pct}%"></div></div>
            <div style="display:flex; flex-wrap:wrap; gap:5px;">
              ${s.missingNums.slice(0, 12).map((n) => `<span class="chapter-chip mono" style="font-size:11px;">Q${n}</span>`).join("")}
              ${s.missingNums.length > 12 ? `<span class="chapter-chip mono" style="font-size:11px;">+${s.missingNums.length - 12} more</span>` : ""}
            </div>
          </div>
        `).join("")}
      </div>`}
    </div>
  `;
};

Views.statistics = function () {
  const stats = Data.globalStats();
  const chapters = CONFIG.CHAPTERS;
  const counts = chapters.map((c) => stats.counts[c] || 0);
  const diffCounts = CONFIG.DIFFICULTIES.map((d) => Data.getQuestions().filter((q) => q.difficulty === d).length);

  setTimeout(() => {
    const barCanvas = document.getElementById("chart-bar");
    const pieCanvas = document.getElementById("chart-pie");
    if (barCanvas) Charts.barChart(barCanvas, chapters, counts);
    if (pieCanvas) Charts.pieChart(pieCanvas, CONFIG.DIFFICULTIES, diffCounts);
  }, 0);

  const palette = Charts.palette();

  return `
    <div class="page-head">
      <div>
        <p class="page-eyebrow">Overview</p>
        <h1 class="page-title">Statistics</h1>
        <p class="page-sub">How the collection is shaping up.</p>
      </div>
    </div>

    <div class="stat-grid">
      <div class="stat-card"><div class="stat-label">Total Questions</div><div class="stat-value">${stats.entered}</div></div>
      <div class="stat-card"><div class="stat-label">Total Quizzes</div><div class="stat-value">${stats.totalQuizzes}</div></div>
      <div class="stat-card"><div class="stat-label">Avg. Questions / Quiz</div><div class="stat-value">${stats.avgPerQuiz.toFixed(1)}</div></div>
      <div class="stat-card"><div class="stat-label">Coverage</div><div class="stat-value">${stats.progressPct}%</div></div>
    </div>

    <div class="two-col-charts">
      <div class="chart-card">
        <h3>Questions per Chapter</h3>
        <canvas id="chart-bar" style="width:100%; height:230px;"></canvas>
      </div>
      <div class="chart-card">
        <h3>Difficulty Mix</h3>
        <canvas id="chart-pie" style="width:100%; height:200px;"></canvas>
        <div class="chart-legend">
          ${CONFIG.DIFFICULTIES.map((d, i) => `<div class="chart-legend-item"><span class="chart-legend-dot" style="background:${palette[i]}"></span>${d} — ${diffCounts[i]}</div>`).join("")}
        </div>
      </div>
    </div>

    <div class="section-block" style="margin-top:24px;">
      <div class="section-title">Chapter Breakdown</div>
      <div class="table-wrap"><table>
        <thead><tr><th>#</th><th>Chapter</th><th class="num">Questions</th><th>Coverage</th></tr></thead>
        <tbody>
          ${chapters.map((c, i) => {
            const count = stats.counts[c] || 0;
            const pct = stats.entered > 0 ? Math.round((count / stats.entered) * 100) : 0;
            return `<tr>
              <td class="num">${String(i + 1).padStart(2, "0")}</td>
              <td><a href="#/chapter/${Utils.chapterSlug(c)}">${Utils.escapeHtml(c)}</a></td>
              <td class="num">${count}</td>
              <td style="width:160px;"><div class="progress-track"><div class="progress-fill ${progressFillClass(pct)}" style="width:${pct}%"></div></div></td>
            </tr>`;
          }).join("")}
        </tbody>
      </table></div>
    </div>
  `;
};

Views.data = function () {
  if (!Auth.isAdmin()) {
    return emptyState("🔒", "Access Denied", "This section is for administrators only.");
  }
  const fbStatus = FirebaseSync.getStatus();
  const fbConnected = fbStatus === "connected";
  return `
    <div class="page-head">
      <div>
        <p class="page-eyebrow">Data</p>
        <h1 class="page-title">Import / Export & Cloud Sync</h1>
        <p class="page-sub">Backup data locally or synchronize with Google Firebase across devices.</p>
      </div>
    </div>

    <div class="card-grid">
      <!-- Firebase Cloud Card -->
      <div class="entity-card" style="cursor:default; border:1.5px solid var(--accent); background:var(--surface);">
        <div class="entity-card-top">
          <div class="entity-card-title" style="display:flex; align-items:center; gap:8px;">
            <span>☁️</span> Firebase Cloud Database
          </div>
          <span class="badge ${fbConnected ? 'badge-easy' : 'badge-hard'}">
            <span class="badge-dot"></span>${fbConnected ? 'Connected & Live' : 'Not Connected (Local)'}
          </span>
        </div>
        <p style="font-size:13px; color:var(--ink-soft); line-height:1.45;">
          Connect your question bank to Google Firebase Firestore to sync all quizzes, questions, users, notes, and tasks in real-time across all team members and devices.
        </p>
        <div style="display:flex; gap:8px; flex-wrap:wrap; margin-top:6px;">
          <button class="btn btn-primary btn-sm" data-action="open-firebase-modal">⚙ Configure Firebase</button>
          <button class="btn btn-secondary btn-sm" data-action="firebase-push-all" ${fbConnected ? '' : 'disabled'}>☁ Push to Cloud</button>
          <button class="btn btn-secondary btn-sm" data-action="firebase-pull-all" ${fbConnected ? '' : 'disabled'}>⬇ Pull from Cloud</button>
        </div>
      </div>

      <div class="entity-card" style="cursor:default;">
        <div class="entity-card-title">Export JSON</div>
        <p style="font-size:13px; color:var(--ink-soft);">Full backup of quizzes and questions, restorable later.</p>
        <button class="btn btn-primary btn-sm" id="export-json">Download .json</button>
      </div>
      <div class="entity-card" style="cursor:default;">
        <div class="entity-card-title">Import JSON</div>
        <p style="font-size:13px; color:var(--ink-soft);">Replaces all current data with the contents of the file.</p>
        <input type="file" id="import-json-input" accept="application/json" style="display:none;" />
        <button class="btn btn-secondary btn-sm" id="import-json">Choose file…</button>
      </div>
      <div class="entity-card" style="cursor:default;">
        <div class="entity-card-title">Export CSV</div>
        <p style="font-size:13px; color:var(--ink-soft);">Spreadsheet-friendly list of every question.</p>
        <button class="btn btn-primary btn-sm" id="export-csv">Download .csv</button>
      </div>
      <div class="entity-card" style="cursor:default;">
        <div class="entity-card-title">Backup Now</div>
        <p style="font-size:13px; color:var(--ink-soft);">Same as JSON export, timestamped for safekeeping.</p>
        <button class="btn btn-secondary btn-sm" id="backup-now">Save Backup</button>
      </div>
      <div class="entity-card" style="cursor:default;">
        <div class="entity-card-title">Restore Data</div>
        <p style="font-size:13px; color:var(--ink-soft);">Load a previously saved backup file.</p>
        <input type="file" id="restore-input" accept="application/json" style="display:none;" />
        <button class="btn btn-danger btn-sm" id="restore-btn">Restore from file…</button>
      </div>
      <div class="entity-card" style="cursor:default;">
        <div class="entity-card-title">Reset Everything</div>
        <p style="font-size:13px; color:var(--ink-soft);">Wipes all quizzes and questions from this browser.</p>
        <button class="btn btn-danger btn-sm" id="reset-all">Erase All Data</button>
      </div>
    </div>
  `;
};

/* ---- Admin Tasks View ---- */
const TasksViewState = {
  search: "",
  statusFilter: "",
  priorityFilter: "",
  assigneeFilter: "",
  viewMode: "by-person", // "by-person" (default) or "table"
};

Views.tasks = function () {
  const me = Auth.currentUser();
  const isAdmin = Auth.isAdmin();
  const allTasks = Data.getTasks();
  const users = Data.getUsers();
  const st = TasksViewState;

  let filtered = allTasks;
  if (st.search.trim()) {
    const term = st.search.trim().toLowerCase();
    filtered = filtered.filter((t) =>
      [t.title, t.description, t.assignedTo, t.priority, t.status]
        .join(" ")
        .toLowerCase()
        .includes(term)
    );
  }
  if (st.statusFilter) {
    filtered = filtered.filter((t) => t.status === st.statusFilter);
  }
  if (st.priorityFilter) {
    filtered = filtered.filter((t) => t.priority === st.priorityFilter);
  }
  if (st.assigneeFilter) {
    if (st.assigneeFilter === "__admin__") {
      filtered = filtered.filter((t) => !t.assignedTo || t.assignedTo === "Admin Only");
    } else {
      filtered = filtered.filter((t) => t.assignedTo === st.assigneeFilter);
    }
  }

  const pendingCount = allTasks.filter((t) => t.status === "Pending").length;
  const inProgressCount = allTasks.filter((t) => t.status === "In Progress").length;
  const completedCount = allTasks.filter((t) => t.status === "Completed").length;

  // Build member sections list for the by-person view
  const memberSections = [
    {
      key: "All",
      name: "👥 Everyone (Assigned to All)",
      role: "Team Wide",
      avatar: "👥",
      presetAssignee: "All",
      isSpecial: true,
      userObj: null,
      tasks: allTasks.filter((t) => t.assignedTo === "All"),
    },
    ...users.map((u) => ({
      key: u.fullName,
      name: u.fullName,
      role: u.role === "admin" ? "Administrator" : "User",
      avatar: u.fullName.split(" ").map((n) => n[0]).slice(0, 2).join("").toUpperCase() || "U",
      presetAssignee: u.fullName,
      isSpecial: false,
      userObj: u,
      tasks: allTasks.filter((t) => t.assignedTo === u.fullName),
    })),
    {
      key: "__admin__",
      name: "📌 General / Team Tasks",
      role: "General",
      avatar: "📌",
      presetAssignee: "",
      isSpecial: true,
      userObj: null,
      tasks: allTasks.filter((t) => !t.assignedTo || t.assignedTo === "Admin Only"),
    },
  ];

  const visibleSections = st.assigneeFilter
    ? memberSections.filter((s) => s.key === st.assigneeFilter)
    : memberSections;

  return `
    <div class="page-head">
      <div>
        <p class="page-eyebrow" style="display:flex; align-items:center; gap:6px;">
          <span>☑</span> Team & Member Tasks
        </p>
        <h1 class="page-title">Tasks</h1>
        <p class="page-sub">${allTasks.length} total task${allTasks.length === 1 ? "" : "s"} · organized by member and synchronized across team.</p>
      </div>
      <div class="page-actions">
        ${isAdmin ? `<button class="btn btn-secondary" data-action="open-firebase-modal">☁ Cloud Sync</button>` : ""}
        <button class="btn btn-primary" data-action="new-task">${isAdmin ? "+ New Task" : "+ Add My Task"}</button>
      </div>
    </div>

    <div class="stat-grid">
      <div class="stat-card">
        <div class="stat-label">Total Tasks</div>
        <div class="stat-value">${allTasks.length}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Pending</div>
        <div class="stat-value accent">${pendingCount}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">In Progress</div>
        <div class="stat-value" style="color:var(--gold);">${inProgressCount}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Completed</div>
        <div class="stat-value good">${completedCount}</div>
      </div>
    </div>

    <!-- Toolbar: View Switcher -->
    <div class="tasks-toolbar">
      <div class="tasks-view-switch">
        <button class="view-switch-btn ${st.viewMode === "by-person" ? "active" : ""}" data-action="set-task-view" data-mode="by-person">
          👥 Grouped by Member
        </button>
        <button class="view-switch-btn ${st.viewMode === "table" ? "active" : ""}" data-action="set-task-view" data-mode="table">
          📋 Full Table
        </button>
      </div>
      <div style="font-size:12px; color:var(--ink-faint);">
        ${st.viewMode === "by-person" ? "Showing tasks grouped per person" : "Showing all tasks in a single table"}
      </div>
    </div>

    <!-- Member Filter Tabs -->
    <div class="member-tabs">
      <button class="member-tab ${!st.assigneeFilter ? "active" : ""}" data-action="filter-task-member" data-member="">
        All Members (${allTasks.length})
      </button>
      <button class="member-tab ${st.assigneeFilter === "All" ? "active" : ""}" data-action="filter-task-member" data-member="All">
        👥 Everyone (${allTasks.filter((t) => t.assignedTo === "All").length})
      </button>
      ${users.map((u) => {
        const count = allTasks.filter((t) => t.assignedTo === u.fullName).length;
        return `
          <button class="member-tab ${st.assigneeFilter === u.fullName ? "active" : ""}" data-action="filter-task-member" data-member="${Utils.escapeHtml(u.fullName)}">
            👤 ${Utils.escapeHtml(u.fullName)} (${count})
          </button>
        `;
      }).join("")}
      <button class="member-tab ${st.assigneeFilter === "__admin__" ? "active" : ""}" data-action="filter-task-member" data-member="__admin__">
        📌 General (${allTasks.filter((t) => !t.assignedTo || t.assignedTo === "Admin Only").length})
      </button>
    </div>

    <!-- Filter Bar -->
    <div class="filter-bar">
      <input type="text" id="task-search" placeholder="Search tasks, descriptions, assignees…" value="${Utils.escapeHtml(st.search)}" style="min-width:220px;" />
      <select id="task-status-filter">
        <option value="">All Statuses</option>
        <option value="Pending" ${st.statusFilter === "Pending" ? "selected" : ""}>Pending</option>
        <option value="In Progress" ${st.statusFilter === "In Progress" ? "selected" : ""}>In Progress</option>
        <option value="Completed" ${st.statusFilter === "Completed" ? "selected" : ""}>Completed</option>
      </select>
      <select id="task-priority-filter">
        <option value="">All Priorities</option>
        <option value="High" ${st.priorityFilter === "High" ? "selected" : ""}>High Priority</option>
        <option value="Medium" ${st.priorityFilter === "Medium" ? "selected" : ""}>Medium Priority</option>
        <option value="Low" ${st.priorityFilter === "Low" ? "selected" : ""}>Low Priority</option>
      </select>
      <select id="task-assignee-filter">
        <option value="">All Assignees</option>
        <option value="All" ${st.assigneeFilter === "All" ? "selected" : ""}>👥 All Users (Everyone)</option>
        <option value="__admin__" ${st.assigneeFilter === "__admin__" ? "selected" : ""}>Admin Only (General)</option>
        ${users.map((u) => `<option value="${Utils.escapeHtml(u.fullName)}" ${st.assigneeFilter === u.fullName ? "selected" : ""}>👤 ${Utils.escapeHtml(u.fullName)}</option>`).join("")}
      </select>
      ${(st.search || st.statusFilter || st.priorityFilter || st.assigneeFilter) ? `<button class="filter-chip-clear" id="clear-task-filters">Clear filters</button>` : ""}
    </div>

    <!-- Content depending on view mode -->
    ${st.viewMode === "by-person" ? `
      <div class="person-task-grid">
        ${visibleSections.map((sec) => {
          let secTasks = sec.tasks;
          if (st.search.trim()) {
            const term = st.search.trim().toLowerCase();
            secTasks = secTasks.filter((t) => [t.title, t.description, t.priority, t.status].join(" ").toLowerCase().includes(term));
          }
          if (st.statusFilter) secTasks = secTasks.filter((t) => t.status === st.statusFilter);
          if (st.priorityFilter) secTasks = secTasks.filter((t) => t.priority === st.priorityFilter);

          const openCount = sec.tasks.filter((t) => t.status !== "Completed").length;
          const canAddForSec = isAdmin || (me && sec.presetAssignee === me.fullName);

          return `
            <div class="person-task-card">
              <div class="person-task-head">
                <div class="person-info">
                  <div class="user-avatar-badge" style="background:${sec.isSpecial ? "var(--ink)" : "var(--accent)"}; font-size:${sec.isSpecial ? "14px" : "12px"};">
                    ${sec.avatar}
                  </div>
                  <div class="person-name-wrap">
                    <div class="person-title" title="${Utils.escapeHtml(sec.name)}">${Utils.escapeHtml(sec.name)}</div>
                    <div class="person-sub">
                      <span class="badge ${sec.role === "Administrator" ? "badge-medium" : "badge-easy"}" style="font-size:10px;"><span class="badge-dot"></span>${sec.role}</span>
                      <span style="font-weight:600; color:${openCount > 0 ? "var(--accent)" : "var(--good)"};">${openCount} open</span>
                      <span style="color:var(--ink-faint);">· ${sec.tasks.length} total</span>
                    </div>
                  </div>
                </div>
                <div class="person-head-actions">
                  ${sec.userObj && (isAdmin || (me && sec.userObj.id === me.id)) ? `<button class="icon-btn" data-action="open-user-detail" data-id="${sec.userObj.id}" title="View Notes & Details for ${Utils.escapeHtml(sec.name)}" style="font-size:12px; width:28px; height:28px;">📋</button>` : ""}
                  ${canAddForSec ? `<button class="btn btn-secondary btn-sm" data-action="new-user-task" data-user="${Utils.escapeHtml(sec.presetAssignee)}" style="padding:4px 9px; font-size:11.5px;" title="Add new task for ${Utils.escapeHtml(sec.name)}">+ Add Task</button>` : ""}
                </div>
              </div>
              <div class="person-task-list">
                ${secTasks.length === 0 ? `
                  <div class="person-task-empty">
                    <div>No ${st.statusFilter || st.priorityFilter || st.search ? "matching " : ""}tasks for ${Utils.escapeHtml(sec.name)}.</div>
                    ${canAddForSec ? `
                    <div style="margin-top:8px;">
                      <button class="btn btn-primary btn-sm" data-action="new-user-task" data-user="${Utils.escapeHtml(sec.presetAssignee)}" style="font-size:11px; padding:3px 9px;">+ Assign Task</button>
                    </div>
                    ` : ""}
                  </div>
                ` : `
                  ${secTasks.map(personTaskItemHtml).join("")}
                `}
              </div>
            </div>
          `;
        }).join("")}
      </div>
    ` : `
      ${filtered.length === 0 ? emptyState("☑", "No tasks found", allTasks.length === 0 ? "Create your first task using the button above." : "No tasks match current filters.") : `
      <div class="table-wrap">
        <table>
          <thead><tr>
            <th style="width:44px; text-align:center;">Done</th>
            <th>Task</th>
            <th>Assigned To</th>
            <th>Priority</th>
            <th>Status</th>
            <th>Due Date</th>
            <th>Created</th>
            <th></th>
          </tr></thead>
          <tbody>
            ${filtered.map(taskRowHtml).join("")}
          </tbody>
        </table>
      </div>`}
    `}
  `;
};

function personTaskItemHtml(t) {
  const me = Auth.currentUser();
  const isAdmin = Auth.isAdmin();
  const isDone = t.status === "Completed";
  const isOverdue = t.dueDate && !isDone && new Date(t.dueDate).setHours(23, 59, 59, 999) < Date.now();
  const priorityBadge = (p) => {
    if (p === "High") return `<span class="badge badge-hard" style="font-size:9.5px; padding:1px 6px;"><span class="badge-dot"></span>High</span>`;
    if (p === "Medium") return `<span class="badge badge-medium" style="font-size:9.5px; padding:1px 6px;"><span class="badge-dot"></span>Medium</span>`;
    return `<span class="badge badge-easy" style="font-size:9.5px; padding:1px 6px;"><span class="badge-dot"></span>Low</span>`;
  };

  const canModify = isAdmin || (me && (t.assignedTo === me.fullName || t.createdBy === me.fullName));
  const canToggle = isAdmin || (me && (t.assignedTo === me.fullName || t.assignedTo === "All" || t.createdBy === me.fullName));

  return `
    <div class="person-task-item ${isDone ? "completed" : ""}">
      <button class="task-check-btn ${isDone ? "checked" : ""}" data-action="toggle-task-status" data-id="${t.id}" title="${isDone ? "Mark as Pending" : "Mark as Completed"}" style="margin-top:2px; flex-shrink:0; ${!canToggle ? "cursor:not-allowed; opacity:0.5;" : ""}" ${!canToggle ? "disabled" : ""}>
        ${isDone ? "✓" : ""}
      </button>
      <div style="min-width:0; flex:1;">
        <div style="font-weight:600; font-size:13px; ${isDone ? "text-decoration:line-through;" : ""} word-break:break-word;">
          ${Utils.escapeHtml(t.title)}
        </div>
        <div style="display:flex; align-items:center; gap:6px; flex-wrap:wrap; margin-top:3px;">
          ${priorityBadge(t.priority)}
          ${t.status === "In Progress" ? `<span class="badge badge-medium" style="font-size:9.5px; padding:1px 6px;">⏳ In Progress</span>` : ""}
          ${t.dueDate ? `<span class="mono" style="font-size:10.5px; ${isOverdue ? "color:var(--accent); font-weight:700;" : "color:var(--ink-soft);"}">📅 ${Utils.formatDate(t.dueDate)}${isOverdue ? ' (Overdue)' : ''}</span>` : ""}
        </div>
        ${t.description ? `<div style="font-size:11.5px; color:var(--ink-soft); margin-top:3px; line-height:1.35; ${isDone ? "opacity:0.75;" : ""}">${Utils.escapeHtml(t.description)}</div>` : ""}
      </div>
      ${canModify ? `
      <div style="display:flex; gap:3px; flex-shrink:0;">
        <button class="icon-btn" data-action="edit-task" data-id="${t.id}" title="Edit Task" style="width:26px; height:26px; font-size:11px;">✎</button>
        <button class="icon-btn" data-action="delete-task" data-id="${t.id}" title="Delete Task" style="width:26px; height:26px; font-size:11px;">🗑</button>
      </div>
      ` : ""}
    </div>
  `;
}

function taskRowHtml(t) {
  const me = Auth.currentUser();
  const isAdmin = Auth.isAdmin();
  const isDone = t.status === "Completed";
  const priorityBadge = (p) => {
    if (p === "High") return `<span class="badge badge-hard"><span class="badge-dot"></span>High</span>`;
    if (p === "Medium") return `<span class="badge badge-medium"><span class="badge-dot"></span>Medium</span>`;
    return `<span class="badge badge-easy"><span class="badge-dot"></span>Low</span>`;
  };
  const statusBadge = (s) => {
    if (s === "Completed") return `<span class="badge badge-easy">✓ Done</span>`;
    if (s === "In Progress") return `<span class="badge badge-medium">⏳ In Progress</span>`;
    return `<span class="badge" style="background:var(--surface-2); color:var(--ink-soft);">○ Pending</span>`;
  };

  const isOverdue = t.dueDate && !isDone && new Date(t.dueDate).setHours(23,59,59,999) < Date.now();

  let assigneeMarkup = "";
  if (t.assignedTo === "All") {
    assigneeMarkup = `<span class="badge" style="background:var(--accent-soft); color:var(--accent); font-weight:700;"><span class="badge-dot"></span>👥 All Users</span>`;
  } else if (t.assignedTo) {
    const isClickable = isAdmin || (me && me.fullName === t.assignedTo);
    assigneeMarkup = isClickable
      ? `<span class="chapter-chip" style="cursor:pointer;" data-action="open-user-by-name" data-name="${Utils.escapeHtml(t.assignedTo)}" title="Click to view profile & notes">👤 ${Utils.escapeHtml(t.assignedTo)}</span>`
      : `<span class="chapter-chip" style="cursor:default;">👤 ${Utils.escapeHtml(t.assignedTo)}</span>`;
  } else {
    assigneeMarkup = `<span class="badge badge-hard" style="font-size:10.5px;">Admin Only</span>`;
  }

  const canModify = isAdmin || (me && (t.assignedTo === me.fullName || t.createdBy === me.fullName));
  const canToggle = isAdmin || (me && (t.assignedTo === me.fullName || t.assignedTo === "All" || t.createdBy === me.fullName));

  return `
    <tr class="${isDone ? "task-row-completed" : ""}">
      <td style="text-align:center;">
        <button class="task-check-btn ${isDone ? "checked" : ""}" data-action="toggle-task-status" data-id="${t.id}" title="${isDone ? "Mark as Pending" : "Mark as Completed"}" ${!canToggle ? "disabled style='opacity:0.5; cursor:not-allowed;'" : ""}>
          ${isDone ? "✓" : ""}
        </button>
      </td>
      <td>
        <div style="font-weight:600; font-size:14px; ${isDone ? "text-decoration:line-through; opacity:0.65;" : ""}">${Utils.escapeHtml(t.title)}</div>
        ${t.description ? `<div style="font-size:12px; color:var(--ink-soft); margin-top:3px; max-width:380px; ${isDone ? "opacity:0.65;" : ""}">${Utils.escapeHtml(t.description)}</div>` : ""}
      </td>
      <td>${assigneeMarkup}</td>
      <td>${priorityBadge(t.priority)}</td>
      <td>${statusBadge(t.status)}</td>
      <td class="mono" style="${isOverdue ? "color:var(--accent); font-weight:700;" : "color:var(--ink-soft);"}">
        ${t.dueDate ? Utils.formatDate(t.dueDate) + (isOverdue ? ' <span style="font-size:10px;">(Overdue)</span>' : "") : "—"}
      </td>
      <td class="mono" style="font-size:11.5px; color:var(--ink-faint);">${Utils.formatDate(t.createdAt)}</td>
      <td class="row-actions" onclick="event.stopPropagation()">
        ${canModify ? `
          <button class="icon-btn" data-action="edit-task" data-id="${t.id}" title="Edit Task">✎</button>
          <button class="icon-btn" data-action="delete-task" data-id="${t.id}" title="Delete Task">🗑</button>
        ` : ""}
      </td>
    </tr>
  `;
}

Views.users = function () {
  if (!Auth.isAdmin()) {
    return emptyState("🔒", "Access Denied", "This section is for administrators only.");
  }
  const users = Data.getUsers();
  return `
    <div class="page-head">
      <div>
        <p class="page-eyebrow" style="display:flex; align-items:center; gap:6px;">
          <span>☺</span> Team Directory
        </p>
        <h1 class="page-title">Team & Users</h1>
        <p class="page-sub">${users.length} team member${users.length === 1 ? "" : "s"} · view all users, roles, and assigned tasks. Click any user to view details.</p>
      </div>
      <div class="page-actions"><button class="btn btn-primary" data-action="new-user">+ Add User</button></div>
    </div>
    ${users.length === 0 ? emptyState("☺", "No users yet", "Create the first account to get started.") : `
    <div class="table-wrap"><table>
      <thead><tr>
        <th>Name</th><th>Username</th><th>Role</th><th>Tasks</th><th>Notes</th><th>Password</th><th>Last Login</th><th>Status</th><th></th>
      </tr></thead>
      <tbody>${users.map(userRowHtml).join("")}</tbody>
    </table></div>`}
  `;
};

function userRowHtml(u) {
  const me = Auth.currentUser();
  const isSelf = !!(me && me.id === u.id);
  const isAdmin = Auth.isAdmin();
  const userTasks = Data.getTasks().filter((t) => t.assignedTo === u.fullName || t.assignedTo === "All");
  const pendingTasks = userTasks.filter((t) => t.status !== "Completed");

  return `
    <tr class="clickable-row" data-action="open-user-detail" data-id="${u.id}" title="Click to view notes and tasks for ${Utils.escapeHtml(u.fullName)}">
      <td>
        <div style="display:flex; align-items:center; gap:8px;">
          <span class="user-avatar-badge" style="width:26px; height:26px; font-size:11px;">${Utils.escapeHtml(u.fullName.charAt(0).toUpperCase())}</span>
          <span class="user-name-link">${Utils.escapeHtml(u.fullName)}</span>
          ${isSelf ? '<span class="badge badge-easy" style="font-size:9.5px; padding:1px 6px;">You</span>' : ''}
        </div>
      </td>
      <td class="mono">${Utils.escapeHtml(u.username)}</td>
      <td>${u.role === "admin"
        ? '<span class="badge badge-medium"><span class="badge-dot"></span>Administrator</span>'
        : '<span class="badge badge-easy"><span class="badge-dot"></span>User</span>'}</td>
      <td>
        <span class="badge ${pendingTasks.length > 0 ? "badge-medium" : "badge-easy"}" style="cursor:pointer;" title="${pendingTasks.length} open, ${userTasks.length - pendingTasks.length} completed">
          ${userTasks.length} task${userTasks.length === 1 ? "" : "s"}${pendingTasks.length > 0 ? ` (${pendingTasks.length} open)` : ""}
        </span>
      </td>
      <td style="max-width:180px; font-size:12px; color:var(--ink-soft); overflow:hidden; text-overflow:ellipsis; white-space:nowrap;" title="${Utils.escapeHtml(u.notes || "")}">
        ${u.notes ? Utils.escapeHtml(u.notes) : '<span style="color:var(--ink-faint); font-style:italic;">No notes</span>'}
      </td>
      <td class="mono">${isAdmin || isSelf ? Utils.escapeHtml(u.password) : '••••••••'}</td>
      <td class="mono">${u.lastLogin ? Utils.formatDate(u.lastLogin) : "Never"}</td>
      <td>${u.status === "active"
        ? '<span class="badge badge-easy"><span class="badge-dot"></span>Active</span>'
        : '<span class="badge badge-hard"><span class="badge-dot"></span>Inactive</span>'}</td>
      <td class="row-actions" onclick="event.stopPropagation()">
        <button class="icon-btn" data-action="open-user-detail" data-id="${u.id}" title="View Notes & Tasks">📋</button>
        ${isAdmin ? `
          <button class="icon-btn" data-action="edit-user" data-id="${u.id}" title="Edit">✎</button>
          <button class="icon-btn" data-action="reset-password" data-id="${u.id}" title="Reset Password">⚿</button>
          <button class="icon-btn" data-action="change-username" data-id="${u.id}" title="Change Username">@</button>
          <button class="icon-btn" data-action="toggle-role" data-id="${u.id}" title="${u.role === "admin" ? "Remove Admin Privileges" : "Promote to Administrator"}" ${isSelf && u.role === "admin" ? "disabled" : ""}>${u.role === "admin" ? "▾" : "▴"}</button>
          <button class="icon-btn" data-action="toggle-status" data-id="${u.id}" title="${u.status === "active" ? "Deactivate User" : "Activate User"}" ${isSelf ? "disabled" : ""}>${u.status === "active" ? "⏾" : "⏽"}</button>
          <button class="icon-btn" data-action="delete-user" data-id="${u.id}" title="Delete" ${isSelf ? "disabled" : ""}>🗑</button>
        ` : (isSelf ? `<button class="icon-btn" data-action="reset-password" data-id="${u.id}" title="Change My Password">⚿</button>` : '')}
      </td>
    </tr>
  `;
}

Views.activity = function () {
  if (!Auth.isAdmin()) {
    return emptyState("🔒", "Access Denied", "This section is for administrators only.");
  }
  const st = ActivityViewState;
  const users = Data.getUsers();
  let rows = Activity.getAll();

  if (st.filters.userId) rows = rows.filter((a) => a.userId === st.filters.userId);
  if (st.search.trim()) {
    const term = st.search.trim().toLowerCase();
    rows = rows.filter((a) => [a.userName, a.action, a.details].join(" ").toLowerCase().includes(term));
  }

  const total = rows.length;
  const totalPages = Math.max(1, Math.ceil(total / st.pageSize));
  st.page = Utils.clamp(st.page, 1, totalPages);
  const pageRows = rows.slice((st.page - 1) * st.pageSize, st.page * st.pageSize);

  return `
    <div class="page-head">
      <div>
        <p class="page-eyebrow">Admin</p>
        <h1 class="page-title">User Activity</h1>
        <p class="page-sub">${total} logged action${total === 1 ? "" : "s"} across ${users.length} account${users.length === 1 ? "" : "s"}.</p>
      </div>
      <div class="page-actions"><button class="btn btn-danger btn-sm" data-action="clear-activity">Clear Log</button></div>
    </div>

    <div class="filter-bar">
      <input type="text" id="act-search" placeholder="Search action, details…" value="${Utils.escapeHtml(st.search)}" style="min-width:220px;" />
      <select id="act-user">
        <option value="">All Users</option>
        ${users.map((u) => `<option value="${u.id}" ${st.filters.userId === u.id ? "selected" : ""}>${Utils.escapeHtml(u.fullName)}</option>`).join("")}
      </select>
      ${(st.filters.userId || st.search) ? `<button class="filter-chip-clear" id="act-clear-filters">Clear filters</button>` : ""}
    </div>

    ${total === 0 ? emptyState("◧", "No activity recorded yet", "Actions taken across the app will show up here.") : `
    <div class="table-wrap"><table>
      <thead><tr><th>When</th><th>User</th><th>Role</th><th>Action</th><th>Details</th></tr></thead>
      <tbody>
        ${pageRows.map((a) => `
          <tr>
            <td class="mono" style="white-space:nowrap;">${Utils.formatDate(a.at)}</td>
            <td>${Utils.escapeHtml(a.userName)}</td>
            <td>${a.role === "admin" ? '<span class="badge badge-medium"><span class="badge-dot"></span>Admin</span>' : a.role ? '<span class="badge badge-easy"><span class="badge-dot"></span>User</span>' : "—"}</td>
            <td>${Utils.escapeHtml(a.action)}</td>
            <td style="color:var(--ink-soft);">${Utils.escapeHtml(a.details) || "—"}</td>
          </tr>`).join("")}
      </tbody>
    </table></div>
    ${totalPages > 1 ? `
    <div style="display:flex; justify-content:center; gap:10px; align-items:center; margin-top:16px;">
      <button class="btn btn-secondary btn-sm" id="act-prev" ${st.page <= 1 ? "disabled" : ""}>← Prev</button>
      <span class="mono" style="font-size:12.5px; color:var(--ink-faint);">Page ${st.page} of ${totalPages}</span>
      <button class="btn btn-secondary btn-sm" id="act-next" ${st.page >= totalPages ? "disabled" : ""}>Next →</button>
    </div>` : ""}
    `}
  `;
};

/* ============================== ROUTER ============================== */
const Router = (() => {
  let currentRoute = { name: "dashboard", params: [] };
  const ADMIN_ONLY_ROUTES = new Set(["users", "activity", "data"]);

  function parseHash() {
    const hash = location.hash.replace(/^#\/?/, "");
    const parts = hash.split("/").filter(Boolean);
    if (parts.length === 0) return { name: "dashboard", params: [] };
    return { name: parts[0], params: parts.slice(1) };
  }

  function render() {
    currentRoute = parseHash();
    applySidebarPermissions();

    if (ADMIN_ONLY_ROUTES.has(currentRoute.name) && !Auth.isAdmin()) {
      Toast.show("That page is for administrators only.", "error");
      location.hash = "#/dashboard";
      return;
    }

    const root = document.getElementById("view-root");
    let html = "";
    switch (currentRoute.name) {
      case "dashboard": html = Views.dashboard(); break;
      case "quizzes": html = Views.quizzes(); break;
      case "quiz": html = Views.quizDetail(decodeURIComponent(currentRoute.params[0] || "")); break;
      case "questions": html = Views.questions(); break;
      case "chapter": html = Views.chapter(decodeURIComponent(currentRoute.params[0] || "")); break;
      case "missing": html = Views.missing(); break;
      case "statistics": html = Views.statistics(); break;
      case "data": html = Views.data(); break;
      case "tasks": html = Views.tasks(); break;
      case "users": html = Views.users(); break;
      case "activity": html = Views.activity(); break;
      default: html = Views.dashboard();
    }
    root.innerHTML = html;
    root.scrollTop = 0;
    window.scrollTo(0, 0);
    updateActiveNav();
    bindViewEvents();
  }

  function rerender() {
    render();
  }

  function updateActiveNav() {
    document.querySelectorAll(".nav-link").forEach((a) => a.classList.remove("active"));
    document.querySelectorAll(".chapter-nav-item").forEach((a) => a.classList.remove("active"));
    const routeKey = currentRoute.name === "quiz" ? "quizzes" : currentRoute.name;
    const link = document.querySelector(`.nav-link[data-route="${routeKey}"]`);
    if (link) link.classList.add("active");
    if (currentRoute.name === "chapter") {
      const chapterName = decodeURIComponent(currentRoute.params[0] || "");
      const item = document.querySelector(`.chapter-nav-item[data-chapter="${CSS.escape(chapterName)}"]`);
      if (item) item.classList.add("active");
    }
  }

  return { render, rerender, current: () => currentRoute };
})();

/* ============================== EVENT BINDING ============================== */
function bindViewEvents() {
  const root = document.getElementById("view-root");

  // Delegated actions
  root.addEventListener("click", handleActionClick);

  // Questions view specific controls
  const searchInput = document.getElementById("q-search");
  if (searchInput) {
    searchInput.addEventListener("input", Utils.debounce((e) => {
      QuestionsViewState.search = e.target.value;
      QuestionsViewState.page = 1;
      Router.rerender();
      document.getElementById("q-search").focus();
      const val = document.getElementById("q-search").value;
      document.getElementById("q-search").setSelectionRange(val.length, val.length);
    }, 250));
  }
  ["f-chapter", "f-quiz", "f-difficulty"].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.addEventListener("change", (e) => {
      const key = id === "f-chapter" ? "chapter" : id === "f-quiz" ? "quizId" : "difficulty";
      QuestionsViewState.filters[key] = e.target.value;
      QuestionsViewState.page = 1;
      Router.rerender();
    });
  });
  const clearBtn = document.getElementById("clear-filters");
  if (clearBtn) clearBtn.addEventListener("click", () => {
    QuestionsViewState.filters = { chapter: "", quizId: "", difficulty: "" };
    QuestionsViewState.search = "";
    QuestionsViewState.page = 1;
    Router.rerender();
  });
  document.querySelectorAll("th[data-sort]").forEach((th) => {
    th.addEventListener("click", () => {
      const key = th.dataset.sort;
      if (QuestionsViewState.sortKey === key) {
        QuestionsViewState.sortDir = QuestionsViewState.sortDir === "asc" ? "desc" : "asc";
      } else {
        QuestionsViewState.sortKey = key;
        QuestionsViewState.sortDir = "asc";
      }
      Router.rerender();
    });
  });
  const pgPrev = document.getElementById("pg-prev");
  const pgNext = document.getElementById("pg-next");
  if (pgPrev) pgPrev.addEventListener("click", () => { QuestionsViewState.page--; Router.rerender(); });
  if (pgNext) pgNext.addEventListener("click", () => { QuestionsViewState.page++; Router.rerender(); });

  // Activity view specific controls
  const actSearch = document.getElementById("act-search");
  if (actSearch) {
    actSearch.addEventListener("input", Utils.debounce((e) => {
      ActivityViewState.search = e.target.value;
      ActivityViewState.page = 1;
      Router.rerender();
      document.getElementById("act-search").focus();
      const val = document.getElementById("act-search").value;
      document.getElementById("act-search").setSelectionRange(val.length, val.length);
    }, 250));
  }
  const actUser = document.getElementById("act-user");
  if (actUser) actUser.addEventListener("change", (e) => {
    ActivityViewState.filters.userId = e.target.value;
    ActivityViewState.page = 1;
    Router.rerender();
  });
  const actClearBtn = document.getElementById("act-clear-filters");
  if (actClearBtn) actClearBtn.addEventListener("click", () => {
    ActivityViewState.filters = { userId: "" };
    ActivityViewState.search = "";
    ActivityViewState.page = 1;
    Router.rerender();
  });
  const actPrev = document.getElementById("act-prev");
  const actNext = document.getElementById("act-next");
  if (actPrev) actPrev.addEventListener("click", () => { ActivityViewState.page--; Router.rerender(); });
  if (actNext) actNext.addEventListener("click", () => { ActivityViewState.page++; Router.rerender(); });

  // Tasks view specific controls
  const taskSearch = document.getElementById("task-search");
  if (taskSearch) {
    taskSearch.addEventListener("input", Utils.debounce((e) => {
      TasksViewState.search = e.target.value;
      Router.rerender();
      const el = document.getElementById("task-search");
      if (el) {
        el.focus();
        el.setSelectionRange(el.value.length, el.value.length);
      }
    }, 250));
  }
  const taskStatusFilter = document.getElementById("task-status-filter");
  if (taskStatusFilter) {
    taskStatusFilter.addEventListener("change", (e) => {
      TasksViewState.statusFilter = e.target.value;
      Router.rerender();
    });
  }
  const taskPriorityFilter = document.getElementById("task-priority-filter");
  if (taskPriorityFilter) {
    taskPriorityFilter.addEventListener("change", (e) => {
      TasksViewState.priorityFilter = e.target.value;
      Router.rerender();
    });
  }
  const taskAssigneeFilter = document.getElementById("task-assignee-filter");
  if (taskAssigneeFilter) {
    taskAssigneeFilter.addEventListener("change", (e) => {
      TasksViewState.assigneeFilter = e.target.value;
      Router.rerender();
    });
  }
  bindIfExists("clear-task-filters", () => {
    TasksViewState.search = "";
    TasksViewState.statusFilter = "";
    TasksViewState.priorityFilter = "";
    TasksViewState.assigneeFilter = "";
    Router.rerender();
  });

  // Data view
  bindIfExists("export-json", () => {
    Utils.download(`ledger-export-${Date.now()}.json`, Data.exportJSON());
    Activity.log("Exported JSON data");
    Toast.show("Exported JSON.", "success");
  });
  bindIfExists("export-csv", () => {
    Utils.download(`ledger-questions-${Date.now()}.csv`, Data.exportCSV(), "text/csv");
    Activity.log("Exported CSV data");
    Toast.show("Exported CSV.", "success");
  });
  bindIfExists("backup-now", () => {
    Utils.download(`ledger-backup-${new Date().toISOString().slice(0, 10)}.json`, Data.exportJSON());
    Activity.log("Saved backup");
    Toast.show("Backup saved.", "success");
  });
  bindIfExists("import-json", () => document.getElementById("import-json-input").click());
  bindIfExists("restore-btn", () => document.getElementById("restore-input").click());
  const importInput = document.getElementById("import-json-input");
  if (importInput) importInput.addEventListener("change", (e) => handleFileImport(e, "Imported"));
  const restoreInput = document.getElementById("restore-input");
  if (restoreInput) restoreInput.addEventListener("change", (e) => handleFileImport(e, "Restored"));
  bindIfExists("reset-all", () => {
    Modal.confirmDialog({
      title: "Erase all data?",
      message: "This permanently deletes every quiz and question stored in this browser. This cannot be undone.",
      confirmLabel: "Erase Everything",
      onConfirm: () => {
        Store.setQuizzes([]);
        Store.setQuestions([]);
        Activity.log("Erased all quiz/question data");
        Toast.show("All data erased.", "success");
        Router.rerender();
        renderChapterNav();
      },
    });
  });
}

function bindIfExists(id, fn) {
  const el = document.getElementById(id);
  if (el) el.addEventListener("click", fn);
}

function handleFileImport(e, verb) {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      Data.importJSON(reader.result);
      Activity.log(verb === "Restored" ? "Restored backup" : "Imported data", file.name);
      Toast.show(`${verb} data successfully.`, "success");
      Router.rerender();
      renderChapterNav();
    } catch (err) {
      Toast.show("Could not read that file: " + err.message, "error");
    }
  };
  reader.readAsText(file);
  e.target.value = "";
}

function handleActionClick(e) {
  const el = e.target.closest("[data-action]");
  if (!el) return;
  const action = el.dataset.action;
  const id = el.dataset.id;

  switch (action) {
    case "new-task": {
      const me = Auth.currentUser();
      const isAdmin = Auth.isAdmin();
      TaskForm.open({ presetAssignee: isAdmin ? "" : (me ? me.fullName : "") });
      break;
    }
    case "open-user-detail": {
      e.stopPropagation();
      const me = Auth.currentUser();
      const isAdmin = Auth.isAdmin();
      if (!isAdmin && (!me || me.id !== id)) {
        Toast.show("You can only view your own user profile.", "error");
        break;
      }
      UserDetailModal.open(id);
      break;
    }
    case "open-user-by-name": {
      e.stopPropagation();
      const me = Auth.currentUser();
      const isAdmin = Auth.isAdmin();
      const userName = el.dataset.name;
      if (!isAdmin && (!me || me.fullName !== userName)) {
        Toast.show("You can only view your own user profile.", "error");
        break;
      }
      const user = Data.getUsers().find((u) => u.fullName === userName);
      if (user) {
        UserDetailModal.open(user.id);
      } else {
        Toast.show("User profile not found.", "info");
      }
      break;
    }
    case "new-user-task": {
      e.stopPropagation();
      const me = Auth.currentUser();
      const isAdmin = Auth.isAdmin();
      const targetUser = el.dataset.user;
      if (!isAdmin && (!me || targetUser !== me.fullName)) {
        Toast.show("You can only assign tasks to yourself.", "error");
        break;
      }
      TaskForm.open({ presetAssignee: targetUser });
      break;
    }
    case "edit-task": {
      e.stopPropagation();
      const me = Auth.currentUser();
      const isAdmin = Auth.isAdmin();
      const task = Data.getTaskById(id);
      if (task) {
        if (!isAdmin && (!me || (task.assignedTo !== me.fullName && task.createdBy !== me.fullName))) {
          Toast.show("You can only edit your own tasks.", "error");
          break;
        }
        TaskForm.open({ task });
      }
      break;
    }
    case "toggle-task-status": {
      e.stopPropagation();
      const updated = Data.toggleTaskStatus(id);
      if (updated) {
        Toast.show(updated.status === "Completed" ? "Task marked completed." : "Task marked pending.", "success");
        Router.rerender();
      }
      break;
    }
    case "delete-task": {
      e.stopPropagation();
      const me = Auth.currentUser();
      const isAdmin = Auth.isAdmin();
      const task = Data.getTaskById(id);
      if (!task) break;
      if (!isAdmin && (!me || (task.assignedTo !== me.fullName && task.createdBy !== me.fullName))) {
        Toast.show("You can only delete your own tasks.", "error");
        break;
      }
      Modal.confirmDialog({
        title: `Delete "${task.title}"?`,
        message: "This permanently deletes this task from the task ledger.",
        confirmLabel: "Delete Task",
        onConfirm: () => {
          Data.deleteTask(id);
          Activity.log("Deleted task", task.title);
          Toast.show("Task deleted.", "success");
          Router.rerender();
        },
      });
      break;
    }
    case "set-task-view": {
      e.stopPropagation();
      TasksViewState.viewMode = el.dataset.mode || "by-person";
      Router.rerender();
      break;
    }
    case "filter-task-member": {
      e.stopPropagation();
      TasksViewState.assigneeFilter = el.dataset.member || "";
      Router.rerender();
      break;
    }
    case "open-firebase-modal": {
      e.stopPropagation();
      if (!Auth.isAdmin()) {
        Toast.show("Only administrators can configure Cloud Sync.", "error");
        break;
      }
      FirebaseModal.open();
      break;
    }
    case "firebase-push-all": {
      e.stopPropagation();
      if (!Auth.isAdmin()) {
        Toast.show("Only administrators can push to Cloud.", "error");
        break;
      }
      Toast.show("Uploading data to Firebase…", "info");
      FirebaseSync.pushAll().then((counts) => {
        Toast.show(`Uploaded ${counts.quizzes} quizzes, ${counts.questions} questions, and ${counts.tasks} tasks to Firebase!`, "success");
        Activity.log("Uploaded all local data to Firebase");
      }).catch((err) => {
        Toast.show("Upload failed: " + err.message, "error");
      });
      break;
    }
    case "firebase-pull-all": {
      e.stopPropagation();
      if (!Auth.isAdmin()) {
        Toast.show("Only administrators can pull from Cloud.", "error");
        break;
      }
      Toast.show("Fetching latest data from Firebase…", "info");
      FirebaseSync.pullAll().then(() => {
        Toast.show("Synced data from Firebase!", "success");
        Activity.log("Pulled cloud data from Firebase");
        Router.rerender();
      }).catch((err) => {
        Toast.show("Download failed: " + err.message, "error");
      });
      break;
    }
    case "new-quiz":
      QuizForm.open();
      break;
    case "edit-quiz": {
      e.stopPropagation();
      const quiz = Data.getQuizById(id);
      if (quiz) QuizForm.open({ quiz });
      break;
    }
    case "delete-quiz": {
      e.stopPropagation();
      const quiz = Data.getQuizById(id);
      Modal.confirmDialog({
        title: `Delete "${quiz ? quiz.name : "quiz"}"?`,
        message: "This also deletes every question logged under this quiz. This cannot be undone.",
        confirmLabel: "Delete Quiz",
        onConfirm: () => {
          Data.deleteQuiz(id);
          Activity.log("Deleted quiz", quiz ? quiz.name : id);
          Toast.show("Quiz deleted.", "success");
          Router.rerender();
        },
      });
      break;
    }
    case "open-quiz":
      location.hash = `#/quiz/${id}`;
      break;
    case "new-question":
      QuestionForm.open({ presetQuizId: el.dataset.quizid || null });
      break;
    case "new-question-chapter":
      QuestionForm.open({});
      setTimeout(() => {
        const chapterSelect = document.getElementById("qf-chapter");
        if (chapterSelect) chapterSelect.value = el.dataset.chapter;
      }, 0);
      break;
    case "edit-question": {
      e.stopPropagation();
      const q = Data.getQuestions().find((x) => x.id === id);
      if (q) QuestionForm.open({ question: q });
      break;
    }
    case "delete-question": {
      e.stopPropagation();
      const question = Data.getQuestions().find((x) => x.id === id);
      Modal.confirmDialog({
        title: "Delete this question?",
        message: "This removes it from the quiz and the chapter ledger permanently.",
        confirmLabel: "Delete Question",
        onConfirm: () => {
          Data.deleteQuestion(id);
          Activity.log("Deleted question", question ? `Q${question.qNumInQuiz} · ${question.chapter}` : id);
          Toast.show("Question deleted.", "success");
          Router.rerender();
        },
      });
      break;
    }
    case "new-user":
      UserForm.open();
      break;
    case "edit-user": {
      e.stopPropagation();
      const user = Data.getUserById(id);
      if (user) UserForm.open({ user });
      break;
    }
    case "delete-user": {
      e.stopPropagation();
      const user = Data.getUserById(id);
      const me = Auth.currentUser();
      if (me && me.id === id) {
        Toast.show("You can't delete your own account while logged in.", "error");
        break;
      }
      Modal.confirmDialog({
        title: `Delete "${user ? user.fullName : "user"}"?`,
        message: "This permanently removes their account and login access. This cannot be undone.",
        confirmLabel: "Delete User",
        onConfirm: () => {
          Data.deleteUser(id);
          Activity.log("Deleted user", user ? user.fullName : id);
          Toast.show("User deleted.", "success");
          Router.rerender();
        },
      });
      break;
    }
    case "reset-password":
      e.stopPropagation();
      ResetPasswordForm.open(id);
      break;
    case "change-username":
      e.stopPropagation();
      ChangeUsernameForm.open(id);
      break;
    case "toggle-role": {
      e.stopPropagation();
      const user = Data.getUserById(id);
      if (!user) break;
      const me = Auth.currentUser();
      const next = user.role === "admin" ? "user" : "admin";
      if (me && me.id === id && next === "user") {
        Toast.show("You can't remove your own administrator access.", "error");
        break;
      }
      Modal.confirmDialog({
        title: next === "admin" ? `Promote ${user.fullName} to Administrator?` : `Remove admin privileges from ${user.fullName}?`,
        message: next === "admin" ? "They will gain full administrative access, including User Management." : "They will lose access to admin-only pages.",
        confirmLabel: next === "admin" ? "Promote" : "Remove Admin",
        danger: next !== "admin",
        onConfirm: () => {
          Data.updateUser(id, { role: next });
          Activity.log(next === "admin" ? "Promoted to Administrator" : "Removed Administrator role", user.fullName);
          Toast.show(next === "admin" ? "User promoted to administrator." : "Administrator privileges removed.", "success");
          Router.rerender();
        },
      });
      break;
    }
    case "toggle-status": {
      e.stopPropagation();
      const user = Data.getUserById(id);
      if (!user) break;
      const me = Auth.currentUser();
      if (me && me.id === id) {
        Toast.show("You can't deactivate your own account while logged in.", "error");
        break;
      }
      const next = user.status === "active" ? "inactive" : "active";
      Data.updateUser(id, { status: next });
      Activity.log(next === "active" ? "Activated user" : "Deactivated user", user.fullName);
      Toast.show(next === "active" ? "User activated." : "User deactivated.", "success");
      Router.rerender();
      break;
    }
    case "clear-activity": {
      Modal.confirmDialog({
        title: "Clear the activity log?",
        message: "This permanently erases the recorded history of user actions. This cannot be undone.",
        confirmLabel: "Clear Log",
        onConfirm: () => {
          Activity.clear();
          Toast.show("Activity log cleared.", "success");
          Router.rerender();
        },
      });
      break;
    }
  }
}

/* ============================== SIDEBAR / CHAPTER NAV ============================== */
function renderChapterNav() {
  const list = document.getElementById("chapter-nav-list");
  if (!list) return;
  const counts = Data.chapterCounts();
  list.innerHTML = CONFIG.CHAPTERS.map((c, i) => `
    <a href="#/chapter/${Utils.chapterSlug(c)}" class="chapter-nav-item" data-chapter="${Utils.escapeHtml(c)}">
      <span class="chapter-nav-num">${String(i + 1).padStart(2, "0")}</span>
      <span style="overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${Utils.escapeHtml(c)}</span>
      <span class="chapter-nav-dot" style="background:${counts[c] > 0 ? "var(--good)" : "var(--line-strong)"}"></span>
    </a>
  `).join("");
}

/* ============================== THEME ============================== */
function applyTheme(theme) {
  document.documentElement.classList.toggle("dark", theme === "dark");
  const icon = document.getElementById("theme-icon");
  const label = document.getElementById("theme-label");
  if (icon) icon.textContent = theme === "dark" ? "☀" : "☾";
  if (label) label.textContent = theme === "dark" ? "Light" : "Dark";
  Store.setTheme(theme);
}
function toggleTheme() {
  const next = Store.getTheme() === "dark" ? "light" : "dark";
  applyTheme(next);
  if (location.hash.includes("statistics")) Router.rerender();
}

/* ============================== SIDEBAR (mobile) ============================== */
function openSidebar() {
  document.getElementById("sidebar").classList.add("open");
  document.getElementById("sidebar-scrim").classList.add("show");
}
function closeSidebar() {
  document.getElementById("sidebar").classList.remove("open");
  document.getElementById("sidebar-scrim").classList.remove("show");
}

/* ============================== LOGIN SCREEN ============================== */
function renderLoginScreen(errorMsg = "") {
  const root = document.getElementById("login-screen-root");
  if (!root) return;
  root.innerHTML = `
    <div class="login-screen graph-bg">
      <div class="login-grid-bg"></div>
      <div class="login-card">
        <div class="login-mark">
          <svg width="30" height="30" viewBox="0 0 40 40" fill="none">
            <rect x="2" y="2" width="36" height="36" rx="4" stroke="currentColor" stroke-width="2.5"/>
            <path d="M10 14h20M10 20h20M10 26h12" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/>
          </svg>
        </div>
        <p class="login-eyebrow">Dr Bakr Team Malzama</p>
        <h1 class="login-title">Sign in</h1>
        <p class="login-sub">Log in to the math exam question bank.</p>
        <form id="login-form">
          <label class="field"><span>Username</span><input type="text" id="login-username" autocomplete="username" autofocus /></label>
          <label class="field"><span>Password</span><input type="password" id="login-password" autocomplete="current-password" /></label>
          ${errorMsg ? `<div class="login-error">${Utils.escapeHtml(errorMsg)}</div>` : ""}
          <button type="submit" class="btn btn-primary btn-block">Sign In</button>
        </form>
        <p class="login-footnote">Ask an administrator if you need an account.</p>
      </div>
    </div>
  `;
  document.getElementById("login-form").addEventListener("submit", (e) => {
    e.preventDefault();
    const username = document.getElementById("login-username").value.trim();
    const password = document.getElementById("login-password").value;
    const result = Auth.login(username, password);
    if (!result.ok) {
      renderLoginScreen(result.error);
      return;
    }
    root.innerHTML = "";
    document.getElementById("app-shell").style.display = "";
    boot();
  });
}

function showLoggedOut() {
  document.getElementById("app-shell").style.display = "none";
  renderLoginScreen();
}

/* ============================== SIDEBAR PERMISSIONS / USER CHIP ============================== */
function applySidebarPermissions() {
  const isAdmin = Auth.isAdmin();
  const adminGroup = document.getElementById("nav-group-admin");
  const dataGroup = document.getElementById("nav-group-data");
  const cloudSyncBtn = document.getElementById("cloud-sync-btn");
  if (adminGroup) adminGroup.classList.toggle("hidden", !isAdmin);
  if (dataGroup) dataGroup.classList.toggle("hidden", !isAdmin);
  if (cloudSyncBtn) cloudSyncBtn.style.display = isAdmin ? "" : "none";
}

function updateUserChip() {
  const user = Auth.currentUser();
  if (!user) return;
  const avatar = document.getElementById("sidebar-user-avatar");
  const nameEl = document.getElementById("sidebar-user-name");
  const roleEl = document.getElementById("sidebar-user-role");
  if (avatar) avatar.textContent = (user.fullName.trim().charAt(0) || "?").toUpperCase();
  if (nameEl) nameEl.textContent = user.fullName;
  if (roleEl) roleEl.textContent = user.role === "admin" ? "Administrator" : "User";
}

/* ============================== APP BOOTSTRAP ============================== */
function showApp() {
  applySidebarPermissions();
  updateUserChip();
  renderChapterNav();
  Router.render();
  if (typeof TaskNotifier !== "undefined") {
    TaskNotifier.checkForNewTasks();
  }
}

function boot() {
  initGlobalChrome();
  showApp();
}

function initGlobalChrome() {
  document.getElementById("menu-btn").addEventListener("click", openSidebar);
  document.getElementById("sidebar-close").addEventListener("click", closeSidebar);
  document.getElementById("sidebar-scrim").addEventListener("click", closeSidebar);
  document.querySelectorAll(".nav-link, .chapter-nav-item").forEach((a) => {
    a.addEventListener("click", () => closeSidebar());
  });

  document.getElementById("logout-btn").addEventListener("click", () => {
    Auth.logout();
    Toast.show("Signed out.", "success");
    showLoggedOut();
  });

  document.getElementById("theme-toggle").addEventListener("click", toggleTheme);

  document.getElementById("quick-add-btn").addEventListener("click", () => QuestionForm.open());

  const cloudSyncBtn = document.getElementById("cloud-sync-btn");
  if (cloudSyncBtn) {
    cloudSyncBtn.addEventListener("click", () => FirebaseModal.open());
  }

  const notifBellBtn = document.getElementById("notif-bell-btn");
  if (notifBellBtn) {
    notifBellBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      TaskNotifier.toggleDropdown();
    });
  }
  document.addEventListener("click", (e) => {
    if (!e.target.closest("#notif-wrapper")) {
      TaskNotifier.closeDropdown();
    }
  });

  const globalSearch = document.getElementById("global-search");
  globalSearch.addEventListener("input", Utils.debounce((e) => {
    const term = e.target.value.trim();
    if (!term) return;
    // Jump to All Questions with this search term applied.
    QuestionsViewState.search = term;
    QuestionsViewState.page = 1;
    if (Router.current().name !== "questions") {
      location.hash = "#/questions";
    } else {
      Router.rerender();
      document.getElementById("q-search").value = term;
    }
  }, 300));

  window.addEventListener("hashchange", Router.render);

  document.addEventListener("keydown", (e) => {
    const tag = (e.target.tagName || "").toLowerCase();
    const typing = tag === "input" || tag === "textarea" || tag === "select";
    if (e.key === "/" && !typing) {
      e.preventDefault();
      document.getElementById("global-search").focus();
    } else if ((e.key === "n" || e.key === "N") && !typing) {
      QuestionForm.open();
    } else if ((e.key === "t" || e.key === "T") && !typing) {
      toggleTheme();
    }
  });

  window.addEventListener("resize", () => {
    if (window.innerWidth > 860) closeSidebar();
  });
}

document.addEventListener("DOMContentLoaded", async () => {
  await Persist.init(); // restore anything localStorage lost, before the app reads data
  window.addEventListener("pagehide", Persist.flushAll);
  window.addEventListener("storage", (e) => {
    // Keep multiple open tabs in sync so one tab can't overwrite another with stale data.
    if (e.key && Object.values(Store.KEYS).includes(e.key) && e.newValue !== null) Store._hydrate(e.key, e.newValue);
  });
  applyTheme(Store.getTheme());
  Auth.ensureSeedUsers();

  // Initialize Firebase Cloud sync if credentials are present
  if (typeof FirebaseSync !== "undefined") {
    FirebaseSync.updateStatusUI();
    FirebaseSync.init().catch((err) => console.warn("Firebase auto-init error:", err));
  }

  if (Auth.currentUser()) {
    document.getElementById("app-shell").style.display = "";
    boot();
  } else {
    showLoggedOut();
  }
});
