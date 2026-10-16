const FALLBACK_DATABASE = [
  {
    id: 1,
    title: "Öz",
    aliases: ["öz", "oz", "öz nedir", "oz nedir", "öz ne", "öz hakkında"],
    category: "Madde",
    description: "Öz, Zet dünyasında belli kişilerin (büyücülerin) oral yolla tüketerek çeşitli yetenekler ve teknikler kullanmasını sağlayan özel bir gıdadır.",
    image: "/images/oz.png",
    firstAppearance: "Bilinmiyor",
    location: "Yolen",
    danger: "Orta",
    race: "",
    age: "",
    occupation: "",
    related: ["Büyücü"]
  },
  {
    id: 2,
    title: "Zet",
    aliases: ["zet", "zet nedir", "dünya", "zet dünyası"],
    category: "Dünya",
    description: "Zet, hikâyelerin geçtiği fantastik dünyanın adıdır.",
    image: "/images/zet.png",
    firstAppearance: "Bilinmiyor",
    location: "Evren",
    danger: "Değişken",
    race: "",
    age: "",
    occupation: "",
    related: ["Öz", "Büyücü"]
  },
  {
    id: 3,
    title: "Büyücü/Cadı",
    aliases: ["büyücü/cadı", "buyucu", "mage", "büyücü nedir", "büyücü kimdir", "büyücü", "cadı"],
    category: "Kavram",
    description: "Öz kullanabilen ve çeşitli teknikleri öğrenebilen kişilere büyücü veya cadı denir.",
    image: "/images/buyucu.png",
    firstAppearance: "Bölüm 1",
    location: "Yolen",
    danger: "Değişken",
    race: "İnsan",
    age: "",
    occupation: "Büyücü",
    related: ["Öz"]
  }
];

const DATABASE_URL = "https://raw.githubusercontent.com/roku02379-web/Zet-Codex/main/database.json";
const VERSION_URL = "https://raw.githubusercontent.com/roku02379-web/Zet-Codex/main/version.json";
const SECRETS_URL = "https://raw.githubusercontent.com/roku02379-web/Zet-Codex/main/secrets.dat";
const APP_CODE_VERSION = 2;
const SECRET_KEY = "ZET::YOLEN::ARCANE::CODEX::2026";
const MAX_HISTORY = 20;
const MAX_BACKUPS = 20;

const KEYS = {
  publicDb: "zetcodex_database_public_v2",
  secrets: "zetcodex_secrets_blob_v2",
  version: "zetcodex_version",
  discovered: "zetcodex_discovered_v2",
  favorites: "zetcodex_favorites_v2",
  recent: "zetcodex_recent_v2",
  undo: "zetcodex_undo_v2",
  redo: "zetcodex_redo_v2",
  backups: "zetcodex_backups_v2",
  legacyDb: "zetcodex_database",
  legacyFavorites: "zetcodex_favorites",
  legacyRecent: "zetcodex_recent"
};

const state = {
  publicDb: [],
  secretDb: [],
  discovered: new Set(),
  favorites: new Set(),
  recent: [],
  result: null,
  notFound: false,
  view: "home",
  archiveCategory: "",
  dmMode: false,
  dmLogin: false,
  notification: "",
  notificationTimer: null,
  discovery: null,
  editId: null,
  dmFilter: "",
  undo: [],
  redo: [],
  backups: []
};

