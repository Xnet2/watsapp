const micBtn = document.getElementById('micBtn');
const recTimer = document.getElementById('recTimer');
const recTimerText = document.getElementById('recTimerText');
const placeholderText = document.getElementById('placeholderText');
const uploadBtn = document.getElementById('uploadBtn');
const fileInput = document.getElementById('fileInput');

let mediaRecorder = null;
let recordedChunks = [];
let recordStartTime = 0;
let recordTimerInterval = null;
let isRecording = false;

// לחיצה קצרה מתחילה הקלטה ולחיצה נוספת עוצרת. החזקה ארוכה: מקליטים כל עוד מחזיקים,
// ושחרור עוצר ופותח את הבדיקה לפני שליחה (כמו בוואטסאפ).
const HOLD_MS = 350;
let pressStartedAt = 0;
let pressing = false;
let startedByThisPress = false;
function setHoldUi(on){
  micBtn.classList.toggle('holding', on);
  recTimer.classList.toggle('hold', on);
}
micBtn.addEventListener('pointerdown', async (e) => {
  if(e.button !== 0) return;
  pressing = true;
  pressStartedAt = Date.now();
  if(isRecording){ startedByThisPress = false; return; }
  startedByThisPress = true;
  try{ micBtn.setPointerCapture(e.pointerId); }catch(err){}
  setTimeout(() => { if(pressing && isRecording && startedByThisPress) setHoldUi(true); }, HOLD_MS);
  await startRecording();
});
function endPress(){
  if(!pressing) return;
  pressing = false;
  const held = Date.now() - pressStartedAt >= HOLD_MS;
  if(startedByThisPress){
    startedByThisPress = false;
    if(isRecording && held) stopRecording();
  } else if(isRecording){
    stopRecording();
  }
  setHoldUi(false);
}
micBtn.addEventListener('pointerup', endPress);
micBtn.addEventListener('pointercancel', endPress);
micBtn.addEventListener('contextmenu', (e) => e.preventDefault());
// מקלדת (Enter/רווח) - מפעילה click בלי אירועי pointer
micBtn.addEventListener('click', (e) => {
  if(e.detail !== 0) return;
  if(isRecording) stopRecording(); else startRecording();
});

async function startRecording(){
  if(!getToken()){
    appAlert('קודם צריך לחבר מערכת בהגדרות.');
    return;
  }
  try{
    const stream = await navigator.mediaDevices.getUserMedia({audio:true});
    recordedChunks = [];
    mediaRecorder = new MediaRecorder(stream);
    mediaRecorder.ondataavailable = e => { if(e.data.size > 0) recordedChunks.push(e.data); };
    mediaRecorder.onstop = () => {
      stream.getTracks().forEach(t => t.stop());
      const blob = new Blob(recordedChunks, {type: mediaRecorder.mimeType || 'audio/webm'});
      showRecordPreview(blob, 'mic');
    };
    mediaRecorder.start();
    isRecording = true;
    micBtn.classList.add('recording');
    micBtn.innerHTML = ICON_STOP;
    placeholderText.style.display = 'none';
    recTimer.style.display = 'flex';
    recordStartTime = Date.now();
    recordTimerInterval = setInterval(() => {
      const secs = Math.floor((Date.now()-recordStartTime)/1000);
      const mm = String(Math.floor(secs/60)).padStart(2,'0');
      const ss = String(secs%60).padStart(2,'0');
      recTimerText.textContent = mm+':'+ss;
    }, 250);
  }catch(err){
    appAlert('הדפדפן לא מאפשר גישה למיקרופון. אשרו גישה למיקרופון בהגדרות האתר ונסו שוב.', 'אין גישה למיקרופון');
  }
}

function stopRecording(){
  if(mediaRecorder && isRecording){
    mediaRecorder.stop();
  }
  isRecording = false;
  micBtn.classList.remove('recording');
  micBtn.innerHTML = ICON_MIC;
  placeholderText.style.display = 'block';
  recTimer.style.display = 'none';
  clearInterval(recordTimerInterval);
}

uploadBtn.onclick = () => fileInput.click();
fileInput.onchange = () => {
  if(fileInput.files && fileInput.files[0]){
    showRecordPreview(fileInput.files[0], 'file');
    fileInput.value = '';
  }
};

// ===== בדיקה לפני שליחה - נגן קטן לניגון ההקלטה/הקובץ שנבחר, עם אפשרות למחיקה,
// הקלטה מחדש (או בחירת קובץ אחר), או שליחה בפועל. שום דבר לא מועלה לשרת עד לחיצה על "שליחה". =====
const recordPreviewOverlay = document.getElementById('recordPreviewOverlay');
const previewPlayBtn = document.getElementById('previewPlayBtn');
const previewProgress = document.getElementById('previewProgress');
const previewProgressFill = document.getElementById('previewProgressFill');
const previewTimeLabel = document.getElementById('previewTimeLabel');
const previewCancelBtn = document.getElementById('previewCancelBtn');
const previewRedoBtn = document.getElementById('previewRedoBtn');
const previewSendBtn = document.getElementById('previewSendBtn');

