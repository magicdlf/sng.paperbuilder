# PaperBuilder：给 AI 的安装与启动说明

请帮助学生在本机安装、配置并启动 PaperBuilder。请实际执行检查和启动，遇到需要管理员权限或浏览器登录的步骤，再请学生完成对应操作。

当前代码和 npm 包中仍可能出现 `HiMCM Paper`、`himcm-paper`、`@himcm/*` 等旧名称，这是正常情况，不要为了安装而重命名代码。

## 目标与输入

学生在浏览器中编辑论文，教师统一编译 PDF。**本次不安装 TeX、MacTeX、TeX Live、latexmk 或 Poppler。** 浏览器公式预览不依赖这些工具；当前应用的 PDF 编译按钮仍会显示，告诉学生暂时不要使用。

开始前，收集以下信息；已有的信息不要重复询问：

- PaperBuilder 应用仓库 URL，以及教师指定的版本/tag/commit（未指定时使用仓库默认分支，并记录实际 commit）。
- 团队或试验论文仓库 URL。
- 本地存放位置（默认选择用户目录下的 `PaperBuilderWorkspace`）。
- 个人 Git 提交姓名和邮箱；已有合适的 Git 配置可以沿用。

不要猜测仓库地址。仓库尚未创建时，可先完成应用安装，但不要把内置演示论文误当成团队论文。

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

克隆应用到 `PaperBuilder/`，克隆论文到 `papers/team-paper/`，然后检查两个仓库的路径、remote、分支和工作区状态。应用切换到教师指定版本时，不丢弃已有改动。

**论文目录应在仓库顶层包含：**

```text
paper.json
sections/
assets/                 # 可以暂时没有图片
references.json         # 可以尚未创建
comments.json           # 可以尚未创建
```

至少必须有有效的 `paper.json` 和对应章节文件。若克隆后只有 README 或空目录，说明教师尚未放入模板；停止论文启动步骤并报告，不擅自生成替代模板。若论文实际在仓库子目录，需要先确认目录设计，避免应用误用其他 Git 仓库。

确认 `git rev-parse --show-toplevel` 在论文目录返回论文仓库本身，而不是应用仓库或更上层目录。

## 3. 安装应用依赖

在应用仓库根目录执行：

```bash
npm ci
```

使用项目锁文件，不运行自动升级或 `npm audit fix --force`。失败时保留锁文件并诊断版本、权限、网络或平台依赖问题。

首次安装需要联网；后续正常编辑无需重复安装 npm 依赖。Git 远程同步仍需要网络。

## 4. 配置论文 Git

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
$env:HIMCM_PAPERS_ROOT = "C:\实际路径\PaperBuilderWorkspace\papers"
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
