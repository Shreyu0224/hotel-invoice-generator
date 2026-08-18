"use strict";

  // ---------- menu ----------
  var menuEditingId = null;
  function categoriesOf(){
    var set = {};
    state.menu.forEach(function(i){ set[i.category || 'Other'] = true; });
    return Object.keys(set);
  }
  function renderCatList(){
    var dl = document.getElementById('catList');
    dl.innerHTML = categoriesOf().map(function(c){ return '<option value="'+escapeHtml(c)+'">'; }).join('');
  }
  function renderMenu(){
    renderCatList();
    var wrap = document.getElementById('menuGroups');
    if(state.menu.length === 0){
      wrap.innerHTML = '<div class="empty-state"><p class="big">No dishes yet</p><p>Add your first menu item above to get started.</p></div>';
    } else {
      var groups = {};
      state.menu.forEach(function(item){
        var cat = item.category || 'Other';
        groups[cat] = groups[cat] || [];
        groups[cat].push(item);
      });
      var html = '';
      Object.keys(groups).sort().forEach(function(cat){
        html += '<div class="menu-group"><h3>'+escapeHtml(cat)+'</h3>';
        groups[cat].forEach(function(item){
          if(menuEditingId === item.id){
            html += '<div class="menu-item-row editing">'
              + '<input class="edit-field edit-name" data-edit-name="'+item.id+'" value="'+escapeHtml(item.name)+'">'
              + '<input class="edit-field edit-cat" data-edit-cat="'+item.id+'" value="'+escapeHtml(item.category||'')+'" list="catList">'
              + '<input class="edit-field edit-price" type="number" min="0" step="0.5" data-edit-price="'+item.id+'" value="'+item.price+'">'
              + '<span class="row-actions">'
              + '<button class="icon-btn" data-save="'+item.id+'" title="Save" style="color:var(--success);border-color:var(--success);">✓</button>'
              + '<button class="icon-btn" data-cancel-edit="'+item.id+'" title="Cancel">✕</button>'
              + '</span></div>';
          } else {
            html += '<div class="menu-item-row">'
              + '<span class="name">'+escapeHtml(item.name)+'</span>'
              + '<span class="price">'+money(item.price)+'</span>'
              + '<span class="row-actions">'
              + '<button class="icon-btn" data-edit="'+item.id+'" title="Edit price / details">✎</button>'
              + '<button class="icon-btn" data-del="'+item.id+'" title="Delete">✕</button>'
              + '</span></div>';
          }
        });
        html += '</div>';
      });
      wrap.innerHTML = html;
    }

    wrap.querySelectorAll('[data-edit]').forEach(function(btn){
      btn.addEventListener('click', function(){
        menuEditingId = btn.dataset.edit;
        renderMenu();
      });
    });
    wrap.querySelectorAll('[data-cancel-edit]').forEach(function(btn){
      btn.addEventListener('click', function(){
        menuEditingId = null;
        renderMenu();
      });
    });
    wrap.querySelectorAll('[data-save]').forEach(function(btn){
      btn.addEventListener('click', function(){
        var id = btn.dataset.save;
        var item = state.menu.find(function(i){ return i.id === id; });
        if(!item) return;
        var nameEl = wrap.querySelector('[data-edit-name="'+id+'"]');
        var catEl = wrap.querySelector('[data-edit-cat="'+id+'"]');
        var priceEl = wrap.querySelector('[data-edit-price="'+id+'"]');
        var name = nameEl.value.trim();
        var category = catEl.value.trim() || 'Other';
        var price = parseFloat(priceEl.value);
        if(!name || isNaN(price) || price < 0){ showToast('Enter a valid name and price.'); return; }
        item.name = name; item.category = category; item.price = price;
        menuEditingId = null;
        persistMenu().then(function(){
          showToast('Item updated');
          renderMenu();
          renderItemPicker();
        });
      });
    });
    wrap.querySelectorAll('[data-del]').forEach(function(btn){
      btn.addEventListener('click', function(){
        var item = state.menu.find(function(i){ return i.id === btn.dataset.del; });
        if(!item) return;
        if(!window.confirm('Delete "'+item.name+'" from the menu? You can restore it later from Deleted items.')) return;
        state.menu = state.menu.filter(function(i){ return i.id !== item.id; });
        state.deletedMenu.unshift(Object.assign({}, item, { deletedAt: new Date().toISOString() }));
        if(state.deletedMenu.length > 200) state.deletedMenu = state.deletedMenu.slice(0, 200);
        Promise.all([persistMenu(), persistDeletedMenu()]).then(function(){
          showToast('Item deleted — restore it anytime from Menu › Deleted items');
          renderMenu();
          renderMenuTrash();
          renderItemPicker();
        });
      });
    });
  }

  function renderMenuTrash(){
    var wrap = document.getElementById('menuTrashWrap');
    var countEl = document.getElementById('menuTrashCount');
    if(state.deletedMenu.length === 0){
      countEl.textContent = '';
      wrap.innerHTML = '<div class="empty-state"><p class="big">No deleted items</p><p>Anything you remove from the menu will show up here so it can be restored.</p></div>';
      return;
    }
    countEl.textContent = state.deletedMenu.length + ' item' + (state.deletedMenu.length === 1 ? '' : 's');
    wrap.innerHTML = state.deletedMenu.map(function(item){
      var when = new Date(item.deletedAt).toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'numeric' });
      return '<div class="trash-item-row">'
        + '<span><span class="name">'+escapeHtml(item.name)+'</span><span class="meta">'+escapeHtml(item.category||'Other')+' · deleted '+when+'</span></span>'
        + '<span class="price">'+money(item.price)+'</span>'
        + '<span class="row-actions"><button class="btn ghost small" data-restore="'+item.id+'">Restore</button></span>'
        + '</div>';
    }).join('');
    wrap.querySelectorAll('[data-restore]').forEach(function(btn){
      btn.addEventListener('click', function(){
        var id = btn.dataset.restore;
        var item = state.deletedMenu.find(function(i){ return i.id === id; });
        if(!item) return;
        state.deletedMenu = state.deletedMenu.filter(function(i){ return i.id !== id; });
        var restored = { id: item.id, name: item.name, category: item.category, price: item.price };
        // avoid id clash with an item that may have been re-added since deletion
        if(state.menu.some(function(i){ return i.id === restored.id; })) restored.id = uid();
        state.menu.push(restored);
        Promise.all([persistMenu(), persistDeletedMenu()]).then(function(){
          showToast('"'+item.name+'" restored to menu');
          renderMenu();
          renderMenuTrash();
          renderItemPicker();
        });
      });
    });
  }

  document.getElementById('addMenuItemBtn').addEventListener('click', function(){
    var name = document.getElementById('miName').value.trim();
    var category = document.getElementById('miCategory').value.trim() || 'Other';
    var price = parseFloat(document.getElementById('miPrice').value);
    var err = document.getElementById('menuError');
    if(!name || isNaN(price) || price < 0){ err.classList.add('show'); return; }
    err.classList.remove('show');
    state.menu.push({ id: uid(), name: name, category: category, price: price });
    persistMenu().then(function(){
      showToast('Item added to menu');
      document.getElementById('miName').value = '';
      document.getElementById('miPrice').value = '';
      renderMenu();
      renderItemPicker();
    });
  });


  // ---------- restaurant tables ----------
  function persistTableOrders(){ return saveRestaurantFields({ tableOrders: state.tableOrders }); }
  function persistTableCount(){ return saveRestaurantFields({ tableCount: state.tableCount }); }
  var tableOrdersPersistTimer = null;
  function schedulePersistTableOrders(){
    clearTimeout(tableOrdersPersistTimer);
    tableOrdersPersistTimer = setTimeout(function(){ persistTableOrders(); }, 500);
  }
  function defaultTableOrder(){
    return { status:'available', customerName:'', customerPhone:'', order:[], paymentMethod:'Cash', appliedPromo:null };
  }
  function tableIsActive(t){
    if(!t) return false;
    return !!((t.customerName && t.customerName.trim()) || (t.customerPhone && t.customerPhone.trim()) || (t.order && t.order.length > 0));
  }
  var loadingTable = false;
  // Snapshots the current on-screen working order (customer, items, promo,
  // payment method) into that table's saved slot. Called before switching
  // away from a table — this is what makes every table's bill independent.
  function saveWorkingOrderToTable(tableId){
    if(!tableId) return;
    var nameEl = document.getElementById('custName');
    var phoneEl = document.getElementById('custPhone');
    var name = nameEl ? nameEl.value : '';
    var phone = phoneEl ? phoneEl.value : '';
    var rec = {
      customerName: name, customerPhone: phone,
      order: state.order.slice(),
      paymentMethod: state.paymentMethod,
      appliedPromo: state.appliedPromo
    };
    rec.status = tableIsActive(rec) ? 'active' : 'available';
    state.tableOrders[tableId] = rec;
  }
  // Pulls a table's saved slot onto the screen as the live working order.
  function loadTableIntoWorking(tableId){
    loadingTable = true;
    var t = state.tableOrders[tableId] || defaultTableOrder();
    state.order = (t.order || []).slice();
    state.paymentMethod = t.paymentMethod || 'Cash';
    state.appliedPromo = t.appliedPromo || null;
    var nameEl = document.getElementById('custName');
    var phoneEl = document.getElementById('custPhone');
    if(nameEl) nameEl.value = t.customerName || '';
    if(phoneEl) phoneEl.value = t.customerPhone || '';
    document.querySelectorAll('.pm-btn').forEach(function(b){ b.classList.toggle('active', b.dataset.method === state.paymentMethod); });
    var billingErr = document.getElementById('billingError'); if(billingErr) billingErr.classList.remove('show');
    var promoErr = document.getElementById('promoError'); if(promoErr) promoErr.classList.remove('show');
    var heading = document.getElementById('billingHeading');
    if(heading) heading.textContent = 'Table ' + tableId + ' — bill';
    renderTicket();
    loadingTable = false;
  }
  // Saves whatever table is currently on screen back into its own slot
  // (used on every edit) without switching tables.
  function syncCurrentTableWorkingState(){
    if(loadingTable || !state.currentTable) return;
    saveWorkingOrderToTable(state.currentTable);
    renderTableStatusBadges();
    schedulePersistTableOrders();
  }
  // Switching tables ONLY changes which order is on screen — it never
  // deletes, clears, or completes anything on the table being left.
  function selectTable(tableId){
    if(state.currentTable && state.currentTable !== tableId){
      saveWorkingOrderToTable(state.currentTable);
    }
    state.currentTable = tableId;
    loadTableIntoWorking(tableId);
    renderTableStatusBadges();
    schedulePersistTableOrders();
  }
  // Live "ACTIVE / AVAILABLE" dot next to each table in the sidebar. For the
  // table currently on screen this reads straight off the live inputs so it
  // updates as the Staff types/adds items, without needing a save first.
  function renderTableStatusBadges(){
    document.querySelectorAll('[data-table-badge]').forEach(function(el){
      var i = parseInt(el.dataset.tableBadge, 10);
      var active;
      if(state.currentTable === i){
        var nameEl = document.getElementById('custName');
        var phoneEl = document.getElementById('custPhone');
        active = !!((nameEl && nameEl.value.trim()) || (phoneEl && phoneEl.value.trim()) || state.order.length > 0);
      } else {
        active = tableIsActive(state.tableOrders[i]);
      }
      el.classList.toggle('table-active', active);
    });
  }
  // After an invoice is generated for the currently selected table, that
  // table (and only that table) goes back to AVAILABLE with a clean slate.
  function clearCurrentTableAfterInvoice(){
    if(!state.currentTable) return Promise.resolve(null);
    state.tableOrders[state.currentTable] = defaultTableOrder();
    return persistTableOrders();
  }
  document.getElementById('custName').addEventListener('input', function(){ syncCurrentTableWorkingState(); });
  document.getElementById('custPhone').addEventListener('input', function(){ syncCurrentTableWorkingState(); });

  // ---------- restaurant tables (admin) ----------
  function renderTablesAdmin(){
    var countInput = document.getElementById('tableCountInput');
    if(!countInput) return;
    if(document.activeElement !== countInput){ countInput.value = state.tableCount || 0; }
    var wrap = document.getElementById('tableStatusOverview');
    var n = state.tableCount || 0;
    if(n === 0){
      wrap.innerHTML = '<p class="hint" style="margin-top:14px;">No tables configured yet — Staff will see the classic single billing screen until you add tables here.</p>';
      return;
    }
    var html = '<div class="table-overview-grid">';
    for(var i=1;i<=n;i++){
      var t = state.tableOrders[i];
      var active = tableIsActive(t);
      html += '<div class="table-overview-card'+(active?' active':'')+'">'
        + '<span class="tname">Table '+i+'</span>'
        + '<span class="tstatus">'+(active?'ACTIVE':'AVAILABLE')+'</span>'
        + (active ? '<button type="button" class="btn ghost small" data-reset-table="'+i+'">Reset</button>' : '')
        + '</div>';
    }
    html += '</div>';
    wrap.innerHTML = html;
    wrap.querySelectorAll('[data-reset-table]').forEach(function(b){
      b.addEventListener('click', function(){
        var i = parseInt(b.dataset.resetTable, 10);
        if(!window.confirm('Reset Table '+i+'? This clears its current order.')) return;
        state.tableOrders[i] = defaultTableOrder();
        persistTableOrders().then(function(){
          showToast('Table '+i+' reset');
          renderTablesAdmin();
        });
      });
    });
  }
  document.getElementById('saveTableCountBtn').addEventListener('click', function(){
    var err = document.getElementById('tableCountError');
    var raw = document.getElementById('tableCountInput').value;
    var n = parseInt(raw, 10);
    if(raw === '' || isNaN(n) || n < 0 || n > 200){ err.classList.add('show'); return; }
    err.classList.remove('show');
    state.tableCount = n;
    for(var i=1;i<=n;i++){ if(!state.tableOrders[i]) state.tableOrders[i] = defaultTableOrder(); }
    Promise.all([persistTableCount(), persistTableOrders()]).then(function(){
      showToast('Tables updated');
      renderTablesAdmin();
    });
  });

  // ---------- billing / order ----------
  function renderItemPicker(){
    var wrap = document.getElementById('itemPickerGroups');
    if(state.menu.length === 0){
      wrap.innerHTML = '<div class="empty-state"><p class="big">No menu items yet</p><p>Ask your admin to add dishes with prices first.</p></div>';
      return;
    }
    var groups = {};
    state.menu.forEach(function(item){
      var cat = item.category || 'Other';
      groups[cat] = groups[cat] || [];
      groups[cat].push(item);
    });
    var html = '';
    Object.keys(groups).sort().forEach(function(cat){
      html += '<div><h3 style="font-family:Oswald,sans-serif;font-size:14px;text-transform:uppercase;letter-spacing:.06em;color:var(--olive);margin:0 0 10px;">'+escapeHtml(cat)+'</h3><div class="item-picker-grid">';
      groups[cat].forEach(function(item){
        html += '<button class="item-card" data-add="'+item.id+'">'
          + '<span class="name">'+escapeHtml(item.name)+'</span>'
          + '<span class="price">'+money(item.price)+'</span></button>';
      });
      html += '</div></div>';
    });
    wrap.innerHTML = html;
    wrap.querySelectorAll('[data-add]').forEach(function(btn){
      btn.addEventListener('click', function(){ addToOrder(btn.dataset.add); });
    });
  }
  function addToOrder(itemId){
    var menuItem = state.menu.find(function(i){ return i.id === itemId; });
    if(!menuItem) return;
    var line = state.order.find(function(l){ return l.itemId === itemId; });
    if(line){ line.qty += 1; } else { state.order.push({ itemId: itemId, name: menuItem.name, price: menuItem.price, qty: 1 }); }
    renderTicket();
  }

  // ---------- quick-add search dropdown ----------
  var menuSearchInput = document.getElementById('menuSearchInput');
  var menuSearchDropdown = document.getElementById('menuSearchDropdown');

  function renderSearchDropdown(matches, q){
    if(matches.length === 0){
      menuSearchDropdown.innerHTML = '<div class="msd-empty">No items match "'+escapeHtml(q)+'"</div>';
    } else {
      menuSearchDropdown.innerHTML = matches.map(function(item){
        return '<div class="msd-item" data-pick="'+item.id+'">'
          + '<span><span class="msd-name">'+escapeHtml(item.name)+'</span><span class="msd-cat">'+escapeHtml(item.category||'')+'</span></span>'
          + '<span class="msd-price">'+money(item.price)+'</span></div>';
      }).join('');
      menuSearchDropdown.querySelectorAll('[data-pick]').forEach(function(el){
        el.addEventListener('click', function(){
          addToOrder(el.dataset.pick);
          menuSearchInput.value = '';
          menuSearchDropdown.classList.remove('show');
          menuSearchDropdown.innerHTML = '';
          menuSearchInput.focus();
        });
      });
    }
    menuSearchDropdown.classList.add('show');
  }
  menuSearchInput.addEventListener('input', function(){
    var q = this.value.trim().toLowerCase();
    if(!q){ menuSearchDropdown.classList.remove('show'); menuSearchDropdown.innerHTML = ''; return; }
    var matches = state.menu.filter(function(i){ return i.name.toLowerCase().indexOf(q) > -1; });
    matches.sort(function(a,b){
      var aStarts = a.name.toLowerCase().indexOf(q) === 0 ? 0 : 1;
      var bStarts = b.name.toLowerCase().indexOf(q) === 0 ? 0 : 1;
      return aStarts - bStarts;
    });
    renderSearchDropdown(matches.slice(0, 8), q);
  });
  menuSearchInput.addEventListener('keydown', function(e){
    if(e.key === 'Enter'){
      var first = menuSearchDropdown.querySelector('[data-pick]');
      if(first){ first.click(); }
      e.preventDefault();
    } else if(e.key === 'Escape'){
      menuSearchDropdown.classList.remove('show');
    }
  });
  document.addEventListener('click', function(e){
    if(!e.target.closest('.menu-search-wrap')){ menuSearchDropdown.classList.remove('show'); }
  });

  function changeQty(itemId, delta){
    var line = state.order.find(function(l){ return l.itemId === itemId; });
    if(!line) return;
    line.qty += delta;
    if(line.qty <= 0){ state.order = state.order.filter(function(l){ return l.itemId !== itemId; }); }
    renderTicket();
  }
  function removeLine(itemId){
    state.order = state.order.filter(function(l){ return l.itemId !== itemId; });
    renderTicket();
  }
  function computeTotals(order, taxRate){
    var subtotal = order.reduce(function(sum, l){ return sum + l.price * l.qty; }, 0);
    var tax = subtotal * (taxRate / 100);
    return { subtotal: subtotal, cgst: tax / 2, sgst: tax / 2, tax: tax, total: subtotal + tax };
  }
  function calcDiscount(totalAfterTax, promo){
    if(!promo) return 0;
    var d = promo.discountType === 'percent' ? totalAfterTax * (promo.discountValue / 100) : promo.discountValue;
    return Math.max(0, Math.min(d, totalAfterTax));
  }
  function previewInvoiceNo(){
    var n = state.invoiceSeq + 1;
    return state.restaurant.invoicePrefix + '-' + String(n).padStart(4,'0');
  }
  function renderAppliedPromo(){
    var wrap = document.getElementById('appliedPromoInfo');
    if(!state.appliedPromo){ wrap.innerHTML = ''; return; }
    var p = state.appliedPromo;
    var label = p.discountType === 'percent' ? (p.discountValue + '% off') : (money(p.discountValue) + ' off');
    wrap.innerHTML = '<div class="promo-applied"><span>"'+escapeHtml(p.code)+'" applied — '+escapeHtml(label)+'</span><button id="removePromoBtn" title="Remove">✕</button></div>';
    document.getElementById('removePromoBtn').addEventListener('click', function(){
      state.appliedPromo = null;
      renderTicket();
    });
  }
  function renderTicket(){
    var linesWrap = document.getElementById('ticketLines');
    var totalsWrap = document.getElementById('ticketTotals');
    document.getElementById('ticketInvoiceNo').textContent = previewInvoiceNo();
    renderAppliedPromo();
    syncCurrentTableWorkingState();

    if(state.order.length === 0){
      linesWrap.innerHTML = '<div class="ticket-empty">No items added yet. Tap dishes on the left to build the order.</div>';
      totalsWrap.innerHTML = '';
      return;
    }
    linesWrap.innerHTML = state.order.map(function(l){
      return '<div class="ticket-line">'
        + '<span class="name">'+escapeHtml(l.name)+'</span>'
        + '<span class="qty-ctrl"><button data-qm="'+l.itemId+'">−</button><span>'+l.qty+'</span><button data-qp="'+l.itemId+'">+</button></span>'
        + '<span class="amt">'+money(l.price * l.qty)+'</span>'
        + '<button class="rm" data-rm="'+l.itemId+'">✕</button></div>';
    }).join('');
    linesWrap.querySelectorAll('[data-qm]').forEach(function(b){ b.addEventListener('click', function(){ changeQty(b.dataset.qm, -1); }); });
    linesWrap.querySelectorAll('[data-qp]').forEach(function(b){ b.addEventListener('click', function(){ changeQty(b.dataset.qp, 1); }); });
    linesWrap.querySelectorAll('[data-rm]').forEach(function(b){ b.addEventListener('click', function(){ removeLine(b.dataset.rm); }); });

    var t = computeTotals(state.order, state.restaurant.taxRate);
    var discount = calcDiscount(t.total, state.appliedPromo);
    var grandTotal = t.total - discount;
    var html = '<div class="row"><span>Subtotal</span><span>'+money(t.subtotal)+'</span></div>';
    if(state.restaurant.taxRate > 0){
      html += '<div class="row"><span>CGST '+(state.restaurant.taxRate/2).toFixed(1)+'%</span><span>'+money(t.cgst)+'</span></div>';
      html += '<div class="row"><span>SGST '+(state.restaurant.taxRate/2).toFixed(1)+'%</span><span>'+money(t.sgst)+'</span></div>';
    }
    if(discount > 0){
      html += '<div class="row" style="color:var(--success);"><span>Discount ('+escapeHtml(state.appliedPromo.code)+')</span><span>−'+money(discount)+'</span></div>';
    }
    html += '<div class="row total"><span>Total</span><span>'+money(grandTotal)+'</span></div>';
    totalsWrap.innerHTML = html;
  }

  // Promo code apply/remove (billing)
  document.getElementById('applyPromoBtn').addEventListener('click', function(){
    var codeInput = document.getElementById('promoCodeInput').value.trim().toUpperCase();
    var err = document.getElementById('promoError');
    if(!codeInput){ err.textContent = 'Enter a code.'; err.classList.add('show'); return; }
    var promo = state.promoCodes.find(function(p){ return p.code === codeInput; });
    if(!promo){ err.textContent = 'Invalid promo code.'; err.classList.add('show'); return; }
    if(!isPromoUsable(promo)){
      err.textContent = promoStatus(promo) === 'Expired' ? 'This code has expired.' : 'This code has reached its usage limit.';
      err.classList.add('show');
      return;
    }
    err.classList.remove('show');
    state.appliedPromo = promo;
    document.getElementById('promoCodeInput').value = '';
    renderTicket();
  });

  // Payment method toggle buttons
  document.getElementById('paymentMethodBtns').addEventListener('click', function(e){
    var btn = e.target.closest('.pm-btn');
    if(!btn) return;
    state.paymentMethod = btn.dataset.method;
    document.querySelectorAll('.pm-btn').forEach(function(b){ b.classList.toggle('active', b === btn); });
    syncCurrentTableWorkingState();
  });

  document.getElementById('generateInvoiceBtn').addEventListener('click', function(){
    var name = document.getElementById('custName').value.trim();
    var phone = document.getElementById('custPhone').value.trim();
    var err = document.getElementById('billingError');
    if(!name || !phone || state.order.length === 0){ err.classList.add('show'); return; }
    err.classList.remove('show');

    var t = computeTotals(state.order, state.restaurant.taxRate);
    var promo = state.appliedPromo;
    var discount = calcDiscount(t.total, promo);
    var grandTotal = t.total - discount;

    var invoice = {
      id: uid(), invoiceNo: previewInvoiceNo(), date: new Date().toISOString(),
      customerName: name, customerPhone: phone,
      items: state.order.map(function(l){ return { name:l.name, price:l.price, qty:l.qty, amount:l.price*l.qty }; }),
      subtotal: t.subtotal, cgst: t.cgst, sgst: t.sgst, tax: t.tax,
      preDiscountTotal: t.total, discountAmount: discount,
      promoCode: promo ? promo.code : null,
      total: grandTotal,
      paymentMethod: state.paymentMethod,
      restaurant: Object.assign({}, state.restaurant),
      createdByStaffId: state.session.staffId || '',
      createdByName: state.session.name || state.session.staffId || 'Staff',
      tableId: state.currentTable || null
    };
    state.invoices.unshift(invoice);
    state.invoiceSeq += 1;

    var tasks = [persistInvoices(), persistInvoiceSeq()];
    if(promo){
      promo.usedCount = (promo.usedCount || 0) + 1;
      tasks.push(persistPromoCodes());
    }
    Promise.all(tasks).then(function(){
      openInvoiceOverlay(invoice);
      state.order = [];
      state.paymentMethod = 'Cash';
      state.appliedPromo = null;
      document.getElementById('custName').value = '';
      document.getElementById('custPhone').value = '';
      document.querySelectorAll('.pm-btn').forEach(function(b){ b.classList.toggle('active', b.dataset.method === 'Cash'); });
      // Only THIS table goes back to Available — every other table's active
      // order is untouched, since it lives in its own tableOrders slot.
      clearCurrentTableAfterInvoice().then(function(){
        renderTableStatusBadges();
        renderTablesAdmin();
      });
      renderTicket();
      if(promo) renderPromoList();
      renderHistory();
      renderSalesAnalysis();
    });
  });

  // ---------- invoice receipt overlay ----------
  function renderReceiptHtml(inv){
    var r = inv.restaurant;
    var itemsHtml = inv.items.map(function(it){
      return '<div class="r-item-row">'
        + '<span class="iname">'+escapeHtml(it.name)+'</span>'
        + '<span class="leader"></span>'
        + '<span class="iqty">'+it.qty+' x '+money(it.price)+'</span>'
        + '<span class="iamt">'+money(it.amount)+'</span></div>';
    }).join('');
    var dateStr = new Date(inv.date).toLocaleString('en-IN', { dateStyle:'medium', timeStyle:'short' });
    var totalsHtml = '<div class="row"><span>Subtotal</span><span>'+money(inv.subtotal)+'</span></div>';
    if(r.taxRate > 0){
      totalsHtml += '<div class="row"><span>CGST '+(r.taxRate/2).toFixed(1)+'%</span><span>'+money(inv.cgst)+'</span></div>';
      totalsHtml += '<div class="row"><span>SGST '+(r.taxRate/2).toFixed(1)+'%</span><span>'+money(inv.sgst)+'</span></div>';
    }
    if(inv.discountAmount > 0){
      totalsHtml += '<div class="row" style="color:var(--success);"><span>Discount ('+escapeHtml(inv.promoCode)+')</span><span>−'+money(inv.discountAmount)+'</span></div>';
    }
    totalsHtml += '<div class="row grand"><span>Total</span><span>'+money(inv.total)+'</span></div>';
    var paymentHtml = '<div class="r-payment">Paid via <b>'+escapeHtml(inv.paymentMethod || 'Cash')+'</b></div>';

    return ''
      + '<div class="r-brand"><h3>'+escapeHtml(r.name || 'Restaurant')+'</h3>'
      + (r.address ? '<p>'+escapeHtml(r.address)+'</p>' : '')
      + (r.phone ? '<p>Ph: '+escapeHtml(r.phone)+'</p>' : '')
      + (r.gstin ? '<p>GSTIN: '+escapeHtml(r.gstin)+'</p>' : '') + '</div>'
      + '<div class="r-divider"></div>'
      + '<div style="text-align:center;"><span class="r-stamp">Invoice '+escapeHtml(inv.invoiceNo)+'</span></div>'
      + '<div class="r-meta-row"><span class="label">Date</span><span class="value">'+dateStr+'</span></div>'
      + '<div class="r-cust"><div class="cname">'+escapeHtml(inv.customerName)+'</div><div class="cphone">'+escapeHtml(inv.customerPhone)+'</div></div>'
      + '<div class="r-divider"></div>'
      + '<div class="r-items">'+itemsHtml+'</div>'
      + '<div class="r-divider"></div>'
      + '<div class="r-totals">'+totalsHtml+'</div>'
      + paymentHtml
      + (r.footer ? '<div class="r-footer">'+escapeHtml(r.footer)+'</div>' : '')
      + '<div class="r-barcode"></div>';
  }
  function openInvoiceOverlay(inv){
    state.activeInvoiceKind = 'restaurant';
    state.activeRoomBooking = null;
    state.activeBanquetBooking = null;
    state.activeInvoice = inv;
    var card = document.getElementById('receiptCard');
    card.className = 'receipt';
    card.innerHTML = renderReceiptHtml(inv);
    document.getElementById('invoiceOverlay').classList.add('show');
  }
  function closeInvoiceOverlay(){ document.getElementById('invoiceOverlay').classList.remove('show'); }
  document.getElementById('closeInvoiceBtn').addEventListener('click', closeInvoiceOverlay);
  document.getElementById('printInvoiceBtn').addEventListener('click', function(){ window.print(); });
  // jsPDF's built-in fonts only support Latin-1 — the ₹ symbol has no glyph in them,
  // so use a safe "Rs." label in the PDF specifically (the rest of the app still shows ₹).
  function pdfSafeCurrency(){
    var sym = state.restaurant.currency || '₹';
    for(var i=0;i<sym.length;i++){ if(sym.charCodeAt(i) > 255){ return 'Rs.'; } }
    return sym;
  }
  function pdfMoney(n){
    n = Math.round((n + Number.EPSILON) * 100) / 100;
    return pdfSafeCurrency() + n.toFixed(2);
  }
  // Detects the jsPDF image format from a data URL so addImage() knows how to decode it.
  function pdfImageFormat(dataUrl){
    var m = /^data:image\/(png|jpe?g|webp)/i.exec(dataUrl || '');
    if(!m) return 'PNG';
    var t = m[1].toLowerCase();
    if(t === 'jpg' || t === 'jpeg') return 'JPEG';
    if(t === 'webp') return 'WEBP';
    return 'PNG';
  }
  // Draws the admin's signature image (if set) sized to fit within a box above the
  // signatory line, keeping its original aspect ratio so it isn't stretched.
  function drawPdfSignature(doc, r, boxRightX, boxY, boxMaxW, boxMaxH){
    if(!r.signature) return;
    var ratio = r.signatureRatio > 0 ? r.signatureRatio : 3;
    var w = boxMaxW, h = w / ratio;
    if(h > boxMaxH){ h = boxMaxH; w = h * ratio; }
    try{
      doc.addImage(r.signature, pdfImageFormat(r.signature), boxRightX - w, boxY - h, w, h);
    }catch(e){ console.error('Could not draw signature on PDF', e); }
  }
  // Builds the invoice PDF by drawing real text/lines directly — no screenshot step,
  // so there's nothing that can silently fail and come out blank.
  function buildInvoicePdfDoc(inv){
    var jsPDFCtor = (window.jspdf && window.jspdf.jsPDF) ? window.jspdf.jsPDF : null;
    if(!jsPDFCtor){ throw new Error('jsPDF not loaded'); }
    var r = inv.restaurant;
    var pageWidth = 100;   // mm — narrow, receipt-style width
    var margin = 8;
    var contentWidth = pageWidth - margin * 2;
    var cx = pageWidth / 2;
    var ink = [42, 36, 32], soft = [107, 98, 89], brick = [156, 59, 46];

    // Measure wrapped text first so we can size the page to fit exactly (no blank space,
    // no unexpected extra pages).
    var measureDoc = new jsPDFCtor({ unit: 'mm', format: [pageWidth, 400] });
    measureDoc.setFont('helvetica', 'normal'); measureDoc.setFontSize(8.5);
    var addressLines = r.address ? measureDoc.splitTextToSize(r.address, contentWidth) : [];
    var footerLines = r.footer ? measureDoc.splitTextToSize(r.footer, contentWidth) : [];

    var y = margin;
    y += 7;                                  // restaurant name
    y += addressLines.length * 4;
    if(r.phone) y += 4;
    if(r.gstin) y += 4;
    y += 8;                                   // divider + gap
    y += 9;                                    // stamp box
    y += 6;                                    // date row
    y += 5 + 5;                                // customer name + phone
    y += 8;                                    // divider + gap
    y += Math.max(inv.items.length, 1) * 5;    // item rows
    y += 8;                                    // divider + gap
    y += 5;                                    // subtotal
    if(r.taxRate > 0){ y += 5 + 5; }           // CGST + SGST
    if(inv.discountAmount > 0){ y += 5; }      // discount line
    y += 8;                                    // total (with rule above it)
    y += 6;                                     // payment method line
    if(footerLines.length){ y += footerLines.length * 4 + 4; }
    y += 10;                                   // barcode strip
    y += margin;
    var pageHeight = y;

    var doc = new jsPDFCtor({ unit: 'mm', format: [pageWidth, pageHeight] });
    var cy = margin;

    function dashedLine(){
      doc.setDrawColor(160, 150, 135);
      doc.setLineDashPattern([1, 1], 0);
      doc.line(margin, cy, pageWidth - margin, cy);
      doc.setLineDashPattern([], 0);
    }

    doc.setFont('helvetica', 'bold'); doc.setFontSize(13); doc.setTextColor(ink[0], ink[1], ink[2]);
    doc.text(r.name || 'Restaurant', cx, cy, { align: 'center' });
    cy += 6;

    doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); doc.setTextColor(soft[0], soft[1], soft[2]);
    addressLines.forEach(function(line){ doc.text(line, cx, cy, { align: 'center' }); cy += 4; });
    if(r.phone){ doc.text('Ph: ' + r.phone, cx, cy, { align: 'center' }); cy += 4; }
    if(r.gstin){ doc.text('GSTIN: ' + r.gstin, cx, cy, { align: 'center' }); cy += 4; }

    cy += 2; dashedLine(); cy += 6;

    doc.setDrawColor(brick[0], brick[1], brick[2]); doc.setLineWidth(0.6);
    doc.setFont('helvetica', 'bold'); doc.setFontSize(10);
    var stampText = 'INVOICE ' + inv.invoiceNo;
    var stampWidth = doc.getTextWidth(stampText) + 8;
    doc.roundedRect(cx - stampWidth / 2, cy - 5, stampWidth, 8, 1, 1);
    doc.setTextColor(brick[0], brick[1], brick[2]);
    doc.text(stampText, cx, cy, { align: 'center' });
    cy += 9;

    var dateStr = new Date(inv.date).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); doc.setTextColor(soft[0], soft[1], soft[2]);
    doc.text('DATE', margin, cy);
    doc.setFont('helvetica', 'bold'); doc.setTextColor(ink[0], ink[1], ink[2]);
    doc.text(dateStr, pageWidth - margin, cy, { align: 'right' });
    cy += 6;

    doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.setTextColor(ink[0], ink[1], ink[2]);
    doc.text(inv.customerName, margin, cy); cy += 5;
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); doc.setTextColor(soft[0], soft[1], soft[2]);
    doc.text(inv.customerPhone, margin, cy); cy += 3;

    cy += 3; dashedLine(); cy += 6;

    doc.setFont('courier', 'normal'); doc.setFontSize(8.5);
    inv.items.forEach(function(it){
      doc.setTextColor(ink[0], ink[1], ink[2]);
      doc.text(it.name, margin, cy);
      doc.setTextColor(soft[0], soft[1], soft[2]);
      doc.text(it.qty + ' x ' + pdfMoney(it.price), pageWidth - margin - 20, cy, { align: 'right' });
      doc.setTextColor(ink[0], ink[1], ink[2]);
      doc.text(pdfMoney(it.amount), pageWidth - margin, cy, { align: 'right' });
      cy += 5;
    });

    cy += 1; dashedLine(); cy += 6;

    function totalRow(label, value, bold, size){
      doc.setFont('courier', bold ? 'bold' : 'normal');
      doc.setFontSize(size || 9);
      doc.setTextColor(ink[0], ink[1], ink[2]);
      doc.text(label, margin, cy);
      doc.text(value, pageWidth - margin, cy, { align: 'right' });
      cy += bold ? 7 : 5;
    }
    totalRow('Subtotal', pdfMoney(inv.subtotal), false);
    if(r.taxRate > 0){
      totalRow('CGST ' + (r.taxRate/2).toFixed(1) + '%', pdfMoney(inv.cgst), false);
      totalRow('SGST ' + (r.taxRate/2).toFixed(1) + '%', pdfMoney(inv.sgst), false);
    }
    if(inv.discountAmount > 0){
      doc.setFont('courier', 'normal'); doc.setFontSize(9); doc.setTextColor(63, 107, 74);
      doc.text('Discount (' + inv.promoCode + ')', margin, cy);
      doc.text('-' + pdfMoney(inv.discountAmount), pageWidth - margin, cy, { align: 'right' });
      cy += 5;
    }
    doc.setDrawColor(ink[0], ink[1], ink[2]);
    doc.line(margin, cy - 4, pageWidth - margin, cy - 4);
    totalRow('Total', pdfMoney(inv.total), true, 12);

    cy += 2;
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); doc.setTextColor(soft[0], soft[1], soft[2]);
    doc.text('Paid via ' + (inv.paymentMethod || 'Cash'), cx, cy, { align: 'center' });
    cy += 4;

    if(footerLines.length){
      cy += 3;
      doc.setFont('helvetica', 'italic'); doc.setFontSize(8.5); doc.setTextColor(soft[0], soft[1], soft[2]);
      footerLines.forEach(function(line){ doc.text(line, cx, cy, { align: 'center' }); cy += 4; });
    }

    cy += 4;
    doc.setDrawColor(ink[0], ink[1], ink[2]);
    var barX = margin;
    while(barX < pageWidth - margin){
      var w = (Math.random() > 0.5) ? 0.8 : 0.4;
      doc.setLineWidth(w);
      doc.line(barX, cy, barX, cy + 8);
      barX += w + 0.8;
    }

    return doc;
  }

  document.getElementById('downloadPdfBtn').addEventListener('click', function(){
    var btn = document.getElementById('downloadPdfBtn');
    var kind = state.activeInvoiceKind;
    var inv = kind === 'room' ? state.activeRoomBooking : (kind === 'banquet' ? state.activeBanquetBooking : state.activeInvoice);
    if(!inv){ return; }
    if(!window.jspdf || !window.jspdf.jsPDF){
      showToast('PDF library failed to load — check your internet connection.');
      return;
    }
    var originalLabel = btn.textContent;
    btn.textContent = 'Preparing PDF…';
    btn.disabled = true;
    try{
      var doc = kind === 'room' ? buildRoomInvoicePdfDoc(inv) : (kind === 'banquet' ? buildBanquetInvoicePdfDoc(inv) : buildInvoicePdfDoc(inv));
      doc.save((kind === 'restaurant' ? inv.invoiceNo : inv.bookingNo) + '.pdf');
      showToast('Invoice downloaded as PDF');
    } catch(err){
      console.error('PDF generation failed', err);
      showToast('Could not generate the PDF — please try again.');
    }
    btn.textContent = originalLabel; btn.disabled = false;
  });

  // WhatsApp: opens the chat pre-addressed to the customer's exact number, with the full
  // itemized invoice as the message text. Text only — fully automatic, nothing to attach.
  document.getElementById('whatsappTextBtn').addEventListener('click', function(){
    var kind = state.activeInvoiceKind;
    var inv = kind === 'room' ? state.activeRoomBooking : (kind === 'banquet' ? state.activeBanquetBooking : state.activeInvoice);
    if(!inv){ return; }
    var rawPhone = kind === 'restaurant' ? inv.customerPhone : (kind === 'room' ? inv.guestPhone : inv.custPhone);
    var phone = normalizePhoneForWhatsapp(rawPhone);
    if(!phone){ showToast('Could not read a valid WhatsApp number from this invoice.'); return; }
    var text = kind === 'room' ? buildRoomWhatsappMessage(inv) : (kind === 'banquet' ? buildBanquetWhatsappMessage(inv) : buildWhatsappMessage(inv));
    window.open('https://wa.me/' + phone + '?text=' + encodeURIComponent(text), '_blank');
  });
  function normalizePhoneForWhatsapp(phone){
    var digits = String(phone || '').replace(/[^\d+]/g, '');
    if(digits.indexOf('+') === 0){ digits = digits.slice(1); }
    digits = digits.replace(/\D/g, '');
    if(digits.length === 10){ digits = '91' + digits; } // assume Indian number if no country code given
    if(digits.length < 10){ return null; }
    return digits;
  }
  function buildWhatsappMessage(inv){
    var r = inv.restaurant;
    var dateStr = new Date(inv.date).toLocaleString('en-IN', { dateStyle:'medium', timeStyle:'short' });
    var lines = [];
    lines.push('*' + (r.name || 'Restaurant') + '*');
    lines.push('Invoice: ' + inv.invoiceNo + '  |  ' + dateStr);
    lines.push('');
    lines.push('Hi ' + inv.customerName + ', thanks for your order! Here is your invoice:');
    lines.push('');
    inv.items.forEach(function(it){
      lines.push(it.name + '  x' + it.qty + '  ' + money(it.amount));
    });
    lines.push('');
    lines.push('Subtotal: ' + money(inv.subtotal));
    if(r.taxRate > 0){
      lines.push('CGST (' + (r.taxRate/2).toFixed(1) + '%): ' + money(inv.cgst));
      lines.push('SGST (' + (r.taxRate/2).toFixed(1) + '%): ' + money(inv.sgst));
    }
    if(inv.discountAmount > 0){
      lines.push('Discount (' + inv.promoCode + '): -' + money(inv.discountAmount));
    }
    lines.push('*Total: ' + money(inv.total) + '*');
    lines.push('Paid via: ' + (inv.paymentMethod || 'Cash'));
    if(r.footer){ lines.push(''); lines.push(r.footer); }
    return lines.join('\n');
  }
  document.getElementById('newBillBtn').addEventListener('click', function(){
    var kind = state.activeInvoiceKind;
    closeInvoiceOverlay();
    if(kind === 'room'){ switchTab('room-booking'); return; }
    if(kind === 'banquet'){ switchTab('banquet-booking'); return; }
    switchTab(state.currentTable ? 'table-' + state.currentTable : 'billing');
  });
  document.getElementById('invoiceOverlay').addEventListener('click', function(e){
    if(e.target.id === 'invoiceOverlay') closeInvoiceOverlay();
  });

  // ---------- history (admin) ----------
  function localDateStr(d){
    var yyyy = d.getFullYear(), mm = String(d.getMonth()+1).padStart(2,'0'), dd = String(d.getDate()).padStart(2,'0');
    return yyyy+'-'+mm+'-'+dd;
  }
  function renderHistory(){
    var wrap = document.getElementById('historyWrap');
    var filterDate = document.getElementById('histDate').value;
    var list = state.invoices;
    if(filterDate){
      list = list.filter(function(inv){ return localDateStr(new Date(inv.date)) === filterDate; });
    }

    if(state.invoices.length === 0){
      wrap.innerHTML = '<div class="empty-state"><p class="big">No invoices yet</p><p>Bills staff generate will show up here.</p></div>';
      return;
    }
    if(list.length === 0){
      wrap.innerHTML = '<div class="empty-state"><p class="big">No invoices on this date</p><p>Try another date, or clear the search to see everything.</p></div>';
      return;
    }
    var rows = list.map(function(inv){
      var d = new Date(inv.date).toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'numeric' });
      return '<tr>'
        + '<td data-label="Invoice">'+escapeHtml(inv.invoiceNo)+'</td>'
        + '<td data-label="Date">'+d+'</td>'
        + '<td data-label="Customer">'+escapeHtml(inv.customerName)+'<br><span style="color:var(--ink-faint);font-size:12px;">'+escapeHtml(inv.customerPhone)+'</span></td>'
        + '<td data-label="Staff">'+escapeHtml(inv.createdByName || '—')+'</td>'
        + '<td data-label="Payment">'+escapeHtml(inv.paymentMethod || 'Cash')+(inv.promoCode ? '<br><span style="color:var(--success);font-size:11px;">'+escapeHtml(inv.promoCode)+'</span>' : '')+'</td>'
        + '<td class="amt" data-label="Total">'+money(inv.total)+'</td>'
        + '<td data-label="" class="row-actions-cell" style="white-space:nowrap;">'
        + '<button class="btn ghost small" data-view="'+inv.id+'">View</button> '
        + '<button class="btn ghost small" data-delete-invoice="'+inv.id+'" style="color:var(--danger);border-color:var(--danger);">Delete</button>'
        + '</td></tr>';
    }).join('');
    wrap.innerHTML = '<table class="hist"><thead><tr><th>Invoice</th><th>Date</th><th>Customer</th><th>Staff</th><th>Payment</th><th style="text-align:right;">Total</th><th></th></tr></thead><tbody>'+rows+'</tbody></table>';
    wrap.querySelectorAll('[data-view]').forEach(function(b){
      b.addEventListener('click', function(){
        var inv = state.invoices.find(function(i){ return i.id === b.dataset.view; });
        if(inv) openInvoiceOverlay(inv);
      });
    });
    wrap.querySelectorAll('[data-delete-invoice]').forEach(function(b){
      b.addEventListener('click', function(){
        var inv = state.invoices.find(function(i){ return i.id === b.dataset.deleteInvoice; });
        if(!inv) return;
        if(window.confirm('Delete invoice ' + inv.invoiceNo + '? This cannot be undone.')){
          state.invoices = state.invoices.filter(function(i){ return i.id !== inv.id; });
          persistInvoices().then(function(){ showToast('Invoice deleted'); renderHistory(); renderSalesAnalysis(); });
        }
      });
    });
  }
  document.getElementById('histDate').addEventListener('change', renderHistory);
  document.getElementById('histDateClear').addEventListener('click', function(){
    document.getElementById('histDate').value = '';
    renderHistory();
  });

  // ---------- history (admin) — room bookings ----------
  function renderRoomHistory(){
    var wrap = document.getElementById('historyRoomWrap');
    if(!wrap) return;
    var filterDate = document.getElementById('histRoomDate').value;
    var list = state.roomBookings.slice().sort(function(a,b){ return new Date(b.createdAt) - new Date(a.createdAt); });
    if(filterDate){
      list = list.filter(function(b){ return localDateStr(new Date(b.createdAt)) === filterDate; });
    }

    if(state.roomBookings.length === 0){
      wrap.innerHTML = '<div class="empty-state"><p class="big">No room bookings yet</p><p>Bookings staff create will show up here.</p></div>';
      return;
    }
    if(list.length === 0){
      wrap.innerHTML = '<div class="empty-state"><p class="big">No bookings on this date</p><p>Try another date, or clear the search to see everything.</p></div>';
      return;
    }
    var rows = list.map(function(b){
      var d = new Date(b.createdAt).toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'numeric' });
      return '<tr>'
        + '<td data-label="Booking">'+escapeHtml(b.bookingNo)+'</td>'
        + '<td data-label="Date">'+d+'</td>'
        + '<td data-label="Guest">'+escapeHtml(b.guestName)+'<br><span style="color:var(--ink-faint);font-size:12px;">'+escapeHtml(b.guestPhone)+'</span></td>'
        + '<td data-label="Room">'+escapeHtml(b.roomNumber)+' <span style="color:var(--ink-faint);">('+escapeHtml(b.roomType)+')</span></td>'
        + '<td data-label="Payment"><span class="payment-status-badge '+paymentStatusBadgeClass(b.paymentStatus)+'">'+escapeHtml(b.paymentStatus)+'</span></td>'
        + '<td data-label="Status"><span class="room-status-badge '+bookingStatusBadgeClass(b.bookingStatus)+'">'+escapeHtml(b.bookingStatus)+'</span></td>'
        + '<td class="amt" data-label="Total">'+money(b.total)+'</td>'
        + '<td data-label="" class="row-actions-cell" style="white-space:nowrap;">'
        + '<button class="btn ghost small" data-view-room-hist="'+b.id+'">View</button> '
        + '<button class="btn ghost small" data-delete-room-hist="'+b.id+'" style="color:var(--danger);border-color:var(--danger);">Delete</button>'
        + '</td></tr>';
    }).join('');
    wrap.innerHTML = '<table class="hist"><thead><tr><th>Booking</th><th>Date</th><th>Guest</th><th>Room</th><th>Payment</th><th>Status</th><th style="text-align:right;">Total</th><th></th></tr></thead><tbody>'+rows+'</tbody></table>';
    wrap.querySelectorAll('[data-view-room-hist]').forEach(function(b){
      b.addEventListener('click', function(){
        var booking = state.roomBookings.find(function(x){ return x.id === b.dataset.viewRoomHist; });
        if(booking) openRoomInvoiceOverlay(booking);
      });
    });
    wrap.querySelectorAll('[data-delete-room-hist]').forEach(function(b){
      b.addEventListener('click', function(){
        var booking = state.roomBookings.find(function(x){ return x.id === b.dataset.deleteRoomHist; });
        if(!booking) return;
        if(window.confirm('Delete booking ' + booking.bookingNo + ' for ' + booking.guestName + '? This cannot be undone.')){
          state.roomBookings = state.roomBookings.filter(function(x){ return x.id !== booking.id; });
          persistRoomBookings().then(function(){
            showToast('Booking deleted');
            renderRoomHistory();
            renderRoomBookingsList();
            renderRoomDashboard();
          });
        }
      });
    });
  }
  document.getElementById('histRoomDate').addEventListener('change', renderRoomHistory);
  document.getElementById('histRoomDateClear').addEventListener('click', function(){
    document.getElementById('histRoomDate').value = '';
    renderRoomHistory();
  });

  // ---------- history (admin) — banquet hall bookings ----------
  function renderBanquetHistory(){
    var wrap = document.getElementById('historyBanquetWrap');
    if(!wrap) return;
    var filterDate = document.getElementById('histBanquetDate').value;
    var list = state.banquetBookings.slice().sort(function(a,b){ return new Date(b.createdAt) - new Date(a.createdAt); });
    if(filterDate){
      list = list.filter(function(b){ return localDateStr(new Date(b.createdAt)) === filterDate; });
    }

    if(state.banquetBookings.length === 0){
      wrap.innerHTML = '<div class="empty-state"><p class="big">No banquet bookings yet</p><p>Bookings staff create will show up here.</p></div>';
      return;
    }
    if(list.length === 0){
      wrap.innerHTML = '<div class="empty-state"><p class="big">No bookings on this date</p><p>Try another date, or clear the search to see everything.</p></div>';
      return;
    }
    var rows = list.map(function(b){
      var d = new Date(b.createdAt).toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'numeric' });
      return '<tr>'
        + '<td data-label="Booking">'+escapeHtml(b.bookingNo)+'</td>'
        + '<td data-label="Date">'+d+'</td>'
        + '<td data-label="Customer">'+escapeHtml(b.custName)+'<br><span style="color:var(--ink-faint);font-size:12px;">'+escapeHtml(b.custPhone)+'</span></td>'
        + '<td data-label="Hall">'+escapeHtml(b.hallName)+' <span style="color:var(--ink-faint);">('+escapeHtml(b.hallType)+')</span></td>'
        + '<td data-label="Payment"><span class="payment-status-badge '+paymentStatusBadgeClass(b.paymentStatus)+'">'+escapeHtml(b.paymentStatus)+'</span></td>'
        + '<td data-label="Status"><span class="room-status-badge '+hallBookingStatusBadgeClass(b.bookingStatus)+'">'+escapeHtml(b.bookingStatus)+'</span></td>'
        + '<td class="amt" data-label="Total">'+money(b.total)+'</td>'
        + '<td data-label="" class="row-actions-cell" style="white-space:nowrap;">'
        + '<button class="btn ghost small" data-view-banquet-hist="'+b.id+'">View</button> '
        + '<button class="btn ghost small" data-delete-banquet-hist="'+b.id+'" style="color:var(--danger);border-color:var(--danger);">Delete</button>'
        + '</td></tr>';
    }).join('');
    wrap.innerHTML = '<table class="hist"><thead><tr><th>Booking</th><th>Date</th><th>Customer</th><th>Hall</th><th>Payment</th><th>Status</th><th style="text-align:right;">Total</th><th></th></tr></thead><tbody>'+rows+'</tbody></table>';
    wrap.querySelectorAll('[data-view-banquet-hist]').forEach(function(b){
      b.addEventListener('click', function(){
        var booking = state.banquetBookings.find(function(x){ return x.id === b.dataset.viewBanquetHist; });
        if(booking) openBanquetInvoiceOverlay(booking);
      });
    });
    wrap.querySelectorAll('[data-delete-banquet-hist]').forEach(function(b){
      b.addEventListener('click', function(){
        var booking = state.banquetBookings.find(function(x){ return x.id === b.dataset.deleteBanquetHist; });
        if(!booking) return;
        if(window.confirm('Delete booking ' + booking.bookingNo + ' for ' + booking.custName + '? This cannot be undone.')){
          state.banquetBookings = state.banquetBookings.filter(function(x){ return x.id !== booking.id; });
          persistBanquetBookings().then(function(){
            showToast('Booking deleted');
            renderBanquetHistory();
            renderHallBookingsList();
            renderHallDashboard();
          });
        }
      });
    });
  }
  document.getElementById('histBanquetDate').addEventListener('change', renderBanquetHistory);
  document.getElementById('histBanquetDateClear').addEventListener('click', function(){
    document.getElementById('histBanquetDate').value = '';
    renderBanquetHistory();
  });

  // ---------- history (admin) — type switcher ----------
  document.getElementById('histTypeSelect').addEventListener('change', function(){
    var val = this.value;
    document.getElementById('historyTypeRestaurant').style.display = (val === 'restaurant') ? '' : 'none';
    document.getElementById('historyTypeRoom').style.display = (val === 'room') ? '' : 'none';
    document.getElementById('historyTypeBanquet').style.display = (val === 'banquet') ? '' : 'none';
    if(val === 'restaurant') renderHistory();
    else if(val === 'room') renderRoomHistory();
    else renderBanquetHistory();
  });

