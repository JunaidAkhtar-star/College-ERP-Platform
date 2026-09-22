/**
 * @file page.tsx
 * @description Root entry page for a specific tenant subdomain.
 *              Redirects to the login screen of the tenant.
 * @module app/[tenant]
 */

import { redirect } from 'next/navigation';

export default function TenantRootPage() {
  redirect('/auth/signin');
}