function storageJson(key, fallback) {
  try {
    const value = localStorage.getItem(key);
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
}

function normalizeText(value) {
  return String(value ?? "")
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .toLocaleLowerCase("tr-TR")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ı/g, "i")
    .replace(/ş/g, "s")
    .replace(/ğ/g, "g")
    .replace(/ü/g, "u")
    .replace(/ö/g, "o")
    .replace(/ç/g, "c")
    .replace(/[?.,!;:()[\]{}'"`´’“”/\\|_-]+/g, " ")
    .replace(/\b(nedir|kimdir|hakkinda|ne demek)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function cleanEntry(raw) {
  const entry = raw && typeof raw === "object" ? { ...raw } : {};
  entry.id = entry.id ?? Date.now();
  entry.title = String(entry.title ?? "").trim();
  entry.aliases = Array.isArray(entry.aliases) ? entry.aliases.map(x => String(x).trim()).filter(Boolean) : [];
  if (entry.title && !entry.aliases.some(a => normalizeText(a) === normalizeText(entry.title))) entry.aliases.unshift(entry.title.toLocaleLowerCase("tr-TR"));
  entry.category = String(entry.category ?? "").trim();
  entry.description = String(entry.description ?? "");
  entry.image = String(entry.image ?? "").trim();
  entry.location = String(entry.location ?? "").replaceAll("Aristalia", "Yolen");
  entry.danger = String(entry.danger ?? "");
  entry.race = String(entry.race ?? "");
  entry.age = String(entry.age ?? "");
  entry.occupation = String(entry.occupation ?? "");
  entry.firstAppearance = String(entry.firstAppearance ?? "");
  entry.related = Array.isArray(entry.related) ? entry.related.map(x => String(x).trim()).filter(Boolean) : [];
  return entry;
}

function sanitizeDatabase(list) {
  if (!Array.isArray(list)) return [];
  return list.map(cleanEntry);
}

function isSecret(entry) {
  const category = normalizeText(entry?.category);
  return entry?.secret === true || entry?.hidden === true || entry?.isSecret === true || entry?.easterEgg === true || category === "easter egg" || category === "gizli" || category === "hidden";
}

function splitDatabase(list) {
  const publicDb = [];
  const secretDb = [];
  for (const raw of sanitizeDatabase(list)) (isSecret(raw) ? secretDb : publicDb).push(raw);
  return { publicDb, secretDb };
}

function mergedDatabase() {
  const seen = new Set();
  const merged = [];
  for (const entry of [...state.publicDb, ...state.secretDb]) {
    const k = idKey(entry.id);
    if (!seen.has(k)) {
      seen.add(k);
      merged.push(entry);
    }
  }
  return merged;
}

function idKey(id) {
  return String(id);
}

function xorEncode(value) {
  const bytes = new TextEncoder().encode(value);
  const key = new TextEncoder().encode(SECRET_KEY);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i] ^ key[i % key.length]);
  return btoa(binary);
}

function xorDecode(value) {
  try {
    const binary = atob(String(value).trim());
    const key = new TextEncoder().encode(SECRET_KEY);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i) ^ key[i % key.length];
    return new TextDecoder().decode(bytes);
  } catch {
    return "";
  }
}

function encodeSecrets(entries) {
  return xorEncode(JSON.stringify(sanitizeDatabase(entries)));
}

function decodeSecrets(blob) {
  try {
    const decoded = xorDecode(blob);
    const parsed = JSON.parse(decoded);
    return sanitizeDatabase(parsed).filter(isSecret);
  } catch {
    return [];
  }
}


function pruneUserIds() {
  const validIds = new Set(mergedDatabase().map(x => idKey(x.id)));
  state.discovered = new Set([...state.discovered].filter(id => validIds.has(id)));
  state.favorites = new Set([...state.favorites].filter(id => validIds.has(id)));
}

function saveDatabaseParts() {
  localStorage.setItem(KEYS.publicDb, JSON.stringify(state.publicDb));
  localStorage.setItem(KEYS.secrets, encodeSecrets(state.secretDb));
}

function setAllDatabase(all, { persist = true } = {}) {
  const { publicDb, secretDb } = splitDatabase(all);
  state.publicDb = publicDb;
  state.secretDb = secretDb;
  if (persist) saveDatabaseParts();

  pruneUserIds();
  saveUserState();
}

function saveUserState() {
  localStorage.setItem(KEYS.discovered, JSON.stringify([...state.discovered]));
  localStorage.setItem(KEYS.favorites, JSON.stringify([...state.favorites]));
  localStorage.setItem(KEYS.recent, JSON.stringify(state.recent.slice(0, 8)));
}

function saveHistory() {
  localStorage.setItem(KEYS.undo, JSON.stringify(state.undo));
  localStorage.setItem(KEYS.redo, JSON.stringify(state.redo));
}

function saveBackups() {
  localStorage.setItem(KEYS.backups, JSON.stringify(state.backups));
}

function snapshotDatabase(label = "Değişiklik") {
  return {
    at: new Date().toISOString(),
    label,
    blob: xorEncode(JSON.stringify(mergedDatabase()))
  };
}

function restoreSnapshot(snapshot) {
  try {
    return sanitizeDatabase(JSON.parse(xorDecode(snapshot.blob)));
  } catch {
    return null;
  }
}

function createBackup(nextDb, label) {
  const backup = {
    at: new Date().toISOString(),
    label,
    blob: xorEncode(JSON.stringify(sanitizeDatabase(nextDb)))
  };
  state.backups.unshift(backup);
  state.backups = state.backups.slice(0, MAX_BACKUPS);
  saveBackups();
}

function commitDatabase(nextDb, label) {
  state.undo.push(snapshotDatabase(label));
  state.undo = state.undo.slice(-MAX_HISTORY);
  state.redo = [];
  createBackup(nextDb, label);
  setAllDatabase(nextDb);
  saveHistory();
  notify(`✓ ${label}`);
  render();
}

function undoDatabase() {
  if (!state.undo.length) return;
  const snapshot = state.undo.pop();
  const restored = restoreSnapshot(snapshot);
  if (!restored) return;
  state.redo.push(snapshotDatabase("Geri alma öncesi"));
  state.redo = state.redo.slice(-MAX_HISTORY);
  setAllDatabase(restored);
  saveHistory();
  notify(`↶ Geri alındı: ${snapshot.label}`);
  render();
}

function redoDatabase() {
  if (!state.redo.length) return;
  const snapshot = state.redo.pop();
  const restored = restoreSnapshot(snapshot);
  if (!restored) return;
  state.undo.push(snapshotDatabase("Yineleme öncesi"));
  state.undo = state.undo.slice(-MAX_HISTORY);
  setAllDatabase(restored);
  saveHistory();
  notify("↷ Değişiklik yeniden uygulandı.");
  render();
}

function migrateLegacyData() {
  const hasV2 = localStorage.getItem(KEYS.publicDb) || localStorage.getItem(KEYS.secrets);
  if (!hasV2) {
    const legacy = storageJson(KEYS.legacyDb, null);
    setAllDatabase(Array.isArray(legacy) && legacy.length ? legacy : FALLBACK_DATABASE);
    if (legacy) localStorage.removeItem(KEYS.legacyDb);
  } else {
    state.publicDb = sanitizeDatabase(storageJson(KEYS.publicDb, []));
    state.secretDb = decodeSecrets(localStorage.getItem(KEYS.secrets) || "");
    if (!state.publicDb.length && !state.secretDb.length) setAllDatabase(FALLBACK_DATABASE);
  }

  state.discovered = new Set(storageJson(KEYS.discovered, []).map(String));
  state.favorites = new Set(storageJson(KEYS.favorites, []).map(String));
  state.recent = storageJson(KEYS.recent, []);
  state.undo = storageJson(KEYS.undo, []).slice(-MAX_HISTORY);
  state.redo = storageJson(KEYS.redo, []).slice(-MAX_HISTORY);
  state.backups = storageJson(KEYS.backups, []).slice(0, MAX_BACKUPS);

  // Eski favoriler kayıt nesnesi olarak tutuluyordu. ID'ye dönüştür.
  const legacyFavorites = storageJson(KEYS.legacyFavorites, []);
  if (Array.isArray(legacyFavorites) && legacyFavorites.length) {
    const db = mergedDatabase();
    for (const item of legacyFavorites) {
      const title = typeof item === "string" ? item : item?.title;
      const found = db.find(e => normalizeText(e.title) === normalizeText(title));
      if (found) {
        state.favorites.add(idKey(found.id));
        state.discovered.add(idKey(found.id));
      }
    }
    localStorage.removeItem(KEYS.legacyFavorites);
  }

  const legacyRecent = storageJson(KEYS.legacyRecent, []);
  if (!state.recent.length && Array.isArray(legacyRecent)) state.recent = legacyRecent.slice(0, 8);
  localStorage.removeItem(KEYS.legacyRecent);
  pruneUserIds();
  saveUserState();
  saveDatabaseParts();
}

function notify(message, ms = 4500) {
  state.notification = message;
  if (state.notificationTimer) clearTimeout(state.notificationTimer);
  state.notificationTimer = setTimeout(() => {
    state.notification = "";
    render();
  }, ms);
}

function searchDatabase(query) {
  const q = normalizeText(query);
  if (!q) return null;
  return mergedDatabase().find(entry => {
    if (normalizeText(entry.title) === q) return true;
    return (entry.aliases || []).some(alias => normalizeText(alias) === q);
  }) || null;
}

function addRecent(query) {
  const value = String(query || "").trim();
  if (!value) return;
  const nq = normalizeText(value);
  state.recent = [value, ...state.recent.filter(x => normalizeText(x) !== nq)].slice(0, 8);
  saveUserState();
}

function discoverEntry(entry, { animate = true } = {}) {
  const key = idKey(entry.id);
  const isNew = !state.discovered.has(key);
  if (isNew) {
    state.discovered.add(key);
    saveUserState();
    if (animate) {
      state.discovery = { title: entry.title, secret: isSecret(entry) };
      playDiscoverySound();
      setTimeout(() => {
        state.discovery = null;
        render();
      }, 2400);
    }
  }
  return isNew;
}

function discoverAllEntries() {
  const entries = mergedDatabase();
  let added = 0;
  for (const entry of entries) {
    const key = idKey(entry.id);
    if (!state.discovered.has(key)) {
      state.discovered.add(key);
      added += 1;
    }
  }
  saveUserState();
  state.discovery = null;
  notify(added
    ? `✨ ${added} yeni madde keşfedildi. Artık ${entries.length} maddenin tamamı keşfedilmiş durumda.`
    : `✔ Tüm ${entries.length} madde zaten keşfedilmiş durumda.`, 5200);
  render();
}

function openEntry(entry, { discover = true , animate = true  } = {}) {
  if (!entry) return;
  if (discover) discoverEntry(entry, { animate });
  state.result = entry;
  state.notFound = false;
  state.view = "home";
  render();
}

function performSearch(explicitValue) {
  const input = document.querySelector("#mainSearch");
  const query = explicitValue ?? input?.value ?? "";
  if (normalizeText(query) === "master") {
    state.dmLogin = true;
    state.view = "home";
    state.result = null;
    render();
    return;
  }
  const found = searchDatabase(query);
  addRecent(query);
  if (found) {
    discoverEntry(found, { animate: true });
    state.result = found;
    state.notFound = false;
  } else {
    state.result = null;
    state.notFound = true;
  }
  state.view = "home";
  render();
}

function playDiscoverySound() {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const gain = ctx.createGain();
    gain.connect(ctx.destination);
    gain.gain.setValueAtTime(0.0001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.12, ctx.currentTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.7);
    [440, 660, 880].forEach((freq, index) => {
      const osc = ctx.createOscillator();
      osc.type = "sine";
      osc.frequency.value = freq;
      osc.connect(gain);
      osc.start(ctx.currentTime + index * 0.08);
      osc.stop(ctx.currentTime + 0.45 + index * 0.08);
    });
    setTimeout(() => ctx.close(), 1000);
  } catch {}
}

