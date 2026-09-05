# WORREMEMBER

秋招作战台：面向个人求职者的本地桌面流程管理工具。

安装包 MSI：src-tauri\target\release\bundle\msi\WORREMEMBER_0.1.0_x64_zh-CN.msi
安装包 EXE：src-tauri\target\release\bundle\nsis\WORREMEMBER_0.1.0_x64-setup.exe
直接运行文件：src-tauri\target\release\worremember.exe

## 当前版本

V0.1 核心看板已经搭建：

- Tauri 2 + React + TypeScript + Vite
- SQLite 数据库初始化与本地应用数据目录
- 岗位看板与默认招聘阶段
- 拖拽岗位切换阶段，并记录流程历史
- 新增岗位、岗位详情、优先级、截止日期和下一步行动
- 岗位链接与流程链接，可调用系统默认浏览器打开
- 搜索、缺失信息标记和本地数据降级存储

V0.2 计划加入 Markdown 备忘录、任务与日程、系统提醒、全文搜索以及 JSON 导入导出。附件功能暂不进入 V0.1。

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

应用数据库会保存到 Windows 应用数据目录下的 `WORREMEMBER` 数据目录中，并使用 SQLite WAL 模式降低异常退出时的数据风险。

当前开发环境尚未提供 Node.js/npm 和 Rust/Cargo，因此尚未执行依赖安装、前端构建或 Windows 安装包构建。
