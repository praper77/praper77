// 高德底图 + 筛选 + 导航 + 分析叠加（覆盖圈/框选）
// 增加：使用次数本地累计（点击导航计一次，60 秒内防重复）+ 弹窗展示 used_count/rescued_count

const msg = document.getElementById('msg');
const showWarn = t => { msg.textContent=t; msg.style.display='block'; };
const clearWarn = () => { msg.textContent=''; msg.style.display='none'; };

const map = L.map('map', { center: [30.541, 114.36], zoom: 15 });

// 高德底图（A 默认、B、C 备选）
const gaodeA = L.tileLayer('https://webrd0{s}.is.autonavi.com/appmaptile?style=7&x={x}&y={y}&z={z}', { subdomains:'1234', maxZoom:18, attribution:'© 高德地图' }).addTo(map);
const gaodeB = L.tileLayer('https://wprd0{s}.is.autonavi.com/appmaptile?style=7&x={x}&y={y}&z={z}', { subdomains:'1234', maxZoom:18, attribution:'© 高德地图' });
const gaodeHTTP = L.tileLayer('http://webrd0{s}.is.autonavi.com/appmaptile?style=7&x={x}&y={y}&z={z}', { subdomains:'1234', maxZoom:18, attribution:'© 高德地图' });

[gaodeA, gaodeB, gaodeHTTP].forEach(l=>{
  l.on('tileerror', ()=> showWarn('高德瓦片加载失败：尝试切换 A/B/C。'));
  l.on('load', ()=> clearWarn());
});
L.control.layers({ '高德A': gaodeA, '高德B': gaodeB, '高德C（HTTP）': gaodeHTTP }, null, { collapsed:false }).addTo(map);

// 坐标转换 WGS84 -> GCJ‑02
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

// 标记样式
function statusIcon(status){
  let cls = 'marker-default';
  if (status === 'available') cls = 'marker-available';
  else if (status === 'maintenance') cls = 'marker-maintenance';
  return L.divIcon({ className:'', html:`<div class="marker-dot ${cls}"></div>`, iconSize:[18,18], iconAnchor:[9,9] });
}

// 工具函数
function haversine(lat1, lon1, lat2, lon2) {
  const toRad = d => d * Math.PI / 180; const R = 6371;
  const dLat = toRad(lat2-lat1); const dLon = toRad(lon2-lon1);
  const a = Math.sin(dLat/2)**2 + Math.cos(toRad(lat1))*Math.cos(toRad(lat2))*Math.sin(dLon/2)**2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); return R * c;
}
function estimateWalkETA(km){ const mins = Math.max(1, Math.round(km / 4.5 * 60)); return `${mins} 分钟`; }
const debounce = (fn, ms=250)=>{ let t; return (...args)=>{ clearTimeout(t); t=setTimeout(()=>fn(...args), ms); }; };

// 新增：本地使用次数累计（localStorage）
function _getUsageStats(){
  try { return JSON.parse(localStorage.getItem('aed_usage_stats')||'{}'); } catch { return {}; }
}
function _saveUsageStats(stats){ localStorage.setItem('aed_usage_stats', JSON.stringify(stats)); }
// 计一次使用：同一 AED 60 秒内不重复计数
function markUsed(aedId){
  if (!aedId) return;
  const stats = _getUsageStats();
  const now = Date.now();
  const last = stats[aedId]?.last_ts || 0;
  if (now - last < 60*1000) return; // 60 秒防抖
  const cnt = (stats[aedId]?.count || 0) + 1;
  stats[aedId] = { count: cnt, last_ts: now };
  _saveUsageStats(stats);
}
// 展示使用次数：后端字段 + 本地累计
function getUsedCount(aedId, base){ const stats = _getUsageStats(); return (base||0) + (stats[aedId]?.count || 0); }

// 图层
const aedLayer = L.layerGroup().addTo(map);
const myLayer = L.layerGroup().addTo(map);
const routeLayer = L.layerGroup().addTo(map);

// 分析层
const coverageLayer = L.layerGroup().addTo(map);
const selectLayer = L.layerGroup().addTo(map);

