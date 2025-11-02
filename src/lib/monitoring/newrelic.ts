interface NetworkInformation {
  effectiveType?: '4g' | '3g' | '2g' | 'slow-2g';
  type?: string;
  downlink?: number;
}

declare global {
  interface Window {
    newrelic?: {
      addPageAction: (name: string, attributes: Record<string, unknown>) => void;
      noticeError: (error: Error, attributes?: Record<string, unknown>) => void;
      setCustomAttribute: (name: string, value: unknown) => void;
    };
    _nrCustomAttributes?: Record<string, unknown>;
  }
  interface Navigator {
    connection?: NetworkInformation;
    mozConnection?: NetworkInformation;
    webkitConnection?: NetworkInformation;
  }
}

let sessionId: string;
let userId: string;

const formatIndianDate = (timestamp?: number) => {
  const date = timestamp ? new Date(timestamp) : new Date();
  return date.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    timeZone: 'Asia/Kolkata'
  });
};

const generateSessionId = () => 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);

const generateUserId = () => {
  if (typeof window === 'undefined') return 'server_user';
  let stored = localStorage.getItem('quipe_user_id');
  if (!stored) {
    stored = 'user_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    localStorage.setItem('quipe_user_id', stored);
  }
  return stored;
};

let cachedBrowserInfo: Record<string, unknown> | null = null;

const getBrowserInfo = (forceRefresh = false) => {
  if (typeof window === 'undefined') return { environment: 'server', sessionId, userId };
  
  if (cachedBrowserInfo && !forceRefresh) {
    return {
      ...cachedBrowserInfo,
      timestamp: Date.now(),
      dateIST: formatIndianDate(),
      timeIST: new Date().toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata' }),
    };
  }
  
  const nav = navigator;
  const screen = window.screen;
  const connection = nav.connection || nav.mozConnection || nav.webkitConnection;
  const locationData = getLocationData();
  
  const inferredLocation = {
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    timezoneOffset: new Date().getTimezoneOffset(),
    locale: nav.language,
    currency: getCurrencyFromLocale(),
    browserCountry: Intl.DateTimeFormat().resolvedOptions().locale?.split('-')[1] || null,
    inferredRegion: getRegionFromTimezone(Intl.DateTimeFormat().resolvedOptions().timeZone),
    inferredCountry: getCountryFromTimezone(Intl.DateTimeFormat().resolvedOptions().timeZone),
    smartCountry: getSmartCountryDetection(nav.language, Intl.DateTimeFormat().resolvedOptions().timeZone, locationData.country as string | null)
  };
  
  cachedBrowserInfo = {
    userAgent: nav.userAgent,
    platform: nav.platform,
    language: nav.language,
    languages: nav.languages?.join(',') || nav.language,
    cookieEnabled: nav.cookieEnabled,
    onLine: nav.onLine,
    
    browserName: getBrowserName(),
    browserVersion: getBrowserVersion(),
    isMobile: /Mobile|Android|iPhone|iPad|iPod|BlackBerry|Opera Mini/i.test(nav.userAgent),
    isTablet: /iPad|Android/i.test(nav.userAgent) && !/Mobile/i.test(nav.userAgent),
    
    screenWidth: screen.width,
    screenHeight: screen.height,
    screenColorDepth: screen.colorDepth,
    screenPixelDepth: screen.pixelDepth,
    
    viewportWidth: window.innerWidth,
    viewportHeight: window.innerHeight,
    devicePixelRatio: window.devicePixelRatio || 1,
    
    connectionType: getConnectionType(connection),
    estimatedISP: getISPFromConnection(connection),
    
    url: window.location.href,
    hostname: window.location.hostname,
    pathname: window.location.pathname,
    referrer: document.referrer,
    
    sessionId,
    userId,
    
    hasLocalStorage: typeof(Storage) !== "undefined",
    hasSessionStorage: typeof(Storage) !== "undefined",
    hasWebGL: !!window.WebGLRenderingContext,
    hasTouchScreen: 'ontouchstart' in window || navigator.maxTouchPoints > 0,
    hasGeolocation: !!navigator.geolocation,
    
    isPWAInstalled: getPWAInstallationStatus(),
    displayMode: getPWADisplayMode(),
    isStandalone: window.matchMedia('(display-mode: standalone)').matches,
    hasServiceWorker: 'serviceWorker' in navigator,
    isInWebAppiOSCapable: (window.navigator as { standalone?: boolean }).standalone === true,
    
    loadTime: performance.timing ? performance.timing.loadEventEnd - performance.timing.navigationStart : null,
    domContentLoadedTime: performance.timing ? performance.timing.domContentLoadedEventEnd - performance.timing.navigationStart : null,
    
    deviceCategory: /Mobile|Android|iPhone|iPad|iPod|BlackBerry|Opera Mini/i.test(nav.userAgent) ? 'mobile' : 
                   /iPad|Android/i.test(nav.userAgent) && !/Mobile/i.test(nav.userAgent) ? 'tablet' : 'desktop',
    screenSize: `${screen.width}x${screen.height}`,
    viewportSize: `${window.innerWidth}x${window.innerHeight}`,
    browserEngine: `${getBrowserName()} ${getBrowserVersion()}`,
    
    ...locationData,
    ...inferredLocation
  };
  
  return {
    ...cachedBrowserInfo,
    timestamp: Date.now(),
    dateIST: formatIndianDate(),
    timeIST: new Date().toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata' }),
  };
};

