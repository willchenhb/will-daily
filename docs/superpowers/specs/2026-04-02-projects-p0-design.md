# 项目管理 P0 优化设计文档

## 概述

对 `src/app/projects/page.tsx` 进行 7 项 P0 级优化，提升基础体验和代码可维护性。

## 1. 组件拆分

当前 page.tsx 约 1050+ 行，拆分为：

```
src/app/projects/
  page.tsx                  — 主页面（状态管理、数据获取、视图切换）
  constants.ts              — OKR_OPTIONS、OKR_MEMBERS、CATEGORIES 等常量
  components/
    NewProjectModal.tsx     — 新建项目弹窗
    CsvImportModal.tsx      — CSV 导入弹窗
    SidePanel.tsx           — 项目详情侧面板
    BoardView.tsx           — 看板视图（新增）
    TableView.tsx           — 表格视图（从 page.tsx 提取）
    ConfirmDialog.tsx       — 通用确认对话框（新增）
```

拆分原则：每个组件通过 props 接收数据和回调，page.tsx 只负责状态管理和数据获取。

## 2. 表格排序

- 表头可点击，显示排序箭头（▲/▼/无）
- 支持字段：优先级、截止日期、健康度、负责人、状态
- 三态切换：升序 → 降序 → 无排序
- 排序状态 `{ field: string | null, direction: 'asc' | 'desc' }` 在 page.tsx 管理
- 排序在前端内存中完成（数据量不大）

## 3. 按负责人筛选

- 在现有分类/状态筛选栏旁增加负责人筛选 pills
- 数据源：OKR_MEMBERS + 项目中已有 owner 去重
- 支持多选（点击切换选中/取消）
- 筛选逻辑：选中任意一个 owner 即匹配

## 4. 删除确认

- 新建 `ConfirmDialog` 组件
- Props: `title`, `message`, `onConfirm`, `onCancel`
- 确认按钮红色背景，取消按钮灰色边框
- 点击背景遮罩 = 取消
- 里程碑删除和风险删除均使用此组件

## 5. Description 字段

- **新建弹窗**：在项目名称下方增加 textarea，placeholder "项目描述（选填）..."
- **详情面板**：在项目名称下方显示，点击可内联编辑（textarea 模式）
- **API**：现有 Prisma schema 已有 description 字段，确认 API route 已支持读写

## 6. 风险编辑概率/影响

- 风险列表每项显示概率和影响的 inline select
- 概率选项：低/中/高
- 影响选项：低/中/高
- 修改后即时调用 `PATCH /api/projects/[id]/risks/[rid]` 保存
- 如后端缺少此 API，需补充

## 7. 看板视图

- **切换方式**：页面顶部 Tab 切换「表格 | 看板」
- **列定义**：未开始(not_started) | 进行中(in_progress) | 已完成(completed) | 已暂停(on_hold)
- **卡片内容**：项目名称、负责人、优先级标签、健康度圆点、截止日期
- **拖拽**：使用 `@dnd-kit/core` + `@dnd-kit/sortable`
- **拖拽逻辑**：拖到另一列 → 调用 API 更新状态 → 刷新数据
- **筛选共享**：看板与表格共享搜索、分类、状态、负责人筛选

## 实施顺序

1. 提取 constants.ts
2. 拆分组件（NewProjectModal → CsvImportModal → SidePanel → TableView）
3. 新增 ConfirmDialog
4. 表格排序
5. 按负责人筛选
6. Description 字段
7. 风险编辑
8. 安装 @dnd-kit，实现 BoardView
9. 视图切换 Tab
10. 验证构建和功能
