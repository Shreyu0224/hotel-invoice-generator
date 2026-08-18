"use strict";

// =====================================================================
// SUBSCRIPTION SYSTEM
// Two plans only: a free 7-day trial, and a ₹12,000/year Premium plan
// paid through Razorpay Checkout. Trial activation writes straight to
// Firestore (it's free, low risk). Premium activation always goes
// through the Cloud Functions backend (createSubscriptionOrder /
// verifySubscriptionPayment) — the client NEVER marks itself Premium;
// only the server does, after verifying the Razorpay signature.
//
// SETUP NEEDED FROM YOU:
// 1. Replace RAZORPAY_KEY_ID below with your real Razorpay Key ID
//    (Test or Live — this is the public, non-secret Key ID, safe to
//    ship in frontend code). Get it from Razorpay Dashboard > Settings
//    > API Keys.
// 2. Deploy the Cloud Functions in /functions (see functions/README
//    inside that folder for exact steps) — that's where the SECRET key
//    lives, never here.
// =====================================================================

var RAZORPAY_KEY_ID = 'rzp_test_XXXXXXXXXXXXXX'; // <-- put your Razorpay Key ID here
var SUBSCRIPTION_TRIAL_DAYS = 7;
var SUBSCRIPTION_PREMIUM_PRICE = 12000; // ₹, display only — real charge amount lives server-side
var SUBSCRIPTION_PREMIUM_MONTHS = 12;

var subSelectedPlan = null; // 'trial' | 'premium' — set when a plan card is picked

// ---------- date / status helpers ----------
function subDaysBetween(fromISO, toDate){
  var from = new Date(fromISO);
  var ms = toDate.getTime() - from.getTime();
  return Math.ceil(ms / (24*60*60*1000));
}
function subFormatDate(iso){
  if(!iso) return '';
  var d = new Date(iso);
  var dd = String(d.getDate()).padStart(2,'0');
  var mm = String(d.getMonth()+1).padStart(2,'0');
  var yyyy = d.getFullYear();
  return dd + '/' + mm + '/' + yyyy;
}

// Returns a normalized live status even if the stored `status` string is
// stale (e.g. a trial that expired since the last write) — this is what
// every part of the UI should read, rather than trusting sub.status blindly.
function computeSubscriptionStatus(sub){
  if(!sub || !sub.plan) return { code:'none', label:'No Subscription' };
  var now = new Date();
  if(sub.plan === 'trial'){
    var daysLeft = subDaysBetween(now.toISOString(), new Date(sub.trialExpiry));
    if(now < new Date(sub.trialExpiry)){
      return { code:'trial_active', label:'Free Trial Active', daysLeft: Math.max(0, daysLeft) };
    }
    return { code:'trial_expired', label:'Trial Expired' };
  }
  if(sub.plan === 'premium'){
    if(sub.status === 'payment_pending') return { code:'payment_pending', label:'Payment Pending' };
    if(sub.status === 'payment_failed') return { code:'payment_failed', label:'Payment Failed' };
    if(sub.premiumExpiry && now < new Date(sub.premiumExpiry)){
      return { code:'premium_active', label:'Premium Active' };
    }
    return { code:'premium_expired', label:'Premium Expired' };
  }
  return { code:'none', label:'No Subscription' };
}

// ---------- gating (called from enterApp) ----------
function checkSubscriptionGate(){
  if(!state.session || state.session.role !== 'admin'){
    renderSubscriptionStatus();
    return; // staff accounts are never gated or shown billing UI
  }
  if(state.subscriptionLegacy){
    // Account existed before this feature shipped — never force them
    // through the paywall. They can still see status/upgrade in Setup.
    renderSubscriptionStatus();
    return;
  }
  var sub = state.subscription;
  if(sub === null || sub === undefined){
    openSubscriptionModal({ mandatory:true });
    return;
  }
  var st = computeSubscriptionStatus(sub);
  if(st.code === 'trial_expired' || st.code === 'premium_expired'){
    openSubscriptionModal({ mandatory:true, upgradeOnly:true });
    return;
  }
  renderSubscriptionStatus();
}

