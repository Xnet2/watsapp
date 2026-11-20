const ctxMenu = document.getElementById('ctxMenu');
const ctxDeleteBtn = document.getElementById('ctxDeleteBtn');
let ctxDeleteHandler = null;
let ctxOpenedAt = 0;

function openCtxMenu(x, y, onDelete){
  ctxDeleteHandler = onDelete;
  ctxOpenedAt = Date.now();
  ctxMenu.classList.add('open');
  ctxMenu.style.left = '0px';
  ctxMenu.style.top = '0px';
  const rect = ctxMenu.getBoundingClientRect();
  const vw = window.innerWidth, vh = window.innerHeight;
  let left = Math.min(x, vw - rect.width - 8);
  let top = Math.min(y, vh - rect.height - 8);
  ctxMenu.style.left = Math.max(8, left) + 'px';
  ctxMenu.style.top = Math.max(8, top) + 'px';
}
function closeCtxMenu(){
  ctxMenu.classList.remove('open');
  ctxDeleteHandler = null;
}
ctxDeleteBtn.onclick = () => {
  const fn = ctxDeleteHandler;
  closeCtxMenu();
  if(fn) fn();
};
document.addEventListener('click', (e) => {
  // מתעלמים מהקליק שמגיע מייד אחרי לחיצה ארוכה במגע (אחרת התפריט נסגר ברגע שנפתח)
  if(ctxMenu.classList.contains('open') && !ctxMenu.contains(e.target) && Date.now() - ctxOpenedAt > 400) closeCtxMenu();
});
document.addEventListener('scroll', closeCtxMenu, true);
window.addEventListener('resize', closeCtxMenu);
document.addEventListener('keydown', (e) => { if(e.key === 'Escape') closeCtxMenu(); });

const BASE_URL = 'https://www.call2all.co.il/ym/api/';

// ===== מערכות (חשבונות) - תמיכה בכמה מערכות ימות המשיח באותו אתר =====
// כל "מערכת" היא אובייקט {id, label, token, ext, tzintukList, tzintukCallerId, contactsApi}
// שנשמר במערך אחד תחת LS_SYSTEMS. LS_ACTIVE_SYSTEM מצביע על ה-id של המערכת שמוצגת כרגע.
// אם יש יותר ממערכת אחת - נפתח מסך "רשימת מערכות" בסגנון רשימת השיחות של וואטסאפ; עם
// מערכת אחת בלבד ממשיכים ישר לתוך השיחה שלה, בדיוק כמו ההתנהגות לפני התמיכה בכמה מערכות.
const LS_SYSTEMS = 'yemot_systems';
const LS_ACTIVE_SYSTEM = 'yemot_active_system';
// מפתחות הגרסה הקודמת (מערכת יחידה) - נשארים כאן רק לצורך העברה חד-פעמית של הגדרות
// קיימות למבנה החדש (ר' migrateLegacySystemIfNeeded), ולא נכתבים אליהם יותר.
const LEGACY_LS_TOKEN = 'yemot_token';
const LEGACY_LS_EXT = 'yemot_ext';
const LEGACY_LS_TZINTUK_LIST = 'yemot_tzintuk_list';
const LEGACY_LS_TZINTUK_CALLERID = 'yemot_tzintuk_callerid';
const LEGACY_LS_CONTACTS_API = 'yemot_contacts_api';
// מפתח Groq API - הגדרה גלובלית של הדפדפן (לא חלק מהמערכת/הטוקן),
// ולכן בכוונה לא נכלל בקישור ההזמנה (ר' inviteLinkBtn) - זה מפתח אישי שלא רוצים
// להעביר בשום צורה לחברי קבוצה אחרים.
const LS_SPEECH_API_KEY = 'yemot_speech_api_key';
function getSpeechApiKey(){ return (localStorage.getItem(LS_SPEECH_API_KEY) || '').trim(); }
function setSpeechApiKey(key){
  if(key) localStorage.setItem(LS_SPEECH_API_KEY, key.trim());
  else localStorage.removeItem(LS_SPEECH_API_KEY);
}

