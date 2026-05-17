import { vi, beforeEach, afterEach } from 'vitest'
import {
  getBgAnimationType,
  getBgAnimationPref,
  setBgAnimationType,
  getSeasonalAnimationType,
  BG_ANIMATION_STORAGE_KEY,
  BG_ANIMATION_CHANGE_EVENT,
  type AnimationType,
  type AnimationPref,
} from '@/lib/sakura-petals-pref'

const createFakeStorage = (): Storage => {
  const store: Record<string, string> = {}
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => {
      store[key] = value
    },
    removeItem: (key: string) => {
      delete store[key]
    },
    clear: () => {
      for (const key of Object.keys(store)) delete store[key]
    },
    get length() {
      return Object.keys(store).length
    },
    key: (i: number) => Object.keys(store)[i] ?? null,
  }
}

describe('lib/sakura-petals-pref', () => {
  const validTypes: AnimationType[] = ['sakura', 'momiji', 'snow', 'dandelion', 'rain', 'rain-drops', 'none']
  let fakeStorage: Storage
  const originalLocalStorage = typeof window !== 'undefined' ? window.localStorage : undefined

  beforeEach(() => {
    vi.clearAllMocks()
    fakeStorage = createFakeStorage()
    Object.defineProperty(window, 'localStorage', {
      value: fakeStorage,
      writable: true,
      configurable: true,
    })
  })

  afterEach(() => {
    if (originalLocalStorage !== undefined) {
      Object.defineProperty(window, 'localStorage', {
        value: originalLocalStorage,
        writable: true,
        configurable: true,
      })
    }
    vi.restoreAllMocks()
  })

  describe('getSeasonalAnimationType', () => {
    it('returns an AnimationType based on current month', () => {
      const result = getSeasonalAnimationType()
      expect(validTypes).toContain(result)
    })
  })

  describe('getBgAnimationPref', () => {
    it('returns seasonal when localStorage is empty (default)', () => {
      expect(getBgAnimationPref()).toBe('seasonal')
    })

    it('returns stored pref when valid', () => {
      const allPrefs: AnimationPref[] = ['seasonal', ...validTypes]
      for (const pref of allPrefs) {
        localStorage.removeItem('sakura-petals-enabled')
        localStorage.setItem(BG_ANIMATION_STORAGE_KEY, pref)
        expect(getBgAnimationPref()).toBe(pref)
      }
    })
  })

  describe('getBgAnimationType', () => {
    it('returns seasonal animation when localStorage is empty', () => {
      const result = getBgAnimationType()
      expect(validTypes).toContain(result)
      expect(result).toBe(getSeasonalAnimationType())
    })

    it('returns stored value when valid type is stored', () => {
      for (const type of validTypes) {
        localStorage.removeItem('sakura-petals-enabled')
        localStorage.setItem(BG_ANIMATION_STORAGE_KEY, type)
        expect(getBgAnimationType()).toBe(type)
      }
    })

    it('returns seasonal animation when stored value is invalid', () => {
      localStorage.removeItem('sakura-petals-enabled')
      localStorage.setItem(BG_ANIMATION_STORAGE_KEY, 'invalid')
      expect(getBgAnimationType()).toBe(getSeasonalAnimationType())
    })

    it('migrates from old key sakura-petals-enabled (true -> seasonal)', () => {
      localStorage.removeItem(BG_ANIMATION_STORAGE_KEY)
      localStorage.setItem('sakura-petals-enabled', 'true')
      getBgAnimationType()
      expect(localStorage.getItem(BG_ANIMATION_STORAGE_KEY)).toBe('seasonal')
      expect(localStorage.getItem('sakura-petals-enabled')).toBeNull()
    })

    it('migrates from old key sakura-petals-enabled (false -> none)', () => {
      localStorage.removeItem(BG_ANIMATION_STORAGE_KEY)
      localStorage.setItem('sakura-petals-enabled', 'false')
      expect(getBgAnimationType()).toBe('none')
      expect(localStorage.getItem(BG_ANIMATION_STORAGE_KEY)).toBe('none')
      expect(localStorage.getItem('sakura-petals-enabled')).toBeNull()
    })
  })

  describe('setBgAnimationType', () => {
    it('does not throw when window is undefined', () => {
      const originalWindow = global.window
      vi.stubGlobal('window', undefined)
      expect(() => setBgAnimationType('none')).not.toThrow()
      vi.stubGlobal('window', originalWindow)
    })

    it('saves to localStorage and dispatches custom event', () => {
      localStorage.removeItem(BG_ANIMATION_STORAGE_KEY)
      const events: Event[] = []
      window.addEventListener(BG_ANIMATION_CHANGE_EVENT, (e) => events.push(e))

      setBgAnimationType('momiji')

      expect(localStorage.getItem(BG_ANIMATION_STORAGE_KEY)).toBe('momiji')
      expect(events).toHaveLength(1)
      expect((events[0] as CustomEvent).detail).toEqual({ type: 'momiji' })
    })

    it('dispatches resolved type when seasonal is set', () => {
      const events: Event[] = []
      window.addEventListener(BG_ANIMATION_CHANGE_EVENT, (e) => events.push(e))

      setBgAnimationType('seasonal')

      expect(localStorage.getItem(BG_ANIMATION_STORAGE_KEY)).toBe('seasonal')
      expect(events).toHaveLength(1)
      const resolved = (events[0] as CustomEvent).detail.type
      expect(validTypes).toContain(resolved)
    })
  })

  describe('constants', () => {
    it('BG_ANIMATION_STORAGE_KEY is defined', () => {
      expect(BG_ANIMATION_STORAGE_KEY).toBe('bg-animation-type')
    })
    it('BG_ANIMATION_CHANGE_EVENT is defined', () => {
      expect(BG_ANIMATION_CHANGE_EVENT).toBe('bg-animation-change')
    })
  })
})
