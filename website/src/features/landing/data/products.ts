/**
 * @file products.ts
 * @description Public Devvelocity product portfolio used by corporate marketing pages.
 * @module features/landing/data
 */

import { Blocks, GraduationCap, Package, type LucideIcon, Workflow } from 'lucide-react';

const PRODUCT_ICONS: Readonly<Record<string, LucideIcon>> = {
  Blocks,
  GraduationCap,
  Workflow,
};

export const productIcon = (name: string): LucideIcon => PRODUCT_ICONS[name] ?? Package;