const getUserMetrics = (incrementCounters = false) => {
  if (typeof window === 'undefined') return {};
  
  const data = JSON.parse(sessionStorage.getItem('quipe_session_data') || '{}');
  const now = Date.now();
  
  if (incrementCounters) {
    data.pageViews = (data.pageViews || 0) + 1;
    data.totalEvents = (data.totalEvents || 0) + 1;
  }
  
  data.sessionStart = data.sessionStart || now;
  data.lastActivity = now;
  sessionStorage.setItem('quipe_session_data', JSON.stringify(data));
  
  const visitCount = parseInt(localStorage.getItem('quipe_visit_count') || '0');
  
  return {
    sessionDuration: now - data.sessionStart,
    pageViews: data.pageViews || 1,
    totalEvents: data.totalEvents || 1,
    isReturningUser: !!localStorage.getItem('quipe_user_id'),
    visitCount: visitCount,
    lastActivity: data.lastActivity,
    sessionAge: now - data.sessionStart,
    avgTimePerPage: (data.pageViews || 1) > 0 ? (now - data.sessionStart) / (data.pageViews || 1) : 0
  };
};

const getLocationData = () => {
  const cached = sessionStorage.getItem('quipe_location_data');
  if (cached) {
    try {
      return JSON.parse(cached) as Record<string, unknown>;
    } catch {
      return {};
    }
  }
  return {};
};

const requestLocationData = async () => {
  if (typeof window === 'undefined') return;
  
  try {
    const ipLocationResponse = await fetch('/api/location');
    if (ipLocationResponse.ok) {
      const ipLocation = await ipLocationResponse.json();
      const locationData = {
        ...ipLocation,
        source: 'ip_geolocation',
        timestamp: Date.now(),
        locationDateIST: formatIndianDate(),
        locationTimeIST: new Date().toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata' })
      };
      sessionStorage.setItem('quipe_location_data', JSON.stringify(locationData));
    }
  } catch (error) {
    console.warn('Failed to get IP location:', error);
  }
};

const getBrowserName = () => {
  if (typeof window === 'undefined') return 'Unknown';
  const userAgent = navigator.userAgent;
  if (userAgent.includes('Firefox')) return 'Firefox';
  if (userAgent.includes('Chrome') && !userAgent.includes('Edge')) return 'Chrome';
  if (userAgent.includes('Safari') && !userAgent.includes('Chrome')) return 'Safari';
  if (userAgent.includes('Edge')) return 'Edge';
  if (userAgent.includes('Opera')) return 'Opera';
  if (userAgent.includes('MSIE')) return 'Internet Explorer';
  return 'Unknown';
};

const getBrowserVersion = () => {
  if (typeof window === 'undefined') return 'Unknown';
  const userAgent = navigator.userAgent;
  const match = userAgent.match(/(chrome|safari|firefox|msie|edge|opera)\/?\s*(\d+)/i);
  return match ? match[2] : 'Unknown';
};

const getCurrencyFromLocale = () => {
  if (typeof window === 'undefined') return null;
  try {
    const locale = navigator.language;
    const currencyMap: { [key: string]: string } = {
      'en-US': 'USD', 'en-GB': 'GBP', 'en-IN': 'INR', 'en-AU': 'AUD', 'en-CA': 'CAD',
      'de-DE': 'EUR', 'fr-FR': 'EUR', 'es-ES': 'EUR', 'it-IT': 'EUR', 'nl-NL': 'EUR',
      'ja-JP': 'JPY', 'ko-KR': 'KRW', 'zh-CN': 'CNY', 'pt-BR': 'BRL', 'ru-RU': 'RUB'
    };
    return currencyMap[locale] || locale.includes('IN') ? 'INR' : null;
  } catch {
    return null;
  }
};

const getRegionFromTimezone = (timezone: string) => {
  if (!timezone) return null;
  const parts = timezone.split('/');
  return parts.length > 1 ? parts[0] : null; // e.g., 'Asia' from 'Asia/Kolkata'
};

const getCountryFromTimezone = (timezone: string) => {
  if (!timezone) return null;
  const timezoneCountryMap: { [key: string]: string } = {
    'Asia/Kolkata': 'IN', 'Asia/Mumbai': 'IN', 'Asia/Delhi': 'IN',
    'America/New_York': 'US', 'America/Los_Angeles': 'US', 'America/Chicago': 'US',
    'Europe/London': 'GB', 'Europe/Paris': 'FR', 'Europe/Berlin': 'DE',
    'Asia/Tokyo': 'JP', 'Asia/Shanghai': 'CN', 'Asia/Seoul': 'KR',
    'Australia/Sydney': 'AU', 'Pacific/Auckland': 'NZ'
  };
  return timezoneCountryMap[timezone] || null;
};

