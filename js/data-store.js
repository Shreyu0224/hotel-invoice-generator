"use strict";

  // ---------- department config (hotel-wide) ----------
  var DEPARTMENTS = [
    { key:'room', label:'Room Booking Staff' },
    { key:'restaurant', label:'Restaurant Staff' },
    { key:'banquet', label:'Banquet Hall Staff' }
  ];
  function departmentLabel(key){
    var d = DEPARTMENTS.find(function(x){ return x.key === key; });
    return d ? d.label : key;
  }
  function staffInDept(dept){
    return state.staff.find(function(s){ return s.department === dept; }) || null;
  }

  // ---------- Firestore-backed storage layer ----------
  // Every account's data lives in one document: restaurants/{restaurantId}.
  // restaurantId is always the ADMIN's Firebase Auth uid — staff share it by
  // looking up their own users/{uid} doc, which points at that same id.
  // A live listener keeps every open device in sync automatically.
  var unsubscribeRestaurantDoc = null;

  function restaurantDocRef(){
    if(!state.session || !state.session.restaurantId) return null;
    return db.collection('restaurants').doc(state.session.restaurantId);
  }

  function applyRestaurantSnapshot(data, isFirstLoad){
    if(!data) return;
    state.restaurant = Object.assign({}, DEFAULT_RESTAURANT, data.restaurant || {});
    state.menu = data.menu || [];
    state.deletedMenu = data.deletedMenu || [];
    state.invoices = data.invoices || [];
    state.promoCodes = data.promoCodes || [];
    state.invoiceSeq = typeof data.invoiceSeq === 'number' ? data.invoiceSeq : (state.invoices.length || 0);
    state.staff = data.staff || [];
    state.removedStaff = data.removedStaff || [];
    state.tableCount = typeof data.tableCount === 'number' ? data.tableCount : 0;
    state.tableOrders = data.tableOrders || {};
    state.rooms = data.rooms || [];
    state.roomTypes = (data.roomTypes && data.roomTypes.length) ? data.roomTypes : DEFAULT_ROOM_TYPES.slice();
    state.roomBookings = data.roomBookings || [];
    state.roomBookingSeq = typeof data.roomBookingSeq === 'number' ? data.roomBookingSeq : (state.roomBookings.length || 0);
    state.banquetHalls = data.banquetHalls || [];
    state.hallTypes = (data.hallTypes && data.hallTypes.length) ? data.hallTypes : DEFAULT_HALL_TYPES.slice();
    state.eventTypes = (data.eventTypes && data.eventTypes.length) ? data.eventTypes : DEFAULT_EVENT_TYPES.slice();
    state.banquetBookings = data.banquetBookings || [];
    state.banquetBookingSeq = typeof data.banquetBookingSeq === 'number' ? data.banquetBookingSeq : (state.banquetBookings.length || 0);
    // Subscription: accounts created before this feature shipped have no
    // `subscription` key at all in Firestore — those are grandfathered in
    // and are never gated. Accounts created after ship start at `null`
    // (must choose a plan) and then hold a real subscription object.
    state.subscriptionLegacy = !('subscription' in data);
    state.subscription = ('subscription' in data) ? data.subscription : undefined;
    if(typeof renderSubscriptionStatus === 'function') renderSubscriptionStatus();
    if(!isFirstLoad && document.getElementById('appLayout').classList.contains('show')){
      // A change arrived from another device / tab — refresh the visible screens.
      renderBrandHeader();
      renderMenu();
      renderItemPicker();
      renderHistory();
      renderStaffList();
      renderPromoList();
      if(typeof renderSalesAnalysis === 'function') renderSalesAnalysis();
      // Table config/statuses may have changed remotely (e.g. Admin resized
      // tables, or another device finished a different table's invoice).
      // Never overwrite the table the Staff is actively editing right now.
      if(state.session && state.session.role === 'admin' && typeof renderTablesAdmin === 'function'){ renderTablesAdmin(); }
      if(typeof renderTableStatusBadges === 'function'){ renderTableStatusBadges(); }
      if(state.session && state.session.role === 'admin' && typeof renderRoomsAdmin === 'function'){ renderRoomsAdmin(); }
      if(typeof renderRoomDashboard === 'function'){ renderRoomDashboard(); }
      if(typeof renderRoomBookingsList === 'function'){ renderRoomBookingsList(); }
      if(state.session && state.session.role === 'admin' && typeof renderHallsAdmin === 'function'){ renderHallsAdmin(); }
      if(typeof renderHallDashboard === 'function'){ renderHallDashboard(); }
      if(typeof renderHallBookingsList === 'function'){ renderHallBookingsList(); }
      if(typeof renderRoomHistory === 'function'){ renderRoomHistory(); }
      if(typeof renderBanquetHistory === 'function'){ renderBanquetHistory(); }
    }
  }


  // Resolves once the FIRST snapshot has arrived, then keeps listening forever
  // so later changes (from this device or any other) update `state` live.
  function startRestaurantSync(){
    return new Promise(function(resolve, reject){
      var ref = restaurantDocRef();
      if(!ref){ resolve(); return; }
      if(unsubscribeRestaurantDoc){ unsubscribeRestaurantDoc(); unsubscribeRestaurantDoc = null; }
      var gotFirst = false;
      unsubscribeRestaurantDoc = ref.onSnapshot(function(snap){
        applyRestaurantSnapshot(snap.data(), !gotFirst);
        if(!gotFirst){ gotFirst = true; resolve(); }
      }, function(err){
        console.error('Restaurant sync failed', err);
        if(!gotFirst){ gotFirst = true; reject(err); }
        else showToast('Lost connection to the server — changes may not be saved.');
      });
    });
  }

  function saveRestaurantFields(fields){
    var ref = restaurantDocRef();
    if(!ref) return Promise.resolve(null);
    return ref.set(fields, { merge: true }).catch(function(e){
      console.error('Save failed', e);
      showToast('Could not save — check your internet connection.');
      return null;
    });
  }
  function persistRestaurant(){ return saveRestaurantFields({ restaurant: state.restaurant }); }
  function persistMenu(){ return saveRestaurantFields({ menu: state.menu }); }
  function persistDeletedMenu(){ return saveRestaurantFields({ deletedMenu: state.deletedMenu }); }
  function persistInvoices(){ return saveRestaurantFields({ invoices: state.invoices }); }
  function persistInvoiceSeq(){ return saveRestaurantFields({ invoiceSeq: state.invoiceSeq }); }
  function persistStaff(){ return saveRestaurantFields({ staff: state.staff, removedStaff: state.removedStaff }); }
  function persistPromoCodes(){ return saveRestaurantFields({ promoCodes: state.promoCodes }); }
  function persistRooms(){ return saveRestaurantFields({ rooms: state.rooms }); }
  function persistRoomTypes(){ return saveRestaurantFields({ roomTypes: state.roomTypes }); }
  function persistRoomBookings(){ return saveRestaurantFields({ roomBookings: state.roomBookings }); }
  function persistRoomBookingSeq(){ return saveRestaurantFields({ roomBookingSeq: state.roomBookingSeq }); }
  function persistBanquetHalls(){ return saveRestaurantFields({ banquetHalls: state.banquetHalls }); }
  function persistHallTypes(){ return saveRestaurantFields({ hallTypes: state.hallTypes }); }
  function persistEventTypes(){ return saveRestaurantFields({ eventTypes: state.eventTypes }); }
  function persistBanquetBookings(){ return saveRestaurantFields({ banquetBookings: state.banquetBookings }); }
  function persistBanquetBookingSeq(){ return saveRestaurantFields({ banquetBookingSeq: state.banquetBookingSeq }); }
  // Kept as no-ops for compatibility with older call sites — sessions are now
  // handled entirely by Firebase Auth's own persistence, not our storage.
  function persistAdmin(){ return Promise.resolve(); }
  function persistSession(){ return Promise.resolve(); }

  // ---------- utils ----------
  function uid(){ return 'id-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2,8); }
  function money(n){
    n = Math.round((n + Number.EPSILON) * 100) / 100;
    return state.restaurant.currency + n.toFixed(2);
  }
  function escapeHtml(s){
    return String(s).replace(/[&<>"']/g, function(c){
      return ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c];
    });
  }
  function showToast(msg){
    var t = document.getElementById('toast');
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(t._timer);
    t._timer = setTimeout(function(){ t.classList.remove('show'); }, 2200);
  }
  function isValidEmail(email){ return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email); }
  function authErrorMessage(err){
    switch(err && err.code){
      case 'auth/email-already-in-use': return 'An account with that email already exists.';
      case 'auth/invalid-email': return 'Enter a valid email address.';
      case 'auth/weak-password': return 'Password must be at least 6 characters.';
      case 'auth/user-not-found':
      case 'auth/wrong-password':
      case 'auth/invalid-credential': return 'Incorrect email or password.';
      case 'auth/network-request-failed': return 'Network error — check your internet connection.';
      case 'auth/requires-recent-login': return 'For security, please sign out and back in, then try again.';
      case 'auth/provider-already-linked': return 'A password is already set for this account.';
      case 'auth/credential-already-in-use': return 'That email/password is already linked to a different account.';
      default: return (err && err.message) || 'Something went wrong. Please try again.';
    }
  }

  // Creating a staff login means creating a second Firebase Auth account —
  // done on a separate, secondary app instance so it never touches (or signs
  // out) the admin's own active session on this device.
  var secondaryApp = null;
  function getSecondaryAuth(){
    if(!secondaryApp){ secondaryApp = firebase.initializeApp(firebaseConfig, 'Secondary'); }
    return secondaryApp.auth();
  }

  // Pressing Enter inside any of the given input ids clicks the target button.
  function bindEnterToSubmit(inputIds, buttonId){
    inputIds.forEach(function(id){
      var el = document.getElementById(id);
      if(!el) return;
      el.addEventListener('keydown', function(e){
        if(e.key === 'Enter'){
          e.preventDefault();
          var btn = document.getElementById(buttonId);
          if(btn) btn.click();
        }
      });
    });
  }

