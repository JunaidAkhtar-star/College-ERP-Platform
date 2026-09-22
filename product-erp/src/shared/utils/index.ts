'use client';
import { useEffect, useState } from 'react';
export const BASE_URL = process.env['NEXT_PUBLIC_BACKEND_URL'];

//? SET To LocalStorage
export const saveToLocalStorage = (key: string, value: string) => {
  if (typeof window !== 'undefined') {
    localStorage.setItem(key, value);
    // Dispatch custom event for same-tab detection
    window.dispatchEvent(
      new CustomEvent('localStorageChange', {
        detail: { key, value },
      }),
    );
  }
};
export const setLocalStorageItem = (key: string, value: unknown): void => {
  if (typeof window !== 'undefined') {
    localStorage.setItem(key, JSON.stringify(value));
    // Dispatch custom event for same-tab detection
    window.dispatchEvent(
      new CustomEvent('localStorageChange', {
        detail: { key, value },
      }),
    );
  }
};
//? GET From LocalStorage
export const getFromLocalStorage = (key: string) => {
  return typeof window !== 'undefined' ? (localStorage.getItem(key) ?? null) : null;
};
export const getLocalStorageItem = (key: string): unknown | null => {
  if (typeof window !== 'undefined') {
    const storedItem = localStorage.getItem(key);
    if (storedItem) {
      return JSON.parse(storedItem);
    }
  }
  return null;
};
//? Remove from LocalStorage
export const removeFromLocalStorage = (key: string) => {
  if (typeof window !== 'undefined') {
    localStorage.removeItem(key);
    // Dispatch custom event for same-tab detection
    window.dispatchEvent(
      new CustomEvent('localStorageChange', {
        detail: { key, value: null },
      }),
    );
  }
};
export const getinitialQuery = () => {
  return typeof window !== 'undefined'
    ? typeof getFromLocalStorage('initialQuery') === 'string'
      ? getFromLocalStorage('initialQuery')!
      : null
    : null;
};

export interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList;
}

export interface SpeechRecognitionResultList {
  readonly length: number;
  item(index: number): SpeechRecognitionResult;
  [index: number]: SpeechRecognitionResult;
}

export interface SpeechRecognitionResult {
  readonly length: number;
  item(index: number): SpeechRecognitionAlternative;
  [index: number]: SpeechRecognitionAlternative;
  isFinal: boolean;
}

export interface SpeechRecognitionAlternative {
  transcript: string;
  confidence: number;
}

export interface SpeechRecognitionErrorEvent extends Event {
  error: string;
  message: string;
}

export interface SpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  maxAlternatives: number;
  onaudioend: ((this: SpeechRecognition, ev: Event) => void) | null;
  onaudiostart: ((this: SpeechRecognition, ev: Event) => void) | null;
  onend: ((this: SpeechRecognition, ev: Event) => void) | null;
  onerror: ((this: SpeechRecognition, ev: SpeechRecognitionErrorEvent) => void) | null;
  onnomatch: ((this: SpeechRecognition, ev: SpeechRecognitionEvent) => void) | null;
  onresult: ((this: SpeechRecognition, ev: SpeechRecognitionEvent) => void) | null;
  onstart: ((this: SpeechRecognition, ev: Event) => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}

export interface SpeechRecognitionConstructor {
  new (): SpeechRecognition;
}
export function generateRandomColor(opacity = 0.5) {
  const r = Math.floor(Math.random() * 256);
  const g = Math.floor(Math.random() * 256);
  const b = Math.floor(Math.random() * 256);
  return `rgba(${r}, ${g}, ${b}, ${opacity})`;
}

export const useResponsiveBreakpoints = () => {
  const [breakpoints, setBreakpoints] = useState({
    isMobile: false,
    isTablet: false,
    isDesktop: false,
  });

  useEffect(() => {
    const checkBreakpoints = () => {
      const width = window.innerWidth;
      setBreakpoints({
        isMobile: width < 640,
        isTablet: width >= 640 && width < 1024,
        isDesktop: width >= 1024,
      });
    };

    checkBreakpoints();
    window.addEventListener('resize', checkBreakpoints);
    return () => window.removeEventListener('resize', checkBreakpoints);
  }, []);

  return breakpoints;
};

export { getRoleHomePath, ROLE_HOME_MAP } from './roleRoutes';
export { downloadPdf, downloadPdfBlob, fetchPdf, fetchProtectedBlob } from './pdfDownload';

