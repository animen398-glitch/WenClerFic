const API_BASE = window.location.origin + '/api';
const SESSION_ENDPOINT = `${API_BASE}/auth/session`;
const STORAGE_USER_KEY = 'user';
const STORAGE_TOKEN_KEY = 'token';

let syncPromise = null;

export function getStoredUser() {
  try {
    const raw = localStorage.getItem(STORAGE_USER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (error) {
    console.warn('Ошибка чтения пользователя из localStorage:', error);
    localStorage.removeItem(STORAGE_USER_KEY);
    return null;
  }
}

export function getStoredToken() {
  return localStorage.getItem(STORAGE_TOKEN_KEY);
}

export function saveSessionData(user, token) {
  if (!user || !token) return;
  try {
    localStorage.setItem(STORAGE_USER_KEY, JSON.stringify(user));
    localStorage.setItem(STORAGE_TOKEN_KEY, token);
    dispatchAuthEvent({ user, token });
  } catch (error) {
    console.error('Не удалось сохранить данные сессии:', error);
  }
}

export function clearSessionData() {
  localStorage.removeItem(STORAGE_USER_KEY);
  localStorage.removeItem(STORAGE_TOKEN_KEY);
  dispatchAuthEvent({ user: null, token: null });
}

export async function syncSessionWithServer() {
  if (syncPromise) return syncPromise;

  syncPromise = (async () => {
    try {
      const response = await fetch(SESSION_ENDPOINT, {
        method: 'GET',
        credentials: 'include'
      });

      if (!response.ok) {
        if (response.status === 401) {
          clearSessionData();
        }
        return null;
      }

      const data = await response.json();
      if (data?.user && data?.token) {
        saveSessionData(data.user, data.token);
      }
      return data;
    } catch (error) {
      console.warn('Не удалось синхронизировать сессию:', error);
      return null;
    } finally {
      syncPromise = null;
    }
  })();

  return syncPromise;
}

export function onAuthChange(callback) {
  document.addEventListener('wenclerfic:auth-changed', callback);
}

function dispatchAuthEvent(detail) {
  document.dispatchEvent(new CustomEvent('wenclerfic:auth-changed', { detail }));
}


