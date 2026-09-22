import type { NextFunction, Request, Response } from "express";
import { Module } from "../constants/permissions";
import { auditLogRepository } from "../repositories/audit-log.repository";
import { procureToPayService } from "../services/procure-to-pay.service";

async function audit(
  req: Request,
  action: string,
  targetModel: string,
  targetId: string,
  description: string,
  metadata?: Record<string, unknown>,
) {
  await auditLogRepository.create({
    user: req.user,
    action,
    module: Module.PROCUREMENT,
    targetModel,
    targetId,
    description,
    metadata,
    reason: typeof req.body.reason === "string" ? req.body.reason : undefined,
    req,
  });
}

const actor = (req: Request) => String(req.user!._id);

export const procureToPayController = {
  async listVendors(req: Request, res: Response, next: NextFunction) {
    try {
      const filter = req.query.status ? { status: req.query.status } : {};
      res.json({ success: true, data: await procureToPayService.listVendors(filter) });
    } catch (error) {
      next(error);
    }
  },
  async createVendor(req: Request, res: Response, next: NextFunction) {
    try {
      const row = await procureToPayService.createVendor(req.body, actor(req));
      await audit(
        req,
        "PROCUREMENT_VENDOR_CREATED",
        "ProcurementVendor",
        String(row._id),
        "Created vendor",
        {
          vendorNumber: row.vendorNumber,
          legalName: row.legalName,
        },
      );
      res.status(201).json({ success: true, data: row });
    } catch (error) {
      next(error);
    }
  },
  async submitVendor(req: Request, res: Response, next: NextFunction) {
    try {
      const row = await procureToPayService.submitVendor(req.params.id, actor(req));
      await audit(
        req,
        "PROCUREMENT_VENDOR_SUBMITTED",
        "ProcurementVendor",
        req.params.id,
        "Submitted vendor for approval",
      );
      res.json({ success: true, data: row });
    } catch (error) {
      next(error);
    }
  },
  async decideVendor(req: Request, res: Response, next: NextFunction) {
    try {
      const row = await procureToPayService.decideVendor(
        req.params.id,
        req.body.action,
        actor(req),
        req.body.reason,
      );
      await audit(
        req,
        `PROCUREMENT_VENDOR_${String(req.body.action).toUpperCase()}D`,
        "ProcurementVendor",
        req.params.id,
        `${req.body.action === "approve" ? "Approved" : "Suspended"} vendor`,
      );
      res.json({ success: true, data: row });
    } catch (error) {
      next(error);
    }
  },
  async listRfqs(req: Request, res: Response, next: NextFunction) {
    try {
      res.json({ success: true, data: await procureToPayService.listRfqs() });
    } catch (error) {
      next(error);
    }
  },
  async createRfq(req: Request, res: Response, next: NextFunction) {
    try {
      const row = await procureToPayService.createRfq(req.body, actor(req));
      await audit(
        req,
        "PROCUREMENT_RFQ_CREATED",
        "ProcurementRfq",
        String(row._id),
        "Created request for quotation",
        {
          rfqNumber: row.rfqNumber,
          requisitionId: String(row.requisitionId),
        },
      );
      res.status(201).json({ success: true, data: row });
    } catch (error) {
      next(error);
    }
  },
  async addQuote(req: Request, res: Response, next: NextFunction) {
    try {
      const row = await procureToPayService.addQuote(req.params.id, req.body);
      await audit(
        req,
        "PROCUREMENT_QUOTE_RECORDED",
        "ProcurementRfq",
        req.params.id,
        "Recorded vendor quotation",
        {
          quoteNumber: req.body.quoteNumber,
          vendorId: req.body.vendorId,
        },
      );
      res.json({ success: true, data: row });
    } catch (error) {
      next(error);
    }
  },
  async awardRfq(req: Request, res: Response, next: NextFunction) {
    try {
      const row = await procureToPayService.awardRfq(
        req.params.id,
        req.body.quoteNumber,
        req.body.reason,
        actor(req),
      );
      const record = row as { _id: { toString(): string }; poNumber?: string };
      await audit(
        req,
        "PROCUREMENT_RFQ_AWARDED",
        "ProcurementPurchaseOrder",
        String(record._id),
        "Awarded RFQ and issued purchase order",
        {
          rfqId: req.params.id,
          poNumber: record.poNumber,
        },
      );
      res.status(201).json({ success: true, data: row });
    } catch (error) {
      next(error);
    }
  },
  async listPurchaseOrders(req: Request, res: Response, next: NextFunction) {
    try {
      res.json({ success: true, data: await procureToPayService.listPurchaseOrders() });
    } catch (error) {
      next(error);
    }
  },
  async listGoodsReceipts(req: Request, res: Response, next: NextFunction) {
    try {
      const filter = req.query.purchaseOrderId
        ? { purchaseOrderId: req.query.purchaseOrderId }
        : {};
      res.json({ success: true, data: await procureToPayService.listGoodsReceipts(filter) });
    } catch (error) {
      next(error);
    }
  },
  async receiveAndInspect(req: Request, res: Response, next: NextFunction) {
    try {
      const row = await procureToPayService.receiveAndInspect(req.params.id, req.body, actor(req));
      const record = row as { _id: { toString(): string }; grnNumber?: string };
      await audit(
        req,
        "PROCUREMENT_GOODS_INSPECTED",
        "ProcurementGoodsReceipt",
        String(record._id),
        "Received and inspected purchase-order goods",
        {
          purchaseOrderId: req.params.id,
          grnNumber: record.grnNumber,
          accepted: req.body.quantityAccepted,
          rejected: req.body.quantityRejected,
        },
      );
      res.status(201).json({ success: true, data: row });
    } catch (error) {
      next(error);
    }
  },
  async returnRejectedGoods(req: Request, res: Response, next: NextFunction) {
    try {
      const row = await procureToPayService.returnRejectedGoods(
        req.params.id,
        req.body.reason,
        actor(req),
      );
      await audit(
        req,
        "PROCUREMENT_REJECTED_GOODS_RETURNED",
        "ProcurementGoodsReceipt",
        String(row._id),
        "Returned rejected goods to supplier",
        { rejectedQuantity: row.quantityRejected, reason: row.returnReason },
      );
      res.json({ success: true, data: row });
    } catch (error) {
      next(error);
    }
  },
  async listInvoices(req: Request, res: Response, next: NextFunction) {
    try {
      res.json({ success: true, data: await procureToPayService.listInvoices() });
    } catch (error) {
      next(error);
    }
  },
  async submitInvoice(req: Request, res: Response, next: NextFunction) {
    try {
      const row = await procureToPayService.submitInvoice(req.body, actor(req));
      await audit(
        req,
        "PROCUREMENT_INVOICE_SUBMITTED",
        "ProcurementSupplierInvoice",
        String(row._id),
        "Submitted supplier invoice for three-way match",
        {
          invoiceNumber: row.invoiceNumber,
          status: row.status,
          matchVariance: row.matchVariance,
        },
      );
      res.status(201).json({ success: true, data: row });
    } catch (error) {
      next(error);
    }
  },
  async decideInvoice(req: Request, res: Response, next: NextFunction) {
    try {
      const row = await procureToPayService.decideInvoice(
        req.params.id,
        req.body.action,
        actor(req),
        req.body.reason,
      );
      await audit(
        req,
        `PROCUREMENT_INVOICE_${String(req.body.action).toUpperCase()}D`,
        "ProcurementSupplierInvoice",
        req.params.id,
        `${req.body.action === "approve" ? "Approved" : "Rejected"} supplier invoice`,
      );
      res.json({ success: true, data: row });
    } catch (error) {
      next(error);
    }
  },
  async payInvoice(req: Request, res: Response, next: NextFunction) {
    try {
      const row = await procureToPayService.payInvoice(req.params.id, req.body, actor(req));
      await audit(
        req,
        "PROCUREMENT_INVOICE_PAID",
        "ProcurementSupplierInvoice",
        req.params.id,
        "Released supplier payment and posted payable settlement",
        { paymentReference: req.body.paymentReference },
      );
      res.json({ success: true, data: row });
    } catch (error) {
      next(error);
    }
  },
};
