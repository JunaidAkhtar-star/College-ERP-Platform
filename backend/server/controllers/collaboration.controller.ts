import type { NextFunction, Request, Response } from "express";
import { collaborationService } from "../services/collaboration.service";

const identity = (req: Request) => ({
  id: String(req.user?._id),
  name: req.user?.name || "User",
  roles: [String(req.activeRole)],
  departmentId: req.user?.department?.toString(),
});
export const collaborationController = {
  metadata: async (_req: Request, res: Response, next: NextFunction) => {
    try {
      res.json({ success: true, data: await collaborationService.metadata() });
    } catch (error) {
      next(error);
    }
  },
  posts: async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.json({
        success: true,
        data: await collaborationService.listPosts(
          identity(req),
          ["discussion", "announcement", "poll"].includes(String(req.query["type"]))
            ? (req.query["type"] as "discussion" | "announcement" | "poll")
            : undefined,
        ),
      });
    } catch (error) {
      next(error);
    }
  },
  post: async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.json({
        success: true,
        data: await collaborationService.getPost(String(req.params["id"]), identity(req)),
      });
    } catch (error) {
      next(error);
    }
  },
  createPost: async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.status(201).json({
        success: true,
        data: await collaborationService.createPost(req.body, identity(req)),
      });
    } catch (error) {
      next(error);
    }
  },
  managePost: async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.json({
        success: true,
        data: await collaborationService.managePost(
          String(req.params["id"]),
          req.body,
          identity(req),
        ),
      });
    } catch (error) {
      next(error);
    }
  },
  reply: async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.status(201).json({
        success: true,
        data: await collaborationService.reply(String(req.params["id"]), req.body, identity(req)),
      });
    } catch (error) {
      next(error);
    }
  },
  vote: async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.status(201).json({
        success: true,
        data: await collaborationService.vote(
          String(req.params["id"]),
          req.body.optionIds,
          identity(req),
        ),
      });
    } catch (error) {
      next(error);
    }
  },
  albums: async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.json({ success: true, data: await collaborationService.listAlbums(identity(req)) });
    } catch (error) {
      next(error);
    }
  },
  createAlbum: async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.status(201).json({
        success: true,
        data: await collaborationService.createAlbum(req.body, identity(req)),
      });
    } catch (error) {
      next(error);
    }
  },
  album: async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.json({
        success: true,
        data: await collaborationService.getAlbum(String(req.params["id"]), identity(req)),
      });
    } catch (error) {
      next(error);
    }
  },
  addMedia: async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.status(201).json({
        success: true,
        data: await collaborationService.addMedia(
          String(req.params["id"]),
          req.body,
          identity(req),
        ),
      });
    } catch (error) {
      next(error);
    }
  },
};
