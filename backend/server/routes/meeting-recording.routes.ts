import { Router } from "express";
import { body, param } from "express-validator";
import { authenticate, validate } from "../middlewares";
import { meetingRecordingService } from "../services/meeting-recording.service";

const router = Router();
router.use(authenticate);
const meetingId = param("meetingId").isMongoId().withMessage("Invalid meeting ID");

router.get("/meeting/:meetingId", meetingId, validate, async (req, res, next) => {
  try {
    res.json({
      success: true,
      data: await meetingRecordingService.list(req.params.meetingId, String(req.user!._id)),
    });
  } catch (error) {
    next(error);
  }
});
router.post("/meeting/:meetingId/signature", meetingId, validate, async (req, res, next) => {
  try {
    res.json({
      success: true,
      data: await meetingRecordingService.signature(req.params.meetingId, String(req.user!._id)),
    });
  } catch (error) {
    next(error);
  }
});
router.post(
  "/meeting/:meetingId",
  meetingId,
  body("publicId").isString().notEmpty(),
  body("title").optional().isString().isLength({ max: 200 }),
  validate,
  async (req, res, next) => {
    try {
      res.status(201).json({
        success: true,
        data: await meetingRecordingService.register(
          req.params.meetingId,
          String(req.user!._id),
          req.body,
        ),
        message: "Recording stored securely.",
      });
    } catch (error) {
      next(error);
    }
  },
);
router.delete("/:id", param("id").isMongoId(), validate, async (req, res, next) => {
  try {
    res.json({
      success: true,
      data: await meetingRecordingService.remove(req.params.id, String(req.user!._id)),
      message: "Recording deleted.",
    });
  } catch (error) {
    next(error);
  }
});

export default router;
