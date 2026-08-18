"use strict";

  // =====================================================================
  // ROOM MANAGEMENT (Hotel) — Room Setup (admin) + Room Booking (staff)
  // Reuses the same restaurant/promo/GST config, storage layer, and
  // invoice look-and-feel as the restaurant module above.
  // =====================================================================

  function roomStatusLabel(s){
    return { available:'Available', cleaning:'Cleaning', maintenance:'Maintenance', 'out-of-service':'Out of Service' }[s] || s;
  }
  function roomStatusBadgeClass(s){ return s === 'available' ? 'rs-available' : 'rs-blocked'; }

  // ---------- room types (admin) ----------
  function renderRoomTypesAdmin(){
    var wrap = document.getElementById('roomTypesWrap');
    if(!wrap) return;
    if(state.roomTypes.length === 0){
      wrap.innerHTML = '<span style="color:var(--ink-faint);font-size:12.5px;">No room types yet — add one below.</span>';
      return;
    }
    wrap.innerHTML = state.roomTypes.map(function(t){
      return '<span class="room-type-chip">'+escapeHtml(t)+'<button type="button" data-del-type="'+escapeHtml(t)+'" title="Remove">✕</button></span>';
    }).join('');
    wrap.querySelectorAll('[data-del-type]').forEach(function(btn){
      btn.addEventListener('click', function(){
        var t = btn.dataset.delType;
        var inUse = state.rooms.some(function(r){ return r.roomType === t; });
        if(inUse){ showToast('Can\'t remove "'+t+'" — a room still uses it.'); return; }
        if(!window.confirm('Remove room type "'+t+'"?')) return;
        state.roomTypes = state.roomTypes.filter(function(x){ return x !== t; });
        persistRoomTypes().then(function(){
          renderRoomTypesAdmin();
          fillAdminRoomTypeSelect();
          fillStaffRoomTypeFilter();
          showToast('Room type removed');
        });
      });
    });
  }
  function fillAdminRoomTypeSelect(){
    var sel = document.getElementById('roomTypeSelect');
    if(!sel) return;
    var current = sel.value;
    sel.innerHTML = state.roomTypes.map(function(t){ return '<option value="'+escapeHtml(t)+'">'+escapeHtml(t)+'</option>'; }).join('');
    if(current && state.roomTypes.indexOf(current) !== -1) sel.value = current;
  }
  function fillStaffRoomTypeFilter(){
    var sel = document.getElementById('roomFilterType');
    if(!sel) return;
    var current = sel.value;
    sel.innerHTML = '<option value="">All types</option>' + state.roomTypes.map(function(t){ return '<option value="'+escapeHtml(t)+'">'+escapeHtml(t)+'</option>'; }).join('');
    sel.value = current;
  }
  document.getElementById('addRoomTypeBtn').addEventListener('click', function(){
    var input = document.getElementById('roomTypeNewInput');
    var val = input.value.trim();
    if(!val) return;
    if(state.roomTypes.some(function(t){ return t.toLowerCase() === val.toLowerCase(); })){
      showToast('That room type already exists.');
      return;
    }
    state.roomTypes.push(val);
    persistRoomTypes().then(function(){
      input.value = '';
      renderRoomTypesAdmin();
      fillAdminRoomTypeSelect();
      fillStaffRoomTypeFilter();
      showToast('Room type added');
    });
  });

  // ---------- rooms CRUD (admin) ----------
  var roomEditingId = null;
  function renderRoomsAdmin(){
    var wrap = document.getElementById('roomsAdminListWrap');
    if(!wrap) return;
    if(state.rooms.length === 0){
      wrap.innerHTML = '<div class="empty-state"><p class="big">No rooms yet</p><p>Add your first room above to get started.</p></div>';
      return;
    }
    var sorted = state.rooms.slice().sort(function(a,b){
      return String(a.roomNumber).localeCompare(String(b.roomNumber), undefined, { numeric:true });
    });
    var statusOptions = ['available','cleaning','maintenance','out-of-service'];
    var rows = sorted.map(function(r){
      if(roomEditingId === r.id){
        return '<tr>'
          + '<td data-label="Room"><input class="edit-field edit-name" data-edit-num="'+r.id+'" value="'+escapeHtml(r.roomNumber)+'" style="width:90px;"></td>'
          + '<td data-label="Type"><select class="edit-field" data-edit-type="'+r.id+'">'
            + state.roomTypes.map(function(t){ return '<option value="'+escapeHtml(t)+'"'+(t===r.roomType?' selected':'')+'>'+escapeHtml(t)+'</option>'; }).join('')
            + '</select></td>'
          + '<td data-label="Price"><input class="edit-field edit-price" type="number" min="0" step="1" data-edit-price="'+r.id+'" value="'+r.price+'" style="width:90px;"></td>'
          + '<td data-label="Status"><select class="edit-field" data-edit-status="'+r.id+'">'
            + statusOptions.map(function(s){ return '<option value="'+s+'"'+(s===r.status?' selected':'')+'>'+roomStatusLabel(s)+'</option>'; }).join('')
            + '</select></td>'
          + '<td data-label="" class="row-actions-cell">'
            + '<button class="icon-btn" data-save-room="'+r.id+'" title="Save" style="color:var(--success);border-color:var(--success);">✓</button> '
            + '<button class="icon-btn" data-cancel-room-edit="'+r.id+'" title="Cancel">✕</button>'
            + '</td></tr>';
      }
      var todayInfo = roomTodayInfo(r);
      return '<tr>'
        + '<td data-label="Room"><b>'+escapeHtml(r.roomNumber)+'</b></td>'
        + '<td data-label="Type">'+escapeHtml(r.roomType)+'</td>'
        + '<td data-label="Price" class="amt">'+money(r.price)+'/night</td>'
        + '<td data-label="Status"><span class="room-status-badge '+todayInfo.cls+'">'+escapeHtml(todayInfo.label)+'</span>'
          + (r.status !== 'available' ? '' : '<br><span style="color:var(--ink-faint);font-size:11px;">Setup: Available</span>')
          + '</td>'
        + '<td data-label="" class="row-actions-cell">'
          + '<button class="icon-btn" data-edit-room="'+r.id+'" title="Edit">✎</button> '
          + '<button class="icon-btn" data-del-room="'+r.id+'" title="Remove" style="color:var(--danger);">✕</button>'
          + '</td></tr>';
    }).join('');
    wrap.innerHTML = '<table class="rooms-admin"><thead><tr><th>Room</th><th>Type</th><th>Price</th><th>Status</th><th></th></tr></thead><tbody>'+rows+'</tbody></table>';

    wrap.querySelectorAll('[data-edit-room]').forEach(function(btn){
      btn.addEventListener('click', function(){ roomEditingId = btn.dataset.editRoom; renderRoomsAdmin(); });
    });
    wrap.querySelectorAll('[data-cancel-room-edit]').forEach(function(btn){
      btn.addEventListener('click', function(){ roomEditingId = null; renderRoomsAdmin(); });
    });
    wrap.querySelectorAll('[data-save-room]').forEach(function(btn){
      btn.addEventListener('click', function(){
        var id = btn.dataset.saveRoom;
        var room = state.rooms.find(function(r){ return r.id === id; });
        if(!room) return;
        var num = wrap.querySelector('[data-edit-num="'+id+'"]').value.trim();
        var type = wrap.querySelector('[data-edit-type="'+id+'"]').value;
        var price = parseFloat(wrap.querySelector('[data-edit-price="'+id+'"]').value);
        var status = wrap.querySelector('[data-edit-status="'+id+'"]').value;
        if(!num || isNaN(price) || price < 0){ showToast('Enter a valid room number and price.'); return; }
        var dupe = state.rooms.some(function(r){ return r.id !== id && String(r.roomNumber).toLowerCase() === num.toLowerCase(); });
        if(dupe){ showToast('Another room already uses that room number.'); return; }
        room.roomNumber = num; room.roomType = type; room.price = price; room.status = status;
        roomEditingId = null;
        persistRooms().then(function(){
          showToast('Room updated');
          renderRoomsAdmin();
          renderRoomDashboard();
        });
      });
    });
    wrap.querySelectorAll('[data-del-room]').forEach(function(btn){
      btn.addEventListener('click', function(){
        var room = state.rooms.find(function(r){ return r.id === btn.dataset.delRoom; });
        if(!room) return;
        var hasActiveBooking = state.roomBookings.some(function(b){
          return b.roomId === room.id && (b.bookingStatus === 'Confirmed' || b.bookingStatus === 'Checked In');
        });
        if(hasActiveBooking){ showToast('Can\'t remove Room '+room.roomNumber+' — it has an active booking.'); return; }
        if(!window.confirm('Remove Room '+room.roomNumber+'? This cannot be undone.')) return;
        state.rooms = state.rooms.filter(function(r){ return r.id !== room.id; });
        persistRooms().then(function(){
          showToast('Room removed');
          renderRoomsAdmin();
          renderRoomDashboard();
        });
      });
    });
  }
  document.getElementById('addRoomBtn').addEventListener('click', function(){
    var num = document.getElementById('roomNumberInput').value.trim();
    var type = document.getElementById('roomTypeSelect').value;
    var price = parseFloat(document.getElementById('roomPriceInput').value);
    var status = document.getElementById('roomStatusSelect').value;
    var err = document.getElementById('roomAddError');
    if(!num || !type || isNaN(price) || price < 0){
      err.textContent = 'Enter a room number, type, and a valid price.';
      err.classList.add('show');
      return;
    }
    var dupe = state.rooms.some(function(r){ return String(r.roomNumber).toLowerCase() === num.toLowerCase(); });
    if(dupe){
      err.textContent = 'A room with that number already exists.';
      err.classList.add('show');
      return;
    }
    err.classList.remove('show');
    state.rooms.push({ id: uid(), roomNumber: num, roomType: type, price: price, status: status, createdAt: new Date().toISOString() });
    persistRooms().then(function(){
      showToast('Room added');
      document.getElementById('roomNumberInput').value = '';
      document.getElementById('roomPriceInput').value = '';
      renderRoomsAdmin();
      renderRoomDashboard();
    });
  });

  // ---------- date-aware availability (shared by dashboard + booking form) ----------
  // Half-open interval overlap: [checkIn, checkOut) vs an existing booking's [checkIn, checkOut).
  function bookingOverlaps(booking, checkIn, checkOut){
    return booking.checkIn < checkOut && checkIn < booking.checkOut;
  }
  function roomBookingsForRoom(roomId){
    // Cancelled and Checked Out bookings no longer occupy the room, so they
    // shouldn't count as conflicts when computing availability.
    return state.roomBookings.filter(function(b){ return b.roomId === roomId && b.bookingStatus !== 'Cancelled' && b.bookingStatus !== 'Checked Out'; });
  }
  function isRoomFreeForRange(room, checkIn, checkOut, excludeBookingId){
    if(!room || room.status !== 'available') return false; // manual operational block (cleaning/maintenance/out of service)
    var conflicts = roomBookingsForRoom(room.id).filter(function(b){
      if(excludeBookingId && b.id === excludeBookingId) return false;
      return bookingOverlaps(b, checkIn, checkOut);
    });
    return conflicts.length === 0;
  }
  function roomTodayInfo(room){
    var today = localDateStr(new Date());
    if(room.status !== 'available'){
      return { label: roomStatusLabel(room.status), cls: 'rs-blocked', bookable:false };
    }
    var active = roomBookingsForRoom(room.id).find(function(b){ return b.checkIn <= today && today < b.checkOut; });
    if(!active){ return { label:'Available', cls:'rs-available', bookable:true }; }
    if(active.bookingStatus === 'Checked In'){ return { label:'Checked-in', cls:'rs-checked-in', bookable:false, booking:active }; }
    if(active.checkIn === today){ return { label:'Check-in today', cls:'rs-checkin-today', bookable:false, booking:active }; }
    return { label:'Booked', cls:'rs-booked', bookable:false, booking:active };
  }

  // ---------- room availability dashboard (staff) ----------
  function renderRoomQuickStats(){
    var wrap = document.getElementById('roomQuickStats');
    if(!wrap) return;
    var total = state.rooms.length;
    var counts = { available:0, booked:0, checkinToday:0, checkedIn:0 };
    state.rooms.forEach(function(r){
      var info = roomTodayInfo(r);
      if(info.cls === 'rs-available') counts.available++;
      else if(info.cls === 'rs-booked') counts.booked++;
      else if(info.cls === 'rs-checkin-today') counts.checkinToday++;
      else if(info.cls === 'rs-checked-in') counts.checkedIn++;
    });
    wrap.innerHTML =
      statCardHtml('Available today', String(counts.available), total+' room'+(total===1?'':'s')+' total', DASH_ICONS.sun, 'olive')
      + statCardHtml('Checked-in', String(counts.checkedIn), null, DASH_ICONS.receipt, 'brick')
      + statCardHtml('Check-in today', String(counts.checkinToday), null, DASH_ICONS.calendar, 'gold')
      + statCardHtml('Booked (other dates)', String(counts.booked), null, DASH_ICONS.trend, 'olive');
  }
  function setDefaultRoomFilterDates(){
    var ciEl = document.getElementById('roomFilterCheckIn');
    var coEl = document.getElementById('roomFilterCheckOut');
    if(!ciEl || !coEl) return;
    if(!ciEl.value) ciEl.value = localDateStr(new Date());
    if(!coEl.value) coEl.value = localDateStr(new Date(Date.now() + 86400000));
  }
  function renderRoomGrid(){
    var wrap = document.getElementById('roomGridWrap');
    if(!wrap) return;
    if(state.rooms.length === 0){
      wrap.innerHTML = '<div class="empty-state"><p class="big">No rooms configured</p><p>Ask Admin to add rooms from Room Setup.</p></div>';
      return;
    }
    var numFilter = (document.getElementById('roomFilterNumber').value || '').trim().toLowerCase();
    var typeFilter = document.getElementById('roomFilterType').value;
    var availFilter = document.getElementById('roomFilterStatus').value;
    var checkIn = document.getElementById('roomFilterCheckIn').value;
    var checkOut = document.getElementById('roomFilterCheckOut').value;
    var validRange = !!(checkIn && checkOut && checkOut > checkIn);

    var list = state.rooms.slice().sort(function(a,b){
      return String(a.roomNumber).localeCompare(String(b.roomNumber), undefined, { numeric:true });
    });
    if(numFilter) list = list.filter(function(r){ return String(r.roomNumber).toLowerCase().indexOf(numFilter) !== -1; });
    if(typeFilter) list = list.filter(function(r){ return r.roomType === typeFilter; });

    var enriched = list.map(function(r){
      var freeForRange = validRange ? isRoomFreeForRange(r, checkIn, checkOut) : (r.status === 'available');
      return { room:r, freeForRange: freeForRange, todayInfo: roomTodayInfo(r) };
    });
    if(availFilter === 'available') enriched = enriched.filter(function(x){ return x.freeForRange; });
    if(availFilter === 'unavailable') enriched = enriched.filter(function(x){ return !x.freeForRange; });

    if(enriched.length === 0){
      wrap.innerHTML = '<div class="empty-state"><p class="big">No rooms match</p><p>Try a different search, type, or date range.</p></div>';
      return;
    }

    wrap.innerHTML = '<div class="room-grid">' + enriched.map(function(x){
      var r = x.room;
      var badgeCls, badgeLabel;
      if(r.status !== 'available'){
        badgeCls = 'rs-blocked'; badgeLabel = roomStatusLabel(r.status);
      } else if(validRange){
        badgeCls = x.freeForRange ? 'rs-available' : 'rs-booked';
        badgeLabel = x.freeForRange ? 'Available' : 'Not available';
      } else {
        badgeCls = x.todayInfo.cls; badgeLabel = x.todayInfo.label;
      }
      var canBook = validRange && x.freeForRange;
      var actionsHtml = '';
      if(canBook){
        actionsHtml = '<button class="btn brick" data-book-room="'+r.id+'">Book room</button>';
      } else if(x.todayInfo.booking){
        actionsHtml = '<button class="btn ghost" data-view-booking="'+x.todayInfo.booking.id+'">View booking</button>';
      }
      return '<div class="room-card">'
        + '<div class="room-card-top"><div><div class="room-num">'+escapeHtml(r.roomNumber)+'</div><div class="room-type">'+escapeHtml(r.roomType)+'</div></div>'
        + '<span class="room-status-badge '+badgeCls+'">'+escapeHtml(badgeLabel)+'</span></div>'
        + '<div class="room-price">'+money(r.price)+'/night</div>'
        + (actionsHtml ? '<div class="room-card-foot">'+actionsHtml+'</div>' : '')
        + '</div>';
    }).join('') + '</div>';

    wrap.querySelectorAll('[data-book-room]').forEach(function(btn){
      btn.addEventListener('click', function(){
        var room = state.rooms.find(function(r){ return r.id === btn.dataset.bookRoom; });
        if(room) openRoomBookingForm(room, checkIn, checkOut);
      });
    });
    wrap.querySelectorAll('[data-view-booking]').forEach(function(btn){
      btn.addEventListener('click', function(){
        var b = state.roomBookings.find(function(x){ return x.id === btn.dataset.viewBooking; });
        if(b) openRoomInvoiceOverlay(b);
      });
    });
  }
  function renderRoomDashboard(){
    renderRoomQuickStats();
    renderRoomGrid();
  }
  document.getElementById('roomFilterNumber').addEventListener('input', renderRoomGrid);
  ['roomFilterType','roomFilterStatus','roomFilterCheckIn','roomFilterCheckOut'].forEach(function(id){
    document.getElementById(id).addEventListener('change', renderRoomGrid);
  });
  document.getElementById('roomFilterResetBtn').addEventListener('click', function(){
    document.getElementById('roomFilterNumber').value = '';
    document.getElementById('roomFilterType').value = '';
    document.getElementById('roomFilterStatus').value = '';
    document.getElementById('roomFilterCheckIn').value = '';
    document.getElementById('roomFilterCheckOut').value = '';
    setDefaultRoomFilterDates();
    renderRoomGrid();
  });

  // ---------- booking form (staff) ----------
  function roomNights(checkIn, checkOut){
    if(!checkIn || !checkOut) return 0;
    var a = new Date(checkIn + 'T00:00:00'), b = new Date(checkOut + 'T00:00:00');
    var diff = Math.round((b - a) / 86400000);
    return diff > 0 ? diff : 0;
  }
  function findPromoByCode(codeRaw){
    var code = (codeRaw || '').trim().toUpperCase();
    if(!code) return null;
    return state.promoCodes.find(function(p){ return p.code === code; }) || null;
  }
  function openRoomBookingForm(room, checkIn, checkOut){
    state.roomSelectedForBooking = room;
    document.getElementById('roomBookingFormTitle').textContent = 'Room ' + room.roomNumber + ' — ' + room.roomType + ' (' + money(room.price) + '/night)';
    document.getElementById('rbGuestName').value = '';
    document.getElementById('rbGuestPhone').value = '';
    document.getElementById('rbGuestEmail').value = '';
    document.getElementById('rbGuestCount').value = '';
    document.getElementById('rbGuestAddress').value = '';
    document.getElementById('rbGuestId').value = '';
    document.getElementById('rbCheckIn').value = checkIn || localDateStr(new Date());
    document.getElementById('rbCheckOut').value = checkOut || localDateStr(new Date(Date.now() + 86400000));
    document.getElementById('rbPromoCode').value = '';
    document.getElementById('rbPaymentStatus').value = 'Pending';
    document.getElementById('rbAmountPaid').value = '';
    document.getElementById('rbPaymentMethod').value = 'Cash';
    document.getElementById('rbDateError').classList.remove('show');
    document.getElementById('rbFormError').classList.remove('show');
    document.getElementById('roomBookingFormCard').style.display = '';
    renderRoomChargePreview();
    document.getElementById('roomBookingFormCard').scrollIntoView({ behavior:'smooth', block:'start' });
  }
  document.getElementById('rbCancelFormBtn').addEventListener('click', function(){
    state.roomSelectedForBooking = null;
    document.getElementById('roomBookingFormCard').style.display = 'none';
  });
  ['rbCheckIn','rbCheckOut','rbPromoCode'].forEach(function(id){
    var el = document.getElementById(id);
    el.addEventListener('input', renderRoomChargePreview);
    el.addEventListener('change', renderRoomChargePreview);
  });
  function renderRoomChargePreview(){
    var room = state.roomSelectedForBooking;
    var wrap = document.getElementById('rbChargePreview');
    if(!room || !wrap) return;
    var checkIn = document.getElementById('rbCheckIn').value;
    var checkOut = document.getElementById('rbCheckOut').value;
    var nights = roomNights(checkIn, checkOut);
    var dateErr = document.getElementById('rbDateError');
    if(nights <= 0){
      wrap.innerHTML = '<div class="row"><span>Nights</span><span>—</span></div>';
      if(checkIn && checkOut){ dateErr.textContent = 'Check-out must be after check-in.'; dateErr.classList.add('show'); }
      return;
    }
    var freeOk = isRoomFreeForRange(room, checkIn, checkOut);
    if(!freeOk){
      dateErr.textContent = 'Room ' + room.roomNumber + ' is not available for these dates.';
      dateErr.classList.add('show');
    } else {
      dateErr.classList.remove('show');
    }
    var subtotal = nights * room.price;
    var taxRate = state.restaurant.taxRate || 0;
    var tax = subtotal * (taxRate / 100);
    var cgst = tax / 2, sgst = tax / 2;
    var totalBeforeDiscount = subtotal + tax;
    var promoInput = document.getElementById('rbPromoCode').value;
    var promo = findPromoByCode(promoInput);
    var promoUsable = promo && isPromoUsable(promo);
    var discount = promoUsable ? calcDiscount(totalBeforeDiscount, promo) : 0;
    var total = totalBeforeDiscount - discount;
    var html = '<div class="row"><span>'+nights+' night'+(nights===1?'':'s')+' × '+money(room.price)+'</span><span>'+money(subtotal)+'</span></div>';
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

  document.getElementById('rbConfirmBookingBtn').addEventListener('click', function(){
    var room = state.roomSelectedForBooking;
    var err = document.getElementById('rbFormError');
    if(!room) return;
    var name = document.getElementById('rbGuestName').value.trim();
    var phone = document.getElementById('rbGuestPhone').value.trim();
    var email = document.getElementById('rbGuestEmail').value.trim();
    var guestsRaw = parseInt(document.getElementById('rbGuestCount').value, 10);
    var address = document.getElementById('rbGuestAddress').value.trim();
    var idDetails = document.getElementById('rbGuestId').value.trim();
    var checkIn = document.getElementById('rbCheckIn').value;
    var checkOut = document.getElementById('rbCheckOut').value;
    var nights = roomNights(checkIn, checkOut);

    if(!name || !phone || nights <= 0){
      err.textContent = 'Please fill in guest name, phone, and valid dates.';
      err.classList.add('show');
      return;
    }
    // Re-check availability right before committing — the room may have been
    // booked by someone else since this form was opened.
    var freshRoom = state.rooms.find(function(r){ return r.id === room.id; });
    if(!freshRoom || !isRoomFreeForRange(freshRoom, checkIn, checkOut)){
      err.textContent = 'Sorry — Room ' + room.roomNumber + ' is no longer available for these dates.';
      err.classList.add('show');
      renderRoomChargePreview();
      return;
    }
    err.classList.remove('show');

    var taxRate = state.restaurant.taxRate || 0;
    var subtotal = nights * freshRoom.price;
    var tax = subtotal * (taxRate / 100);
    var cgst = tax / 2, sgst = tax / 2;
    var totalBeforeDiscount = subtotal + tax;
    var promo = findPromoByCode(document.getElementById('rbPromoCode').value);
    var promoUsable = promo && isPromoUsable(promo);
    var discount = promoUsable ? calcDiscount(totalBeforeDiscount, promo) : 0;
    var total = totalBeforeDiscount - discount;

    var paymentStatus = document.getElementById('rbPaymentStatus').value;
    var amountPaidRaw = parseFloat(document.getElementById('rbAmountPaid').value);
    var amountPaid = isNaN(amountPaidRaw) ? 0 : Math.max(0, amountPaidRaw);
    if(paymentStatus === 'Paid') amountPaid = total;
    if(paymentStatus === 'Pending') amountPaid = 0;
    amountPaid = Math.min(amountPaid, total);
    var balanceDue = Math.max(0, total - amountPaid);

    state.roomBookingSeq += 1;
    var bookingNo = 'RB-' + String(state.roomBookingSeq).padStart(4, '0');

    var booking = {
      id: uid(), bookingNo: bookingNo, createdAt: new Date().toISOString(),
      guestName: name, guestPhone: phone, guestEmail: email, guestAddress: address,
      guests: isNaN(guestsRaw) ? null : guestsRaw, idDetails: idDetails,
      roomId: freshRoom.id, roomNumber: freshRoom.roomNumber, roomType: freshRoom.roomType, price: freshRoom.price,
      checkIn: checkIn, checkOut: checkOut, nights: nights,
      subtotal: subtotal, cgst: cgst, sgst: sgst, tax: tax,
      discountAmount: discount, promoCode: promoUsable ? promo.code : null,
      total: total, paymentStatus: paymentStatus, paymentMethod: document.getElementById('rbPaymentMethod').value,
      amountPaid: amountPaid, balanceDue: balanceDue,
      bookingStatus: 'Confirmed',
      createdByStaffId: state.session.staffId || '', createdByName: state.session.name || state.session.staffId || 'Staff',
      restaurant: Object.assign({}, state.restaurant)
    };
    state.roomBookings.unshift(booking);

    var tasks = [persistRoomBookings(), persistRoomBookingSeq()];
    if(promoUsable){
      promo.usedCount = (promo.usedCount || 0) + 1;
      tasks.push(persistPromoCodes());
    }
    Promise.all(tasks).then(function(){
      showToast('Booking confirmed for Room ' + freshRoom.roomNumber);
      state.roomSelectedForBooking = null;
      document.getElementById('roomBookingFormCard').style.display = 'none';
      renderRoomDashboard();
      renderRoomBookingsList();
      if(promoUsable) renderPromoList();
      openRoomInvoiceOverlay(booking);
    });
  });

  // ---------- room invoice (receipt / PDF / WhatsApp) ----------
  // A formal hotel booking invoice layout (letterhead, bill-to/booking-details
  // block, itemized table, totals) — distinct from the restaurant order slip.
  function renderRoomReceiptHtml(b){
    var r = state.restaurant; // always use current hotel settings, not a stale per-booking snapshot
    var dateStr = new Date(b.createdAt).toLocaleString('en-IN', { dateStyle:'medium', timeStyle:'short' });
    var checkInLabel = new Date(b.checkIn + 'T00:00:00').toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'numeric' });
    var checkOutLabel = new Date(b.checkOut + 'T00:00:00').toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'numeric' });
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
        + '<div class="pinv-head-left"><h2>'+escapeHtml(r.name || 'Hotel')+'</h2>'
          + (r.address ? '<p>'+escapeHtml(r.address)+'</p>' : '')
          + (contactLine ? '<p>'+contactLine+'</p>' : '')
          + (r.gstin ? '<p>GSTIN: '+escapeHtml(r.gstin)+'</p>' : '')
        + '</div>'
        + '<div class="pinv-head-right">'
          + '<div class="pinv-doc-title">Booking Invoice</div>'
          + '<div class="pinv-doc-no">'+escapeHtml(b.bookingNo)+'</div>'
          + '<div style="margin-top:9px;"><span class="payment-status-badge '+psClass+'">'+escapeHtml(b.paymentStatus)+'</span></div>'
        + '</div>'
      + '</div>'
      + '<div class="pinv-accent-bar"></div>'
      + '<div class="pinv-meta-grid">'
        + '<div class="pinv-meta-col"><div class="pinv-meta-label">Billed To</div>'
          + '<div class="pinv-meta-strong">'+escapeHtml(b.guestName)+'</div>'
          + '<div class="pinv-line">'+escapeHtml(b.guestPhone)+'</div>'
          + (b.guestEmail ? '<div class="pinv-line">'+escapeHtml(b.guestEmail)+'</div>' : '')
        + '</div>'
        + '<div class="pinv-meta-col"><div class="pinv-meta-label">Booking Details</div>'
          + '<div class="pinv-meta-row"><span>Booked on</span><span>'+dateStr+'</span></div>'
          + '<div class="pinv-meta-row"><span>Check-in</span><span>'+checkInLabel+'</span></div>'
          + '<div class="pinv-meta-row"><span>Check-out</span><span>'+checkOutLabel+'</span></div>'
        + '</div>'
      + '</div>'
      + '<table class="pinv-table"><thead><tr><th>Description</th><th class="num">Rate</th><th class="num">Nights</th><th class="num">Amount</th></tr></thead>'
      + '<tbody><tr>'
        + '<td><span class="pinv-item-name">Room '+escapeHtml(b.roomNumber)+'</span><span class="pinv-item-sub">'+escapeHtml(b.roomType)+' room</span></td>'
        + '<td class="num">'+money(b.price)+'</td>'
        + '<td class="num">'+b.nights+'</td>'
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
        + '<div class="pinv-thanks">Thank you for choosing '+escapeHtml(r.name || 'us')+'. We look forward to hosting you.</div>'
        + '<div class="pinv-sign">'+(r.signature ? '<img class="pinv-sign-img" src="'+r.signature+'" alt="Signature">' : '')+'<div class="line"></div>Authorized signatory</div>'
      + '</div>'
      + '</div>';
  }
  function openRoomInvoiceOverlay(b){
    state.activeInvoiceKind = 'room';
    state.activeRoomBooking = b;
    state.activeBanquetBooking = null;
    state.activeInvoice = null;
    var card = document.getElementById('receiptCard');
    card.className = 'receipt pro-invoice';
    card.innerHTML = renderRoomReceiptHtml(b);
    document.getElementById('invoiceOverlay').classList.add('show');
  }
  // Draws a formal, letterhead-style A4 booking invoice (letterhead, bill-to /
  // booking-details block, itemized table, totals box, payment + sign-off).
  function buildRoomInvoicePdfDoc(b){
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
    var checkInLabel = new Date(b.checkIn + 'T00:00:00').toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'numeric' });
    var checkOutLabel = new Date(b.checkOut + 'T00:00:00').toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'numeric' });
    var dateStr = new Date(b.createdAt).toLocaleString('en-IN', { dateStyle:'medium', timeStyle:'short' });

    var cy = margin;

    // Letterhead: hotel name/contact on the left, document title on the right
    doc.setFont('helvetica', 'bold'); doc.setFontSize(17); doc.setTextColor(brick[0], brick[1], brick[2]);
    doc.text(r.name || 'Hotel', margin, cy + 4);
    doc.setFont('helvetica', 'bold'); doc.setFontSize(15); doc.setTextColor(ink[0], ink[1], ink[2]);
    doc.text('BOOKING INVOICE', pageWidth - margin, cy + 4, { align: 'right' });
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

    // Bill-to / booking-details columns
    var rightColX = margin + contentWidth / 2 + 4;
    doc.setFont('helvetica', 'bold'); doc.setFontSize(8.5); doc.setTextColor(soft[0], soft[1], soft[2]);
    doc.text('BILLED TO', margin, cy);
    doc.text('BOOKING DETAILS', rightColX, cy);
    cy += 6;

    var metaLeftY = cy, metaRightY = cy;
    doc.setFont('helvetica', 'bold'); doc.setFontSize(11); doc.setTextColor(ink[0], ink[1], ink[2]);
    doc.text(b.guestName, margin, metaLeftY); metaLeftY += 5.2;
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(soft[0], soft[1], soft[2]);
    doc.text(b.guestPhone, margin, metaLeftY); metaLeftY += 4.4;
    if(b.guestEmail){ doc.text(b.guestEmail, margin, metaLeftY); metaLeftY += 4.4; }

    function metaRow(label, value){
      doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(soft[0], soft[1], soft[2]);
      doc.text(label, rightColX, metaRightY);
      doc.setFont('helvetica', 'bold'); doc.setTextColor(ink[0], ink[1], ink[2]);
      doc.text(value, pageWidth - margin, metaRightY, { align: 'right' });
      metaRightY += 5.4;
    }
    metaRow('Check-in', checkInLabel);
    metaRow('Check-out', checkOutLabel);

    cy = Math.max(metaLeftY, metaRightY) + 9;

    // Item table
    var col2 = margin + contentWidth * 0.52, col3 = margin + contentWidth * 0.70;
    doc.setFillColor(panel[0], panel[1], panel[2]);
    doc.rect(margin, cy, contentWidth, 8.5, 'F');
    doc.setFont('helvetica', 'bold'); doc.setFontSize(8.5); doc.setTextColor(soft[0], soft[1], soft[2]);
    doc.text('DESCRIPTION', margin + 3, cy + 5.6);
    doc.text('RATE', col2, cy + 5.6);
    doc.text('NIGHTS', col3, cy + 5.6);
    doc.text('AMOUNT', pageWidth - margin - 3, cy + 5.6, { align: 'right' });
    cy += 8.5 + 8;

    doc.setFont('helvetica', 'bold'); doc.setFontSize(10.5); doc.setTextColor(ink[0], ink[1], ink[2]);
    doc.text('Room ' + b.roomNumber, margin + 3, cy);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9.5);
    doc.text(pdfMoney(b.price), col2, cy);
    doc.text(String(b.nights), col3, cy);
    doc.text(pdfMoney(b.subtotal), pageWidth - margin - 3, cy, { align: 'right' });
    cy += 4.6;
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); doc.setTextColor(soft[0], soft[1], soft[2]);
    doc.text(b.roomType + ' room', margin + 3, cy);
    cy += 5.5;
    doc.setDrawColor(faint[0], faint[1], faint[2]);
    doc.line(margin, cy, pageWidth - margin, cy);
    cy += 11;

    // Totals box, right-aligned
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
  function buildRoomWhatsappMessage(b){
    var r = state.restaurant; // always use current hotel settings, not a stale per-booking snapshot
    var checkInLabel = new Date(b.checkIn + 'T00:00:00').toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'numeric' });
    var checkOutLabel = new Date(b.checkOut + 'T00:00:00').toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'numeric' });
    var lines = [];
    lines.push('*' + (r.name || 'Hotel') + '*');
    lines.push('Booking: ' + b.bookingNo);
    lines.push('');
    lines.push('Hi ' + b.guestName + ', thanks for booking with us! Here are your details:');
    lines.push('');
    lines.push('Room ' + b.roomNumber + ' (' + b.roomType + ')');
    lines.push('Check-in: ' + checkInLabel);
    lines.push('Check-out: ' + checkOutLabel);
    lines.push(b.nights + ' night' + (b.nights===1?'':'s') + ' x ' + money(b.price) + ' = ' + money(b.subtotal));
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
  function bookingStatusBadgeClass(status){
    if(status === 'Checked In') return 'rs-checked-in';
    if(status === 'Checked Out') return 'rs-blocked';
    if(status === 'Cancelled') return 'ps-pending';
    return 'rs-checkin-today'; // Confirmed
  }
  function paymentStatusBadgeClass(status){
    if(status === 'Paid') return 'ps-paid';
    if(status === 'Partially Paid') return 'ps-partial';
    return 'ps-pending';
  }
  function renderRoomBookingsList(){
    var wrap = document.getElementById('roomBookingsListWrap');
    if(!wrap) return;
    var q = (document.getElementById('bookingSearchInput').value || '').trim().toLowerCase();
    var statusFilter = document.getElementById('bookingSearchStatus').value;
    var list = state.roomBookings;
    if(q){
      list = list.filter(function(b){
        return (b.bookingNo||'').toLowerCase().indexOf(q) !== -1
          || (b.guestName||'').toLowerCase().indexOf(q) !== -1
          || (b.guestPhone||'').toLowerCase().indexOf(q) !== -1
          || String(b.roomNumber||'').toLowerCase().indexOf(q) !== -1;
      });
    }
    if(statusFilter){ list = list.filter(function(b){ return b.bookingStatus === statusFilter; }); }

    if(state.roomBookings.length === 0){
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
      var actions = '<button class="btn ghost small" data-view-invoice="'+b.id+'">Invoice</button> ';
      if(b.bookingStatus === 'Confirmed'){
        actions += '<button class="btn ghost small" data-checkin="'+b.id+'">Check-in</button> ';
        actions += '<button class="btn ghost small" data-cancel-booking="'+b.id+'" style="color:var(--danger);border-color:var(--danger);">Cancel</button>';
      } else if(b.bookingStatus === 'Checked In'){
        actions += '<button class="btn ghost small" data-checkout="'+b.id+'">Check-out</button>';
      }
      return '<tr>'
        + '<td data-label="Booking">'+escapeHtml(b.bookingNo)+'</td>'
        + '<td data-label="Guest">'+escapeHtml(b.guestName)+'<br><span style="color:var(--ink-faint);font-size:12px;">'+escapeHtml(b.guestPhone)+'</span></td>'
        + '<td data-label="Room">'+escapeHtml(b.roomNumber)+' <span style="color:var(--ink-faint);">('+escapeHtml(b.roomType)+')</span></td>'
        + '<td data-label="Stay">'+ci+' → '+co+'</td>'
        + '<td class="amt" data-label="Total">'+money(b.total)+'</td>'
        + '<td data-label="Payment"><span class="payment-status-badge '+paymentStatusBadgeClass(b.paymentStatus)+'">'+escapeHtml(b.paymentStatus)+'</span></td>'
        + '<td data-label="Status"><span class="room-status-badge '+bookingStatusBadgeClass(b.bookingStatus)+'">'+escapeHtml(b.bookingStatus)+'</span></td>'
        + '<td data-label="" class="row-actions-cell" style="white-space:nowrap;">'+actions+'</td>'
        + '</tr>';
    }).join('');
    wrap.innerHTML = '<table class="hist"><thead><tr><th>Booking</th><th>Guest</th><th>Room</th><th>Stay</th><th style="text-align:right;">Total</th><th>Payment</th><th>Status</th><th></th></tr></thead><tbody>'+rows+'</tbody></table>';

    wrap.querySelectorAll('[data-view-invoice]').forEach(function(btn){
      btn.addEventListener('click', function(){
        var b = state.roomBookings.find(function(x){ return x.id === btn.dataset.viewInvoice; });
        if(b) openRoomInvoiceOverlay(b);
      });
    });
    wrap.querySelectorAll('[data-checkin]').forEach(function(btn){
      btn.addEventListener('click', function(){
        var b = state.roomBookings.find(function(x){ return x.id === btn.dataset.checkin; });
        if(!b) return;
        b.bookingStatus = 'Checked In';
        persistRoomBookings().then(function(){
          showToast('Room ' + b.roomNumber + ' checked in');
          renderRoomBookingsList();
          renderRoomDashboard();
        });
      });
    });
    wrap.querySelectorAll('[data-checkout]').forEach(function(btn){
      btn.addEventListener('click', function(){
        var b = state.roomBookings.find(function(x){ return x.id === btn.dataset.checkout; });
        if(!b) return;
        b.bookingStatus = 'Checked Out';
        b.paymentStatus = 'Paid';
        b.amountPaid = b.total;
        b.balanceDue = 0;
        persistRoomBookings().then(function(){
          showToast('Room ' + b.roomNumber + ' checked out');
          renderRoomBookingsList();
          renderRoomDashboard();
        });
      });
    });
    wrap.querySelectorAll('[data-cancel-booking]').forEach(function(btn){
      btn.addEventListener('click', function(){
        var b = state.roomBookings.find(function(x){ return x.id === btn.dataset.cancelBooking; });
        if(!b) return;
        if(!window.confirm('Cancel booking ' + b.bookingNo + ' for ' + b.guestName + '?')) return;
        b.bookingStatus = 'Cancelled';
        persistRoomBookings().then(function(){
          showToast('Booking cancelled');
          renderRoomBookingsList();
          renderRoomDashboard();
        });
      });
    });
  }
  document.getElementById('bookingSearchInput').addEventListener('input', renderRoomBookingsList);
  document.getElementById('bookingSearchStatus').addEventListener('change', renderRoomBookingsList);
  document.getElementById('bookingSearchResetBtn').addEventListener('click', function(){
    document.getElementById('bookingSearchInput').value = '';
    document.getElementById('bookingSearchStatus').value = '';
    renderRoomBookingsList();
  });

  // ---------- room module bootstrap (called once from enterApp) ----------
  function initRoomModule(){
    fillAdminRoomTypeSelect();
    fillStaffRoomTypeFilter();
    setDefaultRoomFilterDates();
    renderRoomTypesAdmin();
    renderRoomsAdmin();
    renderRoomDashboard();
    renderRoomBookingsList();
  }