function imageSrc(src) {
  if (!src) return "";
  if (/^(https?:|data:|blob:)/i.test(src)) return src;
  if (src.startsWith("/")) return `.${src}`;
  return src;
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function appendLinkedText(container, text, currentEntry) {
  const discoveredEntries = mergedDatabase()
    .filter(e => state.discovered.has(idKey(e.id)) && idKey(e.id) !== idKey(currentEntry?.id))
    .map(e => ({ entry: e, label: String(e.title).replace(/[\u200B-\u200D\uFEFF]/g, "") }))
    .filter(x => x.label.length >= 3 && text.toLocaleLowerCase("tr-TR").includes(x.label.toLocaleLowerCase("tr-TR")))
    .sort((a, b) => b.label.length - a.label.length)
    .slice(0, 30);

  if (!discoveredEntries.length) {
    container.textContent = text;
    return;
  }

  const pattern = new RegExp(`(${discoveredEntries.map(x => escapeRegExp(x.label)).join("|")})`, "giu");
  let last = 0;
  for (const match of text.matchAll(pattern)) {
    if (match.index > last) container.append(document.createTextNode(text.slice(last, match.index)));
    const found = discoveredEntries.find(x => x.label.toLocaleLowerCase("tr-TR") === match[0].toLocaleLowerCase("tr-TR"));
    if (found) {
      const button = el("button", "inlineLink", match[0]);
      button.type = "button";
      button.addEventListener("click", () => openEntry(found.entry));
      container.append(button);
    } else container.append(document.createTextNode(match[0]));
    last = match.index + match[0].length;
  }
  if (last < text.length) container.append(document.createTextNode(text.slice(last)));
}

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined && text !== null) node.textContent = text;
  return node;
}