const getSmartCountryDetection = (language: string, timezone: string, ipCountry: string | null) => {
  if (timezone === 'Asia/Kolkata' || timezone === 'Asia/Mumbai' || timezone === 'Asia/Delhi') {
    return 'IN';
  }
  
  if (language.includes('IN') || language.startsWith('hi') || language.startsWith('ta') || language.startsWith('te')) {
    return 'IN';
  }
  
  if (timezone.startsWith('Asia/') && ipCountry === 'US') {
    const timezoneCountry = getCountryFromTimezone(timezone);
    if (timezoneCountry) return timezoneCountry;
  }
  
  return ipCountry;
};

const getPWAInstallationStatus = () => {
  if (typeof window === 'undefined') return false;
  
  if (window.matchMedia('(display-mode: standalone)').matches) {
    return true;
  }
  
  if ((window.navigator as { standalone?: boolean }).standalone === true) {
    return true;
  }
  
  if (window.matchMedia('(display-mode: minimal-ui)').matches) {
    return true;
  }
  
  return false;
};

const getPWADisplayMode = () => {
  if (typeof window === 'undefined') return 'browser';
  
  if (window.matchMedia('(display-mode: standalone)').matches) {
    return 'standalone';
  }
  if (window.matchMedia('(display-mode: minimal-ui)').matches) {
    return 'minimal-ui';
  }
  if (window.matchMedia('(display-mode: fullscreen)').matches) {
    return 'fullscreen';
  }
  return 'browser';
};

const getConnectionType = (connection?: NetworkInformation) => {
  if (!connection) return 'unknown';
  
  if (connection.effectiveType) {
    return connection.effectiveType; // '4g', '3g', '2g', 'slow-2g'
  }
  
  if (connection.type) {
    return connection.type; // 'wifi', 'cellular', 'bluetooth', 'ethernet'
  }
  
  return 'unknown';
};

const getISPFromConnection = (connection?: NetworkInformation) => {
  if (!connection) return null;
  
  if (connection.effectiveType === '4g' && connection.downlink && connection.downlink > 10) {
    return 'fiber_or_5g';
  } else if (connection.effectiveType === '4g') {
    return 'broadband_4g';
  } else if (connection.effectiveType === '3g') {
    return 'mobile_3g';
  } else if (connection.effectiveType === 'slow-2g' || connection.effectiveType === '2g') {
    return 'mobile_2g';
  }
  
  return 'unknown';
};

async function sendEvent(eventType: string, eventName: string, attributes: Record<string, unknown>, incrementCounters = false) {
  if (typeof window === 'undefined') return;
  
  const apiKey = process.env.NEXT_PUBLIC_NEWRELIC_BROWSER_LICENSE_KEY;
  const accountId = process.env.NEXT_PUBLIC_NEWRELIC_ACCOUNT_ID;
  const appId = process.env.NEXT_PUBLIC_NEWRELIC_APPLICATION_ID;
  
  if (!apiKey || !accountId) {
    console.warn('New Relic configuration incomplete');
    return;
  }
  
  try {
    const payload = {
      eventType,
      actionName: eventName,
      appName: 'quipeai',
      appId: appId ? parseInt(appId) : undefined,
      eventDateIST: formatIndianDate(),
      eventTimeIST: new Date().toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata' }),
      ...getBrowserInfo(),
      ...getUserMetrics(incrementCounters),
      ...attributes
    };

    await fetch(`https://insights-collector.newrelic.com/v1/accounts/${accountId}/events`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Insert-Key': apiKey
      },
      body: JSON.stringify(payload)
    });
  } catch (error) {
    console.warn('New Relic error:', error);
  }
}

export const initializeNewRelic = () => {
  if (typeof window === 'undefined') return;

  sessionId = generateSessionId();
  userId = generateUserId();
  
  const visitCount = parseInt(localStorage.getItem('quipe_visit_count') || '0') + 1;
  localStorage.setItem('quipe_visit_count', visitCount.toString());

  requestLocationData().then(() => {
    cachedBrowserInfo = null;
    getBrowserInfo(true); // Force refresh to include location data
  });

  window.newrelic = {
    addPageAction: (name: string, attributes: Record<string, unknown>) => sendEvent('BrowserPageAction', name, attributes),
    noticeError: (error: Error, attributes?: Record<string, unknown>) => sendEvent('BrowserError', 'error', { 
      errorMessage: error.message, 
      errorStack: error.stack,
      ...attributes 
    }),
    setCustomAttribute: (name: string, value: unknown) => {
      if (!window._nrCustomAttributes) window._nrCustomAttributes = {};
      window._nrCustomAttributes[name] = value;
    }
  };
};

export const NewRelic = {
  recordAppEvent: (eventName: string, attributes: Record<string, unknown> = {}, incrementCounters = false) => 
    sendEvent('AppLifecycle', eventName, attributes, incrementCounters),
  
  recordBrowserEvent: (eventName: string, attributes: Record<string, unknown> = {}) => 
    sendEvent('BrowserPageAction', eventName, attributes),
  
  recordError: (name: string, message: string, attributes?: Record<string, unknown>) => 
    sendEvent('BrowserError', name, { errorMessage: message, ...attributes })
};
