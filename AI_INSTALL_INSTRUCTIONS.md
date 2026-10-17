# PaperBuilder：给 AI 的安装与启动说明

请帮助学生在本机安装、配置并启动 PaperBuilder。请实际执行检查和启动，遇到需要管理员权限或浏览器登录的步骤，再请学生完成对应操作。

当前代码和 npm 包中仍可能出现 `HiMCM Paper`、`himcm-paper`、`@himcm/*` 等旧名称，这是正常情况，不要为了安装而重命名代码。

## 目标与输入

默认学生在浏览器中编辑论文，教师统一编译 PDF。**默认不安装 TeX、MacTeX、TeX Live、latexmk 或 Poppler。** 浏览器公式预览不依赖这些工具。

读完说明后主动告知用户：**“浏览器编辑无需 TeX；本机生成 PDF 需要安装 TeX Live，Mac 可用 MacTeX。现在安装编译环境，还是先只编辑、由教师编译？”** 已明确选择时不重复询问。用户选择本机编译后，按 README 的“可选：本机编译 PDF”流程检查和安装，不再执行默认跳过 TeX 的限制。TeX Live 支持 Windows，但应用的 Windows 编译链仍需验证，不能声称已经实机通过。

选择只编辑时，提醒用户暂时不要使用网页 PDF 编译按钮。选择本机编译时，先验证 latexmk、pdflatex、xelatex，再安装缺失的完整 TeX 环境，重启应用并用英文示例验收。不要仅凭安装成功就宣布 PDF 编译成功。

开始前先问用户：**“克隆 PaperKit 示例库先体验，还是新建自己的论文 Git 仓库？已有论文仓库的话，请提供地址。”** 已有答案不要重复询问。

- 示例体验：直接使用 `https://github.com/magicdlf/sng.paperkit.git`，克隆到应用目录以外的 `PaperKit/`，推荐先打开 `paperbuilder-guide/`。
- 新建论文：询问仓库名和位置，在应用目录以外创建新目录并 git init，复制内置 template/ 内容并将 gitignore 改名为 .gitignore；也可按用户选择复制某份 PaperKit 论文，不复制其 Git 历史。远程地址可稍后配置，本地初始化不会自动创建 GitHub 仓库。
- 已有论文：获取用户提供的地址，克隆并核实内容。

收集以下信息；已有的信息不要重复询问：

- PaperBuilder 应用仓库 URL，以及教师指定的版本/tag/commit（未指定时使用仓库默认分支，并记录实际 commit）。
- 已有团队论文仓库 URL（示例体验使用上述固定地址，新建论文不要求已有远程）。
- 本地存放位置（默认选择用户目录下的 `PaperBuilderWorkspace`）。
- 个人 Git 提交姓名和邮箱；已有合适的 Git 配置可以沿用。

不要猜测团队仓库地址；示例体验使用已知的 PaperKit 地址。不要把演示论文误当成已有团队论文。

## 文件与数据规则

应用和论文必须是两个独立 Git 仓库，例如：

```text
PaperBuilderWorkspace/
├── PaperBuilder/          # 应用代码及依赖
└── papers/
    └── team-paper/        # 团队论文及自己的 .git
```

- 不要将论文放入应用源码目录，不要把应用代码复制进论文仓库。
- 不要覆盖、删除或重新初始化已有论文；发现已有目录时先检查并复用合适的克隆。
- 不执行 `git reset --hard`、`git clean`、强制推送或自动解决冲突。
- 不修改应用源码、package.json、锁文件来绕过安装问题。先诊断，报告必须修改的原因。
- 不把密码、token、SSH 私钥写进仓库、仓库 URL 或日志，不要求学生在聊天中粘贴凭据。
- 本地启动默认仅监听本机，不自动开放局域网或公网端口。

## 1. 检查环境

识别操作系统、CPU 架构、当前 shell，检查：

```text
node --version
npm --version
git --version
```

优先使用 Node.js 24 LTS。已有 Node 22.12 或更高的 22 LTS 可先沿用；不要使用不满足项目依赖要求的老版本。不要仅因缺少 TeX 而判定安装失败。

