(function(){
  const warnEl = document.getElementById('warn');
  const okEl = document.getElementById('ok');
  const tableBody = document.querySelector('#table tbody');

  const inputs = {
    id: document.getElementById('f_id'),
    name: document.getElementById('f_name'),
    building: document.getElementById('f_building'),
    floor: document.getElementById('f_floor'),
    room: document.getElementById('f_room'),
    status: document.getElementById('f_status'),
    lat: document.getElementById('f_lat'),
    lng: document.getElementById('f_lng'),
    open_hours: document.getElementById('f_open_hours'),
    device_model: document.getElementById('f_device_model'),
    last_inspection_at: document.getElementById('f_last'),
    notes: document.getElementById('f_notes'),
    ramp: document.getElementById('f_ramp'),
    elevator: document.getElementById('f_elevator')
  };

  let data = [];

  function setWarn(msg){ warnEl.textContent = msg; warnEl.style.display = 'block'; }
  function clearWarn(){ warnEl.textContent=''; warnEl.style.display='none'; }
  function setOk(msg){ okEl.textContent = msg; okEl.style.display = 'block'; setTimeout(()=>{ okEl.style.display='none'; }, 2000); }

  function renderTable(list){
    tableBody.innerHTML = '';
    list.forEach((p, idx)=>{
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${p.id}</td>
        <td>${p.name}</td>
        <td>${p.building||''}</td>
        <td>${p.floor||''}</td>
        <td>${p.status||''}</td>
        <td>${Number(p.lat).toFixed(6)}, ${Number(p.lng).toFixed(6)}</td>
        <td class="actions">
          <button class="btn" data-act="edit" data-idx="${idx}">编辑</button>
          <button class="btn" data-act="del" data-idx="${idx}">删除</button>
        </td>
      `;
      tableBody.appendChild(tr);
    });
  }

  function fillForm(p){
    inputs.id.value = p?.id || '';
    inputs.name.value = p?.name || '';
    inputs.building.value = p?.building || '';
    inputs.floor.value = p?.floor || '';
    inputs.room.value = p?.room || '';
    inputs.status.value = p?.status || 'available';
    inputs.lat.value = p?.lat ?? '';
    inputs.lng.value = p?.lng ?? '';
    inputs.open_hours.value = p?.open_hours || '';
    inputs.device_model.value = p?.device_model || '';
    inputs.last_inspection_at.value = p?.last_inspection_at || '';
    inputs.notes.value = p?.notes || '';
    inputs.ramp.checked = !!p?.accessibility?.ramp;
    inputs.elevator.checked = !!p?.accessibility?.elevator;
    inputs.id.dataset.editing = p?.id || '';
  }
  function collectForm(){
    return {
      id: inputs.id.value.trim(),
      name: inputs.name.value.trim(),
      building: inputs.building.value.trim(),
      floor: inputs.floor.value.trim(),
      room: inputs.room.value.trim(),
      status: inputs.status.value,
      lat: Number(inputs.lat.value),
      lng: Number(inputs.lng.value),
      open_hours: inputs.open_hours.value.trim(),
      device_model: inputs.device_model.value.trim(),
      last_inspection_at: inputs.last_inspection_at.value.trim(),
      accessibility: { ramp: inputs.ramp.checked, elevator: inputs.elevator.checked },
      notes: inputs.notes.value.trim(),
      photos: []
    };
  }
  function resetForm(){
    Object.values(inputs).forEach(el=>{
      if (el.type==='checkbox') el.checked = false;
      else el.value = '';
    });
    inputs.status.value = 'available';
    inputs.id.dataset.editing = '';
  }

  document.getElementById('resetForm').addEventListener('click', resetForm);

  // 保存/更新
  document.getElementById('saveRecord').addEventListener('click', ()=>{
    const obj = collectForm();
    if (!obj.id || !obj.name || isNaN(obj.lat) || isNaN(obj.lng)) {
      setWarn('请填写必填字段：id、name、lat、lng');
      return;
    }
    clearWarn();
    const editingId = inputs.id.dataset.editing;
    const i = data.findIndex(x=>x.id === editingId);
    if (editingId && i >= 0) {
      data[i] = obj;
      setOk('已更新：' + obj.id);
    } else {
      if (data.some(x=>x.id === obj.id)) { setWarn('ID 已存在，请更换'); return; }
      data.push(obj);
      setOk('已新增：' + obj.id);
    }
    renderTable(data);
  });

  // 表格事件
  tableBody.addEventListener('click', (e)=>{
    const act = e.target.dataset.act;
    const idx = Number(e.target.dataset.idx);
    if (act === 'edit') fillForm(data[idx]);
    else if (act === 'del') {
      const p = data[idx];
      if (confirm(`确定删除 ${p.id} 吗？`)) { data.splice(idx,1); renderTable(data); setOk('已删除：' + p.id); }
    }
  });

  // 加载服务器
  document.getElementById('loadServerBtn').addEventListener('click', async ()=>{
    try {
      const res = await fetch('data/aed.json');
      const list = await res.json();
      data = Array.isArray(list) ? list : [];
      renderTable(data);
      clearWarn();
      setOk('已从服务器 aed.json 加载');
      const h = new URL(location.href).hash;
      const match = h.match(/#edit=(.+)$/);
      if (match) {
        const id = decodeURIComponent(match[1]);
        const p = data.find(x=>x.id === id);
        if (p) fillForm(p);
      }
    } catch (e) { setWarn('载入失败：' + e.message); }
  });

  // 搜索
  document.getElementById('searchInput').addEventListener('input', (e)=>{
    const q = e.target.value.trim().toLowerCase();
    const filtered = data.filter(p=>{
      return [p.id, p.name, p.building, p.status].some(x=> (x||'').toLowerCase().includes(q));
    });
    renderTable(filtered);
  });

  // 导出 JSON
  document.getElementById('exportBtn').addEventListener('click', ()=>{
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'aed.json'; a.click();
    URL.revokeObjectURL(url);
  });

  // 导入 JSON
  document.getElementById('importFile').addEventListener('change', async (e)=>{
    const f = e.target.files[0]; if (!f) return;
    try {
      const text = await f.text();
      const list = JSON.parse(text);
      if (!Array.isArray(list)) throw new Error('JSON 不是数组');
      data = list; renderTable(data); clearWarn(); setOk('已导入 JSON');
    } catch (err) { setWarn('导入失败：' + err.message); }
    finally { e.target.value = ''; }
  });

  // 应用到地图（LocalStorage）
  document.getElementById('applyLocalBtn').addEventListener('click', ()=>{
    try { localStorage.setItem('aed_admin_data', JSON.stringify(data)); setOk('本地数据已保存。地图页会优先使用本地数据。'); }
    catch (e) { setWarn('保存失败：' + e.message); }
  });
  document.getElementById('clearLocalBtn').addEventListener('click', ()=>{
    localStorage.removeItem('aed_admin_data'); setOk('已清除本地数据。地图页将使用服务器 aed.json。');
  });

  // ========== 高德拾取地图 ==========
  const baseSel = document.getElementById('baseSel');
  const map = L.map('pickMap', { center:[30.541,114.36], zoom:15 });
  const gaodeA = L.tileLayer('https://webrd0{s}.is.autonavi.com/appmaptile?lang=zh_cn&size=1&scale=1&style=7&x={x}&y={y}&z={z}', { subdomains:'1234', maxZoom:18, attribution:'© 高德地图' }).addTo(map);
  const gaodeB = L.tileLayer('https://wprd0{s}.is.autonavi.com/appmaptile?style=7&x={x}&y={y}&z={z}', { subdomains:'1234', maxZoom:18, attribution:'© 高德地图' });
  const gaodeHTTP = L.tileLayer('http://webrd0{s}.is.autonavi.com/appmaptile?style=7&x={x}&y={y}&z={z}', { subdomains:'1234', maxZoom:18, attribution:'© 高德地图' });

  function switchBase(name){
    [gaodeA, gaodeB, gaodeHTTP].forEach(l=> map.removeLayer(l));
    if (name==='GAODE_A') gaodeA.addTo(map);
    else if (name==='GAODE_B') gaodeB.addTo(map);
    else if (name==='GAODE_HTTP') gaodeHTTP.addTo(map);
  }
  baseSel.addEventListener('change', ()=> switchBase(baseSel.value));
  document.getElementById('centerWHU').addEventListener('click', ()=> map.setView([30.541,114.36], 16));

  // 坐标转换（WGS84 <-> GCJ-02）
  function outOfChina(lng, lat){ return (lng < 72.004 || lng > 137.8347 || lat < 0.8293 || lat > 55.8271); }
  function transformLat(x, y){ let ret = -100 + 2*x + 3*y + 0.2*y*y + 0.1*x*y + 0.2*Math.sqrt(Math.abs(x));
    ret += (20*Math.sin(6*x*Math.PI) + 20*Math.sin(2*x*Math.PI)) * 2/3;
    ret += (20*Math.sin(y*Math.PI) + 40*Math.sin(y/3*Math.PI)) * 2/3;
    ret += (160*Math.sin(y/12*Math.PI) + 320*Math.sin(y/30*Math.PI)) * 2/3; return ret; }
  function transformLng(x, y){ let ret = 300 + x + 2*y + 0.1*x*x + 0.1*x*y + 0.1*Math.sqrt(Math.abs(x));
    ret += (20*Math.sin(6*x*Math.PI) + 20*Math.sin(2*x*Math.PI)) * 2/3;
    ret += (20*Math.sin(x*Math.PI) + 40*Math.sin(x/3*Math.PI)) * 2/3;
    ret += (150*Math.sin(x/12*Math.PI) + 300*Math.sin(x/30*Math.PI)) * 2/3; return ret; }
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
    const [gLng, gLat] = wgs84ToGcj02(lng, lat);
    return [lng*2 - gLng, lat*2 - gLat];
  }

  let pickMarker = null;
  map.on('click', e=>{
    const { lat, lng } = e.latlng; // GCJ-02（高德底图）
    const [wlng, wlat] = gcj02ToWgs84(lng, lat);
    inputs.lat.value = wlat.toFixed(6);
    inputs.lng.value = wlng.toFixed(6);
    if (pickMarker) map.removeLayer(pickMarker);
    pickMarker = L.marker([lat, lng]).addTo(map)
      .bindPopup(`显示(GCJ-02): ${lat.toFixed(6)}, ${lng.toFixed(6)}<br>存储(WGS84): ${wlat.toFixed(6)}, ${wlng.toFixed(6)}`).openPopup();
  });

  // 初始化
  (function init(){
    try {
      const raw = localStorage.getItem('aed_admin_data');
      if (raw) { data = JSON.parse(raw); renderTable(data); setOk('已加载本地管理员数据'); }
      else { setWarn('尚无本地数据。点击“从服务器加载 aed.json”或导入 JSON。'); }
      const h = new URL(location.href).hash;
      if (h && h.startsWith('#edit=')) { document.getElementById('loadServerBtn').click(); }
    } catch (e) { setWarn('初始化失败：' + e.message); }
  })();
})();