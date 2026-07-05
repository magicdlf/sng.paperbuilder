# HiMCM Paper

为 HiMCM/MidMCM 数模比赛打造的本地论文写作工具：浏览器里 Notion/Typora 式所见即所得编辑，一键导出符合 COMAP 规范的 LaTeX 并本地编译 PDF。

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

- macOS + Node.js ≥ 20
- MacTeX（`latexmk` / `pdflatex`，安装于 `/Library/TeX/texbin`）
- 可选：`brew install poppler`（pdfinfo，页数交叉验证）

## 快速开始

```bash
npm install
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

- **论文正文必须英文**：默认引擎 pdflatex 无法编译中日韩字符，导出前会自动检查并警告
- 公式请用 KaTeX/LaTeX 共同子集；多行推导用 `aligned` 环境（不要用 `align`）；编辑器渲染失败但 PDF 可能正常的公式会标记 "PDF-only"
- v1 表格不支持合并单元格（管道表语法限制，三线表规范也不鼓励）
- 本仓库的 `.npmrc` 将 npm 缓存指向 `~/.cache/npm-himcm`：因为机器上 `~/.npm` 内有历史 `sudo npm` 留下的 root 属主目录会导致安装失败；执行 `sudo chown -R $(whoami):staff ~/.npm` 修复后可删除该文件

## 开发

```bash
npm test          # round-trip 语料 + LaTeX golden 测试
npm run typecheck # 三个 workspace 全量类型检查
npm run build     # 构建 client 生产包
```

架构：npm workspaces —— `shared`（TipTap schema、markdown↔文档↔LaTeX、编号，同构无 DOM）+ `server`（Hono：文件/git/latexmk）+ `client`（React + TipTap）。一份 schema 三个消费者：编辑器、持久化、导出永不漂移；导出始终从磁盘 md 出发。
