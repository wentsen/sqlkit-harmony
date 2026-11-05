# SQLKit 鸿蒙（HarmonyOS）移植可行性报告

> 日期：2026-11-05（全面修订版，取代 2026-06-17 版）
> 分析对象：SQLKit **v1.0.1**（Tauri v2 + Vue 3 + Rust；2026-10-28 发布）
> **设备目标矩阵：鸿蒙 PC（主要）→ 平板（次要，P1）→ 手机（观察，P2）**
> 本版所有 SQLKit 数据均从源码核实（git tag `v1.0.1`、`src-tauri/src/lib.rs` 的 `generate_handler!`、`database/strategy.rs`、`Cargo.toml`），所有鸿蒙生态数据均标注官方或权威来源。
> 策略：P0 采用 **Tauri 官方 OpenHarmony 分支**直接移植（首选），ohos-rs NAPI 全量导出降为兜底路线。

---

## 〇、相对 2026-06 版的关键更新（先读这个）

| # | 旧版结论（2026-06） | 现状（2026-11，已核实） | 影响 |
|---|---|---|---|
| 1 | 需先做 native-tls → rustls 前置迁移 | **已完成**。`src-tauri/Cargo.toml` 无 native-tls/openssl，TLS 全 rustls（`rustls 0.23` + `tokio-postgres-rustls`） | 原第五章整章删除，阻塞项清零 |
| 2 | 放弃 Tauri，用 ohos-rs 重写全部命令导出（每命令改 ~5 行） | **Tauri 官方维护 `feat/open-harmony` 分支**（tauri/wry/tao/cargo-mobile2 均在 tauri-apps org），已有真实设备落地案例 | `#[tauri::command]` 与前端 `invoke()` **零改动**，工作量大幅下降 |
| 3 | 审核规则 3.5 条打击 WebView 套壳 | 条款编号已变：**"简单打包/套壳"现在在 3.6/4.1 条**；3.5 条现为"应用需具备实用价值" | 第六章已按最新指南（2026-10-09 更新）更正 |
| 4 | DevEco Studio 26.0.0 Beta1，ArkWeb M144 待验证 | **DevEco Studio 26.0.0 Release（26.0.0.821）2026-08-29 发布**；HarmonyOS 7（= 26.0.0，API 26）9-07 正式版、10 月起不限量推送；**ArkWeb Chromium 132 → 144 已确认** | 环境清单更新为 Release 版 |
| 5 | SQLKit v0.5.3：47 命令、7 页面、14 适配器 | SQLKit **v1.0.1**：**121 个注册命令、7 页面、11 个 store、67 种数据库**（37 纯 Rust 原生 + 4 HTTP 桥 + 26 JDBC 桥） | 命令数翻倍，但见 #2，命令层无需逐个改写 |
| 6 | ohos-rs 217★、39 release（未到 1.0） | **ohos-rs 1.0.0 正式版（2026-07-20）**；napi-rs 3.0 官方支持 OpenHarmony 交叉编译 | 兜底路线更稳 |
| 7 | 鸿蒙 PC 处于早期 | 2026 Q2 华为 PC 出货 180 万台（+82%），份额 **16% 国内第二**；鸿蒙电脑应用 **19000 个**；首款台式机擎云 HM650 2026-10 上市 | 市场窗口已打开 |

---

## 一、SQLKit v1.0.1 架构现状（源码核实）

### 1.1 技术栈

| 层 | 技术 | 关键依赖 |
|---|---|---|
| 前端 UI | Vue 3.5 + TypeScript + UnoCSS | shadcn-vue, Monaco Editor, Pinia 3, Vue I18n 11 |
| IPC | Tauri v2 `invoke()` | `@tauri-apps/api ^2.11.0` |
| 后端 | Rust + Tokio | `DatabaseAdapter` trait + 路由策略层 |
| TLS | **全 rustls** | rustls 0.23, tokio-postgres-rustls, rustls-native-certs |

### 1.2 规模（精确计数）