// ---------- status rendering (topbar pill + Setup tab card) ----------
function renderSubscriptionStatus(){
  var pill = document.getElementById('subStatusPill');
  var card = document.getElementById('subscriptionStatusCard');
  var cardBody = document.getElementById('subscriptionStatusCardBody');
  if(!pill && !card) return; // markup not present yet (e.g. before login)

  if(!state.session || state.session.role !== 'admin'){
    if(pill) pill.style.display = 'none';
    if(card) card.style.display = 'none';
    return;
  }

  var sub = state.subscription;
  var legacy = state.subscriptionLegacy;
  var st = legacy ? { code:'legacy', label:'Active' } : computeSubscriptionStatus(sub);

  if(pill){
    pill.style.display = '';
    pill.className = 'sub-status-pill sub-' + st.code;
    var pillText = st.label;
    if(st.code === 'trial_active') pillText = st.daysLeft + ' day' + (st.daysLeft===1?'':'s') + ' left in trial';
    if(st.code === 'premium_active') pillText = 'Premium · until ' + subFormatDate(sub.premiumExpiry);
    if(st.code === 'legacy') pillText = 'Active';
    pill.textContent = pillText;
    pill.onclick = function(){ openSubscriptionModal({ mandatory:false }); };
  }

  if(card){
    card.style.display = '';
    var html = '';
    if(legacy){
      html += '<div class="sub-card-row"><span class="sub-badge sub-premium_active">Active</span></div>' +
              '<p class="hint">Your account predates the subscription system, so it stays fully active. ' +
              'You can optionally start a plan below for record-keeping.</p>';
    } else if(st.code === 'none'){
      html += '<p class="hint">No subscription selected yet.</p>';
    } else if(st.code === 'trial_active'){
      html += '<div class="sub-card-row"><span class="sub-badge sub-trial_active">Free Trial Active</span></div>' +
              '<p class="hint">' + st.daysLeft + ' day' + (st.daysLeft===1?'':'s') + ' remaining · expires ' + subFormatDate(sub.trialExpiry) + '</p>';
    } else if(st.code === 'trial_expired'){
      html += '<div class="sub-card-row"><span class="sub-badge sub-trial_expired">Trial Expired</span></div>' +
              '<p class="hint">Upgrade to Premium — ₹' + SUBSCRIPTION_PREMIUM_PRICE.toLocaleString('en-IN') + '/year — to keep using the app.</p>';
    } else if(st.code === 'premium_active'){
      html += '<div class="sub-card-row"><span class="sub-badge sub-premium_active">Premium Plan</span></div>' +
              '<p class="hint">Active until ' + subFormatDate(sub.premiumExpiry) + '</p>';
    } else if(st.code === 'premium_expired'){
      html += '<div class="sub-card-row"><span class="sub-badge sub-premium_expired">Premium Expired</span></div>' +
              '<p class="hint">Renew for ₹' + SUBSCRIPTION_PREMIUM_PRICE.toLocaleString('en-IN') + '/year to keep using the app.</p>';
    } else if(st.code === 'payment_pending'){
      html += '<div class="sub-card-row"><span class="sub-badge sub-payment_pending">Payment Pending</span></div>' +
              '<p class="hint">We didn\u2019t receive a confirmed payment yet. You can try again below.</p>';
    } else if(st.code === 'payment_failed'){
      html += '<div class="sub-card-row"><span class="sub-badge sub-payment_failed">Payment Failed</span></div>' +
              '<p class="hint">Your last payment attempt failed. No charge was made. You can try again below.</p>';
    }
    html += '<button type="button" class="btn brick" id="subCardManageBtn" style="margin-top:12px;">' +
            ((st.code === 'premium_active') ? 'Manage Subscription' : 'View Plans') + '</button>';
    cardBody.innerHTML = html;
    var manageBtn = document.getElementById('subCardManageBtn');
    if(manageBtn) manageBtn.onclick = function(){ openSubscriptionModal({ mandatory:false }); };
  }
}

// ---------- modal open/close ----------
function openSubscriptionModal(opts){
  opts = opts || {};
  var overlay = document.getElementById('subscriptionOverlay');
  if(!overlay) return;
  overlay.classList.add('show');
  var closeBtn = document.getElementById('subscriptionCloseBtn');
  if(closeBtn) closeBtn.style.display = opts.mandatory ? 'none' : '';
  document.getElementById('subStepPlans').style.display = '';
  document.getElementById('subStepDetails').style.display = 'none';
  document.getElementById('subStepStatus').style.display = 'none';

  var trialCard = document.querySelector('.subscription-plan-card[data-plan="trial"]');
  if(trialCard) trialCard.style.display = opts.upgradeOnly ? 'none' : '';

  if(opts.upgradeOnly){
    var msg = document.getElementById('subUpgradeOnlyMsg');
    if(msg) msg.style.display = '';
  } else {
    var msg2 = document.getElementById('subUpgradeOnlyMsg');
    if(msg2) msg2.style.display = 'none';
  }
}
function closeSubscriptionModal(){
  var overlay = document.getElementById('subscriptionOverlay');
  if(overlay) overlay.classList.remove('show');
}

