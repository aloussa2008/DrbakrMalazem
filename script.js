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
  };

  function _get(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      if (raw === null) return fallback;
      return JSON.parse(raw);
    } catch (e) {
      console.error("Store read failed for", key, e);
      return fallback;
    }
  }
  function _set(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (e) {
      console.error("Store write failed for", key, e);
      Toast.show("Storage is full or unavailable — changes may not be saved.", "error");
      return false;
    }
  }

  return {
    getQuizzes: () => _get(KEYS.quizzes, []),
    setQuizzes: (v) => _set(KEYS.quizzes, v),
    getQuestions: () => _get(KEYS.questions, []),
    setQuestions: (v) => _set(KEYS.questions, v),
    getTheme: () => _get(KEYS.theme, "light"),
    setTheme: (v) => _set(KEYS.theme, v),
    getUsers: () => _get(KEYS.users, []),
    setUsers: (v) => _set(KEYS.users, v),
    getSession: () => _get(KEYS.session, null),
    setSession: (v) => _set(KEYS.session, v),
    getActivity: () => _get(KEYS.activity, []),
    setActivity: (v) => _set(KEYS.activity, v),
    KEYS,
  };
})();

/* ============================== ACTIVITY LOG ============================== */
const Activity = (() => {
  const MAX_ENTRIES = 500;

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
    if (entries.length > MAX_ENTRIES) entries.length = MAX_ENTRIES;
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
  function show(message, type = "info", ms = 3200) {
    const stack = document.getElementById("toast-stack");
    if (!stack) return;
    const el = document.createElement("div");
    el.className = `toast ${type}`;
    el.textContent = message;
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

  function open(innerHtml, { wide = false, onClose = null } = {}) {
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
    const existing = Store.getUsers();
    if (existing && existing.length) return;
    const seeded = CONFIG.DEFAULT_USERS.map((u) => ({
      id: Utils.uid("user"),
      fullName: u.fullName,
      username: u.username,
      password: u.password,
      role: u.role,
      status: "active",
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
    return { ok: true, user: updated };
  }

  function logout() {
    const user = currentUser();
    Store.setSession(null);
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
    return quiz;
  }
  function updateQuiz(id, patch) {
    const quizzes = Store.getQuizzes();
    const idx = quizzes.findIndex((q) => q.id === id);
    if (idx === -1) return null;
    quizzes[idx] = { ...quizzes[idx], ...patch };
    Store.setQuizzes(quizzes);
    return quizzes[idx];
  }
  function deleteQuiz(id) {
    Store.setQuizzes(Store.getQuizzes().filter((q) => q.id !== id));
    Store.setQuestions(Store.getQuestions().filter((q) => q.quizId !== id));
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
      notes: (payload.notes || "").trim(),
      dateAdded: Utils.todayISO(),
    };
    questions.push(question);
    Store.setQuestions(questions);
    return question;
  }
  function updateQuestion(id, patch) {
    const questions = Store.getQuestions();
    const idx = questions.findIndex((q) => q.id === id);
    if (idx === -1) return null;
    const merged = { ...questions[idx], ...patch };
    if (patch.qNumInQuiz !== undefined) merged.qNumInQuiz = Number(patch.qNumInQuiz);
    if (patch.chapterQNum !== undefined) merged.chapterQNum = Number(patch.chapterQNum);
    questions[idx] = merged;
    Store.setQuestions(questions);
    return merged;
  }
  function deleteQuestion(id) {
    Store.setQuestions(Store.getQuestions().filter((q) => q.id !== id));
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
  function createUser({ fullName, username, password, role }) {
    const users = Store.getUsers();
    const user = {
      id: Utils.uid("user"),
      fullName: fullName.trim(),
      username: username.trim(),
      password: password.trim(),
      role: role === "admin" ? "admin" : "user",
      status: "active",
      lastLogin: null,
      createdAt: Utils.todayISO(),
    };
    users.push(user);
    Store.setUsers(users);
    return user;
  }
  function updateUser(id, patch) {
    const users = Store.getUsers();
    const idx = users.findIndex((u) => u.id === id);
    if (idx === -1) return null;
    users[idx] = { ...users[idx], ...patch };
    Store.setUsers(users);
    return users[idx];
  }
  function deleteUser(id) {
    Store.setUsers(Store.getUsers().filter((u) => u.id !== id));
  }
  function exportCSV() {
    const quizzesById = {};
    Store.getQuizzes().forEach((qz) => (quizzesById[qz.id] = qz));
    const rows = [["Quiz", "Question # in Quiz", "Chapter", "Chapter Question #", "Difficulty", "Notes", "Date Added"]];
    Store.getQuestions().forEach((q) => {
      rows.push([
        quizzesById[q.quizId] ? quizzesById[q.quizId].name : "(deleted quiz)",
        q.qNumInQuiz,
        q.chapter,
        q.chapterQNum,
        q.difficulty,
        q.notes,
        Utils.formatDate(q.dateAdded),
      ]);
    });
    return rows.map((r) => r.map(Utils.csvEscape).join(",")).join("\n");
  }

  return {
    getQuizzes, getQuizById, createQuiz, updateQuiz, deleteQuiz,
    getQuestions, getQuestionsForQuiz, getQuestionsForChapter,
    validateQuestion, createQuestion, updateQuestion, deleteQuestion,
    quizStats, chapterCounts, globalStats, search,
    exportJSON, importJSON, exportCSV,
    getUsers, getUserById, validateUser, createUser, updateUser, deleteUser,
  };
})();

/* ============================== CHARTS (canvas, no deps) ============================== */
const Charts = (() => {
  function cssVar(name) {
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  }
  const palette = () => [
    cssVar("--accent"), cssVar("--good"), cssVar("--gold"),
    "#7C8AA5", "#9B6B9E", "#4C8CA8", "#B0785C", "#6A8F6B",
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
    const q = question || { quizId: presetQuizId || "", qNumInQuiz: "", chapter: "", chapterQNum: "", difficulty: "", notes: "" };

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
    `, { wide: false });

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
        Activity.log("Edited question", `Q${payload.qNumInQuiz} · ${payload.chapter}`);
        Toast.show("Question updated.", "success");
      } else {
        Data.createQuestion(payload);
        Activity.log("Added question", `Q${payload.qNumInQuiz} · ${payload.chapter}`);
        Toast.show("Question added.", "success");
      }
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
    `);
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
    const u = user || { fullName: "", username: "", password: "", role: "user" };
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
        </form>
      </div>
      <div class="modal-foot">
        <button class="btn btn-secondary" id="uf-cancel">Cancel</button>
        <button class="btn btn-primary" id="uf-save">${isEdit ? "Save Changes" : "Create User"}</button>
      </div>
    `);
    document.getElementById("uf-close").addEventListener("click", Modal.close);
    document.getElementById("uf-cancel").addEventListener("click", Modal.close);
    document.getElementById("uf-save").addEventListener("click", () => {
      const payload = {
        fullName: document.getElementById("uf-fullName").value,
        username: document.getElementById("uf-username").value,
        password: document.getElementById("uf-password").value,
        role: document.getElementById("uf-role").value,
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
    `);
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
    `);
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
      Modal.close();
      Router.rerender();
    });
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
        <thead><tr><th class="num">Q#</th><th>Chapter</th><th class="num">Ch. Q#</th><th>Difficulty</th><th>Notes</th><th></th></tr></thead>
        <tbody>
          ${questions.map((q) => `
            <tr>
              <td class="num">Q${q.qNumInQuiz}</td>
              <td><a href="#/chapter/${Utils.chapterSlug(q.chapter)}" class="chapter-chip">${Utils.escapeHtml(q.chapter)}</a></td>
              <td class="num">#${q.chapterQNum}</td>
              <td>${diffBadge(q.difficulty)}</td>
              <td style="color:var(--ink-soft); max-width:220px;">${Utils.escapeHtml(q.notes) || "—"}</td>
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
    rows = rows.filter((q) => [q.quizName, q.qNumInQuiz, q.chapter, q.chapterQNum, q.difficulty, q.notes].join(" ").toLowerCase().includes(term));
  }
  if (st.filters.chapter) rows = rows.filter((q) => q.chapter === st.filters.chapter);
  if (st.filters.quizId) rows = rows.filter((q) => q.quizId === st.filters.quizId);
  if (st.filters.difficulty) rows = rows.filter((q) => q.difficulty === st.filters.difficulty);

  rows.sort((a, b) => {
    let av = a[st.sortKey], bv = b[st.sortKey];
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
      <input type="text" id="q-search" placeholder="Search notes, chapter, quiz…" value="${Utils.escapeHtml(st.search)}" style="min-width:220px;" />
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
              <td>${diffBadge(q.difficulty)}</td>
              <td style="color:var(--ink-soft); max-width:240px;">${Utils.escapeHtml(q.notes) || "—"}</td>
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
      <thead><tr><th class="num">Chapter Q#</th><th>Quiz</th><th class="num">Quiz Q#</th><th>Difficulty</th><th>Notes</th><th></th></tr></thead>
      <tbody>
        ${questions.map((q) => `
          <tr>
            <td class="num">#${q.chapterQNum}</td>
            <td><a href="#/quiz/${q.quizId}">${quizzesById[q.quizId] ? Utils.escapeHtml(quizzesById[q.quizId].name) : "(deleted quiz)"}</a></td>
            <td class="num">Q${q.qNumInQuiz}</td>
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
  return `
    <div class="page-head">
      <div>
        <p class="page-eyebrow">Data</p>
        <h1 class="page-title">Import / Export</h1>
        <p class="page-sub">Everything lives in this browser's local storage — back it up regularly and share it with the group.</p>
      </div>
    </div>

    <div class="card-grid">
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

Views.users = function () {
  const users = Data.getUsers();
  return `
    <div class="page-head">
      <div>
        <p class="page-eyebrow">Admin</p>
        <h1 class="page-title">User Management</h1>
        <p class="page-sub">${users.length} account${users.length === 1 ? "" : "s"} · administrators only.</p>
      </div>
      <div class="page-actions"><button class="btn btn-primary" data-action="new-user">+ Add User</button></div>
    </div>
    ${users.length === 0 ? emptyState("☺", "No users yet", "Create the first account to get started.") : `
    <div class="table-wrap"><table>
      <thead><tr>
        <th>Name</th><th>Username</th><th>Role</th><th>Password</th><th>Last Login</th><th>Status</th><th></th>
      </tr></thead>
      <tbody>${users.map(userRowHtml).join("")}</tbody>
    </table></div>`}
  `;
};

function userRowHtml(u) {
  const me = Auth.currentUser();
  const isSelf = !!(me && me.id === u.id);
  return `
    <tr>
      <td>${Utils.escapeHtml(u.fullName)}</td>
      <td class="mono">${Utils.escapeHtml(u.username)}</td>
      <td>${u.role === "admin"
        ? '<span class="badge badge-medium"><span class="badge-dot"></span>Administrator</span>'
        : '<span class="badge badge-easy"><span class="badge-dot"></span>User</span>'}</td>
      <td class="mono">${Utils.escapeHtml(u.password)}</td>
      <td class="mono">${u.lastLogin ? Utils.formatDate(u.lastLogin) : "Never"}</td>
      <td>${u.status === "active"
        ? '<span class="badge badge-easy"><span class="badge-dot"></span>Active</span>'
        : '<span class="badge badge-hard"><span class="badge-dot"></span>Inactive</span>'}</td>
      <td class="row-actions">
        <button class="icon-btn" data-action="edit-user" data-id="${u.id}" title="Edit">✎</button>
        <button class="icon-btn" data-action="reset-password" data-id="${u.id}" title="Reset Password">⚿</button>
        <button class="icon-btn" data-action="change-username" data-id="${u.id}" title="Change Username">@</button>
        <button class="icon-btn" data-action="toggle-role" data-id="${u.id}" title="${u.role === "admin" ? "Remove Admin Privileges" : "Promote to Administrator"}" ${isSelf && u.role === "admin" ? "disabled" : ""}>${u.role === "admin" ? "▾" : "▴"}</button>
        <button class="icon-btn" data-action="toggle-status" data-id="${u.id}" title="${u.status === "active" ? "Deactivate User" : "Activate User"}" ${isSelf ? "disabled" : ""}>${u.status === "active" ? "⏾" : "⏽"}</button>
        <button class="icon-btn" data-action="delete-user" data-id="${u.id}" title="Delete" ${isSelf ? "disabled" : ""}>🗑</button>
      </td>
    </tr>
  `;
}

Views.activity = function () {
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
  const ADMIN_ONLY_ROUTES = new Set(["users", "data", "activity"]);

  function parseHash() {
    const hash = location.hash.replace(/^#\/?/, "");
    const parts = hash.split("/").filter(Boolean);
    if (parts.length === 0) return { name: "dashboard", params: [] };
    return { name: parts[0], params: parts.slice(1) };
  }

  function render() {
    currentRoute = parseHash();

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
      const q = Data.getQuestions().find((x) => x.id === id);
      if (q) QuestionForm.open({ question: q });
      break;
    }
    case "delete-question": {
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
      const user = Data.getUserById(id);
      if (user) UserForm.open({ user });
      break;
    }
    case "delete-user": {
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
      ResetPasswordForm.open(id);
      break;
    case "change-username":
      ChangeUsernameForm.open(id);
      break;
    case "toggle-role": {
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
  if (adminGroup) adminGroup.classList.toggle("hidden", !isAdmin);
  if (dataGroup) dataGroup.classList.toggle("hidden", !isAdmin);
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

document.addEventListener("DOMContentLoaded", () => {
  applyTheme(Store.getTheme());
  Auth.ensureSeedUsers();
  if (Auth.currentUser()) {
    document.getElementById("app-shell").style.display = "";
    boot();
  } else {
    showLoggedOut();
  }
});
