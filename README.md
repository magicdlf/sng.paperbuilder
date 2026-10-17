# PaperBuilder

为 HiMCM/MidMCM 数模比赛打造的本地论文写作工具：浏览器里 Notion/Typora 式所见即所得编辑，一键导出符合 COMAP 规范的 LaTeX 并本地编译 PDF。

## 给本地 AI 的首次运行入口

这是 Node.js 后端 + React 浏览器编辑器，正文保存在本地 Markdown/JSON 文件中。先读 [AI_INSTALL_INSTRUCTIONS.md](AI_INSTALL_INSTRUCTIONS.md)，检查 Node 24 LTS 与 Git，再安装依赖；仅编辑无需 TeX。

**开始前先问用户：**

> 你想克隆 PaperKit 示例库先体验，还是新建自己的论文 Git 仓库？如果已有论文仓库，请提供地址，直接克隆使用。

- **示例体验（首次推荐）**：直接克隆 `https://github.com/magicdlf/sng.paperkit.git` 到应用目录以外的 `PaperKit/`，打开 `paperbuilder-guide/`，或让用户选择蜜蜂示例。不需要用户再提供示例库地址。
- **新建论文仓库**：询问仓库名和位置，在应用目录以外新建目录并 `git init`；复制内置 `template/` 的内容，将 `gitignore` 改名为 `.gitignore`，或复制用户选定的 PaperKit 论文文件，不携带示例库历史。启动时指向新目录。用户提供远程地址后配置 origin；本地初始化不会自动创建 GitHub 仓库。
- **克隆已有论文**：获取 URL，克隆到应用目录以外，确认存在 `paper.json` 与 `sections/`，再指向该目录启动。若克隆的是含多份论文的示例库，先让用户选一份，`--paper` 指向具体论文子目录而非库根目录。
- 不要要求没有团队仓库的新用户先创建 GitHub 仓库；之后可以再设置 remote。
- 不覆盖现有目录，不修改应用源码来适应安装，不自动推送。启动完成后报告浏览器地址、论文路径及停止方式。

```bash
# 在应用目录以外克隆示例库；已有克隆则复用
git clone https://github.com/magicdlf/sng.paperkit.git PaperKit
# 回到应用根目录，仅首次安装/更新依赖时执行
npm ci --registry=https://registry.npmmirror.com --loglevel=info
# 改为用户选择的绝对路径，路径有空格也可用
npm run dev -- --paper "/absolute/path/to/PaperKit/paperbuilder-guide"
# 浏览器入口：http://localhost:5173；终端 Ctrl+C 停止
```

应用代码与论文 Git 独立。示例库中的使用指南是一份可在编辑器中打开的论文，每章演示一个功能；正式团队应复制选定模板到自己的新仓库，不携带整个示例库或教师历史。

## 安装前提示：下载什么、从哪里下载

AI 执行安装前应先向用户说明：

> 接下来从大陆 npm 镜像 npmmirror（https://registry.npmmirror.com）下载 PaperBuilder 的 JavaScript 依赖，包括 React/TipTap 编辑器、KaTeX 公式预览、Hono 后端，以及 Vite、tsx、TypeScript、Vitest 等构建和测试工具及其依赖。文件安装到本项目 node_modules，不安装 TeX，也不安装系统 Node 或 Git。首次耗时取决于网络与缓存，安装时会显示请求和进度日志；完成后日常启动不需要重复安装。

项目 `.npmrc` 默认使用该镜像，不修改用户全局 npm 设置。`npm ci` 按 package-lock.json 固定版本安装，并重建 node_modules；不能在每次启动前执行。镜像说明见 [npmmirror](https://npmmirror.com/)，安装行为见 [npm ci 官方文档](https://docs.npmjs.com/cli/v11/commands/npm-ci/)。

安装长时间无进展时，AI 应检查最近的下载日志并说明正在下载什么；可先用 `npm ping --registry=https://registry.npmmirror.com` 检查连通性。不要静默改用其他源、关闭证书检查或删除锁文件。镜像缺包时先报告，再讨论替代源。GitHub 克隆、系统 Node/Git 安装不受 npm 镜像设置影响。

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

## 可选：本机编译 PDF（给 AI Agent）

读完安装说明后，agent 应主动告诉用户：

> 浏览器编辑、公式预览和 Git 功能不需要 TeX。本机生成 PDF 需要额外安装 TeX Live；Mac 可以安装 MacTeX（包含 TeX Live）。你希望现在安装编译环境，还是先只编辑、由教师编译？

只有用户选择本机编译时才安装。先检查已有环境，不重复安装完整发行版：

```bash
latexmk -v
pdflatex --version
xelatex --version
```

- **Windows**：从 [TeX Live 官方入口](https://tug.org/texlive/) 获取 Windows 安装器，优先完整安装，并确保 TeX 的可执行目录加入 PATH。Agent 按当前系统和官方说明完成安装，检查 latexmk 所需的 Perl 环境；不要仅下载一个编译器可执行文件。
- **macOS**：可从 [MacTeX](https://www.tug.org/mactex/) 安装，已有 Homebrew 时可用 `brew install --cask mactex-no-gui`（[说明](https://formulae.brew.sh/cask/mactex-no-gui)）。
- **Linux**：使用发行版的 TeX Live 包或官方安装器，包含 latexmk、pdflatex/xelatex 以及模板所需宏包和字体。

完整 TeX 环境体积较大、安装耗时较长，agent 应在执行前说明下载来源、安装位置及可能需要的权限，并在安装期间报告进展。大陆用户可按官方 CTAN 镜像列表选择就近镜像；npm 的 npmmirror 配置不影响 TeX 下载。

安装后重新打开终端，重新检查工具，再停止并重启 PaperBuilder，使后端继承新的 PATH。选择英文示例测试网页 PDF 编译；失败时先诊断工具路径、宏包、字体和编译日志，不自动修改应用源码。

TeX Live 支持 Windows，应用启动器和 PATH 拼接已做跨平台适配；**PaperBuilder 在 Windows 上的完整编译流程尚未实机验收**。默认 pdflatex 用于英文论文，中文指南不能直接按默认配置编译。`pdfinfo` 只是可选页数交叉验证工具，不是生成 PDF 的必需依赖。

## 快速开始

```bash
git clone git@github.com:magicdlf/sng.paperbuilder.git PaperBuilder
cd PaperBuilder
npm ci --registry=https://registry.npmmirror.com --loglevel=info
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