function button(text, onClick, className = "searchButton") {
  const b = el("button", className, text);
  b.type = "button";
  b.addEventListener("click", onClick);
  return b;
}

function card(title) {
  const c = el("section", "resultCard");
  if (title) c.append(el("h2", "", title));
  return c;
}

function renderHeader(root) {
  const header = el("header", "header");
  header.append(el("h1", "", "ZET CODEX"));
  header.append(el("p", "", "The Official Encyclopedia of the Zet World"));
  root.append(header);
}

function renderSidebar(layout) {
  const db = mergedDatabase();
  const sidebar = el("aside", "sidebar");
  sidebar.append(el("h2", "", "ZET CODEX"));

  const countCard = el("div", "countCard");
  countCard.append(el("small", "", "TOPLAM KAYIT"));
  countCard.append(el("div", "countNumber", String(db.length)));
  const discovered = el("div", "countSub", `Keşfedilen ${state.discovered.size} / ${db.length}`);
  countCard.append(discovered);
  sidebar.append(countCard);

  sidebar.append(button("📚 Keşfedilen Arşivi", () => {
    state.view = "archive";
    state.archiveCategory = "";
    state.result = null;
    render();
  }, "sideAction"));

  sidebar.append(el("div", "sideLabel", "KATEGORİLER"));
  const categories = [...new Set(state.publicDb.map(e => e.category).filter(x => x && x.trim()))].sort((a, b) => a.localeCompare(b, "tr"));
  for (const category of categories) {
    const b = button(category, () => {
      state.view = "archive";
      state.archiveCategory = category;
      state.result = null;
      render();
    }, "categoryButton");
    sidebar.append(b);
  }

  sidebar.append(el("div", "sidebarRule"));
  sidebar.append(el("small", "privacyNote", "Gizli kayıt adları listelenmez. Yalnızca doğru aramayla keşfedilir."));
  layout.append(sidebar);
}

function renderSearch(main) {
  const wrap = el("div", "searchContainer");
  const input = el("input", "searchBox");
  input.id = "mainSearch";
  input.type = "text";
  input.placeholder = "🔍 Bir terim ara...";
  input.autocomplete = "off";
  input.spellcheck = false;
  input.addEventListener("keydown", event => {
    if (event.key === "Enter") performSearch();
  });
  wrap.append(input);
  wrap.append(button("ARA", () => performSearch()));
  main.append(wrap);
}

function renderNotification(main) {
  if (!state.notification) return;
  const n = el("div", "notification", state.notification);
  main.append(n);
}

function renderWelcome(main) {
  const c = card("Hoş Geldin");
  c.append(el("p", "", "Bir kaydı keşfetmek için adını veya bilinen bir aliasını ara. Gizli kayıtlar hiçbir listede veya otomatik öneride gösterilmez."));
  const hint = el("p", "welcomeHint", "Arama büyük/küçük harf ve Türkçe karakter farklarını tolere eder.");
  c.append(hint);
  main.append(c);
}

function renderNotFound(main) {
  const c = card("Bulunamadı");
  c.append(el("p", "", "Bu terim veritabanında bulunamadı."));
  main.append(c);
}

function renderInfoRow(box, icon, label, value) {
  const row = el("div", "infoRow");
  const left = el("span", "", `${icon} ${label}`);
  const right = el("strong", "", value || "-");
  row.append(left, right);
  box.append(row);
}

function renderResult(main, entry) {
  const c = card();
  const title = el("h1", "entryTitle", entry.title);
  c.append(title);
  c.append(el("h4", "", isSecret(entry) ? "???" : (entry.category || "")));

  if (entry.image) {
    const img = el("img", "resultImage");
    img.src = imageSrc(entry.image);
    img.alt = entry.title;
    img.addEventListener("error", () => img.remove());
    c.append(img);
  }

  const info = el("div", "infoBox");
  renderInfoRow(info, "📚", "Kategori", isSecret(entry) ? "Gizli" : entry.category);
  renderInfoRow(info, "📍", "Yer", entry.location);
  renderInfoRow(info, "⚠", "Tehlike", entry.danger);
  renderInfoRow(info, "👤", "Irk", entry.race);
  renderInfoRow(info, "🎂", "Yaş", entry.age);
  renderInfoRow(info, "💼", "Meslek", entry.occupation);
  renderInfoRow(info, "📖", "İlk Görünüş", entry.firstAppearance);
  c.append(info);

  c.append(el("h3", "", "📜 Açıklama"));
  const description = el("p", "entryDescription");
  appendLinkedText(description, entry.description || "", entry);
  c.append(description);

  const key = idKey(entry.id);
  const fav = state.favorites.has(key);
  const favButton = button(fav ? "⭐ Favorilerden Çıkar" : "☆ Favorilere Ekle", () => {
    if (fav) state.favorites.delete(key); else state.favorites.add(key);
    saveUserState();
    render();
  });
  c.append(favButton);
  main.append(c);

  renderRelated(main, entry);
}

