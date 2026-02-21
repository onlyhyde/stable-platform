import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'

// English
import enActivity from './locales/en/activity.json'
import enApproval from './locales/en/approval.json'
import enBuy from './locales/en/buy.json'
import enCommon from './locales/en/common.json'
import enHome from './locales/en/home.json'
import enLock from './locales/en/lock.json'
import enModules from './locales/en/modules.json'
import enOnboarding from './locales/en/onboarding.json'
import enSend from './locales/en/send.json'
import enSettings from './locales/en/settings.json'
import enSwap from './locales/en/swap.json'
import enTx from './locales/en/tx.json'

// Korean
import koActivity from './locales/ko/activity.json'
import koApproval from './locales/ko/approval.json'
import koBuy from './locales/ko/buy.json'
import koCommon from './locales/ko/common.json'
import koHome from './locales/ko/home.json'
import koLock from './locales/ko/lock.json'
import koModules from './locales/ko/modules.json'
import koOnboarding from './locales/ko/onboarding.json'
import koSend from './locales/ko/send.json'
import koSettings from './locales/ko/settings.json'
import koSwap from './locales/ko/swap.json'
import koTx from './locales/ko/tx.json'

const resources = {
  en: {
    common: enCommon,
    home: enHome,
    lock: enLock,
    onboarding: enOnboarding,
    send: enSend,
    activity: enActivity,
    settings: enSettings,
    approval: enApproval,
    modules: enModules,
    swap: enSwap,
    buy: enBuy,
    tx: enTx,
  },
  ko: {
    common: koCommon,
    home: koHome,
    lock: koLock,
    onboarding: koOnboarding,
    send: koSend,
    activity: koActivity,
    settings: koSettings,
    approval: koApproval,
    modules: koModules,
    swap: koSwap,
    buy: koBuy,
    tx: koTx,
  },
}

const STORAGE_KEY = 'stablenet_language'

async function getStoredLanguage(): Promise<string | null> {
  try {
    if (typeof chrome !== 'undefined' && chrome.storage?.local) {
      const result = await chrome.storage.local.get(STORAGE_KEY)
      return (result[STORAGE_KEY] as string | undefined) ?? null
    }
  } catch {
    // Fallback to localStorage
  }
  try {
    return localStorage.getItem(STORAGE_KEY)
  } catch {
    return null
  }
}

function detectLanguage(): string {
  const browserLang = navigator.language.split('-')[0]
  return browserLang === 'ko' ? 'ko' : 'en'
}

export async function initI18n() {
  const stored = await getStoredLanguage()
  const lng = stored ?? detectLanguage()

  await i18n.use(initReactI18next).init({
    resources,
    lng,
    fallbackLng: 'en',
    defaultNS: 'common',
    ns: [
      'common',
      'home',
      'lock',
      'onboarding',
      'send',
      'activity',
      'settings',
      'approval',
      'modules',
      'swap',
      'buy',
      'tx',
    ],
    interpolation: {
      escapeValue: false,
    },
  })

  return i18n
}

export async function changeLanguage(lng: string) {
  await i18n.changeLanguage(lng)
  try {
    if (typeof chrome !== 'undefined' && chrome.storage?.local) {
      await chrome.storage.local.set({ [STORAGE_KEY]: lng })
    }
  } catch {
    // Fallback
  }
  try {
    localStorage.setItem(STORAGE_KEY, lng)
  } catch {
    // Ignore
  }
}

export default i18n
