/* SSAI live-map place search — shared across every live GIBS map.
   Instant bundled gazetteer (cities + countries + US states + regions) ranked by importance,
   with a live OpenStreetMap (Nominatim) fallback for anything not bundled.
   Usage (inside a module IIFE that owns lon/lat/zoom/clamp/scheduleDraw):
     SSAIGeoSearch(root, { flyTo: function(lon,lat,zoom){ ... } }); */
(function(){
  if (window.SSAIGeoSearch) return;

  /* ---- one-time CSS (orbit-tracker frosted tokens) ---- */
  function injectCSS(){
    if (document.getElementById('ssai-geosearch-css')) return;
    var s = document.createElement('style');
    s.id = 'ssai-geosearch-css';
    s.textContent = [
      ".mb-geosearch{position:absolute;top:14px;left:50%;transform:translateX(-50%);z-index:40;width:min(320px,56%);font-family:'Inter',system-ui,sans-serif}",
      ".mb-geosearch-bar{display:flex;align-items:center;gap:8px;height:36px;padding:0 12px;border-radius:10px;background:rgba(8,6,28,0.62);border:1px solid rgba(166,171,230,0.20);backdrop-filter:blur(13px);-webkit-backdrop-filter:blur(13px);box-shadow:0 10px 30px -16px rgba(0,0,0,0.8);transition:border-color .18s}",
      ".mb-geosearch.is-focus .mb-geosearch-bar{border-color:var(--accent,#3cc8ff)}",
      ".mb-geosearch-ic{width:14px;height:14px;flex:0 0 auto;color:#a6abe6;opacity:.85}",
      ".mb-geosearch-input{flex:1;min-width:0;background:none;border:0;outline:0;color:#f4f5ff;font-size:12.5px;letter-spacing:.01em;font-family:inherit}",
      ".mb-geosearch-input::placeholder{color:#a6abe6;opacity:.8;font-size:11.5px;letter-spacing:.04em}",
      ".mb-geosearch-x{flex:0 0 auto;width:16px;height:16px;border:0;background:none;color:#a6abe6;cursor:pointer;font-size:14px;line-height:1;padding:0;display:none}",
      ".mb-geosearch.has-text .mb-geosearch-x{display:block}",
      ".mb-geosearch-list{position:absolute;top:42px;left:0;right:0;max-height:268px;overflow-y:auto;border-radius:10px;background:rgba(8,6,28,0.72);border:1px solid rgba(166,171,230,0.18);backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px);box-shadow:0 16px 40px -18px rgba(0,0,0,0.85);display:none;padding:4px}",
      ".mb-geosearch-list.open{display:block}",
      ".mb-geosearch-item{display:flex;align-items:baseline;gap:8px;padding:7px 9px;border-radius:7px;cursor:pointer;white-space:nowrap}",
      ".mb-geosearch-item.on,.mb-geosearch-item:hover{background:rgba(var(--accent-rgb,60,200,255),0.16)}",
      ".mb-geosearch-nm{color:#f4f5ff;font-size:12.5px;overflow:hidden;text-overflow:ellipsis}",
      ".mb-geosearch-ct{color:#a6abe6;font-size:10.5px;margin-left:auto;letter-spacing:.04em;flex:0 0 auto}",
      ".mb-geosearch-tag{font-size:8px;letter-spacing:.14em;text-transform:uppercase;color:#050314;background:var(--accent,#3cc8ff);border-radius:4px;padding:2px 5px;flex:0 0 auto;font-weight:700;align-self:center}",
      ".mb-geosearch-tag.k1{background:#8ad}.mb-geosearch-tag.k2{background:#caa}.mb-geosearch-tag.k3{background:#9b8fd6}",
      ".mb-geosearch-empty{padding:9px;color:#a6abe6;font-size:11px;letter-spacing:.04em}",
      "@media (max-width:560px){.mb-geosearch{width:72%}}"
    ].join('');
    document.head.appendChild(s);
  }

  function fold(s){ return (s||'').normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase(); }

  /* shared, page-level gazetteer load (one fetch even if several maps exist) */
  var loadPromise = null;
  function loadPlaces(){
    if (loadPromise) return loadPromise;
    loadPromise = fetch('../assets/data/places.json').then(function(r){ return r.json(); }).then(function(j){
      var p = j.p || [];
      // p[i] = [name, lat, lon, context, zoom, kind]; build a folded search key once
      var idx = new Array(p.length);
      for (var i=0;i<p.length;i++) idx[i] = fold(p[i][0]);
      return { p:p, idx:idx };
    }).catch(function(){ return { p:[], idx:[] }; });
    return loadPromise;
  }

  var TAG = ['City','Country','State','Region'];

  window.SSAIGeoSearch = function(root, opts){
    injectCSS();
    var wrap = root.querySelector('.mb-geosearch'); if (!wrap) return;
    var input = wrap.querySelector('.mb-geosearch-input');
    var list = wrap.querySelector('.mb-geosearch-list');
    var clearBtn = wrap.querySelector('.mb-geosearch-x');
    if (!input || !list) return;
    var DB = null, results = [], active = -1, nomTimer = null, nomSeq = 0;

    loadPlaces().then(function(db){ DB = db; if (input.value) run(input.value); });

    function close(){ list.classList.remove('open'); list.innerHTML=''; results=[]; active=-1; clearTimeout(nomTimer); nomSeq++; }
    function pick(r){
      if (!r) return;
      close(); input.blur();
      try { opts.flyTo(r[2], r[1], r[4]); } catch(e){}
    }
    function render(){
      if (!results.length){ list.innerHTML='<div class="mb-geosearch-empty">No matches — try a city or country.</div>'; list.classList.add('open'); return; }
      var h='';
      for (var i=0;i<results.length;i++){
        var r=results[i];
        h += '<div class="mb-geosearch-item'+(i===active?' on':'')+'" data-i="'+i+'">'
          + '<span class="mb-geosearch-tag k'+(r[5]||0)+'">'+TAG[r[5]||0]+'</span>'
          + '<span class="mb-geosearch-nm">'+esc(r[0])+'</span>'
          + (r[3]&&r[3]!=='Country'&&r[3]!=='Region'&&r[3]!=='US state'?'<span class="mb-geosearch-ct">'+esc(r[3])+'</span>':'')
          + '</div>';
      }
      list.innerHTML=h; list.classList.add('open');
    }
    function esc(s){ return String(s).replace(/[&<>]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;'}[c];}); }

    function run(q){
      q = fold(q.trim());
      if (!q){ close(); return; }
      var pre=[], sub=[], i, n, lim=9;
      if (DB){
        for (i=0;i<DB.idx.length && pre.length<lim;i++){ if (DB.idx[i].indexOf(q)===0) pre.push(DB.p[i]); }
        if (pre.length<lim){ for (i=0;i<DB.idx.length && (pre.length+sub.length)<lim;i++){ n=DB.idx[i]; if (n.indexOf(q)>0) sub.push(DB.p[i]); } }
      }
      results = pre.concat(sub).slice(0,lim);
      active = results.length?0:-1;
      render();
      // live geocoder fallback for anything not well covered locally
      if (q.length>=3 && results.length<4) nominatim(input.value.trim());
    }

    function nominatim(q){
      clearTimeout(nomTimer);
      nomTimer = setTimeout(function(){
        var seq = ++nomSeq;
        fetch('https://nominatim.openstreetmap.org/search?format=jsonv2&limit=5&q='+encodeURIComponent(q))
          .then(function(r){ return r.json(); })
          .then(function(arr){
            if (seq!==nomSeq || !arr || !arr.length) return;
            var have = {}; results.forEach(function(r){ have[fold(r[0])]=1; });
            for (var i=0;i<arr.length;i++){
              var a=arr[i], nm=(a.display_name||'').split(',')[0];
              if (!nm || have[fold(nm)]) continue;
              var z=8, bb=a.boundingbox;
              if (bb){ var span=Math.max(Math.abs(+bb[1]-+bb[0]), Math.abs(+bb[3]-+bb[2])); z = span>40?2:span>15?3:span>5?4:span>1.5?6:span>0.4?8:10; }
              var at=(a.addresstype||a.type||''), k=0;
              if (at==='country') k=1; else if (at==='state'||at==='province'||at==='region') k=2; else if (at==='continent') k=3;
              results.push([nm, +a.lat, +a.lon, (a.display_name||'').split(',').slice(1,3).join(',').trim(), z, k]);
              have[fold(nm)]=1;
            }
            results = results.slice(0,9); if (active<0 && results.length) active=0;
            render();
          }).catch(function(){});
      }, 380);
    }

    input.addEventListener('input', function(){ wrap.classList.toggle('has-text', !!input.value); run(input.value); });
    input.addEventListener('focus', function(){ wrap.classList.add('is-focus'); if (results.length) list.classList.add('open'); });
    input.addEventListener('blur', function(){ wrap.classList.remove('is-focus'); setTimeout(close, 160); });
    input.addEventListener('keydown', function(e){
      if (e.key==='ArrowDown'){ e.preventDefault(); active=Math.min(active+1, results.length-1); render(); }
      else if (e.key==='ArrowUp'){ e.preventDefault(); active=Math.max(active-1, 0); render(); }
      else if (e.key==='Enter'){ e.preventDefault(); if (results[active]) pick(results[active]); }
      else if (e.key==='Escape'){ input.value=''; wrap.classList.remove('has-text'); close(); input.blur(); }
    });
    list.addEventListener('mousedown', function(e){
      var it=e.target.closest('.mb-geosearch-item'); if (!it) return;
      e.preventDefault(); pick(results[+it.getAttribute('data-i')]);
    });
    if (clearBtn) clearBtn.addEventListener('click', function(){ input.value=''; wrap.classList.remove('has-text'); close(); input.focus(); });
  };
})();
