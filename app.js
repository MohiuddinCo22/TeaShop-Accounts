import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getAuth, signInWithEmailAndPassword, onAuthStateChanged, signOut
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  getFirestore, collection, addDoc, doc, updateDoc, deleteDoc,
  onSnapshot, query, orderBy, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { firebaseConfig } from "./firebase-config.js";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const CATEGORIES = {
  income: ["চা বিক্রি", "সিগারেট বিক্রি", "অন্যান্য বিক্রি"],
  expense: ["মালামাল ক্রয় (চা)", "মালামাল ক্রয় (সিগারেট)", "দোকান ভাড়া", "বিদ্যুৎ বিল", "কর্মচারী বেতন", "অন্যান্য খরচ"]
};

const BN_DIGITS = { "0":"০","1":"১","2":"২","3":"৩","4":"৪","5":"৫","6":"৬","7":"৭","8":"৮","9":"৯" };
const BN_MONTHS = ["জানুয়ারি","ফেব্রুয়ারি","মার্চ","এপ্রিল","মে","জুন","জুলাই","আগস্ট","সেপ্টেম্বর","অক্টোবর","নভেম্বর","ডিসেম্বর"];

function toBnDigits(str) {
  return String(str).replace(/[0-9]/g, d => BN_DIGITS[d]);
}

function formatTaka(amount) {
  const rounded = Math.round(amount);
  const grouped = Math.abs(rounded).toLocaleString("en-IN");
  const sign = rounded < 0 ? "-" : "";
  return "৳" + sign + toBnDigits(grouped);
}

function todayStr() {
  const d = new Date();
  return d.toISOString().slice(0, 10);
}

function monthKey(dateStr) {
  return dateStr.slice(0, 7); // YYYY-MM
}

function formatBnDate(dateStr) {
  const [y, m, d] = dateStr.split("-").map(Number);
  return `${toBnDigits(d)} ${BN_MONTHS[m - 1]}, ${toBnDigits(y)}`;
}

function formatBnMonthLabel(key) {
  const [y, m] = key.split("-").map(Number);
  return `${BN_MONTHS[m - 1]} ${toBnDigits(y)}`;
}

let entries = [];
let editingId = null;
let currentType = "income";

/* ---------- DOM refs ---------- */
const loginScreen = document.getElementById("login-screen");
const appScreen = document.getElementById("app-screen");
const loginForm = document.getElementById("login-form");
const loginError = document.getElementById("login-error");
const logoutBtn = document.getElementById("logout-btn");
const headerDate = document.getElementById("header-date");

const views = {
  "view-dashboard": document.getElementById("view-dashboard"),
  "view-add": document.getElementById("view-add"),
  "view-history": document.getElementById("view-history")
};
const tabButtons = document.querySelectorAll(".tab-btn");
const navButtons = document.querySelectorAll("[data-nav]");

const entryForm = document.getElementById("entry-form");
const entryCategory = document.getElementById("entry-category");
const entryAmount = document.getElementById("entry-amount");
const entryDate = document.getElementById("entry-date");
const entryNote = document.getElementById("entry-note");
const entrySubmitBtn = document.getElementById("entry-submit-btn");
const cancelEditBtn = document.getElementById("cancel-edit-btn");
const deleteEntryBtn = document.getElementById("delete-entry-btn");
const entryMsg = document.getElementById("entry-msg");
const typeButtons = document.querySelectorAll(".type-btn");

const filterMonth = document.getElementById("filter-month");
const filterType = document.getElementById("filter-type");
const historyList = document.getElementById("history-list");
const historyEmpty = document.getElementById("history-empty");

const confirmModal = document.getElementById("confirm-modal");
const confirmCancel = document.getElementById("confirm-cancel");
const confirmOk = document.getElementById("confirm-ok");
let pendingDeleteId = null;

/* ---------- Auth ---------- */
onAuthStateChanged(auth, (user) => {
  if (user) {
    loginScreen.hidden = true;
    appScreen.hidden = false;
    headerDate.textContent = formatBnDate(todayStr());
    listenToEntries();
  } else {
    appScreen.hidden = true;
    loginScreen.hidden = false;
  }
});

loginForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  loginError.hidden = true;
  const email = document.getElementById("login-email").value.trim();
  const pass = document.getElementById("login-pass").value;
  try {
    await signInWithEmailAndPassword(auth, email, pass);
  } catch (err) {
    loginError.textContent = "ইমেইল বা পাসওয়ার্ড সঠিক নয়।";
    loginError.hidden = false;
  }
});

logoutBtn.addEventListener("click", () => signOut(auth));

/* ---------- Navigation ---------- */
function showView(id) {
  Object.entries(views).forEach(([key, el]) => { el.hidden = key !== id; });
  tabButtons.forEach(btn => btn.classList.toggle("active", btn.dataset.nav === id));
  if (id !== "view-add") resetForm();
  if (id === "view-history") renderHistory();
}

navButtons.forEach(btn => {
  btn.addEventListener("click", () => showView(btn.dataset.nav));
});

/* ---------- Entry form ---------- */
function setType(type) {
  currentType = type;
  typeButtons.forEach(b => b.classList.toggle("active", b.dataset.type === type));
  entryCategory.innerHTML = CATEGORIES[type]
    .map(c => `<option value="${c}">${c}</option>`).join("");
}

typeButtons.forEach(btn => {
  btn.addEventListener("click", () => setType(btn.dataset.type));
});

function resetForm() {
  editingId = null;
  entryForm.reset();
  setType("income");
  entryDate.value = todayStr();
  entrySubmitBtn.textContent = "সংরক্ষণ করুন";
  cancelEditBtn.hidden = true;
  deleteEntryBtn.hidden = true;
  entryMsg.hidden = true;
}

cancelEditBtn.addEventListener("click", () => showView("view-dashboard"));

entryForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const data = {
    type: currentType,
    category: entryCategory.value,
    amount: parseFloat(entryAmount.value),
    date: entryDate.value,
    note: entryNote.value.trim()
  };
  if (!data.amount || data.amount <= 0) return;

  try {
    if (editingId) {
      await updateDoc(doc(db, "entries", editingId), data);
    } else {
      await addDoc(collection(db, "entries"), { ...data, createdAt: serverTimestamp() });
    }
    entryMsg.textContent = "সংরক্ষিত হয়েছে।";
    entryMsg.hidden = false;
    setTimeout(() => showView("view-dashboard"), 700);
  } catch (err) {
    entryMsg.textContent = "সমস্যা হয়েছে, আবার চেষ্টা করুন।";
    entryMsg.hidden = false;
  }
});

function openEdit(entry) {
  editingId = entry.id;
  setType(entry.type);
  entryCategory.value = entry.category;
  entryAmount.value = entry.amount;
  entryDate.value = entry.date;
  entryNote.value = entry.note || "";
  entrySubmitBtn.textContent = "হালনাগাদ করুন";
  cancelEditBtn.hidden = false;
  deleteEntryBtn.hidden = false;
  entryMsg.hidden = true;
  showViewRaw("view-add");
}

// switches view without resetting the form (used only right after populating edit data)
function showViewRaw(id) {
  Object.entries(views).forEach(([key, el]) => { el.hidden = key !== id; });
  tabButtons.forEach(btn => btn.classList.toggle("active", btn.dataset.nav === id));
}

deleteEntryBtn.addEventListener("click", () => {
  if (editingId) askDelete(editingId);
});

/* ---------- Delete confirm ---------- */
function askDelete(id) {
  pendingDeleteId = id;
  confirmModal.hidden = false;
}

confirmCancel.addEventListener("click", () => {
  confirmModal.hidden = true;
  pendingDeleteId = null;
});

confirmOk.addEventListener("click", async () => {
  if (pendingDeleteId) {
    await deleteDoc(doc(db, "entries", pendingDeleteId));
  }
  confirmModal.hidden = true;
  pendingDeleteId = null;
  if (!views["view-add"].hidden) showView("view-dashboard");
});

/* ---------- Data listening ---------- */
function listenToEntries() {
  const q = query(collection(db, "entries"), orderBy("date", "desc"));
  onSnapshot(q, (snap) => {
    entries = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    renderDashboard();
    populateMonthFilter();
    renderHistory();
  });
}

