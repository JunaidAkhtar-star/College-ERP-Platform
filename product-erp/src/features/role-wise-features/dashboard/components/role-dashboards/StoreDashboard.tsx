/**
 * @file StoreDashboard.tsx
 * @description Standalone collection-backed store dashboard matching the role reference.
 * @module features/dashboard/role-dashboards
 */
'use client';

import Link from 'next/link';
import {
  AlertTriangle,
  ArrowDownToLine,
  ArrowUpFromLine,
  Boxes,
  ClipboardList,
  IndianRupee,
  PackageCheck,
  RefreshCw,
  ShoppingCart,
  Truck,
} from 'lucide-react';
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import {
  type AnyRecord,
  Badge,
  fmt,
  fmtDate,
  fmtRupees,
  type IStatCard,
  PIE_COLORS,
  RowItem,
  Section,
  StatCard,
  useRolePath,
} from '../views/shared';

interface IStoreCategoryStat {
  category: string;
  itemCount: number;
  stockValue: number;
}

interface IStoreRequestRow {
  _id?: string;
  requestNumber: string;
  itemName: string;
  quantity: number;
  requestedByName: string;
  status: string;
}

interface IStoreItemRow {
  _id?: string;
  sku: string;
  name: string;
  category: string;
  unit: string;
  currentStock: number;
  minStock: number;
  reorderQuantity: number;
}

interface IGoodsReceiptRow {
  _id?: string;
  grnNumber: string;
  quantityReceived: number;
  quantityAccepted: number;
  status: string;
  receivedAt: string;
  purchaseOrderId?: { poNumber?: string; itemName?: string };
}

interface IPurchaseSummary {
  totalPurchases?: number;
  totalPurchaseOrders?: number;
  totalSuppliers?: number;
}

interface IMovementSummary {
  receivedQuantity?: number;
  issuedQuantity?: number;
  receivedValue?: number;
  issuedValue?: number;
}

