'use client';

import React, { FormEvent, ReactNode, useState } from 'react';
import { AnimatePresence, motion } from '@/shared/utils/motion';
import {
  BadgeIndianRupee,
  Boxes,
  Building2,
  CircleDollarSign,
  ClipboardCheck,
  FileText,
  Plus,
  RefreshCw,
  ShieldCheck,
  ShoppingCart,
  Truck,
  X,
} from 'lucide-react';
import { toast } from 'react-toastify';
import Swal from 'sweetalert2';
import CustomButton from '@/shared/core/CustomButton';
import CustomTable, { Column } from '@/shared/core/CustomTable';
import useMutation from '@/shared/hooks/useMutation';
import useSwr from '@/shared/hooks/useSwr';
import InlineFileUpload from '@/shared/core/InlineFileUpload';
import type { IViewerFile } from '@/shared/core/FileViewer';
import { useAuthStore } from '@/shared/store/authStore';
import { useHasPermission } from '@/shared/hooks/useHasPermission';

type Status =
  | 'draft'
  | 'pending'
  | 'pending_approval'
  | 'hod_approved'
  | 'approved'
  | 'suspended'
  | 'rejected'
  | 'open'
  | 'evaluation'
  | 'awarded'
  | 'issued'
  | 'partially_received'
  | 'received'
  | 'invoiced'
  | 'matched'
  | 'pending_match'
  | 'paid';
type EntityRef = {
  _id: string;
  legalName?: string;
  vendorNumber?: string;
  poNumber?: string;
  itemName?: string;
};
type Requisition = {
  _id: string;
  requisitionNumber: string;
  itemName: string;
  quantity: number;
  estimatedCost: number;
  purpose: string;
  status: Status;
  departmentId?: { _id: string; name: string };
  raisedBy?: EntityRef;
  hodApprovedBy?: string;
};
type Vendor = {
  _id: string;
  vendorNumber: string;
  legalName: string;
  email: string;
  phone: string;
  paymentTermsDays: number;
  status: Status;
  submittedBy?: string;
};
type Quote = {
  vendorId: string;
  quoteNumber: string;
  subtotal: number;
  taxAmount: number;
  totalAmount: number;
  deliveryDays: number;
};
type Rfq = {
  _id: string;
  rfqNumber: string;
  requisitionId: string;
  invitedVendorIds: EntityRef[];
  quotes: Quote[];
  status: Status;
  closesAt: string;
  awardedVendorId?: EntityRef;
  createdBy?: string;
};
type PurchaseOrder = {
  _id: string;
  poNumber: string;
  vendorId: EntityRef;
  itemName: string;
  quantity: number;
  receivedQuantity: number;
  totalAmount: number;
  status: Status;
  deliveryDueDate: string;
};
type GoodsReceipt = {
  _id: string;
  grnNumber: string;
  purchaseOrderId: EntityRef;
  quantityAccepted: number;
  quantityRejected: number;
  status: Status;
  rejectedQuantityReturned?: boolean;
  returnReason?: string;
  receivedAt: string;
};
type SupplierInvoice = {
  _id: string;
  invoiceNumber: string;
  vendorId: EntityRef;
  purchaseOrderId: EntityRef;
  totalAmount: number;
  matchVariance: number;
  dueDate: string;
  status: Status;
  submittedBy?: string;
  approvedBy?: string;
};
type Department = { _id: string; name: string; code: string };
type Tab = 'requisitions' | 'vendors' | 'rfqs' | 'orders' | 'receipts' | 'invoices';
type Modal =
  | { kind: 'requisition' }
  | { kind: 'vendor' }
  | { kind: 'rfq' }
  | { kind: 'quote'; row: Rfq }
  | { kind: 'award'; row: Rfq }
  | { kind: 'receive'; row: PurchaseOrder }
  | { kind: 'invoice' }
  | null;

const input =
  'w-full rounded-xl bg-slate-50 px-3 py-2.5 text-sm text-slate-800 outline-none ring-1 ring-slate-200 transition focus:bg-white focus:ring-2 focus:ring-primary/30';