如果依赖缺失：

- macOS：已有 Homebrew 时可以用它安装 Node 和 Git；否则优先使用 Node 官方安装包及合适的 Git 安装方式，不为了本任务强制安装 Homebrew。
- Windows：使用 Node 官方 LTS 安装包和 Git for Windows，或已有可信包管理器。安装后刷新终端环境并重新检查 PATH。
- Linux：根据发行版安装符合版本要求的 Node 和 Git。

避免 `sudo npm install`。下载失败时检查网络、代理和证书问题，不关闭 TLS 校验或自动切换到来源不明的镜像。

## 2. 克隆并核实仓库

克隆应用到 `PaperBuilder/`。已有团队仓库克隆到 `papers/team-paper/`；示例体验克隆到 `PaperKit/`；新建论文按前述步骤创建独立仓库。检查路径、remote、分支和工作区状态。应用切换到教师指定版本时，不丢弃已有改动。

如果拿到的是多论文示例库（根目录 README，子目录各自有 paper.json），列出可选论文，让用户选择并将 `--paper` 指向具体子目录。该库共用一个 Git 历史，只适合试用；正式团队应复制选定论文文件到库外的新目录，初始化独立仓库，不把示例库根目录当成论文。

**论文目录应在仓库顶层包含：**

```text
paper.json
sections/
assets/                 # 可以暂时没有图片
references.json         # 可以尚未创建
comments.json           # 可以尚未创建
```

至少必须有有效的 `paper.json` 和对应章节文件。若克隆后只有 README 或空目录，先询问使用内置模板还是选定示例，再初始化内容。若论文实际在仓库子目录，需要先确认目录设计，避免应用误用其他 Git 仓库。

正式团队论文应确认 `git rev-parse --show-toplevel` 返回论文仓库本身，而不是应用仓库或更上层目录；多论文示例库试用属于明确例外。

## 3. 安装应用依赖

在应用仓库根目录执行：

```bash
npm ci --registry=https://registry.npmmirror.com --loglevel=info
```

**执行前先向用户提示**：将从大陆 npm 镜像 npmmirror（https://registry.npmmirror.com）安装 React/TipTap、KaTeX、Hono，以及 Vite、tsx、TypeScript、Vitest 和传递依赖，存放在项目 node_modules；不安装 TeX，也不通过 npm ci 安装系统 Node/Git。首次时间取决于网络与缓存，安装时显示日志，正常启动不重复安装。

项目 .npmrc 默认配置此镜像，不修改全局 npm 配置。使用项目锁文件，不运行自动升级或 `npm audit fix --force`。失败时保留锁文件并诊断版本、权限、网络或平台依赖问题。等待期间检查最近日志，向用户说明进展；不要无反馈等待或重复并行运行 npm ci。可用 `npm ping --registry=https://registry.npmmirror.com` 检查连通性。不要静默换源或关闭证书校验。GitHub 与系统依赖下载不受此设置影响。

首次安装需要联网；后续正常编辑无需重复安装 npm 依赖。Git 远程同步仍需要网络。

## 4. 配置论文 Git

新建论文尚无远程地址时跳过 remote 和认证检查，不凭空添加 origin。多论文示例库的提交会纳入整个库工作区，教学试用期间不要误提交其他论文改动。

在论文仓库设置仓库级 `user.name` 和 `user.email`（已有正确配置则不重复设置），确认 `origin` 指向本组论文仓库。除非学生明确要求，不修改全局 Git 配置。

私有仓库认证通过学生自己的 SSH key、凭据管理器或浏览器登录完成。教师和队友通过仓库成员权限加入，不共享教师个人凭据。

检查远程读取权限；不要为验证权限而推送测试提交。提醒学生：**应用内“提交”只产生本地 commit，不会自动 push。**

## 5. 启动：macOS / Linux

从应用根目录执行，替换为实际绝对路径；始终正确引用含空格的路径：

```bash
npm run dev -- --paper "/absolute/path/to/papers/team-paper"
```

预期后端为 `http://127.0.0.1:4870`，浏览器入口为 `http://localhost:5173`。