// ---------- prefill details from the admin's known info ----------
function subPrefillDetails(){
  var emailEl = document.getElementById('subEmail');
  var orgEl = document.getElementById('subOrg');
  var addrEl = document.getElementById('subAddress');
  if(emailEl && !emailEl.value && state.session && state.session.email) emailEl.value = state.session.email;
  if(orgEl && !orgEl.value && state.restaurant && state.restaurant.name) orgEl.value = state.restaurant.name;
  if(addrEl && !addrEl.value && state.restaurant && state.restaurant.address) addrEl.value = state.restaurant.address;
  var phoneEl = document.getElementById('subPhone');
  if(phoneEl && !phoneEl.value && state.restaurant && state.restaurant.phone){
    var digits = state.restaurant.phone.replace(/\D/g,'').slice(-10);
    if(digits.length === 10) phoneEl.value = digits;
  }
}

// ---------- validation ----------
function subValidateDetails(){
  var name = document.getElementById('subName').value.trim();
  var email = document.getElementById('subEmail').value.trim();
  var phone = document.getElementById('subPhone').value.trim();
  var org = document.getElementById('subOrg').value.trim();
  var address = document.getElementById('subAddress').value.trim();
  var errEl = document.getElementById('subDetailsError');

  if(!name){ errEl.textContent = 'Please enter your full name.'; errEl.classList.add('show'); return null; }
  if(!isValidEmail(email)){ errEl.textContent = 'Please enter a valid email address.'; errEl.classList.add('show'); return null; }
  if(!/^[6-9]\d{9}$/.test(phone)){ errEl.textContent = 'Please enter a valid 10-digit Indian phone number.'; errEl.classList.add('show'); return null; }
  if(!org){ errEl.textContent = 'Please enter your business/organization name.'; errEl.classList.add('show'); return null; }
  if(!address){ errEl.textContent = 'Please enter your address.'; errEl.classList.add('show'); return null; }

  errEl.classList.remove('show');
  return { name:name, email:email, phone:phone, org:org, address:address };
}

// ---------- free trial activation (direct Firestore write — no payment) ----------
function activateFreeTrial(details){
  var now = new Date();
  var expiry = new Date(now.getTime() + SUBSCRIPTION_TRIAL_DAYS * 24*60*60*1000);
  var ref = restaurantDocRef();
  if(!ref) return Promise.reject(new Error('Not signed in.'));
  return ref.set({
    subscription: {
      status: 'trial_active',
      plan: 'trial',
      customer: details,
      trialStart: now.toISOString(),
      trialExpiry: expiry.toISOString(),
      premiumStart: null,
      premiumExpiry: null,
      razorpay: null
    }
  }, { merge:true }).then(function(){
    state.subscription = {
      status:'trial_active', plan:'trial', customer:details,
      trialStart: now.toISOString(), trialExpiry: expiry.toISOString()
    };
    state.subscriptionLegacy = false;
  });
}

// ---------- premium purchase via Razorpay Checkout ----------
function startPremiumCheckout(details, onDone){
  if(!functions){
    onDone(new Error('Payments are not set up yet on this deployment (Cloud Functions unavailable).'));
    return;
  }
  var createOrder = functions.httpsCallable('createSubscriptionOrder');
  createOrder({ customer: details }).then(function(res){
    var data = res.data;
    var options = {
      key: data.keyId || RAZORPAY_KEY_ID,
      amount: data.amount,
      currency: data.currency,
      name: state.restaurant.name || 'Invoice Desk',
      description: 'Premium Subscription — 1 Year',
      order_id: data.orderId,
      prefill: { name: details.name, email: details.email, contact: details.phone },
      theme: { color: '#8a2323' }, // matches --brick
      handler: function(response){
        var verify = functions.httpsCallable('verifySubscriptionPayment');
        verify({
          razorpay_order_id: response.razorpay_order_id,
          razorpay_payment_id: response.razorpay_payment_id,
          razorpay_signature: response.razorpay_signature
        }).then(function(verifyRes){
          state.subscription = {
            status:'premium_active', plan:'premium', customer:details,
            premiumStart: new Date().toISOString(), premiumExpiry: verifyRes.data.premiumExpiry
          };
          state.subscriptionLegacy = false;
          onDone(null, verifyRes.data);
        }).catch(function(err){
          onDone(err || new Error('Payment verification failed.'));
        });
      },
      modal: {
        ondismiss: function(){
          onDone({ code:'cancelled' });
        }
      }
    };
    var rzp = new Razorpay(options);
    rzp.on('payment.failed', function(){
      onDone({ code:'payment-failed' });
    });
    rzp.open();
  }).catch(function(err){
    onDone(err);
  });
}

