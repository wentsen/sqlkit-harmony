/**
 * @jest-environment jsdom
 */
import { isOhosUserAgent } from '@/composables/usePlatform'

describe('isOhosUserAgent', () => {
  it('detects HarmonyOS PC user agents', () => {
    expect(
      isOhosUserAgent(
        'Mozilla/5.0 (PC; OpenHarmony 7.0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36 ArkWeb/7.0.0.0 Mobile',
      ),
    ).toBe(true)
  })

  it('detects OpenHarmony tablet/phone user agents', () => {
    expect(
      isOhosUserAgent(
        'Mozilla/5.0 (Phone; OpenHarmony 6.0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/132.0.0.0 Mobile Safari/537.36',
      ),
    ).toBe(true)
  })

  it('rejects desktop browser user agents', () => {
    expect(
      isOhosUserAgent(
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15',
      ),
    ).toBe(false)
  })

  it('rejects the Windows webview user agent', () => {
    expect(
      isOhosUserAgent(
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
      ),
    ).toBe(false)
  })

  it('is case-insensitive', () => {
    expect(isOhosUserAgent('Mozilla/5.0 (PC; OPENHARMONY 7.0) Chrome/144')).toBe(true)
  })
})
