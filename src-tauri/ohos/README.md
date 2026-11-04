# HarmonyOS (OHOS) build notes

The `ohos` cargo feature plus `target_env = "ohos"` cfgs wire platform
behavior:

- updater / deep-link / dialog / window-state plugins are compiled out
  (AppGallery updates, Want routing, ArkUI filePicker, system windows)
- JDBC bridge spawns are short-circuited (`JdbcBridgeLauncher::start*`) and all
  JRE/driver management commands return an error — HarmonyOS has no JVM
- frontend hides the 26 JDBC-bridge database types (`usePlatform().isOhos`,
  detected via the ArkWeb user agent)

Desktop builds never enable the feature; CI can verify the gating with:

```bash
cd src-tauri && cargo check --features ohos
```

## Cross-compile verification (Phase 1, verified 2026-11-05)

```bash
export OHOS_NDK_HOME=/Applications/DevEco-Studio.app/Contents/sdk/default/openharmony
export OHOS_HOME=/Applications/DevEco-Studio.app/Contents/sdk
export CARGO_NET_GIT_FETCH_WITH_CLI=true          # cargo's bundled git auth fails
export CC_aarch64_unknown_linux_ohos=$OHOS_NDK_HOME/native/llvm/bin/aarch64-unknown-linux-ohos-clang
export AR_aarch64_unknown_linux_ohos=$OHOS_NDK_HOME/native/llvm/bin/llvm-ar
export AWS_LC_SYS_NO_ASM=1                        # portable aws-lc (cmake required, brew install cmake)
cargo check --target aarch64-unknown-linux-ohos --features ohos   # EXIT=0
```

The `tauri/wry/tao` deps must be patched to the richerfu open-harmony forks
(tauri `c818cc1d`, wry `ae8b21b5`, tao `9d51be24`, pinned via `=2.8.5` /
`=0.55.1` / `=0.35.3` so the patch wins over newer crates.io releases). Do not
commit the patch section — see `patch.crates-io.toml.example`. The official
tauri-apps branches currently break on `openharmony-ability`: its main branch
(1.0.0-beta.5, 2026-11-02) dropped the `webview` feature the wry branch needs.

Real-device verification steps and known pitfalls are documented in
`../docs/sqlkit-harmony-porting-analysis.md` (sqlkit-harmony repo).
