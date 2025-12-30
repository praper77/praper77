// 管理员数据管理（含编辑面板 + 取点地图）
// 关键修复：取点地图使用与地图页一致的高德 A/B/HTTP 源，显示后 invalidateSize
(function(){
  const LS_KEY = 'aed_admin_data';
  let data = [];
  let editingIndex = -1;

  const tbody = document.getElementById('admin-table-body');
  const tableNote = document.getElementById('table-note');
  const panel = document.getElementById('editorPanel');
  const titleEl = document.getElementById('editorTitle');

  const f = {
    id: document.getElementById('f-id'),
    name: document.getElementById('f-name'),
    building: document.getElementById('f-building'),
    floor: document.getElementById('f-floor'),
    room: document.getElementById('f-room'),
    status: document.getElementById('f-status'),
    lat: document.getElementById('f-lat'),
    lng: document.getElementById('f-lng'),
    open: document.getElementById('f-open'),
    inspect: document.getElementById('f-inspect'),
    elevator: document.getElementById('f-elevator'),
    ramp: document.getElementById('f-ramp'),
    notes: document.getElementById('f-notes'),
    photos: document.getElementById('f-photos'),
    // 新增：点位价值字段（存在则读写；不存在则忽略）
    used: document.getElementById('f-used'),           // 使用次数（Number）
    rescued: document.getElementById('f-rescued'),     // 救助人数（Number）
    last: document.getElementById('f-last')            // 最近一次使用（YYYY-MM-DD）
  };

  function uid(){ return 'aed_' + Date.now() + '_' + Math.floor(Math.random()*1000); }
  function toFixed6(n){ const x = Number(n); return isFinite(x) ? Number(x.toFixed(6)) : ''; }
  function toast(msg){ alert(msg); }

  async function loadPrefer(){
    try{
      const raw = localStorage.getItem(LS_KEY);
      if (raw) {
        const arr = JSON.parse(raw);
        if (Array.isArray(arr)) return arr;
      }
    }catch{}
    try{
      const res = await fetch('data/aed.json', { cache:'no-cache' });
      const arr = await res.json();
      return Array.isArray(arr) ? arr : [];
    }catch{
      return [];
    }
  }

  function saveLocal(){
    localStorage.setItem(LS_KEY, JSON.stringify(data));
    window.dispatchEvent(new Event('aed-admin-data-updated'));
  }

  function renderTable(){
    if (!Array.isArray(data) || data.length === 0){
      tbody.innerHTML = `<tr><td colspan="7" class="meta">暂无数据。你可以点击“从服务器加载 aed.json”或“新增点位”。</td></tr>`;
      tableNote.textContent = '';
      return;
    }
    tbody.innerHTML = data.map((p, i)=>{
      const latlng = (p.lat && p.lng) ? `${toFixed6(p.lat)}, ${toFixed6(p.lng)}` : '—';
      return `
        <tr>
          <td>${p.id || '—'}</td>
          <td>${p.name || '—'}</td>
          <td>${p.building || '—'}</td>
          <td>${p.floor || '—'}</td>
          <td><span class="chip ${p.status==='available'?'success':'gray'}">${p.status || '—'}</span></td>
          <td>${latlng}</td>
          <td class="actions">
            <button class="btn" data-act="edit" data-i="${i}">编辑</button>
            <button class="btn" data-act="dup" data-i="${i}">复制</button>
            <button class="btn danger" data-act="del" data-i="${i}">删除</button>
            <a class="btn" href="details.html?id=${encodeURIComponent(p.id||'')}" target="_blank" rel="noopener">详情</a>
          </td>
        </tr>
      `;
    }).join('');
    tableNote.textContent = `当前共 ${data.length} 条；已保存于本地管理员数据。`;
  }

  // 坐标转换（与地图页一致）
  function outOfChina(lng, lat){ return (lng < 72.004 || lng > 137.8347 || lat < 0.8293 || lat > 55.8271); }
  function transformLat(x,y){ let ret=-100+2*x+3*y+0.2*y*y+0.1*x*y+0.2*Math.sqrt(Math.abs(x));
    ret+=(20*Math.sin(6*x*Math.PI)+20*Math.sin(2*x*Math.PI))*2/3;
    ret+=(20*Math.sin(y*Math.PI)+40*Math.sin(y/3*Math.PI))*2/3;
    ret+=(160*Math.sin(y/12*Math.PI)+320*Math.sin(y/30*Math.PI))*2/3; return ret; }
  function transformLng(x,y){ let ret=300+x+2*y+0.1*x*x+0.1*x*y+0.1*Math.sqrt(Math.abs(x));
    ret+=(20*Math.sin(6*x*Math.PI)+20*Math.sin(2*x*Math.PI))*2/3;
    ret+=(20*Math.sin(x*Math.PI)+40*Math.sin(x/3*Math.PI))*2/3;
    ret+=(150*Math.sin(x/12*Math.PI)+300*Math.sin(x/30*Math.PI))*2/3; return ret; }
  function wgs84ToGcj02(lng, lat){
    if (outOfChina(lng, lat)) return [lng, lat];
    const a=6378245.0, ee=0.00669342162296594323;
    let dLat = transformLat(lng-105.0, lat-35.0);
    let dLng = transformLng(lng-105.0, lat-35.0);
    const radLat = lat/180.0*Math.PI;
    let magic = Math.sin(radLat); magic = 1 - ee*magic*magic;
    const sqrtMagic = Math.sqrt(magic);
    dLat = (dLat*180.0)/((a*(1-ee))/(magic*sqrtMagic)*Math.PI);
    dLng = (dLng*180.0)/(a/ sqrtMagic * Math.cos(radLat)*Math.PI);
    return [lng + dLng, lat + dLat];
  }
  function gcj02ToWgs84(lng, lat){
    if (outOfChina(lng, lat)) return [lng, lat];
    const a=6378245.0, ee=0.00669342162296594323;
    let dLat = transformLat(lng-105.0, lat-35.0);
    let dLng = transformLng(lng-105.0, lat-35.0);
    const radLat = lat/180.0*Math.PI;
    let magic = Math.sin(radLat); magic = 1 - ee*magic*magic;
    const sqrtMagic = Math.sqrt(magic);
    dLat = (dLat*180.0)/((a*(1-ee))/(magic*sqrtMagic)*Math.PI);
    dLng = (dLng*180.0)/(a/ sqrtMagic * Math.cos(radLat)*Math.PI);
    const mgLat = lat + dLat;
    const mgLng = lng + dLng;
    return [lng*2 - mgLng, lat*2 - mgLat];
  }

  // 取点地图
  let pickMap = null;
  let pickMarker = null;
  let pickInited = false;
  const centerCampus = [30.541, 114.36]; // lat, lng (WGS)

  function initPickMap(){
    if (pickInited) return;
    const el = document.getElementById('pickMap');
    if (!el || typeof L === 'undefined') return;

    pickMap = L.map('pickMap', { center: [centerCampus[0], centerCampus[1]], zoom: 16 });

    // 与地图页 v3 完全一致的底图源（无高清参数）
    const gaodeA = L.tileLayer('https://webrd0{s}.is.autonavi.com/appmaptile?style=7&x={x}&y={y}&z={z}', {
      subdomains:'1234', maxZoom:18, attribution:'© 高德地图'
    }).addTo(pickMap);
    const gaodeB = L.tileLayer('https://wprd0{s}.is.autonavi.com/appmaptile?style=7&x={x}&y={y}&z={z}', {
      subdomains:'1234', maxZoom:18, attribution:'© 高德地图'
    });
    const gaodeHTTP = L.tileLayer('http://webrd0{s}.is.autonavi.com/appmaptile?style=7&x={x}&y={y}&z={z}', {
      subdomains:'1234', maxZoom:18, attribution:'© 高德地图'
    });

    // 回退链：A -> B -> HTTP
    gaodeA.on('tileerror', ()=> { try { gaodeB.addTo(pickMap); } catch {} });
    gaodeB.on('tileerror', ()=> { try { gaodeHTTP.addTo(pickMap); } catch {} });

    // 点击拾取
    pickMap.on('click', (e)=>{
      const gcjLat = e.latlng.lat, gcjLng = e.latlng.lng;
      const [wgsLng, wgsLat] = gcj02ToWgs84(gcjLng, gcjLat);
      writeLatLngToForm(wgsLat, wgsLng);
      placeMarkerGCJ(gcjLat, gcjLng);
    });

    pickInited = true;
  }

  function placeMarkerGCJ(gcjLat, gcjLng){
    if (!pickMap) return;
    if (!pickMarker){
      pickMarker = L.marker([gcjLat, gcjLng], { draggable: true }).addTo(pickMap);
      pickMarker.on('dragend', ()=>{
        const pos = pickMarker.getLatLng();
        const [wgsLng, wgsLat] = gcj02ToWgs84(pos.lng, pos.lat);
        writeLatLngToForm(wgsLat, wgsLng);
      });
    } else {
      pickMarker.setLatLng([gcjLat, gcjLng]);
    }
  }

  function writeLatLngToForm(wgsLat, wgsLng){
    f.lat.value = toFixed6(wgsLat);
    f.lng.value = toFixed6(wgsLng);
  }

  function focusMapToCurrent(){
    const lat = Number(f.lat.value), lng = Number(f.lng.value);
    let gcjLatLng;
    if (isFinite(lat) && isFinite(lng)){
      const [gLng, gLat] = wgs84ToGcj02(lng, lat);
      gcjLatLng = [gLat, gLng];
    } else {
      const [gLng, gLat] = wgs84ToGcj02(centerCampus[1], centerCampus[0]);
      gcjLatLng = [gLat, gLng];
    }
    pickMap.setView(gcjLatLng, isFinite(lat)&&isFinite(lng) ? 18 : 16);
    placeMarkerGCJ(gcjLatLng[0], gcjLatLng[1]);
    // 面板显示后刷新尺寸，避免灰屏
    setTimeout(()=> pickMap.invalidateSize(), 120);
  }

  function openEditor(index){
    editingIndex = (typeof index === 'number') ? index : -1;
    const isNew = editingIndex === -1;
    titleEl.textContent = isNew ? '新增点位' : '编辑点位';
    const p = isNew ? {} : data[editingIndex];

    f.id.value = p.id || '';
    f.name.value = p.name || '';
    f.building.value = p.building || '';
    f.floor.value = p.floor || '';
    f.room.value = p.room || '';
    f.status.value = p.status || 'available';
    f.lat.value = p.lat ?? '';
    f.lng.value = p.lng ?? '';
    f.open.value = p.open_hours || '';
    f.inspect.value = p.last_inspection_at || '';
    f.elevator.checked = !!(p.accessibility && p.accessibility.elevator);
    f.ramp.checked = !!(p.accessibility && p.accessibility.ramp);
    f.notes.value = p.notes || '';
    f.photos.value = Array.isArray(p.photos) ? p.photos.join(', ') : '';

    // 新增：点位价值字段回填
    if (f.used)    f.used.value = Number(p.used_count || 0);
    if (f.rescued) f.rescued.value = Number(p.rescued_count || 0);
    if (f.last)    f.last.value = p.last_used_at ? String(p.last_used_at).slice(0,10) : '';

    panel.style.display = 'block';
    initPickMap();
    if (pickMap) { focusMapToCurrent(); }
    window.scrollTo({ top: panel.offsetTop - 80, behavior: 'smooth' });
  }
  function closeEditor(){ panel.style.display = 'none'; }

  function collectForm(){
    const name = f.name.value.trim();
    const building = f.building.value.trim();
    const status = f.status.value;
    const lat = f.lat.value.trim();
    const lng = f.lng.value.trim();
    if (!name){ toast('请填写“名称”。'); return null; }
    if (!building){ toast('请填写“建筑”。'); return null; }
    if (!lat || !lng || isNaN(Number(lat)) || isNaN(Number(lng))){ toast('请填写有效的纬度/经度（数字）。'); return null; }

    const photos = f.photos.value.trim()
      ? f.photos.value.split(',').map(s=>s.trim()).filter(Boolean)
      : undefined;

    const obj = {
      id: f.id.value.trim() || uid(),
      name,
      building,
      floor: f.floor.value.trim() || undefined,
      room: f.room.value.trim() || undefined,
      status,
      lat: Number(lat),
      lng: Number(lng),
      open_hours: f.open.value.trim() || undefined,
      last_inspection_at: f.inspect.value || undefined,
      accessibility: { elevator: !!f.elevator.checked, ramp: !!f.ramp.checked },
      notes: f.notes.value.trim() || undefined,
      photos
    };

    // 新增：点位价值字段采集
    if (f.used) {
      const val = Math.max(0, Number((f.used.value || '0')));
      obj.used_count = val;
    }
    if (f.rescued) {
      const val = Math.max(0, Number((f.rescued.value || '0')));
      obj.rescued_count = val;
    }
    if (f.last) {
      const val = (f.last.value || '').trim();
      obj.last_used_at = val || undefined; // 空则不写入字段
    }

    return obj;
  }

  tbody.addEventListener('click', (e)=>{
    const btn = e.target.closest('button');
    if (!btn) return;
    const i = Number(btn.dataset.i);
    const act = btn.dataset.act;
    if (Number.isNaN(i) || !data[i]) return;

    if (act === 'edit'){ openEditor(i); }
    else if (act === 'dup'){
      const copy = JSON.parse(JSON.stringify(data[i]));
      copy.id = uid();
      copy.name = (copy.name || '') + '（副本）';
      data.splice(i+1, 0, copy);
      saveLocal(); renderTable(); toast('已复制一条记录。');
    }
    else if (act === 'del'){
      if (confirm('确认删除该记录？')){ data.splice(i,1); saveLocal(); renderTable(); }
    }
  });

  document.getElementById('btn-add').addEventListener('click', ()=> openEditor(-1));
  document.getElementById('btn-load-server').addEventListener('click', async ()=>{
    try{
      const r = await fetch('data/aed.json', { cache:'no-cache' });
      const list = await r.json();
      if (!Array.isArray(list)) throw new Error('JSON 非数组');
      data = list; saveLocal(); renderTable(); toast('已从服务器加载并保存到本地管理员数据。');
    }catch(e){ toast('加载失败：' + e.message); }
  });
  document.getElementById('btn-import').addEventListener('click', ()=>{
    const input = document.createElement('input');
    input.type = 'file'; input.accept = 'application/json';
    input.onchange = async () => {
      const file = input.files[0]; if (!file) return;
      try{
        const text = await file.text();
        const list = JSON.parse(text);
        if (!Array.isArray(list)) throw new Error('JSON 非数组');
        data = list; saveLocal(); renderTable(); toast('导入成功，已保存到本地管理员数据。');
      }catch(e){ toast('导入失败：' + e.message); }
    };
    input.click();
  });
  document.getElementById('btn-export').addEventListener('click', ()=>{
    try{
      const raw = JSON.stringify(data || [], null, 2);
      const blob = new Blob([raw], { type:'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'aed_export.json';
      a.click();
      URL.revokeObjectURL(a.href);
    }catch(e){ toast('导出失败：' + e.message); }
  });
  document.getElementById('btn-apply-preview').addEventListener('click', ()=>{
    try{ saveLocal(); toast('已应用本地管理员数据。请到地图页查看预览。'); }catch(e){ toast('操作失败：' + e.message); }
  });

  document.getElementById('btn-save').addEventListener('click', ()=>{
    const obj = collectForm(); if (!obj) return;
    if (editingIndex === -1){ data.push(obj); }
    else { data[editingIndex] = obj; }
    saveLocal(); renderTable(); closeEditor(); toast('保存成功。');
  });
  document.getElementById('btn-cancel').addEventListener('click', closeEditor);

  // 可选：一键 +1（并设置最近一次使用为今天）
  document.getElementById('btn-use-plus1')?.addEventListener('click', (e)=>{
    e.preventDefault();
    if (!f.used) return;
    const cur = Math.max(0, parseInt(f.used.value || '0', 10));
    f.used.value = String(cur + 1);
    if (f.last) f.last.value = new Date().toISOString().slice(0,10);
  });

  document.getElementById('btn-pick-locate').addEventListener('click', ()=>{
    if (!pickMap) return;
    if (!('geolocation' in navigator)) { toast('设备不支持定位'); return; }
    navigator.geolocation.getCurrentPosition(pos=>{
      const wLat = pos.coords.latitude, wLng = pos.coords.longitude;
      const [gLng, gLat] = wgs84ToGcj02(wLng, wLat);
      pickMap.setView([gLat, gLng], 18);
      placeMarkerGCJ(gLat, gLng);
      writeLatLngToForm(wLat, wLng);
      setTimeout(()=> pickMap.invalidateSize(), 100);
    }, err=> toast('定位失败：' + err.message), { enableHighAccuracy:true, timeout:8000 });
  });
  document.getElementById('btn-pick-center').addEventListener('click', ()=>{
    if (!pickMap) return;
    const c = pickMap.getCenter(); // GCJ
    const [wLng, wLat] = gcj02ToWgs84(c.lng, c.lat);
    writeLatLngToForm(wLat, wLng);
    placeMarkerGCJ(c.lat, c.lng);
  });

  (async function init(){
    data = await loadPrefer();
    renderTable();
  })();

  window.addEventListener('aed-admin-data-updated', async ()=>{
    data = await loadPrefer();
    renderTable();
  });
})();