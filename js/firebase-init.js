"use strict";

  // =====================================================================
  // FIREBASE SETUP — fill this in with YOUR project's config before this
  // will work. Create a free project at https://console.firebase.google.com,
  // enable "Email/Password" under Authentication > Sign-in method, create a
  // Firestore database (production mode), then Project settings > your web
  // app > SDK setup and paste the config object it gives you below.
  // =====================================================================
  var firebaseConfig = {
    apiKey: "AIzaSyA7KTONnx8Xkgr9a2B4Nup9O4RvRkrL8aQ",
    authDomain: "resturant-invoice-generator.firebaseapp.com",
    projectId: "resturant-invoice-generator",
    storageBucket: "resturant-invoice-generator.firebasestorage.app",
    messagingSenderId: "338690470146",
    appId: "1:338690470146:web:e4a828474f26a5b6c1921b"
  };
  firebase.initializeApp(firebaseConfig);
  var auth = firebase.auth();
  var db = firebase.firestore();
  var googleProvider = new firebase.auth.GoogleAuthProvider();
  // Used by the subscription system to call the Cloud Functions backend
  // (createSubscriptionOrder / verifySubscriptionPayment) that talk to Razorpay.
  var functions = firebase.app().functions ? firebase.app().functions('asia-south1') : null;

  // A staff account needs a real Firebase Auth email, but staff only ever
  // type a short Staff ID — so we synthesize a private-looking email behind
  // the scenes and never show it in the UI.
  function staffEmail(staffId, restaurantId, salt){
    return (staffId + '.' + restaurantId.slice(0,8) + (salt ? '.' + salt : '')).toLowerCase() + '@staff.invoice-desk.local';
  }

  var DEFAULT_RESTAURANT = {
    name:"", phone:"", address:"", email:"", gstin:"", taxRate:5, currency:"₹",
    invoicePrefix:"INV", footer:"Thank you for choosing us! Visit again.", signature:"", signatureRatio:0
  };

  // Default room types — admin can add more from Room Setup, so this is only the starting list.
  var DEFAULT_ROOM_TYPES = ['Single','Double','Twin','Deluxe','Suite'];
  // Default hall/event types — admin can add more from Banquet Setup.
  var DEFAULT_HALL_TYPES = ['Small','Medium','Large','Premium'];
  var DEFAULT_EVENT_TYPES = ['Wedding','Birthday Party','Corporate Event','Conference','Anniversary','Other'];

  var state = {
    restaurant: Object.assign({}, DEFAULT_RESTAURANT),
    menu: [],
    deletedMenu: [],
    invoices: [],
    order: [],
    paymentMethod: 'Cash',
    promoCodes: [],
    appliedPromo: null,
    activeInvoice: null,
    activeInvoiceKind: 'restaurant', // 'restaurant' | 'room' | 'banquet' — which receipt/PDF/WhatsApp builder the invoice overlay should use
    activeRoomBooking: null,
    activeBanquetBooking: null,
    invoiceSeq: 0,
    admin: null,        // { email, createdAt } — no password ever stored here; Firebase Auth owns that
    staff: [],           // [{ id(=uid), staffId, name, department, email, createdAt }] — max one per department
    removedStaff: [],    // soft-deleted staff — kept so they can be restored; their Staff ID/email stay reserved
    session: null,       // { role:'admin', email, uid, restaurantId } or { role:'staff', department, staffId, name, uid, restaurantId }
    tableCount: 0,       // admin-configured number of restaurant tables
    tableOrders: {},     // { 1: {status,customerName,customerPhone,order,paymentMethod,appliedPromo}, 2: {...}, ... }
    currentTable: null,  // table number currently selected by staff (null = legacy single-bill mode)

    // ---- Room Management (Hotel) ----
    rooms: [],            // [{ id, roomNumber, roomType, price, status, createdAt }] — status: available/cleaning/maintenance/out-of-service
    roomTypes: DEFAULT_ROOM_TYPES.slice(),
    roomBookings: [],      // [{ id, bookingNo, createdAt, guestName, guestPhone, guestEmail, guestAddress, guests, idDetails,
                            //    roomId, roomNumber, roomType, price, checkIn, checkOut, nights, subtotal, cgst, sgst, tax,
                            //    discountAmount, promoCode, total, paymentStatus, amountPaid, balanceDue,
                            //    bookingStatus, createdByStaffId, createdByName }]
    roomBookingSeq: 0,
    roomSelectedForBooking: null, // room object staff picked "Book" on, drives the booking form

    // ---- Banquet Hall Management ----
    banquetHalls: [],      // [{ id, hallName, hallType, capacity, price, status, createdAt }]
    hallTypes: DEFAULT_HALL_TYPES.slice(),
    eventTypes: DEFAULT_EVENT_TYPES.slice(),
    banquetBookings: [],   // same shape as roomBookings, with hallId/hallName/hallType/eventType/guestName->custName-style fields
    banquetBookingSeq: 0,
    hallSelectedForBooking: null,

    // ---- Subscription (SaaS billing for this admin's account) ----
    // undefined = pre-subscription-feature account (grandfathered, never gated)
    // null      = brand-new account, must choose a plan
    // {...}     = { status, plan, customer, trialStart, trialExpiry, premiumStart, premiumExpiry, razorpay }
    subscription: undefined,
    subscriptionLegacy: false
  };

  var STORAGE_PREFIX = 'invoice-desk:'; // used only for local UI prefs (e.g. sidebar collapsed state), not account data

  var NAV_ICONS = {
    dashboard: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="9" rx="1"/><rect x="14" y="3" width="7" height="5" rx="1"/><rect x="14" y="12" width="7" height="9" rx="1"/><rect x="3" y="16" width="7" height="5" rx="1"/></svg>',
    restaurant: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M7 2v7a1.5 1.5 0 0 0 1.5 1.5h0A1.5 1.5 0 0 0 10 9V2"/><path d="M8.5 10.5V22"/><path d="M17 2c-1.7 0-3 1.8-3 5s1.3 5 3 5v10"/></svg>',
    room: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M2 20v-7a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v7"/><path d="M2 15h20"/><path d="M6 11V7a2 2 0 0 1 2-2h1a2 2 0 0 1 2 2"/></svg>',
    banquet: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M4 21V10l8-5 8 5v11"/><path d="M4 21h16"/><path d="M9 21v-6h6v6"/></svg>',
    promo: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M12.6 2.6 21.4 11.4a2 2 0 0 1 0 2.8l-7.2 7.2a2 2 0 0 1-2.8 0L2.6 12.6A2 2 0 0 1 2 11.2V4a2 2 0 0 1 2-2h7.2a2 2 0 0 1 1.4.6Z"/><circle cx="7.5" cy="7.5" r="1.5"/></svg>',
    history: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l4 2"/></svg>',
    staff: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2"/><circle cx="10" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>',
    setup: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>',
    billing: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M6 2h12a1 1 0 0 1 1 1v18l-3-2-2 2-2-2-2 2-2-2-3 2V3a1 1 0 0 1 1-1Z"/><path d="M9 8h6M9 12h6M9 16h3"/></svg>',
    table: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="8" width="18" height="3" rx="1"/><path d="M6 11v9M18 11v9"/></svg>'
  };
  var ADMIN_TABS = [
    { key:'analysis', label:'Dashboard', num:'01', icon:NAV_ICONS.dashboard },
    { key:'menu-group', label:'Restaurant', num:'02', icon:NAV_ICONS.restaurant, children:[
        { key:'menu', label:'Add new item' },
        { key:'menu-trash', label:'Deleted items' },
        { key:'tables', label:'Tables' }
      ] },
    { key:'room-setup', label:'Room Setup', num:'03', icon:NAV_ICONS.room },
    { key:'banquet-setup', label:'Banquet Setup', num:'04', icon:NAV_ICONS.banquet },
    { key:'promos', label:'Promo Codes', num:'05', icon:NAV_ICONS.promo },
    { key:'history', label:'History', num:'06', icon:NAV_ICONS.history },
    { key:'staff', label:'Staff Mgmt', num:'07', icon:NAV_ICONS.staff },
    { key:'setup', label:'Setup', num:'08', icon:NAV_ICONS.setup }
  ];
  // Legacy fallback when Admin hasn't configured any tables yet — keeps the
  // original single "Billing" screen working exactly as before.
  var LEGACY_STAFF_TABS = [
    { key:'billing', label:'Billing', num:'01', icon:NAV_ICONS.billing }
  ];
  function getRestaurantStaffTabs(){
    var n = state.tableCount || 0;
    if(n <= 0) return LEGACY_STAFF_TABS;
    var tabs = [];
    for(var i=1;i<=n;i++){
      tabs.push({ key:'table-'+i, label:'Table '+i, num:String(i).padStart(2,'0'), tableId:i, icon:NAV_ICONS.table });
    }
    return tabs;
  }
  var ROOM_STAFF_TABS = [
    { key:'room-booking', label:'Rooms', num:'01', icon:NAV_ICONS.room }
  ];
  var BANQUET_STAFF_TABS = [
    { key:'banquet-booking', label:'Banquet Hall', num:'01', icon:NAV_ICONS.banquet }
  ];
  // Every staff account belongs to exactly one department; their nav is
  // scoped to that department's tabs only. Restaurant staff keep the
  // existing per-table billing tabs untouched.
  function getStaffTabs(){
    var dept = state.session && state.session.department;
    if(dept === 'room') return ROOM_STAFF_TABS;
    if(dept === 'banquet') return BANQUET_STAFF_TABS;
    return getRestaurantStaffTabs();
  }

