# Phase 2 真机执行手册（DevEco 模拟器 / MateBook 真机）

> 适用：SQLKit 鸿蒙移植 issue #1 的 Phase 1 空壳验证 + Phase 2 真机冒烟。
> 前置状态（2026-11-05 已完成）：`geek-fun/sqlkit` 分支 **`feat/ohos-port`**（`9d5c292`），双 target 编译全绿（ohos aarch64 EXIT=0，桌面 598 tests）。
> 编译配方见 `geek-fun/sqlkit` 仓库 `src-tauri/ohos/README.md`（环境变量、fork 组合、全部踩坑）。

## Step 0 — 会话开工清单

```bash
cd /Users/blankll/Documents/devs/geekfun/sqlkit && git checkout feat/ohos-port && git pull
rustup target list --installed | grep ohos        # aarch64-unknown-linux-ohos
ls /Applications/DevEco-Studio.app/Contents/sdk/default/openharmony/native/llvm/bin/aarch64-unknown-linux-ohos-clang
# 全部环境变量见 src-tauri/ohos/README.md（OHOS_NDK_HOME / OHOS_HOME / CARGO_NET_GIT_FETCH_WITH_CLI / CC/AR wrapper / AWS_LC_SYS_NO_ASM=1）
```

## Step 1 — ArkTS 壳工程

优先手工构建路径（实战教程 2026-10-18 在 MateBook Pro 验证过，避开 `cargo tauri ohos init` 的白屏坑 issue #15236；若想先试 CLI，#15236 的修复已在分支内，白屏时转手工）：

1. 壳工程结构（fork 模式）：`EntryAbility` 继承 `@ohos-rs/ability` 的 **NativeAbility**，`public moduleName: string = "sqlkit_lib"`（与 Rust cdylib 名一致；库名牵动 4 处：Cargo.toml `[lib] name`、moduleName、hvigor 配置、签名配置）
2. `import rustNapi from 'libsqlkit_lib.so'` 把 Rust cdylib 作为 NAPI 模块加载
3. **必须注入的环境变量**：`WRY_OHOS_PACKAGE`、`TAURI_OHOS_PACKAGE_UNESCAPED`、`WRY_OHOS_LIBRARY`、`TAURI_OHOS_PROJECT_PATH`、`OHOS_NDK_HOME`、`OHOS_HOME`、`TAURI_ENV_DEBUG=false`
4. 前端：`withGlobalTauri: true`，Vite 产物走 custom-protocol（fork 已验证资源协议工作；**无需改 vite.config**，本会话已审查——无 base/port 硬编码冲突）
5. `deviceTypes: ["pc", "tablet"]`（平板上架后适配 UI，见 issue Phase 4）

构建命令（fork tauri 2.8.5 + wry 0.55.1，`[patch.crates-io]` 已常驻分支）：

```bash
cargo build --release --target aarch64-unknown-linux-ohos --features ohos --lib
ohpm install && hvigorw assembleHap --no-daemon --stacktrace
```

## Step 2 — AGC 签名

- `devecocli signature generate --product default` 生成四件套写入 `build-profile.json5`
- 设备不认 OpenHarmony 根证书：装包报 `code:9568257 fail to verify pkcs7 file` = 未用 AGC 证书
- 签名绑定 UDID；hvigor 拒收明文密码（00303116，需 ≥32 位加密态）
- 华为开发者账号企业认证 1-3 工作日（若未办，先办）

## Step 3 — 空壳跑通（Phase 1 收尾项）

```bash
devecocli run --module entry   # 构建+签名+安装+启动
```

- 白屏排查：错误页**只渲染在 webview 里不进 hilog**，用 `devecocli ui layout` 读节点树
- `Failed to request tauri://localhost` 三根因：custom-protocol 未启用 / `gen/ohos/assets/tauri.conf.json` 未同步 / 窗口缺 `"url": "index.html"`
- 验收：空壳显示 UI = Phase 1 的『空壳真机跑通』可勾选

## Step 4 — V6 真机连通（tokio TCP + rustls）

真机上用 SQLKit 连一个真实数据库（任一即可）：PG（`postgres://...`）走 tokio-postgres + rustls；SSH 隧道场景连内网库验证 russh TCP。失败分类：DNS/TCP = 系统网络权限；TLS 握手 = ring provider 问题；超时 = 后台策略。

## Step 5 — 121 命令冒烟（Phase 2）

按模块分组执行（命令清单来源 `src-tauri/src/lib.rs` `generate_handler!`）：

1. **连接管理**：save/list/connect/disconnect/test —— 至少实测五类协议：PostgreSQL、MySQL、SQLite（本地文件）、SQL Server、ClickHouse
2. **查询**：execute / cancel / explain（含分页、10 万行虚拟滚动）
3. **浏览**：表/列/视图/索引/外键/存储过程 tabs
4. **AI Agent**：流式响应（reqwest + rustls，含 MCP 状态）
5. **SSH 隧道**：save profile / connect via tunnel
6. **导入导出**：CSV / Excel / DDL（calamine/rust_xlsxwriter 已在依赖图）
7. **传输页**：Transfer（v1.0 新增面，若时间紧可降 P1）
8. **裁剪面确认**：连接类型下拉 41 种（26 种 JDBC 类型不可见）、无更新检查入口（AppGallery 接管）

记录：每模块通过/失败 + hilog 报错摘要 → 直接更新 issue #1。

## Step 6 — MVP 闭环 + DoD

连接 → 浏览 → Monaco 执行 → 结果分页，端到端；**稳定运行 ≥ 30 分钟压力操作**（DoD #5）。全部通过后回填 issue #1 勾选项并注明设备/系统版本（如 MateBook Pro / HarmonyOS 7.0 / API 26）。

## 已知限制（本分支）

- fork 的 MacConfig 无 `infoPlist`/`exceptionDomain`（macOS 打包 Phase 3 前需补 fork 或自维护）
- 平板响应式适配在上架后 Phase 4
- data-studio-agent v0.2.1 已修复 reqwest default features（上游 `a6c7562`），无需本地 patch
