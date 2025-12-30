// 管理员分析面板 + 数据体检（必填/坐标范围/重复与近邻/新鲜度）+ 使用统计（JSON + 本地累计）
(async function(){
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
  function daysBetween(d){
    try { const dt = new Date(d); if (isNaN(dt.getTime())) return null; return Math.floor((Date.now()-dt.getTime())/86400000); }
    catch { return null; }
  }
  function haversine(lat1, lon1, lat2, lon2){
    const toRad = d => d * Math.PI / 180, R = 6371;
    const dLat = toRad(lat2-lat1), dLon = toRad(lon2-lon1);
    const a = Math.sin(dLat/2)**2 + Math.cos(toRad(lat1))*Math.cos(toRad(lat2))*Math.sin(dLon/2)**2;
    return 2*R*Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  }

  // 读取本地“使用次数累计”（地图页点击导航时写入）
  function getLocalUsageMap(){
    try { return JSON.parse(localStorage.getItem('aed_usage_stats')||'{}'); } catch { return {}; }
  }

  function render(items){
    const total = items.length;
    const byStatus = items.reduce((acc, p) => { const s=(p.status||'unknown'); acc[s]=(acc[s]||0)+1; return acc; }, {});
    const byBuilding = items.reduce((acc, p)=>{ const b=(p.building||'未标注建筑'); acc[b]=(acc[b]||0)+1; return acc; }, {});
    const buildingsSorted = Object.entries(byBuilding).sort((a,b)=> b[1]-a[1]).slice(0,10);

    const freshness = { ok:0, warn:0, missing:0 };
    items.forEach(p=>{
      const days = daysBetween(p.last_inspection_at);
      if (days === null) freshness.missing++;
      else if (days > 180) freshness.warn++;
      else freshness.ok++;
    });

    document.getElementById('ana-summary')?.setAttribute('data-total', total);
    document.getElementById('ana-summary') && (document.getElementById('ana-summary').innerHTML = `
      <li>当前点位总数：<b>${total}</b></li>
      <li>建筑数（去重）：<b>${Object.keys(byBuilding).length}</b></li>
    `);
    document.getElementById('ana-status') && (document.getElementById('ana-status').innerHTML = Object.entries(byStatus)
      .sort((a,b)=> b[1]-a[1])
      .map(([s,c]) => `<li>${s}：<b>${c}</b></li>`).join('') || '<li>暂无状态统计。</li>');
    document.getElementById('ana-topbuildings') && (document.getElementById('ana-topbuildings').innerHTML = buildingsSorted
      .map(([b,c]) => `<li>${b}：<b>${c}</b></li>`).join('') || '<li class="meta">暂无建筑统计。</li>');
    document.getElementById('ana-freshness') && (document.getElementById('ana-freshness').innerHTML = `
      <li>180 天内已巡检：<b>${freshness.ok}</b></li>
      <li>超过 180 天需复核：<b>${freshness.warn}</b></li>
      <li>缺少巡检日期：<b>${freshness.missing}</b></li>
    `);

    renderUsage(items);
  }

  // 使用统计：合并 JSON 的 used_count 与本地累计，给出总览与 Top10
  function renderUsage(items){
    const localMap = getLocalUsageMap(); // { id: {count,last_ts} }
    const withUsage = items.map(p=>{
      const base = Number(p.used_count||0);
      const local = Number((localMap[String(p.id)]||{}).count||0);
      return { ref:p, used: base + local, base, local };
    });

    const sumJson = withUsage.reduce((s,x)=> s + x.base, 0);
    const sumLocal = withUsage.reduce((s,x)=> s + x.local, 0);
    const sumCombined = withUsage.reduce((s,x)=> s + x.used, 0);
    const rescuedSum = items.reduce((s,p)=> s + Number(p.rescued_count||0), 0);

    const top = [...withUsage].sort((a,b)=> b.used - a.used).slice(0,10);
    const byBuilding = {};
    withUsage.forEach(x=>{
      const b = x.ref.building || '未标注建筑';
      byBuilding[b] = (byBuilding[b]||0) + x.used;
    });
    const byBuildingTop = Object.entries(byBuilding).sort((a,b)=> b[1]-a[1]).slice(0,8);

    const anaUsageSummary = document.getElementById('ana-usage-summary');
    if (anaUsageSummary){
      anaUsageSummary.innerHTML = `
        <li>总使用次数（JSON）：<b>${sumJson}</b></li>
        <li>本地累计（会话交互）：<b>${sumLocal}</b></li>
        <li>合并后总计：<b>${sumCombined}</b></li>
        <li>救助人数合计（JSON）：<b>${rescuedSum}</b></li>
        <li class="note">注：本地累计来自用户点击导航的次数，仅用于演示；不会写回 aed.json。</li>
      `;
    }

    const anaUsageTop = document.getElementById('ana-usage-top');
    if (anaUsageTop){
      anaUsageTop.innerHTML = top.map(x=>{
        const p = x.ref;
        return `<li>${p.name}（${p.building||''} ${p.floor||''}） · 使用：<b>${x.used}</b>${x.local?`（本地+${x.local}）`:''}</li>`;
      }).join('') || '<li class="meta">暂无数据</li>';
    }

    // 也可把“按建筑累计使用 Top”渲染到一个新卡片，如需可在 admin.html 再加一个列表元素
    const elB = document.getElementById('ana-usage-buildings');
    if (elB){
      elB.innerHTML = byBuildingTop.map(([b,c])=> `<li>${b}：<b>${c}</b></li>`).join('');
    }
  }

  function dataHealth(items){
    const issues = { missing:[], badCoord:[], badStatus:[], dupId:[], nearDup:[] };
    const seenId = new Set();
    const inWH = (lat,lng)=> lat>29 && lat<31 && lng>113 && lng<116; // 武汉大致范围，避免误填
    const okStatus = new Set(['available','maintenance']);

    items.forEach((p,idx)=>{
      const miss = [];
      if (!p.id) miss.push('id');
      if (!p.name) miss.push('name');
      if (!p.building) miss.push('building');
      if (p.lat === undefined || p.lng === undefined) miss.push('lat/lng');
      if (!p.status) miss.push('status');
      if (miss.length) issues.missing.push({ idx, id:p.id||'', miss });

      const lat = Number(p.lat), lng = Number(p.lng);
      if (!isFinite(lat) || !isFinite(lng) || !inWH(lat,lng)) issues.badCoord.push({ idx, id:p.id||'', lat, lng });

      if (p.status && !okStatus.has(p.status)) issues.badStatus.push({ idx, id:p.id||'', status:p.status });

      if (p.id){
        if (seenId.has(p.id)) issues.dupId.push({ idx, id:p.id });
        else seenId.add(p.id);
      }
    });

    for (let i=0;i<items.length;i++){
      for (let j=i+1;j<items.length;j++){
        const a=items[i], b=items[j];
        if ((a.building||'') !== (b.building||'')) continue;
        if (!isFinite(a.lat) || !isFinite(a.lng) || !isFinite(b.lat) || !isFinite(b.lng)) continue;
        const d = haversine(a.lat, a.lng, b.lat, b.lng);
        if (d<0.05) issues.nearDup.push({ a:a.id||`#${i+1}`, b:b.id||`#${j+1}`, building:a.building, distKm:+d.toFixed(3) });
      }
    }
    return issues;
  }

  function renderHealth(issues){
    const el = document.getElementById('ana-check');
    if (!el) return;
    const parts = [];
    const lineList = (arr, mapFn) => arr.length ? `<ul>${arr.map(mapFn).join('')}</ul>` : '<div class="meta">无</div>';

    parts.push(`<div><b>缺失字段</b>（条目数：${issues.missing.length}）</div>`);
    parts.push(lineList(issues.missing, it=> `<li>#${it.idx+1} ${it.id} 缺失：${it.miss.join(', ')}</li>`));

    parts.push(`<div style="margin-top:6px"><b>坐标异常</b>（条目数：${issues.badCoord.length}）</div>`);
    parts.push(lineList(issues.badCoord, it=> `<li>#${it.idx+1} ${it.id} 坐标：${it.lat}, ${it.lng}</li>`));

    parts.push(`<div style="margin-top:6px"><b>非法状态值</b>（条目数：${issues.badStatus.length}）</div>`);
    parts.push(lineList(issues.badStatus, it=> `<li>#${it.idx+1} ${it.id} status=${it.status}</li>`));

    parts.push(`<div style="margin-top:6px"><b>重复 ID</b>（条目数：${issues.dupId.length}）</div>`);
    parts.push(lineList(issues.dupId, it=> `<li>#${it.idx+1} ${it.id}</li>`));

    parts.push(`<div style="margin-top:6px"><b>近邻疑似重复</b>（同建筑且<50m，条目数：${issues.nearDup.length}）</div>`);
    parts.push(lineList(issues.nearDup, it=> `<li>${it.building}：${it.a} ~ ${it.b} 距离约 ${it.distKm} km</li>`));

    el.innerHTML = parts.join('');
  }

  async function init(){
    const items = await loadPrefer();
    const list = Array.isArray(items) ? items : [];
    render(list);

    // 数据体检
    const btn = document.getElementById('btn-data-health');
    btn?.addEventListener('click', ()=>{
      const issues = dataHealth(list);
      renderHealth(issues);
    });

    // 地图分析叠加（跳转开关）
    document.getElementById('btn-open-map-coverage')?.addEventListener('click', ()=>{
      location.href = 'map.html#coverage=on';
    });
    document.getElementById('btn-open-map-grid')?.addEventListener('click', ()=>{
      location.href = 'map.html#grid=on';
    });
  }
  await init();

  // 管理员数据更新后，刷新统计与体检区
  window.addEventListener('aed-admin-data-updated', async ()=>{
    const items = await loadPrefer();
    render(Array.isArray(items)?items:[]);
    document.getElementById('ana-check') && (document.getElementById('ana-check').innerHTML = '');
  });
})();