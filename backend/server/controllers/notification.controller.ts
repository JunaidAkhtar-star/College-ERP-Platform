import type { Request, Response, NextFunction } from "express";
import createError from "http-errors";
import { SystemRole } from "../constants/roles";
import { notificationService } from "../services";

export const notificationController = {
  create: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await notificationService.create({
        ...req.body,
        createdBy: req.user?._id.toString() || "",
        createdByName: req.user?.name || "System",
      });
      res.status(201).json({ success: true, data });
    } catch (e) {
      next(e);
    }
  },

  getById: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = req.user!;
      const department = (user as unknown as Record<string, unknown>).department as
        | string
        | undefined;
      const data = await notificationService.getById(
        req.params["id"]!,
        String(user._id),
        req.activeRole ? [String(req.activeRole)] : [],
        department ? String(department) : undefined,
      );
      res.json({ success: true, data });
    } catch (e) {
      next(e);
    }
  },

  listAll: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { page, limit, ...filter } = req.query as Record<string, string>;
      const data = await notificationService.listAll(
        filter,
        Number(page || 1),
        Number(limit || 20),
      );
      res.json({ success: true, ...data });
    } catch (e) {
      next(e);
    }
  },

  getForCurrentUser: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { page, limit } = req.query as Record<string, string>;
      const userId = req.user?._id.toString() || "";
      const roles = req.activeRole ? [String(req.activeRole)] : [];
      const department = (req.user as unknown as Record<string, unknown>).department as
        | string
        | undefined;
      const data = await notificationService.getForUser(
        userId,
        roles,
        department ? String(department) : undefined,
        Number(page || 1),
        Number(limit || 20),
      );
      res.json({ success: true, ...data });
    } catch (e) {
      next(e);
    }
  },

  markRead: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await notificationService.markRead(
        req.params["id"]!,
        req.user?._id.toString() || "",
        req.activeRole ? [String(req.activeRole)] : [],
        String((req.user as unknown as Record<string, unknown>).department ?? "") || undefined,
      );
      res.json({ success: true, data });
    } catch (e) {
      next(e);
    }
  },

  markAllRead: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await notificationService.markAllRead(
        req.user?._id.toString() || "",
        req.activeRole ? [String(req.activeRole)] : [],
        String((req.user as unknown as Record<string, unknown>).department ?? "") || undefined,
      );
      res.json({ success: true, data });
    } catch (e) {
      next(e);
    }
  },

  markAllChatRead: async (req: Request, res: Response, next: NextFunction) => {
    try {
      await notificationService.markAllChatRead(req.user?._id.toString() || "");
      res.json({ success: true });
    } catch (e) {
      next(e);
    }
  },

  update: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await notificationService.update(req.params["id"]!, req.body);
      res.json({ success: true, data });
    } catch (e) {
      next(e);
    }
  },

  deactivate: async (req: Request, res: Response, next: NextFunction) => {
    try {
      await notificationService.deactivate(req.params["id"]!);
      res.json({ success: true, message: "Notification deactivated" });
    } catch (e) {
      next(e);
    }
  },

  getPreferences: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { UserModel } = await import("../models/user.model");
      const user = await UserModel.findById(req.user!._id)
        .select("notificationPreferences")
        .lean()
        .exec();
      res.json({
        success: true,
        data: user?.notificationPreferences ?? {
          email: true,
          inApp: true,
          push: false,
          sms: true,
        },
      });
    } catch (e) {
      next(e);
    }
  },

  updatePreferences: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { UserModel } = await import("../models/user.model");
      const { email, inApp, push, sms } = req.body;
      const currentUser = await UserModel.findById(req.user!._id)
        .select("notificationPreferences.push roles")
        .lean()
        .exec();
      if (push === true) {
        if (currentUser?.notificationPreferences?.push !== true) {
          const isSuperAdmin = currentUser?.roles?.includes(SystemRole.SUPER_ADMIN);
          if (isSuperAdmin) {
            const { platformIntegrationService } =
              await import("../services/platform-integration.service");
            const firebase = (await platformIntegrationService.list()).find(
              (item) => item.provider === "firebase",
            );
            if (!firebase?.enabled || firebase.status !== "healthy" || !firebase.lastSucceededAt)
              throw createError(
                409,
                "Platform Firebase must be enabled and connection-tested before push can be enabled.",
              );
          } else {
            const { platformIntegrationService } =
              await import("../services/platform-integration.service");
            const firebase = (await platformIntegrationService.list()).find(
              (item) => item.provider === "firebase",
            );
            if (!firebase?.enabled || firebase.status !== "healthy" || !firebase.lastSucceededAt)
              throw createError(
                409,
                "Platform Firebase must be enabled and connection-tested before push can be enabled.",
              );
          }
        }
      }
      const preferenceUpdate = Object.fromEntries(
        Object.entries({ email, inApp, push, sms })
          .filter(([, value]) => typeof value === "boolean")
          .map(([key, value]) => [`notificationPreferences.${key}`, value]),
      );
      const updated = await UserModel.findByIdAndUpdate(
        req.user!._id,
        { $set: preferenceUpdate },
        { returnDocument: "after" },
      )
        .select("notificationPreferences")
        .lean()
        .exec();
      res.json({ success: true, data: updated?.notificationPreferences });
    } catch (e) {
      next(e);
    }
  },

  registerFcmToken: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { UserModel } = await import("../models/user.model");
      const { token, platform, deviceId } = req.body as {
        token?: string;
        platform?: "web" | "ios" | "android";
        deviceId?: string;
      };
      if (!token || !platform || !["web", "ios", "android"].includes(platform)) {
        res
          .status(400)
          .json({ success: false, message: "token and platform (web|ios|android) are required" });
        return;
      }
      const registrationId = deviceId?.trim() || token;
      await UserModel.findByIdAndUpdate(req.user!._id, {
        $pull: { fcmTokens: { deviceId: registrationId } },
      }).exec();
      await UserModel.findByIdAndUpdate(
        req.user!._id,
        {
          $set: {
            [`fcmToken.${platform}`]: token,
            "notificationPreferences.push": true,
            "notificationPreferences.inApp": true,
          },
          $push: {
            fcmTokens: { deviceId: registrationId, platform, token, lastSeenAt: new Date() },
          },
        },
        { returnDocument: "before" },
      ).exec();
      res.json({ success: true, message: "FCM token registered" });
    } catch (e) {
      next(e);
    }
  },

  unregisterFcmToken: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { UserModel } = await import("../models/user.model");
      const { platform, deviceId, token } = req.body as {
        platform?: "web" | "ios" | "android";
        deviceId?: string;
        token?: string;
      };
      if (!platform || !["web", "ios", "android"].includes(platform)) {
        res.status(400).json({ success: false, message: "platform (web|ios|android) is required" });
        return;
      }
      await UserModel.findByIdAndUpdate(req.user!._id, {
        $pull: {
          fcmTokens: deviceId?.trim()
            ? { deviceId: deviceId.trim(), platform }
            : token?.trim()
              ? { token: token.trim(), platform }
              : { platform },
        },
        ...(token?.trim() ? { $unset: { [`fcmToken.${platform}`]: "" } } : {}),
      }).exec();
      res.json({ success: true, message: "FCM token unregistered" });
    } catch (e) {
      next(e);
    }
  },
};