| 维度 | 数量 | 计数方式 |
|---|---|---|
| 注册 Tauri 命令 | **121** | `lib.rs` `generate_handler![]` 条目数（与 `#[tauri::command]` 注解数一致） |
| 页面 | 7 | Connections / DataStudio / History / ImportExport / Queries / Settings / Transfer |
| Pinia store | 11 | `src/store/`（不含 index.ts） |
| 数据库类型 | **67** | `database/config.rs` `DatabaseType` 枚举变体数 |

### 1.3 数据库路由与鸿蒙可用性（`database/strategy.rs`）

| 路由 | 类型数 | 明细 | 鸿蒙可用性 |
|---|---|---|---|
| Native PostgreSQL 适配器 | 19 | PostgreSQL + CockroachDB, Redshift, YugabyteDB, TimescaleDB, GaussDB, HighGo, UXDB, OpenGauss, GBase8c, QuestDB, Vastbase, Greenplum, EnterpriseDB, CrateDB, Materialize, AlloyDB, CloudSQLPG, FujitsuPG | ✅ 纯 Rust |
| Native MySQL 适配器 | 14 | MySQL + MariaDB, TiDB, OceanBase, TDSQL, PolarDB, Doris, SelectDB, StarRocks, Databend, GoldenDB, ManticoreSearch, SingleStoreMemSQL, CloudSQLMySQL | ✅ 纯 Rust |
| Native 其他 | 4 | SqlServer (tiberius), SQLite/SQLCipher (rusqlite bundled), ClickHouse | ✅（rusqlite 需 NDK Clang 编 C） |
| HTTP SQL 桥 | 4 | Trino, Presto, RQLite, Turso（reqwest） | ✅ 纯 Rust |
| **JDBC 桥（Java 子进程）** | **26** | DuckDb, Oracle, Firebird, DB2, H2, Snowflake, TDengine, Dameng, XuguDB, GBase8a, Derby, Hive, Databricks, Hana, Teradata, Vertica, Exasol, BigQuery, Informix, Kylin, Cassandra, Iris, Access, YashanDB, KingbaseES, OceanbaseOracle | ❌ 鸿蒙无 JVM，P0 裁剪 |

**结论：67 种中 41 种（61%）零裁剪可用**，覆盖国内主流诉求（信创系：达梦之外的全家走 PG/MySQL 协议的都可用；华为系 GaussDB/openGauss ✅）。JDBC 桥 26 种（Oracle、DB2、Snowflake、BigQuery、DuckDB 等）依赖 `jdbc-bridge/` Maven 工程（Java 子进程），鸿蒙 NEXT 无 JVM，P0 隐藏入口。

### 1.3.1 JDBC 桥 26 种的分层处置（P0 裁剪不变，P1 分层补齐）

"鸿蒙无 JVM"是平台事实（HarmonyOS NEXT 已移除 AOSP 兼容层，社区有 OpenJDK 手动移植 OpenHarmony 的案例但属平台级折腾，Harmonybrew 包管理器面向开发者自装、不可作为商店 App 依赖）——但 26 种不是一块铁板：

| 层 | 数据库 | 替代路径 | 优先级 |
|---|---|---|---|
| B1 纯 Rust 驱动可补 | Cassandra | `scylla-rust-driver`（纯 Rust CQL 协议） | P1，各 ~3-5 人天 |
| B2 REST API 可补 | BigQuery、Databricks、Snowflake | 官方 REST/SQL API（BigQuery REST、Databricks Statement Execution、Snowflake SQL API），复用现有 HTTP 桥架构 | P1 |
| B3 PG-wire 重测 | KingbaseES、YashanDB | 2026-06-22（`000b53b`）曾因兼容性从 PG-wire **有意迁入** JDBC，非遗留；可低优先级重测金仓 V8R6 PG 兼容模式 | P2 |
| C 理论可编、体积重 | DuckDB | C++ crate 可交叉编译，当初因 ~40MB 体积裁剪；OHOS 上重新评估 | P2 |
| D 无替代，只能 JDBC | Oracle、DB2、Hive、Teradata、Vertica、Exasol、Informix、Hana、达梦 Dameng、虚谷 XuguDB、GBase8a、Iris、Kylin、OceanbaseOracle | 唯一路径 = **远程 JDBC 桥**（见下） | P1 方案设计 |
| F 鸿蒙上无意义，永久裁 | H2、Derby（嵌入式 Java 库）、Access（本地 .mdb 文件） | 无远程场景 | 直接移除 |

