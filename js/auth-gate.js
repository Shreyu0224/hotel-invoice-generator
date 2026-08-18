"use strict";

  // ================= AUTH GATE =================
  var gatePanels = document.querySelectorAll('.gate-panel');
  function showGatePanel(name){
    gatePanels.forEach(function(p){ p.classList.toggle('active', p.dataset.gate === name); });
  }

  // Show/hide password toggles (used on every password field across the gate screens)
  var EYE_ICON = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7Z"/><circle cx="12" cy="12" r="3"/></svg>';
  var EYE_OFF_ICON = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.9 10.9 0 0 1 12 20c-7 0-11-8-11-8a19.4 19.4 0 0 1 4.22-5.44M9.9 4.24A9.1 9.1 0 0 1 12 4c7 0 11 8 11 8a19.6 19.6 0 0 1-2.16 3.19m-6.72-1.31a3 3 0 1 1-4.24-4.24"/><path d="M1 1l22 22"/></svg>';
  document.querySelectorAll('.pw-toggle').forEach(function(btn){
    btn.innerHTML = EYE_ICON;
    btn.addEventListener('click', function(){
      var input = document.getElementById(btn.dataset.target);
      if(!input) return;
      var showing = input.type === 'text';
      input.type = showing ? 'password' : 'text';
      btn.innerHTML = showing ? EYE_ICON : EYE_OFF_ICON;
      btn.setAttribute('aria-label', showing ? 'Show password' : 'Hide password');
    });
  });

  document.getElementById('pickAdmin').addEventListener('click', function(){
    showGatePanel('adminAuth');
    document.getElementById('signupError').classList.remove('show');
    document.getElementById('loginError').classList.remove('show');
    // Admin login is the default view; signup is reached via the "Create one" link below.
    showAdminAuthMode('login');
  });
  function showAdminAuthMode(mode){
    document.getElementById('adminAuthSignup').style.display = mode === 'signup' ? 'block' : 'none';
    document.getElementById('adminAuthLogin').style.display = mode === 'login' ? 'block' : 'none';
    document.getElementById('signupError').classList.remove('show');
    document.getElementById('loginError').classList.remove('show');
  }
  document.getElementById('showAdminSignupLink').addEventListener('click', function(){ showAdminAuthMode('signup'); });
  document.getElementById('showAdminLoginLink').addEventListener('click', function(){ showAdminAuthMode('login'); });
  document.getElementById('pickStaff').addEventListener('click', function(){
    showGatePanel('staffAuth');
    document.getElementById('staffLoginError').classList.remove('show');
    document.getElementById('noStaffNotice').style.display = 'none';
  });
  document.getElementById('adminBack').addEventListener('click', function(){
    showGatePanel('roleSelect');
  });
  document.getElementById('staffBack').addEventListener('click', function(){ showGatePanel('roleSelect'); });

  // ---- Domain-level email validation (format + real DNS MX/A record check) ----
  // This confirms the DOMAIN can actually receive mail (e.g. rejects typos like
  // "gmial.com" or made-up domains) using Google's public DNS-over-HTTPS API —
  // a real external, backend check, not just a regex, but with no server of our
  // own to run or deploy. It cannot confirm one specific mailbox exists (no
  // browser-based method can do that reliably, especially for providers like
  // Gmail) — that's the honest limit of "strongest practical validation"
  // without standing up an email-sending backend, which was intentionally
  // ruled out here.
  function checkDomainCanReceiveMail(domain){
    var dnsApi = 'https://dns.google/resolve?name=' + encodeURIComponent(domain) + '&type=MX';
    return fetch(dnsApi).then(function(res){ return res.json(); }).then(function(data){
      if(data && data.Status === 0 && data.Answer && data.Answer.some(function(a){ return a.type === 15; })){
        return true; // has MX records — mail is explicitly configured
      }
      // No MX record — per RFC 5321, mail can still fall back to the domain's
      // own A record, so check that before rejecting.
      var aApi = 'https://dns.google/resolve?name=' + encodeURIComponent(domain) + '&type=A';
      return fetch(aApi).then(function(res2){ return res2.json(); }).then(function(data2){
        return !!(data2 && data2.Status === 0 && data2.Answer && data2.Answer.length > 0);
      });
    }).catch(function(){
      // If the DNS lookup itself fails (network hiccup, API unreachable), don't
      // block a possibly-legitimate signup over an unrelated connectivity issue.
      return true;
    });
  }

  // ---- Google Sign-In (admin only) — one click handles both a brand-new
  // admin and a returning one. Google has already verified this person owns
  // the email, so there's no need for our own OTP/domain check on this path.
  document.getElementById('googleSignInBtn').addEventListener('click', function(){
    var btn = document.getElementById('googleSignInBtn');
    var err = document.getElementById('googleSignInError');
    err.classList.remove('show');
    btn.disabled = true;

    auth.signInWithPopup(googleProvider).then(function(result){
      var uid = result.user.uid;
      var email = result.user.email;
      var isNewUser = result.additionalUserInfo && result.additionalUserInfo.isNewUser;

      if(isNewUser){
        var restaurantDefaults = {
          restaurant: DEFAULT_RESTAURANT, menu: [], deletedMenu: [], invoices: [],
          promoCodes: [], invoiceSeq: 0, staff: [],
          subscription: null // must choose Free Trial or Premium before first use
        };
        return Promise.all([
          db.collection('users').doc(uid).set({ role:'admin', email:email, restaurantId:uid, createdAt: new Date().toISOString() }),
          db.collection('restaurants').doc(uid).set(restaurantDefaults)
        ]).then(function(){
          state.session = { role:'admin', email:email, uid:uid, restaurantId:uid, displayName: result.user.displayName || '', photoURL: result.user.photoURL || '' };
          return startRestaurantSync();
        }).then(function(){
          showToast('Admin account created with Google');
        });
      }

      // Returning user — look up their existing profile.
      return db.collection('users').doc(uid).get().then(function(userSnap){
        if(!userSnap.exists){
          // A Google account that signed in before but has no profile doc
          // (e.g. was only ever used for staff) — treat like a fresh admin.
          var restaurantDefaults = {
            restaurant: DEFAULT_RESTAURANT, menu: [], deletedMenu: [], invoices: [],
            promoCodes: [], invoiceSeq: 0, staff: [],
            subscription: null // must choose Free Trial or Premium before first use
          };
          return Promise.all([
            db.collection('users').doc(uid).set({ role:'admin', email:email, restaurantId:uid, createdAt: new Date().toISOString() }),
            db.collection('restaurants').doc(uid).set(restaurantDefaults)
          ]).then(function(){
            state.session = { role:'admin', email:email, uid:uid, restaurantId:uid, displayName: result.user.displayName || '', photoURL: result.user.photoURL || '' };
            return startRestaurantSync();
          });
        }
        var u = userSnap.data();
        if(u.role !== 'admin'){
          auth.signOut();
          throw { code: 'not-admin' };
        }
        state.session = { role:'admin', email: u.email, uid: uid, restaurantId: u.restaurantId, displayName: result.user.displayName || '', photoURL: result.user.photoURL || '', customPhoto: u.photo || '' };
        return startRestaurantSync();
      });
    }).then(function(){
      btn.disabled = false;
      enterApp();
    }).catch(function(e){
      btn.disabled = false;
      if(e && e.code === 'auth/popup-closed-by-user'){ return; } // they just closed it — no error needed
      err.textContent = (e && e.code === 'not-admin') ? 'This Google account is not an admin account.'
        : (e && e.code === 'auth/account-exists-with-different-credential') ? 'This email already has a password-based account — please log in with your password instead.'
        : authErrorMessage(e);
      err.classList.add('show');
    });
  });

  document.getElementById('signupBtn').addEventListener('click', function(){
    var email = document.getElementById('signupEmail').value.trim().toLowerCase();
    var pw = document.getElementById('signupPassword').value;
    var pw2 = document.getElementById('signupConfirm').value;
    var err = document.getElementById('signupError');
    var btn = document.getElementById('signupBtn');

    if(!isValidEmail(email)){ err.textContent = 'Please enter a valid email address.'; err.classList.add('show'); return; }
    if(pw.length < 6){ err.textContent = 'Password must be at least 6 characters.'; err.classList.add('show'); return; }
    if(pw !== pw2){ err.textContent = 'Passwords do not match.'; err.classList.add('show'); return; }
    err.classList.remove('show');
    btn.disabled = true;
    btn.textContent = 'Checking email…';

    var domain = email.split('@')[1];
    checkDomainCanReceiveMail(domain).then(function(canReceive){
      if(!canReceive){
        btn.disabled = false;
        btn.textContent = 'Create account & continue';
        err.textContent = 'Please enter a valid email address.';
        err.classList.add('show');
        return;
      }

      btn.textContent = 'Creating account…';
      // Any number of independent admin accounts can be created — each gets
      // their own restaurant document, isolated by the security rules.
      auth.createUserWithEmailAndPassword(email, pw).then(function(cred){
        var uid = cred.user.uid;
        var restaurantDefaults = {
          restaurant: DEFAULT_RESTAURANT, menu: [], deletedMenu: [], invoices: [],
          promoCodes: [], invoiceSeq: 0, staff: [],
          subscription: null // must choose Free Trial or Premium before first use
        };
        return Promise.all([
          db.collection('users').doc(uid).set({ role:'admin', email:email, restaurantId:uid, createdAt: new Date().toISOString() }),
          db.collection('restaurants').doc(uid).set(restaurantDefaults)
        ]).then(function(){ return uid; });
      }).then(function(uid){
        state.session = { role:'admin', email:email, uid:uid, restaurantId:uid };
        return startRestaurantSync();
      }).then(function(){
        btn.disabled = false;
        btn.textContent = 'Create account & continue';
        showToast('Admin account created');
        enterApp();
      }).catch(function(e){
        btn.disabled = false;
        btn.textContent = 'Create account & continue';
        err.textContent = authErrorMessage(e);
        err.classList.add('show');
      });
    });
  });

  document.getElementById('loginBtn').addEventListener('click', function(){
    var email = document.getElementById('loginEmail').value.trim().toLowerCase();
    var pw = document.getElementById('loginPassword').value;
    var err = document.getElementById('loginError');
    var btn = document.getElementById('loginBtn');
    err.classList.remove('show');
    btn.disabled = true;

    auth.signInWithEmailAndPassword(email, pw).then(function(cred){
      return db.collection('users').doc(cred.user.uid).get();
    }).then(function(userSnap){
      if(!userSnap.exists || userSnap.data().role !== 'admin'){
        auth.signOut();
        throw { code: 'not-admin' };
      }
      var u = userSnap.data();
      state.session = { role:'admin', email: u.email, uid: userSnap.id, restaurantId: u.restaurantId, customPhoto: u.photo || '' };
      return startRestaurantSync();
    }).then(function(){
      btn.disabled = false;
      enterApp();
    }).catch(function(e){
      btn.disabled = false;
      err.textContent = (e && e.code === 'not-admin') ? 'This account is not an admin account.' : authErrorMessage(e);
      err.classList.add('show');
    });
  });

  document.getElementById('staffLoginBtn').addEventListener('click', function(){
    var staffId = document.getElementById('staffLoginId').value.trim();
    var pw = document.getElementById('staffLoginPassword').value;
    var err = document.getElementById('staffLoginError');
    var btn = document.getElementById('staffLoginBtn');
    err.classList.remove('show');
    if(!staffId){ err.textContent = 'Enter your Staff ID.'; err.classList.add('show'); return; }
    btn.disabled = true;

    // Staff sign in with their Staff ID, which we resolve to the private
    // synthetic email Firebase Auth actually needs.
    db.collection('staffDirectory').doc(staffId.toLowerCase()).get().then(function(dirSnap){
      if(!dirSnap.exists){ throw { code: 'no-staff' }; }
      var dir = dirSnap.data();
      return auth.signInWithEmailAndPassword(dir.email, pw).then(function(cred){
        // A second, small read for their uploaded profile photo (kept on their
        // own users/{uid} doc rather than duplicated onto staffDirectory), and
        // to check whether the account has been removed by the admin.
        return db.collection('users').doc(cred.user.uid).get().then(function(userSnap){
          var u = userSnap.exists ? userSnap.data() : {};
          if(u.active === false){
            return auth.signOut().then(function(){ throw { code: 'staff-removed' }; });
          }
          return { cred: cred, dir: dir, photo: u.photo || '' };
        });
      });
    }).then(function(res){
      state.session = {
        role: 'staff', staffId: res.dir.staffId, name: res.dir.name,
        department: res.dir.department, uid: res.cred.user.uid, restaurantId: res.dir.restaurantId,
        customPhoto: res.photo
      };
      return startRestaurantSync();
    }).then(function(){
      btn.disabled = false;
      enterApp();
    }).catch(function(e){
      btn.disabled = false;
      err.textContent = (e && e.code === 'no-staff') ? 'No staff account found with that Staff ID.'
        : (e && e.code === 'staff-removed') ? 'This staff account has been removed. Contact your admin.'
        : authErrorMessage(e);
      err.classList.add('show');
    });
  });

  bindEnterToSubmit(['signupEmail','signupPassword','signupConfirm'], 'signupBtn');
  bindEnterToSubmit(['loginEmail','loginPassword'], 'loginBtn');
  bindEnterToSubmit(['staffLoginId','staffLoginPassword'], 'staffLoginBtn');

  // ---- Light / dark mode (scoped to the login gate only) ----
  (function(){
    var gate = document.getElementById('gateScreen');
    var toggle = document.getElementById('gateThemeToggle');
    var stored = null;
    try{ stored = localStorage.getItem('invoiceDeskGateTheme'); }catch(e){}
    if(stored === 'dark'){ gate.classList.add('gate-dark'); }
    toggle.addEventListener('click', function(){
      var isDark = gate.classList.toggle('gate-dark');
      try{ localStorage.setItem('invoiceDeskGateTheme', isDark ? 'dark' : 'light'); }catch(e){}
    });
  })();

  document.getElementById('logoutBtn').addEventListener('click', function(){
    if(unsubscribeRestaurantDoc){ unsubscribeRestaurantDoc(); unsubscribeRestaurantDoc = null; }
    auth.signOut().then(function(){
      state.session = null;
      state.currentTable = null;
      state.order = [];
      state.paymentMethod = 'Cash';
      state.appliedPromo = null;
      document.getElementById('appLayout').classList.remove('show');
      document.getElementById('gateScreen').style.display = '';
      showGatePanel('roleSelect');
      document.getElementById('loginEmail').value = '';
      document.getElementById('loginPassword').value = '';
      document.getElementById('staffLoginId').value = '';
      document.getElementById('staffLoginPassword').value = '';
    });
  });

