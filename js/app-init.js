"use strict";

  // ---------- init ----------
  // Firebase Auth remembers who's signed in on THIS device automatically —
  // we just react to it, look up their role in Firestore, and either resume
  // straight into the app or show the login gate.
  var handledInitialAuth = false;
  auth.onAuthStateChanged(function(user){
    if(!user){
      if(unsubscribeRestaurantDoc){ unsubscribeRestaurantDoc(); unsubscribeRestaurantDoc = null; }
      state.session = null;
      if(!handledInitialAuth){ handledInitialAuth = true; showGatePanel('roleSelect'); }
      else if(!document.getElementById('gateScreen').style.display || document.getElementById('gateScreen').style.display === 'none'){
        // Signed out unexpectedly (e.g. from another tab) while the app was open.
        document.getElementById('appLayout').classList.remove('show');
        document.getElementById('gateScreen').style.display = '';
        showGatePanel('roleSelect');
      }
      return;
    }
    db.collection('users').doc(user.uid).get().then(function(snap){
      if(!snap.exists){ throw new Error('No profile found for this account.'); }
      var u = snap.data();
      if(u.role !== 'admin' && u.active === false){ throw { code:'staff-removed' }; }
      if(u.role === 'admin'){
        state.session = { role:'admin', email:u.email, uid:user.uid, restaurantId:u.restaurantId, displayName: user.displayName || '', photoURL: user.photoURL || '', customPhoto: u.photo || '' };
      } else {
        state.session = { role:'staff', staffId:u.staffId, name:u.name, department:u.department, uid:user.uid, restaurantId:u.restaurantId, customPhoto: u.photo || '' };
      }
      return startRestaurantSync();
    }).then(function(){
      handledInitialAuth = true;
      enterApp();
    }).catch(function(e){
      console.error('Could not resume session', e);
      handledInitialAuth = true;
      auth.signOut();
      if(e && e.code === 'staff-removed'){
        showGatePanel('staffAuth');
        var err = document.getElementById('staffLoginError');
        if(err){ err.textContent = 'This staff account has been removed. Contact your admin.'; err.classList.add('show'); }
      } else {
        showGatePanel('roleSelect');
      }
    });
  });
