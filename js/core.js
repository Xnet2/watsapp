const ctxMenu = document.getElementById('ctxMenu');
const ctxDeleteBtn = document.getElementById('ctxDeleteBtn');
let ctxDeleteHandler = null;

function openCtxMenu(x, y, onDelete){
  ctxDeleteHandler = onDelete;
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
  if(ctxMenu.classList.contains('open') && !ctxMenu.contains(e.target)) closeCtxMenu();
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