function renderRelated(main, entry) {
  if (!entry.related?.length) return;
  const db = mergedDatabase();
  const related = entry.related
    .map(name => db.find(x => normalizeText(x.title) === normalizeText(name)))
    .filter(Boolean)
    .filter(x => state.discovered.has(idKey(x.id)));
  if (!related.length) return;
  const c = card("📚 Keşfedilmiş İlgili Terimler");
  for (const item of related) c.append(button(item.title, () => openEntry(item)));
  main.append(c);
}

function renderRecent(main) {
  if (!state.recent.length) return;
  const c = card("Son Aramalar");
  c.classList.add("compactCard");
  for (const query of state.recent) c.append(button(query, () => performSearch(query), "chipButton"));
  main.append(c);
}

function renderFavorites(main) {
  const db = mergedDatabase();
  const items = [...state.favorites].map(id => db.find(e => idKey(e.id) === id)).filter(Boolean).filter(e => state.discovered.has(idKey(e.id)));
  if (!items.length) return;
  const c = card("⭐ Favoriler");
  c.classList.add("compactCard");
  for (const item of items) c.append(button(item.title, () => openEntry(item), "chipButton"));
  main.append(c);
}

function renderArchive(main) {
  const db = mergedDatabase();
  let items = state.archiveCategory
    ? state.publicDb.filter(e => e.category === state.archiveCategory && !isSecret(e))
    : db.filter(e => state.discovered.has(idKey(e.id)));
  items.sort((a, b) => a.title.localeCompare(b.title, "tr"));

  const c = card(state.archiveCategory ? `Kategori — ${state.archiveCategory}` : "Keşfedilen Kayıtlar Arşivi");
  const meta = el("div", "archiveMeta", state.archiveCategory
    ? `${items.length} normal kayıt gösteriliyor. Gizli / Easter Egg kayıtları burada listelenmez.`
    : `${items.length} kayıt gösteriliyor. Keşfedilmemiş kayıtların adı burada yer almaz.`);
  c.append(meta);

  const topActions = el("div", "archiveActions");
  topActions.append(button("← Ana Ekran", () => {
    state.view = "home";
    state.archiveCategory = "";
    render();
  }, "smallButton"));
  if (state.archiveCategory) topActions.append(button("Tüm Keşfedilenler", () => {
    state.archiveCategory = "";
    render();
  }, "smallButton"));
  c.append(topActions);

  if (!items.length) {
    c.append(el("p", "emptyArchive", "Henüz bu bölümde keşfedilmiş bir kayıt yok."));
  } else {
    const grid = el("div", "archiveGrid");
    for (const item of items) {
      const itemButton = el("button", "archiveItem");
      itemButton.type = "button";
      const title = el("strong", "", item.title);
      const cat = el("small", "", isSecret(item) ? "Gizli Kayıt" : (item.category || "Kategorisiz"));
      itemButton.append(title, cat);
      itemButton.addEventListener("click", () => openEntry(item));
      grid.append(itemButton);
    }
    c.append(grid);
  }
  main.append(c);
}

function renderDmLogin(main) {
  const c = card("DM Girişi");
  const input = el("input", "searchBox");
  input.type = "password";
  input.placeholder = "Şifre";
  input.id = "dmPassword";
  input.addEventListener("keydown", e => e.key === "Enter" && tryDmLogin());
  c.append(input);
  c.append(button("Giriş", tryDmLogin));
  c.append(button("İptal", () => {
    state.dmLogin = false;
    render();
  }, "secondaryButton"));
  main.append(c);
  setTimeout(() => document.querySelector("#dmPassword")?.focus(), 0);
}

function tryDmLogin() {
  const value = document.querySelector("#dmPassword")?.value || "";
  if (value === "zet123") {
    state.dmMode = true;
    state.dmLogin = false;
    state.view = "dm";
    state.editId = null;
    render();
  } else alert("Şifre yanlış.");
}

function validateDatabase(db) {
  const errors = [];
  const warnings = [];
  const ids = new Map();
  const titles = new Map();
  const titleSet = new Set(db.map(e => normalizeText(e.title)).filter(Boolean));

  db.forEach((entry, index) => {
    const label = entry.title || `#${index + 1}`;
    const id = idKey(entry.id);
    if (ids.has(id)) errors.push(`${label}: aynı ID başka bir kayıtta da var (${id}).`); else ids.set(id, label);
    const nt = normalizeText(entry.title);
    if (!nt) errors.push(`#${index + 1}: başlık boş.`);
    else if (titles.has(nt)) errors.push(`${label}: aynı/normalize edilmiş başlık tekrar ediyor.`); else titles.set(nt, label);
    if (!String(entry.description || "").trim()) errors.push(`${label}: açıklama boş.`);
    if (!Array.isArray(entry.aliases)) errors.push(`${label}: aliases alanı dizi değil.`);
    if (String(entry.location || "").includes("Aristalia")) warnings.push(`${label}: konumda Aristalia kaldı.`);
    if (entry.image && !/^(https?:\/\/|data:|\/|\.\/)/i.test(entry.image)) warnings.push(`${label}: resim yolu şüpheli (${entry.image}).`);
    const aliases = (entry.aliases || []).map(normalizeText).filter(Boolean);
    if (new Set(aliases).size !== aliases.length) warnings.push(`${label}: tekrar eden alias var.`);
    for (const related of entry.related || []) if (normalizeText(related) && !titleSet.has(normalizeText(related))) warnings.push(`${label}: ilişkili terim bulunamadı → ${related}`);
  });
  return { errors, warnings };
}

