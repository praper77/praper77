# 武汉大学 AED 导航项目说明

本项目是一个基于 Leaflet 的前端 WebGIS 应用，统一使用高德（Gaode）底图，提供 AED 点位展示、筛选、导航、管理员编辑与数据导入导出等功能。适合课程作业与演示场景。

## 快速上手

- 启动方式：将 `webapp/` 作为网站根目录在 Tomcat/Eclipse 中运行，然后访问
  - 首页：`http://localhost:8080/项目名/index.html`
  - 地图：`http://localhost:8080/项目名/map.html`
  - 管理员模式：`http://localhost:8080/项目名/admin.html`
  - 紧急模式：`http://localhost:8080/项目名/emergency.html`

- 必须确保本地 Leaflet 资源存在并可访问（均在 `webapp/assets/leaflet/` 下）：
  - `leaflet.css`、`leaflet.js`、`images/marker-icon.png` 等
  - 访问检查：
    - `http://localhost:8080/项目名/assets/leaflet/leaflet.css`
    - `http://localhost:8080/项目名/assets/leaflet/leaflet.js`

- 地图不显示的常见原因：
  - 地图容器高度为 0。`map.html` 中的 `#map` 已强制 `style="height:62vh"`，如仍灰屏请检查控制台与网络面板。

## 项目结构

```
webapp/
  assets/
    leaflet/              # 本地 Leaflet 库与默认图标
      leaflet.css
      leaflet.js
      images/
    styles.css            # 全站样式与主题（含深色模式）
    app.js                # 通用数据加载与距离计算
    map-enhanced.js       # 地图页逻辑（高德底图、筛选、导航）
    admin2.js             # 管理员页逻辑（表格/表单/导入导出/拾取地图）
    admin-auth.js         # 管理员前端身份验证（演示用）
  data/
    aed.json              # AED 点位数据（WGS84 坐标）
  images/                 # 点位照片（可选）
  tools/
    aed_points_template.csv   # 采集模板（CSV）
    csv2json.html             # CSV 转 JSON 的本地工具
    README.md                 # 工具说明
  index.html              # 首页（最近 3 个 AED 卡片）
  map.html                # 地图（高德底图 + 筛选 + 导航）
  admin.html              # 管理员模式（带登录、拾取地图）
  details.html            # 点位详情页
  emergency.html          # 紧急模式（节拍器 + 文本指引）
  report.html             # 上报问题（LocalStorage 演示）
  test-solid-layer.html   # 纯色瓦片自检页（不依赖外网）
```

## 页面与功能

- 首页（`index.html`）
  - 提供入口（地图、紧急模式、管理员）
  - 自动定位并展示最近 3 个 AED 卡片（仅演示）

- 地图（`map.html`）
  - 底图统一为高德（A/B/C 三种备选域名，默认 A）
  - 过滤与搜索：名称/建筑、状态
  - “定位我的位置”：浏览器定位（WGS84）→ 转 GCJ‑02 → 高德底图绘制
  - “导航到最近 AED”：计算最近、绘制直线示意、生成高德步行导航外链
  - 弹窗包含“详情/编辑”快捷链接

- 管理员模式（`admin.html`）
  - 前端身份验证（演示用）：默认密码 `whuaed2025`
    - 修改密码：`assets/admin-auth.js` 文件开头 `ADMIN_PASS`
  - 数据管理：
    - 从服务器加载 `data/aed.json`
    - 导入/导出 JSON
    - 新增/编辑/删除记录
    - 应用到地图预览（保存到浏览器 LocalStorage，键名 `aed_admin_data`）
  - 拾取地图（高德底图）：
    - 点击地图自动填充坐标（显示值为 GCJ‑02，保存时自动转回 WGS84 存储）

- 详情页（`details.html`）
  - 展示单个点位的详细信息，提供“地图中查看”和“编辑此点位”

- 紧急模式（`emergency.html`）
  - 文本步骤与 100 BPM 节拍器（手机振动支持）

- 上报问题（`report.html`）
  - 将用户输入暂存到浏览器 LocalStorage（演示用，不会上报服务器）

## 数据与坐标体系

