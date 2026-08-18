"use strict";

  // ---------- sales analysis / dashboard (admin) ----------
  function invoicesOnDate(dateStr){
    return state.invoices.filter(function(inv){ return localDateStr(new Date(inv.date)) === dateStr; });
  }
  function invoicesInMonth(ym){
    return state.invoices.filter(function(inv){
      var d = new Date(inv.date);
      return (d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0')) === ym;
    });
  }
  function sumSale(list){ return list.reduce(function(sum, inv){ return sum + (Number(inv.total) || 0); }, 0); }
  // Cancelled room/banquet bookings never happened as revenue, so every
  // period filter below excludes them. (Restaurant invoices have no
  // bookingStatus field, so this check is simply a no-op for that list.)
  function activeBookings(list){ return list.filter(function(b){ return b.bookingStatus !== 'Cancelled'; }); }
  function roomBookingsOnDate(dateStr){
    return activeBookings(state.roomBookings).filter(function(b){ return localDateStr(new Date(b.createdAt)) === dateStr; });
  }
  function roomBookingsInMonth(ym){
    return activeBookings(state.roomBookings).filter(function(b){
      var d = new Date(b.createdAt);
      return (d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0')) === ym;
    });
  }
  function banquetBookingsOnDate(dateStr){
    return activeBookings(state.banquetBookings).filter(function(b){ return localDateStr(new Date(b.createdAt)) === dateStr; });
  }
  function banquetBookingsInMonth(ym){
    return activeBookings(state.banquetBookings).filter(function(b){
      var d = new Date(b.createdAt);
      return (d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0')) === ym;
    });
  }

  // Splits a money value into currency / whole / decimal parts so the two can
  // be styled differently (big bold whole number, smaller faded currency+paise).
  function moneyPartsHtml(n){
    n = Math.round((n + Number.EPSILON) * 100) / 100;
    var fixed = n.toFixed(2);
    var dotIdx = fixed.indexOf('.');
    var intStr = fixed.slice(0, dotIdx);
    var decStr = fixed.slice(dotIdx);
    var grouped = Number(intStr).toLocaleString('en-IN');
    return '<span class="amt-cur">'+escapeHtml(state.restaurant.currency)+'</span>'
      + '<span class="amt-int">'+escapeHtml(grouped)+'</span>'
      + '<span class="amt-dec">'+escapeHtml(decStr)+'</span>';
  }

  var DASH_ICONS = {
    sun: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>',
    calendar: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>',
    trend: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 17 9 11 13 15 21 7"/><polyline points="14 7 21 7 21 14"/></svg>',
    receipt: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M6 2h12a1 1 0 0 1 1 1v18l-3-2-2 2-2-2-2 2-2-2-3 2V3a1 1 0 0 1 1-1Z"/><path d="M9 8h6M9 12h6M9 16h3"/></svg>',
    plate: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><path d="M7 2v7a1.5 1.5 0 0 0 1.5 1.5h0A1.5 1.5 0 0 0 10 9V2"/><path d="M8.5 10.5V22"/><path d="M17 2c-1.7 0-3 1.8-3 5s1.3 5 3 5v10"/></svg>',
    bed: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 4v16"/><path d="M2 8h18a2 2 0 0 1 2 2v10"/><path d="M2 17h20"/><path d="M6 8v9"/></svg>',
    hall: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 21h18"/><path d="M5 21V9l7-5 7 5v12"/><path d="M9 21v-6h6v6"/></svg>'
  };
  // Built at render time (not cached) so it always reflects the restaurant's
  // current currency symbol, even if Admin changes it later in Setup.
  function coinIconHtml(){
    return '<svg viewBox="0 0 24 24" width="16" height="16"><text x="12" y="17" font-size="15" text-anchor="middle" fill="currentColor" font-family="Inter, sans-serif" font-weight="600">'+escapeHtml(state.restaurant.currency || '$')+'</text></svg>';
  }
  function statCardHtml(label, valueHtml, sub, iconHtml, accent){
    return '<div class="qs-card qs-accent-'+accent+'">'
      + '<div class="qs-top"><span class="qs-icon qs-accent-'+accent+'">'+iconHtml+'</span><p class="qs-label">'+escapeHtml(label)+'</p></div>'
      + '<p class="qs-value">'+valueHtml+'</p>'
      + (sub ? '<p class="qs-sub">'+escapeHtml(sub)+'</p>' : '')
      + '</div>';
  }

  function renderQuickStats(){
    var wrap = document.getElementById('quickStats');
    if(!wrap) return;
    var todayStr = localDateStr(new Date());
    var monthStr = todayStr.slice(0,7);

    var todayList = invoicesOnDate(todayStr).concat(roomBookingsOnDate(todayStr), banquetBookingsOnDate(todayStr));
    var monthList = invoicesInMonth(monthStr).concat(roomBookingsInMonth(monthStr), banquetBookingsInMonth(monthStr));
    var allList = state.invoices.concat(activeBookings(state.roomBookings), activeBookings(state.banquetBookings));

    wrap.innerHTML =
      statCardHtml('Today', moneyPartsHtml(sumSale(todayList)), todayList.length+' order'+(todayList.length===1?'':'s'), DASH_ICONS.sun, 'gold')
      + statCardHtml('This month', moneyPartsHtml(sumSale(monthList)), monthList.length+' order'+(monthList.length===1?'':'s'), DASH_ICONS.calendar, 'olive')
      + statCardHtml('All time', moneyPartsHtml(sumSale(allList)), allList.length+' order'+(allList.length===1?'':'s'), DASH_ICONS.trend, 'brick');
  }

  function renderMonthlyChart(){
    var wrap = document.getElementById('dashMonthlyChart');
    if(!wrap) return;
    var year = new Date().getFullYear();
    var currentMonth = new Date().getMonth();
    var monthNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    var totals = new Array(12).fill(0);
    function addToMonth(dateVal, amount){
      var d = new Date(dateVal);
      if(d.getFullYear() === year) totals[d.getMonth()] += (Number(amount) || 0);
    }
    state.invoices.forEach(function(inv){ addToMonth(inv.date, inv.total); });
    activeBookings(state.roomBookings).forEach(function(b){ addToMonth(b.createdAt, b.total); });
    activeBookings(state.banquetBookings).forEach(function(b){ addToMonth(b.createdAt, b.total); });
    var maxVal = totals.reduce(function(m,v){ return Math.max(m,v); }, 0) || 1;
    wrap.innerHTML = '<div class="dash-bar-chart">' + totals.map(function(v, i){
      var pct = Math.max(v > 0 ? 4 : 1.5, Math.round((v / maxVal) * 100));
      return '<div class="dash-bar-col'+(i===currentMonth?' is-current':'')+'">'
        + '<div class="dash-bar" style="height:'+pct+'%;" title="'+monthNames[i]+' '+year+': '+escapeHtml(state.restaurant.currency)+v.toLocaleString('en-IN', {maximumFractionDigits:0})+'"></div>'
        + '<span class="dash-bar-label">'+monthNames[i]+'</span>'
        + '</div>';
    }).join('') + '</div>';
  }

  function dashCatCardHtml(label, sub, valueHtml, iconHtml, accent){
    return '<div class="dash-cat-card">'
      + '<span class="dash-cat-icon qs-accent-'+accent+'">'+iconHtml+'</span>'
      + '<div class="dash-cat-body"><p class="dash-cat-label">'+escapeHtml(label)+'</p><p class="dash-cat-sub">'+escapeHtml(sub)+'</p></div>'
      + '<div class="dash-cat-value">'+valueHtml+'</div>'
      + '</div>';
  }

  function renderDashCategoryCards(list, roomList, banquetList){
    var wrap = document.getElementById('dashCategoryStats');
    if(!wrap) return;
    wrap.innerHTML =
      dashCatCardHtml('Restaurant', list.length+' order'+(list.length===1?'':'s'), money(sumSale(list)), DASH_ICONS.plate, 'brick')
      + dashCatCardHtml('Rooms', roomList.length+' booking'+(roomList.length===1?'':'s'), money(sumSale(roomList)), DASH_ICONS.bed, 'gold')
      + dashCatCardHtml('Banquet hall', banquetList.length+' booking'+(banquetList.length===1?'':'s'), money(sumSale(banquetList)), DASH_ICONS.hall, 'olive');
  }

  function renderRecentTransactions(){
    var wrap = document.getElementById('dashRecentTransactions');
    if(!wrap) return;
    var rows = []
      .concat(state.invoices.map(function(inv){ return { ref: inv.invoiceNo, guest: inv.customerName, origin: 'Dining', date: inv.date, total: inv.total }; }))
      .concat(activeBookings(state.roomBookings).map(function(b){ return { ref: b.bookingNo, guest: b.guestName, origin: 'Rooms', date: b.createdAt, total: b.total }; }))
      .concat(activeBookings(state.banquetBookings).map(function(b){ return { ref: b.bookingNo, guest: b.guestName, origin: 'Banquet', date: b.createdAt, total: b.total }; }));
    rows.sort(function(a,b){ return new Date(b.date) - new Date(a.date); });
    rows = rows.slice(0, 8);
    if(rows.length === 0){
      wrap.innerHTML = '<div class="empty-state"><p class="big">Nothing yet</p><p>Invoices and bookings will show up here as they come in.</p></div>';
      return;
    }
    var todayStr = localDateStr(new Date());
    var trs = rows.map(function(r){
      var d = new Date(r.date);
      var isToday = localDateStr(d) === todayStr;
      var timeStr = isToday
        ? d.toLocaleTimeString('en-IN', { hour:'numeric', minute:'2-digit' })
        : d.toLocaleDateString('en-IN', { day:'2-digit', month:'short' });
      return '<tr>'
        + '<td data-label="Reference">'+escapeHtml(r.ref || '—')+'</td>'
        + '<td data-label="Guest">'+escapeHtml(r.guest || '—')+'</td>'
        + '<td data-label="Origin"><span class="dash-origin-pill">'+escapeHtml(r.origin)+'</span></td>'
        + '<td data-label="Time">'+timeStr+'</td>'
        + '<td class="amt" data-label="Amount">'+money(r.total)+'</td>'
        + '</tr>';
    }).join('');
    wrap.innerHTML = '<table class="hist"><thead><tr><th>Reference</th><th>Guest</th><th>Origin</th><th>Time</th><th style="text-align:right;">Amount</th></tr></thead><tbody>'+trs+'</tbody></table>';
  }


  var analysisMode = 'month'; // 'day' | 'month' | 'all'
  function renderSalesAnalysis(){
    renderQuickStats();
    renderMonthlyChart();
    renderRecentTransactions();

    var list, roomList, banquetList, periodLabel;
    if(analysisMode === 'day'){
      var dayInput = document.getElementById('analysisDay');
      if(!dayInput.value){ dayInput.value = localDateStr(new Date()); }
      list = invoicesOnDate(dayInput.value);
      roomList = roomBookingsOnDate(dayInput.value);
      banquetList = banquetBookingsOnDate(dayInput.value);
      periodLabel = new Date(dayInput.value + 'T00:00:00').toLocaleDateString('en-IN', { day:'numeric', month:'long', year:'numeric' });
    } else if(analysisMode === 'month'){
      var monthInput = document.getElementById('analysisMonth');
      if(!monthInput.value){ monthInput.value = localDateStr(new Date()).slice(0,7); }
      list = invoicesInMonth(monthInput.value);
      roomList = roomBookingsInMonth(monthInput.value);
      banquetList = banquetBookingsInMonth(monthInput.value);
      periodLabel = new Date(monthInput.value + '-01T00:00:00').toLocaleDateString('en-IN', { month:'long', year:'numeric' });
    } else {
      list = state.invoices;
      roomList = activeBookings(state.roomBookings);
      banquetList = activeBookings(state.banquetBookings);
      periodLabel = 'All time';
    }

    var totalSale = sumSale(list);
    var totalOrders = list.length;
    renderDashCategoryCards(list, roomList, banquetList);

    // aggregate dish-wise qty and revenue
    var dishMap = {};
    list.forEach(function(inv){
      (inv.items || []).forEach(function(it){
        if(!dishMap[it.name]) dishMap[it.name] = { name: it.name, qty: 0, revenue: 0 };
        dishMap[it.name].qty += Number(it.qty) || 0;
        dishMap[it.name].revenue += Number(it.amount) || (Number(it.price)||0) * (Number(it.qty)||0);
      });
    });
    var dishes = Object.keys(dishMap).map(function(k){ return dishMap[k]; });
    dishes.sort(function(a,b){ return b.qty - a.qty; });
    var totalDishesSold = dishes.reduce(function(s,d){ return s + d.qty; }, 0);

    var statsEl = document.getElementById('analysisStatsRestaurant');
    statsEl.innerHTML =
      statCardHtml('Total sale — '+periodLabel, moneyPartsHtml(totalSale), null, coinIconHtml(), 'brick')
      + statCardHtml('Orders', String(totalOrders), null, DASH_ICONS.receipt, 'gold')
      + statCardHtml('Dishes sold', String(totalDishesSold), null, DASH_ICONS.plate, 'olive');

    var roomSale = sumSale(roomList);
    var roomNightsTotal = roomList.reduce(function(s,b){ return s + (Number(b.nights) || 0); }, 0);
    var roomStatsEl = document.getElementById('analysisStatsRoom');
    if(roomStatsEl){
      roomStatsEl.innerHTML =
        statCardHtml('Total sale — '+periodLabel, moneyPartsHtml(roomSale), null, coinIconHtml(), 'olive')
        + statCardHtml('Bookings', String(roomList.length), null, DASH_ICONS.receipt, 'brick')
        + statCardHtml('Nights booked', String(roomNightsTotal), null, DASH_ICONS.bed, 'gold');
    }

    var banquetSale = sumSale(banquetList);
    var banquetDaysTotal = banquetList.reduce(function(s,b){ return s + (Number(b.days) || 0); }, 0);
    var banquetStatsEl = document.getElementById('analysisStatsBanquet');
    if(banquetStatsEl){
      banquetStatsEl.innerHTML =
        statCardHtml('Total sale — '+periodLabel, moneyPartsHtml(banquetSale), null, coinIconHtml(), 'gold')
        + statCardHtml('Bookings', String(banquetList.length), null, DASH_ICONS.receipt, 'olive')
        + statCardHtml('Days booked', String(banquetDaysTotal), null, DASH_ICONS.hall, 'brick');
    }

    var topEl = document.getElementById('analysisTopDish');
    if(dishes.length === 0){
      topEl.innerHTML = '<div class="empty-state"><p class="big">No orders yet</p><p>Nothing sold in this period.</p></div>';
    } else {
      var top = dishes[0];
      topEl.innerHTML =
        '<div class="top-dish-card">'
        + '<p class="td-eyebrow">Top dish</p>'
        + '<p class="td-name">'+escapeHtml(top.name)+'</p>'
        + '<p class="td-meta">'+top.qty+' sold · '+money(top.revenue)+' in revenue</p>'
        + '</div>';
    }

    var tableEl = document.getElementById('analysisDishTable');
    if(dishes.length === 0){
      tableEl.innerHTML = '';
    } else {
      var maxRevenue = dishes.reduce(function(m,d){ return Math.max(m, d.revenue); }, 0) || 1;
      var rows = dishes.map(function(d, i){
        var pct = Math.max(4, Math.round((d.revenue / maxRevenue) * 100));
        return '<tr'+(i===0 ? ' class="top-row"' : '')+'>'
          + '<td style="width:34px;"><span class="rank-badge'+(i===0?' first':'')+'">'+(i+1)+'</span></td>'
          + '<td class="dish-row-bar"><span class="dish-bar-fill" style="width:'+pct+'%;"></span>'+escapeHtml(d.name)+(i===0 ? ' <span class="top-badge">MOST ORDERED</span>' : '')+'</td>'
          + '<td class="amt">'+d.qty+'</td>'
          + '<td class="amt">'+money(d.revenue)+'</td>'
          + '</tr>';
      }).join('');
      tableEl.innerHTML = '<table class="hist"><thead><tr><th></th><th>Dish</th><th style="text-align:right;">Qty sold</th><th style="text-align:right;">Revenue</th></tr></thead><tbody>'+rows+'</tbody></table>';
    }
  }
  function setAnalysisMode(mode){
    analysisMode = mode;
    document.querySelectorAll('#analysisModeBtns .am-btn').forEach(function(b){ b.classList.toggle('active', b.dataset.mode === mode); });
    document.getElementById('analysisDayField').style.display = mode === 'day' ? '' : 'none';
    document.getElementById('analysisMonthField').style.display = mode === 'month' ? '' : 'none';
    renderSalesAnalysis();
  }
  document.getElementById('analysisModeBtns').addEventListener('click', function(e){
    var btn = e.target.closest('.am-btn');
    if(!btn) return;
    setAnalysisMode(btn.dataset.mode);
  });
  document.getElementById('analysisDay').addEventListener('change', renderSalesAnalysis);
  document.getElementById('analysisMonth').addEventListener('change', renderSalesAnalysis);
  document.getElementById('analysisMonthField').style.display = ''; // month is the default mode
  document.getElementById('analysisDayField').style.display = 'none';
  document.getElementById('analysisTypeSelect').addEventListener('change', function(){
    var val = this.value;
    document.getElementById('analysisTypeRestaurant').style.display = (val === 'restaurant') ? '' : 'none';
    document.getElementById('analysisTypeRoom').style.display = (val === 'room') ? '' : 'none';
    document.getElementById('analysisTypeBanquet').style.display = (val === 'banquet') ? '' : 'none';
  });