// UI 元素
const chipsEl = document.getElementById('filterChips');
const coverageToggle = document.getElementById('coverageToggle');
const coverageRadius = document.getElementById('coverageRadius');
const coverageApplyBtn = document.getElementById('coverageApplyBtn');
const selectStartBtn = document.getElementById('selectStartBtn');
const selectClearBtn = document.getElementById('selectClearBtn');
const selectionStats = document.getElementById('selectionStats');

// 数据缓存
window._aedAll = [];          // 原始 WGS84 列表
let _filtered = [];           // 当前筛选后的列表
let _aedGeoms = [];           // {id,gcjLat,gcjLng,ref,mk}

// 筛选 chips
function updateChips(){
  const q = document.getElementById('qInput').value.trim();
  const s = document.getElementById('statusSel').value;
  const b = document.getElementById('buildingInput').value.trim();
  const chips = [];
  if (q) chips.push(`<span class="chip">关键词：${q}</span>`);
  if (s) chips.push(`<span class="chip ${s==='available'?'success':'gray'}">状态：${s}</span>`);
  if (b) chips.push(`<span class="chip">建筑：${b}</span>`);
  if (chips.length===0) chips.push(`<span class="chip clear">未应用筛选</span>`);
  chipsEl.innerHTML = chips.join('');
}
document.getElementById('clearFiltersBtn').addEventListener('click', ()=>{
  document.getElementById('qInput').value='';
  document.getElementById('statusSel').value='';
  document.getElementById('buildingInput').value='';
  updateChips();
  renderAeds(window._aedAll);
});

function applyFilters(list){
  const q = document.getElementById('qInput').value.trim().toLowerCase();
  const s = document.getElementById('statusSel').value;
  const b = document.getElementById('buildingInput').value.trim().toLowerCase();
  updateChips();
  return list.filter(p=>{
    const okQ = q ? [p.name, p.building].some(x=> (x||'').toLowerCase().includes(q)) : true;
    const okS = s ? p.status === s : true;
    const okB = b ? (p.building||'').toLowerCase().includes(b) : true;
    return okQ && okS && okB;
  });
}
const onFilterChange = debounce(()=>{
  _filtered = applyFilters(window._aedAll);
  renderAeds(_filtered);
  refreshCoverage(); // 筛选变化时同步覆盖圈层
}, 250);
['qInput','statusSel','buildingInput'].forEach(id=>{
  document.getElementById(id).addEventListener(id==='statusSel'?'change':'input', onFilterChange);
});

// 加载数据：优先管理员本地数据，其次服务器 aed.json
function loadLocalAdminData(){
  try { const raw = localStorage.getItem('aed_admin_data'); if (!raw) return null;
    const list = JSON.parse(raw); return Array.isArray(list) ? list : null;
  } catch { return null; }
}
async function loadAeds(){
  try {
    const local = loadLocalAdminData();
    if (local && local.length) {
      window._aedAll = local;
    } else {
      const res = await fetch('data/aed.json', { cache:'no-cache' });
      const list = await res.json();
      window._aedAll = Array.isArray(list) ? list : [];
    }
    _filtered = applyFilters(window._aedAll);
    renderAeds(_filtered);
    refreshCoverage();
    clearWarn();
  } catch (e) {
    showWarn('加载 AED 数据失败：' + e.message);
  }
}