- 存储统一用 WGS84（EPSG:4326），与浏览器定位一致。
- 高德底图显示与导航链接必须使用 GCJ‑02 坐标：
  - 前端在渲染与导航时运行 WGS84 → GCJ‑02 的转换（`map-enhanced.js`）
  - 管理员拾取坐标时，点击得到 GCJ‑02（高德底图），保存时近似反算为 WGS84（`admin2.js`）

### AED 数据结构示例

```json
{
  "id": "whu_aed_001",
  "name": "信息学部主楼一层大厅",
  "lat": 30.538712,           // WGS84
  "lng": 114.355149,          // WGS84
  "building": "信息学部主楼",
  "floor": "1F",
  "room": "大厅西侧",
  "status": "available",      // 或 "maintenance"
  "open_hours": "08:00-22:00",
  "device_model": "Zoll AED Plus",
  "last_inspection_at": "2025-10-20",
  "photos": ["images/aed_001_1.jpg"],
  "accessibility": { "ramp": true, "elevator": true },
  "notes": "保安亭旁边，绿色AED标识"
}
```

## 数据维护方式

- 管理员页维护（推荐演示）
  1. 打开 `admin.html`，输入管理员密码（默认 `whuaed2025`）
  2. 点击“从服务器加载 aed.json”获取当前数据
  3. 右侧地图拾取坐标（自动填充表单），完善字段后“保存/更新”
  4. “应用到地图预览”将数据写入本地（LocalStorage）；地图页会优先使用本地数据演示
  5. “导出 JSON”得到 `aed.json`，手工替换 `webapp/data/aed.json` 完成交付

- CSV → JSON 转换（批量）
  1. 在 `tools/aed_points_template.csv` 按模板填写点位
  2. 打开 `tools/csv2json.html`，拖拽 CSV，复制生成的 JSON
  3. 粘贴到 `webapp/data/aed.json`，刷新地图

## 技术栈

- 前端：HTML/CSS/JavaScript、Leaflet（本地引入）
- 底图：高德在线瓦片（A/B/C 备选）
- 数据：JSON（WGS84），管理员模式演示用 LocalStorage
- 无后端版：所有修改仅在浏览器本机生效（导出文件再手动发布）

## 常见问题排查

- 地图区域灰屏或不显示
  - 检查 `#map` 是否有固定高度（已在 `map.html` 强制 `height:62vh`）
  - 确认 `assets/leaflet/leaflet.css/js` 加载为 200（非 404/0）
  - Network 中高德瓦片请求是否 200；若失败尝试切换高德 A/B/C
  - Console 是否报错（未定义 L、脚本路径错误等）

- 点位偏移
  - 确认数据以 WGS84 存储
  - 高德渲染/导航时必须转换为 GCJ‑02（代码已处理）
  - 管理员拾取坐标时，保存时自动转回 WGS84

- 管理员身份验证
  - 演示用纯前端验证，不适合生产；修改密码在 `assets/admin-auth.js` 的 `ADMIN_PASS` 常量

## 可选后端功能（扩展路径）

若需要服务端支持，可新增：
- REST API（CRUD、检索、最近点位、上报存储）
- 认证鉴权（会话/JWT，角色：admin/editor/viewer）
- 数据库（PostgreSQL + PostGIS 或 MySQL）
- 图片上传与缩略图生成（本地或对象存储）
- 室外路径规划（OSRM/GraphHopper 或代理高德服务）
- 瓦片服务（校内离线瓦片，TileServer GL）

前端改造点：
- 用 `/api/aeds` 替代 `data/aed.json`
- 管理员模式的增删改走后端接口，移除 LocalStorage 仅演示的逻辑

## 提交材料建议

- README（即本文件）
- `data/aed.json`（不少于 10–20 条点位，字段完整）
- 演示视频（2–3 分钟，地图定位→最近点位→详情→导航→紧急模式→管理员编辑）
- 截图（地图页、详情页、管理员页、紧急模式）
- 隐私与免责声明说明（本页“隐私与责任”）

## 隐私与责任

- 本项目仅用于教学演示，不承诺数据的完整性与实时性。
- 数据采集应避免包含个人隐私与人像；如有请进行模糊处理。
- 实际急救请遵循专业医疗人员指引与规范流程。

---
维护人：你的小组/姓名  
更新日期：2025-12-10