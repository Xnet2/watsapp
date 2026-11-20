const ICON_PLAY = '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>';
const ICON_PAUSE = '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M6 5h4v14H6zM14 5h4v14h-4z"/></svg>';
const ICON_MIC = document.getElementById('micIcon').outerHTML;
const ICON_STOP = '<svg viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="6" width="12" height="12" rx="2"/></svg>';
const ICON_CHECK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>';
const ICON_TRASH = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>';
const ICON_PLUS = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>';

// צליל קטן ונעים בזמן מעבר אוטומטי להקלטה הבאה (כמו בוואטסאפ), נוצר עם Web Audio
// כדי לא להסתמך על קובץ סאונד חיצוני.
let sharedAudioCtx = null;
function playChime(){
  try{
    if(!sharedAudioCtx) sharedAudioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const ctx = sharedAudioCtx;
    const now = ctx.currentTime;
    // שני צלילים קצרים ורכים בהפרש של טרצה, בלי עלייה חדה בתדר - נשמע כמו "טוק-טוק" עדין
    const notes = [
      {freq:740, start:0,     dur:0.11},
      {freq:988, start:0.085, dur:0.15}
    ];
    notes.forEach(n => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = 'sine';
      o.frequency.setValueAtTime(n.freq, now + n.start);
      g.gain.setValueAtTime(0.0001, now + n.start);
      g.gain.exponentialRampToValueAtTime(0.085, now + n.start + 0.018);
      g.gain.exponentialRampToValueAtTime(0.0001, now + n.start + n.dur);
      o.connect(g); g.connect(ctx.destination);
      o.start(now + n.start);
      o.stop(now + n.start + n.dur + 0.02);
    });
  }catch(err){ /* אם הדפדפן חוסם אודיו ללא אינטראקציה - פשוט מדלגים על הצליל */ }
}

// צליל בודד ועולה - מסמן שההקלטה שלי עצמי עלתה בהצלחה. שונה במכוון מ-playChime
// (שני הטונים) כדי שיהיה ברור אם זו הודעה שאני שלחתי או הודעה חדשה שנכנסה מבחוץ.
function playUploadChime(){
  try{
    if(!sharedAudioCtx) sharedAudioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const ctx = sharedAudioCtx;
    const now = ctx.currentTime;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(600, now);
    o.frequency.exponentialRampToValueAtTime(1080, now + 0.14);
    g.gain.setValueAtTime(0.0001, now);
    g.gain.exponentialRampToValueAtTime(0.09, now + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.17);
    o.connect(g); g.connect(ctx.destination);
    o.start(now);
    o.stop(now + 0.19);
  }catch(err){ /* אם הדפדפן חוסם אודיו ללא אינטראקציה - פשוט מדלגים על הצליל */ }
}

function setStatus(msg, isError){
  if(activeAudio){ activeAudio.pause(); activeAudio = null; activePlayBtn = null; activeSetPlayed = null; }
  listEl.innerHTML = '';
  const div = document.createElement('div');
  div.className = 'status-line' + (isError ? ' error' : '');
  div.textContent = msg;
  listEl.appendChild(div);
}

function extPath(ext){
  return 'ivr2:/' + ext.replace(/^\/+|\/+$/g,'') + '/';
}

// זיהוי מספר שולח + תאריך משם קובץ בפורמט Phone-XXXXXXXXXX-Date-YYYY-MM-DD-HH-MM-SS
function parsePhoneAndDate(name){
  const m = (name || '').match(/Phone[-_](\d+)[-_]Date[-_](\d{4}[-_]\d{2}[-_]\d{2}[-_]\d{2}[-_]\d{2}[-_]\d{2})/i);
  if(!m) return null;
  const parts = m[2].split(/[-_]/);
  const dateLabel = parts.length === 6
    ? parts[2] + '/' + parts[1] + '/' + parts[0] + ' ' + parts[3] + ':' + parts[4]
    : m[2];
  return { phone: m[1], date: dateLabel };
}

// גיבוי לזיהוי מספר שולח: חיפוש כללי של שדה שנראה כמו מספר טלפון/מזהה מתקשר
// באובייקט הקובץ שמוחזר מהשרת, למקרה ששם הקובץ עצמו לא בפורמט Phone-...-Date-...
function extractPhoneFallback(file){
  const phoneKeyPattern = /^(phone|callerid|caller_id|calleridnum|ani|src|from|number|tel)$/i;
  for(const key of Object.keys(file)){
    if(!phoneKeyPattern.test(key)) continue;
    const raw = file[key];
    if(!raw) continue;
    const digits = String(raw).replace(/\D/g, '');
    if(digits.length >= 7) return digits;
  }
  return null;
}

// חיפוש כללי של שדה תאריך באובייקט הקובץ, כגיבוי כאשר אין דפוס Phone/Date בשם
function extractDateLabel(file){
  for(const key of Object.keys(file)){
    if(/date|time/i.test(key) && typeof file[key] === 'string' && file[key].length >= 8){
      return file[key];
    }
  }
  return null;
}

