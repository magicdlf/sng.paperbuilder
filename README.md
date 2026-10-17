# PaperBuilder

为 HiMCM/MidMCM 数模比赛打造的本地论文写作工具：浏览器里 Notion/Typora 式所见即所得编辑，一键导出符合 COMAP 规范的 LaTeX 并本地编译 PDF。

## 给本地 AI 的首次运行入口

这是 Node.js 后端 + React 浏览器编辑器，正文保存在本地 Markdown/JSON 文件中。先读 [AI_INSTALL_INSTRUCTIONS.md](AI_INSTALL_INSTRUCTIONS.md)，检查 Node 24 LTS 与 Git，再安装依赖；仅编辑无需 TeX。

**开始前先问用户：**

> 你想先创建本地试用论文，还是克隆已有团队/教师的论文 Git 仓库？如果克隆，请提供仓库地址（SSH 或 HTTPS）。

- **本地试用**：询问存放目录，选择不存在的目录，例如用户目录下 `PaperBuilderPapers/my-trial`；使用下面命令启动后会复制内置模板并初始化本地 Git，不会自动上传。
- **克隆已有论文**：获取 URL，克隆到应用目录以外，确认存在 `paper.json` 与 `sections/`，再指向该目录启动。若克隆的是含多份论文的示例库，先让用户选一份，`--paper` 指向具体论文子目录而非库根目录。
- 不要要求没有团队仓库的新用户先创建 GitHub 仓库；之后可以再设置 remote。
- 不覆盖现有目录，不修改应用源码来适应安装，不自动推送。启动完成后报告浏览器地址、论文路径及停止方式。

```bash
# 在应用根目录，仅首次安装/更新依赖时执行
npm ci
# 改为用户选择的绝对路径，路径有空格也可用
npm run dev -- --paper "/absolute/path/to/PaperBuilderPapers/my-trial"
# 浏览器入口：http://localhost:5173；终端 Ctrl+C 停止
```

应用代码与论文 Git 独立。示例库中的使用指南是一份可在编辑器中打开的论文，每章演示一个功能；正式团队应复制选定模板到自己的新仓库，不携带整个示例库或教师历史。

## 功能

- **所见即所得编辑**：标题/列表/引用块/代码块、行内与块级公式（LaTeX 源码 + KaTeX 实时预览）、三线表、图片（粘贴/拖放自动入库）；图/表可用控制条 ↑↓ 或 `Alt+↑/↓` 整块移动
- **多论文管理**：顶栏切换器列出 `~/HiMCMPapers` 下所有论文，一键新建/切换/打开任意路径；重启自动回到上次打开的论文
- **实时编号**：Figure/Table/Equation 编号在编辑器内实时显示，与最终 PDF 完全一致（同一套计数逻辑）
- **交叉引用**：`[@fig:x]` / `[@tbl:x]` / `[@eq:x]` / `[@sec:x]` chip 实时解析，导出为 cleveref `\Cref`
- **参考文献**：`references.json` 管理 + 正文 `[@key]` 引用，导出自动生成 References（无需 BibTeX）
- **git 版本管理**：一键提交、历史列表、任意两版 diff、按版本恢复单章节
- **批注**：选中文字加批注、线程回复/解决、锚点随编辑移动、删除文本后进孤儿区可重新挂靠；默认导出剥离，草稿模式输出 todonotes 边注
- **合规导出**：COMAP 官方样式（12pt Times、summary sheet 三栏头、`Team # / Page x of y` 页眉、自动目录、AI Use Report 不计页）+ 25 页超限警告（log/aux 双源 + pdfinfo 交叉验证）
- **git 友好存储**：每章一个 Markdown 文件，diff 可读、合并冲突少

## 环境要求