/* ---------- Rendering: dashboard ---------- */
function renderDashboard() {
  const today = todayStr();
  const thisMonth = monthKey(today);

  const todayEntries = entries.filter(e => e.date === today);
  const monthEntries = entries.filter(e => monthKey(e.date) === thisMonth);

  const sum = (list, type) => list.filter(e => e.type === type).reduce((s, e) => s + e.amount, 0);

  const tIncome = sum(todayEntries, "income");
  const tExpense = sum(todayEntries, "expense");
  const mIncome = sum(monthEntries, "income");
  const mExpense = sum(monthEntries, "expense");

  document.getElementById("today-income").textContent = formatTaka(tIncome);
  document.getElementById("today-expense").textContent = formatTaka(tExpense);
  document.getElementById("month-income").textContent = formatTaka(mIncome);
  document.getElementById("month-expense").textContent = formatTaka(mExpense);

  const tProfit = document.getElementById("today-profit");
  tProfit.textContent = formatTaka(tIncome - tExpense);
  tProfit.classList.toggle("negative", tIncome - tExpense < 0);

  const mProfit = document.getElementById("month-profit");
  mProfit.textContent = formatTaka(mIncome - mExpense);
  mProfit.classList.toggle("negative", mIncome - mExpense < 0);

  renderCategoryBars(monthEntries);
  renderRecentList();
}

function renderCategoryBars(monthEntries) {
  const wrap = document.getElementById("category-bars");
  const incomeByCategory = {};
  CATEGORIES.income.forEach(c => incomeByCategory[c] = 0);
  monthEntries.filter(e => e.type === "income").forEach(e => {
    incomeByCategory[e.category] = (incomeByCategory[e.category] || 0) + e.amount;
  });

  const max = Math.max(1, ...Object.values(incomeByCategory));
  wrap.innerHTML = Object.entries(incomeByCategory).map(([cat, amt]) => `
    <div class="bar-row">
      <span>${cat}</span>
      <div class="bar-track"><div class="bar-fill" style="width:${(amt / max) * 100}%"></div></div>
      <span class="bar-amount">${formatTaka(amt)}</span>
    </div>
  `).join("");
}

function renderRecentList() {
  const list = document.getElementById("recent-list");
  const recent = entries.slice(0, 5);
  if (recent.length === 0) {
    list.innerHTML = `<p class="muted-text">এখনো কোনো এন্ট্রি নেই।</p>`;
    return;
  }
  list.innerHTML = recent.map(entryRowHtml).join("");
  attachRowHandlers(list, recent);
}

/* ---------- Rendering: history ---------- */
function populateMonthFilter() {
  const months = Array.from(new Set(entries.map(e => monthKey(e.date)))).sort().reverse();
  const current = monthKey(todayStr());
  if (!months.includes(current)) months.unshift(current);
  const prevValue = filterMonth.value;
  filterMonth.innerHTML = months.map(m => `<option value="${m}">${formatBnMonthLabel(m)}</option>`).join("");
  filterMonth.value = months.includes(prevValue) ? prevValue : current;
}

filterMonth.addEventListener("change", renderHistory);
filterType.addEventListener("change", renderHistory);

function renderHistory() {
  const month = filterMonth.value || monthKey(todayStr());
  const type = filterType.value;

  const filtered = entries.filter(e => {
    const monthOk = monthKey(e.date) === month;
    const typeOk = type === "all" || e.type === type;
    return monthOk && typeOk;
  });

  if (filtered.length === 0) {
    historyList.innerHTML = "";
    historyEmpty.hidden = false;
    return;
  }
  historyEmpty.hidden = true;
  historyList.innerHTML = filtered.map(entryRowHtml).join("");
  attachRowHandlers(historyList, filtered);
}

function entryRowHtml(e) {
  const sign = e.type === "income" ? "+" : "-";
  return `
    <div class="entry-row" data-id="${e.id}">
      <div class="entry-left">
        <span class="entry-category">${e.category}</span>
        <span class="entry-meta">${formatBnDate(e.date)}${e.note ? " · " + e.note : ""}</span>
      </div>
      <span class="entry-amount ${e.type}">${sign}${formatTaka(e.amount)}</span>
    </div>
  `;
}

function attachRowHandlers(container, list) {
  container.querySelectorAll(".entry-row").forEach(row => {
    row.addEventListener("click", () => {
      const entry = list.find(e => e.id === row.dataset.id);
      if (entry) openEdit(entry);
    });
  });
}

/* ---------- Init ---------- */
resetForm();
