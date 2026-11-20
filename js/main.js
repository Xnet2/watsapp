if(!applyInviteLinkIfPresent()){
  migrateLegacySystemIfNeeded();
  const bootSystems = getSystems();
  if(bootSystems.length === 0){
    openSettings();
  } else if(bootSystems.length === 1){
    enterSystem(bootSystems[0].id);
  } else {
    showHome();
  }
}