- Windows / macOS / Linux + Node.js 24 LTS（或 Node.js 22 ≥ 22.12）+ Git
- 仅编辑论文不需要 TeX，浏览器公式预览正常；PDF 由教师统一编译也可以
- 需要本机编译 PDF 时：安装 TeX Live / MacTeX，确保 `latexmk`、Perl、`pdflatex`（或 `xelatex`）可用；Windows 尚需实际机器验收
- 可选：`brew install poppler`（pdfinfo，页数交叉验证）

## 快速开始

```bash
git clone git@github.com:magicdlf/sng.paperbuilder.git PaperBuilder
cd PaperBuilder
npm ci
npm run dev                                   # 打开上次的论文（首次为 ~/HiMCMPapers/demo）
# 浏览器打开 http://localhost:5173 ；顶栏 📄 菜单可新建/切换论文
npm run dev -- --paper /path/to/paper         # 也可显式指定论文目录
```

生产模式（单端口、无 vite）：

```bash
npm start -- --paper ~/HiMCMPapers/2026       # http://localhost:4870
```

## 论文目录结构

```
你的论文目录/
├── paper.json        # 队伍控制码、题目、年份、章节顺序、导出配置
├── sections/*.md     # 每章一个 Markdown 文件（扩展语法见下）
├── assets/           # 图片（粘贴/拖放自动以内容哈希命名存入）
├── references.json   # 参考文献（应用内管理）
├── comments.json     # 批注线程
└── build/            # 导出的 paper.tex + paper.pdf（自包含，可直接上传 Overleaf；已 gitignore）
```

### Markdown 扩展语法

| 构件 | 写法 |
|---|---|
| 行内公式 | `$E=mc^2$` |
| 块级公式（带编号） | `$$` … `$$ {#eq:mass}` |
| 图 | `![题注](assets/x.png){#fig:plot width=70%}` |
| 表格题注 | 表格下一行 `Table: 题注 {#tbl:params}` |
| 标题标号 | `## Assumptions {#sec:assumptions}` |
| 交叉引用 | `[@fig:plot]`（fig/tbl/eq/sec 前缀） |
| 文献引用 | `[@smith2020]`、多引 `[@a; @b]` |
| 批注锚点 | `<span data-comment-id="c_x">…</span>`（应用自动管理） |

文件可以用任何编辑器手改；应用首次保存时会归一化为规范形（之后 diff 稳定零噪声）。

## 注意事项

- 给学生 AI 的完整操作说明见 [AI_INSTALL_INSTRUCTIONS.md](AI_INSTALL_INSTRUCTIONS.md)
- 应用仓库与团队论文仓库应分别克隆；使用 `--paper` 指定团队论文目录。内置 `template/` 保留为最小示例，真实课堂论文放在独立私有仓库
- 应用内 Git 提交不会自动 push/pull；多人按章节分工，外部同步时先关闭编辑页面。当前不支持实时共同编辑
- 同一后端进程只有一篇当前论文，不要让不同组共用同一进程

- **论文正文必须英文**：默认引擎 pdflatex 无法编译中日韩字符，导出前会自动检查并警告
- 公式请用 KaTeX/LaTeX 共同子集；多行推导用 `aligned` 环境（不要用 `align`）；编辑器渲染失败但 PDF 可能正常的公式会标记 "PDF-only"
- v1 表格不支持合并单元格（管道表语法限制，三线表规范也不鼓励）
- 若 npm 默认缓存有权限问题，可用 `npm ci --cache ./node_modules/.cache/npm`，不要使用 `sudo npm install`

## 开发

```bash
npm test          # round-trip 语料 + LaTeX golden 测试
npm run typecheck # 三个 workspace 全量类型检查
npm run build     # 构建 client 生产包
```

架构：npm workspaces —— `shared`（TipTap schema、markdown↔文档↔LaTeX、编号，同构无 DOM）+ `server`（Hono：文件/git/latexmk）+ `client`（React + TipTap）。一份 schema 三个消费者：编辑器、持久化、导出永不漂移；导出始终从磁盘 md 出发。
