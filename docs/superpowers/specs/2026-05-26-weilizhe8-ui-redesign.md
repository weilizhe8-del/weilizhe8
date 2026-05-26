# weilizhe8.com UI 重构设计规格

## Context

将 weilizhe8.com 全面 UI 升级为 Linear x ConductorAI 融合风格：紫罗兰配色、Linear 高端侧边栏、ConductorAI 终端美学（`>>>` 前缀、monospace 数据标注、状态驱动 UI），并实现正确的暗色/亮色双主题切换。

## Design System

### Color Palette

**Dark mode:**
```
--bg-page:        #0a0a0a
--bg-card:        #111113
--bg-card-hover:  #161618
--bg-input:       #161618
--bg-sidebar:     #0c0c0e
--border-default: #1a1a1a
--border-subtle:  #1f1f22
--text-primary:   #fafafa
--text-secondary: #a1a1aa
--text-muted:     #71717a
--accent:         #7c3ed4
--accent-soft:    #a78bfa
--accent-light:   #c4b5fd
--accent-glow:    rgba(124,62,212,0.10)
--success:        #34d399
--warning:        #fbbf24
--danger:         #f87171
```

**Light mode:**
```
--bg-page:        #fafafa
--bg-card:        #ffffff
--bg-card-hover:  #f5f5f7
--bg-input:       #f0f0f3
--bg-sidebar:     #f5f5f7
--border-default: #e5e5e7
--border-subtle:  #f0f0f3
--text-primary:   #0a0a0a
--text-secondary: #52525b
--text-muted:     #9a9aa5
--accent:         #6d28d9
--accent-soft:    #7c3ed4
--accent-light:   #8b5cf6
--accent-glow:    rgba(109,40,217,0.06)
--success:        #059669
--warning:        #d97706
--danger:         #dc2626
```

### Typography

- **Sans-serif**: Inter (字重 300/400/500/600/700), system-ui fallback
- **Monospace**: JetBrains Mono (字重 400/500/600)
- 小字体统一 font-weight: 500 起步，标签 600
- `>>> ` 前缀用 monospace，accent 色

### Sidebar (Linear Style)

- 顶部：32px 渐变 logo 方块 (#c4b5fd → #7c3ed4) + "WEILIZHE8" 粗体 + "ACADEMIC TERMINAL" monospace 小字副标题
- 导航项：编号徽章 (01-09，border + monospace) + 中文标签
- 激活态：圆角卡片 (border-radius: 6px) + 微渐变背景 + 紫色微边框 + 编号徽章变紫
- 悬停态：文字变 accent-light + 背景微亮，0.2s 过渡
- 分隔线：导航组之间 1px border-subtle
- 底部：主题切换按钮 + "BUILD 2.0" 版本号 + 状态点

### Cards

- 背景：微妙对角线渐变 (from #111113 to #161618)
- 装饰：右上角 radial 光斑 overlay (rgba(124,62,212,0.08))
- `>>> 标题`：monospace 小标签，accent 色
- 内容：progress bar 用渐变填充 (#7c3ed4 → #a78bfa)
- 状态 pill：小圆角标签 (danger/soft bg + danger 文字)
- 悬停动画：scale(1.02) + 紫色微边框 + 阴影浮现，0.3s cubic-bezier(0.4,0,0.2,1)
- 统计小格：3 列 Bento grid (monospace 数字 + 小标签)

### Modals

- 背景: var(--bg-card), border: var(--border-default)
- 输入框: var(--bg-input), focus:border-accent
- 取消按钮: border + text-secondary, hover:text-primary
- 确认按钮: accent-soft bg + accent border + accent text

## Files to Modify

1. **`src/layouts/Layout.astro`** — CSS 变量系统 + 防 FOUC 脚本 + 全局样式
2. **`src/components/Sidebar.astro`** — Linear 侧边栏 + 主题切换按钮 + 悬停动效
3. **`src/pages/index.astro`** — 所有 tab pane 替换为 CSS 变量 + 卡片 A 风格 + 悬停动画
4. **`src/components/Modals.astro`** — 弹窗颜色 token 替换

## Theme Switching

- `<html data-theme="dark">` 默认
- 防 FOUC：`<head>` 最顶部 inline script，同步读 localStorage 设 `data-theme`
- 切换：Sidebar 底部按钮，toggle `data-theme` + 保存 `wd_theme`
- 首次访问：fallback 到 `prefers-color-scheme`
- 全局过渡：`*, *::before, *::after { transition: background-color 0.2s, border-color 0.2s, color 0.15s }`

## Preserved Functionality

所有现有功能完整保留：
- 9 个 tab (dashboard/calendar/courses/gpa/tools/script-builder/base-converter/latex-tool/spinner)
- localStorage 数据持久化 (wd_courses/wd_events/wd_quick_links/wd_tool_links/wd_grades/wd_wheel)
- 演示数据初始化 + 版本迁移
- 日程四象限拖拽
- 绩点计算器 (5分制/百分制)
- 决策转盘 (Canvas 动画)
- 三个 iframe 子应用
- 学期进度、倒计时、时钟
- 所有 CRUD 操作

## Verification

1. `npm run build` → 0 errors
2. 暗色模式：所有卡片、侧边栏、模态框、输入框正确渲染
3. 亮色模式：点击切换按钮，所有元素过渡到亮色，无硬编码暗色残留
4. 刷新后主题偏好保留
5. 所有 tab 切换正常，所有 CRUD 操作正常
6. 卡片悬停动画流畅 (scale + border + shadow)
7. Cloudflare Pages 部署后验证线上效果