function fmtTime(sec){
  if(!isFinite(sec) || sec < 0) sec = 0;
  const m = Math.floor(sec/60);
  const s = Math.floor(sec%60);
  return m + ':' + String(s).padStart(2,'0');
}
// בשונה מ-fmtTime, זה מציג את הזמן שנותר עד סוף ההקלטה (duration - currentTime) ולא את
// הזמן שכבר עבר - כדי שהשעון ליד הגל יספור למטה (כמו בהודעות קוליות בוואטסאפ) במקום למעלה.
function fmtRemaining(currentTime, duration){
  if(!isFinite(duration) || duration < 0) return '0:00';
  return fmtTime(Math.max(0, duration - (currentTime || 0)));
}

// בודק אם שם קובץ נראה כמו הודעה קולית אמיתית ולא קובץ מערכת/תפריט (כמו M1253 או
// M382776447 שלפעמים מופיעים בתיקייה, לא במסגרת הסדר הרץ הרגיל של שמות ההקלטות).
// נחשב "הקלטה אמיתית" אם השם הוא:
//  1. מספר רץ פשוט בלבד (כמו 425, 426, 427...) - הפורמט הנפוץ להודעות בשלוחה, או
//  2. בפורמט Phone-...-Date-... (הודעות עם זיהוי שולח, כולל הקלטות שהועלו מהאתר הזה), או
//  3. בפורמט recording-YYYY-MM-DD-HH-MM-SS (הקלטות שהועלו מהאתר בלי "מי אני" מוגדר).
// כל שם אחר (כולל כזה שמתחיל באות, כמו קבצי מערכת) לא יוצג ברשימה.
function isRealRecordingName(name){
  if(parsePhoneAndDate(name)) return true;
  const base = (name || '').replace(/\.[^.]+$/, '');
  if(/^\d+$/.test(base)) return true;
  if(/^recording-\d{4}-\d{2}-\d{2}-\d{2}-\d{2}-\d{2}$/.test(base)) return true;
  return false;
}

// שולף את רשימת הקבצים מהשרת, מסנן החוצה קבצי מערכת/תפריט לפי שם (ר' isRealRecordingName),
// וממיין. משמש גם לטעינה הראשונית וגם לבדיקה השקטה של הקלטות חדשות.
async function fetchFileList(token, ext){
  const url = BASE_URL + 'GetIVR2Dir?token=' + encodeURIComponent(token) + '&path=' + encodeURIComponent(extPath(ext));
  const res = await fetch(url);
  const data = await res.json();
  if(data.responseStatus !== 'OK') throw new Error(data.message || data.responseStatus);

  let files = (data.files || []).filter(f => (f.fileType === 'AUDIO' || f.fileType === 'TTS') && isRealRecordingName(f.name));
  files.sort((a,b) => {
    const na = parseInt((a.name || '').match(/\d+/), 10);
    const nb = parseInt((b.name || '').match(/\d+/), 10);
    if(!isNaN(na) && !isNaN(nb)) return na - nb;
    return (a.name||'').localeCompare(b.name||'');
  });

  return files;
}

async function loadRecordings(){
  const token = getToken();
  const ext = getExt();
  headerTitle.textContent = systemLabel(getActiveSystem());

  if(!token){
    setStatus('לחצו על הגדרות למעלה כדי להזין טוקן ומספר שלוחה.');
    return;
  }

  setStatus('טוען הקלטות…');

  let files;
  try{
    files = await fetchFileList(token, ext);
  }catch(err){
    setStatus(
      'שגיאה בטעינת ההקלטות.\n' +
      'ייתכן שזו חסימת CORS של שרת ימות המשיח, או בעיית רשת.\n' +
      'פרטים טכניים: ' + err.message,
      true
    );
    return;
  }

  if(files.length === 0){
    setStatus('אין הקלטות להצגה בשלוחה ' + ext + '.');
    return;
  }

  listEl.innerHTML = '';
  renderedFileNames = new Set();
  for(const file of files){
    listEl.appendChild(buildRecItem(file, token, ext));
    renderedFileNames.add(file.name);
  }
  // פתיחה בסוף הרשימה - ההקלטה האחרונה תמיד גלויה
  listEl.scrollTop = listEl.scrollHeight;
}