/** Converts collection category keys into readable dashboard labels. */
function categoryLabel(value: string) {
  return value.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

/** Maps persisted workflow states to the shared status badge palette. */
function statusColor(status: string): 'green' | 'blue' | 'amber' | 'red' | 'slate' {
  if (['accepted', 'approved', 'issued', 'received'].includes(status)) return 'green';
  if (['partially_received', 'partially_rejected'].includes(status)) return 'blue';
  if (['pending', 'in_progress'].includes(status)) return 'amber';
  if (['rejected', 'returned', 'cancelled'].includes(status)) return 'red';
  return 'slate';
}

export default function StoreDashboard({ d }: { d: AnyRecord }) {
  const path = useRolePath();
  const totalItems = Number(d.totalItems ?? 0);
  const totalStockValue = Number(d.totalStockValue ?? 0);
  const categories = (d.categoryStats as IStoreCategoryStat[] | undefined) ?? [];
  const recentRequests = (d.recentRequests as IStoreRequestRow[] | undefined) ?? [];
  const recentGrns = (d.recentGrns as IGoodsReceiptRow[] | undefined) ?? [];
  const lowStockItems = (d.lowStockItems as IStoreItemRow[] | undefined) ?? [];
  const purchases = (d.purchaseSummary as IPurchaseSummary | undefined) ?? {};
  const movement = (d.movementSummary as IMovementSummary | undefined) ?? {};

  const cards: IStatCard[] = [
    {
      label: 'Total Items',
      value: fmt(totalItems),
      icon: <Boxes className="h-5 w-5" />,
      bg: 'bg-violet-50',
      fg: 'text-violet-600',
      href: path('store'),
    },
    {
      label: 'Total Stock Value',
      value: fmtRupees(totalStockValue),
      icon: <IndianRupee className="h-5 w-5" />,
      bg: 'bg-emerald-50',
      fg: 'text-emerald-600',
      href: path('store'),
    },
    {
      label: 'Items In Stock',
      value: fmt(d.itemsInStock),
      icon: <ShoppingCart className="h-5 w-5" />,
      bg: 'bg-blue-50',
      fg: 'text-blue-600',
      href: path('store'),
    },
    {
      label: 'Pending Indents',
      value: fmt(d.pendingRequests),
      icon: <ClipboardList className="h-5 w-5" />,
      bg: 'bg-orange-50',
      fg: 'text-orange-600',
      href: path('store'),
    },
    {
      label: 'Low Stock Items',
      value: fmt(d.lowStockCount),
      icon: <AlertTriangle className="h-5 w-5" />,
      bg: 'bg-rose-50',
      fg: 'text-rose-600',
      href: path('store'),
    },
    {
      label: 'Pending GRNs',
      value: fmt(d.pendingGrns),
      icon: <RefreshCw className="h-5 w-5" />,
      bg: 'bg-purple-50',
      fg: 'text-purple-600',
      href: path('procure-to-pay'),
    },
  ];

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6">
        {cards.map((card, index) => (
          <StatCard key={card.label} {...card} index={index} />
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <Section title="Stock Status" sub={`${fmt(totalItems)} catalogued items`}>
          <div className="grid min-h-64 gap-3 sm:grid-cols-[1fr_1.15fr] sm:items-center">
            <div className="relative h-52">
              <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                <PieChart>
                  <Pie
                    data={categories}
                    dataKey="itemCount"
                    nameKey="category"
                    innerRadius={58}
                    outerRadius={82}
                    paddingAngle={2}
                  >
                    {categories.map((category, index) => (
                      <Cell key={category.category} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => fmt(Number(value))} />
                </PieChart>
              </ResponsiveContainer>
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                <strong className="text-xl text-slate-900">{fmt(totalItems)}</strong>
                <span className="text-[11px] text-slate-500">Total Items</span>
              </div>
            </div>
            <div className="space-y-2">
              {categories.length ? (
                categories.slice(0, 6).map((category, index) => (
                  <div key={category.category} className="flex items-center gap-2 text-xs">
                    <svg className="h-2.5 w-2.5" viewBox="0 0 10 10" aria-hidden="true">
                      <circle cx="5" cy="5" r="5" fill={PIE_COLORS[index % PIE_COLORS.length]} />
                    </svg>
                    <span className="min-w-0 flex-1 truncate text-slate-600">
                      {categoryLabel(category.category)}
                    </span>
                    <span className="font-semibold text-slate-800">{category.itemCount}</span>
                  </div>
                ))
              ) : (
                <p className="text-xs text-slate-600">No active inventory categories.</p>
              )}
            </div>
          </div>
        </Section>

        <Section title="Top Item Categories" className="xl:col-span-2" href={path('store')}>
          <div className="space-y-2.5">
            {categories.length ? (
              categories.slice(0, 7).map((category) => {
                const share = totalStockValue ? (category.stockValue / totalStockValue) * 100 : 0;
                return (
                  <div
                    key={category.category}
                    className="grid grid-cols-[minmax(0,1fr)_auto] gap-3 rounded-xl bg-slate-50 px-3 py-2.5 sm:grid-cols-[minmax(0,1fr)_auto_64px]"
                  >
                    <div className="flex min-w-0 items-center gap-2.5">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white text-primary">
                        <Boxes className="h-4 w-4" />
                      </span>
                      <span className="truncate text-xs font-semibold text-slate-700">
                        {categoryLabel(category.category)}
                      </span>
                    </div>
                    <span className="self-center text-xs font-semibold text-slate-800">
                      {fmtRupees(category.stockValue)}
                    </span>
                    <span className="hidden self-center text-right text-xs font-bold text-slate-500 sm:block">
                      {share.toFixed(1)}%
                    </span>
                  </div>
                );
              })
            ) : (
              <p className="py-14 text-center text-xs text-slate-600">No inventory value data.</p>
            )}
          </div>
        </Section>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <Section title="Recent Indents" href={path('store')}>
          <div className="space-y-2">
            {recentRequests.length ? (
              recentRequests
                .slice(0, 5)
                .map((request) => (
                  <RowItem
                    key={request._id ?? request.requestNumber}
                    icon={<ClipboardList className="h-4 w-4" />}
                    primary={`${request.requestNumber} · ${request.itemName}`}
                    secondary={`${request.requestedByName} · ${request.quantity} requested`}
                    end={<Badge label={request.status} color={statusColor(request.status)} />}
                    href={path('store')}
                  />
                ))
            ) : (
              <p className="py-10 text-center text-xs text-slate-600">No requisitions found.</p>
            )}
          </div>
        </Section>

        <Section title="Recent GRNs" href={path('procure-to-pay')}>
          <div className="space-y-2">
            {recentGrns.length ? (
              recentGrns
                .slice(0, 5)
                .map((receipt) => (
                  <RowItem
                    key={receipt._id ?? receipt.grnNumber}
                    icon={<Truck className="h-4 w-4" />}
                    primary={`${receipt.grnNumber} · ${receipt.purchaseOrderId?.itemName ?? receipt.purchaseOrderId?.poNumber ?? 'Purchase order'}`}
                    secondary={`${receipt.quantityAccepted}/${receipt.quantityReceived} accepted · ${fmtDate(receipt.receivedAt)}`}
                    end={<Badge label={receipt.status} color={statusColor(receipt.status)} />}
                    href={path('procure-to-pay')}
                  />
                ))
            ) : (
              <p className="py-10 text-center text-xs text-slate-600">No goods receipts found.</p>
            )}
          </div>
        </Section>

        <Section title="Low Stock Items" href={path('store')}>
          <div className="space-y-2">
            {lowStockItems.length ? (
              lowStockItems
                .slice(0, 5)
                .map((item) => (
                  <RowItem
                    key={item._id ?? item.sku}
                    icon={<AlertTriangle className="h-4 w-4" />}
                    primary={item.name}
                    secondary={`${categoryLabel(item.category)} · reorder ${item.reorderQuantity} ${item.unit}`}
                    end={
                      <Badge
                        label={`${item.currentStock} / ${item.minStock} ${item.unit}`}
                        color="red"
                      />
                    }
                    href={path('store')}
                  />
                ))
            ) : (
              <p className="py-10 text-center text-xs text-slate-600">No low-stock items.</p>
            )}
          </div>
        </Section>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Section title="Purchase Summary" sub="This month" href={path('procure-to-pay')}>
          <div className="grid grid-cols-3 gap-3">
            {[
              ['Total Purchases', fmtRupees(purchases.totalPurchases)],
              ['Suppliers', fmt(purchases.totalSuppliers)],
              ['Purchase Orders', fmt(purchases.totalPurchaseOrders)],
            ].map(([label, value]) => (
              <div key={label} className="rounded-xl bg-slate-50 p-3">
                <p className="text-[10px] font-medium text-slate-500">{label}</p>
                <p className="mt-2 text-sm font-bold text-slate-900">{value}</p>
              </div>
            ))}
          </div>
        </Section>

        <Section title="Stock Movement" sub="This month" href={path('store')}>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex items-center gap-3 rounded-xl bg-emerald-50 p-4">
              <ArrowDownToLine className="h-7 w-7 text-emerald-600" />
              <div>
                <p className="text-[10px] font-medium text-emerald-700">Stock Received</p>
                <p className="mt-1 text-base font-bold text-slate-900">
                  {fmt(movement.receivedQuantity)}
                </p>
                <p className="text-[10px] text-slate-500">{fmtRupees(movement.receivedValue)}</p>
              </div>
            </div>
            <div className="flex items-center gap-3 rounded-xl bg-orange-50 p-4">
              <ArrowUpFromLine className="h-7 w-7 text-orange-600" />
              <div>
                <p className="text-[10px] font-medium text-orange-700">Stock Issued</p>
                <p className="mt-1 text-base font-bold text-slate-900">
                  {fmt(movement.issuedQuantity)}
                </p>
                <p className="text-[10px] text-slate-500">{fmtRupees(movement.issuedValue)}</p>
              </div>
            </div>
          </div>
        </Section>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: 'Create Indent', href: path('store'), icon: ClipboardList },
          { label: 'Receive Goods', href: path('procure-to-pay'), icon: PackageCheck },
          { label: 'View Items', href: path('store'), icon: Boxes },
          { label: 'Stock Report', href: path('store'), icon: RefreshCw },
        ].map(({ label, href, icon: Icon }) => (
          <Link
            key={label}
            href={href}
            className="flex min-h-20 flex-col items-center justify-center gap-2 rounded-xl bg-white p-3 text-center text-xs font-semibold text-slate-700 transition hover:bg-primary-50 hover:text-primary"
          >
            <Icon className="h-5 w-5" />
            {label}
          </Link>
        ))}
      </div>
    </div>
  );
}
