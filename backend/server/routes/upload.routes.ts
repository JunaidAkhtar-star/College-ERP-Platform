import type { Request, Response, NextFunction } from "express";
import { Router } from "express";
import type { UploadedFile } from "express-fileupload";
import { authenticate } from "../middlewares";
import { uploadUtil } from "../utils/upload.util";

const router = Router();

/**
 * POST /api/v1/upload
 * Generic authenticated file upload to Cloudinary.
 * Form field: "file" (single file, max 5 MB — see fileUpload config in server.ts).
 * Used by chat attachments, generic content uploads.
 */
router.post("/", authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const file = req.files?.file as UploadedFile | undefined;
    if (!file) {
      res.status(400).json({ success: false, error: { message: 'File field "file" is required' } });
      return;
    }
    const result = await uploadUtil.uploadDocument(file, "erp/uploads");
    res.json({
      success: true,
      data: { url: result.url, filename: file.name, publicId: result.publicId },
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/v1/upload/chat
 * Governed chat attachment upload — PDF/image formats up to 25 MB with
 * extension, MIME, and magic-byte validation.
 */
router.post("/chat", authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const file = req.files?.file as UploadedFile | undefined;
    if (!file) {
      res.status(400).json({ success: false, error: { message: 'File field "file" is required' } });
      return;
    }
    const result = await uploadUtil.uploadChatAttachment(file);
    res.json({
      success: true,
      data: {
        url: result.url,
        filename: file.name,
        mimetype: file.mimetype,
        size: file.size,
        publicId: result.publicId,
      },
    });
  } catch (err) {
    next(err);
  }
});

export default router;
