import SuperAdminLayout from '@/features/super-admin/layouts/SuperAdminLayout';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return <SuperAdminLayout>{children}</SuperAdminLayout>;
}