**远程 JDBC 桥（D 类的唯一出路，也是最重要的架构发现）**：`jdbc-bridge` 是 **stdin/stdout JSON-RPC 协议**的 Java 子进程（Rust ←→ Java，HikariCP + JDBC），协议天然可远程化——同一个 jar 在任何有 JVM 的机器（跳板机/堡垒机/NAS/用户自己的桌面）上跑起来，鸿蒙端通过 SSH exec（SQLKit 已有 SSH 隧道体系，自然延伸）或 TCP 包装连接。对 Oracle/达梦/DB2 的政企场景尤其现实：数据库本来就在内网服务器，桥架在旁边的跳板机上即可。工作量估算：桥侧加 TCP 监听/SSH 模式 2-3 人天 + 客户端连接配置 UI 1-2 人天。

### 1.4 Tauri 插件与原生面（移植适配面清单）

| 组件 | 用途 | OHOS 处理 |
|---|---|---|
| tauri-plugin-opener / plugin-opener | 打开链接 | tao/wry OHOS 能力验证，通常可映射 |
| tauri-plugin-process / plugin-process | 退出等 | 验证 |
| tauri-plugin-updater / plugin-updater | 应用自更新 | **OHOS 禁用**（应用市场分发，系统负责更新） |
| plugin-dialog | 文件选择/保存 | 验证 wry OHOS 是否桥接系统 filePicker；不行则用 ArkUI filePicker 补壳 |
| plugin-os | 平台检测 | 验证 OHOS 返回值；前端平台判断需覆盖 `linux-ohos` |
| plugin-store | 本地 KV | 验证数据目录映射 |
| `useWindowControls.ts` | 最小化/最大化/关闭 | tao OHOS 窗口控制支持度需 Week 1 实测 |
| SSH 隧道（tokio TcpStream）、AI Agent（reqwest+rustls）、MCP 客户端 | 纯 Rust | 预期零改动，联调验证 |

`Cargo.toml` 已预留空 `ohos = []` feature，可用于：裁剪 JDBC 模块、禁用 updater、切换平台分支。

---

## 二、鸿蒙生态现状（2026-11 快照）

### 2.1 系统与工具链时间线（含来源）