let previewBlob = null;
let previewKind = null; // 'mic' | 'file'
let previewAudio = null;
let previewObjectUrl = null;

function showRecordPreview(blob, kind){
  previewBlob = blob;
  previewKind = kind;
  previewObjectUrl = URL.createObjectURL(blob);
  previewAudio = new Audio(previewObjectUrl);
  previewPlayBtn.innerHTML = ICON_PLAY;
  previewProgressFill.style.width = '0%';
  previewTimeLabel.textContent = '0:00';

  previewAudio.addEventListener('loadedmetadata', () => {
    if(previewAudio.paused) previewTimeLabel.textContent = fmtTime(previewAudio.duration);
  });
  previewAudio.addEventListener('timeupdate', () => {
    const ratio = previewAudio.duration ? previewAudio.currentTime/previewAudio.duration : 0;
    previewProgressFill.style.width = (ratio*100) + '%';
    previewTimeLabel.textContent = fmtRemaining(previewAudio.currentTime, previewAudio.duration);
  });
  previewAudio.addEventListener('ended', () => {
    previewPlayBtn.innerHTML = ICON_PLAY;
    previewProgressFill.style.width = '0%';
    previewTimeLabel.textContent = fmtTime(previewAudio.duration);
  });

  previewRedoBtn.textContent = kind === 'mic' ? 'הקלטה מחדש' : 'בחירת קובץ אחר';
  recordPreviewOverlay.classList.add('open');
}

function closeRecordPreview(){
  recordPreviewOverlay.classList.remove('open');
  if(previewAudio){ previewAudio.pause(); previewAudio = null; }
  if(previewObjectUrl){ URL.revokeObjectURL(previewObjectUrl); previewObjectUrl = null; }
  previewBlob = null;
  previewKind = null;
}

previewPlayBtn.onclick = () => {
  if(!previewAudio) return;
  if(previewAudio.paused){
    previewAudio.play().catch(() => {});
    previewPlayBtn.innerHTML = ICON_PAUSE;
  } else {
    previewAudio.pause();
    previewPlayBtn.innerHTML = ICON_PLAY;
  }
};

previewProgress.onclick = (e) => {
  if(!previewAudio || !previewAudio.duration || !isFinite(previewAudio.duration)) return;
  const rect = previewProgress.getBoundingClientRect();
  // RTL - נמדד מהקצה הימני, כמו הגל בתוך בועות ההודעה
  const ratio = Math.max(0, Math.min(1, 1 - ((e.clientX - rect.left) / rect.width)));
  const wasPlaying = !previewAudio.paused;
  if(wasPlaying) previewAudio.pause();
  previewAudio.currentTime = ratio * previewAudio.duration;
  previewProgressFill.style.width = (ratio*100) + '%';
  previewTimeLabel.textContent = fmtRemaining(previewAudio.currentTime, previewAudio.duration);
  if(wasPlaying) previewAudio.play().catch(() => {});
};

previewCancelBtn.onclick = () => {
  closeRecordPreview();
};

previewRedoBtn.onclick = () => {
  const kind = previewKind;
  closeRecordPreview();
  if(kind === 'mic') startRecording();
  else fileInput.click();
};

previewSendBtn.onclick = () => {
  const blob = previewBlob;
  closeRecordPreview();
  if(blob) uploadRecording(blob);
};

// בונה שם קובץ זמני בלבד להעלאה. מאז המעבר ל-autoNumbering=true (ר' uploadRecording)
// ימות המשיח מתעלם משם הקובץ הזה לגמרי וקובע לו בעצמו שם/מספר לפי הרצף הרגיל של השלוחה -
// כך שההקלטה תיכנס לרצף הרגיל ותהיה ניתנת להשמעה בטלפון (במקום להישמר עם שם Phone-...-Date-...
// שהטלפון לא מזהה כחלק מרצף ההודעות). השם עצמו כאן משמש רק כדי שיהיה ל-FormData שם קובץ תקין.
function buildUploadFileName(audioExt){
  const pad = n => String(n).padStart(2,'0');
  const now = new Date();
  const dateStr = now.getFullYear() + '-' + pad(now.getMonth()+1) + '-' + pad(now.getDate()) + '-' +
                  pad(now.getHours()) + '-' + pad(now.getMinutes()) + '-' + pad(now.getSeconds());
  return 'recording-' + dateStr + '.' + audioExt;
}

// סיומת קובץ לפי סוג ההקלטה בפועל. ספארי (אייפון/מק) מקליט mp4/aac ולא webm, וקובץ
// שנשלח עם סיומת לא נכונה עלול להיכשל בהמרה בצד של ימות המשיח.
function audioExtForType(type){
  const t = String(type || '').toLowerCase();
  if(t.includes('wav')) return 'wav';
  if(t.includes('mpeg') || t.includes('mp3')) return 'mp3';
  if(t.includes('mp4') || t.includes('aac') || t.includes('m4a')) return 'm4a';
  if(t.includes('ogg')) return 'ogg';
  return 'webm';
}

