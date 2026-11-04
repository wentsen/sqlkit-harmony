# HarmonyOS (OHOS) build notes

The `ohos` cargo feature wires platform-specific behavior:

- updater plugin is not registered (AppGallery handles updates)
- JDBC bridge spawns are short-circuited (`JdbcBridgeLauncher::start*`) and all
  JRE/driver management commands return an error — HarmonyOS has no JVM
- frontend hides the 26 JDBC-bridge database types (`usePlatform().isOhos`,
  detected via the ArkWeb user agent)

Desktop builds never enable the feature; CI can verify the gating with:

```bash
cd src-tauri && cargo check --features ohos
```

## Building for OHOS (Phase 1, requires tauri open-harmony branch)

1. Install [DevEco Studio](https://developer.huawei.com/consumer/cn/deveco-studio/)
   (26.0.0 Release ships SDK 26.0.0.105 / API 26 with the OHOS NDK).
2. `rustup target add aarch64-unknown-linux-ohos`
3. Set `OHOS_NDK_HOME` / `OHOS_HOME` to the DevEco SDK path.
4. Copy `patch.crates-io.toml.example` contents into `Cargo.toml` as
   `[patch.crates-io]` to switch tauri/wry/tao to the official
   `feat/open-harmony` branches, then build with `--features ohos`.

Real-device verification steps and known pitfalls are documented in
`../docs/sqlkit-harmony-porting-analysis.md` (sqlkit-harmony repo).
