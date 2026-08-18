"use strict";

  // ---------- promo codes (admin manages, staff apply during billing) ----------
  function promoStatus(promo){
    if(promo.expiryDate){
      var today = new Date(); today.setHours(0,0,0,0);
      var exp = new Date(promo.expiryDate + 'T23:59:59');
      if(exp < today){ return 'Expired'; }
    }
    if(promo.maxUses != null && promo.usedCount >= promo.maxUses){ return 'Limit reached'; }
    return 'Active';
  }
  function isPromoUsable(promo){ return promoStatus(promo) === 'Active'; }

  function renderPromoList(){
    var wrap = document.getElementById('promoListWrap');
    if(!wrap) return;
    if(state.promoCodes.length === 0){
      wrap.innerHTML = '<div class="empty-state"><p class="big">No promo codes yet</p><p>Add your first code above.</p></div>';
      return;
    }
    var rows = state.promoCodes.map(function(p){
      var discountLabel = p.discountType === 'percent' ? (p.discountValue + '% off') : (money(p.discountValue) + ' off');
      var expiryLabel = p.expiryDate ? new Date(p.expiryDate + 'T00:00:00').toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'numeric' }) : 'No expiry';
      var usesLabel = (p.usedCount || 0) + ' / ' + (p.maxUses != null ? p.maxUses : '∞');
      var status = promoStatus(p);
      var statusClass = status === 'Active' ? 'active' : 'inactive';
      return '<tr>'
        + '<td class="code" data-label="Code">'+escapeHtml(p.code)+'</td>'
        + '<td data-label="Discount">'+escapeHtml(discountLabel)+'</td>'
        + '<td data-label="Expiry">'+escapeHtml(expiryLabel)+'</td>'
        + '<td data-label="Uses">'+escapeHtml(usesLabel)+'</td>'
        + '<td data-label="Status"><span class="promo-status '+statusClass+'">'+escapeHtml(status)+'</span></td>'
        + '<td data-label="" class="row-actions-cell"><button class="btn ghost small" data-delete-promo="'+p.id+'" style="color:var(--danger);border-color:var(--danger);">Delete</button></td>'
        + '</tr>';
    }).join('');
    wrap.innerHTML = '<table class="promo"><thead><tr><th>Code</th><th>Discount</th><th>Expiry</th><th>Uses</th><th>Status</th><th></th></tr></thead><tbody>'+rows+'</tbody></table>';
    wrap.querySelectorAll('[data-delete-promo]').forEach(function(btn){
      btn.addEventListener('click', function(){
        var p = state.promoCodes.find(function(x){ return x.id === btn.dataset.deletePromo; });
        if(p && window.confirm('Delete promo code "'+p.code+'"?')){
          state.promoCodes = state.promoCodes.filter(function(x){ return x.id !== p.id; });
          persistPromoCodes().then(function(){ showToast('Promo code deleted'); renderPromoList(); });
        }
      });
    });
  }
  document.getElementById('addPromoBtn').addEventListener('click', function(){
    var code = document.getElementById('promoCode').value.trim().toUpperCase();
    var type = document.getElementById('promoType').value;
    var value = parseFloat(document.getElementById('promoValue').value);
    var expiry = document.getElementById('promoExpiry').value || null;
    var maxUsesRaw = document.getElementById('promoMaxUses').value;
    var maxUses = maxUsesRaw ? parseInt(maxUsesRaw, 10) : null;
    var err = document.getElementById('promoAddError');

    if(!code){ err.textContent = 'Enter a code.'; err.classList.add('show'); return; }
    var exists = state.promoCodes.some(function(p){ return p.code === code; });
    if(exists){ err.textContent = 'That code already exists.'; err.classList.add('show'); return; }
    if(isNaN(value) || value <= 0){ err.textContent = 'Enter a valid discount value.'; err.classList.add('show'); return; }
    if(type === 'percent' && value > 100){ err.textContent = 'Percentage can\'t be more than 100.'; err.classList.add('show'); return; }
    err.classList.remove('show');

    state.promoCodes.push({
      id: uid(), code: code, discountType: type, discountValue: value,
      expiryDate: expiry, maxUses: maxUses, usedCount: 0, createdAt: new Date().toISOString()
    });
    persistPromoCodes().then(function(){
      showToast('Promo code added');
      document.getElementById('promoCode').value = '';
      document.getElementById('promoValue').value = '';
      document.getElementById('promoExpiry').value = '';
      document.getElementById('promoMaxUses').value = '';
      renderPromoList();
    });
  });

