/**
 * @file erp-assistant.controller.ts
 * @description Controller for ERP AI Assistant endpoint. Delegates business logic
 * to erpAssistantService.
 */

import type { Request, Response, NextFunction } from "express";
import { randomUUID } from "crypto";
import { erpAssistantService } from "../services/erp-assistant.service";
import { logger } from "../utils/logger.util";

async function persistHistorySafely(
  userId: string,
  input: Parameters<typeof erpAssistantService.recordHistory>[1],
  output: Parameters<typeof erpAssistantService.recordHistory>[2],
  requestId?: string,
): Promise<void> {
  try {
    await erpAssistantService.recordHistory(userId, input, output);
  } catch (error) {
    logger.warn("ERP assistant history could not be saved", {
      requestId,
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
}

export const erpAssistantController = {
  async history(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await erpAssistantService.listHistory(String(req.user?._id));
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  },

  async clearHistory(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const deleted = await erpAssistantService.clearHistory(String(req.user?._id));
      res.json({ success: true, data: { deleted } });
    } catch (error) {
      next(error);
    }
  },

  async deleteConversation(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const deleted = await erpAssistantService.deleteConversation(
        String(req.user?._id),
        String(req.params.conversationId),
      );
      res.json({ success: true, data: { deleted } });
    } catch (error) {
      next(error);
    }
  },

  async ask(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const {
        question,
        conversationId,
        history = [],
        context,
      } = req.body as {
        question: string;
        conversationId?: string;
        history?: Array<{ role: "user" | "model"; text: string }>;
        context?: {
          currentPath?: string;
          visibleModules?: Array<{ label: string; path: string; group?: string }>;
        };
      };

      const input = {
        question,
        conversationId,
        userRoles: req.activeRole ? [String(req.activeRole)] : [],
        history,
        context,
      };
      const result = await erpAssistantService.askQuestion(input);
      await persistHistorySafely(String(req.user?._id), input, result);

      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  },

  async askStream(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const requestId = randomUUID();
      const startedAt = Date.now();
      const {
        question,
        conversationId,
        history = [],
        context,
      } = req.body as {
        question: string;
        conversationId?: string;
        history?: Array<{ role: "user" | "model"; text: string }>;
        context?: {
          currentPath?: string;
          visibleModules?: Array<{ label: string; path: string; group?: string }>;
        };
      };

      // Set SSE headers
      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");
      res.setHeader("X-Accel-Buffering", "no");
      res.flushHeaders();

      let fullAnswer = "";
      let mentionedModules: string[] = [];
      let webSources: Array<{ title: string; uri: string }> = [];

      const sendSSE = (event: string, data: unknown) => {
        const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
        res.write(payload);
        (res as Response & { flush?: () => void }).flush?.();
      };

      try {
        sendSSE("status", {
          stage: "connected",
          message: "Connecting to Gemini AI…",
          requestId,
        });
        const input = {
          question,
          conversationId,
          userRoles: req.activeRole ? [String(req.activeRole)] : [],
          history,
          context,
        };
        const result = await erpAssistantService.askQuestionStream(
          input,
          (chunk) => {
            fullAnswer += chunk;
            sendSSE("chunk", { text: chunk });
          },
          (status) => {
            sendSSE("status", { ...status, requestId });
          },
        );

        await persistHistorySafely(String(req.user?._id), input, result, requestId);

        mentionedModules = result.mentionedModules;
        webSources = result.webSources ?? [];
        sendSSE("done", { answer: fullAnswer, mentionedModules, webSources, requestId });
        logger.info("ERP assistant stream completed", {
          requestId,
          durationMs: Date.now() - startedAt,
          outputCharacters: fullAnswer.length,
        });
      } catch (streamError) {
        logger.warn("ERP assistant stream failed", {
          requestId,
          durationMs: Date.now() - startedAt,
          error: streamError instanceof Error ? streamError.message : "Unknown error",
        });
        const errorMsg = streamError instanceof Error ? streamError.message : String(streamError);
        const isRateLimit =
          /(?:429|resource_exhausted|quota|rate limit|too many requests|overloaded)/i.test(
            errorMsg,
          );
        sendSSE("error", {
          message: isRateLimit
            ? "The AI assistant is experiencing high demand right now due to rate limits. Please wait 15-30 seconds and try again."
            : "Live assistant generation failed. Please try again.",
          requestId,
        });
      }

      res.end();
    } catch (error) {
      next(error);
    }
  },
};