// מנסה לזהות מתשובת UploadFile את שם הקובץ שימות המשיח נתנה להקלטה (בגלל autoNumbering).
function uploadedNameFrom(data){
  for(const key of ['path', 'filePath', 'file', 'fileName', 'name']){
    const v = data && data[key];
    if(typeof v === 'string' && v) return v.split('/').pop();
  }
  return '';
}
function baseName(name){ return String(name || '').replace(/\.[^.]+$/, ''); }

// הודעת שגיאה בהעלאה עם אפשרות לנסות שוב (ההקלטה נשמרת בזיכרון עד שמבטלים).
function showUploadError(item, statusText, msg, blob){
  item.classList.add('error-item');
  statusText.className = 'status-text error';
  statusText.textContent = msg;
  const actions = document.createElement('div');
  actions.className = 'upload-actions';
  const retry = document.createElement('button');
  retry.type = 'button';
  retry.className = 'linklike';
  retry.textContent = 'לנסות שוב';
  retry.onclick = () => { item.remove(); uploadRecording(blob); };
  const cancel = document.createElement('button');
  cancel.type = 'button';
  cancel.className = 'linklike danger';
  cancel.textContent = 'ביטול';
  cancel.onclick = () => item.remove();
  actions.appendChild(retry);
  actions.appendChild(cancel);
  item.appendChild(actions);
}

async function uploadRecording(blob){
  const token = getToken();
  const ext = getExt();
  if(!token){ appAlert('קודם צריך לחבר מערכת בהגדרות.'); return; }

  if(listEl.querySelector('.status-line')) listEl.innerHTML = '';
  const emptyState = listEl.querySelector('.empty-state');
  if(emptyState) emptyState.remove();

  const item = document.createElement('div');
  item.className = 'rec-item pending';
  const statusText = document.createElement('span');
  statusText.className = 'status-text';
  statusText.textContent = 'שולח הקלטה חדשה…';
  item.appendChild(statusText);
  listEl.appendChild(item);
  listEl.scrollTop = listEl.scrollHeight;

  uploadInProgress = true;

  const guessedExt = audioExtForType(blob.type);
  const fileName = buildUploadFileName(guessedExt);

  // חשוב: בעבר הועלה כאן עם autoNumbering=false ושם קובץ מיוחד (Phone-...-Date-...), כדי
  // לשמר בשם הקובץ מי שלח את ההקלטה. הבעיה: קובץ שמועלה כך לא נכנס לרצף הממוספר הרגיל של
  // השלוחה (425, 426, 427...) שממנו הטלפון בפועל משמיע הודעות - כך שההקלטה הייתה מוצגת
  // באתר אבל לא ניתנת להשמעה בחיוג לשלוחה. לכן כעת מעלים עם autoNumbering=true (ימות המשיח
  // קובע בעצמו את המספר/שם הבא ברצף, ומ-convertAudio ממיר לפורמט תקין כמו שאר ההקלטות),
  // וכדי לשמר את הזיהוי "זו הקלטה שלי" בתצוגה - אצל כל מי שנכנס עם אותו טוקן, לא רק מקומית -
  // השיוך נשמר בגיליון המשותף מיד אחרי ההעלאה (ר' saveRecordingAttribution).
  const form = new FormData();
  form.append('token', token);
  form.append('path', extPath(ext));
  form.append('convertAudio', '1');
  form.append('autoNumbering', 'true');
  form.append('file', blob, fileName);

  try{
    const res = await fetch(BASE_URL + 'UploadFile', {method:'POST', body: form});
    const data = await res.json();
    if(data.responseStatus === 'OK'){
      const uploadedName = uploadedNameFrom(data);
      statusText.innerHTML = ICON_CHECK + ' נשלח בהצלחה';
      statusText.style.display = 'flex';
      statusText.style.alignItems = 'center';
      statusText.style.gap = '6px';
      playUploadChime();
      sendTzintuk();
      // מוסיפים רק את ההקלטה החדשה לסוף הרשימה (בלי לטעון הכל מחדש) - אחרי רגע קצר
      // שבו נשאר מוצג אישור ה"נשלח בהצלחה" במקום תיבת הסטטוס הזמנית.
      setTimeout(async () => {
        item.remove();
        try{
          await appendNewRecordings(async (newFiles) => {
            // משייכים רק את הקובץ שהעלינו בפועל. בעבר שויכו *כל* הקבצים החדשים - כך שהודעה
            // של מישהו אחר שנכנסה באותן שניות סומנה בטעות כשלי.
            let mine = [];
            if(uploadedName){
              mine = newFiles.filter(f => f.name === uploadedName || baseName(f.name) === baseName(uploadedName));
            }
            if(mine.length === 0 && newFiles.length === 1) mine = newFiles;
            for(const f of mine){
              markPlayed(f.name);
              await saveRecordingAttribution(f.name);
            }
          });
        } finally {
          uploadInProgress = false;
        }
      }, 650);
    } else {
      uploadInProgress = false;
      showUploadError(item, statusText, 'ההקלטה לא נשלחה: ' + (data.message || data.responseStatus), blob);
    }
  }catch(err){
    uploadInProgress = false;
    showUploadError(item, statusText, 'ההקלטה לא נשלחה - בדקו את החיבור לאינטרנט.', blob);
  }
}

