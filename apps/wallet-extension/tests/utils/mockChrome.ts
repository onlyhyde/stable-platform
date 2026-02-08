/**
 * Chrome API Mock for Testing
 * Provides mock implementations of Chrome Extension APIs
 */

type StorageData = Record<string, unknown>

// Storage mock factory
function createStorageMock() {
  let data: StorageData = {}

  return {
    get: jest.fn((keys: string | string[] | null) => {
      if (keys === null) {
        return Promise.resolve({ ...data })
      }
      const keyArray = Array.isArray(keys) ? keys : [keys]
      const result: StorageData = {}
      for (const key of keyArray) {
        if (key in data) {
          result[key] = data[key]
        }
      }
      return Promise.resolve(result)
    }),

    set: jest.fn((items: StorageData) => {
      data = { ...data, ...items }
      return Promise.resolve()
    }),

    remove: jest.fn((keys: string | string[]) => {
      const keyArray = Array.isArray(keys) ? keys : [keys]
      for (const key of keyArray) {
        delete data[key]
      }
      return Promise.resolve()
    }),

    clear: jest.fn(() => {
      data = {}
      return Promise.resolve()
    }),

    // Helper for tests to inspect storage
    _getData: () => ({ ...data }),
    _setData: (newData: StorageData) => {
      data = { ...newData }
    },
  }
}

// Runtime mock
const runtimeMock = {
  id: 'test-extension-id',
  getURL: jest.fn((path: string) => `chrome-extension://test-extension-id/${path}`),
  sendMessage: jest.fn(() => Promise.resolve()),
  onMessage: {
    addListener: jest.fn(),
    removeListener: jest.fn(),
    hasListener: jest.fn(() => false),
  },
  onInstalled: {
    addListener: jest.fn(),
    removeListener: jest.fn(),
  },
  onStartup: {
    addListener: jest.fn(),
    removeListener: jest.fn(),
  },
  connect: jest.fn(() => ({
    name: 'test-port',
    onDisconnect: { addListener: jest.fn(), removeListener: jest.fn() },
    onMessage: { addListener: jest.fn(), removeListener: jest.fn() },
    postMessage: jest.fn(),
    disconnect: jest.fn(),
  })),
  onConnect: {
    addListener: jest.fn(),
    removeListener: jest.fn(),
  },
  lastError: null as chrome.runtime.LastError | null,
}

// Tabs mock
const tabsMock = {
  query: jest.fn(() => Promise.resolve([])),
  get: jest.fn((tabId: number) =>
    Promise.resolve({ id: tabId, url: 'https://example.com', active: true })
  ),
  create: jest.fn((options: chrome.tabs.CreateProperties) =>
    Promise.resolve({ id: 1, ...options })
  ),
  update: jest.fn(() => Promise.resolve()),
  remove: jest.fn(() => Promise.resolve()),
  sendMessage: jest.fn(() => Promise.resolve()),
  onUpdated: {
    addListener: jest.fn(),
    removeListener: jest.fn(),
  },
  onRemoved: {
    addListener: jest.fn(),
    removeListener: jest.fn(),
  },
  onActivated: {
    addListener: jest.fn(),
    removeListener: jest.fn(),
  },
}

// Windows mock
const windowsMock = {
  create: jest.fn((options: chrome.windows.CreateData) => Promise.resolve({ id: 1, ...options })),
  update: jest.fn(() => Promise.resolve()),
  remove: jest.fn(() => Promise.resolve()),
  getCurrent: jest.fn(() => Promise.resolve({ id: 1, focused: true })),
  getAll: jest.fn(() => Promise.resolve([{ id: 1, focused: true }])),
  onFocusChanged: {
    addListener: jest.fn(),
    removeListener: jest.fn(),
  },
}

// Alarms mock
const alarmsMock = {
  create: jest.fn(),
  clear: jest.fn(() => Promise.resolve(true)),
  clearAll: jest.fn(() => Promise.resolve(true)),
  get: jest.fn(() => Promise.resolve(null)),
  getAll: jest.fn(() => Promise.resolve([])),
  onAlarm: {
    addListener: jest.fn(),
    removeListener: jest.fn(),
  },
}

// Action mock (browser action)
const actionMock = {
  setIcon: jest.fn(() => Promise.resolve()),
  setBadgeText: jest.fn(() => Promise.resolve()),
  setBadgeBackgroundColor: jest.fn(() => Promise.resolve()),
  setTitle: jest.fn(() => Promise.resolve()),
  onClicked: {
    addListener: jest.fn(),
    removeListener: jest.fn(),
  },
}

// Idle mock
const idleMock = {
  queryState: jest.fn(() => Promise.resolve('active' as chrome.idle.IdleState)),
  setDetectionInterval: jest.fn(),
  onStateChanged: {
    addListener: jest.fn(),
    removeListener: jest.fn(),
  },
}

// Notifications mock
const notificationsMock = {
  create: jest.fn(
    (_notificationId: string, _options: chrome.notifications.NotificationOptions<true>) =>
      Promise.resolve('notification-id')
  ),
  clear: jest.fn(() => Promise.resolve(true)),
  onClicked: {
    addListener: jest.fn(),
    removeListener: jest.fn(),
  },
  onClosed: {
    addListener: jest.fn(),
    removeListener: jest.fn(),
  },
}

// Main Chrome mock object
export const mockChrome = {
  storage: {
    local: createStorageMock(),
    session: createStorageMock(),
    sync: createStorageMock(),
    onChanged: {
      addListener: jest.fn(),
      removeListener: jest.fn(),
    },
  },
  runtime: runtimeMock,
  tabs: tabsMock,
  windows: windowsMock,
  alarms: alarmsMock,
  action: actionMock,
  idle: idleMock,
  notifications: notificationsMock,
} as unknown as typeof chrome

// Type declaration for global
declare global {
  var chrome: typeof mockChrome
}