课堂安装优先使用开发启动模式。开发模式要求 5173 端口空闲；若端口被占用，检查占用进程，不擅自结束无关程序。也可使用 `npm start -- --paper "实际论文绝对路径"` 构建并启动单端口模式，浏览器入口为 `http://localhost:4870`。

## 6. 启动：Windows

先尝试与上面相同的 `npm run dev -- --paper "实际论文绝对路径"`。启动器已通过 Node 直接运行工具入口以兼容 Windows，但仍需实际机器验证。

如果明确是子进程启动兼容问题，**不要改源码**，改为在两个 PowerShell 终端中直接通过 Node 运行本地工具。以下命令均从应用仓库根目录开始执行。

终端 A（后端，保持运行）：

```powershell
$env:HIMCM_PAPER = "C:\实际路径\PaperBuilderWorkspace\papers\team-paper"
$env:HIMCM_HOST = "127.0.0.1"
$env:HIMCM_PORT = "4870"
node .\node_modules\tsx\dist\cli.mjs .\server\src\index.ts
```

终端 B（前端，保持运行）：

```powershell
$env:HIMCM_PORT = "4870"
Set-Location .\client
node ..\node_modules\vite\bin\vite.js --strictPort
```

执行前确认当前安装的 tsx/Vite 包中确实存在这些入口文件；若包布局不同，读取本地 package.json 的 `bin` 字段确定实际入口，不猜测路径，不另行下载工具。

打开 `http://localhost:5173`。若后端端口调整，两个终端的 `HIMCM_PORT` 必须一致。不要绕过系统执行策略；上述直接调用 Node 的方式通常无需执行 npm 的 PowerShell shim。

## 7. 验证并交付

不带 --paper 启动时不创建默认论文库，浏览器从 localStorage 恢复上次目录，或显示目录选择。已有 Git 仓库先克隆再填本地路径。点击“新建本地论文”才会向指定空目录复制模板；目录列表不写进 paper.json，也不使用 HIMCM_PAPERS_ROOT 或 .last-paper。不同浏览器/站点端口的目录列表相互独立。

检查：

1. 前后端没有启动错误，浏览器能打开页面。
2. 页面显示的是指定团队论文，标题和章节与磁盘文件相符。
3. 公式预览、已有图片能显示。
4. 两个仓库独立，论文 remote 正确。

不要为验证而修改真实论文。需要验证保存时，先征得学生同意，或使用独立临时测试论文。**不以 PDF 编译成功作为学生端验收条件。**

最后向学生报告：应用版本、应用和论文绝对路径、浏览器地址、运行中的终端、如何停止及重新启动、Git 是否配置好，以及尚未完成的认证步骤。

停止方式：在启动终端按 Ctrl+C；Windows 双终端模式需要分别停止前后端。关闭浏览器不会自动停止服务器。

## 日常 Git 同步规则

- 开始写作前，关闭编辑页面并确认没有待保存操作，再检查工作区和同步远程。
- 本地干净且没有本地未推送提交时，可以使用 `git pull --ff-only`。出现分叉或冲突则停止，展示状态并协助处理，不强行覆盖。
- 编辑后等待界面保存成功，再提交并 push。提交前检查 diff，避免误提交凭据或无关文件。
- 外部 pull、合并或切换版本时，关闭编辑页面；完成后重新打开，避免旧页面将旧内容写回。
- 按章节分工；`paper.json`、`comments.json`、`references.json` 由指定成员协调编辑。当前不是实时共同编辑系统。
- `build/` 默认不进入 Git。教师拉取论文源码和图片后统一编译 PDF。

## 当前已知边界

- 配置本组目录是默认打开目标，不是权限沙箱；不要通过论文切换器打开其他人的目录。
- 不要把不同组连接到同一后端进程，因为切换论文会影响该进程的全部访问者。
- 局域网共享需另行配置主机监听、防火墙和网络访问，并协调组内编辑；本说明默认每人本机使用。
- 如果安装仍失败，给出具体失败命令、脱敏错误和下一步建议，清楚区分已完成与未完成，不宣称已经启动成功。