function renderValidation(c) {
  const report = validateDatabase(mergedDatabase());
  const box = el("details", "validationBox");
  const summary = el("summary", "", `Veritabanı Kontrolü — ${report.errors.length} hata / ${report.warnings.length} uyarı`);
  box.append(summary);
  const body = el("div", "validationBody");
  if (!report.errors.length && !report.warnings.length) body.append(el("p", "okText", "✓ Yapısal sorun bulunamadı."));
  for (const msg of report.errors) body.append(el("div", "validationError", `⛔ ${msg}`));
  for (const msg of report.warnings.slice(0, 80)) body.append(el("div", "validationWarning", `⚠ ${msg}`));
  if (report.warnings.length > 80) body.append(el("div", "validationWarning", `… ve ${report.warnings.length - 80} uyarı daha.`));
  box.append(body);
  c.append(box);
}

function dmField(form, label, name, value = "", type = "input") {
  const group = el("label", "dmField");
  group.append(el("span", "", label));
  const control = type === "textarea" ? el("textarea", "searchBox") : el("input", "searchBox");
  control.name = name;
  control.value = value ?? "";
  if (type === "textarea") control.rows = 6;
  group.append(control);
  form.append(group);
  return control;
}

function getEntryById(id) {
  return mergedDatabase().find(e => idKey(e.id) === idKey(id)) || null;
}

function renderDmPanel(main) {
  const db = mergedDatabase();
  const current = state.editId !== null ? getEntryById(state.editId) : null;
  const c = card("DM PANELİ");

  const toolbar = el("div", "dmToolbar");
  const undo = button(`↶ Geri Al (${state.undo.length})`, undoDatabase, "smallButton");
  undo.disabled = !state.undo.length;
  const redo = button(`↷ Yinele (${state.redo.length})`, redoDatabase, "smallButton");
  redo.disabled = !state.redo.length;
  toolbar.append(undo, redo);
  toolbar.append(button("✨ Tüm Maddeleri Keşfet", discoverAllEntries, "smallButton"));
  toolbar.append(button("DM Panelinden Çık", () => {
    state.dmMode = false;
    state.view = "home";
    state.editId = null;
    render();
  }, "smallButton dangerOutline"));
  c.append(toolbar);

  renderValidation(c);

  const listTitle = el("div", "dmListTitle");
  listTitle.append(el("h3", "", `Tüm Maddeler    (${db.length})`));
  const filter = el("input", "searchBox dmFilter");
  filter.placeholder = "DM kayıtlarında filtrele...";
  filter.value = state.dmFilter;
  filter.addEventListener("input", e => {
    state.dmFilter = e.target.value;
    renderDmListOnly();
  });
  listTitle.append(filter);
  c.append(listTitle);

  const list = el("div", "dmRecordList");
  list.id = "dmRecordList";
  c.append(list);
  const form = el("form", "dmForm");
  form.addEventListener("submit", e => {
    e.preventDefault();
    saveDmForm(form);
  });

  dmField(form, "Başlık *", "title", current?.title);
  dmField(form, "Kategori", "category", current?.category);
  dmField(form, "Aliaslar (virgülle)", "aliases", current ? (current.aliases || []).filter(a => normalizeText(a) !== normalizeText(current.title)).join(", ") : "");
  dmField(form, "Açıklama *", "description", current?.description, "textarea");
  dmField(form, "Resim yolu", "image", current?.image);
  dmField(form, "Bulunduğu Yer", "location", current?.location);
  dmField(form, "Tehlike", "danger", current?.danger);
  dmField(form, "Irk", "race", current?.race);
  dmField(form, "Yaş", "age", current?.age);
  dmField(form, "Meslek", "occupation", current?.occupation);
  dmField(form, "İlk Görünüş", "firstAppearance", current?.firstAppearance);
  dmField(form, "İlişkili Terimler (virgülle)", "related", current ? (current.related || []).join(", ") : "");

  const secretLabel = el("label", "secretToggle");
  const secretCheck = el("input");
  secretCheck.type = "checkbox";
  secretCheck.name = "secret";
  secretCheck.checked = current ? isSecret(current) : false;
  secretLabel.append(secretCheck, el("span", "", "Gizli kayıt / Easter Egg"));
  form.append(secretLabel);

  const actions = el("div", "dmFormActions");
  actions.append(button(current ? "💾 Güncelle" : "➕ Kaydet", () => {}, "searchButton"));
  actions.lastChild.type = "submit";
  if (current) actions.append(button("❌ Düzenlemeyi İptal", () => {
    state.editId = null;
    render();
  }, "secondaryButton"));
  form.append(actions);
  c.append(form);

  const transfer = el("div", "transferGrid");
  transfer.append(button("📤 Tüm Veritabanını Dışa Aktar", exportFullDatabase, "secondaryButton"));
  transfer.append(button("🔐 GitHub için Public + Secrets", exportGithubPackage, "secondaryButton"));
  transfer.append(button("📥 Veritabanı Yükle", () => document.querySelector("#dbImport")?.click(), "secondaryButton"));
  transfer.append(button("🧷 Son Yedeği İndir", downloadLatestBackup, "secondaryButton"));
  const file = el("input");
  file.id = "dbImport";
  file.type = "file";
  file.accept = ".json";
  file.hidden = true;
  file.addEventListener("change", importDatabaseFile);
  transfer.append(file);
  c.append(transfer);

  renderBackups(c);

  main.append(c);
  renderDmListOnly();
}