const label = 'mb-1.5 block text-xs font-semibold text-slate-600';
const money = (value: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(value);
const date = (value: string) =>
  new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium' }).format(new Date(value));
const rows = <T,>(raw: unknown): T[] => (raw as { data?: T[] } | undefined)?.data ?? [];
const idOf = (value: FormDataEntryValue | null) => String(value ?? '').trim();
const numberOf = (value: FormDataEntryValue | null) => Number(value ?? 0);

function StatusBadge({ value }: { value: Status }) {
  const tone =
    value === 'approved' || value === 'matched' || value === 'received' || value === 'paid'
      ? 'bg-emerald-50 text-emerald-700'
      : value === 'rejected' || value === 'suspended'
        ? 'bg-rose-50 text-rose-700'
        : value === 'pending' || value === 'pending_approval' || value === 'pending_match'
          ? 'bg-amber-50 text-amber-700'
          : 'bg-blue-50 text-blue-700';
  return (
    <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${tone}`}>
      {value.replaceAll('_', ' ')}
    </span>
  );
}

function ModalShell({
  title,
  description,
  close,
  children,
}: {
  title: string;
  description: string;
  close: () => void;
  children: ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <motion.button
        aria-label="Close dialog"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="absolute inset-0 bg-slate-200/80 backdrop-blur-sm"
        onClick={close}
      />
      <motion.div
        role="dialog"
        aria-modal="true"
        initial={{ opacity: 0, y: 16, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 12, scale: 0.98 }}
        className="relative max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-5 sm:p-7"
      >
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-slate-900">{title}</h2>
            <p className="mt-1 text-sm text-slate-500">{description}</p>
          </div>
          <button
            onClick={close}
            className="rounded-lg p-2 text-slate-600 hover:bg-slate-100"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        {children}
      </motion.div>
    </div>
  );
}

export default function ProcurementPage() {
  const activeRole = useAuthStore(
    (state) => state.activeRole?.baseRole ?? state.activeRole?.name ?? state.role ?? '',
  );
  const userId = useAuthStore((state) => state.user?._id ?? '');
  const canCreate = useHasPermission('procurement', 'create');
  const canEdit = useHasPermission('procurement', 'edit');
  const canApprove = useHasPermission('procurement', 'approve');
  const canExport = useHasPermission('procurement', 'export');
  const canReceive = useHasPermission('store', 'edit');
  const canPayInvoice = useHasPermission('accounts', 'edit');
  const canInvoice = canCreate;
  const canManage = canCreate || canEdit || canApprove;
  const canApproveInvoice = canApprove;
  const isHod = activeRole === 'hod';
  const canFinalApproveReq = canApprove && !isHod;
  const isDepartmentScoped = ['hod', 'faculty'].includes(activeRole);
  const [tab, setTab] = useState<Tab>('requisitions');
  const [modal, setModal] = useState<Modal>(null);
  const [invoicePurchaseOrder, setInvoicePurchaseOrder] = useState('');
  const { mutation, isLoading: acting } = useMutation();

  const reqQuery = useSwr('procurement/requisitions');
  const vendorQuery = useSwr('procurement/vendors');
  const rfqQuery = useSwr('procurement/rfqs');
  const poQuery = useSwr('procurement/purchase-orders');
  const grnQuery = useSwr('procurement/goods-receipts');
  const invoiceQuery = useSwr('procurement/supplier-invoices');
  const departmentQuery = useSwr(isDepartmentScoped ? null : 'department?limit=100');

  const requisitions = rows<Requisition>(reqQuery.data);
  const vendors = rows<Vendor>(vendorQuery.data);
  const rfqs = rows<Rfq>(rfqQuery.data);
  const orders = rows<PurchaseOrder>(poQuery.data);
  const receipts = rows<GoodsReceipt>(grnQuery.data);
  const invoices = rows<SupplierInvoice>(invoiceQuery.data);
  const departments = rows<Department>(departmentQuery.data);
  const approvedVendors = vendors.filter((row) => row.status === 'approved');
  const eligibleReceipts = receipts.filter((row) =>
    ['accepted', 'partially_rejected'].includes(row.status),
  );

  const refreshAll = async () => {
    await Promise.all([
      reqQuery.mutate(),
      vendorQuery.mutate(),
      rfqQuery.mutate(),
      poQuery.mutate(),
      grnQuery.mutate(),
      invoiceQuery.mutate(),
    ]);
    toast.success('Procurement registers refreshed');
  };

  const perform = async (
    path: string,
    method: 'POST' | 'PATCH',
    body: unknown,
    message: string,
  ) => {
    const response = await mutation(path, { method, body });
    if (!response) return false;
    toast.success(message);
    setModal(null);
    await refreshAll();
    return true;
  };

  const submit =
    (handler: (data: FormData) => Promise<unknown>) =>
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      await handler(new FormData(event.currentTarget));
    };

  const decideReq = async (row: Requisition, action: 'hod_approve' | 'approve' | 'reject') => {
    let notes: string | undefined;
    if (action === 'reject') {
      const answer = await Swal.fire({
        title: `Reject requisition ${row.requisitionNumber}?`,
        input: 'textarea',
        inputLabel: 'Reason',
        showCancelButton: true,
        inputValidator: (value) =>
          value.trim().length < 5 ? 'Enter at least 5 characters' : undefined,
      });
      if (!answer.isConfirmed) return;
      notes = answer.value;
    }
    await perform(
      `procurement/requisitions/${row._id}/decide`,
      'PATCH',
      { action, notes },
      'Requisition decision recorded',
    );
  };
  const decideVendor = async (row: Vendor, action: 'approve' | 'suspend') => {
    let reason: string | undefined;
    if (action === 'suspend') {
      const answer = await Swal.fire({
        title: `Suspend ${row.legalName}?`,
        input: 'textarea',
        inputLabel: 'Reason',
        showCancelButton: true,
        inputValidator: (value) =>
          value.trim().length < 5 ? 'Enter at least 5 characters' : undefined,
      });
      if (!answer.isConfirmed) return;
      reason = answer.value;
    }
    void perform(
      `procurement/vendors/${row._id}/decide`,
      'PATCH',
      { action, reason },
      `Vendor ${action}d`,
    );
  };
  const decideInvoice = async (row: SupplierInvoice, action: 'approve' | 'reject') => {
    let reason: string | undefined;
    if (action === 'reject') {
      const answer = await Swal.fire({
        title: `Reject invoice ${row.invoiceNumber}?`,
        input: 'textarea',
        inputLabel: 'Reason',
        showCancelButton: true,
        inputValidator: (value) =>
          value.trim().length < 5 ? 'Enter at least 5 characters' : undefined,
      });
      if (!answer.isConfirmed) return;
      reason = answer.value;
    }
    void perform(
      `procurement/supplier-invoices/${row._id}/decide`,
      'PATCH',
      { action, reason },
      `Invoice ${action}d`,
    );
  };
  const payInvoice = async (row: SupplierInvoice) => {
    const answer = await Swal.fire({
      title: `Release ${money(row.totalAmount)} payment?`,
      html: '<input id="payment-reference" class="swal2-input" placeholder="Bank payment reference"><input id="payment-date" type="date" class="swal2-input">',
      showCancelButton: true,
      confirmButtonText: 'Post payment',
      preConfirm: () => {
        const paymentReference = (
          document.getElementById('payment-reference') as HTMLInputElement
        )?.value.trim();
        const paymentDate = (document.getElementById('payment-date') as HTMLInputElement)?.value;
        if (!paymentReference || paymentReference.length < 3 || !paymentDate) {
          Swal.showValidationMessage('Payment reference and date are required');
          return false;
        }
        return { paymentReference, paymentDate };
      },
    });
    if (!answer.isConfirmed || !answer.value) return;
    void perform(
      `procurement/supplier-invoices/${row._id}/pay`,
      'POST',
      answer.value,
      'Supplier payable settled and posted to the ledger',
    );
  };
  const returnRejectedGoods = async (row: GoodsReceipt) => {
    const answer = await Swal.fire({
      title: `Return ${row.quantityRejected} rejected item(s)?`,
      input: 'textarea',
      inputLabel: 'Supplier return reason',
      showCancelButton: true,
      confirmButtonText: 'Confirm return',
      inputValidator: (value) =>
        value.trim().length < 5 ? 'Enter at least 5 characters' : undefined,
    });
    if (!answer.isConfirmed) return;
    await perform(
      `procurement/goods-receipts/${row._id}/return`,
      'POST',
      { reason: answer.value },
      'Rejected goods marked as returned to supplier',
    );
  };

  const reqColumns: Column<Requisition>[] = [
    {
      field: 'requisitionNumber',
      title: 'Requisition',
      render: (r) => <span className="font-mono text-xs font-bold">{r.requisitionNumber}</span>,
    },
    {
      field: 'itemName',
      title: 'Requirement',
      render: (r) => (
        <div>
          <p className="font-semibold text-slate-800">{r.itemName}</p>
          <p className="text-xs text-slate-500">
            Qty {r.quantity} · {r.departmentId?.name ?? 'No department'}
          </p>
        </div>
      ),
    },
    { field: 'estimatedCost', title: 'Estimate', render: (r) => money(r.estimatedCost) },
    { field: 'status', title: 'Status', render: (r) => <StatusBadge value={r.status} /> },
    {
      field: '_id',
      title: 'Action',
      render: (r) => (
        <div className="flex flex-wrap gap-2">
          {r.status === 'pending' && isHod && r.raisedBy?._id !== userId && (
            <CustomButton
              variant="tertiary"
              className="px-2! py-1! text-xs!"
              loading={acting}
              onClick={() => void decideReq(r, 'hod_approve')}
            >
              HOD approve
            </CustomButton>
          )}
          {r.status === 'hod_approved' && canFinalApproveReq && r.hodApprovedBy !== userId && (
            <CustomButton
              variant="primary"
              className="px-2! py-1! text-xs!"
              loading={acting}
              onClick={() => void decideReq(r, 'approve')}
            >
              Final approve
            </CustomButton>
          )}
          {['pending', 'hod_approved'].includes(r.status) &&
            (isHod || canFinalApproveReq) &&
            r.raisedBy?._id !== userId && (
              <CustomButton
                variant="tertiary"
                className="px-2! py-1! text-xs! text-rose-600!"
                loading={acting}
                onClick={() => void decideReq(r, 'reject')}
              >
                Reject
              </CustomButton>
            )}
        </div>
      ),
    },
  ];
  const vendorColumns: Column<Vendor>[] = [
    {
      field: 'vendorNumber',
      title: 'Vendor',
      render: (r) => (
        <div>
          <p className="font-semibold text-slate-800">{r.legalName}</p>
          <p className="font-mono text-xs text-slate-500">{r.vendorNumber}</p>
        </div>
      ),
    },
    {
      field: 'email',
      title: 'Contact',
      render: (r) => (
        <div className="text-sm">
          <p>{r.email}</p>
          <p className="text-xs text-slate-500">{r.phone}</p>
        </div>
      ),
    },
    { field: 'paymentTermsDays', title: 'Terms', render: (r) => `${r.paymentTermsDays} days` },
    { field: 'status', title: 'Status', render: (r) => <StatusBadge value={r.status} /> },
    {
      field: '_id',
      title: 'Action',
      render: (r) =>
        canManage ? (
          <div className="flex gap-2">
            {r.status === 'draft' && canEdit && (
              <CustomButton
                variant="tertiary"
                className="px-2! py-1! text-xs!"
                onClick={() =>
                  void perform(
                    `procurement/vendors/${r._id}/submit`,
                    'POST',
                    {},
                    'Vendor submitted for independent approval',
                  )
                }
              >
                Submit
              </CustomButton>
            )}
            {r.status === 'pending_approval' && canApprove && r.submittedBy !== userId && (
              <CustomButton
                variant="primary"
                className="px-2! py-1! text-xs!"
                onClick={() => decideVendor(r, 'approve')}
              >
                Approve
              </CustomButton>
            )}
            {r.status === 'approved' && canApprove && (
              <CustomButton
                variant="tertiary"
                className="px-2! py-1! text-xs! text-rose-600!"
                onClick={() => decideVendor(r, 'suspend')}
              >
                Suspend
              </CustomButton>
            )}
          </div>
        ) : null,
    },
  ];
  const rfqColumns: Column<Rfq>[] = [
    {
      field: 'rfqNumber',
      title: 'RFQ',
      render: (r) => <span className="font-mono text-xs font-bold">{r.rfqNumber}</span>,
    },
    {
      field: 'invitedVendorIds',
      title: 'Competition',
      render: (r) => (
        <div>
          <p className="font-semibold">
            {r.quotes.length}/{r.invitedVendorIds.length} quotes
          </p>
          <p className="text-xs text-slate-500">Closes {date(r.closesAt)}</p>
        </div>
      ),
    },
    { field: 'status', title: 'Status', render: (r) => <StatusBadge value={r.status} /> },
    {
      field: '_id',
      title: 'Action',
      render: (r) =>
        ['open', 'evaluation'].includes(r.status) ? (
          <div className="flex gap-2">
            {canEdit && (
              <CustomButton
                variant="tertiary"
                className="px-2! py-1! text-xs!"
                onClick={() => setModal({ kind: 'quote', row: r })}
              >
                Add quote
              </CustomButton>
            )}
            {canApprove && r.quotes.length > 0 && r.createdBy !== userId && (
              <CustomButton
                variant="primary"
                className="px-2! py-1! text-xs!"
                onClick={() => setModal({ kind: 'award', row: r })}
              >
                Award
              </CustomButton>
            )}
          </div>
        ) : (
          (r.awardedVendorId?.legalName ?? null)
        ),
    },
  ];
  const poColumns: Column<PurchaseOrder>[] = [
    {
      field: 'poNumber',
      title: 'Purchase order',
      render: (r) => (
        <div>
          <p className="font-mono text-xs font-bold">{r.poNumber}</p>
          <p className="text-xs text-slate-500">{r.vendorId?.legalName}</p>
        </div>
      ),
    },
    {
      field: 'itemName',
      title: 'Item',
      render: (r) => (
        <div>
          <p className="font-semibold">{r.itemName}</p>
          <p className="text-xs text-slate-500">
            {r.receivedQuantity}/{r.quantity} accepted
          </p>
        </div>
      ),
    },
    { field: 'totalAmount', title: 'Value', render: (r) => money(r.totalAmount) },
    { field: 'status', title: 'Status', render: (r) => <StatusBadge value={r.status} /> },
    {
      field: '_id',
      title: 'Action',
      render: (r) =>
        canReceive && ['issued', 'partially_received'].includes(r.status) ? (
          <CustomButton
            variant="primary"
            className="px-2! py-1! text-xs!"
            onClick={() => setModal({ kind: 'receive', row: r })}
          >
            Receive & inspect
          </CustomButton>
        ) : null,
    },
  ];
  const grnColumns: Column<GoodsReceipt>[] = [
    {
      field: 'grnNumber',
      title: 'GRN',
      render: (r) => <span className="font-mono text-xs font-bold">{r.grnNumber}</span>,
    },
    {
      field: 'purchaseOrderId',
      title: 'Purchase order',
      render: (r) => (
        <div>
          <p>{r.purchaseOrderId?.poNumber}</p>
          <p className="text-xs text-slate-500">{r.purchaseOrderId?.itemName}</p>
        </div>
      ),
    },
    {
      field: 'quantityAccepted',
      title: 'Inspection',
      render: (r) => (
        <span className="text-sm">
          {r.quantityAccepted} accepted · {r.quantityRejected} rejected
        </span>
      ),
    },
    { field: 'status', title: 'Status', render: (r) => <StatusBadge value={r.status} /> },
    { field: 'receivedAt', title: 'Received', render: (r) => date(r.receivedAt) },
    {
      field: '_id',
      title: 'Supplier return',
      render: (r) =>
        r.quantityRejected > 0 && !r.rejectedQuantityReturned && canReceive ? (
          <CustomButton
            variant="tertiary"
            className="px-2! py-1! text-xs! text-rose-600!"
            onClick={() => void returnRejectedGoods(r)}
          >
            Return rejected
          </CustomButton>
        ) : r.rejectedQuantityReturned ? (
          <span className="text-xs font-semibold text-emerald-600">Returned</span>
        ) : (
          '—'
        ),
    },
  ];
  const invoiceColumns: Column<SupplierInvoice>[] = [
    {
      field: 'invoiceNumber',
      title: 'Invoice',
      render: (r) => (
        <div>
          <p className="font-semibold">{r.invoiceNumber}</p>
          <p className="text-xs text-slate-500">{r.vendorId?.legalName}</p>
        </div>
      ),
    },
    { field: 'purchaseOrderId', title: 'PO', render: (r) => r.purchaseOrderId?.poNumber ?? '—' },
    {
      field: 'totalAmount',
      title: 'Amount',
      render: (r) => (
        <div>
          <p>{money(r.totalAmount)}</p>
          <p className="text-xs text-slate-500">Variance {money(r.matchVariance)}</p>
        </div>
      ),
    },
    { field: 'status', title: 'Match', render: (r) => <StatusBadge value={r.status} /> },
    {
      field: '_id',
      title: 'Action',
      render: (r) =>
        canPayInvoice && r.status === 'approved' && r.approvedBy !== userId ? (
          <CustomButton
            variant="primary"
            className="px-2! py-1! text-xs!"
            onClick={() => payInvoice(r)}
          >
            Release payment
          </CustomButton>
        ) : canApproveInvoice &&
          ['matched', 'pending_match'].includes(r.status) &&
          r.submittedBy !== userId ? (
          <div className="flex gap-2">
            {r.status === 'matched' && (
              <CustomButton
                variant="primary"
                className="px-2! py-1! text-xs!"
                onClick={() => decideInvoice(r, 'approve')}
              >
                Approve
              </CustomButton>
            )}
            <CustomButton
              variant="tertiary"
              className="px-2! py-1! text-xs! text-rose-600!"
              onClick={() => decideInvoice(r, 'reject')}
            >
              Reject
            </CustomButton>
          </div>
        ) : null,
    },
  ];

  const tabs = [
    {
      id: 'requisitions' as const,
      label: '1. Requisitions',
      description: 'Need and approval',
      icon: ShoppingCart,
      count: requisitions.length,
    },
    {
      id: 'vendors' as const,
      label: '2. Vendors',
      description: 'Supplier governance',
      icon: Building2,
      count: vendors.length,
    },
    {
      id: 'rfqs' as const,
      label: '3. Quotations',
      description: 'Competitive sourcing',
      icon: FileText,
      count: rfqs.length,
    },
    {
      id: 'orders' as const,
      label: '4. Purchase orders',
      description: 'Awarded commitments',
      icon: Boxes,
      count: orders.length,
    },
    {
      id: 'receipts' as const,
      label: '5. Receive & inspect',
      description: 'Quantity and quality',
      icon: ClipboardCheck,
      count: receipts.length,
    },
    {
      id: 'invoices' as const,
      label: '6. Invoices & payment',
      description: 'Match and settlement',
      icon: BadgeIndianRupee,
      count: invoices.length,
    },
  ];
  const current = {
    requisitions: {
      data: requisitions,
      columns: reqColumns,
      loading: reqQuery.isLoading,
      add: canCreate ? () => setModal({ kind: 'requisition' }) : undefined,
      addLabel: 'Raise request',
    },
    vendors: {
      data: vendors,
      columns: vendorColumns,
      loading: vendorQuery.isLoading,
      add: canCreate ? () => setModal({ kind: 'vendor' }) : undefined,
      addLabel: 'Add vendor',
    },
    rfqs: {
      data: rfqs,
      columns: rfqColumns,
      loading: rfqQuery.isLoading,
      add: canCreate ? () => setModal({ kind: 'rfq' }) : undefined,
      addLabel: 'Create RFQ',
    },
    orders: {
      data: orders,
      columns: poColumns,
      loading: poQuery.isLoading,
      add: undefined,
      addLabel: '',
    },
    receipts: {
      data: receipts,
      columns: grnColumns,
      loading: grnQuery.isLoading,
      add: undefined,
      addLabel: '',
    },
    invoices: {
      data: invoices,
      columns: invoiceColumns,
      loading: invoiceQuery.isLoading,
      add: canInvoice
        ? () => {
            setInvoicePurchaseOrder('');
            setModal({ kind: 'invoice' });
          }
        : undefined,
      addLabel: 'Submit invoice',
    },
  }[tab];

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">
            Procure to pay
          </p>
          <h1 className="mt-1 text-2xl font-black text-slate-900 sm:text-3xl">
            Procurement command centre
          </h1>
          <p className="mt-1 max-w-3xl text-sm text-slate-500">
            Controlled sourcing from approved requisition through competitive quotation, inspection,
            three-way match, and invoice approval.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void refreshAll()}
            disabled={
              reqQuery.isValidating ||
              vendorQuery.isValidating ||
              rfqQuery.isValidating ||
              poQuery.isValidating ||
              grnQuery.isValidating ||
              invoiceQuery.isValidating
            }
            className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs font-semibold text-slate-600 transition hover:border-primary/20 hover:bg-primary-50 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <RefreshCw
              className={`h-4 w-4 ${
                reqQuery.isValidating ||
                vendorQuery.isValidating ||
                rfqQuery.isValidating ||
                poQuery.isValidating ||
                grnQuery.isValidating ||
                invoiceQuery.isValidating
                  ? 'animate-spin'
                  : ''
              }`}
            />
            Refresh
          </button>
          {current.add && (
            <CustomButton
              variant="primary"
              onClick={current.add}
              startIcon={<Plus className="h-4 w-4" />}
            >
              {current.addLabel}
            </CustomButton>
          )}
        </div>
      </header>

      <ProcurementAnalytics
        requisitions={requisitions}
        vendors={vendors}
        rfqs={rfqs}
        orders={orders}
        receipts={receipts}
        invoices={invoices}
      />

      <div
        className="flex w-fit max-w-full gap-2 overflow-x-auto rounded-2xl border border-slate-200 bg-white p-2"
        role="tablist"
        aria-label="Procure-to-pay workflow stages"
      >
        {tabs.map(({ id, label: tabLabel, description, icon: Icon, count }) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={tab === id}
            onClick={() => setTab(id)}
            className={`flex shrink-0 items-center gap-3 rounded-xl px-3.5 py-3 text-left transition-colors ${tab === id ? 'bg-primary text-white' : 'text-slate-500 hover:bg-slate-100'}`}
          >
            <span
              className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${tab === id ? 'bg-white/15' : 'bg-slate-100'}`}
            >
              <Icon className="h-4 w-4" />
            </span>
            <span>
              <span className="flex items-center gap-2 text-xs font-bold">
                {tabLabel}
                <span
                  className={`rounded-full px-1.5 py-0.5 text-[9px] ${tab === id ? 'bg-white/15 text-white' : 'bg-slate-100 text-slate-500'}`}
                >
                  {count}
                </span>
              </span>
              <span
                className={`mt-0.5 block text-[10px] ${tab === id ? 'text-white/75' : 'text-slate-400'}`}
              >
                {description}
              </span>
            </span>
          </button>
        ))}
      </div>

      <>
        {(reqQuery.error ||
          vendorQuery.error ||
          rfqQuery.error ||
          poQuery.error ||
          grnQuery.error ||
          invoiceQuery.error) && (
          <div role="alert" className="mb-4 rounded-xl bg-rose-50 p-4 text-sm text-rose-700">
            One or more procurement registers could not be loaded. Refresh the page or contact your
            administrator if the problem continues.
          </div>
        )}
        {tab === 'requisitions' && (
          <CustomTable
            key="procurement-requisitions-table"
            title="Purchase requisitions"
            description="Track departmental need, estimated value and the two-stage recommendation and approval trail."
            data={requisitions}
            columns={reqColumns}
            isLoading={reqQuery.isLoading}
            isValidating={reqQuery.isValidating}
            onRefresh={() => void reqQuery.mutate()}
            options={{ refresh: true, export: canExport, pagination: true, responsive: true }}
          />
        )}
        {tab === 'vendors' && (
          <CustomTable
            key="procurement-vendors-table"
            title="Approved supplier register"
            description="Govern supplier identity, contact details, payment terms and independent approval status."
            data={vendors}
            columns={vendorColumns}
            isLoading={vendorQuery.isLoading}
            isValidating={vendorQuery.isValidating}
            onRefresh={() => void vendorQuery.mutate()}
            options={{ refresh: true, export: canExport, pagination: true, responsive: true }}
          />
        )}
        {tab === 'rfqs' && (
          <CustomTable
            key="procurement-rfqs-table"
            title="Requests for quotation"
            description="Compare invited suppliers, quotation coverage, closing dates and documented award decisions."
            data={rfqs}
            columns={rfqColumns}
            isLoading={rfqQuery.isLoading}
            isValidating={rfqQuery.isValidating}
            onRefresh={() => void rfqQuery.mutate()}
            options={{ refresh: true, export: canExport, pagination: true, responsive: true }}
          />
        )}
        {tab === 'orders' && (
          <CustomTable
            key="procurement-orders-table"
            title="Purchase-order commitments"
            description="Monitor awarded supplier commitments, delivery due dates, value and accepted quantities."
            data={orders}
            columns={poColumns}
            isLoading={poQuery.isLoading}
            isValidating={poQuery.isValidating}
            onRefresh={() => void poQuery.mutate()}
            options={{ refresh: true, export: canExport, pagination: true, responsive: true }}
          />
        )}
        {tab === 'receipts' && (
          <CustomTable
            key="procurement-receipts-table"
            title="Goods receipt and inspection register"
            description="Verify received, accepted and rejected quantities before inventory and invoice matching."
            data={receipts}
            columns={grnColumns}
            isLoading={grnQuery.isLoading}
            isValidating={grnQuery.isValidating}
            onRefresh={() => void grnQuery.mutate()}
            options={{ refresh: true, export: canExport, pagination: true, responsive: true }}
          />
        )}
        {tab === 'invoices' && (
          <CustomTable
            key="procurement-invoices-table"
            title="Supplier invoices and settlement"
            description="Review three-way matching variance, independent approval, due dates and payment status."
            data={invoices}
            columns={invoiceColumns}
            isLoading={invoiceQuery.isLoading}
            isValidating={invoiceQuery.isValidating}
            onRefresh={() => void invoiceQuery.mutate()}
            options={{ refresh: true, export: canExport, pagination: true, responsive: true }}
          />
        )}
      </>

      <AnimatePresence>
        {modal?.kind === 'requisition' && (
          <ModalShell
            title="Raise requisition"
            description="Start a traceable department purchase request."
            close={() => setModal(null)}
          >
            <form
              className="grid gap-4 sm:grid-cols-2"
              onSubmit={submit((f) =>
                perform(
                  'procurement/requisitions',
                  'POST',
                  {
                    itemName: idOf(f.get('itemName')),
                    quantity: numberOf(f.get('quantity')),
                    estimatedCost: numberOf(f.get('estimatedCost')),
                    departmentId: idOf(f.get('departmentId')),
                    purpose: idOf(f.get('purpose')),
                    notes: idOf(f.get('notes')),
                  },
                  'Requisition raised',
                ),
              )}
            >
              <Field name="itemName" title="Item name" required />
              <Field name="quantity" title="Quantity" type="number" min="1" required />
              <Field
                name="estimatedCost"
                title="Estimated cost (₹)"
                type="number"
                min="0"
                required
              />
              {!isDepartmentScoped && (
                <Select
                  name="departmentId"
                  title="Department"
                  options={departments.map((r) => ({
                    value: r._id,
                    label: `${r.name} (${r.code})`,
                  }))}
                />
              )}
              <div className="sm:col-span-2">
                <Field name="purpose" title="Business justification" required />
              </div>
              <div className="sm:col-span-2">
                <Field name="notes" title="Notes" />
              </div>
              <Actions loading={acting} close={() => setModal(null)} label="Submit requisition" />
            </form>
          </ModalShell>
        )}
        {modal?.kind === 'vendor' && (
          <ModalShell
            title="Create vendor"
            description="Create a draft supplier record for independent approval."
            close={() => setModal(null)}
          >
            <form
              className="grid gap-4 sm:grid-cols-2"
              onSubmit={submit((f) =>
                perform(
                  'procurement/vendors',
                  'POST',
                  {
                    legalName: idOf(f.get('legalName')),
                    tradeName: idOf(f.get('tradeName')),
                    gstin: idOf(f.get('gstin')),
                    pan: idOf(f.get('pan')),
                    email: idOf(f.get('email')),
                    phone: idOf(f.get('phone')),
                    address: idOf(f.get('address')),
                    paymentTermsDays: numberOf(f.get('paymentTermsDays')),
                  },
                  'Vendor draft created',
                ),
              )}
            >
              <Field name="legalName" title="Legal name" required />
              <Field name="tradeName" title="Trade name" />
              <Field name="email" title="Email" type="email" required />
              <Field name="phone" title="Phone" required />
              <Field name="gstin" title="GSTIN" />
              <Field name="pan" title="PAN" />
              <Field
                name="paymentTermsDays"
                title="Payment terms (days)"
                type="number"
                min="0"
                defaultValue="30"
                required
              />
              <div className="sm:col-span-2">
                <Field name="address" title="Registered address" required />
              </div>
              <Actions loading={acting} close={() => setModal(null)} label="Create draft" />
            </form>
          </ModalShell>
        )}
        {modal?.kind === 'rfq' && (
          <ModalShell
            title="Create request for quotation"
            description="Invite approved suppliers; purchases of ₹50,000 or more require at least three."
            close={() => setModal(null)}
          >
            <form
              className="space-y-4"
              onSubmit={submit((f) =>
                perform(
                  'procurement/rfqs',
                  'POST',
                  {
                    requisitionId: idOf(f.get('requisitionId')),
                    vendorIds: f.getAll('vendorIds').map(String),
                    closesAt: idOf(f.get('closesAt')),
                  },
                  'RFQ opened',
                ),
              )}
            >
              <Select
                name="requisitionId"
                title="HOD-approved requisition"
                options={requisitions
                  .filter((r) => r.status === 'hod_approved')
                  .map((r) => ({
                    value: r._id,
                    label: `${r.requisitionNumber} · ${r.itemName} · ${money(r.estimatedCost)}`,
                  }))}
              />
              <div>
                <label className={label}>Approved vendors</label>
                <div className="grid gap-2 sm:grid-cols-2">
                  {approvedVendors.map((v) => (
                    <label
                      key={v._id}
                      className="flex items-center gap-2 rounded-xl bg-slate-50 p-3 text-sm"
                    >
                      <input type="checkbox" name="vendorIds" value={v._id} />
                      {v.legalName}
                    </label>
                  ))}
                </div>
              </div>
              <Field name="closesAt" title="Closing date and time" type="datetime-local" required />
              <Actions loading={acting} close={() => setModal(null)} label="Open RFQ" />
            </form>
          </ModalShell>
        )}
        {modal?.kind === 'quote' && (
          <ModalShell
            title={`Record quote · ${modal.row.rfqNumber}`}
            description="The authoritative total must equal subtotal plus tax."
            close={() => setModal(null)}
          >
            <form
              className="grid gap-4 sm:grid-cols-2"
              onSubmit={submit((f) =>
                perform(
                  `procurement/rfqs/${modal.row._id}/quotes`,
                  'POST',
                  {
                    vendorId: idOf(f.get('vendorId')),
                    quoteNumber: idOf(f.get('quoteNumber')),
                    subtotal: numberOf(f.get('subtotal')),
                    taxAmount: numberOf(f.get('taxAmount')),
                    totalAmount: numberOf(f.get('totalAmount')),
                    deliveryDays: numberOf(f.get('deliveryDays')),
                    validUntil: idOf(f.get('validUntil')),
                    attachmentUrl: idOf(f.get('attachmentUrl')) || undefined,
                  },
                  'Supplier quote recorded',
                ),
              )}
            >
              <Select
                name="vendorId"
                title="Invited vendor"
                options={modal.row.invitedVendorIds.map((v) => ({
                  value: v._id,
                  label: v.legalName ?? v.vendorNumber ?? v._id,
                }))}
              />
              <Field name="quoteNumber" title="Quote number" required />
              <Field
                name="subtotal"
                title="Subtotal (₹)"
                type="number"
                min="0"
                step="0.01"
                required
              />
              <Field name="taxAmount" title="Tax (₹)" type="number" min="0" step="0.01" required />
              <Field
                name="totalAmount"
                title="Total (₹)"
                type="number"
                min="0"
                step="0.01"
                required
              />
              <Field name="deliveryDays" title="Delivery days" type="number" min="0" required />
              <Field name="validUntil" title="Valid until" type="date" required />
              <QuoteEvidenceUpload />
              <Actions loading={acting} close={() => setModal(null)} label="Record quote" />
            </form>
          </ModalShell>
        )}
        {modal?.kind === 'award' && (
          <ModalShell
            title={`Award ${modal.row.rfqNumber}`}
            description="The award reason is retained in the immutable decision trail."
            close={() => setModal(null)}
          >
            <form
              className="space-y-4"
              onSubmit={submit((f) =>
                perform(
                  `procurement/rfqs/${modal.row._id}/award`,
                  'PATCH',
                  { quoteNumber: idOf(f.get('quoteNumber')), reason: idOf(f.get('reason')) },
                  'RFQ awarded and purchase order issued',
                ),
              )}
            >
              <Select
                name="quoteNumber"
                title="Winning quotation"
                options={modal.row.quotes.map((q) => ({
                  value: q.quoteNumber,
                  label: `${modal.row.invitedVendorIds.find((vendor) => vendor._id === q.vendorId)?.legalName ?? 'Invited vendor'} · ${q.quoteNumber} · ${money(q.totalAmount)} · ${q.deliveryDays} days${q.totalAmount === Math.min(...modal.row.quotes.map((quote) => quote.totalAmount)) ? ' · lowest price' : ''}`,
                }))}
              />
              <Field
                name="reason"
                title="Award rationale (minimum 10 characters)"
                minLength={10}
                required
              />
              <Actions loading={acting} close={() => setModal(null)} label="Award and issue PO" />
            </form>
          </ModalShell>
        )}
        {modal?.kind === 'receive' && (
          <ModalShell
            title={`Receive ${modal.row.poNumber}`}
            description={`Outstanding quantity: ${modal.row.quantity - modal.row.receivedQuantity}. Accepted stock posts atomically to the approved store item.`}
            close={() => setModal(null)}
          >
            <form
              className="grid gap-4 sm:grid-cols-3"
              onSubmit={submit((f) =>
                perform(
                  `procurement/purchase-orders/${modal.row._id}/receive`,
                  'POST',
                  {
                    quantityReceived: numberOf(f.get('quantityReceived')),
                    quantityAccepted: numberOf(f.get('quantityAccepted')),
                    quantityRejected: numberOf(f.get('quantityRejected')),
                    inspectionNotes: idOf(f.get('inspectionNotes')),
                  },
                  'Goods receipt and inspection posted',
                ),
              )}
            >
              <Field name="quantityReceived" title="Received" type="number" min="1" required />
              <Field name="quantityAccepted" title="Accepted" type="number" min="0" required />
              <Field name="quantityRejected" title="Rejected" type="number" min="0" required />
              <div className="sm:col-span-3">
                <Field name="inspectionNotes" title="Inspection notes" />
              </div>
              <Actions loading={acting} close={() => setModal(null)} label="Post receipt" />
            </form>
          </ModalShell>
        )}
        {modal?.kind === 'invoice' && (
          <ModalShell
            title="Submit supplier invoice"
            description="The system performs quantity and value three-way matching against the PO and accepted GRNs."
            close={() => setModal(null)}
          >
            <form
              className="grid gap-4 sm:grid-cols-2"
              onSubmit={submit((f) =>
                perform(
                  'procurement/supplier-invoices',
                  'POST',
                  {
                    invoiceNumber: idOf(f.get('invoiceNumber')),
                    purchaseOrderId: idOf(f.get('purchaseOrderId')),
                    grnIds: f.getAll('grnIds').map(String),
                    subtotal: numberOf(f.get('subtotal')),
                    taxAmount: numberOf(f.get('taxAmount')),
                    totalAmount: numberOf(f.get('totalAmount')),
                    dueDate: idOf(f.get('dueDate')),
                  },
                  'Invoice submitted for three-way match',
                ),
              )}
            >
              <Field name="invoiceNumber" title="Supplier invoice number" required />
              <Select
                name="purchaseOrderId"
                title="Purchase order"
                value={invoicePurchaseOrder}
                onChange={(event) => setInvoicePurchaseOrder(event.target.value)}
                options={orders
                  .filter((r) => ['received', 'partially_received'].includes(r.status))
                  .map((r) => ({ value: r._id, label: `${r.poNumber} · ${r.itemName}` }))}
              />
              <div className="sm:col-span-2">
                <label className={label}>Accepted goods receipts</label>
                <div className="grid gap-2 sm:grid-cols-2">
                  {eligibleReceipts
                    .filter((receipt) => receipt.purchaseOrderId?._id === invoicePurchaseOrder)
                    .map((r) => (
                      <label
                        key={r._id}
                        className="flex items-center gap-2 rounded-xl bg-slate-50 p-3 text-sm"
                      >
                        <input type="checkbox" name="grnIds" value={r._id} />
                        {r.grnNumber} · {r.purchaseOrderId?.poNumber}
                      </label>
                    ))}
                </div>
                {invoicePurchaseOrder &&
                  !eligibleReceipts.some(
                    (receipt) => receipt.purchaseOrderId?._id === invoicePurchaseOrder,
                  ) && (
                    <p className="mt-2 text-xs text-amber-600">
                      This purchase order has no uninvoiced accepted receipt available.
                    </p>
                  )}
              </div>
              <Field
                name="subtotal"
                title="Subtotal (₹)"
                type="number"
                min="0"
                step="0.01"
                required
              />
              <Field name="taxAmount" title="Tax (₹)" type="number" min="0" step="0.01" required />
              <Field
                name="totalAmount"
                title="Total (₹)"
                type="number"
                min="0"
                step="0.01"
                required
              />
              <Field name="dueDate" title="Due date" type="date" required />
              <Actions loading={acting} close={() => setModal(null)} label="Submit and match" />
            </form>
          </ModalShell>
        )}
      </AnimatePresence>
    </div>
  );
}

