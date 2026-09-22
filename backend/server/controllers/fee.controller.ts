import type { Request, Response, NextFunction } from "express";
import createError from "http-errors";
import { SystemRole } from "../constants/roles";
import { feeService } from "../services";
import { formatIndiaDate } from "../utils/date.util";
import { nextSeq } from "../models/counter.model";

function assertFeeStudentAccess(req: Request, studentId: string) {
  if (req.activeRole === SystemRole.STUDENT && studentId !== req.user?._id.toString()) {
    throw createError(403, "Students can access only their own fee records");
  }
}

export const feeController = {
  // Fee Structures
  createStructure: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const structure = await feeService.createStructure(req.body, req.user?._id.toString() || "");
      res.status(201).json({ success: true, data: structure });
    } catch (e) {
      next(e);
    }
  },

  getStructures: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await feeService.getStructures(req.query);
      res.json({ success: true, data });
    } catch (e) {
      next(e);
    }
  },

  getStructure: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { program, branch, semester, academicYear, category } = req.query as Record<
        string,
        string
      >;
      const data = await feeService.getStructure(
        program,
        branch,
        Number(semester),
        academicYear,
        category,
      );
      res.json({ success: true, data });
    } catch (e) {
      next(e);
    }
  },

  // Fee Records / Invoices
  previewInvoice: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await feeService.previewInvoice(req.body);
      res.json({ success: true, data });
    } catch (e) {
      next(e);
    }
  },

  generateInvoice: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { record, invoicePdf } = await feeService.generateInvoice({
        ...req.body,
        createdBy: req.user?._id.toString() || "system",
      });
      res.status(201).json({
        success: true,
        data: record,
        invoiceBase64: invoicePdf ? invoicePdf.toString("base64") : null,
      });
    } catch (e) {
      next(e);
    }
  },

  recordPayment: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { recordId } = req.params;
      const result = await feeService.recordPayment({
        ...req.body,
        feeRecordId: recordId!,
        collectedBy: req.user?._id.toString() || "system",
        collectedByName: req.user?.name || "System",
      });
      res.json({ success: true, data: result });
    } catch (e) {
      next(e);
    }
  },

  getRecord: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await feeService.getRecordById(req.params["id"]!);
      assertFeeStudentAccess(req, data.studentId.toString());
      res.json({ success: true, data });
    } catch (e) {
      next(e);
    }
  },

  listRecords: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { page, limit, ...filter } = req.query as Record<string, string>;
      const data = await feeService.listRecords(filter, Number(page || 1), Number(limit || 20));
      res.json({ success: true, ...data });
    } catch (e) {
      next(e);
    }
  },

  getByStudent: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const studentId = req.params["studentId"]!;
      assertFeeStudentAccess(req, studentId);
      const data = await feeService.getByStudent(studentId);
      res.json({ success: true, data });
    } catch (e) {
      next(e);
    }
  },

  getCollectionSummary: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { academicYear } = req.query as Record<string, string>;
      const data = await feeService.getCollectionSummary(academicYear);
      res.json({ success: true, data });
    } catch (e) {
      next(e);
    }
  },

  getOverdueFees: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await feeService.getOverdueFees();
      res.json({ success: true, data });
    } catch (e) {
      next(e);
    }
  },

  generateBonafide: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const seq = await nextSeq("document:bonafide");
      const pdf = await feeService.generateBonafide(
        {
          ...req.body,
          issuedDate: formatIndiaDate(new Date()),
        },
        seq,
      );
      res.set("Content-Type", "application/pdf");
      res.set("Content-Disposition", "inline; filename=bonafide.pdf");
      res.send(pdf);
    } catch (e) {
      next(e);
    }
  },

  generateTC: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const seq = await nextSeq("document:transfer-certificate");
      const pdf = await feeService.generateTC(
        {
          ...req.body,
          issuedDate: formatIndiaDate(new Date()),
        },
        seq,
      );
      res.set("Content-Type", "application/pdf");
      res.set("Content-Disposition", "inline; filename=transfer-certificate.pdf");
      res.send(pdf);
    } catch (e) {
      next(e);
    }
  },
};
