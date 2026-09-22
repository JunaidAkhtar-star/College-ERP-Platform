/**
 * @file AppProvider.tsx
 * @description Root client provider that wraps the multi-tenant ERP application.
 *  Responsibilities:
 *  - Mounts react-toastify's ToastContainer (global notification system).
 *  - Acts as the single point where future global providers (themes, etc.) can
 *    be added without touching the root layout.
 * @module shared/provider
 */

'use client';

import React, { useEffect } from 'react';
import { LazyMotion, domMax } from 'framer-motion';
import { ToastContainer } from 'react-toastify';
import useSwr from '@/shared/hooks/useSwr';
import 'react-toastify/dist/ReactToastify.css';
import { getTenantId } from '@/shared/utils';

interface IAppProviderProps {
  children: React.ReactNode;
}

interface IInstitutionSetting {
  name?: string;
  faviconUrl?: string;
  seoTitle?: string;
  seoDescription?: string;
  seoImageUrl?: string;
  primaryColor?: string;
  secondaryColor?: string;
}

const AppProvider = ({ children }: IAppProviderProps) => {
  const tenantId = getTenantId();
  const { data: settingsRes } = useSwr<{ success: boolean; data: IInstitutionSetting }>(
    tenantId ? 'institution-setting/public' : null,
  );
  const settings = settingsRes?.data;

  useEffect(() => {
    if (settings) {
      const root = document.documentElement;
      if (settings.primaryColor) {
        root.style.setProperty('--primary-color', settings.primaryColor);
      }
      if (settings.secondaryColor) {
        root.style.setProperty('--secondary-color', settings.secondaryColor);
      }
      document.title = settings.seoTitle || settings.name || 'Institution ERP';
      const upsertMeta = (selector: string, attributes: Record<string, string>) => {
        let element = document.head.querySelector<HTMLMetaElement>(selector);
        if (!element) {
          element = document.createElement('meta');
          document.head.appendChild(element);
        }
        Object.entries(attributes).forEach(([key, value]) => element?.setAttribute(key, value));
      };
      const title = settings.seoTitle || settings.name || 'Institution ERP';
      if (settings.seoDescription) {
        upsertMeta('meta[name="description"]', {
          name: 'description',
          content: settings.seoDescription,
        });
        upsertMeta('meta[property="og:description"]', {
          property: 'og:description',
          content: settings.seoDescription,
        });
      }
      upsertMeta('meta[property="og:title"]', { property: 'og:title', content: title });
      if (settings.seoImageUrl) {
        upsertMeta('meta[property="og:image"]', {
          property: 'og:image',
          content: settings.seoImageUrl,
        });
      }
      if (settings.faviconUrl) {
        let favicon = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
        if (!favicon) {
          favicon = document.createElement('link');
          favicon.rel = 'icon';
          document.head.appendChild(favicon);
        }
        favicon.href = settings.faviconUrl;
      }
    }
  }, [settings]);

  return (
    <LazyMotion features={domMax} strict>
      {children}
      <ToastContainer
        position="top-right"
        autoClose={4000}
        hideProgressBar={false}
        newestOnTop
        closeOnClick
        pauseOnFocusLoss
        draggable
        pauseOnHover
        theme="light"
        toastClassName="!rounded-xl !text-sm !font-medium !"
      />
    </LazyMotion>
  );
};

export default AppProvider;