function saveDmForm(form) {
  const data = new FormData(form);
  const title = String(data.get("title") || "").trim();
  const description = String(data.get("description") || "").trim();
  if (!title || !description) {
    alert("Başlık ve açıklama alanlarını doldur.");
    return;
  }
  const old = state.editId !== null ? getEntryById(state.editId) : null;
  const secret = data.get("secret") === "on";
  const categoryInput = String(data.get("category") || "").trim();
  const entry = cleanEntry({
    id: old?.id ?? Date.now(),
    title,
    aliases: [title.toLocaleLowerCase("tr-TR"), ...String(data.get("aliases") || "").split(",").map(x => x.trim()).filter(Boolean)],
    category: secret ? "Easter Egg" : categoryInput,
    description,
    image: String(data.get("image") || "").trim(),
    location: String(data.get("location") || "").trim(),
    danger: String(data.get("danger") || "").trim(),
    race: String(data.get("race") || "").trim(),
    age: String(data.get("age") || "").trim(),
    occupation: String(data.get("occupation") || "").trim(),
    firstAppearance: String(data.get("firstAppearance") || "").trim(),
    related: String(data.get("related") || "").split(",").map(x => x.trim()).filter(Boolean)
  });

  const db = mergedDatabase();
  const next = old ? db.map(e => idKey(e.id) === idKey(old.id) ? entry : e) : [...db, entry];
  state.editId = null;
  state.result = entry;
  commitDatabase(next, old ? `Kayıt güncellendi: ${entry.title}` : `Yeni kayıt eklendi: ${entry.title}`);
}

function renderDmListOnly() {
  const list = document.querySelector("#dmRecordList");
  if (!list) return;
  list.replaceChildren();
  const q = normalizeText(state.dmFilter);
  const entries = mergedDatabase()
    .filter(e => !q || normalizeText(`${e.title} ${e.category} ${(e.aliases || []).join(" ")}`).includes(q))
    .sort((a, b) => a.title.localeCompare(b.title, "tr"));

  for (const entry of entries) {
    const row = el("div", `dmRecordRow${isSecret(entry) ? " secretRecord" : ""}`);
    const meta = el("div", "dmRecordMeta");
    meta.append(el("strong", "", entry.title));
    meta.append(el("small", "", isSecret(entry) ? "🔐 Easter Egg" : (entry.category || "Kategorisiz")));
    row.append(meta);
    const actions = el("div", "dmRowActions");
    actions.append(button("✏ Düzenle", () => {
      state.editId = entry.id;
      render();
      setTimeout(() => window.scrollTo({ top: 0, behavior: "smooth" }), 0);
    }, "tinyButton"));
    actions.append(button("🗑 Sil", () => {
      if (!confirm(`“${entry.title}” kaydı silinsin mi?`)) return;
      const next = mergedDatabase().filter(e => idKey(e.id) !== idKey(entry.id));
      state.discovered.delete(idKey(entry.id));
      state.favorites.delete(idKey(entry.id));
      if (state.editId !== null && idKey(state.editId) === idKey(entry.id)) state.editId = null;
      commitDatabase(next, `Kayıt silindi: ${entry.title}`);
    }, "tinyButton deleteButton"));
    row.append(actions);
    list.append(row);
  }
}

function renderBackups(c) {
  const details = el("details", "backupBox");
  details.append(el("summary", "", `Otomatik Yedekler (${state.backups.length})`));
  const body = el("div", "backupList");
  if (!state.backups.length) body.append(el("p", "", "Henüz yedek yok. İlk düzenlemede otomatik oluşturulur."));
  state.backups.slice(0, 8).forEach((backup, index) => {
    const row = el("div", "backupRow");
    const info = el("div", "");
    info.append(el("strong", "", backup.label));
    info.append(el("small", "", formatDate(backup.at)));
    row.append(info);
    row.append(button("Geri Yükle", () => {
      if (!confirm("Bu yedek geri yüklensin mi? Mevcut durum da geri alınabilir geçmişe kaydedilecek.")) return;
      const restored = restoreSnapshot(backup);
      if (!restored) return alert("Yedek okunamadı.");
      commitDatabase(restored, `Yedekten geri yüklendi: ${backup.label}`);
    }, "tinyButton"));
    if (index === 0) row.classList.add("latestBackup");
    body.append(row);
  });
  details.append(body);
  c.append(details);
}