function ProcurementAnalytics({
  requisitions,
  vendors,
  rfqs,
  orders,
  receipts,
  invoices,
}: {
  requisitions: Requisition[];
  vendors: Vendor[];
  rfqs: Rfq[];
  orders: PurchaseOrder[];
  receipts: GoodsReceipt[];
  invoices: SupplierInvoice[];
}) {
  const awaitingApproval = requisitions.filter((row) =>
    ['pending', 'hod_approved'].includes(row.status),
  ).length;
  const openCompetitions = rfqs.filter((row) => ['open', 'evaluation'].includes(row.status)).length;
  const outstandingDeliveries = orders.filter((row) =>
    ['issued', 'partially_received'].includes(row.status),
  ).length;
  const unpaidInvoices = invoices.filter((row) => row.status !== 'paid');
  const payableExposure = unpaidInvoices.reduce((total, row) => total + row.totalAmount, 0);
  const acceptedQuantity = receipts.reduce((total, row) => total + row.quantityAccepted, 0);
  const inspectedQuantity = receipts.reduce(
    (total, row) => total + row.quantityAccepted + row.quantityRejected,
    0,
  );
  const acceptanceRate = inspectedQuantity
    ? Math.round((acceptedQuantity / inspectedQuantity) * 100)
    : 0;
  const approvedSuppliers = vendors.filter((row) => row.status === 'approved').length;
  const supplierReadiness = vendors.length
    ? Math.round((approvedSuppliers / vendors.length) * 100)
    : 0;
  const pipeline = [
    {
      label: 'Approved need',
      value: requisitions.filter((row) => row.status === 'approved').length,
      color: '#2563eb',
    },
    {
      label: 'RFQ awarded',
      value: rfqs.filter((row) => row.status === 'awarded').length,
      color: '#8b5cf6',
    },
    { label: 'Orders issued', value: orders.length, color: '#0891b2' },
    { label: 'Goods receipts', value: receipts.length, color: '#f59e0b' },
    {
      label: 'Invoices paid',
      value: invoices.filter((row) => row.status === 'paid').length,
      color: '#10b981',
    },
  ];
  const maxPipeline = Math.max(1, ...pipeline.map((item) => item.value));
  const financial = [
    {
      label: 'PO committed',
      value: orders.reduce((total, row) => total + row.totalAmount, 0),
      color: '#2563eb',
    },
    {
      label: 'Invoiced',
      value: invoices.reduce((total, row) => total + row.totalAmount, 0),
      color: '#8b5cf6',
    },
    {
      label: 'Paid',
      value: invoices
        .filter((row) => row.status === 'paid')
        .reduce((total, row) => total + row.totalAmount, 0),
      color: '#10b981',
    },
  ];
  const maxFinancial = Math.max(1, ...financial.map((item) => item.value));
  const metrics: Array<{
    icon: React.ElementType;
    title: string;
    value: string | number;
    detail: string;
    surface: string;
    foreground: string;
  }> = [
    {
      icon: ShoppingCart,
      title: 'Awaiting approval',
      value: awaitingApproval,
      detail: 'Requisitions requiring a decision',
      surface: 'bg-blue-50',
      foreground: 'text-blue-700',
    },
    {
      icon: FileText,
      title: 'Open competitions',
      value: openCompetitions,
      detail: 'RFQs collecting or evaluating quotes',
      surface: 'bg-violet-50',
      foreground: 'text-violet-700',
    },
    {
      icon: Truck,
      title: 'Pending deliveries',
      value: outstandingDeliveries,
      detail: 'Orders not yet fully accepted',
      surface: 'bg-amber-50',
      foreground: 'text-amber-700',
    },
    {
      icon: CircleDollarSign,
      title: 'Payable exposure',
      value: money(payableExposure),
      detail: `${unpaidInvoices.length} unsettled invoices`,
      surface: 'bg-emerald-50',
      foreground: 'text-emerald-700',
    },
  ];

  return (
    <section aria-label="Procurement operational analytics" className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {metrics.map(({ icon: MetricIcon, title, value, detail, surface, foreground }) => {
          return (
            <article
              key={String(title)}
              className="rounded-2xl border border-slate-200 bg-white p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-medium text-slate-500">{title}</p>
                  <p className="mt-2 text-2xl font-black tracking-tight text-slate-900">{value}</p>
                </div>
                <span
                  className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${surface} ${foreground}`}
                >
                  <MetricIcon className="h-5 w-5" />
                </span>
              </div>
              <p className="mt-3 text-[11px] leading-5 text-slate-500">{detail}</p>
            </article>
          );
        })}
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.45fr)_minmax(300px,1fr)]">
        <article className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
          <h2 className="text-sm font-bold text-slate-900">Procure-to-pay pipeline</h2>
          <p className="mt-1 text-xs text-slate-500">
            Live document volume across governed workflow milestones
          </p>
          <div className="mt-5 space-y-3">
            {pipeline.map((item) => (
              <div
                key={item.label}
                className="grid grid-cols-[100px_minmax(0,1fr)_32px] items-center gap-3 text-xs"
              >
                <span className="font-medium text-slate-600">{item.label}</span>
                <svg
                  viewBox="0 0 100 10"
                  className="h-2.5 w-full overflow-hidden rounded-full"
                  role="img"
                  aria-label={`${item.label}: ${item.value}`}
                >
                  <rect width="100" height="10" rx="5" fill="#f1f5f9" />
                  <rect
                    width={(item.value / maxPipeline) * 100}
                    height="10"
                    rx="5"
                    fill={item.color}
                    className="transition-opacity hover:opacity-75"
                  >
                    <title>{`${item.label}: ${item.value}`}</title>
                  </rect>
                </svg>
                <strong className="text-right text-slate-900">{item.value}</strong>
              </div>
            ))}
          </div>
          <div className="mt-5 grid gap-3 border-t border-slate-100 pt-4 sm:grid-cols-2">
            <HealthSignal
              icon={<ShieldCheck className="h-4 w-4" />}
              label="Supplier readiness"
              value={supplierReadiness}
              detail={`${approvedSuppliers} of ${vendors.length} approved`}
            />
            <HealthSignal
              icon={<ClipboardCheck className="h-4 w-4" />}
              label="Goods acceptance"
              value={acceptanceRate}
              detail={`${acceptedQuantity} of ${inspectedQuantity} inspected units`}
            />
          </div>
        </article>

        <article className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
          <h2 className="text-sm font-bold text-slate-900">Financial progression</h2>
          <p className="mt-1 text-xs text-slate-500">
            Committed, invoiced and settled value from live records
          </p>
          {financial.some((item) => item.value > 0) ? (
            <svg
              viewBox="0 0 420 220"
              className="mt-4 h-56 w-full"
              role="img"
              aria-label="Procurement financial progression"
            >
              {[0.25, 0.5, 0.75, 1].map((ratio) => (
                <line
                  key={ratio}
                  x1="30"
                  x2="400"
                  y1={180 - ratio * 145}
                  y2={180 - ratio * 145}
                  stroke="#e2e8f0"
                  strokeDasharray="4 6"
                />
              ))}
              {financial.map((item, index) => {
                const height = (item.value / maxFinancial) * 140;
                const x = 68 + index * 120;
                return (
                  <g key={item.label} className="transition-opacity hover:opacity-75">
                    <rect
                      x={x}
                      y={180 - height}
                      width="64"
                      height={height}
                      rx="10"
                      fill={item.color}
                    >
                      <title>{`${item.label}: ${money(item.value)}`}</title>
                    </rect>
                    <text x={x + 32} y="202" textAnchor="middle" fontSize="10" fill="#64748b">
                      {item.label}
                    </text>
                    <text
                      x={x + 32}
                      y={Math.max(24, 172 - height)}
                      textAnchor="middle"
                      fontSize="10"
                      fontWeight="700"
                      fill="#334155"
                    >
                      {compactMoney(item.value)}
                    </text>
                  </g>
                );
              })}
            </svg>
          ) : (
            <div className="mt-5 flex h-56 items-center justify-center rounded-xl bg-slate-50 px-6 text-center text-xs text-slate-500">
              Financial analytics will appear after the first purchase order is issued.
            </div>
          )}
        </article>
      </div>
    </section>
  );
}

function HealthSignal({
  icon,
  label: signalLabel,
  value,
  detail,
}: {
  icon: ReactNode;
  label: string;
  value: number;
  detail: string;
}) {
  return (
    <div className="rounded-xl bg-slate-50 p-3">
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-2 text-xs font-semibold text-slate-700">
          {icon}
          {signalLabel}
        </span>
        <strong className="text-sm text-slate-900">{value}%</strong>
      </div>
      <svg
        viewBox="0 0 100 7"
        className="mt-2 h-2 w-full overflow-hidden rounded-full"
        role="img"
        aria-label={`${signalLabel}: ${value}%`}
      >
        <rect width="100" height="7" rx="3.5" fill="#e2e8f0" />
        <rect width={value} height="7" rx="3.5" fill="#2563eb" />
      </svg>
      <p className="mt-2 text-[10px] text-slate-500">{detail}</p>
    </div>
  );
}

function compactMoney(value: number) {
  return new Intl.NumberFormat('en-IN', {
    notation: 'compact',
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 1,
  }).format(value);
}

function Field({
  title,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & { title: string }) {
  return (
    <label className="block">
      <span className={label}>{title}</span>
      <input className={input} {...props} />
    </label>
  );
}

function QuoteEvidenceUpload() {
  const { mutation } = useMutation();
  const [files, setFiles] = useState<IViewerFile[]>([]);
  const [url, setUrl] = useState('');
  const upload = async (file: File) => {
    const body = new FormData();
    body.append('file', file);
    const response = await mutation('upload', {
      method: 'POST',
      body,
      isFormData: true,
      dedupe: false,
    });
    const uploaded = response?.results?.data as { url?: string; filename?: string } | undefined;
    if (!uploaded?.url) return false;
    setUrl(uploaded.url);
    setFiles([{ url: uploaded.url, name: uploaded.filename ?? file.name }]);
    return true;
  };
  return (
    <div>
      <input type="hidden" name="attachmentUrl" value={url} />
      <InlineFileUpload
        label="Supplier quote document"
        files={files}
        onUpload={upload}
        onRemove={async () => {
          setFiles([]);
          setUrl('');
        }}
        hint="Upload the supplier's PDF or quote image"
      />
    </div>
  );
}
function Select({
  title,
  options,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement> & {
  title: string;
  options: { value: string; label: string }[];
}) {
  return (
    <label className="block">
      <span className={label}>{title}</span>
      <select className={input} required {...props}>
        <option value="">Select an option</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}
function Actions({
  loading,
  close,
  label: actionLabel,
}: {
  loading: boolean;
  close: () => void;
  label: string;
}) {
  return (
    <div className="flex justify-end gap-2 pt-2 sm:col-span-full">
      <CustomButton type="button" variant="tertiary" onClick={close}>
        Cancel
      </CustomButton>
      <CustomButton type="submit" variant="primary" loading={loading}>
        {actionLabel}
      </CustomButton>
    </div>
  );
}
