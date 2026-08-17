"use strict";

  // ================= TABS =================
  function switchTab(name){
    document.querySelectorAll('.nav-tab').forEach(function(b){ b.classList.toggle('active', b.dataset.tab === name); });
    document.querySelectorAll('.nav-group').forEach(function(g){
      var isActiveGroup = !!g.querySelector('.nav-tab.active');
      g.classList.toggle('active', isActiveGroup);
      if(isActiveGroup) g.classList.add('expanded');
    });
    // Every "Table N" tab shares the one billing section — only the selected
    // table (and its own saved order) changes underneath it.
    var isTableTab = name.indexOf('table-') === 0;
    var sectionName = isTableTab ? 'billing' : name;
    document.querySelectorAll('.section').forEach(function(s){ s.classList.toggle('active', s.dataset.section === sectionName); });
    if(isTableTab){
      selectTable(parseInt(name.slice(6), 10));
    }
  }
  function renderNav(){
    var tabs = state.session.role === 'admin' ? ADMIN_TABS : getStaffTabs();
    var wrap = document.getElementById('navTabs');
    var html = '';
    tabs.forEach(function(t, i){
      var iconHtml = t.icon ? '<span class="nav-icon">'+t.icon+'</span>' : '';
      if(t.children){
        html += '<div class="nav-group">'
          + '<button type="button" class="nav-group-label" data-group-toggle>'+iconHtml+'<span class="num">'+t.num+'</span> '+t.label+'<span class="chev">▾</span></button>';
        t.children.forEach(function(c){
          html += '<button class="nav-tab nav-subtab" data-tab="'+c.key+'">'+c.label+'</button>';
        });
        html += '</div>';
      } else if(t.tableId){
        html += '<button class="nav-tab table-nav-tab'+(i===0?' active':'')+'" data-tab="'+t.key+'" data-table-badge="'+t.tableId+'">'
          + iconHtml+'<span class="num">'+t.num+'</span> '+t.label
          + '<span class="table-status-dot" title="Order status"></span></button>';
      } else {
        html += '<button class="nav-tab'+(i===0?' active':'')+'" data-tab="'+t.key+'">'+iconHtml+'<span class="num">'+t.num+'</span> '+t.label+'</button>';
      }
    });
    wrap.innerHTML = html;
    wrap.querySelectorAll('.nav-tab').forEach(function(b){
      b.addEventListener('click', function(){ switchTab(b.dataset.tab); });
    });
    wrap.querySelectorAll('[data-group-toggle]').forEach(function(b){
      b.addEventListener('click', function(){
        b.closest('.nav-group').classList.toggle('expanded');
      });
    });
    switchTab(tabs[0].children ? tabs[0].children[0].key : tabs[0].key);
    renderTableStatusBadges();
  }

  function initialsFor(text){
    var parts = String(text || '').trim().split(/\s+/).filter(Boolean);
    if(!parts.length) return '?';
    var first = parts[0][0] || '';
    var last = parts.length > 1 ? (parts[parts.length - 1][0] || '') : '';
    return (first + last).toUpperCase();
  }
  var DEFAULT_AVATAR_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>';
  // Google photo when we have one; otherwise initials; otherwise a clean default silhouette.
  function avatarMarkup(name, photoURL){
    if(photoURL){ return '<img src="'+escapeHtml(photoURL)+'" alt="" referrerpolicy="no-referrer">'; }
    var initials = initialsFor(name);
    if(initials && initials !== '?'){ return escapeHtml(initials); }
    return DEFAULT_AVATAR_SVG;
  }
  function renderSessionPill(){
    var displayName, roleTag, email, photoURL;
    if(state.session.role === 'admin'){
      // Google Sign-In fills displayName/photoURL automatically; email/password
      // admins fall back to the part of their email before the @.
      displayName = state.session.displayName || (state.session.email ? state.session.email.split('@')[0] : 'Admin');
      roleTag = 'Administrator';
      email = state.session.email || '';
      // A photo the admin uploaded themselves takes priority over Google's photo.
      photoURL = state.session.customPhoto || state.session.photoURL || '';
    } else {
      displayName = state.session.name || state.session.staffId;
      roleTag = state.session.department ? departmentLabel(state.session.department) : 'Staff';
      email = state.session.staffId ? 'Staff ID: ' + state.session.staffId : '';
      photoURL = state.session.customPhoto || '';
    }
    var avatarHtml = avatarMarkup(displayName, photoURL);
    var avatarSm = document.getElementById('sessionAvatar');
    var avatarLg = document.getElementById('sessionAvatarLg');
    avatarSm.innerHTML = avatarHtml; avatarSm.classList.toggle('has-photo', !!photoURL);
    avatarLg.innerHTML = avatarHtml; avatarLg.classList.toggle('has-photo', !!photoURL);
    document.getElementById('sessionName').textContent = displayName;
    document.getElementById('sessionRole').textContent = roleTag;
    document.getElementById('sessionDropdownName').textContent = displayName;
    document.getElementById('sessionDropdownEmail').textContent = email;
    var editBtn = document.getElementById('sessionEditBtn');
    if(editBtn){ editBtn.style.display = (state.session.role === 'admin') ? 'inline-flex' : 'none'; }
    var uploadBtn = document.getElementById('sessionUploadPhotoBtn');
    if(uploadBtn){ uploadBtn.textContent = photoURL ? 'Change photo' : 'Upload photo'; }
    var removeBtn = document.getElementById('sessionRemovePhotoBtn');
    if(removeBtn){ removeBtn.style.display = photoURL ? 'inline-block' : 'none'; }
  }

  // ---- Edit profile / upload / remove photo. Name edit reuses Firebase Auth's
  // updateProfile (admin only). Photos — for BOTH admin and staff — are stored
  // as a data URL on the person's own users/{uid} Firestore doc, since staff
  // accounts have no Google photo to fall back on. ----
  (function(){
    var editBtn = document.getElementById('sessionEditBtn');
    var removeBtn = document.getElementById('sessionRemovePhotoBtn');
    var uploadBtn = document.getElementById('sessionUploadPhotoBtn');
    var fileInput = document.getElementById('sessionPhotoFile');
    if(editBtn){
      editBtn.addEventListener('click', function(e){
        e.stopPropagation();
        if(!auth.currentUser) return;
        var next = window.prompt('Edit your display name', state.session.displayName || '');
        if(next === null) return;
        next = next.trim();
        if(!next) return;
        auth.currentUser.updateProfile({ displayName: next }).then(function(){
          state.session.displayName = next;
          renderSessionPill();
          showToast('Profile updated');
        }).catch(function(err){
          showToast('Could not update profile' + (err && err.message ? ': ' + err.message : ''));
        });
      });
    }
    if(uploadBtn && fileInput){
      uploadBtn.addEventListener('click', function(e){
        e.stopPropagation();
        fileInput.click();
      });
      fileInput.addEventListener('click', function(e){ e.stopPropagation(); });
      fileInput.addEventListener('change', function(e){
        var file = e.target.files && e.target.files[0];
        if(!file) return;
        if(file.size > 500*1024){
          showToast('Please choose an image under 500KB');
          e.target.value = '';
          return;
        }
        var reader = new FileReader();
        reader.onload = function(ev){
          var dataUrl = ev.target.result;
          db.collection('users').doc(state.session.uid).update({ photo: dataUrl }).then(function(){
            state.session.customPhoto = dataUrl;
            renderSessionPill();
            showToast('Profile photo updated');
          }).catch(function(err){
            showToast('Could not upload photo' + (err && err.message ? ': ' + err.message : ''));
          });
        };
        reader.readAsDataURL(file);
        fileInput.value = '';
      });
    }
    if(removeBtn){
      removeBtn.addEventListener('click', function(e){
        e.stopPropagation();
        if(state.session.customPhoto){
          db.collection('users').doc(state.session.uid).update({ photo: '' }).then(function(){
            state.session.customPhoto = '';
            renderSessionPill();
            showToast('Profile photo removed');
          }).catch(function(err){
            showToast('Could not remove photo' + (err && err.message ? ': ' + err.message : ''));
          });
          return;
        }
        // Fallback: clears a Google-provided photo (admin only — nothing to
        // do for staff since they never had one of these).
        if(!auth.currentUser) return;
        auth.currentUser.updateProfile({ photoURL: null }).then(function(){
          state.session.photoURL = '';
          renderSessionPill();
          showToast('Profile photo removed');
        }).catch(function(err){
          showToast('Could not remove photo' + (err && err.message ? ': ' + err.message : ''));
        });
      });
    }
  })();

  // ---- Session dropdown open/close ----
  (function(){
    var menu = document.getElementById('sessionMenu');
    var trigger = document.getElementById('sessionTrigger');
    trigger.addEventListener('click', function(e){
      e.stopPropagation();
      var isOpen = menu.classList.toggle('open');
      trigger.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
    });
    document.addEventListener('click', function(e){
      if(menu.classList.contains('open') && !menu.contains(e.target)){
        menu.classList.remove('open');
        trigger.setAttribute('aria-expanded', 'false');
      }
    });
  })();

  // ---- App-wide dark mode (main dashboard) — separate from the login
  // gate's own light/dark toggle, which stays scoped to #gateScreen only. ----
  (function(){
    var appLayoutEl = document.getElementById('appLayout');
    var toggle = document.getElementById('appDarkToggle');
    var stored = null;
    try{ stored = localStorage.getItem('invoiceDeskAppTheme'); }catch(e){}
    var isDark = stored === 'dark';
    appLayoutEl.classList.toggle('app-dark', isDark);
    toggle.checked = isDark;
    toggle.addEventListener('change', function(){
      appLayoutEl.classList.toggle('app-dark', toggle.checked);
      try{ localStorage.setItem('invoiceDeskAppTheme', toggle.checked ? 'dark' : 'light'); }catch(e){}
    });
  })();

  function enterApp(){
    document.getElementById('gateScreen').style.display = 'none';
    document.getElementById('appLayout').classList.add('show');
    renderBrandHeader();
    renderSessionPill();
    renderNav();
    fillSetupForm();
    renderAccountSecurityCard();
    renderMenu();
    renderMenuTrash();
    renderItemPicker();
    renderTicket();
    renderHistory();
    renderRoomHistory();
    renderBanquetHistory();
    renderSalesAnalysis();
    renderStaffList();
    renderPromoList();
    renderTablesAdmin();
    initRoomModule();
    initBanquetModule();
    initSidebarToggle();
  }

  // ---------- sidebar collapse/expand (desktop) + off-canvas drawer (mobile) ----------
  function initSidebarToggle(){
    var sidebar = document.getElementById('sidebarEl');
    var collapseBtn = document.getElementById('sidebarCollapseBtn');
    var expandBtn = document.getElementById('sidebarExpandBtn');
    var collapsed = window.localStorage.getItem(STORAGE_PREFIX + 'sidebar-collapsed') === '1';
    function apply(){
      sidebar.classList.toggle('collapsed', collapsed);
      expandBtn.classList.toggle('show', collapsed);
    }
    apply();
    collapseBtn.onclick = function(){
      collapsed = true;
      window.localStorage.setItem(STORAGE_PREFIX + 'sidebar-collapsed', '1');
      apply();
    };
    expandBtn.onclick = function(){
      collapsed = false;
      window.localStorage.setItem(STORAGE_PREFIX + 'sidebar-collapsed', '0');
      apply();
    };

    // Mobile only — a hamburger-triggered off-canvas drawer, independent of the
    // desktop collapse/expand above (which stays exactly as it was).
    var hamburgerBtn = document.getElementById('hamburgerBtn');
    var mobileCloseBtn = document.getElementById('sidebarMobileClose');
    var backdrop = document.getElementById('sidebarBackdrop');
    function openMobileDrawer(){
      sidebar.classList.add('mobile-open');
      backdrop.classList.add('show');
    }
    function closeMobileDrawer(){
      sidebar.classList.remove('mobile-open');
      backdrop.classList.remove('show');
    }
    if(hamburgerBtn) hamburgerBtn.onclick = openMobileDrawer;
    if(mobileCloseBtn) mobileCloseBtn.onclick = closeMobileDrawer;
    if(backdrop) backdrop.onclick = closeMobileDrawer;
    // Delegated so it keeps working after renderNav() replaces the tab buttons.
    sidebar.addEventListener('click', function(e){
      if(e.target.closest('.nav-tab') || e.target.closest('#logoutBtn')){ closeMobileDrawer(); }
    });
  }

  // ---------- brand header ----------
  function renderBrandHeader(){
    document.getElementById('brandName').textContent = state.restaurant.name || 'Your hotel';
    document.getElementById('brandSub').textContent = state.restaurant.name ? (state.restaurant.phone || 'Details saved') : 'Ask admin to complete setup';
    var mobileTitle = document.getElementById('mobileBrandName');
    if(mobileTitle){ mobileTitle.textContent = state.restaurant.name || 'Your hotel'; }
    // Top-right admin header — same saved hotel/business setup data, never hardcoded.
    var topName = document.getElementById('topHotelName');
    var topPhone = document.getElementById('topHotelPhone');
    if(topName){ topName.textContent = state.restaurant.name || 'Your hotel'; }
    if(topPhone){ topPhone.textContent = state.restaurant.phone || ''; }
  }

  // ---------- setup ----------
  var setupFields = {
    name: document.getElementById('setName'), phone: document.getElementById('setPhone'),
    address: document.getElementById('setAddress'), email: document.getElementById('setEmail'),
    gstin: document.getElementById('setGstin'),
    taxRate: document.getElementById('setTax'), currency: document.getElementById('setCurrency'),
    invoicePrefix: document.getElementById('setInvoicePrefix'), footer: document.getElementById('setFooter')
  };
  // Holds the signature currently shown/staged in the setup form (base64 data URL, or '' for none)
  // until "Save details" is pressed.
  var pendingSignature = '';
  var pendingSignatureRatio = 0; // width/height of the staged signature image, so the PDF doesn't distort it
  function renderSignaturePreview(dataUrl){
    var wrap = document.getElementById('signPreviewWrap');
    var removeBtn = document.getElementById('removeSignatureBtn');
    if(dataUrl){
      wrap.innerHTML = '<img src="'+dataUrl+'" alt="Signature preview">';
      removeBtn.style.display = '';
    } else {
      wrap.innerHTML = '<span>No signature</span>';
      removeBtn.style.display = 'none';
    }
  }
  function fillSetupForm(){
    setupFields.name.value = state.restaurant.name;
    setupFields.phone.value = state.restaurant.phone;
    setupFields.address.value = state.restaurant.address;
    setupFields.email.value = state.restaurant.email || '';
    setupFields.gstin.value = state.restaurant.gstin;
    setupFields.taxRate.value = state.restaurant.taxRate;
    setupFields.currency.value = state.restaurant.currency;
    setupFields.invoicePrefix.value = state.restaurant.invoicePrefix;
    setupFields.footer.value = state.restaurant.footer;
    pendingSignature = state.restaurant.signature || '';
    pendingSignatureRatio = state.restaurant.signatureRatio || 0;
    var fileInput = document.getElementById('setSignatureFile');
    if(fileInput) fileInput.value = '';
    renderSignaturePreview(pendingSignature);
  }
  document.getElementById('setSignatureFile').addEventListener('change', function(e){
    var file = e.target.files && e.target.files[0];
    if(!file) return;
    if(file.size > 500*1024){
      showToast('Please choose an image under 500KB');
      e.target.value = '';
      return;
    }
    var reader = new FileReader();
    reader.onload = function(ev){
      pendingSignature = ev.target.result;
      var img = new Image();
      img.onload = function(){
        pendingSignatureRatio = img.naturalWidth / img.naturalHeight || 0;
      };
      img.src = pendingSignature;
      renderSignaturePreview(pendingSignature);
    };
    reader.readAsDataURL(file);
  });
  document.getElementById('removeSignatureBtn').addEventListener('click', function(){
    pendingSignature = '';
    pendingSignatureRatio = 0;
    document.getElementById('setSignatureFile').value = '';
    renderSignaturePreview('');
  });

  // ---------- account security: set/change password for the signed-in admin ----------
  // A Google sign-in and an email/password sign-in are different credentials.
  // linkWithCredential attaches a password to the SAME Firebase user that's
  // currently signed in via Google, so afterward either method logs into the
  // same account. reauthenticateWithCredential is required by Firebase before
  // changing a password that's already set (recent-login requirement).
  function renderAccountSecurityCard(){
    var card = document.getElementById('accountSecurityCard');
    if(!card) return;
    if(!state.session || state.session.role !== 'admin'){ card.style.display = 'none'; return; }
    card.style.display = '';
    var user = auth.currentUser;
    var hasPassword = !!(user && user.providerData.some(function(p){ return p.providerId === 'password'; }));
    var hint = document.getElementById('accountSecurityHint');
    document.getElementById('setPasswordBlock').style.display = hasPassword ? 'none' : '';
    document.getElementById('changePasswordBlock').style.display = hasPassword ? '' : 'none';
    hint.textContent = hasPassword
      ? 'You can log in with Google or with your email and password.'
      : 'You\'re signed in with Google only. Set a password below to also log in from Admin Login with ' + (user && user.email ? user.email : 'this email') + '.';
  }

  document.getElementById('setPasswordBtn').addEventListener('click', function(){
    var pw = document.getElementById('newAdminPassword').value;
    var pw2 = document.getElementById('newAdminPasswordConfirm').value;
    var err = document.getElementById('setPasswordError');
    var btn = document.getElementById('setPasswordBtn');
    err.classList.remove('show');
    if(pw.length < 6){ err.textContent = 'Password must be at least 6 characters.'; err.classList.add('show'); return; }
    if(pw !== pw2){ err.textContent = 'Passwords do not match.'; err.classList.add('show'); return; }
    var user = auth.currentUser;
    if(!user || !user.email){ err.textContent = 'Something went wrong. Please try again.'; err.classList.add('show'); return; }
    btn.disabled = true;
    var credential = firebase.auth.EmailAuthProvider.credential(user.email, pw);
    user.linkWithCredential(credential).then(function(){
      btn.disabled = false;
      document.getElementById('newAdminPassword').value = '';
      document.getElementById('newAdminPasswordConfirm').value = '';
      showToast('Password set — you can now log in with email and password too');
      renderAccountSecurityCard();
    }).catch(function(e){
      btn.disabled = false;
      err.textContent = authErrorMessage(e);
      err.classList.add('show');
    });
  });

  document.getElementById('changePasswordBtn').addEventListener('click', function(){
    var curPw = document.getElementById('curAdminPassword').value;
    var pw = document.getElementById('newAdminPassword2').value;
    var pw2 = document.getElementById('newAdminPasswordConfirm2').value;
    var err = document.getElementById('changePasswordError');
    var btn = document.getElementById('changePasswordBtn');
    err.classList.remove('show');
    if(!curPw){ err.textContent = 'Enter your current password.'; err.classList.add('show'); return; }
    if(pw.length < 6){ err.textContent = 'New password must be at least 6 characters.'; err.classList.add('show'); return; }
    if(pw !== pw2){ err.textContent = 'New passwords do not match.'; err.classList.add('show'); return; }
    var user = auth.currentUser;
    if(!user || !user.email){ err.textContent = 'Something went wrong. Please try again.'; err.classList.add('show'); return; }
    btn.disabled = true;
    var credential = firebase.auth.EmailAuthProvider.credential(user.email, curPw);
    user.reauthenticateWithCredential(credential).then(function(){
      return user.updatePassword(pw);
    }).then(function(){
      btn.disabled = false;
      document.getElementById('curAdminPassword').value = '';
      document.getElementById('newAdminPassword2').value = '';
      document.getElementById('newAdminPasswordConfirm2').value = '';
      showToast('Password updated');
    }).catch(function(e){
      btn.disabled = false;
      err.textContent = authErrorMessage(e);
      err.classList.add('show');
    });
  });

  document.getElementById('saveSetupBtn').addEventListener('click', function(){
    state.restaurant = {
      name: setupFields.name.value.trim(), phone: setupFields.phone.value.trim(),
      address: setupFields.address.value.trim(), email: setupFields.email.value.trim(),
      gstin: setupFields.gstin.value.trim(),
      taxRate: parseFloat(setupFields.taxRate.value) || 0,
      currency: setupFields.currency.value.trim() || '₹',
      invoicePrefix: (setupFields.invoicePrefix.value.trim() || 'INV').toUpperCase(),
      footer: setupFields.footer.value.trim(),
      signature: pendingSignature || '',
      signatureRatio: pendingSignature ? (pendingSignatureRatio || 0) : 0
    };
    persistRestaurant().then(function(){
      showToast('Property details saved');
      renderBrandHeader();
      renderTicket();
    });
  });