export const getTenantId = (): string | null => {
  if (typeof window === 'undefined') {
    return null;
  }

  // 1. Resolve only a direct child of the configured ERP root domain.
  // Root hosts such as erp.devvelocity.in and localhost never become tenants.
  const host = window.location.hostname.toLowerCase();
  const rootDomain = (process.env.NEXT_PUBLIC_ERP_ROOT_DOMAIN || 'localhost')
    .split(':')[0]
    .toLowerCase();
  const tenantSuffix = `.${rootDomain}`;
  const isTenantHost = host !== rootDomain && host.endsWith(tenantSuffix);
  const tenantLabel = isTenantHost ? host.slice(0, -tenantSuffix.length) : '';
  const resolvedSubdomain = tenantLabel && !tenantLabel.includes('.') ? tenantLabel : null;
  const hasSubdomain = resolvedSubdomain !== null;

  if (resolvedSubdomain) {
    return resolvedSubdomain;
  }

  // Custom domains are resolved by the Next proxy and exposed through this
  // host-scoped, non-sensitive cookie before client-side API calls begin.
  const cookieTenant = document.cookie
    .split('; ')
    .find((entry) => entry.startsWith('devvelocity-tenant='))
    ?.split('=')[1];
  if (cookieTenant && /^[a-z0-9-]+$/.test(cookieTenant)) {
    return cookieTenant;
  }

  // 2. Pathname-based resolution (e.g. /mit/auth/signin -> mit)
  const pathParts = window.location.pathname.split('/');
  const firstPathSegment = pathParts[1];
  const reservedSegments = [
    'super-admin',
    'super_admin',
    'admin',
    'principal',
    'dean_academic',
    'administration_office',
    'assistant_administration_officer',
    'hod',
    'faculty',
    'student',
    'parent',
    'examination_cell',
    'iqac_naac',
    'iqac_team',
    'scholarship_cell',
    'library_staff',
    'placement_cell',
    'hr_department',
    'accounts_department',
    'admission_incharge',
    'admission_counselor',
    'hostel_warden',
    'transportation',
    'research_development',
    'club_head',
    'iic',
    'store',
    'contact',
    'demo',
    '_next',
    'api',
    'favicon.ico',
  ];

  if (firstPathSegment && !reservedSegments.includes(firstPathSegment)) {
    const nonTenantRoots = ['auth', 'admission-portal', 'modules'];
    if (!nonTenantRoots.includes(firstPathSegment)) {
      return firstPathSegment;
    }
  }

  // If we don't have a subdomain and we don't have a path-based tenant ID,
  // we are on the main global platform (no tenant context).
  // Return null to allow global super-admin login with Develocity branding.
  // If we don't have a subdomain and we don't have a path-based tenant ID,
  // we are on the main global platform (no tenant context).
  // Return null to allow global super-admin login with Develocity branding.
  const isGlobalRoute =
    ['auth', 'super-admin', 'contact', 'demo'].includes(firstPathSegment) ||
    window.location.pathname === '/';
  if (isGlobalRoute && !hasSubdomain) {
    return null;
  }

  // 3. Fallback to env variable in development ONLY if we aren't explicitly on a global route
  if (process.env.NODE_ENV === 'development' && process.env.NEXT_PUBLIC_DEV_TENANT_ID) {
    return process.env.NEXT_PUBLIC_DEV_TENANT_ID;
  }

  return null;
};

/**
 * Builds an internal ERP URL for the active tenant and role.
 *
 * Navigation must carry the tenant in the pathname because local development,
 * root-domain access, and custom-domain rewrites cannot safely reconstruct a
 * role-only URL after client-side navigation.
 */
export const getTenantRolePath = (
  role: string,
  path = '/dashboard',
  tenantId: string | null = getTenantId(),
): string => {
  const normalizedRole = role.trim().replace(/^\/+|\/+$/g, '');
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  const normalizedTenant = tenantId?.trim().replace(/^\/+|\/+$/g, '') ?? '';
  const rolePrefix = `/${normalizedRole}`;

  if (normalizedTenant) {
    const tenantPrefix = `/${normalizedTenant}`;
    if (
      normalizedPath === tenantPrefix ||
      normalizedPath.startsWith(`${tenantPrefix}/`) ||
      normalizedPath.startsWith(`${tenantPrefix}?`)
    ) {
      return normalizedPath;
    }
    if (
      normalizedPath === rolePrefix ||
      normalizedPath.startsWith(`${rolePrefix}/`) ||
      normalizedPath.startsWith(`${rolePrefix}?`)
    ) {
      return `${tenantPrefix}${normalizedPath}`;
    }
    return `${tenantPrefix}${rolePrefix}${normalizedPath}`;
  }

  if (
    normalizedPath === rolePrefix ||
    normalizedPath.startsWith(`${rolePrefix}/`) ||
    normalizedPath.startsWith(`${rolePrefix}?`)
  ) {
    return normalizedPath;
  }
  return `${rolePrefix}${normalizedPath}`;
};

/**
 * Generates an array of academic years in YYYY-YY format (e.g. 2026-27).
 * It will generate a range of years around the current year (+/- 10 years by default)
 * and merge them with any years fetched from academic calendars in the database.
 */
export const getAcademicYearOptions = (dbYears: string[] = [], windowRange = 10): string[] => {
  const currentYear = new Date().getFullYear();
  const generatedYears: string[] = [];

  for (let i = -windowRange; i <= windowRange; i++) {
    const y = currentYear + i;
    generatedYears.push(`${y}-${(y + 1).toString().slice(-2)}`);
  }

  return Array.from(new Set([...dbYears, ...generatedYears]))
    .sort()
    .reverse();
};

/**
 * Gets the current academic year in YYYY-YY format (e.g. 2026-27).
 */
export const getCurrentAcademicYear = (): string => {
  const now = new Date();
  const start = now.getMonth() >= 6 ? now.getFullYear() : now.getFullYear() - 1;
  return `${start}-${(start + 1).toString().slice(-2)}`;
};

/**
 * Appends " (Current)" to the academic year string if it matches the current year.
 */
export const formatAcademicYearLabel = (ay: string): string => {
  if (ay === getCurrentAcademicYear()) {
    return `${ay} (Current)`;
  }
  return ay;
};
