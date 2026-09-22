'use client';

export const BASE_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8080/api/v1';

export const saveToLocalStorage = (key: string, value: string): void => {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(key, value);
  window.dispatchEvent(new CustomEvent('localStorageChange', { detail: { key, value } }));
};

export const setLocalStorageItem = (key: string, value: unknown): void => {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(key, JSON.stringify(value));
  window.dispatchEvent(new CustomEvent('localStorageChange', { detail: { key, value } }));
};

export const getFromLocalStorage = (key: string): string | null =>
  typeof window === 'undefined' ? null : window.localStorage.getItem(key);

export const getLocalStorageItem = (key: string): unknown | null => {
  if (typeof window === 'undefined') return null;
  const value = window.localStorage.getItem(key);
  if (!value) return null;
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return null;
  }
};

export const removeFromLocalStorage = (key: string): void => {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(key);
  window.dispatchEvent(new CustomEvent('localStorageChange', { detail: { key, value: null } }));
};
