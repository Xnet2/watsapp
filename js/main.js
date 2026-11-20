// ===== סגירת חלונות: מקש Esc או לחיצה על הרקע הכהה =====
// (חלון "בדיקה לפני שליחה" לא נסגר בלחיצה על הרקע, כדי לא לאבד הקלטה בטעות)
const overlayClosers = {
  dialogOverlay: () => closeDialog(false),
  cropOverlay: () => { closeCropper(); contactPhotoInput.value = ''; },
  contactEditOverlay: closeContactEdit,
  contactsOverlay: closeContacts,
  guidesOverlay: closeGuides,
  settingsOverlay: () => { if(getSystems().length) closeSettings(); },
  recordPreviewOverlay: null
};
Object.keys(overlayClosers).forEach(id => {
  const ov = document.getElementById(id);
  const close = overlayClosers[id];
  if(!ov || !close) return;
  ov.addEventListener('mousedown', (e) => { ov._downOnBackdrop = (e.target === ov); });
  ov.addEventListener('click', (e) => {
    if(e.target === ov && ov._downOnBackdrop) close();
  });
});
document.addEventListener('keydown', (e) => {
  if(e.key !== 'Escape') return;
  // סוגרים רק את החלון העליון
  for(const id of Object.keys(overlayClosers)){
    const ov = document.getElementById(id);
    if(ov && ov.classList.contains('open')){
      if(overlayClosers[id]) overlayClosers[id]();
      return;
    }
  }
  if(!searchBar.hidden) closeSearch();
});

// ===== אפליקציה מותקנת (PWA): service worker לטעינה מהירה, התקנה למסך הבית והתראות =====
if('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')){
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(err => console.warn('service worker:', err.message));
  });
}

// ===== עלייה =====
if(!applyInviteLinkIfPresent()){
  migrateLegacySystemIfNeeded();
  const bootSystems = getSystems();
  const active = getActiveSystem();
  if(bootSystems.length === 0){
    renderHome();
    openSettings();
  } else if(isWide()){
    // במחשב: רשימת המערכות בצד, והשיחה האחרונה שהייתה פתוחה לידה
    enterSystem(active ? active.id : bootSystems[0].id);
  } else if(bootSystems.length === 1){
    enterSystem(bootSystems[0].id);
  } else {
    showHome();
  }
}
