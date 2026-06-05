# 视频获取 — 设计脚本 v1

## 一、架构总览

```
用户浏览器                     Railway 云服务
┌─────────────────┐    HTTP    ┌──────────────────────┐
│  weilizhe8.com   │ ────────→ │  FastAPI + yt-dlp    │
│  粘贴 B站/抖音链接  │ ←──────── │  Python 3.11         │
│  选择清晰度→下载   │   JSON    │  ffmpeg (合并音视频)   │
└─────────────────┘           └──────────────────────┘
```

- **前端**: 在现有 Astro 站点新增 "视频获取" 标签页
- **后端**: FastAPI 轻量服务，核心接口两个，yt-dlp 负责所有视频平台解析
- **部署**: Railway Docker 部署，免费额内使用

---

## 二、后端设计

### 目录结构

```
video-dl-backend/
├── main.py              # FastAPI 应用（单文件）
├── requirements.txt     # 依赖
├── Dockerfile           # Railway 部署
└── .gitignore
```

### API 设计

#### 接口 1: `POST /api/info`

解析视频链接，返回元数据和可下载格式清单。

```json
// 请求
{ "url": "https://www.bilibili.com/video/BV1xx411c7mD" }

// 响应
{
  "title": "【4K】某个视频标题",
  "duration": 360,
  "thumbnail": "https://...",
  "uploader": "UP主名称",
  "formats": [
    { "format_id": "16",  "resolution": "360p",  "ext": "mp4",  "filesize_mb": 8.5 },
    { "format_id": "32",  "resolution": "720p",  "ext": "mp4",  "filesize_mb": 22.0 },
    { "format_id": "80",  "resolution": "1080p", "ext": "mp4",  "filesize_mb": 55.3 },
    { "format_id": "125", "resolution": "4K",    "ext": "mp4",  "filesize_mb": 180.2 }
  ],
  "platform": "bilibili"
}
```

#### 接口 2: `POST /api/download`

根据用户选中的清晰度，返回直链。

```json
// 请求
{ "url": "https://www.bilibili.com/video/BV1xx411c7mD", "format_id": "80" }

// 响应
{
  "download_url": "https://upos-sz-mirror.bilivideo.com/...",
  "filename": "【4K】某个视频标题_1080p.mp4"
}
```

### 技术实现要点

- yt-dlp 以 **Python 库方式** 调用（非 subprocess），获得结构化数据
- `--dump-json` 提取视频信息，`-g -f <id>` 获取直链
- B站 1080p+ 视频音视频分离时，降级返回 `best` 合并流
- 设置合理超时（30s），防止僵尸请求
- CORS 全开（后续可收紧为只允许 weilizhe8.com）

### requirements.txt

```
fastapi==0.115.6
uvicorn==0.34.0
yt-dlp==2025.4.30
```

### Dockerfile

```dockerfile
FROM python:3.11-slim
RUN apt-get update && apt-get install -y ffmpeg && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY main.py .
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8080"]
```

---

## 三、前端设计

### 改动范围

| 文件 | 改动 |
|------|------|
| `src/components/Sidebar.astro` | 新增编号 12 的 `视频获取` 导航按钮 |
| `src/pages/index.astro` | 新增 `tab-video-dl` 标签页 + JS 逻辑 |

### UI 布局

```
┌──────────────────────────────────────────────────┐
│  视频获取                                         │
├──────────────────────────────────────────────────┤
│                                                  │
│  ┌──────────────────────────────────────────┐    │
│  │  📎 粘贴视频链接（B站、抖音、YouTube等）      │    │
│  │  [______________________________] [解析]    │    │
│  └──────────────────────────────────────────┘    │
│                                                  │
│  ┌── 解析后显示 ────────────────────────────┐    │
│  │  ┌──────────┐                              │    │
│  │  │ 缩略图    │  视频标题                     │    │
│  │  │          │  UP主 · 时长 05:30            │    │
│  │  └──────────┘                              │    │
│  │                                            │    │
│  │  选择清晰度:                                │    │
│  │  ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐      │    │
│  │  │ 360p │ │ 720p │ │1080p*│ │ 4K   │      │    │
│  │  │ 8.5M │ │ 22M  │ │ 55M  │ │180M  │      │    │
│  │  └──────┘ └──────┘ └──────┘ └──────┘      │    │
│  │                                            │    │
│  │  [⬇ 下载视频]                               │    │
│  └──────────────────────────────────────────┘    │
│                                                  │
│  支持平台: B站 · 抖音 · YouTube · 小红书 · ...     │
└──────────────────────────────────────────────────┘
```

### JS 交互流程

```
1. 用户粘贴链接 → 前端校验 URL 格式
2. 点击"解析" → 按钮 loading，POST /api/info
3. 返回视频信息 → 展示缩略图、标题、清晰度选项
4. 用户选择清晰度 → 高亮选中
5. 点击"下载" → POST /api/download → 拿到直链 → window.open 触发下载
```

### 状态处理

- **加载中**: 解析按钮显示 spinner
- **解析失败**: 红色提示 "解析失败，请检查链接是否有效"
- **后端不可达**: 提示 "服务暂不可用，请稍后重试"（带后端状态指示器）
- **下载中**: 按钮显示 "获取下载链接中..."

### 后端地址配置

后端地址写在 JS 常量中，方便切换：

```js
const VIDEO_DL_BACKEND = 'https://video-dl-weilizhe8.up.railway.app';
```

开发时改用 `http://localhost:8080`。

---

## 四、部署步骤

### 后端部署到 Railway

1. 将 `video-dl-backend/` 推送到 GitHub 仓库
2. 在 Railway 新建项目 → Deploy from GitHub repo
3. Railway 自动识别 Dockerfile 并构建
4. 获取分配的域名（如 `video-dl-weilizhe8.up.railway.app`）
5. 将该域名填入前端 JS 的 `VIDEO_DL_BACKEND`

### 前端部署（不变）

前端只需在现有 Astro 站点新增标签页，跟随 `npm run build` 一起部署到 Cloudflare Pages。

---

## 五、成本与限制

| 项目 | 明细 |
|------|------|
| Railway 免费额度 | $5/月，约支撑 500-2000 次解析/月 |
| 闲置休眠 | 免费版 30 分钟无请求后休眠，首次请求唤醒需 10-30s |
| 视频下载 | 浏览器直接下载，不走后端流量（后端只给 URL） |
| yt-dlp 更新 | yt-dlp 每周自动更新，保持平台兼容性 |
| 总现金成本 | **¥0/月** |

---

## 六、待确认项

1. **后端仓库**: video-dl-backend 放到哪个 GitHub 账号？
2. **Railway 账号**: 你是否有 Railway 账号？还是需要先注册？
3. **要不要支持 YouTube**？需要梯子环境，Railway 美西节点理论可行但不确定
4. **是否开工实现**？
