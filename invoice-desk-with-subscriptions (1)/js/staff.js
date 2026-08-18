"use strict";

  // ---------- staff management (admin) ----------
  // Exactly one staff account per department. Staff Mgmt now shows 3 fixed
  // department slots (Available / Assigned) instead of an open-ended list.
  var staffResetOpenId = null;

  function populateDeptSelect(){
    var sel = document.getElementById('staffDept');
    if(!sel) return;
    var open = DEPARTMENTS.filter(function(d){ return !staffInDept(d.key); });
    if(open.length === 0){
      sel.innerHTML = '';
      return;
    }
    sel.innerHTML = open.map(function(d){ return '<option value="'+d.key+'">'+escapeHtml(d.label)+'</option>'; }).join('');
  }

  function renderStaffList(){
    var wrap = document.getElementById('staffListWrap');
    var addCard = document.getElementById('staffAddCard');
    var allFilled = DEPARTMENTS.every(function(d){ return !!staffInDept(d.key); });
    if(addCard) addCard.style.display = allFilled ? 'none' : '';
    if(!allFilled) populateDeptSelect();

    var slotsHtml = DEPARTMENTS.map(function(d){
      var s = staffInDept(d.key);
      if(!s){
        return '<div class="card" style="margin-bottom:14px;">'
          + '<div style="display:flex;align-items:center;justify-content:space-between;gap:12px;">'
          + '<div><p class="eyebrow" style="margin:0 0 4px;">'+escapeHtml(d.label)+'</p><p style="margin:0;color:var(--ink-soft);">Available — no account assigned yet</p></div>'
          + '</div></div>';
      }
      var created = new Date(s.createdAt).toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'numeric' });
      var html = '<div class="card" style="margin-bottom:14px;">'
        + '<div style="display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;">'
        + '<div><p class="eyebrow" style="margin:0 0 4px;">'+escapeHtml(d.label)+' — Assigned</p>'
        + '<p style="margin:0;"><b>'+escapeHtml(s.name || '—')+'</b> · Staff ID <code>'+escapeHtml(s.staffId)+'</code> · since '+created+'</p></div>'
        + '<div style="white-space:nowrap;">'
        + '<button class="btn ghost small" data-reset="'+s.id+'">Reset password</button> '
        + '<button class="btn ghost small" data-remove="'+s.id+'" style="color:var(--danger);border-color:var(--danger);">Remove</button>'
        + '</div></div>';
      if(staffResetOpenId === s.id){
        html += '<div style="display:grid;grid-template-columns:1fr 1fr auto auto;gap:12px;align-items:end;padding:14px 0 0;">'
          + '<div class="field" style="margin-bottom:0;"><label for="resetPw-'+s.id+'">New password</label><input type="password" id="resetPw-'+s.id+'" placeholder="At least 6 characters"></div>'
          + '<div class="field" style="margin-bottom:0;"><label for="resetPw2-'+s.id+'">Confirm password</label><input type="password" id="resetPw2-'+s.id+'" placeholder="Re-enter"></div>'
          + '<button class="btn brick small" data-save-reset="'+s.id+'">Save</button>'
          + '<button class="btn ghost small" data-cancel-reset="'+s.id+'">Cancel</button>'
          + '</div>'
          + '<p class="error-text" id="resetErr-'+s.id+'"></p>';
      }
      html += '</div>';
      return html;
    }).join('');

    // Any staff record that doesn't cleanly belong to one of the 3 current
    // slots (e.g. created before departments existed, or with a stale
    // department value) — surfaced here so it can be cleaned up instead of
    // silently blocking a Staff ID forever.
    var deptKeys = DEPARTMENTS.map(function(d){ return d.key; });
    var legacy = state.staff.filter(function(s){ return deptKeys.indexOf(s.department) === -1; });
    var legacyHtml = '';
    if(legacy.length > 0){
      legacyHtml = '<div class="card" style="margin-top:20px;border-color:var(--danger);">'
        + '<p class="eyebrow" style="margin:0 0 4px;color:var(--danger);">Unassigned / legacy accounts</p>'
        + '<p style="margin:0 0 14px;color:var(--ink-soft);">Created before department was set, or with an unrecognized department. Their Staff ID stays reserved until removed here.</p>'
        + legacy.map(function(s){
            var created = new Date(s.createdAt).toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'numeric' });
            return '<div style="display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;padding:10px 0;border-top:1px solid var(--line);">'
              + '<div><b>'+escapeHtml(s.name || '—')+'</b> · Staff ID <code>'+escapeHtml(s.staffId)+'</code> · since '+created+'</div>'
              + '<button class="btn ghost small" data-remove="'+s.id+'" style="color:var(--danger);border-color:var(--danger);">Remove</button>'
              + '</div>';
          }).join('')
        + '</div>';
    }

    var removedHtml = '';
    if(state.removedStaff.length > 0){
      removedHtml = '<div class="card" style="margin-top:20px;">'
        + '<p class="eyebrow" style="margin:0 0 4px;">Removed staff</p>'
        + '<p style="margin:0 0 14px;color:var(--ink-soft);">Removed accounts stay here so you can undo an accidental removal. Their Staff ID stays reserved for them until you restore or forget them.</p>'
        + state.removedStaff.map(function(s){
            var removed = s.removedAt ? new Date(s.removedAt).toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'numeric' }) : '—';
            return '<div style="display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;padding:10px 0;border-top:1px solid var(--line);">'
              + '<div><b>'+escapeHtml(s.name || '—')+'</b> · Staff ID <code>'+escapeHtml(s.staffId)+'</code> · '+escapeHtml(departmentLabel(s.department))+' · removed '+removed+'</div>'
              + '<div style="white-space:nowrap;">'
              + '<button class="btn ghost small" data-restore="'+s.id+'">Restore</button> '
              + '<button class="btn ghost small" data-forget="'+s.id+'" style="color:var(--danger);border-color:var(--danger);">Forget</button>'
              + '</div></div>';
          }).join('')
        + '</div>';
    }
    wrap.innerHTML = slotsHtml + legacyHtml + removedHtml;

    wrap.querySelectorAll('[data-reset]').forEach(function(btn){
      btn.addEventListener('click', function(){
        staffResetOpenId = (staffResetOpenId === btn.dataset.reset) ? null : btn.dataset.reset;
        renderStaffList();
      });
    });
    wrap.querySelectorAll('[data-cancel-reset]').forEach(function(btn){
      btn.addEventListener('click', function(){ staffResetOpenId = null; renderStaffList(); });
    });
    wrap.querySelectorAll('[data-save-reset]').forEach(function(btn){
      btn.addEventListener('click', function(){
        var sId = btn.dataset.saveReset;
        var s = state.staff.find(function(x){ return x.id === sId; });
        if(!s) return;
        var pw = document.getElementById('resetPw-'+sId).value;
        var pw2 = document.getElementById('resetPw2-'+sId).value;
        var err = document.getElementById('resetErr-'+sId);
        if(pw.length < 6){ err.textContent = 'Password must be at least 6 characters.'; err.classList.add('show'); return; }
        if(pw !== pw2){ err.textContent = 'Passwords do not match.'; err.classList.add('show'); return; }
        var saveBtn = wrap.querySelector('[data-save-reset="'+sId+'"]');
        if(saveBtn) saveBtn.disabled = true;

        // A client app can't change ANOTHER account's password directly (that
        // needs an admin server, which this static site doesn't have) — so a
        // "reset" issues a brand-new staff login and retires the old one.
        var restaurantId = state.session.restaurantId;
        var newEmail = staffEmail(s.staffId, restaurantId, Date.now().toString(36));
        var oldUid = s.id;
        var sAuth = getSecondaryAuth();
        sAuth.createUserWithEmailAndPassword(newEmail, pw).then(function(cred){
          var newUid = cred.user.uid;
          return Promise.all([
            db.collection('users').doc(newUid).set({ role:'staff', restaurantId:restaurantId, staffId:s.staffId, name:s.name, department:s.department, active:true, createdAt: new Date().toISOString() }),
            db.collection('staffDirectory').doc(s.staffId.toLowerCase()).set({ email:newEmail, restaurantId:restaurantId, staffId:s.staffId, name:s.name, department:s.department }),
            db.collection('users').doc(oldUid).delete().catch(function(){})
          ]).then(function(){ return sAuth.signOut(); }).then(function(){ return newUid; });
        }).then(function(newUid){
          s.id = newUid;
          s.email = newEmail;
          return persistStaff();
        }).then(function(){
          if(saveBtn) saveBtn.disabled = false;
          staffResetOpenId = null;
          showToast('Password reset for ' + s.staffId);
          renderStaffList();
        }).catch(function(e){
          if(saveBtn) saveBtn.disabled = false;
          err.textContent = authErrorMessage(e);
          err.classList.add('show');
        });
      });
    });
    wrap.querySelectorAll('[data-remove]').forEach(function(btn){
      btn.addEventListener('click', function(){
        var s = state.staff.find(function(x){ return x.id === btn.dataset.remove; });
        if(s && window.confirm('Remove staff account "'+s.staffId+'" ('+departmentLabel(s.department)+')? They will no longer be able to log in, but you can restore this account later from "Removed staff" below.')){
          db.collection('users').doc(s.id).set({ active:false }, { merge:true }).catch(function(){}).then(function(){
            state.staff = state.staff.filter(function(x){ return x.id !== s.id; });
            s.removedAt = new Date().toISOString();
            state.removedStaff.push(s);
            return persistStaff();
          }).then(function(){ showToast('Staff account removed — restore it anytime from "Removed staff"'); renderStaffList(); });
        }
      });
    });
    wrap.querySelectorAll('[data-restore]').forEach(function(btn){
      btn.addEventListener('click', function(){
        var s = state.removedStaff.find(function(x){ return x.id === btn.dataset.restore; });
        if(!s) return;
        if(staffInDept(s.department)){
          showToast(departmentLabel(s.department) + ' already has an assigned account — remove them first.');
          return;
        }
        db.collection('users').doc(s.id).set({ active:true }, { merge:true }).catch(function(){}).then(function(){
          state.removedStaff = state.removedStaff.filter(function(x){ return x.id !== s.id; });
          delete s.removedAt;
          state.staff.push(s);
          return persistStaff();
        }).then(function(){ showToast('Staff account restored'); renderStaffList(); });
      });
    });
    wrap.querySelectorAll('[data-forget]').forEach(function(btn){
      btn.addEventListener('click', function(){
        var s = state.removedStaff.find(function(x){ return x.id === btn.dataset.forget; });
        if(s && window.confirm('Permanently forget "'+s.staffId+'"? This just clears them from this list — the Staff ID stays reserved and can\'t be reused for someone else.')){
          state.removedStaff = state.removedStaff.filter(function(x){ return x.id !== s.id; });
          persistStaff().then(function(){ renderStaffList(); });
        }
      });
    });
  }
  document.getElementById('addStaffBtn').addEventListener('click', function(){
    var deptSel = document.getElementById('staffDept');
    var department = deptSel ? deptSel.value : '';
    var name = document.getElementById('staffName').value.trim();
    var staffId = document.getElementById('staffId').value.trim();
    var pw = document.getElementById('staffPassword').value;
    var pw2 = document.getElementById('staffPasswordConfirm').value;
    var err = document.getElementById('staffError');
    var btn = document.getElementById('addStaffBtn');

    if(!department){ err.textContent = 'Select a department.'; err.classList.add('show'); return; }
    if(staffInDept(department)){ err.textContent = departmentLabel(department) + ' already has an assigned account.'; err.classList.add('show'); return; }
    if(!staffId){ err.textContent = 'Enter a Staff ID.'; err.classList.add('show'); return; }
    if(pw.length < 6){ err.textContent = 'Password must be at least 6 characters.'; err.classList.add('show'); return; }
    if(pw !== pw2){ err.textContent = 'Passwords do not match.'; err.classList.add('show'); return; }
    err.classList.remove('show');
    btn.disabled = true;

    var restaurantId = state.session.restaurantId;
    var dirId = staffId.toLowerCase();
    db.collection('staffDirectory').doc(dirId).get().then(function(dirSnap){
      if(dirSnap.exists){
        var isRemoved = state.removedStaff.some(function(r){ return r.staffId.toLowerCase() === dirId; });
        throw { code: isRemoved ? 'staff-id-removed' : 'staff-id-taken' };
      }
      var email = staffEmail(staffId, restaurantId);
      var sAuth = getSecondaryAuth();
      return sAuth.createUserWithEmailAndPassword(email, pw).then(function(cred){
        var newUid = cred.user.uid;
        return Promise.all([
          db.collection('users').doc(newUid).set({ role:'staff', restaurantId:restaurantId, staffId:staffId, name:name, department:department, active:true, createdAt: new Date().toISOString() }),
          db.collection('staffDirectory').doc(dirId).set({ email:email, restaurantId:restaurantId, staffId:staffId, name:name, department:department })
        ]).then(function(){ return sAuth.signOut(); }).then(function(){ return { newUid: newUid, email: email }; });
      });
    }).then(function(res){
      state.staff.push({ id: res.newUid, staffId: staffId, name: name, department: department, email: res.email, createdAt: new Date().toISOString() });
      return persistStaff();
    }).then(function(){
      btn.disabled = false;
      showToast('Staff account created for ' + departmentLabel(department));
      document.getElementById('staffName').value = '';
      document.getElementById('staffId').value = '';
      document.getElementById('staffPassword').value = '';
      document.getElementById('staffPasswordConfirm').value = '';
      renderStaffList();
    }).catch(function(e){
      btn.disabled = false;
      err.textContent = (e && e.code === 'staff-id-taken') ? 'That Staff ID is already in use.'
        : (e && e.code === 'staff-id-removed') ? 'That Staff ID belongs to a removed account — restore it from "Removed staff" below instead.'
        : authErrorMessage(e);
      err.classList.add('show');
    });
  });
  bindEnterToSubmit(['staffName','staffId','staffPassword','staffPasswordConfirm'], 'addStaffBtn');
  populateDeptSelect();