// 渲染点位（加入 使用次数/救助人数 展示，并在导航点击时本地累计）
function renderAeds(list){
  aedLayer.clearLayers();
  _aedGeoms = [];
  list.forEach(p=>{
    const gcj = wgs84ToGcj02(p.lng, p.lat); // [lng, lat]
    const latlng = [gcj[1], gcj[0]];
    const usedCombined = getUsedCount(p.id, p.used_count);
    const saved = (p.rescued_count ?? '—');
    const navLink = `https://uri.amap.com/navigation?to=${gcj[0]},${gcj[1]}&mode=walk&src=whu_aed&callnative=0`;

    const popupHTML = `
      <div class="popup-grid">
        <div class="popup-title">${p.name}</div>
        <div class="meta">位置：${p.building||''} ${p.floor||''} ${p.room||''}</div>
        <div class="meta">状态：<span class="chip ${p.status==='available'?'success':'gray'}">${p.status||'—'}</span> · 开放：${p.open_hours||'—'}</div>
        <div class="meta">使用次数：${usedCombined} · 救助人数：${saved}${p.last_used_at ? ` · 最近一次使用：${p.last_used_at}` : ''}</div>
        <div class="tools" style="margin-top:6px">
          <a class="btn" href="details.html?id=${encodeURIComponent(p.id)}">详情</a>
          <a class="btn primary nav-to-aed" data-id="${encodeURIComponent(p.id)}" href="${navLink}" target="_blank" rel="noopener">导航到此 AED</a>
        </div>
      </div>
    `;

    const m = L.marker(latlng, { icon: statusIcon(p.status) })
      .addTo(aedLayer)
      .bindPopup(popupHTML);

    // 弹窗打开时，为“导航到此 AED”按钮绑定一次使用计数
    m.on('popupopen', ()=>{
      const el = document.querySelector('.leaflet-popup .nav-to-aed');
      if (el) el.addEventListener('click', ()=> markUsed(el.dataset.id), { once:true });
    });

    _aedGeoms.push({ id:p.id, gcjLat:latlng[0], gcjLng:latlng[1], ref:p, mk:m });
  });
}

// 覆盖圈层
function refreshCoverage(){
  coverageLayer.clearLayers();
  const on = coverageToggle?.checked;
  const r = Number(coverageRadius?.value) || 100;
  if (!on || !_filtered || _filtered.length===0) return;
  _aedGeoms.forEach(g=>{
    L.circle([g.gcjLat, g.gcjLng], { radius:r, color:'#1f7a2d', weight:1, fill:true, fillOpacity:0.12 })
      .addTo(coverageLayer);
  });
}
coverageApplyBtn?.addEventListener('click', refreshCoverage);
coverageToggle?.addEventListener('change', refreshCoverage);

// 框选统计（两次点击确定矩形）
let selecting = false;
let selStart = null;
let selRect = null;

selectStartBtn?.addEventListener('click', ()=>{
  selecting = true; selStart = null;
  selectionStats.innerHTML = '<span class="note">已进入框选：点击起点，再点击终点。</span>';
});
selectClearBtn?.addEventListener('click', ()=>{
  selecting = false; selStart = null;
  selectLayer.clearLayers();
  selectionStats.innerHTML = '';
});

map.on('click', e=>{
  if (!selecting) return;
  if (!selStart) {
    selStart = e.latlng; // GCJ
    selectionStats.innerHTML = '<span class="note">已记录起点，请再点击终点。</span>';
  } else {
    const p1 = selStart, p2 = e.latlng;
    const bounds = L.latLngBounds(p1, p2);
    selectLayer.clearLayers();
    selRect = L.rectangle(bounds, { color:'#2d6cdf', weight:2, fillOpacity:0.05 }).addTo(selectLayer);
    selecting = false; selStart = null;

    // 统计
    const inList = _aedGeoms.filter(g=> bounds.contains([g.gcjLat, g.gcjLng])).map(g=> g.ref);
    if (inList.length === 0) {
      selectionStats.innerHTML = '<span class="meta">选区内暂无点位。</span>';
      return;
    }
    const byB = inList.reduce((acc,p)=>{ const k=p.building||'未标注建筑'; acc[k]=(acc[k]||0)+1; return acc; }, {});
    const topB = Object.entries(byB).sort((a,b)=> b[1]-a[1]).slice(0,6)
                   .map(([k,v])=>`${k}：${v}`).join('； ');
    const listHtml = inList.slice(0,10)
      .map(p=> `<li>${p.name}（${p.building||''} ${p.floor||''}）</li>`).join('');
    selectionStats.innerHTML = `
      <div class="meta">选区内点位：<b>${inList.length}</b> 个</div>
      <div class="meta">建筑分布：${topB}</div>
      <details style="margin-top:6px"><summary>点位清单（前10条）</summary><ul class="meta" style="line-height:1.7">${listHtml}</ul></details>
    `;
    map.fitBounds(bounds, { padding:[40,40] });
  }
});