| 时间 | 事件 | 来源 |
|---|---|---|
| 2026-06-12 | HDC 2026 发布 HarmonyOS 7（首个 100% 纯血版本）+ 开发者 Beta；开发套件 26.0.0 Beta（ArkWeb M132→**M144**） | HDC 2026；[搜狐报道](https://m.sohu.com/a/1035695479_114760) |
| 2026-07-20 | **ohos-rs 1.0.0 正式版** | [ohos.rs 博客](https://ohos.rs/blog/release-1.0.0) |
| 2026-07-30 | tauri-apps `feat/open-harmony` 分支（tauri/wry）最后一次提交（截至本报告日期） | GitHub API 实测 |
| 2026-08-29 | **DevEco Studio 26.0.0 Release（26.0.0.821）**，HarmonyOS SDK 26.0.0.105（API 26） | [IT之家](https://www.ithome.com/0/996/013.htm)、[华为版本总览](https://developer.huawei.com/consumer/cn/doc/harmonyos-releases/overview-2600) |
| 2026-09-07 | HarmonyOS 7 正式版发布（Mate XT 2 发布会） | 公开报道 |
| 2026-10 起 | HarmonyOS 7 不限量推送，存量占比升至 ~77%；首款鸿蒙台式机擎云 HM650 上市 | 公开报道 |
| 2026-10-09 | 《华为应用市场审核指南》最近一次更新 | [官方指南](https://developer.huawei.com/consumer/cn/doc/app/50104) |

**版本命名规则变化**：自 26.0.0 起，系统版本号与 API 版本号对齐（HarmonyOS 7 = 26.0.0 = API 26；旧规则 `X.Y.Z(N)` 弃用）。报告与 CI 中的 API 目标统一写 **API 26**。

### 2.2 Rust 生态

- **Rust OHOS targets：Tier 2 + host tools**（Rust 1.78 起，`aarch64-unknown-linux-ohos` 为主目标；官方 [platform support 文档](https://doc.rust-lang.org/rustc/platform-support/openharmony.html)）。Tier 2 = 保证可构建，预编译 std 可 rustup 安装；交叉编译需 OHOS SDK（DevEco 内置 NDK Clang/sysroot）。
- **napi-rs 3.0 官方支持 OpenHarmony**：`napi build` 对 Android/WASI/OpenHarmony 自动配置工具链（[官方文档](https://napi.rs/docs/cross-build)）；但官方注明 OHOS 的"完整脚手架+发布链路"尚不完整（[support & compatibility](https://napi.rs/docs/more/support-compatibility)）。
- **ohos-rs 1.0.0**（napi-rs 鸿蒙分支，独立成军）：2026-07-20 稳定版，`#[napi]` 宏 + ArkTS 类型生成 + async/await，`ohrs` CLI（[发布博客](https://ohos.rs/blog/release-1.0.0)）。

### 2.3 Tauri 官方 OpenHarmony 分支（关键新变量）

- 分支位置：`tauri-apps/tauri`、`tauri-apps/wry`、`tauri-apps/tao`、`tauri-apps/cargo-mobile2` 均有 `feat/open-harmony`（或 OHOS 支持）分支，**属官方仓库而非社区 fork**；`cargo tauri ohos init` 可脚手架化创建工程（[知乎实战](https://zhuanlan.zhihu.com/p/2073186732653257309)）。
- 已验证可跑真机：2026-10-18 实战教程在 **MateBook Pro（HarmonyOS 7.0）** 上用 tauri **2.8.5** / wry **0.55.1** / tao **0.35.3** / napi-ohos **1.1.6**、DevEco SDK **API 26 (26.0.0.105)** 构建运行成功（[教程全文](https://www.woshipm.com/share/6480497.html)）；另有应用 cc-switch 已按此路径完成鸿蒙 PC 移植（2026-08）。
- **分支健康度（2026-11-05 GitHub API 实测）**：分支本身最后提交 2026-07-30（同步 dev + 升级 tao 0.36/wry 0.56）；9 个 OHOS PR（base `feat/open-harmony`，9-27 ~ 10-24 持续流入：原生插件桥接、折叠屏状态、immersive 布局、构建修复等）**全部 open、零合并**；社区三次尝试进 dev 主线（#16027/16030/16032，2026-09）被关闭；tauri 分支 **behind dev 273 个提交**。维护者为社区个人（richerfu/ohos-rs 作者、hehetoshang、LeenHawk），无华为官方与 Tauri core 参与；tracking issue [#7287](https://github.com/tauri-apps/tauri/issues/7287) 仍 open 且无官方回复。**结论：无官方 roadmap/主线合入计划，分支可用性靠社区，长期演进需 fork 自维护。**
- 架构本质（引用实战文章）：*鸿蒙上没有"Tauri 应用"这种进程，只有一个带 webview 的鸿蒙应用，Rust 是被加载进它进程里的动态库* —— ArkTS 壳（NativeAbility）加载 Rust cdylib（NAPI 模块），wry 驱动 **ArkWeb (Chromium M144)** 渲染，`withGlobalTauri` 下前端仍走 `window.__TAURI__.core.invoke()`。

---

## 三、鸿蒙 PC：为什么仍是第一目标

| SQLKit 需要 | 鸿蒙 PC 现状（2026-11） |
|---|---|
| 侧边栏+编辑器+结果三栏大屏 | 13-18 英寸 MateBook Pro/Fold、一体机、HM650 台式机 ✅ |
| 键鼠驱动 + 快捷键 | PC KeyEvent/组合键 API ✅ |
| Monaco + 大结果集 | ArkWeb **M144** + 16GB+ 内存 ✅ |
| 数据库长连接 | 桌面后台策略宽松 ✅ |
| 专业工具品类空缺 | 19000 应用中开发工具稀缺，数据库 GUI 是生态蓝海 ✅ |
| 商业回报 | 华为 PC 份额 16% 且增长（Q2 +82%），信创/政企采购场景与 SQLKit 的国产数据库覆盖（GaussDB、openGauss、OceanBase、TiDB、StarRocks 等 41 种可用类型）高度重合 ✅ |

桌面应用 → 桌面系统，不是降级移植；且主流数据库 GUI 尚未上架鸿蒙 PC，专业开发工具品类是生态空缺，先发窗口明确。

### 3.2 设备目标矩阵与适配差异

| 设备 | 优先级 | 壳工程 `deviceTypes` | 关键差异 | 适配动作 |
|---|---|---|---|---|
| 鸿蒙 PC（MateBook Pro/14、一体机、HM650 台式机） | **P0（主要）** | `"pc"` | 物理键盘 + 鼠标，宽屏三栏 | 无（原生目标形态） |
| 平板（MatePad 系列，2in1） | **P1（次要）** | `"pc","tablet"` | 触屏 + 可选键盘，中窄屏；**无窗口控制按钮** | 响应式断点（侧边栏折叠/标签栏滚动）、`useWindowControls` 按平台条件渲染、触控目标 ≥ 44px；预估 +3-5 人天 |
| 手机 | **P2（观察）** | 不加 `"phone"` | 无键鼠、信息架构完全不同 | 当前不做；若后续做，是独立的移动版 UI 项目，不阻塞 PC/平板 |

同一系统版本（HarmonyOS 7 / API 26 / ArkWeb M144）覆盖三类设备，**运行时无分叉**，差异全部在 UI 层——平板适配是纯前端工作量，不影响路线 A 的技术验证。

---

## 四、技术路线（本版核心修订）

### 4.1 路线 A（P0 首选）：Tauri 官方 `feat/open-harmony` 分支

```
┌─────────────────────────────────────────────┐
│            HarmonyOS PC App (HAP)           │
│  ┌───────────────────────────────────────┐  │
│  │ ArkTS 壳 EntryAbility (NativeAbility) │  │
│  │   └─ 加载 Rust cdylib (NAPI 模块)     │  │
│  │       └─ wry OHOS 后端 → ArkWeb M144  │  │
│  │            └─ Vue 3 SPA (100% 复用)   │  │
│  │               window.__TAURI__.invoke │  │
│  └───────────────────────────────────────┘  │
│            Tauri runtime (2.8.x 分支)       │
│  ┌───────────────────────────────────────┐  │
│  │ 121 个 #[tauri::command]  零改动      │  │
│  │ 37 个 Rust 适配器 + HTTP 桥  零改动   │  │
│  │  AI Agent / SSH 隧道 / MCP  零改动    │  │
│  └───────────────────────────────────────┘  │
└─────────────────────────────────────────────┘
```

**改动范围（对比旧版报告）**：

| 层面 | 旧版方案（路线 B） | 路线 A 实际改动 |
|---|---|---|
| 前端 `invoke()` | 1 个适配文件 ~50 行 | **0 行**（`withGlobalTauri` 原生支持） |
| Rust 命令层 | 121 个命令逐个 `#[napi]` 化 | **0 行** |
| Rust 数据层 | 0 行 | 0 行 |
| 新增 | ArkWeb 壳 ~300 行 + JSBridge + 路由分发 | `cargo tauri ohos init` 脚手架 + 配置/签名脚本 ~100 行 |
| 裁剪 | 同 | JDBC 26 类型隐藏、updater 禁用（feature flag） |
| 平板适配（P1） | — | 响应式断点 + 窗口控制条件渲染（纯前端，+3-5 人天，不阻塞 MVP） |

**Week 1 必须验证的 6 个点（决定路线 A 是否成立）**：

1. `feat/open-harmony` 分支当前 HEAD 能否编译 tauri 2.11 API 面（SQLKit 用 `@tauri-apps/api 2.11`；实战教程用 2.8.5，可能需锁旧 API 或等分支跟进）
2. Vite 产物 + `custom-protocol` 资源加载（实战已验证可行，但需复现）
3. rusqlite `bundled`（C 源码经 NDK Clang 交叉编译）+ SQLCipher feature
4. tao OHOS 窗口控制（最小化/最大化/关闭，`useWindowControls.ts`）
5. plugin-dialog 的文件选择在 OHOS 的行为；不行则 P0 用 plugin 缺省 + ArkUI filePicker 补丁
6. tokio TCP（PG/MySQL/SSH 隧道）+ reqwest rustls（AI Agent/HTTP 桥）真机连通性

### 4.2 路线 B（兜底）：ohos-rs NAPI 全量导出

保留旧版报告第五章方案，触发条件：路线 A 的分支停滞/白屏问题无法绕过/tauri 2.11 API 面差距过大。ohos-rs 已 1.0.0 stable，风险可控；代价是 121 个命令的路由分发层（旧版估每命令 <5 行，用统一 `invoke_command(cmd, args_json)` 分发可压缩到一个 match 表）+ 前端 1 个适配文件 + 自建 ArkWeb 壳。**预估 +15-20 人天**。

### 4.3 路线对比

| | 路线 A：Tauri OHOS 分支 | 路线 B：ohos-rs 自建 |
|---|---|---|
| 前端/Rust 改动 | ≈0 | 命令层 + 前端适配层 |
| 成熟度 | 实验分支，真机案例 2+ | 1.0.0 stable，案例多 |
| 主线合入 | 无官方计划：9 个 OHOS PR 零合并、behind dev 273、社区个人维护（2026-11 实测） | 独立项目，1.0 承诺维护 |
| 维护成本 | 锁 commit / fork 自维护，不跟随升级 | 全自维护，但依赖面收敛在 ohos-rs 一个项目 |
| 适用定位 | **P0 一次性快速上架**（先发窗口） | 长期演进、可控性优先 |
| 结论 | **先 A 后 B**，Week 1 出结论 | 兜底，方案见旧版第五章 |

---

## 五、实施计划（路线 A，3-4 周）

> 前提已达成：TLS 全 rustls（桌面端 v1.0.1 已完成并发布）；若 Week 1 验证失败切路线 B，周期回到旧版的 5-7 周。

**Week 1：环境 + 分支验证（5-8 人天）**

```
├── DevEco Studio 26.0.0 Release（26.0.0.821，内置 SDK 26.0.0.105 / API 26 + NDK）
├── rustup target add aarch64-unknown-linux-ohos
├── 接入 tauri-apps feat/open-harmony 分支（[patch.crates-io] 锁 tauri/wry/tao）
├── cargo tauri ohos init 生成壳工程（deviceTypes: ["pc", "tablet"]，手机后续评估）
├── 空应用真机/模拟器跑通（含签名：AGC 证书，见附录）
└── 6 个验证点（见 4.1）→ 结论：继续 A 或切 B
```

**Week 2：SQLKit 接入（6-9 人天）**

```
├── Vite 构建接入（custom-protocol + withGlobalTauri）
├── ohos feature flag：隐藏 JDBC 26 类型、禁用 updater、os 检测补 ohos 分支
├── 全量 121 命令真机联调（连接管理/查询执行/浏览/AI/导入导出/传输）
├── SQLite/SQLCipher bundled C 交叉编译验证
├── SSH 隧道、AI Agent（流式）、MCP 真机验证
└── 窗口控制/多标签/文件对话框适配
```

**Week 3：集成测试 + 提交（5-8 人天）**

```
├── 全链路回归：连接 → SQL → Data Grid（10 万行虚拟滚动）→ 分页
├── Monaco 高亮/补全、ER 图、Transfer 页（v1.0 新增面）
├── 异常场景：断网/超时/大结果集/并发
├── PC 多分辨率（1920×1080 / 2560×1600）
├── 商店材料：隐私政策、权限说明、截图、元数据
└── AppGallery PC 提交
```

**上架后 P1（平板）**：响应式断点（侧边栏折叠/标签栏滚动）、`useWindowControls` 平台条件渲染、MatePad 真机回归，+3-5 人天。

**Week 4：审核期缓冲（2-4 人天）**：审核 3-7 工作日；被拒按第六章预案处理。

**合计：18-29 人天**（旧版 38-54 人天；下降主因：TLS 已前置完成 + 路线 A 命令层零改动）。

---

## 六、审核与上架（按 2026-10-09 版指南更正）

- **条款定位更正**：旧版引用的"3.5 条"已调整。现行指南中，"应用不得是简单打包的网站页面或套用模板、内容聚合、罗列链接"位于 **3.6/4.1 条**；3.5 条为"应用需具备实用价值，能为用户提供实质功能/服务"（[官方指南](https://developer.huawei.com/consumer/cn/doc/app/50104)、[历史版本](https://developer.huawei.com/consumer/cn/doc/app/50158)）。
- **SQLKit 定性不变**：完整数据库 GUI（连接管理、SQL 编辑器、数据浏览、ER 图、AI 助手、导入导出、传输），功能闭环的专业开发工具，非"单一页面/纯信息展示/罗列链接"对象。且路线 A 下窗口管理、菜单、对话框均为原生能力，比纯 WebView 套壳的合规位势更好。
- **上架渠道**：AppGallery PC 分发（[鸿蒙电脑应用开发入门](https://developer.huawei.com/consumer/cn/multidevice/pc/get-started)）；应用内更新插件（updater）在 OHOS 关闭，更新走应用市场。
- **签名**：鸿蒙要求 AGC 证书链（开发/发布证书 + Profile），实战文章记录了自签名脚本方案（`devecocli signature generate` 四件套）；设备不认 OpenHarmony 根证书，必须用 AGC 证书（报错 `9568257` 即此因）。
- **账号**：华为开发者账号（企业认证 1-3 工作日）+ AppGallery Connect，与 6 月版要求一致。

---

## 七、风险清单（2026-11 更新）

| 风险 | 等级 | 缓解 |
|---|---|---|
| tauri `feat/open-harmony` 分支停滞（9 个 PR 零合并、behind dev 273、无官方 roadmap） | 🔴 | Week 1 首日验证；**全程锁分支 commit，需要修复时 fork 自维护**（P0 定位为一次性上架，不跟随升级）；若 API 面差距过大切路线 B |
| `cargo tauri ohos init` 白屏（issue #15236） | 🟡 | 实战文章给出手工构建路径（注入环境变量 + hvigorw 直组 HAP）可绕过 |
| rusqlite bundled / SQLCipher 的 C 交叉编译 | 🟡 | NDK Clang + cc 对 OHOS target 的支持需 Week 1 实测；失败则 SQLite 改用系统 RDB 或预编译方案 |
| tao OHOS 窗口控制能力缺口 | 🟡 | Week 1 实测；最小可用集（关闭/最大化）缺失则补 ArkTS 调用 |
| JDBC 桥 26 类型缺失（Oracle/DB2/Snowflake/BigQuery/DuckDB…） | 🟡 | P0 隐藏入口不变；P1 分层补齐：Cassandra/BigQuery/Databricks/Snowflake 走 Rust/REST，H2/Derby/Access 永久裁，Oracle/达梦/DB2 等走**远程 JDBC 桥**（stdin/stdout JSON-RPC 协议天然可远程化，架跳板机 + SSH，见 1.3.1） |
| 签名/证书链坑（`9568257`、UDID 绑定） | 🟢 | 已有完整踩坑记录可循（见附录来源） |
| 审核被拒（3.6/4.1 套壳条款） | 🟢 | 路线 A 本身带原生壳；真被拒按原生化清单补齐（2-3 周） |
| ArkWeb M144 渲染兼容 | 🟢 | Chromium 144 为 2026-01 stable，Vue/Monaco 兼容面成熟 |

---

## 八、附录：环境准备清单（更新为 Release 版）

| 步骤 | 操作 |
|---|---|
| 1 | 安装 [DevEco Studio 26.0.0 Release](https://developer.huawei.com/consumer/cn/deveco-studio/)（26.0.0.821，首次启动自动下载 HarmonyOS SDK 26.0.0.105 / API 26，含 OpenHarmony NDK） |
| 2 | `rustup target add aarch64-unknown-linux-ohos` |
| 3 | 环境变量：`OHOS_NDK_HOME`、`OHOS_HOME` 指向 DevEco SDK 目录（写入 `~/.zshrc`） |
| 4 | `cargo install tauri-cli --git https://github.com/tauri-apps/tauri --branch feat/open-harmony`（或按实战文章手工构建，绕过 CLI） |
| 5 | 华为开发者账号（企业认证）+ AGC 签名四件套 |

**路线 A 构建期关键环境变量**（来自 2026-10 实战）：`WRY_OHOS_PACKAGE`、`TAURI_OHOS_PACKAGE_UNESCAPED`、`WRY_OHOS_LIBRARY`、`TAURI_OHOS_PROJECT_PATH`、`OHOS_NDK_HOME`、`OHOS_HOME`、`TAURI_ENV_DEBUG=false`；Cargo 配置 `git-fetch-with-cli = true`（规避 OHOS 文件系统 EINTR 问题）。

**测试设备**：MateBook Pro / MateBook 14 鸿蒙版（Week 1-2 可用 DevEco PC 模拟器替代，真机在提交前必备）；MatePad 平板（P1 平板适配阶段使用）；手机设备不在当前计划。

---

## 主要来源

- SQLKit v1.0.1 源码（`src-tauri/src/lib.rs`、`database/strategy.rs`、`database/config.rs`、`Cargo.toml`、`CHANGELOG.md`）
- [华为版本总览 26.0.0](https://developer.huawei.com/consumer/cn/doc/harmonyos-releases/overview-2600) / [IT之家：开发套件 26.0.0 正式发布](https://www.ithome.com/0/996/013.htm)
- [搜狐：26.0.0 Beta1 ArkWeb M132→M144](https://m.sohu.com/a/1035695479_114760)
- [ohos.rs：Release 1.0.0](https://ohos.rs/blog/release-1.0.0) / [napi.rs：Cross build](https://napi.rs/docs/cross-build) / [rustc OpenHarmony platform support](https://doc.rust-lang.org/rustc/platform-support/openharmony.html)
- [Tauri 官方 open-harmony 分支实战（cc-switch，知乎）](https://zhuanlan.zhihu.com/p/2073186732653257309) / [harmony-tauri-app 全流程实战（2026-10-18）](https://www.woshipm.com/share/6480497.html) / [tauri issue #15236](https://github.com/tauri-apps/tauri/issues/15236)
- [华为应用市场审核指南（2026-10-09 更新）](https://developer.huawei.com/consumer/cn/doc/app/50104) / [审核政策总览](https://developer.huawei.com/consumer/cn/doc/app/50158)
- [新华网：鸿蒙电脑全形态布局](https://www.xinhuanet.com/tech/20260731/41c8529c417b4de18156d9bd933ae8c3/c.html) / [21财经：19000 应用](https://m.21jingji.com/article/20260730/3c072c3774945370367cc722eca70216.html)
- [鸿蒙电脑应用开发入门](https://developer.huawei.com/consumer/cn/multidevice/pc/get-started)

---

*报告生成：2026-11-05。策略：路线 A（Tauri 官方 OHOS 分支）3-4 周提交商店；Week 1 验证失败切路线 B（ohos-rs，5-7 周）。*
