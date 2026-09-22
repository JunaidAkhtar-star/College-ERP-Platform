/**
 * @file StorePage.tsx
 * @description Inventory items + requisition workflow.
 */
'use client';

import React, { FormEvent, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Archive,
  ArrowDownToLine,
  ArrowUpFromLine,
  Boxes,
  ClipboardList,
  History,
  IndianRupee,
  Package,
  Plus,
  ShieldCheck,
  ShoppingCart,
  SlidersHorizontal,
  X,
} from 'lucide-react';
import { motion } from '@/shared/utils/motion';
import { toast } from 'react-toastify';
import Swal from 'sweetalert2';
import CustomTable, { Column, Action } from '@/shared/core/CustomTable';
import CrudButton from '@/shared/core/CrudButton';

import useSwr from '@/shared/hooks/useSwr';
import useMutation from '@/shared/hooks/useMutation';
import { useHasAnyPermission } from '@/shared/hooks/useHasPermission';
import { useAuthStore } from '@/shared/store/authStore';

interface IStoreItem {
  _id: string;
  sku: string;
  name: string;
  category: string;
  unit: string;
  currentStock: number;
  minStock: number;
  unitCost?: number;
  vendor?: string;
  isActive: boolean;
  [key: string]: unknown;
}

interface IStoreRequest {
  _id: string;
  requestNumber: string;
  itemName: string;
  quantity: number;
  requestedByName: string;
  requestedBy: string;
  approvedBy?: string;
  status: 'pending' | 'approved' | 'rejected' | 'issued';
  createdAt: string;
  [key: string]: unknown;
}
interface IStockMovement {
  _id: string;
  itemId: { _id: string; sku: string; name: string; unit: string };
  delta: number;
  balanceAfter: number;
  reason: string;
  sourceType?: string;
  movementValue?: number;
  createdAt: string;
  [key: string]: unknown;
}
interface IReorderRow {
  _id: string;
  sku: string;
  name: string;
  unit: string;
  currentStock: number;
  minStock: number;
  suggestedQuantity: number;
  estimatedValue: number;
  leadTimeDays: number;
  [key: string]: unknown;
}

interface IReconciliation {
  balanced: boolean;
  checked: number;
  checkedAt: string;
  exceptions: Array<{
    _id: string;
    sku: string;
    name: string;
    currentStock: number;
    movementBalance: number;
    variance: number;
  }>;
}

interface IMovementPoint {
  label: string;
  received: number;
  issued: number;
}

type TStoreTab = 'items' | 'requests' | 'movements' | 'reorder';

const STORE_TABS: Array<{
  value: TStoreTab;
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
}> = [
  {
    value: 'items',
    label: 'Item catalogue',
    description: 'Stock, valuation and storage details',
    icon: Boxes,
  },
  {
    value: 'requests',
    label: 'Stock requests',
    description: 'Review, approve and issue indents',
    icon: ClipboardList,
  },
  {
    value: 'movements',
    label: 'Movement ledger',
    description: 'Trace every receipt and stock issue',
    icon: History,
  },
  {
    value: 'reorder',
    label: 'Reorder plan',
    description: 'Prioritise replenishment requirements',
    icon: ShoppingCart,
  },
];

const STATUS_CLS: Record<string, string> = {
  pending: 'bg-amber-100 text-amber-700',
  approved: 'bg-blue-100 text-blue-700',
  issued: 'bg-emerald-100 text-emerald-700',
  rejected: 'bg-red-100 text-red-700',
};

