# Will Daily 🎋

> 个人生产力工作台 — 日拱一卒。已上线于 [willchenhb.cc](https://willchenhb.cc)。

## 项目概述

**Will Daily** 是用 Claude Code（agent 驱动）从零构建并部署到生产环境的个人生产力应用。整个项目从需求拆解、架构设计、编码实现，到容器化部署、SSL 配置、线上调试，全链路由 AI agent 协同完成。

### 技术栈与产品功能

基于 **Next.js 14（App Router）+ TypeScript + Prisma + SQLite** 构建。已上线 8 大核心模块：

- **日记** — 含群聊摘要合并的时间线视图
- **周记** — 待办拖拽 + 周反思
- **笔记** — 分类归档 + AI 摘要
- **精选文章** — HTML 抓取 + 关键点提取
- **今日导读** — 时政 / AI / 产品热点 / 体育新闻四类，支持 API 推送 + 原始文本智能解析
- **项目管理** — 看板 + 里程碑 + 风险 + OKR 关联
- **知识图谱** — 基于关键词聚类 + Kimi embedding 向量化
- **用户认证** — bcrypt + Session + API Token 双通道

### Agent 驱动的具体成果

1. **完整产品交付**：从空仓库到生产可用，前端组件（Tiptap 富文本、dnd-kit 拖拽、sigma.js 图谱）、后端 API（30+ REST 端点）、数据库 Schema（13 张表）全部由 agent 生成并迭代修复。
2. **生产级部署链路**：agent 编写一键部署脚本 `deploy.sh`（自动化 Docker + Nginx + Certbot），并在手动上传阿里云 SSL 证书后，agent 主动识别冲突并重写 `setup-ssl.sh` 切换到本地证书路径。
3. **AI 能力集成**：接入 Kimi（Moonshot）API 实现笔记摘要、文章关键点提取、内容向量嵌入，构建出可视化知识图谱。
4. **真实问题修复**：上线后遇到的字段冲突、Docker 缓存权限、看板拖拽事件错乱、JSON 解析容错、国内访问 next/font 阻塞等问题，均由 agent 通过代码定位与最小化修改解决（commit 历史中 `fix:` 类提交清晰可见）。
5. **合规上线**：完成工信部 ICP 备案接入，agent 一次性在根布局与登录独立布局两处补齐备案号 footer。

### 协同模式

产品负责人提需求与决策，agent 承担工程师、运维、调试三个角色的执行。30+ 次迭代提交，体现了**"自然语言驱动 + AI 主动澄清歧义 + 增量交付"** 的现代研发范式。

---

## 快速开始

### 本地开发

```bash
npm install
npx prisma generate
npm run dev
```

打开 [http://localhost:3000](http://localhost:3000)。

### 环境变量

创建 `.env.local`：

```env
DATABASE_URL="file:./data/daily.db"
AUTH_ENABLED=true
KIMI_API_KEY=sk-xxxxx
```

### 默认账号

- 用户名：`admin`
- 密码：`admin123`（首次登录后请立即修改）

---

## 部署

### 一键部署到阿里云

```bash
# 1. SSH 登录服务器（Ubuntu 22.04+），上传代码到 /opt/will-daily
# 2. 运行
bash deploy.sh
```

脚本会自动安装 Docker / Nginx，构建镜像，配置反代和定时备份。

### SSL 证书

- 阿里云 / 自有证书：将 `.pem` 和 `.key` 放到 `/etc/nginx/ssl/`，运行 `bash setup-ssl.sh`
- Let's Encrypt：在 `deploy.sh` 中输入域名，由 certbot 自动申请

### 常用命令

```bash
docker compose logs -f          # 查看日志
docker compose restart          # 重启服务
docker compose up -d --build    # 更新部署
```

---

## 技术栈

| 层 | 选型 |
|---|---|
| 框架 | Next.js 14 (App Router) |
| 语言 | TypeScript |
| ORM | Prisma 7 + better-sqlite3 |
| UI | Tailwind CSS + Tiptap + dnd-kit |
| 图谱 | sigma.js + graphology |
| AI | Kimi (Moonshot) — embedding + chat |
| 部署 | Docker + Nginx + Alibaba Cloud ECS |

---

## License

Personal project, all rights reserved.