// שולף את רשימת הקבצים העדכנית ומוסיף לרשימה המוצגת רק את מה שבאמת חדש (לפי renderedFileNames),
// בלי לנקות/לטעון מחדש את כל מה שכבר מוצג. משמש גם לבדיקה השקטה ברקע וגם מיד אחרי העלאה
// עצמית, כדי שלא תהיה קפיצת "טעינה מחדש" מיותרת בכל פעם שמעלים הקלטה.
// onNewFiles (נקרא רק מיד אחרי uploadRecording) - callback אסינכרוני שמקבל את הקבצים
// החדשים ורץ *לפני* שהם נבנים לתצוגה - כדי לשמור שיוך שולח בשרת (ר' saveRecordingAttribution)
// ושה-mine styling/שם השולח יחולו כבר מהרגע הראשון שההקלטה מוצגת, אצל כולם.
async function appendNewRecordings(onNewFiles){
  const token = getToken();
  const ext = getExt();
  if(!token) return [];
  const files = await fetchFileList(token, ext);
  const newFiles = files.filter(f => !renderedFileNames.has(f.name));
  if(newFiles.length === 0) return newFiles;

  if(onNewFiles){
    try{ await onNewFiles(newFiles); }
    catch(err){ console.warn('שגיאה בטיפול בקבצים חדשים:', err.message); }
  }

  // מרעננים אנשי קשר + שיוכי שולח לפני הבנייה לתצוגה: הקלטה חדשה יכולה להגיע ממשתמש אחר
  // שהעלה אותה ושמר עבורה שיוך שולח בגיליון המשותף (ר' saveRecordingAttribution) - בלי
  // הריענון הזה, המטמון המקומי (recAttributionCache) לא היה מכיר את השיוך הזה עד לטעינה
  // מחדש של הדף, וההקלטה הייתה מוצגת כ"לא מזוהה" עד אז.
  try{ await fetchContactsFromServer(); }
  catch(err){ console.warn('שגיאה ברענון אנשי קשר/שיוכים:', err.message); }

  const wasAtBottom = (listEl.scrollHeight - listEl.scrollTop - listEl.clientHeight) < 40;

  for(const file of newFiles){
    listEl.appendChild(buildRecItem(file, token, ext));
    renderedFileNames.add(file.name);
  }

  if(wasAtBottom){
    listEl.scrollTop = listEl.scrollHeight;
  }
  return newFiles;
}

// בדיקה שקטה ברקע כל כמה שניות: אם יש הקלטות חדשות מוסיפים אותן בעדינות לסוף הרשימה,
// בלי לרענן/לנקות את מה שכבר מוצג ובלי לקפוץ בגלילה - אלא אם המשתמש כבר היה בתחתית
// הרשימה, ואז גוללים בעדינות כדי לחשוף את ההודעה החדשה.
async function pollForNewRecordings(){
  if(isPolling) return;
  if(uploadInProgress) return;
  const token = getToken();
  if(!token) return;
  if(listEl.querySelector('.status-line')) return; // עוד לא נטענה רשימה בהצלחה בפעם הראשונה

  isPolling = true;
  try{
    const newFiles = await appendNewRecordings();
    if(newFiles.length === 0) return;

    // הקלטות שהתגלו כאן הגיעו ממקור חיצוני (למשל שיחה ישירה לשלוחה), ולא דרך
    // uploadRecording של האתר הזה - משמיעים צליל כניסת הודעה חדשה (שני טונים) ומצנתקים.
    playChime();
    sendTzintuk();
  }catch(err){
    // כשל שקט - לא מציגים שגיאה כדי לא להפריע לצפייה, פשוט מנסים שוב בבדיקה הבאה
    console.warn('בדיקת הקלטות חדשות נכשלה:', err.message);
  }finally{
    isPolling = false;
  }
}

setInterval(pollForNewRecordings, 8000);