// הצגת הודעת "טוסט" קטנה וזמנית בתחתית המסך (למשל אישור העתקת קישור הזמנה)
const toastEl = document.getElementById('toastEl');
let toastTimer = null;
function showToast(msg){
  if(!toastEl) return;
  toastEl.textContent = msg;
  toastEl.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.remove('show'), 2200);
}

// המרת מחרוזת (כולל עברית/יוניקוד) ל-Base64 URL-safe וחזרה - משמש לקידוד פרטי מערכת
// בתוך קישור הזמנה (ר' generateInviteLink / applyInviteLinkIfPresent) בלי לחשוף אותם כטקסט גלוי.
function b64UrlEncode(str){
  const b64 = btoa(unescape(encodeURIComponent(str)));
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function b64UrlDecode(b64url){
  let b64 = b64url.replace(/-/g, '+').replace(/_/g, '/');
  while(b64.length % 4) b64 += '=';
  return decodeURIComponent(escape(atob(b64)));
}

// מניעת הזרקת קוד: כל טקסט שמגיע מבחוץ (גיליון אנשי הקשר המשותף, שמות קבצים) ונכנס
// ל-innerHTML עובר דרך escapeHtml, וכתובות תמונה עוברות דרך safeImageUrl.
function escapeHtml(str){
  return String(str == null ? '' : str)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
function safeImageUrl(url){
  const u = String(url || '').trim();
  if(/^https?:\/\//i.test(u) || /^data:image\//i.test(u)) return u;
  return '';
}

function getSystems(){
  try{ return JSON.parse(localStorage.getItem(LS_SYSTEMS) || '[]'); }catch(err){ return []; }
}
function saveSystems(list){ localStorage.setItem(LS_SYSTEMS, JSON.stringify(list)); }
function genSystemId(){ return 's' + Date.now().toString(36) + Math.random().toString(36).slice(2,7); }
function getActiveSystemId(){ return localStorage.getItem(LS_ACTIVE_SYSTEM) || null; }
function setActiveSystemId(id){
  if(id) localStorage.setItem(LS_ACTIVE_SYSTEM, id);
  else localStorage.removeItem(LS_ACTIVE_SYSTEM);
}
function getActiveSystem(){
  const id = getActiveSystemId();
  if(!id) return null;
  return getSystems().find(s => s.id === id) || null;
}
function systemLabel(sys){ return (sys && sys.label && sys.label.trim()) || ('שלוחה ' + ((sys && sys.ext) || '1')); }

// יוצר/מעדכן את המערכת הפעילה עם השדות הנתונים. אם אין עדיין מערכת פעילה (למשל בהוספת
// מערכת חדשה, ר' homeAddBtn) - יוצר רשומה חדשה והופך אותה לפעילה.
function upsertActiveSystem(fields){
  const systems = getSystems();
  let id = getActiveSystemId();
  let sys = id ? systems.find(s => s.id === id) : null;
  if(!sys){
    sys = { id: genSystemId() };
    systems.push(sys);
    id = sys.id;
    setActiveSystemId(id);
  }
  Object.assign(sys, fields);
  sys.label = (fields.label && fields.label.trim()) || sys.label || '';
  saveSystems(systems);
  return sys;
}

function migrateLegacySystemIfNeeded(){
  if(getSystems().length > 0) return;
  const legacyToken = localStorage.getItem(LEGACY_LS_TOKEN);
  if(!legacyToken) return;
  const sys = {
    id: genSystemId(),
    label: '',
    token: legacyToken,
    ext: localStorage.getItem(LEGACY_LS_EXT) || '1',
    tzintukList: localStorage.getItem(LEGACY_LS_TZINTUK_LIST) || '',
    tzintukCallerId: localStorage.getItem(LEGACY_LS_TZINTUK_CALLERID) || '',
    contactsApi: localStorage.getItem(LEGACY_LS_CONTACTS_API) || '',
    contactsSource: 'sheetdb'
  };
  saveSystems([sys]);
  setActiveSystemId(sys.id);
}

// ===== אנשי קשר - Google Sheets (דרך SheetDB) =====
// הכתובת אינה קבועה בקוד אלא מוזנת ע"י כל משתמש בהגדרות ונשמרת בהגדרות המערכת הפעילה -
// כך שכשהאתר מתפרסם ומופעל ע"י אנשים שונים (או ע"י אותו אדם עם כמה מערכות), כל מערכת
// מפנה לגיליון הפרטי שלה ולא לגיליון משותף שבו אנשים אחרים היו יכולים לראות/לערוך.
function getContactsApiUrl(){ const s = getActiveSystem(); return ((s && s.contactsApi) || '').trim(); }
function getContactsSource(){ const s = getActiveSystem(); return (s && s.contactsSource) || 'sheetdb'; }

// ===== העלאת תמונות - Cloudinary =====
const CLOUDINARY_CLOUD_NAME = 'rpbok3l7';
const CLOUDINARY_UPLOAD_PRESET = 'metailim';
async function uploadToCloudinary(file){
  const fd = new FormData();
  fd.append('file', file);
  fd.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);
  const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`, {
    method: 'POST',
    body: fd
  });
  if(!res.ok) throw new Error('שגיאת העלאה לקלאודינרי: ' + res.status);
  const data = await res.json();
  return data.secure_url;
}
const BAR_COUNT = 30;

const listEl = document.getElementById('list');
const extLabel = document.getElementById('extLabel');
const headerTitle = document.getElementById('headerTitle');
const settingsOverlay = document.getElementById('settingsOverlay');
const settingsTitle = document.getElementById('settingsTitle');
const settingsSystemsSection = document.getElementById('settingsSystemsSection');
const settingsSystemsList = document.getElementById('settingsSystemsList');
const labelInput = document.getElementById('labelInput');
const tokenInput = document.getElementById('tokenInput');
const extInput = document.getElementById('extInput');
const tzintukListInput = document.getElementById('tzintukListInput');
const contactsApiInput = document.getElementById('contactsApiInput');
const contactsSourceInput = document.getElementById('contactsSourceInput');
const speechApiKeyInput = document.getElementById('speechApiKeyInput');
const invitedNotice = document.getElementById('invitedNotice');
const addAnotherSystemBtn = document.getElementById('addAnotherSystemBtn');

let activeAudio = null;
let activePlayBtn = null;
let activeSetPlayed = null;
let audioCtx = null;

// מעקב אחרי שמות הקבצים שכבר מוצגים ברשימה, לצורך בדיקת רענון שקטה ברקע
let renderedFileNames = new Set();
let isPolling = false;
// דגל שמסמן שהעלאה עצמית מהאתר נמצאת כרגע בתהליך (מרגע קבלת אישור מהשרת ועד סיום סימון
// "שלי" על הקובץ החדש) - כדי שבדיקת הרקע השקטה (pollForNewRecordings) לא "תגנוב" בינתיים
// את גילוי הקובץ החדש ותרנדר אותו בלי סימון "שלי", לפני שההעלאה עצמה הספיקה לסמן אותו.
let uploadInProgress = false;

function getToken(){ const s = getActiveSystem(); return (s && s.token) || ''; }
function getExt(){ const s = getActiveSystem(); return (s && s.ext) || '1'; }
function getTzintukList(){ const s = getActiveSystem(); return (s && s.tzintukList) || ''; }
function getTzintukCallerId(){ const s = getActiveSystem(); return (s && s.tzintukCallerId) || ''; }

// ===== חלונות הודעה/אישור בעיצוב האתר (במקום alert/confirm/prompt של הדפדפן) =====
const dialogOverlay = document.getElementById('dialogOverlay');
const dialogTitle = document.getElementById('dialogTitle');
const dialogMsg = document.getElementById('dialogMsg');
const dialogCopy = document.getElementById('dialogCopy');
const dialogOk = document.getElementById('dialogOk');
const dialogCancel = document.getElementById('dialogCancel');
let dialogResolve = null;

// opts: {title, message, okText, cancelText (null = בלי כפתור ביטול), danger, copyText}
function appDialog(opts){
  if(dialogResolve) dialogResolve(false);
  return new Promise(resolve => {
    dialogResolve = resolve;
    dialogTitle.textContent = opts.title || '';
    dialogTitle.hidden = !opts.title;
    dialogMsg.textContent = opts.message || '';
    dialogOk.textContent = opts.okText || 'אישור';
    dialogOk.classList.toggle('danger-fill', !!opts.danger);
    dialogCancel.textContent = opts.cancelText || 'ביטול';
    dialogCancel.hidden = opts.cancelText === null;
    dialogCopy.hidden = !opts.copyText;
    dialogCopy.value = opts.copyText || '';
    dialogOverlay.classList.add('open');
    if(opts.copyText){ dialogCopy.focus(); dialogCopy.select(); }
    else dialogOk.focus();
  });
}
function closeDialog(result){
  dialogOverlay.classList.remove('open');
  const r = dialogResolve;
  dialogResolve = null;
  if(r) r(result);
}
dialogOk.onclick = () => closeDialog(true);
dialogCancel.onclick = () => closeDialog(false);

function appAlert(message, title){
  return appDialog({ title: title || '', message, okText: 'הבנתי', cancelText: null });
}
function appConfirm(message, opts){
  opts = opts || {};
  return appDialog({ title: opts.title || '', message, okText: opts.okText || 'אישור', cancelText: 'ביטול', danger: !!opts.danger });
}

// ממיר שגיאת רשת/שרת להודעה ברורה. fetch שנכשל לגמרי זורק TypeError (אין רשת, חסימה וכו').
function friendlyError(err){
  if(err instanceof TypeError){
    return { msg: 'אין חיבור לשרת. בדקו את החיבור לאינטרנט ונסו שוב.', detail: '' };
  }
  const detail = (err && err.message) || '';
  if(/token|password|login|authoriz|not.?valid|יש להתחבר|סיסמ/i.test(detail)){
    return { msg: 'ימות המשיח לא אישרו את הכניסה. בדקו את מספר המערכת והסיסמה בהגדרות.', detail };
  }
  return { msg: 'לא הצלחנו לטעון את ההקלטות.', detail };
}

// ===== ערכת צבעים (אוטומטי/בהיר/כהה) - העדפה של המכשיר =====
const LS_THEME = 'yemot_theme';
function getTheme(){ const t = localStorage.getItem(LS_THEME); return (t === 'light' || t === 'dark') ? t : 'auto'; }
function setTheme(t){
  if(t === 'light' || t === 'dark'){ localStorage.setItem(LS_THEME, t); document.documentElement.dataset.theme = t; }
  else { localStorage.removeItem(LS_THEME); delete document.documentElement.dataset.theme; }
}

// ===== התראות דפדפן =====
const LS_NOTIFY = 'yemot_notify';
function getNotifyEnabled(){ return localStorage.getItem(LS_NOTIFY) === '1'; }
function setNotifyEnabled(on){ if(on) localStorage.setItem(LS_NOTIFY, '1'); else localStorage.removeItem(LS_NOTIFY); }

// ===== מהירות ניגון (1x / 1.5x / 2x), משותפת לכל ההודעות =====
const LS_PLAYBACK_RATE = 'yemot_playback_rate';
const PLAYBACK_RATES = [1, 1.5, 2];
function getPlaybackRate(){
  const r = parseFloat(localStorage.getItem(LS_PLAYBACK_RATE));
  return PLAYBACK_RATES.includes(r) ? r : 1;
}
function cyclePlaybackRate(){
  const next = PLAYBACK_RATES[(PLAYBACK_RATES.indexOf(getPlaybackRate()) + 1) % PLAYBACK_RATES.length];
  localStorage.setItem(LS_PLAYBACK_RATE, String(next));
  return next;
}
function fmtRate(r){ return r + 'x'; }

// ===== "נשמעה / עוד לא נשמעה" לכל הודעה (נשמר במכשיר, לכל מערכת בנפרד) =====
let playedSet = null;
function playedKey(){ return 'yemot_played:' + (getActiveSystemId() || ''); }
function loadPlayedSet(){
  try{
    const raw = localStorage.getItem(playedKey());
    playedSet = raw ? new Set(JSON.parse(raw)) : null;
  }catch(err){ playedSet = null; }
  return playedSet;
}
function savePlayedSet(){
  if(!playedSet) return;
  try{ localStorage.setItem(playedKey(), JSON.stringify(Array.from(playedSet).slice(-3000))); }catch(err){}
}
function isPlayed(name){ return !playedSet || playedSet.has(name); }
function markPlayed(name){
  if(!playedSet) playedSet = new Set();
  if(playedSet.has(name)) return;
  playedSet.add(name);
  savePlayedSet();
}

// ===== הודעה אחרונה שנראתה בכל מערכת - בשביל מונה "לא נקראו" ברשימת המערכות =====
function lastSeenKey(id){ return 'yemot_last_seen:' + id; }
function getLastSeen(id){ return localStorage.getItem(lastSeenKey(id)) || ''; }
function setLastSeen(id, name){ if(id && name) localStorage.setItem(lastSeenKey(id), name); }
function countUnread(id, files){
  const last = getLastSeen(id);
  if(!last) return 0;
  const i = files.findIndex(f => f.name === last);
  return i === -1 ? 0 : files.length - 1 - i;
}

// ===== תאריכים =====
// מזהה תאריך (ושעה אם יש) מתוך מחרוזת: dd/mm/yyyy hh:mm או yyyy-mm-dd hh:mm(:ss)
function parseMsgDate(str){
  if(!str) return null;
  const s = String(str);
  let m = s.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{2}))?/);
  if(m) return { date: new Date(+m[3], +m[2] - 1, +m[1], +(m[4] || 0), +(m[5] || 0)), hasTime: m[4] != null };
  m = s.match(/(\d{4})[-_\/.](\d{1,2})[-_\/.](\d{1,2})(?:[ T_-]+(\d{1,2})[:_-](\d{2}))?/);
  if(m) return { date: new Date(+m[1], +m[2] - 1, +m[3], +(m[4] || 0), +(m[5] || 0)), hasTime: m[4] != null };
  return null;
}
function dayKeyOf(d){ return d.getFullYear() + '-' + d.getMonth() + '-' + d.getDate(); }
const HEB_WEEKDAYS = ['יום ראשון', 'יום שני', 'יום שלישי', 'יום רביעי', 'יום חמישי', 'יום שישי', 'שבת'];
function pad2(n){ return String(n).padStart(2, '0'); }
function fmtDateShort(d){ return pad2(d.getDate()) + '.' + pad2(d.getMonth() + 1) + '.' + d.getFullYear(); }
function fmtClock(d){ return pad2(d.getHours()) + ':' + pad2(d.getMinutes()); }
function dayLabel(d){
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const that = new Date(d); that.setHours(0, 0, 0, 0);
  const diff = Math.round((today - that) / 86400000);
  if(diff === 0) return 'היום';
  if(diff === 1) return 'אתמול';
  if(diff > 1 && diff < 7) return HEB_WEEKDAYS[that.getDay()];
  return fmtDateShort(d);
}

