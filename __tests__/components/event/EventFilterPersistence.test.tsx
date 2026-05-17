import { vi } from 'vitest'
/**
 * イベントフィルター永続化コンポーネントのテスト
 */

import { render } from '../../utils/test-utils'
import { EventFilterPersistence } from '@/components/event/EventFilterPersistence'

// モックのセットアップ
const mockReplace = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    replace: mockReplace,
    push: vi.fn(),
    refresh: vi.fn(),
  }),
  useSearchParams: () => mockSearchParams,
}))

let mockSearchParams: URLSearchParams

// localStorageのモック
const mockLocalStorage: Record<string, string> = {}
const localStorageMock = {
  getItem: vi.fn((key: string) => mockLocalStorage[key] || null),
  setItem: vi.fn((key: string, value: string) => {
    mockLocalStorage[key] = value
  }),
  removeItem: vi.fn((key: string) => {
    delete mockLocalStorage[key]
  }),
  clear: vi.fn(() => {
    Object.keys(mockLocalStorage).forEach(key => delete mockLocalStorage[key])
  }),
  length: 0,
  key: vi.fn(),
}
Object.defineProperty(window, 'localStorage', { value: localStorageMock })

describe('EventFilterPersistence', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorageMock.clear()
    Object.keys(mockLocalStorage).forEach(key => delete mockLocalStorage[key])
    mockSearchParams = new URLSearchParams()
  })

  // 1
  it('UIを表示しない（nullを返す）', () => {
    const { container } = render(<EventFilterPersistence />)
    expect(container.innerHTML).toBe('')
  })

  // 2
  it('URLパラメータがある場合はlocalStorageに保存する', () => {
    mockSearchParams = new URLSearchParams('region=関東')
    render(<EventFilterPersistence />)
    expect(localStorageMock.setItem).toHaveBeenCalledWith(
      'event-filter-settings',
      expect.stringContaining('関東')
    )
  })

  // 3
  it('URLパラメータがない場合にlocalStorageから復元する', () => {
    mockLocalStorage['event-filter-settings'] = JSON.stringify({ region: '関東' })
    mockSearchParams = new URLSearchParams()
    render(<EventFilterPersistence />)
    expect(mockReplace).toHaveBeenCalledWith(expect.stringContaining('region=%E9%96%A2%E6%9D%B1'))
  })

  // 4
  it('URLにパラメータがある場合はlocalStorageから復元しない', () => {
    mockLocalStorage['event-filter-settings'] = JSON.stringify({ region: '関西' })
    mockSearchParams = new URLSearchParams('region=関東')
    render(<EventFilterPersistence />)
    // replaceは復元のために呼ばれないはず（保存は別のuseEffectで行われる）
    expect(mockReplace).not.toHaveBeenCalled()
  })

  // 5
  it('localStorageが空の場合はrouter.replaceを呼ばない', () => {
    mockSearchParams = new URLSearchParams()
    render(<EventFilterPersistence />)
    expect(mockReplace).not.toHaveBeenCalled()
  })

  // 6
  it('localStorageに無効なJSONがあってもエラーにならない', () => {
    mockLocalStorage['event-filter-settings'] = 'invalid-json'
    mockSearchParams = new URLSearchParams()
    expect(() => render(<EventFilterPersistence />)).not.toThrow()
  })

  // 7
  it('regionフィルターを保存する', () => {
    mockSearchParams = new URLSearchParams('region=東北')
    render(<EventFilterPersistence />)
    const savedData = JSON.parse(localStorageMock.setItem.mock.calls[0][1])
    expect(savedData.region).toBe('東北')
  })

  // 8
  it('viewフィルターを保存する', () => {
    mockSearchParams = new URLSearchParams('view=calendar')
    render(<EventFilterPersistence />)
    const savedData = JSON.parse(localStorageMock.setItem.mock.calls[0][1])
    expect(savedData.view).toBe('calendar')
  })

  // 9
  it('showPastフィルターを保存する', () => {
    mockSearchParams = new URLSearchParams('showPast=true')
    render(<EventFilterPersistence />)
    const savedData = JSON.parse(localStorageMock.setItem.mock.calls[0][1])
    expect(savedData.showPast).toBe('true')
  })

  // 10
  it('prefectureフィルターを保存する', () => {
    mockSearchParams = new URLSearchParams('prefecture=東京都')
    render(<EventFilterPersistence />)
    const savedData = JSON.parse(localStorageMock.setItem.mock.calls[0][1])
    expect(savedData.prefecture).toBe('東京都')
  })

  // 11
  it('複数のパラメータを復元する', () => {
    mockLocalStorage['event-filter-settings'] = JSON.stringify({
      region: '関東',
      view: 'calendar',
      showPast: 'true',
    })
    mockSearchParams = new URLSearchParams()
    render(<EventFilterPersistence />)
    expect(mockReplace).toHaveBeenCalled()
    const calledUrl = mockReplace.mock.calls[0][0] as string
    expect(calledUrl).toContain('region=')
    expect(calledUrl).toContain('view=calendar')
    expect(calledUrl).toContain('showPast=true')
  })

  // 12
  it('router.replaceが復元されたパラメータで呼ばれる', () => {
    mockLocalStorage['event-filter-settings'] = JSON.stringify({ view: 'list' })
    mockSearchParams = new URLSearchParams()
    render(<EventFilterPersistence />)
    expect(mockReplace).toHaveBeenCalledWith(expect.stringContaining('/events?'))
  })

  // 13
  it('正しいlocalStorageキーを使用する', () => {
    mockSearchParams = new URLSearchParams('region=北海道')
    render(<EventFilterPersistence />)
    expect(localStorageMock.setItem).toHaveBeenCalledWith(
      'event-filter-settings',
      expect.any(String)
    )
  })

  // 14
  it('複数のパラメータ変更を保存する', () => {
    mockSearchParams = new URLSearchParams('region=関西&prefecture=大阪府&view=calendar')
    render(<EventFilterPersistence />)
    const savedData = JSON.parse(localStorageMock.setItem.mock.calls[0][1])
    expect(savedData.region).toBe('関西')
    expect(savedData.prefecture).toBe('大阪府')
    expect(savedData.view).toBe('calendar')
  })

  // 15
  it('localStorageが利用できない場合もエラーにならない', () => {
    localStorageMock.getItem.mockImplementationOnce(() => {
      throw new Error('localStorage unavailable')
    })
    mockSearchParams = new URLSearchParams()
    expect(() => render(<EventFilterPersistence />)).not.toThrow()
  })

  // 16
  it('パラメータがない場合はlocalStorageに保存しない', () => {
    mockSearchParams = new URLSearchParams()
    render(<EventFilterPersistence />)
    // setItemが呼ばれないことを確認（復元のgetItemは呼ばれる可能性あり）
    expect(localStorageMock.setItem).not.toHaveBeenCalled()
  })
})