// ===== גל קול =====
function getAudioCtx(){
  if(!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  return audioCtx;
}

function pseudoWaveform(seedStr){
  let seed = 0;
  for(let i=0;i<seedStr.length;i++) seed = (seed*31 + seedStr.charCodeAt(i)) >>> 0;
  const bars = [];
  for(let i=0;i<BAR_COUNT;i++){
    seed = (seed*1103515245 + 12345) >>> 0;
    const v = ((seed >>> 8) % 1000)/1000;
    // דפוס גלי מדומה, לא מחושב מהאודיו בפועל - שימוש רק כאשר קריאת הקובץ נחסמת (למשל CORS)
    bars.push(0.18 + v*0.75);
  }
  return bars;
}

async function computeWaveform(url){
  try{
    const res = await fetch(url);
    if(!res.ok) throw new Error('http ' + res.status);
    const buf = await res.arrayBuffer();
    const ctx = getAudioCtx();
    const audioBuf = await ctx.decodeAudioData(buf.slice(0));
    const raw = audioBuf.getChannelData(0);
    const blockSize = Math.max(1, Math.floor(raw.length / BAR_COUNT));
    const peaks = [];
    for(let i=0;i<BAR_COUNT;i++){
      let sum = 0;
      const start = i*blockSize;
      for(let j=0;j<blockSize;j++){ sum += Math.abs(raw[start+j] || 0); }
      peaks.push(sum/blockSize);
    }
    const max = Math.max(...peaks, 0.0001);
    // הקובץ המלא כבר בידיים (buf) בשלב הזה - יוצרים ממנו Blob URL מקומי כדי שהניגון בפועל
    // (ר' ensureAudio) יוכל להשתמש בו במקום לשלוף בשידור (streaming) ישירות מהשרת. ככה ריצה
    // קדימה/אחורה תוך כדי השמעה נשארת תמיד לגמרי מקומית ולא תלויה בתמיכת Range requests
    // בצד השרת - זה בדיוק מה שגרם בעבר לקפיצה חזרה לתחילת ההקלטה תוך כדי ניגון.
    const contentType = res.headers.get('content-type') || 'audio/mpeg';
    const blobUrl = URL.createObjectURL(new Blob([buf], {type: contentType}));
    return { peaks: peaks.map(p => Math.max(0.12, p/max)), duration: audioBuf.duration, blobUrl };
  }catch(err){
    return null;
  }
}

// ===== תמלול הודעה (Groq API - Whisper, יש מכסה חינמית: 2,000 בקשות ביום) =====
// שימו לב: זה *לא* ה-SpeechRecognition החינמי של הדפדפן - הוא לא יודע לתמלל קובץ הקלטה
// קיים, רק זרם מיקרופון חי. Groq מריצה את מודל Whisper בשרתים שלה ומחזירה טקסט - יש לה
// רמה חינמית נדיבה (בלי כרטיס אשראי), אבל דורשת מפתח API שמוגדר בהגדרות (getSpeechApiKey).
// הערה חשובה: אם התמלול נכשל עם שגיאת CORS בקונסול - Groq לא מתירה קריאה ישירה מהדפדפן
// מהמקור הזה, ואז צריך פרוקסי קטן (למשל Google Apps Script Web App) שמעביר את הבקשה הלאה.

// קאש תמלולים לפי מערכת+שם קובץ, כדי לא לתמלל שוב את אותה הודעה בכל טעינה/רענון.
const LS_TRANSCRIPTS_CACHE = 'yemot_transcripts_cache';
function getTranscriptsCache(){
  try{ return JSON.parse(localStorage.getItem(LS_TRANSCRIPTS_CACHE) || '{}'); }catch(err){ return {}; }
}
function transcriptCacheKey(fileName){ return (getActiveSystemId() || 'x') + '|' + fileName; }
function getCachedTranscript(fileName){ return getTranscriptsCache()[transcriptCacheKey(fileName)] || null; }
function setCachedTranscript(fileName, text){
  const cache = getTranscriptsCache();
  cache[transcriptCacheKey(fileName)] = text;
  try{ localStorage.setItem(LS_TRANSCRIPTS_CACHE, JSON.stringify(cache)); }catch(err){ /* אחסון מלא - פשוט לא יישמר קאש הפעם */ }
}

// שולח את קובץ ההקלטה כפי שהוא (multipart/form-data, בלי המרות) ל-Groq ומחזיר את הטקסט.
async function transcribeAudioUrl(url, fileName){
  const apiKey = getSpeechApiKey();
  if(!apiKey) throw new Error('לא הוגדר מפתח Groq API בהגדרות');
  const res = await fetch(url);
  if(!res.ok) throw new Error('שגיאה בהורדת ההקלטה (http ' + res.status + ')');
  const blob = await res.blob();

  const form = new FormData();
  form.append('file', blob, fileName || 'audio.wav');
  form.append('model', 'whisper-large-v3-turbo');
  form.append('language', 'he');
  form.append('response_format', 'json');

  const apiRes = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
    method: 'POST',
    headers: { 'Authorization': 'Bearer ' + apiKey },
    body: form
  });
  const data = await apiRes.json().catch(() => ({}));
  if(!apiRes.ok){
    throw new Error((data.error && data.error.message) || ('שגיאה מ-Groq (http ' + apiRes.status + ')'));
  }
  const text = (data.text || '').trim();
  return text || '(לא זוהה טקסט בהקלטה)';
}

const waveformObserver = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if(entry.isIntersecting && entry.target._loadWaveform){
      entry.target._loadWaveform();
      entry.target._loadWaveform = null;
      waveformObserver.unobserve(entry.target);
    }
  });
}, {root: listEl, threshold: 0.15});

