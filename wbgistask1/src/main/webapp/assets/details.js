// 详情页：读取 id，渲染信息、照片画廊、地图预览、导航链接
(async function(){
  // 数据读取：优先本地管理员数据，其次服务器
  async function loadPrefer(){
    try {
      const raw = localStorage.getItem('aed_admin_data');
      if (raw) {
        const list = JSON.parse(raw);
        if (Array.isArray(list)) return list;
      }
    } catch {}
    try { const r = await fetch('data/aed.json', { cache:'no-cache' }); return await r.json(); } catch { return []; }
  }
  // 坐标转换 WGS84 -> GCJ-02（与地图页一致）
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

  // 获取查询参数 id
  const params = new URL(location.href).searchParams;
  const id = params.get('id') || '';
  const list = await loadPrefer();
  const p = (Array.isArray(list) ? list : []).find(x => String(x.id) === String(id));

  const nameEl = document.getElementById('d-name');
  const metaEl = document.getElementById('d-meta');

  if (!p) {
    nameEl.textContent = '未找到该点位';
    metaEl.textContent = '请返回地图或管理员模式。';
    document.getElementById('btn-view-on-map').href = 'map.html';
    document.getElementById('btn-nav').href = 'https://uri.amap.com/navigation?mode=walk';
    return;
  }

  // 标题与状态
  nameEl.textContent = p.name || '未命名点位';
  metaEl.innerHTML = `状态：<span class="chip ${p.status==='available'?'success':'gray'}">${p.status || '—'}</span> · 建筑：${p.building || '—'} ${p.floor || ''}`;

  // 基本信息
  document.getElementById('d-building').textContent = `建筑：${p.building || '—'}`;
  document.getElementById('d-floor').textContent = `楼层：${p.floor || '—'}`;
  document.getElementById('d-room').textContent = `位置：${p.room || '—'}`;
  document.getElementById('d-status').innerHTML = `状态：<span class="chip ${p.status==='available'?'success':'gray'}">${p.status || '—'}</span>`;
  document.getElementById('d-open').textContent = `开放时间：${p.open_hours || '—'}`;
  document.getElementById('d-inspect').textContent = `上次巡检：${p.last_inspection_at || '—'}`;
  document.getElementById('d-latlng').textContent = `坐标（WGS84）：${p.lat}, ${p.lng}`;
  const acc = p.accessibility || {};
  document.getElementById('d-access').textContent = `无障碍：电梯 ${acc.elevator ? '✓' : '—'} · 坡道 ${acc.ramp ? '✓' : '—'}`;

  // 地图中查看（通过哈希让地图页聚焦）
  document.getElementById('btn-view-on-map').href = `map.html#${encodeURIComponent(String(p.id))}`;

  // 导航链接（从当前定位到该点的 GCJ-02）
  const g = wgs84ToGcj02(p.lng, p.lat);
  const dest = `${g[0]},${g[1]}`;
  document.getElementById('btn-nav').href = `https://uri.amap.com/navigation?to=${dest}&mode=walk&src=whu_aed&callnative=0`;

  // 照片画廊
  const gallery = document.getElementById('gallery');
  const photos = Array.isArray(p.photos) ? p.photos : [];
  if (photos.length) {
    gallery.innerHTML = photos.map(src => `
      <a href="${src}" target="_blank" rel="noopener" class="card" style="padding:6px">
        <img src="${src}" alt="photo" style="width:100%;height:120px;object-fit:cover;border-radius:8px"/>
      </a>
    `).join('');
    document.getElementById('gallery-note').style.display = 'none';
  } else {
    gallery.innerHTML = '<div class="meta">暂无照片。</div>';
  }

  // 位置预览地图
  const pm = L.map('previewMap', { zoom: 17 });
  const gaodeA = L.tileLayer('https://webrd0{s}.is.autonavi.com/appmaptile?style=7&x={x}&y={y}&z={z}', {
    subdomains:'1234', maxZoom:18, attribution:'© 高德地图'
  }).addTo(pm);
  const gcj = wgs84ToGcj02(p.lng, p.lat);
  const latlng = [gcj[1], gcj[0]];
  pm.setView(latlng, 17);
  L.marker(latlng, { title: p.name }).addTo(pm);
  setTimeout(()=> pm.invalidateSize(), 100);
})();