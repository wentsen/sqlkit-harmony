import { platform } from '@tauri-apps/plugin-os'
import { computed, ref } from 'vue'

const platformCache = ref<string | null>(null)
const platformReady = ref(false)

async function getPlatform(): Promise<string> {
  if (platformCache.value) {
    return platformCache.value
  }
  try {
    const p = await platform()
    platformCache.value = p
    platformReady.value = true
    return p
  }
  catch {
    platformCache.value = 'unknown'
    platformReady.value = true
    return 'unknown'
  }
}

// Initialize platform detection on module load
getPlatform()

// plugin-os reports "linux" on HarmonyOS (linux target), so the ArkWeb
// user agent is the reliable signal.
export const isOhosUserAgent = (userAgent: string): boolean => /openharmony/i.test(userAgent)

function usePlatform() {
  const isMac = computed(() => platformCache.value === 'macos')
  const isWindows = computed(() => platformCache.value === 'windows')
  const isLinux = computed(() => platformCache.value === 'linux')

  const isOhos = computed(
    () => typeof navigator !== 'undefined' && isOhosUserAgent(navigator.userAgent),
  )

  // Aligned with dockit: ⌘ on Mac, Ctrl on other platforms (no + suffix)
  const cmdKey = computed(() => isMac.value ? '⌘' : 'Ctrl')

  // Full modifier string for display: ⌘+ on Mac, Ctrl+ on others
  const modifierKey = computed(() => isMac.value ? '⌘' : 'Ctrl+')

  // Alt modifier for display: ⌥ on Mac, Alt+ on others
  const altKey = computed(() => isMac.value ? '⌥' : 'Alt+')

  return {
    isMac,
    isWindows,
    isLinux,
    isOhos,
    cmdKey,
    modifierKey,
    altKey,
    platform: platformCache,
    platformReady,
  }
}

export { getPlatform, usePlatform }
