/**
 * @jest-environment jsdom
 */
import type { Update } from '@tauri-apps/plugin-updater'
import { ref } from 'vue'

const mockCheck = jest.fn<Promise<Update | null>, []>()

jest.mock('@tauri-apps/plugin-updater', () => ({ check: () => mockCheck() }))
jest.mock('@tauri-apps/plugin-process', () => ({ relaunch: jest.fn() }))
jest.mock('@tauri-apps/plugin-os', () => ({ platform: jest.fn().mockResolvedValue('macos') }))
jest.mock('@vueuse/core', () => ({ useLocalStorage: () => ref('') }))
jest.mock('vue-i18n', () => ({ useI18n: () => ({ t: (key: string) => key }) }))
jest.mock('@/composables/useNotifications', () => ({
  toast: { info: jest.fn(), success: jest.fn(), error: jest.fn() },
}))

const setUa = (ua: string) => {
  Object.defineProperty(window.navigator, 'userAgent', {
    value: ua,
    configurable: true,
  })
}

const loadComposable = async () => {
  const mod = await import('@/composables/useAppUpdater')
  return mod.useAppUpdater()
}

describe('useAppUpdater on HarmonyOS', () => {
  beforeEach(() => {
    jest.resetModules()
    mockCheck.mockReset()
    setUa(
      'Mozilla/5.0 (PC; OpenHarmony 7.0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36 ArkWeb/7.0.0.0 Mobile',
    )
  })

  it('never reaches the updater plugin: checkForUpdates returns null', async () => {
    const updater = await loadComposable()
    await expect(updater.checkForUpdates(true)).resolves.toBeNull()
    expect(mockCheck).not.toHaveBeenCalled()
  })

  it('never reaches the updater plugin: downloadAndInstall is a no-op', async () => {
    const updater = await loadComposable()
    await expect(updater.downloadAndInstall()).resolves.toBeUndefined()
    expect(mockCheck).not.toHaveBeenCalled()
  })
})

describe('useAppUpdater on desktop', () => {
  beforeEach(() => {
    jest.resetModules()
    mockCheck.mockReset()
    setUa(
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15',
    )
  })

  it('checks for updates and reports up-to-date when none is found', async () => {
    mockCheck.mockResolvedValue(null)
    const updater = await loadComposable()
    await expect(updater.checkForUpdates()).resolves.toBeNull()
    expect(mockCheck).toHaveBeenCalledTimes(1)
    expect(updater.isUpToDate.value).toBe(true)
  })
})