function buildRecItem(file, token, ext){
  // שורת ההודעה: עמודה עם בועת ההודעה הקולית בלבד - אין יותר שם קבוע מעל הבועה.
  const row = document.createElement('div');
  row.className = 'rec-row';

  const playBtn = document.createElement('button');
  playBtn.className = 'play-btn';
  playBtn.innerHTML = ICON_PLAY;
  playBtn.setAttribute('aria-label', 'נגן');

  const col = document.createElement('div');
  col.className = 'rec-col';

  const phoneInfo = parsePhoneAndDate(file.name);
  const fallbackPhone = phoneInfo ? null : extractPhoneFallback(file);
  const matchedPhone = phoneInfo ? phoneInfo.phone : fallbackPhone;
  let contact = matchedPhone ? findContactByPhone(matchedPhone) : null;
  const genericDate = extractDateLabel(file);

  // שיוך שולח שנשמר בשרת (משותף לכולם) עבור הקלטות שהועלו מהאתר הזה - ר' saveRecordingAttribution.
  const attribution = contact ? null : getRecordingAttribution(file.name);
  if(attribution && !contact){
    // אם יש איש קשר תואם לפי המספר שנשמר בשיוך - עדיף אותו (תמונה/שם מעודכנים);
    // אחרת נבנה איש קשר "וירטואלי" מתוך התמונה שנשמרה בזמן ההעלאה.
    contact = findContactByPhone(attribution.phone) ||
      { id: null, name: attribution.name, phone: attribution.phone, photo: attribution.photo };
  }
  const meContact = getMeContact();
  const isMineByAttribution = !!(attribution && meContact && meContact.phone &&
    normalizePhone(meContact.phone) === normalizePhone(attribution.phone));

  // אם ההקלטה שייכת לאיש הקשר שסומן כ"אני" - מיישרים לשמאל, כמו הודעות יוצאות בוואטסאפ.
  if((contact && contact.id && contact.id === getMeContactId()) || isMineByAttribution) row.classList.add('rec-mine');

  // אין יותר שם/תאריך קבועים מעל הבועה - כל הפרטים עוברים לחלונית ריחוף על תמונת השולח.
  const fullDateStr = phoneInfo ? phoneInfo.date : genericDate;
  let dateOnly = '', timeOnly = '';
  if(fullDateStr){
    const sp = fullDateStr.split(' ');
    if(sp.length === 2){ dateOnly = sp[0]; timeOnly = sp[1]; }
    else { dateOnly = fullDateStr; }
  }
  const displayName = contact ? contact.name : (matchedPhone || 'לא מזוהה');

  const bubble = document.createElement('div');
  bubble.className = 'rec-bubble';

  const waveRow = document.createElement('div');
  waveRow.className = 'rec-wave-row';

  const waveform = document.createElement('div');
  waveform.className = 'waveform';
  waveform.tabIndex = 0;
  const bars = [];
  const initialPeaks = pseudoWaveform(file.name || String(Math.random()));
  initialPeaks.forEach(p => {
    const bar = document.createElement('div');
    bar.className = 'wf-bar';
    bar.style.height = Math.round(p*22) + 'px';
    waveform.appendChild(bar);
    bars.push(bar);
  });

  // עיגול-מחוון על גבי הגל, בדיוק כמו בוואטסאפ, שנע לפי אחוז ההשמעה (מימין לשמאל, כמו סדר הפסים)
  const thumb = document.createElement('div');
  thumb.className = 'wf-thumb';
  thumb.style.right = '0%';
  waveform.appendChild(thumb);

  function setPeaks(peaks){
    peaks.forEach((p,i) => { if(bars[i]) bars[i].style.height = Math.round(p*22) + 'px'; });
  }
  function setPlayedRatio(ratio){
    ratio = Math.max(0, Math.min(1, ratio || 0));
    const exact = ratio * BAR_COUNT;
    const cut = Math.floor(exact);
    const frac = exact - cut; // התקדמות חלקית בתוך הפס הנוכחי, למעבר חלק בלי קפיצות
    bars.forEach((b,i) => {
      if(i < cut){
        b.classList.add('played');
        b.style.background = '';
      } else if(i === cut && frac > 0){
        b.classList.remove('played');
        const pct = (frac*100).toFixed(1) + '%';
        b.style.background = 'linear-gradient(to left, var(--accent) ' + pct + ', #D1D7DB ' + pct + ')';
      } else {
        b.classList.remove('played');
        b.style.background = '';
      }
    });
    thumb.style.right = (ratio*100) + '%';
  }

  const timeLabel = document.createElement('span');
  timeLabel.className = 'rec-time';
  timeLabel.textContent = '0:00';

  waveRow.appendChild(waveform);
  waveRow.appendChild(timeLabel);

  // תמונת השולח משובצת בתוך הבועה עצמה, עם תג מיקרופון קטן על פינתה - בדיוק כמו הודעה קולית בוואטסאפ.
  // מעבר עכבר על התמונה חושף חלונית קטנה עם השם, התאריך, השעה ומשך ההקלטה.
  const avatarWrap = document.createElement('div');
  avatarWrap.className = 'voice-avatar-wrap';

  const avatar = document.createElement('div');
  avatar.className = 'voice-avatar';
  avatar.innerHTML =
    '<div class="voice-avatar-img">' + contactAvatarHTML(contact) + '</div>' +
    '<span class="voice-avatar-badge">' + ICON_MIC + '</span>';

  const tooltip = document.createElement('div');
  tooltip.className = 'voice-tooltip';

  const ttName = document.createElement('b');
  ttName.textContent = displayName;
  tooltip.appendChild(ttName);

  if(dateOnly){
    const r = document.createElement('div');
    r.className = 'tt-row';
    r.textContent = 'תאריך: ' + dateOnly;
    tooltip.appendChild(r);
  }
  if(timeOnly){
    const r = document.createElement('div');
    r.className = 'tt-row';
    r.textContent = 'שעה: ' + timeOnly;
    tooltip.appendChild(r);
  }
  const durRow = document.createElement('div');
  durRow.className = 'tt-row';
  durRow.textContent = 'משך: ';
  const durVal = document.createElement('span');
  durVal.className = 'tt-dur';
  durVal.textContent = '0:00';
  durRow.appendChild(durVal);
  tooltip.appendChild(durRow);

  if(!contact && matchedPhone){
    const addLink = document.createElement('button');
    addLink.type = 'button';
    addLink.className = 'tt-add';
    addLink.innerHTML = ICON_PLUS + '<span>הוספה לאנשי קשר</span>';
    addLink.onclick = (e) => { e.stopPropagation(); openContactEdit(null, matchedPhone); };
    tooltip.appendChild(addLink);
  }

  avatarWrap.appendChild(avatar);
  avatarWrap.appendChild(tooltip);

  // ממקמים את החלונית ביחס למסך (fixed) בכל פעם שעוברים עם העכבר מעל התמונה,
  // כדי שהיא תמיד תופיע מעל התמונה במקום להיחתך ע"י גבול הרשימה הגוללת.
  function positionVoiceTooltip(){
    const rect = avatar.getBoundingClientRect();
    const margin = 8;
    const centerX = rect.left + rect.width/2;
    const tw = tooltip.offsetWidth; // נמדד תקין גם כש-visibility:hidden
    let left = centerX - tw/2;
    left = Math.max(margin, Math.min(left, window.innerWidth - tw - margin));
    tooltip.style.left = left + 'px';
    tooltip.style.bottom = (window.innerHeight - (rect.top - 9)) + 'px';
    tooltip.style.setProperty('--arrow-x', (centerX - left) + 'px');
  }
  avatarWrap.addEventListener('mouseenter', () => {
    positionVoiceTooltip();
    tooltip.classList.add('show');
  });
  avatarWrap.addEventListener('mouseleave', () => {
    tooltip.classList.remove('show');
  });

  bubble.appendChild(avatarWrap);
  bubble.appendChild(playBtn);
  bubble.appendChild(waveRow);
  col.appendChild(bubble);

  // ===== תמלול הודעה - אזור מתחת לבועה, לפי דרישה (כפתור "תמלל"), עם קאש ואפשרות הרחבה =====
  const transcriptWrap = document.createElement('div');
  transcriptWrap.className = 'transcript-wrap';
  col.appendChild(transcriptWrap);

  function renderTranscriptBox(text){
    transcriptWrap.innerHTML = '';
    const box = document.createElement('div');
    box.className = 'transcript-box';
    const p = document.createElement('p');
    p.className = 'transcript-text collapsed';
    p.textContent = text;
    box.appendChild(p);
    const toggle = document.createElement('button');
    toggle.type = 'button';
    toggle.className = 'transcript-toggle';
    toggle.textContent = 'הצג עוד';
    toggle.onclick = () => {
      const expanded = p.classList.toggle('collapsed') === false;
      toggle.textContent = expanded ? 'הצג פחות' : 'הצג עוד';
    };
    box.appendChild(toggle);
    transcriptWrap.appendChild(box);
  }

  function renderTranscribeButton(){
    transcriptWrap.innerHTML = '';
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'transcript-btn';
    btn.innerHTML = ICON_MIC + '<span>תמלול הודעה</span>';
    btn.onclick = async () => {
      btn.disabled = true;
      btn.innerHTML = '<span>מתמלל…</span>';
      try{
        const text = await transcribeAudioUrl(src, file.name);
        setCachedTranscript(file.name, text);
        renderTranscriptBox(text);
      }catch(err){
        transcriptWrap.innerHTML = '';
        const errBox = document.createElement('div');
        errBox.className = 'transcript-box';
        const errP = document.createElement('p');
        errP.className = 'transcript-text error';
        errP.textContent = 'שגיאה בתמלול: ' + err.message;
        errBox.appendChild(errP);
        transcriptWrap.appendChild(errBox);
      }
    };
    transcriptWrap.appendChild(btn);
  }

  const cachedTranscript = getCachedTranscript(file.name);
  if(cachedTranscript) renderTranscriptBox(cachedTranscript);
  else renderTranscribeButton();

  row.appendChild(col);

  const src = BASE_URL + 'DownloadFile?token=' + encodeURIComponent(token) +
              '&path=' + encodeURIComponent(extPath(ext) + file.name);

  // הבטחה משותפת אחת לכל שורה עבור טעינת/פענוח קובץ ההקלטה המלא - גם חישוב הגל
  // (row._loadWaveform) וגם הניגון בפועל (ensureAudio, בהמשך) משתמשים באותה קריאה, כדי
  // שלא יתבצע אותו fetch פעמיים, ובעיקר כדי שהניגון יוכל להשתמש ב-Blob URL המקומי שנוצר
  // כאן (ר' הערה ב-ensureAudio) במקום לשדר ישירות מהשרת.
  let waveformDataPromise = null;
  let waveformDataResult = null;
  function getWaveformData(){
    if(!waveformDataPromise){
      waveformDataPromise = computeWaveform(src).then(result => {
        waveformDataResult = result;
        return result;
      });
    }
    return waveformDataPromise;
  }

  // טעינת גל קול אמיתי כאשר הפריט נכנס לתצוגה. אם הקריאה נחסמת (למשל CORS)
  // נשאר הדפוס המדומה שכבר מוצג, כדי שהתצוגה תמיד תיראה כמו הודעה קולית.
  row._loadWaveform = async () => {
    const result = await getWaveformData();
    if(result){
      setPeaks(result.peaks);
      if(result.duration){
        durVal.textContent = fmtTime(result.duration);
        // מציגים את משך ההודעה בספירה לאחור כבר עכשיו (לפני שהופעלה בכלל ניגון),
        // אבל רק אם הניגון בפועל עוד לא נוצר/החל - אחרת לא לדרוס תצוגה שכבר מבוססת
        // על audio.duration/audio.currentTime האמיתיים.
        if(!audio) timeLabel.textContent = fmtRemaining(0, result.duration);
      }
    }
  };
  waveformObserver.observe(row);

  let audio = null;
  let waveRafId = null;
  // יחס השמעה שממתין להחלה ברגע שה-metadata (ומכך audio.duration) יהיו זמינים - נחוץ כי
  // preload='metadata' לא מבטיח זמינות מיידית וסינכרונית של duration בקליק הראשון על הגל,
  // לפני שהניגון אי-פעם הופעל.
  let pendingSeekRatio = null;

  // עדכון הגל הרץ בכל פריים (במקום להסתמך רק על אירוע timeupdate הדליל),
  // כדי שהמילוי יתקדם בצורה חלקה במקום לקפוץ כמה פסים בבת אחת.
  function stepWaveform(){
    if(!audio || audio.paused) { waveRafId = null; return; }
    setPlayedRatio(audio.duration ? audio.currentTime/audio.duration : 0);
    waveRafId = requestAnimationFrame(stepWaveform);
  }

  function ensureAudio(){
    if(audio) return audio;
    // אם קובץ ההקלטה כבר ירד במלואו (למשל כי הגל כבר חושב ברקע לפני שנלחץ ניגון) - מנגנים
    // ישירות מ-Blob URL מקומי במקום מ-streaming מהשרת. זה קריטי לריצה קדימה/אחורה אמינה תוך
    // כדי השמעה: אם השרת של ימות המשיח לא תומך ב-Range requests, קפיצה ל-currentTime על
    // מקור שמתקבל ב-streaming עלולה לגרום לדפדפן לבקש מחדש את הקובץ מההתחלה ולא לקבל את
    // הבייטים של המיקום המבוקש - ואז ההשמעה "קופצת" רגע למיקום החדש ומיד חוזרת לתחילת
    // ההקלטה ברגע שהבקשה החוזרת מגיעה. Blob URL הוא לגמרי מקומי אז הבעיה הזו לא קיימת בו.
    const readyBlobUrl = (waveformDataResult && waveformDataResult.blobUrl) || null;
    audio = new Audio(readyBlobUrl || src);
    audio._usingBlob = !!readyBlobUrl;
    // preload='auto' (ולא רק 'metadata') - כדי שהדפדפן יתחיל להוריד את כל קובץ ההקלטה ברקע
    // כבר מרגע שהיא נכנסת לתצוגה, ולא רק כשלוחצים "נגן".
    audio.preload = 'auto';

    // אם הקובץ עדיין לא היה מוכן כ-Blob ברגע שנוצר האלמנט (התחלנו לנגן מה-streaming URL כדי
    // שההפעלה תרגיש מיידית) - ברגע שההורדה המלאה לצורך הגל מסתיימת, מחליפים את המקור ל-Blob
    // המקומי "בשקט" (שומרים על אותו מיקום/מצב ניגון), כדי שמעכשיו והלאה כל seek יהיה מקומי.
    if(!readyBlobUrl){
      getWaveformData().then(result => {
        if(!result || !result.blobUrl || !audio || audio._usingBlob) return;
        const wasPlaying = !audio.paused;
        const t = audio.currentTime || 0;
        audio._usingBlob = true;
        const onReady = () => {
          audio.removeEventListener('loadedmetadata', onReady);
          audio.currentTime = t;
          if(wasPlaying) audio.play();
        };
        audio.addEventListener('loadedmetadata', onReady);
        audio.src = result.blobUrl;
      });
    }

    audio.addEventListener('loadedmetadata', () => {
      if(audio.paused) timeLabel.textContent = fmtRemaining(audio.currentTime, audio.duration);
      if(audio.duration) durVal.textContent = fmtTime(audio.duration);
      // אם המשתמש כבר לחץ על הגל לפני שה-metadata נטענה - מבצעים עכשיו את הקפיצה שהמתינה.
      if(pendingSeekRatio !== null && audio.duration){
        audio.currentTime = pendingSeekRatio * audio.duration;
        setPlayedRatio(pendingSeekRatio);
        timeLabel.textContent = fmtRemaining(audio.currentTime, audio.duration);
        pendingSeekRatio = null;
      }
    });
    audio.addEventListener('timeupdate', () => {
      timeLabel.textContent = fmtRemaining(audio.currentTime, audio.duration);
    });
    audio.addEventListener('ended', () => {
      playBtn.innerHTML = ICON_PLAY;
      setPlayedRatio(0);
      timeLabel.textContent = fmtRemaining(0, audio.duration);
      if(activeAudio === audio){ activeAudio = null; activePlayBtn = null; activeSetPlayed = null; }

      // מעבר אוטומטי להקלטה הבאה ברשימה, עם צליל קטן קודם - כמו בוואטסאפ.
      const next = row.nextElementSibling;
      if(next && next.classList && next.classList.contains('rec-row')){
        playChime();
        setTimeout(() => {
          const nextBtn = next.querySelector('.play-btn');
          if(nextBtn) nextBtn.click();
        }, 350);
      }
    });
    return audio;
  }

  playBtn.onclick = () => {
    ensureAudio();
    if(activeAudio && activeAudio !== audio){
      activeAudio.pause();
      if(activePlayBtn) activePlayBtn.innerHTML = ICON_PLAY;
      if(activeSetPlayed) activeSetPlayed(0);
    }
    if(audio.paused){
      audio.play();
      playBtn.innerHTML = ICON_PAUSE;
      activeAudio = audio;
      activePlayBtn = playBtn;
      activeSetPlayed = setPlayedRatio;
      if(waveRafId === null) waveRafId = requestAnimationFrame(stepWaveform);
    } else {
      audio.pause();
      playBtn.innerHTML = ICON_PLAY;
    }
  };

  // לוחצים על הגל כדי להריץ קדימה/אחורה - בכל מצב: לפני שהופעלה בכלל, תוך כדי שהיא מתנגנת,
  // או אחרי השהיה. אם ה-duration עדיין לא ידוע (metadata לא נטענה עדיין), שומרים את היחס
  // המבוקש ומחילים אותו ברגע שהיא תיטען (ר' pendingSeekRatio ב-ensureAudio), ובינתיים כבר
  // מזיזים את התצוגה (הכדור/מילוי הגל) כדי שהלחיצה תרגיש מיידית.
  // הערה: בחלק מהדפדפנים/ה-WebView (כמו כשהאתר עטוף כאפליקציה), שינוי currentTime תוך כדי
  // שההקלטה מתנגנת בפועל לא נתפס - צריך לעצור לרגע, לקבוע את הזמן החדש, ואז להמשיך לנגן,
  // אחרת הריצה קדימה/אחורה פשוט לא קורית תוך כדי השמעה (אבל עובדת לפני/אחרי).
  // מונה שמתקדם בכל קליק על הגל, כדי שאם המשתמש לוחץ כמה פעמים ברצף (למשל גורר את הדעת
  // בין נקודות שונות) - רק ה-seek האחרון יפעיל בפועל את audio.play() כשה-'seeked' שלו יגיע,
  // ולא כל ה-listeners הישנים שעוד ממתינים לאירוע שכבר לא רלוונטי.
  let seekToken = 0;
  waveform.onclick = (e) => {
    ensureAudio();
    const rect = waveform.getBoundingClientRect();
    // הפסים בסדר RTL (התחלה מימין), אז יחס ההשמעה נמדד מהקצה הימני ולא מהשמאלי
    const ratio = Math.max(0, Math.min(1, 1 - ((e.clientX - rect.left) / rect.width)));
    if(audio.duration && isFinite(audio.duration)){
      const wasPlaying = !audio.paused;
      const myToken = ++seekToken;
      if(wasPlaying) audio.pause();
      const target = ratio * audio.duration;
      setPlayedRatio(ratio);
      timeLabel.textContent = fmtRemaining(target, audio.duration);
      pendingSeekRatio = null;
      // חשוב: לא קוראים ל-audio.play() מיד אחרי שינוי currentTime. שינוי currentTime הוא
      // פעולה א-סינכרונית (יש שלב seeking שנגמר רק כשמגיע אירוע 'seeked') - ובחלק
      // מהדפדפנים/ה-WebView, אם קוראים ל-play() לפני שה-seek בפועל הסתיים, הניגון פשוט
      // ממשיך מהמיקום הישן (או קופץ בחזרה להתחלה) במקום מהמיקום החדש. לכן ממתינים בפועל
      // לאירוע 'seeked' (או 'timeupdate' כגיבוי, למקרה שהדפדפן לא יורה 'seeked' כשמצפים)
      // ורק אז מפעילים מחדש את הניגון.
      if(wasPlaying){
        const resumePlayback = () => {
          audio.removeEventListener('seeked', resumePlayback);
          audio.removeEventListener('timeupdate', resumePlayback);
          if(myToken !== seekToken) return; // בינתיים בוצע seek נוסף - מתעלמים מהישן
          audio.play();
          if(waveRafId === null) waveRafId = requestAnimationFrame(stepWaveform);
        };
        audio.addEventListener('seeked', resumePlayback);
        audio.addEventListener('timeupdate', resumePlayback);
      }
      audio.currentTime = target;
    } else {
      pendingSeekRatio = ratio;
      setPlayedRatio(ratio);
      if(audio.readyState === 0) audio.load();
    }
  };


  // מחיקה עכשיו דרך תפריט קליק ימני על הבועה, כמו בוואטסאפ, ולא כפתור קבוע על המסך.
  async function deleteRecording(){
    const ok = confirm('למחוק את ההקלטה "' + (file.name || '') + '"? הפעולה אינה הפיכה.');
    if(!ok) return;
    bubble.style.opacity = '.5';
    bubble.style.pointerEvents = 'none';
    const delUrl = BASE_URL + 'FileAction?token=' + encodeURIComponent(token) +
                   '&action=delete&what=' + encodeURIComponent(extPath(ext) + file.name);
    try{
      const res = await fetch(delUrl);
      const data = await res.json();
      if(data.responseStatus === 'OK'){
        if(activeAudio === audio){ activeAudio = null; activePlayBtn = null; activeSetPlayed = null; }
        if(waveformDataResult && waveformDataResult.blobUrl) URL.revokeObjectURL(waveformDataResult.blobUrl);
        renderedFileNames.delete(file.name);
        row.remove();
      } else {
        alert('שגיאה במחיקה: ' + (data.message || data.responseStatus));
        bubble.style.opacity = '';
        bubble.style.pointerEvents = '';
      }
    }catch(err){
      alert('שגיאה במחיקה (ייתכן חסימת CORS): ' + err.message);
      bubble.style.opacity = '';
      bubble.style.pointerEvents = '';
    }
  }
  bubble.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    openCtxMenu(e.clientX, e.clientY, deleteRecording);
  });

  return row;
}

