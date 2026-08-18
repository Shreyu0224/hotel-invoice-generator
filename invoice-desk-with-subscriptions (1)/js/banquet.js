"use strict";

  // =====================================================================
  // BANQUET HALL MANAGEMENT — Banquet Setup (admin) + Banquet Hall (staff)
  // Mirrors the Room Management module above exactly (same rules, same
  // storage/invoice approach), adapted for halls/events instead of rooms/stays.
  // Reuses roomStatusLabel/roomStatusBadgeClass/bookingOverlaps/
  // paymentStatusBadgeClass/findPromoByCode from the Room module above.
  // =====================================================================

  // ---------- hall types + event types (admin) ----------
  function renderHallTypesAdmin(){
    var wrap = document.getElementById('hallTypesWrap');
    if(!wrap) return;
    if(state.hallTypes.length === 0){
      wrap.innerHTML = '<span style="color:var(--ink-faint);font-size:12.5px;">No hall types yet — add one below.</span>';
      return;
    }
    wrap.innerHTML = state.hallTypes.map(function(t){
      return '<span class="room-type-chip">'+escapeHtml(t)+'<button type="button" data-del-halltype="'+escapeHtml(t)+'" title="Remove">✕</button></span>';
    }).join('');
    wrap.querySelectorAll('[data-del-halltype]').forEach(function(btn){
      btn.addEventListener('click', function(){
        var t = btn.dataset.delHalltype;
        var inUse = state.banquetHalls.some(function(h){ return h.hallType === t; });
        if(inUse){ showToast('Can\'t remove "'+t+'" — a hall still uses it.'); return; }
        if(!window.confirm('Remove hall type "'+t+'"?')) return;
        state.hallTypes = state.hallTypes.filter(function(x){ return x !== t; });
        persistHallTypes().then(function(){
          renderHallTypesAdmin();
          fillAdminHallTypeSelect();
          fillStaffHallTypeFilter();
          showToast('Hall type removed');
        });
      });
    });
  }
  function fillAdminHallTypeSelect(){
    var sel = document.getElementById('hallTypeSelect');
    if(!sel) return;
    var current = sel.value;
    sel.innerHTML = state.hallTypes.map(function(t){ return '<option value="'+escapeHtml(t)+'">'+escapeHtml(t)+'</option>'; }).join('');
    if(current && state.hallTypes.indexOf(current) !== -1) sel.value = current;
  }
  function fillStaffHallTypeFilter(){
    var sel = document.getElementById('hallFilterType');
    if(!sel) return;
    var current = sel.value;
    sel.innerHTML = '<option value="">All types</option>' + state.hallTypes.map(function(t){ return '<option value="'+escapeHtml(t)+'">'+escapeHtml(t)+'</option>'; }).join('');
    sel.value = current;
  }
  document.getElementById('addHallTypeBtn').addEventListener('click', function(){
    var input = document.getElementById('hallTypeNewInput');
    var val = input.value.trim();
    if(!val) return;
    if(state.hallTypes.some(function(t){ return t.toLowerCase() === val.toLowerCase(); })){
      showToast('That hall type already exists.');
      return;
    }
    state.hallTypes.push(val);
    persistHallTypes().then(function(){
      input.value = '';
      renderHallTypesAdmin();
      fillAdminHallTypeSelect();
      fillStaffHallTypeFilter();
      showToast('Hall type added');
    });
  });

  function renderEventTypesAdmin(){
    var wrap = document.getElementById('eventTypesWrap');
    if(!wrap) return;
    if(state.eventTypes.length === 0){
      wrap.innerHTML = '<span style="color:var(--ink-faint);font-size:12.5px;">No event types yet — add one below.</span>';
      return;
    }
    wrap.innerHTML = state.eventTypes.map(function(t){
      return '<span class="room-type-chip">'+escapeHtml(t)+'<button type="button" data-del-eventtype="'+escapeHtml(t)+'" title="Remove">✕</button></span>';
    }).join('');
    wrap.querySelectorAll('[data-del-eventtype]').forEach(function(btn){
      btn.addEventListener('click', function(){
        var t = btn.dataset.delEventtype;
        var inUse = state.banquetBookings.some(function(b){ return b.eventType === t; });
        if(inUse){ showToast('Can\'t remove "'+t+'" — a booking still uses it.'); return; }
        if(!window.confirm('Remove event type "'+t+'"?')) return;
        state.eventTypes = state.eventTypes.filter(function(x){ return x !== t; });
        persistEventTypes().then(function(){
          renderEventTypesAdmin();
          fillEventTypeSelect();
          showToast('Event type removed');
        });
      });
    });
  }
  function fillEventTypeSelect(){
    var sel = document.getElementById('hbEventType');
    if(!sel) return;
    var current = sel.value;
    sel.innerHTML = state.eventTypes.map(function(t){ return '<option value="'+escapeHtml(t)+'">'+escapeHtml(t)+'</option>'; }).join('');
    if(current && state.eventTypes.indexOf(current) !== -1) sel.value = current;
  }
  document.getElementById('addEventTypeBtn').addEventListener('click', function(){
    var input = document.getElementById('eventTypeNewInput');
    var val = input.value.trim();
    if(!val) return;
    if(state.eventTypes.some(function(t){ return t.toLowerCase() === val.toLowerCase(); })){
      showToast('That event type already exists.');
      return;
    }
    state.eventTypes.push(val);
    persistEventTypes().then(function(){
      input.value = '';
      renderEventTypesAdmin();
      fillEventTypeSelect();
      showToast('Event type added');
    });
  });

  // ---------- halls CRUD (admin) ----------
  var hallEditingId = null;
  function renderHallsAdmin(){
    var wrap = document.getElementById('hallsAdminListWrap');
    if(!wrap) return;
    if(state.banquetHalls.length === 0){
      wrap.innerHTML = '<div class="empty-state"><p class="big">No halls yet</p><p>Add your first hall above to get started.</p></div>';
      return;
    }
    var sorted = state.banquetHalls.slice().sort(function(a,b){
      return String(a.hallName).localeCompare(String(b.hallName), undefined, { numeric:true });
    });
    var statusOptions = ['available','cleaning','maintenance','out-of-service'];
    var rows = sorted.map(function(h){
      if(hallEditingId === h.id){
        return '<tr>'
          + '<td data-label="Hall"><input class="edit-field edit-name" data-edit-hallname="'+h.id+'" value="'+escapeHtml(h.hallName)+'" style="width:140px;"></td>'
          + '<td data-label="Type"><select class="edit-field" data-edit-halltype="'+h.id+'">'
            + state.hallTypes.map(function(t){ return '<option value="'+escapeHtml(t)+'"'+(t===h.hallType?' selected':'')+'>'+escapeHtml(t)+'</option>'; }).join('')
            + '</select></td>'
          + '<td data-label="Capacity"><input class="edit-field" type="number" min="0" step="1" data-edit-capacity="'+h.id+'" value="'+(h.capacity||0)+'" style="width:80px;"></td>'
          + '<td data-label="Price"><input class="edit-field edit-price" type="number" min="0" step="1" data-edit-hallprice="'+h.id+'" value="'+h.price+'" style="width:100px;"></td>'
          + '<td data-label="Status"><select class="edit-field" data-edit-hallstatus="'+h.id+'">'
            + statusOptions.map(function(s){ return '<option value="'+s+'"'+(s===h.status?' selected':'')+'>'+roomStatusLabel(s)+'</option>'; }).join('')
            + '</select></td>'
          + '<td data-label="" class="row-actions-cell">'
            + '<button class="icon-btn" data-save-hall="'+h.id+'" title="Save" style="color:var(--success);border-color:var(--success);">✓</button> '
            + '<button class="icon-btn" data-cancel-hall-edit="'+h.id+'" title="Cancel">✕</button>'
            + '</td></tr>';
      }
      var hallTodayInfoVal = hallTodayInfo(h);
      return '<tr>'
        + '<td data-label="Hall"><b>'+escapeHtml(h.hallName)+'</b></td>'
        + '<td data-label="Type">'+escapeHtml(h.hallType)+'</td>'
        + '<td data-label="Capacity">'+(h.capacity ? h.capacity+' guests' : '—')+'</td>'
        + '<td data-label="Price" class="amt">'+money(h.price)+'/day</td>'
        + '<td data-label="Status"><span class="room-status-badge '+hallTodayInfoVal.cls+'">'+escapeHtml(hallTodayInfoVal.label)+'</span>'
          + (h.status !== 'available' ? '' : '<br><span style="color:var(--ink-faint);font-size:11px;">Setup: Available</span>')
          + '</td>'
        + '<td data-label="" class="row-actions-cell">'
          + '<button class="icon-btn" data-edit-hall="'+h.id+'" title="Edit">✎</button> '
          + '<button class="icon-btn" data-del-hall="'+h.id+'" title="Remove" style="color:var(--danger);">✕</button>'
          + '</td></tr>';
    }).join('');
    wrap.innerHTML = '<table class="rooms-admin"><thead><tr><th>Hall</th><th>Type</th><th>Capacity</th><th>Price</th><th>Status</th><th></th></tr></thead><tbody>'+rows+'</tbody></table>';

    wrap.querySelectorAll('[data-edit-hall]').forEach(function(btn){
      btn.addEventListener('click', function(){ hallEditingId = btn.dataset.editHall; renderHallsAdmin(); });
    });
    wrap.querySelectorAll('[data-cancel-hall-edit]').forEach(function(btn){
      btn.addEventListener('click', function(){ hallEditingId = null; renderHallsAdmin(); });
    });
    wrap.querySelectorAll('[data-save-hall]').forEach(function(btn){
      btn.addEventListener('click', function(){
        var id = btn.dataset.saveHall;
        var hall = state.banquetHalls.find(function(h){ return h.id === id; });
        if(!hall) return;
        var name = wrap.querySelector('[data-edit-hallname="'+id+'"]').value.trim();
        var type = wrap.querySelector('[data-edit-halltype="'+id+'"]').value;
        var capacity = parseInt(wrap.querySelector('[data-edit-capacity="'+id+'"]').value, 10);
        var price = parseFloat(wrap.querySelector('[data-edit-hallprice="'+id+'"]').value);
        var status = wrap.querySelector('[data-edit-hallstatus="'+id+'"]').value;
        if(!name || isNaN(price) || price < 0){ showToast('Enter a valid hall name and price.'); return; }
        var dupe = state.banquetHalls.some(function(h){ return h.id !== id && h.hallName.toLowerCase() === name.toLowerCase(); });
        if(dupe){ showToast('Another hall already uses that name.'); return; }
        hall.hallName = name; hall.hallType = type; hall.capacity = isNaN(capacity) ? 0 : capacity; hall.price = price; hall.status = status;
        hallEditingId = null;
        persistBanquetHalls().then(function(){
          showToast('Hall updated');
          renderHallsAdmin();
          renderHallDashboard();
        });
      });
    });
    wrap.querySelectorAll('[data-del-hall]').forEach(function(btn){
      btn.addEventListener('click', function(){
        var hall = state.banquetHalls.find(function(h){ return h.id === btn.dataset.delHall; });
        if(!hall) return;
        var hasActiveBooking = state.banquetBookings.some(function(b){
          return b.hallId === hall.id && (b.bookingStatus === 'Confirmed' || b.bookingStatus === 'Event Started');
        });
        if(hasActiveBooking){ showToast('Can\'t remove '+hall.hallName+' — it has an active booking.'); return; }
        if(!window.confirm('Remove '+hall.hallName+'? This cannot be undone.')) return;
        state.banquetHalls = state.banquetHalls.filter(function(h){ return h.id !== hall.id; });
        persistBanquetHalls().then(function(){
          showToast('Hall removed');
          renderHallsAdmin();
          renderHallDashboard();
        });
      });
    });
  }
  document.getElementById('addHallBtn').addEventListener('click', function(){
    var name = document.getElementById('hallNameInput').value.trim();
    var type = document.getElementById('hallTypeSelect').value;
    var capacity = parseInt(document.getElementById('hallCapacityInput').value, 10);
    var price = parseFloat(document.getElementById('hallPriceInput').value);
    var status = document.getElementById('hallStatusSelect').value;
    var err = document.getElementById('hallAddError');
    if(!name || !type || isNaN(price) || price < 0){
      err.textContent = 'Enter a hall name, type, and a valid price.';
      err.classList.add('show');
      return;
    }
    var dupe = state.banquetHalls.some(function(h){ return h.hallName.toLowerCase() === name.toLowerCase(); });
    if(dupe){
      err.textContent = 'A hall with that name already exists.';
      err.classList.add('show');
      return;
    }
    err.classList.remove('show');
    state.banquetHalls.push({ id: uid(), hallName: name, hallType: type, capacity: isNaN(capacity) ? 0 : capacity, price: price, status: status, createdAt: new Date().toISOString() });
    persistBanquetHalls().then(function(){
      showToast('Hall added');
      document.getElementById('hallNameInput').value = '';
      document.getElementById('hallCapacityInput').value = '';
      document.getElementById('hallPriceInput').value = '';
      renderHallsAdmin();
      renderHallDashboard();
    });
  });

  // ---------- date-aware availability (reuses bookingOverlaps from Room module) ----------
  function hallBookingsForHall(hallId){
    // Cancelled and Event Completed bookings no longer occupy the hall, so
    // they shouldn't count as conflicts when computing availability.
    return state.banquetBookings.filter(function(b){ return b.hallId === hallId && b.bookingStatus !== 'Cancelled' && b.bookingStatus !== 'Event Completed'; });
  }
  function isHallFreeForRange(hall, checkIn, checkOut, excludeBookingId){
    if(!hall || hall.status !== 'available') return false; // manual operational block
    var conflicts = hallBookingsForHall(hall.id).filter(function(b){
      if(excludeBookingId && b.id === excludeBookingId) return false;
      return bookingOverlaps(b, checkIn, checkOut);
    });
    return conflicts.length === 0;
  }
  function hallTodayInfo(hall){
    var today = localDateStr(new Date());
    if(hall.status !== 'available'){
      return { label: roomStatusLabel(hall.status), cls: 'rs-blocked', bookable:false };
    }
    var active = hallBookingsForHall(hall.id).find(function(b){ return b.checkIn <= today && today < b.checkOut; });
    if(!active){ return { label:'Available', cls:'rs-available', bookable:true }; }
    if(active.bookingStatus === 'Event Started'){ return { label:'Ongoing', cls:'rs-checked-in', bookable:false, booking:active }; }
    if(active.checkIn === today){ return { label:'Event today', cls:'rs-checkin-today', bookable:false, booking:active }; }
    return { label:'Booked', cls:'rs-booked', bookable:false, booking:active };
  }

  // ---------- hall availability dashboard (staff) ----------
  function renderHallQuickStats(){
    var wrap = document.getElementById('hallQuickStats');
    if(!wrap) return;
    var total = state.banquetHalls.length;
    var counts = { available:0, booked:0, eventToday:0, ongoing:0 };
    state.banquetHalls.forEach(function(h){
      var info = hallTodayInfo(h);
      if(info.cls === 'rs-available') counts.available++;
      else if(info.cls === 'rs-booked') counts.booked++;
      else if(info.cls === 'rs-checkin-today') counts.eventToday++;
      else if(info.cls === 'rs-checked-in') counts.ongoing++;
    });
    wrap.innerHTML =
      statCardHtml('Available today', String(counts.available), total+' hall'+(total===1?'':'s')+' total', DASH_ICONS.sun, 'olive')
      + statCardHtml('Ongoing events', String(counts.ongoing), null, DASH_ICONS.receipt, 'brick')
      + statCardHtml('Event today', String(counts.eventToday), null, DASH_ICONS.calendar, 'gold')
      + statCardHtml('Booked (other dates)', String(counts.booked), null, DASH_ICONS.trend, 'olive');
  }
  function setDefaultHallFilterDates(){
    var sEl = document.getElementById('hallFilterStart');
    var eEl = document.getElementById('hallFilterEnd');
    if(!sEl || !eEl) return;
    if(!sEl.value) sEl.value = localDateStr(new Date());
    if(!eEl.value) eEl.value = localDateStr(new Date(Date.now() + 86400000));
  }
  function renderHallGrid(){
    var wrap = document.getElementById('hallGridWrap');
    if(!wrap) return;
    if(state.banquetHalls.length === 0){
      wrap.innerHTML = '<div class="empty-state"><p class="big">No halls configured</p><p>Ask Admin to add halls from Banquet Setup.</p></div>';
      return;
    }
    var nameFilter = (document.getElementById('hallFilterName').value || '').trim().toLowerCase();
    var typeFilter = document.getElementById('hallFilterType').value;
    var availFilter = document.getElementById('hallFilterStatus').value;
    var checkIn = document.getElementById('hallFilterStart').value;
    var checkOut = document.getElementById('hallFilterEnd').value;
    var validRange = !!(checkIn && checkOut && checkOut > checkIn);

    var list = state.banquetHalls.slice().sort(function(a,b){
      return String(a.hallName).localeCompare(String(b.hallName), undefined, { numeric:true });
    });
    if(nameFilter) list = list.filter(function(h){ return h.hallName.toLowerCase().indexOf(nameFilter) !== -1; });
    if(typeFilter) list = list.filter(function(h){ return h.hallType === typeFilter; });

    var enriched = list.map(function(h){
      var freeForRange = validRange ? isHallFreeForRange(h, checkIn, checkOut) : (h.status === 'available');
      return { hall:h, freeForRange: freeForRange, todayInfo: hallTodayInfo(h) };
    });
    if(availFilter === 'available') enriched = enriched.filter(function(x){ return x.freeForRange; });
    if(availFilter === 'unavailable') enriched = enriched.filter(function(x){ return !x.freeForRange; });

    if(enriched.length === 0){
      wrap.innerHTML = '<div class="empty-state"><p class="big">No halls match</p><p>Try a different search, type, or date range.</p></div>';
      return;
    }

    wrap.innerHTML = '<div class="room-grid">' + enriched.map(function(x){
      var h = x.hall;
      var badgeCls, badgeLabel;
      if(h.status !== 'available'){
        badgeCls = 'rs-blocked'; badgeLabel = roomStatusLabel(h.status);
      } else if(validRange){
        badgeCls = x.freeForRange ? 'rs-available' : 'rs-booked';
        badgeLabel = x.freeForRange ? 'Available' : 'Not available';
      } else {
        badgeCls = x.todayInfo.cls; badgeLabel = x.todayInfo.label;
      }
      var canBook = validRange && x.freeForRange;
      var actionsHtml = '';
      if(canBook){
        actionsHtml = '<button class="btn brick" data-book-hall="'+h.id+'">Book hall</button>';
      } else if(x.todayInfo.booking){
        actionsHtml = '<button class="btn ghost" data-view-hall-booking="'+x.todayInfo.booking.id+'">View booking</button>';
      }
      return '<div class="room-card">'
        + '<div class="room-card-top"><div><div class="room-num">'+escapeHtml(h.hallName)+'</div><div class="room-type">'+escapeHtml(h.hallType)+(h.capacity ? ' · '+h.capacity+' guests' : '')+'</div></div>'
        + '<span class="room-status-badge '+badgeCls+'">'+escapeHtml(badgeLabel)+'</span></div>'
        + '<div class="room-price">'+money(h.price)+'/day</div>'
        + (actionsHtml ? '<div class="room-card-foot">'+actionsHtml+'</div>' : '')
        + '</div>';
    }).join('') + '</div>';

    wrap.querySelectorAll('[data-book-hall]').forEach(function(btn){
      btn.addEventListener('click', function(){
        var hall = state.banquetHalls.find(function(h){ return h.id === btn.dataset.bookHall; });
        if(hall) openHallBookingForm(hall, checkIn, checkOut);
      });
    });
    wrap.querySelectorAll('[data-view-hall-booking]').forEach(function(btn){
      btn.addEventListener('click', function(){
        var b = state.banquetBookings.find(function(x){ return x.id === btn.dataset.viewHallBooking; });
        if(b) openBanquetInvoiceOverlay(b);
      });
    });
  }
  function renderHallDashboard(){
    renderHallQuickStats();
    renderHallGrid();
  }
  document.getElementById('hallFilterName').addEventListener('input', renderHallGrid);
  ['hallFilterType','hallFilterStatus','hallFilterStart','hallFilterEnd'].forEach(function(id){
    document.getElementById(id).addEventListener('change', renderHallGrid);
  });
  document.getElementById('hallFilterResetBtn').addEventListener('click', function(){
    document.getElementById('hallFilterName').value = '';
    document.getElementById('hallFilterType').value = '';
    document.getElementById('hallFilterStatus').value = '';
    document.getElementById('hallFilterStart').value = '';
    document.getElementById('hallFilterEnd').value = '';
    setDefaultHallFilterDates();
    renderHallGrid();
  });

  // ---------- booking form (staff) ----------
  function hallDays(checkIn, checkOut){ return roomNights(checkIn, checkOut); } // identical day-count math
  function openHallBookingForm(hall, checkIn, checkOut){
    state.hallSelectedForBooking = hall;
    document.getElementById('hallBookingFormTitle').textContent = hall.hallName + ' — ' + hall.hallType + ' (' + money(hall.price) + '/day)';
    document.getElementById('hbCustName').value = '';
    document.getElementById('hbCustPhone').value = '';
    document.getElementById('hbCustEmail').value = '';
    document.getElementById('hbGuestCount').value = '';
    document.getElementById('hbCustAddress').value = '';
    document.getElementById('hbCustId').value = '';
    fillEventTypeSelect();
    document.getElementById('hbEventStart').value = checkIn || localDateStr(new Date());
    document.getElementById('hbEventEnd').value = checkOut || localDateStr(new Date(Date.now() + 86400000));
    document.getElementById('hbPromoCode').value = '';
    document.getElementById('hbPaymentStatus').value = 'Pending';
    document.getElementById('hbAmountPaid').value = '';
    document.getElementById('hbPaymentMethod').value = 'Cash';
    document.getElementById('hbDateError').classList.remove('show');
    document.getElementById('hbFormError').classList.remove('show');
    document.getElementById('hallBookingFormCard').style.display = '';
    renderHallChargePreview();
    document.getElementById('hallBookingFormCard').scrollIntoView({ behavior:'smooth', block:'start' });
  }
  document.getElementById('hbCancelFormBtn').addEventListener('click', function(){
    state.hallSelectedForBooking = null;
    document.getElementById('hallBookingFormCard').style.display = 'none';
  });
  ['hbEventStart','hbEventEnd','hbPromoCode'].forEach(function(id){
    var el = document.getElementById(id);
    el.addEventListener('input', renderHallChargePreview);
    el.addEventListener('change', renderHallChargePreview);
  });
  function renderHallChargePreview(){
    var hall = state.hallSelectedForBooking;
    var wrap = document.getElementById('hbChargePreview');
    if(!hall || !wrap) return;
    var checkIn = document.getElementById('hbEventStart').value;
    var checkOut = document.getElementById('hbEventEnd').value;
    var days = hallDays(checkIn, checkOut);
    var dateErr = document.getElementById('hbDateError');
    if(days <= 0){
      wrap.innerHTML = '<div class="row"><span>Days</span><span>—</span></div>';
      if(checkIn && checkOut){ dateErr.textContent = 'Event end must be after event start.'; dateErr.classList.add('show'); }
      return;
    }
    var freeOk = isHallFreeForRange(hall, checkIn, checkOut);
    if(!freeOk){
      dateErr.textContent = hall.hallName + ' is not available for these dates.';
      dateErr.classList.add('show');
    } else {
      dateErr.classList.remove('show');
    }
    var subtotal = days * hall.price;
    var taxRate = state.restaurant.taxRate || 0;
    var tax = subtotal * (taxRate / 100);
    var cgst = tax / 2, sgst = tax / 2;
    var totalBeforeDiscount = subtotal + tax;
    var promoInput = document.getElementById('hbPromoCode').value;
    var promo = findPromoByCode(promoInput);
    var promoUsable = promo && isPromoUsable(promo);
    var discount = promoUsable ? calcDiscount(totalBeforeDiscount, promo) : 0;
    var total = totalBeforeDiscount - discount;
    var html = '<div class="row"><span>'+days+' day'+(days===1?'':'s')+' × '+money(hall.price)+'</span><span>'+money(subtotal)+'</span></div>';
    if(taxRate > 0){
      html += '<div class="row"><span>CGST '+(taxRate/2).toFixed(1)+'%</span><span>'+money(cgst)+'</span></div>';
      html += '<div class="row"><span>SGST '+(taxRate/2).toFixed(1)+'%</span><span>'+money(sgst)+'</span></div>';
    }
    if(promoInput.trim()){
      if(promoUsable){
        html += '<div class="row" style="color:var(--success);"><span>Discount ('+escapeHtml(promo.code)+')</span><span>−'+money(discount)+'</span></div>';
      } else {
        html += '<div class="row" style="color:var(--danger);"><span>Promo code</span><span>Invalid / expired</span></div>';
      }
    }
    html += '<div class="row total"><span>Total</span><span>'+money(total)+'</span></div>';
    wrap.innerHTML = html;
  }

  document.getElementById('hbConfirmBookingBtn').addEventListener('click', function(){
    var hall = state.hallSelectedForBooking;
    var err = document.getElementById('hbFormError');
    if(!hall) return;
    var name = document.getElementById('hbCustName').value.trim();
    var phone = document.getElementById('hbCustPhone').value.trim();
    var email = document.getElementById('hbCustEmail').value.trim();
    var guestsRaw = parseInt(document.getElementById('hbGuestCount').value, 10);
    var address = document.getElementById('hbCustAddress').value.trim();
    var idDetails = document.getElementById('hbCustId').value.trim();
    var eventType = document.getElementById('hbEventType').value;
    var checkIn = document.getElementById('hbEventStart').value;
    var checkOut = document.getElementById('hbEventEnd').value;
    var days = hallDays(checkIn, checkOut);

    if(!name || !phone || days <= 0){
      err.textContent = 'Please fill in customer name, phone, and valid dates.';
      err.classList.add('show');
      return;
    }
    // Re-check availability right before committing — the hall may have been
    // booked by someone else since this form was opened.
    var freshHall = state.banquetHalls.find(function(h){ return h.id === hall.id; });
    if(!freshHall || !isHallFreeForRange(freshHall, checkIn, checkOut)){
      err.textContent = 'Sorry — ' + hall.hallName + ' is no longer available for these dates.';
      err.classList.add('show');
      renderHallChargePreview();
      return;
    }
    err.classList.remove('show');

    var taxRate = state.restaurant.taxRate || 0;
    var subtotal = days * freshHall.price;
    var tax = subtotal * (taxRate / 100);
    var cgst = tax / 2, sgst = tax / 2;
    var totalBeforeDiscount = subtotal + tax;
    var promo = findPromoByCode(document.getElementById('hbPromoCode').value);
    var promoUsable = promo && isPromoUsable(promo);
    var discount = promoUsable ? calcDiscount(totalBeforeDiscount, promo) : 0;
    var total = totalBeforeDiscount - discount;

    var paymentStatus = document.getElementById('hbPaymentStatus').value;
    var amountPaidRaw = parseFloat(document.getElementById('hbAmountPaid').value);
    var amountPaid = isNaN(amountPaidRaw) ? 0 : Math.max(0, amountPaidRaw);
    if(paymentStatus === 'Paid') amountPaid = total;
    if(paymentStatus === 'Pending') amountPaid = 0;
    amountPaid = Math.min(amountPaid, total);
    var balanceDue = Math.max(0, total - amountPaid);

    state.banquetBookingSeq += 1;
    var bookingNo = 'BH-' + String(state.banquetBookingSeq).padStart(4, '0');

    var booking = {
      id: uid(), bookingNo: bookingNo, createdAt: new Date().toISOString(),
      custName: name, custPhone: phone, custEmail: email, custAddress: address,
      guests: isNaN(guestsRaw) ? null : guestsRaw, idDetails: idDetails, eventType: eventType,
      hallId: freshHall.id, hallName: freshHall.hallName, hallType: freshHall.hallType, price: freshHall.price,
      checkIn: checkIn, checkOut: checkOut, days: days,
      subtotal: subtotal, cgst: cgst, sgst: sgst, tax: tax,
      discountAmount: discount, promoCode: promoUsable ? promo.code : null,
      total: total, paymentStatus: paymentStatus, paymentMethod: document.getElementById('hbPaymentMethod').value,
      amountPaid: amountPaid, balanceDue: balanceDue,
      bookingStatus: 'Confirmed',
      createdByStaffId: state.session.staffId || '', createdByName: state.session.name || state.session.staffId || 'Staff',
      restaurant: Object.assign({}, state.restaurant)
    };
    state.banquetBookings.unshift(booking);

    var tasks = [persistBanquetBookings(), persistBanquetBookingSeq()];
    if(promoUsable){
      promo.usedCount = (promo.usedCount || 0) + 1;
      tasks.push(persistPromoCodes());
    }
    Promise.all(tasks).then(function(){
      showToast('Booking confirmed for ' + freshHall.hallName);
      state.hallSelectedForBooking = null;
      document.getElementById('hallBookingFormCard').style.display = 'none';
      renderHallDashboard();
      renderHallBookingsList();
      if(promoUsable) renderPromoList();
      openBanquetInvoiceOverlay(booking);
    });
  });

  // ---------- banquet invoice (receipt / PDF / WhatsApp) ----------
  // A formal hotel/banquet booking invoice layout (letterhead, bill-to /
  // booking-details block, itemized table, totals) — distinct from the
  // restaurant order slip.
  function renderBanquetReceiptHtml(b){
    var r = state.restaurant; // always use current hotel settings, not a stale per-booking snapshot
    var dateStr = new Date(b.createdAt).toLocaleString('en-IN', { dateStyle:'medium', timeStyle:'short' });
    var startLabel = new Date(b.checkIn + 'T00:00:00').toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'numeric' });
    var endLabel = new Date(b.checkOut + 'T00:00:00').toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'numeric' });
    var totalsHtml = '<div class="row"><span>Subtotal</span><span>'+money(b.subtotal)+'</span></div>';
    if(r.taxRate > 0){
      totalsHtml += '<div class="row"><span>CGST '+(r.taxRate/2).toFixed(1)+'%</span><span>'+money(b.cgst)+'</span></div>';
      totalsHtml += '<div class="row"><span>SGST '+(r.taxRate/2).toFixed(1)+'%</span><span>'+money(b.sgst)+'</span></div>';
    }
    if(b.discountAmount > 0){
      totalsHtml += '<div class="row discount"><span>Discount ('+escapeHtml(b.promoCode)+')</span><span>−'+money(b.discountAmount)+'</span></div>';
    }
    totalsHtml += '<div class="row grand"><span>Total</span><span>'+money(b.total)+'</span></div>';
    var psClass = b.paymentStatus === 'Paid' ? 'ps-paid' : (b.paymentStatus === 'Partially Paid' ? 'ps-partial' : 'ps-pending');
    var contactLine = [r.phone ? 'Ph: '+escapeHtml(r.phone) : '', r.email ? escapeHtml(r.email) : ''].filter(Boolean).join(' &nbsp;|&nbsp; ');

    return ''
      + '<div class="pinv">'
      + '<div class="pinv-head">'
        + '<div class="pinv-head-left"><h2>'+escapeHtml(r.name || 'Banquet Hall')+'</h2>'
          + (r.address ? '<p>'+escapeHtml(r.address)+'</p>' : '')
          + (contactLine ? '<p>'+contactLine+'</p>' : '')
          + (r.gstin ? '<p>GSTIN: '+escapeHtml(r.gstin)+'</p>' : '')
        + '</div>'
        + '<div class="pinv-head-right">'
          + '<div class="pinv-doc-title">Banquet Invoice</div>'
          + '<div class="pinv-doc-no">'+escapeHtml(b.bookingNo)+'</div>'
          + '<div style="margin-top:9px;"><span class="payment-status-badge '+psClass+'">'+escapeHtml(b.paymentStatus)+'</span></div>'
        + '</div>'
      + '</div>'
      + '<div class="pinv-accent-bar"></div>'
      + '<div class="pinv-meta-grid">'
        + '<div class="pinv-meta-col"><div class="pinv-meta-label">Billed To</div>'
          + '<div class="pinv-meta-strong">'+escapeHtml(b.custName)+'</div>'
          + '<div class="pinv-line">'+escapeHtml(b.custPhone)+'</div>'
          + (b.custEmail ? '<div class="pinv-line">'+escapeHtml(b.custEmail)+'</div>' : '')
        + '</div>'
        + '<div class="pinv-meta-col"><div class="pinv-meta-label">Booking Details</div>'
          + '<div class="pinv-meta-row"><span>Booked on</span><span>'+dateStr+'</span></div>'
          + '<div class="pinv-meta-row"><span>Event type</span><span>'+escapeHtml(b.eventType||'—')+'</span></div>'
          + '<div class="pinv-meta-row"><span>Event start</span><span>'+startLabel+'</span></div>'
          + '<div class="pinv-meta-row"><span>Event end</span><span>'+endLabel+'</span></div>'
        + '</div>'
      + '</div>'
      + '<table class="pinv-table"><thead><tr><th>Description</th><th class="num">Rate</th><th class="num">Days</th><th class="num">Amount</th></tr></thead>'
      + '<tbody><tr>'
        + '<td><span class="pinv-item-name">'+escapeHtml(b.hallName)+'</span><span class="pinv-item-sub">'+escapeHtml(b.hallType)+' hall'+(b.eventType ? ' — '+escapeHtml(b.eventType) : '')+'</span></td>'
        + '<td class="num">'+money(b.price)+'</td>'
        + '<td class="num">'+b.days+'</td>'
        + '<td class="num">'+money(b.subtotal)+'</td>'
      + '</tr></tbody></table>'
      + '<div class="pinv-summary-wrap">'
        + '<div class="pinv-notes">'+(r.footer ? escapeHtml(r.footer) : '')+'</div>'
        + '<div class="pinv-totals">'+totalsHtml+'</div>'
      + '</div>'
      + '<div class="pinv-payment-block">'
        + '<div class="p-line">Amount paid ('+escapeHtml(b.paymentMethod||'Cash')+'): <b>'+money(b.amountPaid)+'</b></div>'
        + '<div class="p-line">Balance due: <b>'+money(b.balanceDue)+'</b></div>'
      + '</div>'
      + '<div class="pinv-signoff">'
        + '<div class="pinv-thanks">Thank you for choosing '+escapeHtml(r.name || 'us')+'. We look forward to hosting your event.</div>'
        + '<div class="pinv-sign">'+(r.signature ? '<img class="pinv-sign-img" src="'+r.signature+'" alt="Signature">' : '')+'<div class="line"></div>Authorized signatory</div>'
      + '</div>'
      + '</div>';
  }
  function openBanquetInvoiceOverlay(b){
    state.activeInvoiceKind = 'banquet';
    state.activeBanquetBooking = b;
    state.activeRoomBooking = null;
    state.activeInvoice = null;
    var card = document.getElementById('receiptCard');
    card.className = 'receipt pro-invoice';
    card.innerHTML = renderBanquetReceiptHtml(b);
    document.getElementById('invoiceOverlay').classList.add('show');
  }
  // Draws a formal, letterhead-style A4 banquet invoice — same layout
  // language as buildRoomInvoicePdfDoc, adapted for event/hall fields.
  function buildBanquetInvoicePdfDoc(b){
    var jsPDFCtor = (window.jspdf && window.jspdf.jsPDF) ? window.jspdf.jsPDF : null;
    if(!jsPDFCtor){ throw new Error('jsPDF not loaded'); }
    var r = state.restaurant; // always use current hotel settings, not a stale per-booking snapshot
    var doc = new jsPDFCtor({ unit: 'mm', format: 'a4' });
    var pageWidth = 210, margin = 18;
    var contentWidth = pageWidth - margin * 2;
    var ink = [42, 36, 32], soft = [107, 98, 89], brick = [156, 59, 46],
        panel = [243, 231, 206], faint = [214, 196, 163], success = [63, 107, 74];
    var psColor = b.paymentStatus === 'Paid' ? success : (b.paymentStatus === 'Partially Paid' ? [163, 122, 25] : [161, 51, 42]);

    doc.setFont('helvetica', 'normal'); doc.setFontSize(9);
    var addressLines = r.address ? doc.splitTextToSize(r.address, 96) : [];
    var footerLines = r.footer ? doc.splitTextToSize(r.footer, 100) : [];
    var startLabel = new Date(b.checkIn + 'T00:00:00').toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'numeric' });
    var endLabel = new Date(b.checkOut + 'T00:00:00').toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'numeric' });
    var dateStr = new Date(b.createdAt).toLocaleString('en-IN', { dateStyle:'medium', timeStyle:'short' });

    var cy = margin;

    doc.setFont('helvetica', 'bold'); doc.setFontSize(17); doc.setTextColor(brick[0], brick[1], brick[2]);
    doc.text(r.name || 'Banquet Hall', margin, cy + 4);
    doc.setFont('helvetica', 'bold'); doc.setFontSize(15); doc.setTextColor(ink[0], ink[1], ink[2]);
    doc.text('BANQUET INVOICE', pageWidth - margin, cy + 4, { align: 'right' });
    cy += 10;

    var leftY = cy, rightY = cy;
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(soft[0], soft[1], soft[2]);
    addressLines.forEach(function(line){ doc.text(line, margin, leftY); leftY += 4.4; });
    var contactBits = [];
    if(r.phone) contactBits.push('Ph: ' + r.phone);
    if(r.email) contactBits.push(r.email);
    if(contactBits.length){ doc.text(contactBits.join('   |   '), margin, leftY); leftY += 4.4; }
    if(r.gstin){ doc.text('GSTIN: ' + r.gstin, margin, leftY); leftY += 4.4; }

    doc.setFont('helvetica', 'bold'); doc.setFontSize(10.5); doc.setTextColor(brick[0], brick[1], brick[2]);
    doc.text(b.bookingNo, pageWidth - margin, rightY, { align: 'right' }); rightY += 5.2;
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(soft[0], soft[1], soft[2]);
    doc.text(dateStr, pageWidth - margin, rightY, { align: 'right' }); rightY += 5.2;
    doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.setTextColor(psColor[0], psColor[1], psColor[2]);
    doc.text(b.paymentStatus.toUpperCase(), pageWidth - margin, rightY, { align: 'right' }); rightY += 5.2;

    cy = Math.max(leftY, rightY) + 5;

    doc.setFillColor(brick[0], brick[1], brick[2]);
    doc.rect(margin, cy, contentWidth, 1.2, 'F');
    cy += 11;

    var rightColX = margin + contentWidth / 2 + 4;
    doc.setFont('helvetica', 'bold'); doc.setFontSize(8.5); doc.setTextColor(soft[0], soft[1], soft[2]);
    doc.text('BILLED TO', margin, cy);
    doc.text('BOOKING DETAILS', rightColX, cy);
    cy += 6;

    var metaLeftY = cy, metaRightY = cy;
    doc.setFont('helvetica', 'bold'); doc.setFontSize(11); doc.setTextColor(ink[0], ink[1], ink[2]);
    doc.text(b.custName, margin, metaLeftY); metaLeftY += 5.2;
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(soft[0], soft[1], soft[2]);
    doc.text(b.custPhone, margin, metaLeftY); metaLeftY += 4.4;
    if(b.custEmail){ doc.text(b.custEmail, margin, metaLeftY); metaLeftY += 4.4; }

    function metaRow(label, value){
      doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(soft[0], soft[1], soft[2]);
      doc.text(label, rightColX, metaRightY);
      doc.setFont('helvetica', 'bold'); doc.setTextColor(ink[0], ink[1], ink[2]);
      doc.text(value, pageWidth - margin, metaRightY, { align: 'right' });
      metaRightY += 5.4;
    }
    metaRow('Event type', b.eventType || '—');
    metaRow('Event start', startLabel);
    metaRow('Event end', endLabel);

    cy = Math.max(metaLeftY, metaRightY) + 9;

    var col2 = margin + contentWidth * 0.52, col3 = margin + contentWidth * 0.70;
    doc.setFillColor(panel[0], panel[1], panel[2]);
    doc.rect(margin, cy, contentWidth, 8.5, 'F');
    doc.setFont('helvetica', 'bold'); doc.setFontSize(8.5); doc.setTextColor(soft[0], soft[1], soft[2]);
    doc.text('DESCRIPTION', margin + 3, cy + 5.6);
    doc.text('RATE', col2, cy + 5.6);
    doc.text('DAYS', col3, cy + 5.6);
    doc.text('AMOUNT', pageWidth - margin - 3, cy + 5.6, { align: 'right' });
    cy += 8.5 + 8;

    doc.setFont('helvetica', 'bold'); doc.setFontSize(10.5); doc.setTextColor(ink[0], ink[1], ink[2]);
    doc.text(b.hallName, margin + 3, cy);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9.5);
    doc.text(pdfMoney(b.price), col2, cy);
    doc.text(String(b.days), col3, cy);
    doc.text(pdfMoney(b.subtotal), pageWidth - margin - 3, cy, { align: 'right' });
    cy += 4.6;
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); doc.setTextColor(soft[0], soft[1], soft[2]);
    doc.text(b.hallType + ' hall' + (b.eventType ? ' — ' + b.eventType : ''), margin + 3, cy);
    cy += 5.5;
    doc.setDrawColor(faint[0], faint[1], faint[2]);
    doc.line(margin, cy, pageWidth - margin, cy);
    cy += 11;

    var totalsX = pageWidth - margin - 78;
    function totalRow(label, value, opts){
      opts = opts || {};
      doc.setFont('helvetica', opts.bold ? 'bold' : 'normal');
      doc.setFontSize(opts.size || 9.5);
      var col = opts.color || ink;
      doc.setTextColor(col[0], col[1], col[2]);
      doc.text(label, totalsX, cy);
      doc.text(value, pageWidth - margin, cy, { align: 'right' });
      cy += opts.gap || 5.8;
    }
    totalRow('Subtotal', pdfMoney(b.subtotal));
    if(r.taxRate > 0){
      totalRow('CGST ' + (r.taxRate/2).toFixed(1) + '%', pdfMoney(b.cgst));
      totalRow('SGST ' + (r.taxRate/2).toFixed(1) + '%', pdfMoney(b.sgst));
    }
    if(b.discountAmount > 0){
      totalRow('Discount (' + b.promoCode + ')', '-' + pdfMoney(b.discountAmount), { color: success });
    }
    doc.setDrawColor(ink[0], ink[1], ink[2]);
    doc.line(totalsX, cy - 3, pageWidth - margin, cy - 3);
    cy += 2;
    totalRow('Total', pdfMoney(b.total), { bold: true, size: 13.5, color: brick, gap: 9 });

    cy += 3;
    doc.setFillColor(panel[0], panel[1], panel[2]);
    doc.roundedRect(margin, cy, contentWidth, 15, 1.5, 1.5, 'F');
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(soft[0], soft[1], soft[2]);
    doc.text('Amount paid (' + (b.paymentMethod || 'Cash') + ')', margin + 5, cy + 6.2);
    doc.text('Balance due', margin + 5, cy + 11.4);
    doc.setFont('helvetica', 'bold'); doc.setTextColor(ink[0], ink[1], ink[2]);
    doc.text(pdfMoney(b.amountPaid), margin + 75, cy + 6.2);
    doc.text(pdfMoney(b.balanceDue), margin + 75, cy + 11.4);
    cy += 15 + 10;

    if(footerLines.length){
      doc.setFont('helvetica', 'italic'); doc.setFontSize(8.5); doc.setTextColor(soft[0], soft[1], soft[2]);
      footerLines.forEach(function(line){ doc.text(line, margin, cy); cy += 4.4; });
      cy += 6;
    }

    cy += 12;
    drawPdfSignature(doc, r, pageWidth - margin, cy - 2, 50, 10);
    doc.setDrawColor(faint[0], faint[1], faint[2]);
    doc.line(pageWidth - margin - 55, cy, pageWidth - margin, cy);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); doc.setTextColor(soft[0], soft[1], soft[2]);
    doc.text('Authorized signatory', pageWidth - margin - 27.5, cy + 4.6, { align: 'center' });

    return doc;
  }
  function buildBanquetWhatsappMessage(b){
    var r = state.restaurant; // always use current hotel settings, not a stale per-booking snapshot
    var startLabel = new Date(b.checkIn + 'T00:00:00').toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'numeric' });
    var endLabel = new Date(b.checkOut + 'T00:00:00').toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'numeric' });
    var lines = [];
    lines.push('*' + (r.name || 'Banquet Hall') + '*');
    lines.push('Booking: ' + b.bookingNo);
    lines.push('');
    lines.push('Hi ' + b.custName + ', thanks for booking with us! Here are your details:');
    lines.push('');
    lines.push(b.hallName + ' (' + b.hallType + ')' + (b.eventType ? ' — ' + b.eventType : ''));
    lines.push('Event start: ' + startLabel);
    lines.push('Event end: ' + endLabel);
    lines.push(b.days + ' day' + (b.days===1?'':'s') + ' x ' + money(b.price) + ' = ' + money(b.subtotal));
    lines.push('');
    if(r.taxRate > 0){
      lines.push('CGST (' + (r.taxRate/2).toFixed(1) + '%): ' + money(b.cgst));
      lines.push('SGST (' + (r.taxRate/2).toFixed(1) + '%): ' + money(b.sgst));
    }
    if(b.discountAmount > 0){
      lines.push('Discount (' + b.promoCode + '): -' + money(b.discountAmount));
    }
    lines.push('*Total: ' + money(b.total) + '*');
    lines.push('Paid: ' + money(b.amountPaid) + '  |  Balance: ' + money(b.balanceDue));
    lines.push('Payment status: ' + b.paymentStatus);
    if(r.footer){ lines.push(''); lines.push(r.footer); }
    return lines.join('\n');
  }

  // ---------- booking management (staff) ----------
  function hallBookingStatusBadgeClass(status){
    if(status === 'Event Started') return 'rs-checked-in';
    if(status === 'Event Completed') return 'rs-blocked';
    if(status === 'Cancelled') return 'ps-pending';
    return 'rs-checkin-today'; // Confirmed
  }
  function renderHallBookingsList(){
    var wrap = document.getElementById('hallBookingsListWrap');
    if(!wrap) return;
    var q = (document.getElementById('hallBookingSearchInput').value || '').trim().toLowerCase();
    var statusFilter = document.getElementById('hallBookingSearchStatus').value;
    var list = state.banquetBookings;
    if(q){
      list = list.filter(function(b){
        return (b.bookingNo||'').toLowerCase().indexOf(q) !== -1
          || (b.custName||'').toLowerCase().indexOf(q) !== -1
          || (b.custPhone||'').toLowerCase().indexOf(q) !== -1
          || (b.hallName||'').toLowerCase().indexOf(q) !== -1;
      });
    }
    if(statusFilter){ list = list.filter(function(b){ return b.bookingStatus === statusFilter; }); }

    if(state.banquetBookings.length === 0){
      wrap.innerHTML = '<div class="empty-state"><p class="big">No bookings yet</p><p>Bookings you create will show up here.</p></div>';
      return;
    }
    if(list.length === 0){
      wrap.innerHTML = '<div class="empty-state"><p class="big">No bookings match</p><p>Try a different search or status.</p></div>';
      return;
    }

    var rows = list.map(function(b){
      var ci = new Date(b.checkIn + 'T00:00:00').toLocaleDateString('en-IN', { day:'2-digit', month:'short' });
      var co = new Date(b.checkOut + 'T00:00:00').toLocaleDateString('en-IN', { day:'2-digit', month:'short' });
      var actions = '<button class="btn ghost small" data-view-hall-invoice="'+b.id+'">Invoice</button> ';
      if(b.bookingStatus === 'Confirmed'){
        actions += '<button class="btn ghost small" data-hall-start="'+b.id+'">Start event</button> ';
        actions += '<button class="btn ghost small" data-hall-cancel="'+b.id+'" style="color:var(--danger);border-color:var(--danger);">Cancel</button>';
      } else if(b.bookingStatus === 'Event Started'){
        actions += '<button class="btn ghost small" data-hall-complete="'+b.id+'">Mark completed</button>';
      }
      return '<tr>'
        + '<td data-label="Booking">'+escapeHtml(b.bookingNo)+'</td>'
        + '<td data-label="Customer">'+escapeHtml(b.custName)+'<br><span style="color:var(--ink-faint);font-size:12px;">'+escapeHtml(b.custPhone)+'</span></td>'
        + '<td data-label="Hall">'+escapeHtml(b.hallName)+' <span style="color:var(--ink-faint);">('+escapeHtml(b.hallType)+')</span></td>'
        + '<td data-label="Event">'+ci+' → '+co+(b.eventType ? '<br><span style="color:var(--ink-faint);font-size:12px;">'+escapeHtml(b.eventType)+'</span>' : '')+'</td>'
        + '<td class="amt" data-label="Total">'+money(b.total)+'</td>'
        + '<td data-label="Payment"><span class="payment-status-badge '+paymentStatusBadgeClass(b.paymentStatus)+'">'+escapeHtml(b.paymentStatus)+'</span></td>'
        + '<td data-label="Status"><span class="room-status-badge '+hallBookingStatusBadgeClass(b.bookingStatus)+'">'+escapeHtml(b.bookingStatus)+'</span></td>'
        + '<td data-label="" class="row-actions-cell" style="white-space:nowrap;">'+actions+'</td>'
        + '</tr>';
    }).join('');
    wrap.innerHTML = '<table class="hist"><thead><tr><th>Booking</th><th>Customer</th><th>Hall</th><th>Event</th><th style="text-align:right;">Total</th><th>Payment</th><th>Status</th><th></th></tr></thead><tbody>'+rows+'</tbody></table>';

    wrap.querySelectorAll('[data-view-hall-invoice]').forEach(function(btn){
      btn.addEventListener('click', function(){
        var b = state.banquetBookings.find(function(x){ return x.id === btn.dataset.viewHallInvoice; });
        if(b) openBanquetInvoiceOverlay(b);
      });
    });
    wrap.querySelectorAll('[data-hall-start]').forEach(function(btn){
      btn.addEventListener('click', function(){
        var b = state.banquetBookings.find(function(x){ return x.id === btn.dataset.hallStart; });
        if(!b) return;
        b.bookingStatus = 'Event Started';
        persistBanquetBookings().then(function(){
          showToast(b.hallName + ' — event started');
          renderHallBookingsList();
          renderHallDashboard();
        });
      });
    });
    wrap.querySelectorAll('[data-hall-complete]').forEach(function(btn){
      btn.addEventListener('click', function(){
        var b = state.banquetBookings.find(function(x){ return x.id === btn.dataset.hallComplete; });
        if(!b) return;
        b.bookingStatus = 'Event Completed';
        b.paymentStatus = 'Paid';
        b.amountPaid = b.total;
        b.balanceDue = 0;
        persistBanquetBookings().then(function(){
          showToast(b.hallName + ' — event completed');
          renderHallBookingsList();
          renderHallDashboard();
        });
      });
    });
    wrap.querySelectorAll('[data-hall-cancel]').forEach(function(btn){
      btn.addEventListener('click', function(){
        var b = state.banquetBookings.find(function(x){ return x.id === btn.dataset.hallCancel; });
        if(!b) return;
        if(!window.confirm('Cancel booking ' + b.bookingNo + ' for ' + b.custName + '?')) return;
        b.bookingStatus = 'Cancelled';
        persistBanquetBookings().then(function(){
          showToast('Booking cancelled');
          renderHallBookingsList();
          renderHallDashboard();
        });
      });
    });
  }
  document.getElementById('hallBookingSearchInput').addEventListener('input', renderHallBookingsList);
  document.getElementById('hallBookingSearchStatus').addEventListener('change', renderHallBookingsList);
  document.getElementById('hallBookingSearchResetBtn').addEventListener('click', function(){
    document.getElementById('hallBookingSearchInput').value = '';
    document.getElementById('hallBookingSearchStatus').value = '';
    renderHallBookingsList();
  });

  // ---------- banquet module bootstrap (called once from enterApp) ----------
  function initBanquetModule(){
    fillAdminHallTypeSelect();
    fillStaffHallTypeFilter();
    fillEventTypeSelect();
    setDefaultHallFilterDates();
    renderHallTypesAdmin();
    renderEventTypesAdmin();
    renderHallsAdmin();
    renderHallDashboard();
    renderHallBookingsList();
  }

