"use strict";

  // ---------- custom styled dropdowns (progressively enhances every <select>) ----------
  var csOpenPanel = null, csOpenWrap = null, csOpenSelect = null, csOpenTrigger = null;

  function csClosePanel(){
    if(csOpenPanel && csOpenPanel.parentNode){ csOpenPanel.parentNode.removeChild(csOpenPanel); }
    if(csOpenWrap){ csOpenWrap.classList.remove('cs-open'); }
    csOpenPanel = null; csOpenWrap = null; csOpenSelect = null; csOpenTrigger = null;
  }

  function csSyncTrigger(sel, trigger){
    var label = trigger.querySelector('.cs-trigger-label');
    var opt = sel.options[sel.selectedIndex];
    label.textContent = opt ? opt.textContent : '';
    trigger.classList.toggle('disabled', !!sel.disabled);
  }

  function csPositionPanel(panel, trigger){
    var r = trigger.getBoundingClientRect();
    var vh = window.innerHeight || document.documentElement.clientHeight;
    panel.style.left = r.left + 'px';
    panel.style.width = r.width + 'px';
    var spaceBelow = vh - r.bottom;
    var spaceAbove = r.top;
    if(spaceBelow < 260 && spaceAbove > spaceBelow){
      panel.style.top = 'auto';
      panel.style.bottom = (vh - r.top + 6) + 'px';
      panel.style.maxHeight = Math.min(252, spaceAbove - 16) + 'px';
    } else {
      panel.style.bottom = 'auto';
      panel.style.top = (r.bottom + 6) + 'px';
      panel.style.maxHeight = Math.min(252, spaceBelow - 16) + 'px';
    }
  }

  function csSelectOption(sel, trigger, idx){
    if(sel.selectedIndex !== idx){
      sel.selectedIndex = idx;
      csSyncTrigger(sel, trigger);
      sel.dispatchEvent(new Event('input', { bubbles:true }));
      sel.dispatchEvent(new Event('change', { bubbles:true }));
    }
    csClosePanel();
  }

  function csOpenPanelFor(sel, wrap, trigger){
    if(csOpenSelect === sel){ csClosePanel(); return; }
    csClosePanel();
    if(sel.disabled) return;
    var panel = document.createElement('div');
    panel.className = 'cs-panel';
    Array.prototype.forEach.call(sel.options, function(opt, idx){
      var row = document.createElement('div');
      row.className = 'cs-option' + (opt.selected ? ' selected' : '') + (opt.disabled ? ' disabled' : '');
      row.textContent = opt.textContent;
      row.addEventListener('mouseenter', function(){
        var actives = panel.querySelectorAll('.cs-option.active');
        Array.prototype.forEach.call(actives, function(a){ a.classList.remove('active'); });
        row.classList.add('active');
      });
      row.addEventListener('click', function(e){
        e.stopPropagation();
        if(opt.disabled) return;
        csSelectOption(sel, trigger, idx);
      });
      panel.appendChild(row);
    });
    document.body.appendChild(panel);
    csPositionPanel(panel, trigger);
    wrap.classList.add('cs-open');
    csOpenPanel = panel; csOpenWrap = wrap; csOpenSelect = sel; csOpenTrigger = trigger;
    requestAnimationFrame(function(){ panel.classList.add('show'); });
    var selectedRow = panel.querySelector('.cs-option.selected');
    if(selectedRow){ selectedRow.classList.add('active'); selectedRow.scrollIntoView({ block:'nearest' }); }
  }

  function csMoveActive(dir){
    if(!csOpenPanel) return;
    var opts = Array.prototype.slice.call(csOpenPanel.querySelectorAll('.cs-option:not(.disabled)'));
    if(!opts.length) return;
    var curIdx = -1;
    opts.forEach(function(o, i){ if(o.classList.contains('active')) curIdx = i; });
    var next = curIdx === -1 ? 0 : Math.max(0, Math.min(opts.length - 1, curIdx + dir));
    opts.forEach(function(o){ o.classList.remove('active'); });
    opts[next].classList.add('active');
    opts[next].scrollIntoView({ block:'nearest' });
  }

  function csEnhanceOne(sel){
    if(sel.dataset.csEnhanced || sel.multiple) return;
    sel.dataset.csEnhanced = '1';
    sel.classList.add('cs-native');
    sel.tabIndex = -1;

    var wrap = document.createElement('div');
    wrap.className = 'cs-wrap';
    sel.parentNode.insertBefore(wrap, sel);
    wrap.appendChild(sel);

    var trigger = document.createElement('div');
    trigger.className = 'cs-trigger';
    trigger.tabIndex = 0;
    trigger.innerHTML = '<span class="cs-trigger-label"></span><span class="cs-arrow"></span>';
    wrap.appendChild(trigger);
    csSyncTrigger(sel, trigger);

    trigger.addEventListener('click', function(e){
      e.stopPropagation();
      csOpenPanelFor(sel, wrap, trigger);
    });
    trigger.addEventListener('keydown', function(e){
      if(e.key === 'Enter' || e.key === ' '){
        e.preventDefault();
        if(csOpenSelect === sel){
          var active = csOpenPanel.querySelector('.cs-option.active');
          if(active) active.click();
        } else {
          csOpenPanelFor(sel, wrap, trigger);
        }
      } else if(e.key === 'Escape'){
        csClosePanel();
      } else if(e.key === 'ArrowDown'){
        e.preventDefault();
        if(csOpenSelect === sel) csMoveActive(1); else csOpenPanelFor(sel, wrap, trigger);
      } else if(e.key === 'ArrowUp'){
        e.preventDefault();
        if(csOpenSelect === sel) csMoveActive(-1);
      }
    });

    // Native <select> stays the source of truth for the rest of the app's code
    // (which reads/sets .value directly) — poll lightly to catch programmatic
    // changes (e.g. form resets) and keep the custom trigger label in sync.
    var lastIndex = sel.selectedIndex, lastDisabled = sel.disabled, lastCount = sel.options.length;
    setInterval(function(){
      if(sel.selectedIndex !== lastIndex || sel.disabled !== lastDisabled || sel.options.length !== lastCount){
        lastIndex = sel.selectedIndex; lastDisabled = sel.disabled; lastCount = sel.options.length;
        csSyncTrigger(sel, trigger);
        if(csOpenSelect === sel) csClosePanel();
      }
    }, 300);
  }

  function csEnhanceAll(root){
    Array.prototype.forEach.call((root || document).querySelectorAll('select:not(.cs-native)'), csEnhanceOne);
  }

  document.addEventListener('click', csClosePanel);
  window.addEventListener('scroll', csClosePanel, true);
  window.addEventListener('resize', csClosePanel);

  new MutationObserver(function(mutations){
    var needsScan = false;
    mutations.forEach(function(m){
      Array.prototype.forEach.call(m.addedNodes || [], function(n){
        if(n.nodeType === 1 && (n.tagName === 'SELECT' || (n.querySelector && n.querySelector('select')))) needsScan = true;
      });
    });
    if(needsScan) csEnhanceAll(document);
  }).observe(document.body, { childList:true, subtree:true });

  csEnhanceAll(document);

