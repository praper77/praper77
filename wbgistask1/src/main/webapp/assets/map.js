let map, markers = [];
(async function init(){
  const aeds = await loadAEDData();

  map = L.map('map').setView([30.541, 114.36], 15);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; OpenStreetMap'
  }).addTo(map);

  const layerGroup = L.layerGroup().addTo(map);
  function render(list){
    layerGroup.clearLayers();
    markers = list.map(p => {
      const m = L.marker([p.lat, p.lng]).addTo(layerGroup);
      m.bindPopup(`
        <strong>${p.name}</strong><br/>
        状态：${p.status} · ${p.open_hours || '—'}<br/>
        位置：${p.building} ${p.floor || ''}<br/>
        <a href="details.html?id=${encodeURIComponent(p.id)}">查看详情</a>
      `);
      return m;
    });
  }
  render(aeds);

  const inpBuilding = document.getElementById('filter-building');
  const selStatus = document.getElementById('filter-status');
  function applyFilters(){
    const b = (inpBuilding.value||'').trim();
    const s = (selStatus.value||'').trim();
    const filtered = aeds.filter(p => {
      const okB = b ? (p.building.includes(b) || p.name.includes(b)) : true;
      const okS = s ? p.status === s : true;
      return okB && okS;
    });
    render(filtered);
  }
  inpBuilding.addEventListener('input', applyFilters);
  selStatus.addEventListener('change', applyFilters);

  const nearestList = document.getElementById('nearest-list');
  document.getElementById('locate-btn').addEventListener('click', ()=>{
    if (!('geolocation' in navigator)) {
      nearestList.innerHTML = '<p>设备不支持定位。</p>';
      return;
    }
    navigator.geolocation.getCurrentPosition(pos=>{
      const { latitude, longitude } = pos.coords;
      L.marker([latitude, longitude], { title: '你的位置' }).addTo(map);
      map.setView([latitude, longitude], 16);
      const withDist = aeds.map(p=>({ ...p, distance: haversine(latitude, longitude, p.lat, p.lng) }));
      withDist.sort((a,b)=>a.distance-b.distance);
      const top3 = withDist.slice(0,3);
      nearestList.innerHTML = top3.map(p => `
        <a class="card" href="details.html?id=${encodeURIComponent(p.id)}">
          <div class="card-title">${p.name}</div>
          <div class="card-meta">约 ${(p.distance).toFixed(2)} km · 状态：${p.status}</div>
          <div class="card-meta">位置：${p.building} ${p.floor || ''}</div>
        </a>
      `).join('');
    }, err=>{
      nearestList.innerHTML = '<p>定位失败，请检查权限设置。</p>';
    }, { enableHighAccuracy: true, timeout: 8000 });
  });

  const hashId = location.hash ? decodeURIComponent(location.hash.slice(1)) : null;
  if (hashId) {
    const target = aeds.find(p => p.id === hashId);
    if (target) {
      map.setView([target.lat, target.lng], 18);
      L.popup().setLatLng([target.lat, target.lng])
        .setContent(`<strong>${target.name}</strong><br/><a href="details.html?id=${encodeURIComponent(target.id)}">查看详情</a>`)
        .openOn(map);
    }
  }
})();