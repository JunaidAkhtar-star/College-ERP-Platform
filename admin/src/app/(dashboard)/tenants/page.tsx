'use client';

import { useEffect, useRef, useState } from 'react';
import Swal from 'sweetalert2';
import { toast } from 'react-toastify';
import useMutation from '@/shared/hooks/useMutation';
import useSwr from '@/shared/hooks/useSwr';
import { useAdminPageContext } from '@/features/super-admin/context/AdminPageContext';
import TenantsTab from '@/features/super-admin/components/TenantsTab';
import ProvisionTenantModal from '@/features/super-admin/components/ProvisionTenantModal';
import TenantSubscriptionModal from '@/features/super-admin/components/TenantSubscriptionModal';
import TenantDetailsDrawer, {
  type ITenantEditValues,
} from '@/features/super-admin/components/TenantDetailsDrawer';
import type {
  ISubscriptionPlan,
  ITenant,
  ITenantUsage,
  IProductAddon,
} from '@/features/super-admin/types/super-admin.types';

export default function TenantsPage() {
  const { searchQuery } = useAdminPageContext();
  const tenantsQuery = useSwr<{ data?: ITenant[] }>('super-admin/tenants', {
    refreshInterval: 300_000,
  });
  const usageQuery = useSwr<{ data?: ITenantUsage[] }>('super-admin/tenant-usage');
  const plansQuery = useSwr<{ data?: ISubscriptionPlan[] }>('super-admin/plans');
  const addonsQuery = useSwr<{ data?: IProductAddon[] }>('super-admin/addons');
  const { mutation, isLoading } = useMutation();
  const [showProvision, setShowProvision] = useState(false);
  const [subscriptionTenant, setSubscriptionTenant] = useState<ITenant | null>(null);
  const [detailTenant, setDetailTenant] = useState<ITenant | null>(null);
  const [editingTenant, setEditingTenant] = useState(false);
  const [statusChangingTenantId, setStatusChangingTenantId] = useState<string>();
  const [removingTenantId, setRemovingTenantId] = useState<string>();
  const [retryingTenantId, setRetryingTenantId] = useState<string>();
  const [isSavingTenant, setIsSavingTenant] = useState(false);
  const registrationRequestId = useRef('');
  const tenants = tenantsQuery.data?.data ?? [];
  const plans = plansQuery.data?.data ?? [];
  const hasProvisioningTenant = tenantsQuery.data?.data?.some(
    (tenant) => tenant.status === 'provisioning',
  );
  const refreshTenants = tenantsQuery.mutate;

  useEffect(() => {
    if (!hasProvisioningTenant) return;
    const timer = window.setInterval(() => {
      void refreshTenants();
    }, 30_000);
    return () => window.clearInterval(timer);
  }, [hasProvisioningTenant, refreshTenants]);

  const toggleStatus = async (tenant: ITenant) => {
    if (statusChangingTenantId) return;
    const status = tenant.status === 'active' ? 'suspended' : 'active';
    if (status === 'suspended') {
      const confirmation = await Swal.fire({
        title: `Suspend ${tenant.name}?`,
        text: 'Users will immediately lose access to this tenant workspace.',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'Suspend tenant',
        confirmButtonColor: '#0178D7',
      });
      if (!confirmation.isConfirmed) return;
    }
    setStatusChangingTenantId(tenant._id);
    try {
      const response = await mutation(`super-admin/tenants/${tenant._id}`, {
        method: 'PATCH',
        body: { status },
      });
      if (response?.results?.success) {
        toast.success(`Tenant ${tenant.name} status updated to ${status}.`);
        if (detailTenant?._id === tenant._id) setDetailTenant(response.results.data as ITenant);
        await tenantsQuery.mutate();
      }
    } finally {
      setStatusChangingTenantId(undefined);
    }
  };

  const removeTenant = async (tenant: ITenant) => {
    if (tenant.status !== 'suspended' || removingTenantId) return;

    const confirmation = await Swal.fire({
      title: `Permanently remove ${tenant.name}?`,
      html: `This will permanently delete the tenant database <strong>${tenant.databaseName}</strong>, billing history and tenant record. This action cannot be undone.`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Yes, remove permanently',
      cancelButtonText: 'Keep tenant',
      confirmButtonColor: '#dc2626',
      reverseButtons: true,
      focusCancel: true,
    });
    if (!confirmation.isConfirmed) return;

    setRemovingTenantId(tenant._id);
    try {
      const response = await mutation(`super-admin/tenants/${tenant._id}`, {
        method: 'DELETE',
        dedupe: false,
      });
      if (response?.results?.success) {
        toast.success(`${tenant.name} was permanently removed.`);
        if (detailTenant?._id === tenant._id) {
          setDetailTenant(null);
          setEditingTenant(false);
        }
        await Promise.all([tenantsQuery.mutate(), usageQuery.mutate()]);
      }
    } finally {
      setRemovingTenantId(undefined);
    }
  };

  const retryProvisioning = async (tenant: ITenant) => {
    if (retryingTenantId) return;
    const confirmation = await Swal.fire({
      title: `Retry ${tenant.name} provisioning?`,
      text: 'This is allowed only after payment or free-tier approval and will restart isolated database setup.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Retry provisioning',
      confirmButtonColor: '#d97706',
    });
    if (!confirmation.isConfirmed) return;
    setRetryingTenantId(tenant._id);
    try {
      const response = await mutation(`super-admin/tenants/${tenant._id}/retry-provisioning`, {
        method: 'POST',
        body: {},
        dedupe: false,
      });
      if (response?.results?.success) {
        toast.success('Tenant database provisioning retry started.');
        await Promise.all([tenantsQuery.mutate(), usageQuery.mutate()]);
      }
    } finally {
      setRetryingTenantId(undefined);
    }
  };

  const updateTenantDetails = async (tenant: ITenant, values: ITenantEditValues) => {
    setIsSavingTenant(true);
    try {
      const response = await mutation(`super-admin/tenants/${tenant._id}`, {
        method: 'PATCH',
        body: values,
      });
      if (response?.results?.success) {
        const updated = response.results.data as ITenant;
        toast.success(`${updated.name} details updated.`);
        setDetailTenant(updated);
        setEditingTenant(false);
        await Promise.all([tenantsQuery.mutate(), usageQuery.mutate()]);
      }
    } finally {
      setIsSavingTenant(false);
    }
  };

  const createTenant = async (values: {
    tenantId: string;
    name: string;
    adminEmail: string;
    planId: string;
    addonSlugs: string[];
  }) => {
    if (!registrationRequestId.current) registrationRequestId.current = crypto.randomUUID();
    const response = await mutation('super-admin/public-checkout/register', {
      method: 'POST',
      body: {
        requestId: registrationRequestId.current,
        tenantId: values.tenantId,
        institutionName: values.name,
        adminEmail: values.adminEmail,
        planId: values.planId,
        addonSlugs: values.addonSlugs,
      },
    });
    if (response?.results?.success) {
      registrationRequestId.current = '';
      toast.success(
        'Registration created. The tenant remains pending until payment and approval are complete.',
      );
      setShowProvision(false);
      await tenantsQuery.mutate();
    }
  };

  const updateSubscription = async (
    tenant: ITenant,
    values: { planId: string; subscriptionExpiresAt: string },
  ) => {
    const response = await mutation(`super-admin/tenants/${tenant._id}`, {
      method: 'PATCH',
      body: values,
    });
    if (response?.results?.success) {
      toast.success(`${tenant.name} subscription updated.`);
      setSubscriptionTenant(null);
      await Promise.all([tenantsQuery.mutate(), usageQuery.mutate()]);
    }
  };

  return (
    <>
      <TenantsTab
        tenants={tenants}
        searchQuery={searchQuery}
        isLoading={tenantsQuery.isLoading}
        isValidating={tenantsQuery.isValidating || usageQuery.isValidating}
        onRefresh={async () => {
          await Promise.all([tenantsQuery.mutate(), usageQuery.mutate()]);
        }}
        usage={usageQuery.data?.data ?? []}
        onManageSubscription={setSubscriptionTenant}
        onViewTenant={(tenant) => {
          setDetailTenant(tenant);
          setEditingTenant(false);
        }}
        statusChangingTenantId={statusChangingTenantId}
        removingTenantId={removingTenantId}
        retryingTenantId={retryingTenantId}
        onRetryProvisioning={retryProvisioning}
        onToggleStatus={toggleStatus}
        onRemoveTenant={removeTenant}
        onOpenProvision={() => setShowProvision(true)}
      />
      <ProvisionTenantModal
        isOpen={showProvision}
        onClose={() => setShowProvision(false)}
        onConfirm={createTenant}
        muting={isLoading}
        plans={plans}
        addons={addonsQuery.data?.data ?? []}
      />
      <TenantSubscriptionModal
        tenant={subscriptionTenant}
        plans={plans}
        isLoading={isLoading}
        onClose={() => setSubscriptionTenant(null)}
        onConfirm={updateSubscription}
      />
      <TenantDetailsDrawer
        tenant={detailTenant}
        usage={usageQuery.data?.data?.find((item) => item.tenantId === detailTenant?._id)}
        plans={plans}
        editing={editingTenant}
        isSaving={isSavingTenant}
        onClose={() => {
          setDetailTenant(null);
          setEditingTenant(false);
        }}
        onEdit={() => setEditingTenant(true)}
        onCancelEdit={() => setEditingTenant(false)}
        onSave={updateTenantDetails}
        onManageSubscription={setSubscriptionTenant}
      />
    </>
  );
}