// 定位我的位置
document.getElementById('locateBtn').addEventListener('click', ()=>{
  if (!('geolocation' in navigator)) { showWarn('设备不支持定位'); return; }
  clearWarn();
  navigator.geolocation.getCurrentPosition(pos=>{
    const { latitude, longitude } = pos.coords;
    const gcj = wgs84ToGcj02(longitude, latitude);
    const latlng = [gcj[1], gcj[0]];
    myLayer.clearLayers();
    L.marker(latlng, { title:'我的位置' }).addTo(myLayer).bindPopup('我的位置').openPopup();
    map.setView(latlng, 16);
  }, err=> showWarn('定位失败：' + err.message), { enableHighAccuracy:true, timeout:8000 });
});

// 导航到最近 AED
const navPanel = document.getElementById('navPanel');
const navNameEl = document.getElementById('navName');
const navDistEl = document.getElementById('navDist');
const navETAEl = document.getElementById('navETA');
const navGaodeLink = document.getElementById('navGaodeLink');
const clearRouteBtn = document.getElementById('clearRouteBtn');

document.getElementById('navNearestBtn').addEventListener('click', ()=>{
  if (!window._aedAll || window._aedAll.length === 0) { showWarn('尚未加载 AED 数据'); return; }
  if (!('geolocation' in navigator)) { showWarn('设备不支持定位'); return; }
  clearWarn();

  navigator.geolocation.getCurrentPosition(pos=>{
    const userLatW = pos.coords.latitude;
    const userLngW = pos.coords.longitude;
    const candidates = window._aedAll.filter(p=> p.status !== 'maintenance');
    if (candidates.length === 0) { showWarn('没有可用的 AED 点位'); return; }

    const withDist = candidates.map(p=> ({ ...p, _km: haversine(userLatW, userLngW, p.lat, p.lng) }));
    withDist.sort((a,b)=> a._km - b._km);
    const target = withDist[0];

    navNameEl.textContent = `${target.name}（${target.building || ''} ${target.floor || ''}）`;
    navDistEl.textContent = `${target._km.toFixed(2)} km`;
    navETAEl.textContent = estimateWalkETA(target._km);
    navPanel.style.display = 'block';

    routeLayer.clearLayers();
    const userGCJ = wgs84ToGcj02(userLngW, userLatW);
    const targGCJ = wgs84ToGcj02(target.lng, target.lat);
    const userLatLng = [userGCJ[1], userGCJ[0]];
    const targLatLng = [targGCJ[1], targGCJ[0]];
    L.marker(userLatLng, { title:'我的位置' }).addTo(routeLayer);
    L.marker(targLatLng, { icon: statusIcon(target.status), title: target.name }).addTo(routeLayer);
    L.polyline([userLatLng, targLatLng], { color:'#2d6cdf', weight:4, opacity:0.85 }).addTo(routeLayer);
    map.fitBounds([userLatLng, targLatLng], { padding:[50,50] });

    const o = `${userGCJ[0]},${userGCJ[1]}`;
    const d = `${targGCJ[0]},${targGCJ[1]}`;
    const url = `https://uri.amap.com/navigation?from=${o}&to=${d}&mode=walk&src=whu_aed&callnative=0`;
    navGaodeLink.href = url;

    // 新增：点击顶部“在高德打开步行导航”时，计一次使用
    navGaodeLink.addEventListener('click', ()=> markUsed(target.id), { once:true });
  }, err=> showWarn('定位失败：' + err.message), { enableHighAccuracy:true, timeout:10000 });
});

clearRouteBtn.addEventListener('click', ()=>{
  routeLayer.clearLayers();
  navPanel.style.display = 'none';
});

// 初始化
updateChips();
loadAeds();
document.getElementById('reloadBtn').addEventListener('click', loadAeds);