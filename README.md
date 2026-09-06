# WORREMEMBER

秋招作战台：面向个人求职者的本地桌面流程管理工具。

安装包 MSI：src-tauri\target\release\bundle\msi\WORREMEMBER_2.0.0_x64_zh-CN.msi
安装包 EXE：src-tauri\target\release\bundle\nsis\WORREMEMBER_2.0.0_x64-setup.exe
直接运行文件：src-tauri\target\release\worremember.exe

## 当前版本：V2.0

V2.0 已完成核心看板、个人求职工作台和本地数据管理能力：

- Tauri 2 + React + TypeScript + Vite
- SQLite 数据库初始化与本地应用数据目录
- 岗位看板与默认招聘阶段
- 拖拽岗位切换阶段，并记录流程历史
- 新增岗位、岗位详情、优先级、截止日期和下一步行动
- 岗位链接与流程链接，可调用系统默认浏览器打开
- 搜索、缺失信息标记和本地数据降级存储
- 总览页：进行中岗位、今日待办、近期日程和最近备忘录
- 日程页：创建、关联和删除面试、笔试、投递截止及准备任务
- 备忘录：创建、关联岗位、置顶和删除
- 流程类别：通用、研发、产品及自定义类别，可增删类别和编辑阶段
- 岗位回收站：删除确认、恢复岗位
- JSON 全量导入导出、CSV 岗位导出和 SQLite 数据库备份
- JD 内容搜索与岗位流程类别持久化

当前暂未实现：Windows 系统通知、月/周日历视图、高级筛选、附件管理和云端同步。

## 本地开发环境

需要安装：

- Node.js 20+
- Rust stable
- Windows 10/11 的 Tauri 构建依赖

安装依赖后运行：

```powershell
npm install
npm run tauri dev
```

构建 Windows 安装包：

```powershell
npm run tauri build
```

正式构建会自动先执行 `npm run build`，生成最新的前端 `dist` 文件，再打包 Tauri 桌面程序。

桌面版应用数据库会保存到可执行文件同级的 `data` 目录中：`data\data.sqlite`，备份保存在 `data\backups`，并使用 SQLite WAL 模式降低异常退出时的数据风险。安装目录必须允许当前用户写入；如果安装到 `Program Files`，请使用管理员权限安装，或选择当前用户可写的目录。

浏览器预览模式仍使用浏览器的 `localStorage`，不会写入桌面版的 SQLite 文件。

当前版本已完成前端构建、Rust 检查和 Windows 安装包构建。构建产物位于 `src-tauri\target\release\bundle`。