function formatDate(value) {
  try {
    return new Intl.DateTimeFormat("tr-TR", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
  } catch {
    return value;
  }
}

function downloadText(filename, text, type = "application/json") {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function exportFullDatabase() {
  downloadText("zetcodex_database_full.json", JSON.stringify(mergedDatabase(), null, 2));
}

function exportGithubPackage() {
  const publicJson = JSON.stringify(state.publicDb, null, 2);
  const secretDat = encodeSecrets(state.secretDb);
  downloadText("database.json", publicJson);
  setTimeout(() => downloadText("secrets.dat", secretDat, "text/plain"), 350);
  notify("GitHub paketi hazır: database.json + secrets.dat");
}

function downloadLatestBackup() {
  const backup = state.backups[0];
  if (!backup) return alert("Henüz otomatik yedek yok.");
  const restored = restoreSnapshot(backup);
  if (!restored) return alert("Yedek okunamadı.");
  const stamp = backup.at.replace(/[:.]/g, "-");
  downloadText(`zetcodex_backup_${stamp}.json`, JSON.stringify(restored, null, 2));
}

function importDatabaseFile(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const parsed = JSON.parse(reader.result);
      if (!Array.isArray(parsed)) throw new Error("Dizi değil");
      commitDatabase(parsed, `Veritabanı içe aktarıldı: ${file.name}`);
      state.editId = null;
    } catch {
      alert("Geçersiz JSON veritabanı.");
    } finally {
      event.target.value = "";
    }
  };
  reader.readAsText(file);
}

async function checkAppCodeUpdate(versionData) {
  const remoteAppVersion = Number(versionData?.appVersion || 0);
  if (!remoteAppVersion || remoteAppVersion <= APP_CODE_VERSION) return false;

  const url = String(versionData?.appAsarUrl || "").trim();
  if (!url) {
    notify("⚠ Yeni uygulama sürümü tanımlı ancak appAsarUrl eksik.", 5200);
    return false;
  }
  if (!window.zetUpdater?.install) {
    notify("⚠ Uygulama güncelleme bileşeni bulunamadı. Yeni paket bir kez elle kurulmalı.", 6200);
    return false;
  }

  try {
    notify(`⬇ ZET CODEX uygulama güncellemesi indiriliyor (v${remoteAppVersion})...`, 120000);
    const result = await window.zetUpdater.install({
      url,
      sha256: String(versionData?.appAsarSha256 || "").trim()
    });
    if (!result?.ok) throw new Error(result?.error || "update");
    return true;
  } catch (error) {
    console.error("App update failed", error);
    notify("⚠ Uygulama güncellemesi kurulamadı. Veritabanı güncellemesi yine kontrol ediliyor.", 6200);
    return false;
  }
}

async function checkRemoteUpdates() {
  try {
    const versionResponse = await fetch(VERSION_URL, { cache: "no-store" });
    if (!versionResponse.ok) throw new Error("version");
    const versionData = await versionResponse.json();
    const remoteVersion = Number(versionData.version || 0);
    const localVersion = Number(localStorage.getItem(KEYS.version) || 0);

    const appUpdateStarted = await checkAppCodeUpdate(versionData);
    if (appUpdateStarted) return;

    if (remoteVersion <= localVersion && state.publicDb.length) {
      notify("✔ Ansiklopedi güncel.", 2600);
      return;
    }

    const dbResponse = await fetch(DATABASE_URL, { cache: "no-store" });
    if (!dbResponse.ok) throw new Error("database");
    const remoteDb = sanitizeDatabase(await dbResponse.json());
    const split = splitDatabase(remoteDb);

    let secretDb = [...split.secretDb];
    try {
      const secretResponse = await fetch(SECRETS_URL, { cache: "no-store" });
      if (secretResponse.ok) {
        const blob = await secretResponse.text();
        const externalSecrets = decodeSecrets(blob);
        const map = new Map(secretDb.map(e => [idKey(e.id), e]));
        externalSecrets.forEach(e => map.set(idKey(e.id), e));
        secretDb = [...map.values()];
      }
    } catch {}

    state.publicDb = split.publicDb;
    state.secretDb = secretDb;
    pruneUserIds();
    saveUserState();
    saveDatabaseParts();
    localStorage.setItem(KEYS.version, String(remoteVersion));
    notify("🆕 Ansiklopedi güncellendi!", 4200);
    render();
  } catch {
    notify("⚠ İnternet bağlantısı kurulamadı. Yerel veritabanı kullanılıyor.", 4200);
    render();
  }
}

function renderDiscoveryOverlay(root) {
  if (!state.discovery) return;
  const overlay = el("div", `discoveryOverlay${state.discovery.secret ? " secretDiscovery" : ""}`);
  const inner = el("div", "discoveryInner");
  inner.append(el("div", "discoveryRune", state.discovery.secret ? "✦" : "◇"));
  inner.append(el("small", "", state.discovery.secret ? "HIDDEN ENTRY DISCOVERED" : "NEW ENTRY DISCOVERED"));
  inner.append(el("h2", "", state.discovery.title));
  overlay.append(inner);
  root.append(overlay);
}

function render() {
  const root = document.querySelector("#root");
  if (!root) return;
  root.replaceChildren();
  const app = el("div", "app");
  renderHeader(app);
  const layout = el("div", "layout");
  renderSidebar(layout);
  const main = el("main", "main");
  renderSearch(main);
  renderNotification(main);

  if (state.dmMode && state.view === "dm") renderDmPanel(main);
  else if (state.dmLogin) renderDmLogin(main);
  else if (state.view === "archive") renderArchive(main);
  else {
    if (state.result) renderResult(main, state.result);
    else if (state.notFound) renderNotFound(main);
    else renderWelcome(main);
    renderFavorites(main);
    renderRecent(main);
  }

  layout.append(main);
  app.append(layout);
  root.append(app);
  renderDiscoveryOverlay(root);
}

migrateLegacyData();
render();
checkRemoteUpdates();