// ---------- wire up the modal's UI ----------
(function(){
  document.getElementById('subscriptionCloseBtn').addEventListener('click', closeSubscriptionModal);

  document.querySelectorAll('[data-select-plan]').forEach(function(btn){
    btn.addEventListener('click', function(){
      subSelectedPlan = btn.getAttribute('data-select-plan');
      document.getElementById('subStepPlans').style.display = 'none';
      document.getElementById('subStepDetails').style.display = '';
      document.getElementById('subDetailsTitle').textContent =
        subSelectedPlan === 'trial' ? 'Start your free trial' : 'Subscribe to Premium';
      document.getElementById('subContinueBtn').textContent =
        subSelectedPlan === 'trial' ? 'Start Free Trial' : 'Pay ₹' + SUBSCRIPTION_PREMIUM_PRICE.toLocaleString('en-IN') + ' & Subscribe';
      subPrefillDetails();
    });
  });

  document.getElementById('subBackBtn').addEventListener('click', function(){
    document.getElementById('subStepDetails').style.display = 'none';
    document.getElementById('subStepPlans').style.display = '';
  });

  document.getElementById('subContinueBtn').addEventListener('click', function(){
    var details = subValidateDetails();
    if(!details) return;
    var btn = document.getElementById('subContinueBtn');
    btn.disabled = true;

    if(subSelectedPlan === 'trial'){
      btn.textContent = 'Activating…';
      activateFreeTrial(details).then(function(){
        btn.disabled = false;
        showSubscriptionResult(true, 'Your 7-Day Free Trial is Active', 'Trial expires on ' + subFormatDate(state.subscription.trialExpiry) + '.');
      }).catch(function(err){
        btn.disabled = false;
        btn.textContent = 'Start Free Trial';
        var errEl = document.getElementById('subDetailsError');
        errEl.textContent = (err && err.message) || 'Could not start your trial. Please try again.';
        errEl.classList.add('show');
      });
    } else {
      btn.textContent = 'Opening payment…';
      startPremiumCheckout(details, function(err, data){
        btn.disabled = false;
        btn.textContent = 'Pay ₹' + SUBSCRIPTION_PREMIUM_PRICE.toLocaleString('en-IN') + ' & Subscribe';
        if(err){
          if(err.code === 'cancelled'){
            var errEl = document.getElementById('subDetailsError');
            errEl.textContent = 'Payment window closed. No charge was made — you can try again.';
            errEl.classList.add('show');
            return;
          }
          showSubscriptionResult(false, 'Payment Failed', (err && err.message) || 'Your payment could not be completed. No charge was made.');
          return;
        }
        showSubscriptionResult(true, 'Payment Successful!', 'Your Premium subscription is now active for 12 months (until ' + subFormatDate(data.premiumExpiry) + ').');
      });
    }
  });
})();

function showSubscriptionResult(success, title, message){
  document.getElementById('subStepDetails').style.display = 'none';
  document.getElementById('subStepPlans').style.display = 'none';
  var statusStep = document.getElementById('subStepStatus');
  statusStep.style.display = '';
  document.getElementById('subStatusContent').innerHTML =
    '<p class="eyebrow">' + (success ? 'Success' : 'Payment') + '</p>' +
    '<h2>' + title + '</h2>' +
    '<p class="hint" style="margin-bottom:20px;">' + message + '</p>' +
    '<button type="button" class="btn brick full" id="subDoneBtn">' + (success ? 'Continue' : 'Try Again') + '</button>';
  var closeBtn = document.getElementById('subscriptionCloseBtn');
  if(closeBtn) closeBtn.style.display = success ? '' : 'none';
  document.getElementById('subDoneBtn').onclick = function(){
    if(success){
      closeSubscriptionModal();
      renderSubscriptionStatus();
    } else {
      document.getElementById('subStepStatus').style.display = 'none';
      document.getElementById('subStepDetails').style.display = '';
    }
  };
}