export default function StorePage() {
  const [tab, setTab] = useState<TStoreTab>('items');
  const [dialog, setDialog] = useState<'item' | 'request' | 'stock' | null>(null);
  const [selected, setSelected] = useState<IStoreItem | null>(null);
  const userId = useAuthStore((state) => state.user?._id ?? '');
  const canManage = useHasAnyPermission([
    ['store', 'create'],
    ['store', 'edit'],
    ['store', 'approve'],
  ]);
  const { mutation, isLoading: acting } = useMutation();

  const {
    data: itemsRaw,
    error: itemsError,
    isLoading: itemsLoading,
    isValidating: itemsValidating,
    mutate: refetchItems,
  } = useSwr('store/items');
  const {
    data: reqsRaw,
    error: reqsError,
    isLoading: reqsLoading,
    isValidating: reqsValidating,
    mutate: refetchReqs,
  } = useSwr('store/requests');
  const { data: vendorsRaw, error: vendorsError } = useSwr(
    canManage ? 'procurement/vendors' : null,
  );
  const {
    data: movementsRaw,
    isLoading: movementsLoading,
    isValidating: movementsValidating,
    mutate: refetchMovements,
    error: movementsError,
  } = useSwr(canManage ? 'store/movements?limit=500' : null);
  const {
    data: reorderRaw,
    error: reorderError,
    isLoading: reorderLoading,
    isValidating: reorderValidating,
    mutate: refetchReorder,
  } = useSwr(canManage ? 'store/reorder-plan' : null);
  const { data: reconciliationRaw, error: reconciliationError } = useSwr(
    canManage ? 'store/reconciliation' : null,
  );
  const items = useMemo(
    () => (itemsRaw as { data?: IStoreItem[] } | undefined)?.data ?? [],
    [itemsRaw],
  );
  const requests = useMemo(
    () => (reqsRaw as { data?: IStoreRequest[] } | undefined)?.data ?? [],
    [reqsRaw],
  );
  const movements = useMemo(
    () => (movementsRaw as { data?: IStockMovement[] } | undefined)?.data ?? [],
    [movementsRaw],
  );
  const reorderRows: IReorderRow[] = (reorderRaw as { data?: IReorderRow[] })?.data ?? [];
  const reconciliation = (reconciliationRaw as { data?: IReconciliation } | undefined)?.data;
  const vendors =
    (
      vendorsRaw as { data?: Array<{ _id: string; legalName: string; status: string }> } | undefined
    )?.data?.filter((vendor) => vendor.status === 'approved') ?? [];

  const analytics = useMemo(() => {
    const activeItems = items.filter((item) => item.isActive);
    const outOfStock = activeItems.filter((item) => item.currentStock === 0).length;
    const lowStock = activeItems.filter(
      (item) => item.currentStock > 0 && item.currentStock <= item.minStock,
    ).length;
    const healthy = Math.max(0, activeItems.length - lowStock - outOfStock);
    const inventoryValue = activeItems.reduce(
      (total, item) => total + item.currentStock * (item.unitCost ?? 0),
      0,
    );
    const pendingRequests = requests.filter((request) => request.status === 'pending').length;
    const approvedRequests = requests.filter((request) => request.status === 'approved').length;
    const receivedQuantity = movements.reduce(
      (total, movement) => total + (movement.delta > 0 ? movement.delta : 0),
      0,
    );
    const issuedQuantity = movements.reduce(
      (total, movement) => total + (movement.delta < 0 ? Math.abs(movement.delta) : 0),
      0,
    );
    const pointsByDate = new Map<string, IMovementPoint>();
    [...movements].reverse().forEach((movement) => {
      const date = new Date(movement.createdAt);
      const key = date.toISOString().slice(0, 10);
      const point = pointsByDate.get(key) ?? {
        label: date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }),
        received: 0,
        issued: 0,
      };
      if (movement.delta > 0) point.received += movement.delta;
      if (movement.delta < 0) point.issued += Math.abs(movement.delta);
      pointsByDate.set(key, point);
    });

    return {
      activeItems: activeItems.length,
      approvedRequests,
      healthy,
      inventoryValue,
      issuedQuantity,
      lowStock,
      outOfStock,
      pendingRequests,
      receivedQuantity,
      movementPoints: Array.from(pointsByDate.values()).slice(-8),
    };
  }, [items, movements, requests]);

  const handleDeleteItem = async (row: IStoreItem) => {
    const ok = await Swal.fire({
      title: 'Deactivate item?',
      text: `${row.sku} · ${row.name}`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Deactivate',
      confirmButtonColor: '#dc2626',
    });
    if (!ok.isConfirmed) return;
    const res = await mutation(`store/items/${row._id}`, { method: 'DELETE' });
    if ((res as { results?: { success?: boolean } })?.results?.success) {
      toast.success('Item deactivated');
      refetchItems();
    }
  };

  const handleDecide = async (row: IStoreRequest, decision: 'approved' | 'rejected' | 'issued') => {
    let remarks: string | undefined;
    if (decision === 'rejected') {
      const answer = await Swal.fire({
        title: `Reject request ${row.requestNumber}?`,
        input: 'textarea',
        inputLabel: 'Reason',
        showCancelButton: true,
        inputValidator: (value) =>
          value.trim().length < 5 ? 'Enter at least 5 characters' : undefined,
      });
      if (!answer.isConfirmed) return;
      remarks = answer.value;
    }
    const res = await mutation(`store/requests/${row._id}/decide`, {
      method: 'PATCH',
      body: { decision, remarks },
    });
    if ((res as { results?: { success?: boolean } })?.results?.success) {
      toast.success(`Request ${decision}`);
      refetchReqs();
      refetchItems();
    }
  };

  const submit =
    (handler: (form: FormData) => Promise<void>) => async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      await handler(new FormData(event.currentTarget));
    };
  const perform = async (
    path: string,
    method: 'POST' | 'PATCH',
    body: unknown,
    message: string,
  ) => {
    const response = await mutation(path, { method, body });
    if (!response) return;
    toast.success(message);
    setDialog(null);
    setSelected(null);
    await Promise.all([refetchItems(), refetchReqs(), refetchMovements()]);
  };

  const itemColumns: Column<IStoreItem>[] = [
    { field: 'sku', title: 'SKU' },
    { field: 'name', title: 'Name' },
    {
      field: 'category',
      title: 'Category',
      render: (r) => (
        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs capitalize text-slate-700">
          {r.category.replace(/_/g, ' ')}
        </span>
      ),
    },
    {
      field: 'currentStock',
      title: 'Stock',
      render: (r) => (
        <span
          className={
            r.currentStock < r.minStock
              ? 'font-semibold text-red-600'
              : 'font-medium text-slate-800'
          }
        >
          {r.currentStock} {r.unit}
        </span>
      ),
    },
    {
      field: 'unitCost',
      title: 'Unit ₹',
      render: (r) => (r.unitCost ? r.unitCost.toLocaleString('en-IN') : '—'),
    },
    { field: 'vendor', title: 'Vendor', render: (r) => r.vendor ?? '—' },
  ];

  const itemActions: Action<IStoreItem>[] = [
    {
      tooltip: 'Controlled stock adjustment',
      icon: <SlidersHorizontal className="h-4 w-4 text-primary" />,
      onClick: (row) => {
        setSelected(row);
        setDialog('stock');
      },
      hidden: () => !canManage,
    },
    {
      tooltip: 'Deactivate item',
      icon: <Archive className="h-4 w-4 text-red-500" />,
      onClick: handleDeleteItem,
      hidden: (row) => !canManage || !row.isActive,
    },
  ];

  const reqColumns: Column<IStoreRequest>[] = [
    { field: 'requestNumber', title: 'Request #' },
    { field: 'itemName', title: 'Item' },
    { field: 'quantity', title: 'Qty' },
    { field: 'requestedByName', title: 'Requested by' },
    {
      field: 'createdAt',
      title: 'Date',
      render: (r) => new Date(r.createdAt).toLocaleDateString('en-IN'),
    },
    {
      field: 'status',
      title: 'Status',
      render: (r) => (
        <span
          className={`rounded-full px-2 py-0.5 text-xs font-medium capitalize ${STATUS_CLS[r.status] ?? 'bg-slate-100 text-slate-500'}`}
        >
          {r.status}
        </span>
      ),
    },
  ];

  const reqActions: Action<IStoreRequest>[] = [
    {
      tooltip: 'Approve',
      icon: <span className="text-xs font-semibold text-emerald-600">✓</span>,
      onClick: (r) => handleDecide(r, 'approved'),
      hidden: (r) => !canManage || r.status !== 'pending' || r.requestedBy === userId,
    },
    {
      tooltip: 'Reject',
      icon: <span className="text-xs font-semibold text-red-600">✗</span>,
      onClick: (r) => handleDecide(r, 'rejected'),
      hidden: (r) => !canManage || r.status !== 'pending' || r.requestedBy === userId,
    },
    {
      tooltip: 'Mark issued',
      icon: <span className="text-xs font-semibold text-primary">↗</span>,
      onClick: (r) => handleDecide(r, 'issued'),
      hidden: (r) =>
        !canManage ||
        r.status !== 'approved' ||
        r.requestedBy === userId ||
        r.approvedBy === userId,
    },
  ];
  const movementColumns: Column<IStockMovement>[] = [
    {
      field: 'itemId',
      title: 'Item',
      render: (r) => (
        <div>
          <p className="font-semibold">{r.itemId?.name}</p>
          <p className="font-mono text-xs text-slate-500">{r.itemId?.sku}</p>
        </div>
      ),
    },
    {
      field: 'delta',
      title: 'Movement',
      render: (r) => (
        <span
          className={
            r.delta >= 0 ? 'font-semibold text-emerald-600' : 'font-semibold text-rose-600'
          }
        >
          {r.delta >= 0 ? '+' : ''}
          {r.delta} {r.itemId?.unit}
        </span>
      ),
    },
    { field: 'balanceAfter', title: 'Balance after' },
    { field: 'sourceType', title: 'Source', render: (r) => r.sourceType ?? 'Legacy workflow' },
    { field: 'reason', title: 'Evidence' },
    {
      field: 'createdAt',
      title: 'Posted',
      render: (r) => new Date(r.createdAt).toLocaleString('en-IN'),
    },
  ];
  const reorderColumns: Column<IReorderRow>[] = [
    { field: 'sku', title: 'SKU' },
    { field: 'name', title: 'Item' },
    {
      field: 'currentStock',
      title: 'Position',
      render: (r) => `${r.currentStock} on hand · ${r.minStock} minimum`,
    },
    {
      field: 'suggestedQuantity',
      title: 'Suggested order',
      render: (r) => `${r.suggestedQuantity} ${r.unit}`,
    },
    {
      field: 'estimatedValue',
      title: 'Estimated value',
      render: (r) => `₹${r.estimatedValue.toLocaleString('en-IN')}`,
    },
    { field: 'leadTimeDays', title: 'Lead time', render: (r) => `${r.leadTimeDays} days` },
  ];

  return (
    <div className="">
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-wrap items-center justify-end gap-3"
      >
        {tab === 'items' && canManage ? (
          <CrudButton
            module={'store'}
            action={'create'}
            startIcon={<Plus className="h-4 w-4" />}
            onClick={() => setDialog('item')}
          >
            New Item
          </CrudButton>
        ) : tab === 'requests' ? (
          <CrudButton
            module={'store'}
            action={'create'}
            startIcon={<Plus className="h-4 w-4" />}
            onClick={() => setDialog('request')}
          >
            Raise Request
          </CrudButton>
        ) : null}
      </motion.div>

      {(itemsError ||
        reqsError ||
        vendorsError ||
        movementsError ||
        reorderError ||
        reconciliationError) && (
        <div role="alert" className="rounded-xl bg-rose-50 p-4 text-sm text-rose-700">
          Some store data could not be loaded. Refresh and try again; no placeholder inventory is
          shown.
        </div>
      )}

      <section aria-label="Store operational overview" className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <StoreMetric
            label="Active catalogue"
            value={analytics.activeItems.toLocaleString('en-IN')}
            detail={`${analytics.healthy} items above reorder level`}
            icon={<Boxes className="h-5 w-5" />}
            tone="violet"
          />
          <StoreMetric
            label="Inventory value"
            value={formatRupees(analytics.inventoryValue)}
            detail="Current quantity × latest unit cost"
            icon={<IndianRupee className="h-5 w-5" />}
            tone="emerald"
          />
          <StoreMetric
            label="Reorder attention"
            value={(analytics.lowStock + analytics.outOfStock).toLocaleString('en-IN')}
            detail={`${analytics.outOfStock} out of stock · ${analytics.lowStock} running low`}
            icon={<AlertTriangle className="h-5 w-5" />}
            tone="amber"
          />
          <StoreMetric
            label="Open request queue"
            value={(analytics.pendingRequests + analytics.approvedRequests).toLocaleString('en-IN')}
            detail={`${analytics.pendingRequests} awaiting decision · ${analytics.approvedRequests} to issue`}
            icon={<Package className="h-5 w-5" />}
            tone="blue"
          />
        </div>

        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.7fr)_minmax(280px,1fr)]">
          <MovementChart
            points={analytics.movementPoints}
            received={analytics.receivedQuantity}
            issued={analytics.issuedQuantity}
          />
          <StockHealth
            healthy={analytics.healthy}
            low={analytics.lowStock}
            out={analytics.outOfStock}
            reconciliation={reconciliation}
          />
        </div>
      </section>

      <div
        className="flex w-fit max-w-full gap-2 overflow-x-auto rounded-2xl border border-slate-200 bg-white p-2"
        role="tablist"
        aria-label="Store workspace sections"
      >
        {STORE_TABS.filter((item) => canManage || ['items', 'requests'].includes(item.value)).map(
          (item) => {
            const Icon = item.icon;
            const selectedTab = tab === item.value;
            return (
              <button
                key={item.value}
                type="button"
                role="tab"
                aria-selected={selectedTab}
                aria-controls={`store-${item.value}-panel`}
                onClick={() => setTab(item.value)}
                className={`flex shrink-0 cursor-pointer items-center gap-3 rounded-xl px-3.5 py-3 text-left transition-colors ${
                  selectedTab ? 'bg-primary text-white' : 'text-slate-500 hover:bg-slate-100'
                }`}
              >
                <span
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                    selectedTab ? 'bg-white/15' : 'bg-slate-100'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                </span>
                <span>
                  <span className="block text-xs font-bold">{item.label}</span>
                  <span
                    className={`mt-0.5 block text-[10px] ${
                      selectedTab ? 'text-white/75' : 'text-slate-400'
                    }`}
                  >
                    {item.description}
                  </span>
                </span>
              </button>
            );
          },
        )}
      </div>

      <div id={`store-${tab}-panel`} role="tabpanel" className="rounded-2xl bg-white">
        {tab === 'items' ? (
          <CustomTable
            key="store-items-table"
            title="Inventory item catalogue"
            description="Review active stock balances, reorder thresholds, unit valuation and preferred suppliers."
            data={items}
            columns={itemColumns}
            actions={itemActions}
            isLoading={itemsLoading}
            isValidating={itemsValidating}
            onRefresh={() => void refetchItems()}
            options={{ search: true, refresh: true, export: true, pagination: true, pageSize: 10 }}
            localization={{ toolbar: { searchPlaceholder: 'Search SKU, item or category…' } }}
          />
        ) : tab === 'requests' ? (
          <CustomTable
            key="store-requests-table"
            title="Department stock requests"
            description="Track requisitions from request through independent approval and final stock issue."
            data={requests}
            columns={reqColumns}
            actions={reqActions}
            isLoading={reqsLoading}
            isValidating={reqsValidating}
            onRefresh={() => void refetchReqs()}
            options={{ search: true, refresh: true, export: true, pagination: true, pageSize: 10 }}
            localization={{ toolbar: { searchPlaceholder: 'Search request, item or requester…' } }}
          />
        ) : tab === 'movements' ? (
          <CustomTable
            key="store-movements-table"
            title="Stock movement ledger"
            description="Audit receipts, issues and controlled adjustments with their resulting item balances."
            data={movements}
            columns={movementColumns}
            isLoading={movementsLoading}
            isValidating={movementsValidating}
            onRefresh={() => void refetchMovements()}
            options={{ search: true, refresh: true, export: true, pagination: true, pageSize: 10 }}
            localization={{ toolbar: { searchPlaceholder: 'Search item, source or evidence…' } }}
          />
        ) : (
          <CustomTable
            key="store-reorder-table"
            title="Inventory replenishment plan"
            description="Prioritise items at or below their reorder level using suggested quantities, cost and lead time."
            data={reorderRows}
            columns={reorderColumns}
            isLoading={reorderLoading}
            isValidating={reorderValidating}
            onRefresh={() => void refetchReorder()}
            options={{ search: true, refresh: true, export: true, pagination: true, pageSize: 10 }}
            localization={{ toolbar: { searchPlaceholder: 'Search SKU or replenishment item…' } }}
          />
        )}
      </div>

      {dialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <button
            aria-label="Close dialog"
            className="absolute inset-0 bg-slate-200/80 backdrop-blur-sm"
            onClick={() => setDialog(null)}
          />
          <div
            role="dialog"
            aria-modal="true"
            className="relative w-full max-w-xl rounded-2xl bg-white p-6"
          >
            <div className="mb-5 flex items-start justify-between">
              <div>
                <h2 className="text-xl font-bold text-slate-900">
                  {dialog === 'item'
                    ? 'Create inventory item'
                    : dialog === 'request'
                      ? 'Raise stock request'
                      : `Adjust ${selected?.sku}`}
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  {dialog === 'stock'
                    ? 'Every adjustment requires a reason and creates an immutable movement.'
                    : 'Complete the authoritative inventory details.'}
                </p>
              </div>
              <button
                aria-label="Close"
                className="rounded-lg p-2 text-slate-600 hover:bg-slate-100"
                onClick={() => setDialog(null)}
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            {dialog === 'item' && (
              <form
                className="grid gap-4 sm:grid-cols-2"
                onSubmit={submit(async (form) => {
                  await perform(
                    'store/items',
                    'POST',
                    {
                      sku: String(form.get('sku') ?? ''),
                      name: String(form.get('name') ?? ''),
                      category: String(form.get('category') ?? ''),
                      unit: String(form.get('unit') ?? ''),
                      currentStock: Number(form.get('currentStock')),
                      minStock: Number(form.get('minStock')),
                      unitCost: Number(form.get('unitCost')),
                      vendor: String(form.get('vendor') ?? '') || undefined,
                      location: String(form.get('location') ?? '') || undefined,
                    },
                    'Inventory item created',
                  );
                })}
              >
                <StoreField name="sku" label="SKU" required />
                <StoreField name="name" label="Item name" required />
                <label>
                  <span className={labelClass}>Category</span>
                  <select name="category" className={inputClass} required>
                    {[
                      'stationery',
                      'electronics',
                      'lab_equipment',
                      'furniture',
                      'maintenance',
                      'cleaning',
                      'other',
                    ].map((value) => (
                      <option key={value} value={value}>
                        {value.replace('_', ' ')}
                      </option>
                    ))}
                  </select>
                </label>
                <StoreField name="unit" label="Unit" defaultValue="pcs" required />
                <StoreField
                  name="currentStock"
                  label="Opening stock"
                  type="number"
                  min="0"
                  required
                />
                <StoreField name="minStock" label="Reorder level" type="number" min="0" required />
                <StoreField
                  name="unitCost"
                  label="Unit cost (₹)"
                  type="number"
                  min="0"
                  step="0.01"
                  required
                />
                <label>
                  <span className={labelClass}>Approved vendor</span>
                  <select name="vendor" className={inputClass}>
                    <option value="">No preferred vendor</option>
                    {vendors.map((vendor) => (
                      <option key={vendor._id} value={vendor.legalName}>
                        {vendor.legalName}
                      </option>
                    ))}
                  </select>
                </label>
                <div className="sm:col-span-2">
                  <StoreField name="location" label="Shelf / room location" />
                </div>
                <StoreActions loading={acting} close={() => setDialog(null)} label="Create item" />
              </form>
            )}
            {dialog === 'request' && (
              <form
                className="space-y-4"
                onSubmit={submit(async (form) => {
                  await perform(
                    'store/requests',
                    'POST',
                    {
                      itemId: String(form.get('itemId') ?? ''),
                      quantity: Number(form.get('quantity')),
                      purpose: String(form.get('purpose') ?? ''),
                    },
                    'Stock request raised',
                  );
                })}
              >
                <label>
                  <span className={labelClass}>Active item</span>
                  <select name="itemId" className={inputClass} required>
                    <option value="">Select an item</option>
                    {items
                      .filter((item) => item.isActive)
                      .map((item) => (
                        <option key={item._id} value={item._id}>
                          {item.sku} · {item.name} · {item.currentStock} {item.unit} available
                        </option>
                      ))}
                  </select>
                </label>
                <StoreField name="quantity" label="Quantity" type="number" min="1" required />
                <StoreField name="purpose" label="Business purpose" required minLength={5} />
                <StoreActions
                  loading={acting}
                  close={() => setDialog(null)}
                  label="Raise request"
                />
              </form>
            )}
            {dialog === 'stock' && selected && (
              <form
                className="space-y-4"
                onSubmit={submit(async (form) => {
                  await perform(
                    `store/items/${selected._id}/stock`,
                    'PATCH',
                    {
                      delta: Number(form.get('delta')),
                      note: String(form.get('note') ?? ''),
                    },
                    'Stock adjustment posted',
                  );
                })}
              >
                <div className="rounded-xl bg-slate-50 p-4 text-sm">
                  Current balance:{' '}
                  <strong>
                    {selected.currentStock} {selected.unit}
                  </strong>
                </div>
                <StoreField
                  name="delta"
                  label="Quantity change (+ receipt, − issue)"
                  type="number"
                  required
                />
                <StoreField
                  name="note"
                  label="Adjustment evidence / reason"
                  required
                  minLength={5}
                />
                <StoreActions
                  loading={acting}
                  close={() => setDialog(null)}
                  label="Post adjustment"
                />
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

const inputClass =
  'w-full rounded-xl bg-slate-50 px-3 py-2.5 text-sm outline-none ring-1 ring-slate-200 focus:bg-white focus:ring-2 focus:ring-primary/30';
const labelClass = 'mb-1.5 block text-xs font-semibold text-slate-600';

function StoreField({
  label,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  return (
    <label className="block">
      <span className={labelClass}>{label}</span>
      <input className={inputClass} {...props} />
    </label>
  );
}

function StoreActions({
  loading,
  close,
  label,
}: {
  loading: boolean;
  close: () => void;
  label: string;
}) {
  return (
    <div className="flex justify-end gap-2 pt-2 sm:col-span-2">
      <CrudButton module="store" action="view" type="button" variant="tertiary" onClick={close}>
        Cancel
      </CrudButton>
      <CrudButton module="store" action="create" type="submit" loading={loading}>
        {label}
      </CrudButton>
    </div>
  );
}

const METRIC_TONES = {
  violet: 'bg-violet-50 text-violet-700',
  emerald: 'bg-emerald-50 text-emerald-700',
  amber: 'bg-amber-50 text-amber-700',
  blue: 'bg-blue-50 text-blue-700',
} as const;

function formatRupees(value: number) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(value);
}

function StoreMetric({
  label,
  value,
  detail,
  icon,
  tone,
}: {
  label: string;
  value: string;
  detail: string;
  icon: React.ReactNode;
  tone: keyof typeof METRIC_TONES;
}) {
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
          <p className="mt-2 truncate text-2xl font-bold tracking-tight text-slate-900">{value}</p>
        </div>
        <span
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${METRIC_TONES[tone]}`}
        >
          {icon}
        </span>
      </div>
      <p className="mt-3 text-xs leading-5 text-slate-500">{detail}</p>
    </article>
  );
}

function MovementChart({
  points,
  received,
  issued,
}: {
  points: IMovementPoint[];
  received: number;
  issued: number;
}) {
  const width = 720;
  const height = 180;
  const insetX = 24;
  const insetY = 18;
  const maxValue = Math.max(1, ...points.flatMap((point) => [point.received, point.issued]));
  const x = (index: number) =>
    points.length <= 1 ? width / 2 : insetX + (index / (points.length - 1)) * (width - insetX * 2);
  const y = (value: number) => height - insetY - (value / maxValue) * (height - insetY * 2);
  const pathFor = (key: 'received' | 'issued') =>
    points.map((point, index) => `${x(index)},${y(point[key])}`).join(' ');

  return (
    <article className="min-w-0 rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-bold text-slate-900">Stock movement pulse</h2>
          <p className="mt-1 text-xs text-slate-500">
            Most recent activity dates from the stock ledger
          </p>
        </div>
        <div className="flex flex-wrap gap-3 text-xs">
          <span className="flex items-center gap-1.5 font-semibold text-emerald-700">
            <ArrowDownToLine className="h-3.5 w-3.5" /> {received.toLocaleString('en-IN')} received
          </span>
          <span className="flex items-center gap-1.5 font-semibold text-orange-700">
            <ArrowUpFromLine className="h-3.5 w-3.5" /> {issued.toLocaleString('en-IN')} issued
          </span>
        </div>
      </div>
      {points.length ? (
        <div className="mt-5 min-w-0 overflow-hidden">
          <svg
            viewBox={`0 0 ${width} ${height}`}
            className="h-48 w-full"
            role="img"
            aria-label="Received and issued stock quantities by activity date"
          >
            {[0.25, 0.5, 0.75].map((ratio) => (
              <line
                key={ratio}
                x1={insetX}
                x2={width - insetX}
                y1={height * ratio}
                y2={height * ratio}
                stroke="#e2e8f0"
                strokeDasharray="4 6"
              />
            ))}
            <polyline
              points={pathFor('received')}
              fill="none"
              stroke="#10b981"
              strokeWidth="4"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="transition-opacity hover:opacity-80"
            />
            <polyline
              points={pathFor('issued')}
              fill="none"
              stroke="#f97316"
              strokeWidth="4"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="transition-opacity hover:opacity-80"
            />
            {points.map((point, index) => (
              <g key={`${point.label}-${index}`}>
                <circle cx={x(index)} cy={y(point.received)} r="4" fill="#10b981">
                  <title>{`${point.label}: ${point.received} received`}</title>
                </circle>
                <circle cx={x(index)} cy={y(point.issued)} r="4" fill="#f97316">
                  <title>{`${point.label}: ${point.issued} issued`}</title>
                </circle>
              </g>
            ))}
          </svg>
          <div className="grid grid-flow-col auto-cols-fr gap-1 text-center text-[10px] font-medium text-slate-500">
            {points.map((point, index) => (
              <span key={`${point.label}-axis-${index}`} className="truncate">
                {point.label}
              </span>
            ))}
          </div>
        </div>
      ) : (
        <div className="mt-5 flex h-48 items-center justify-center rounded-xl bg-slate-50 px-6 text-center text-sm text-slate-500">
          Movement trends will appear after the first stock receipt or issue.
        </div>
      )}
    </article>
  );
}

function StockHealth({
  healthy,
  low,
  out,
  reconciliation,
}: {
  healthy: number;
  low: number;
  out: number;
  reconciliation?: IReconciliation;
}) {
  const total = healthy + low + out;
  const healthPercent = total ? Math.round((healthy / total) * 100) : 0;
  const circumference = 2 * Math.PI * 48;

  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
      <div>
        <h2 className="text-sm font-bold text-slate-900">Inventory health</h2>
        <p className="mt-1 text-xs text-slate-500">
          Availability against configured reorder levels
        </p>
      </div>
      <div className="mt-5 grid grid-cols-[128px_minmax(0,1fr)] items-center gap-4">
        <div className="relative h-32 w-32">
          <svg viewBox="0 0 120 120" className="h-full w-full -rotate-90" aria-hidden="true">
            <circle cx="60" cy="60" r="48" fill="none" stroke="#f1f5f9" strokeWidth="12" />
            <circle
              cx="60"
              cy="60"
              r="48"
              fill="none"
              stroke="#10b981"
              strokeWidth="12"
              strokeLinecap="round"
              strokeDasharray={`${(healthPercent / 100) * circumference} ${circumference}`}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <strong className="text-2xl text-slate-900">{healthPercent}%</strong>
            <span className="text-[10px] font-medium text-slate-500">healthy</span>
          </div>
        </div>
        <div className="space-y-3 text-xs">
          {[
            ['Healthy', healthy, 'bg-emerald-500'],
            ['Low stock', low, 'bg-amber-500'],
            ['Out of stock', out, 'bg-rose-500'],
          ].map(([label, value, color]) => (
            <div key={String(label)} className="flex items-center gap-2">
              <span className={`h-2.5 w-2.5 rounded-full ${color}`} />
              <span className="min-w-0 flex-1 text-slate-600">{label}</span>
              <strong className="text-slate-900">{value}</strong>
            </div>
          ))}
        </div>
      </div>
      {reconciliation ? (
        <div
          className={`mt-5 flex items-start gap-3 rounded-xl p-3 ${reconciliation.balanced ? 'bg-emerald-50' : 'bg-rose-50'}`}
        >
          <ShieldCheck
            className={`mt-0.5 h-4 w-4 shrink-0 ${reconciliation.balanced ? 'text-emerald-700' : 'text-rose-700'}`}
          />
          <div className="min-w-0">
            <p className="text-xs font-bold text-slate-800">
              {reconciliation.balanced
                ? 'Ledger is reconciled'
                : `${reconciliation.exceptions.length} ledger exceptions`}
            </p>
            <p className="mt-0.5 text-[11px] leading-4 text-slate-600">
              {reconciliation.checked} item balances checked against immutable movements.
            </p>
          </div>
        </div>
      ) : null}
    </article>
  );
}
