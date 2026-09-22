import { once } from "events";
import type { NextFunction, Request, Response } from "express";
import { dataPortabilityService } from "../services/data-portability.service";
import { SystemRole } from "../constants/roles";

async function write(res: Response, chunk: string) {
  if (!res.write(chunk)) await once(res, "drain");
}

export const dataPortabilityController = {
  metadata: (_req: Request, res: Response) =>
    res.json({ success: true, data: dataPortabilityService.metadata() }),
  list: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const includeAll = [SystemRole.SUPER_ADMIN, SystemRole.PRINCIPAL].includes(
        req.activeRole as SystemRole,
      );
      res.json({
        success: true,
        data: await dataPortabilityService.list(String(req.user?._id), includeAll),
      });
    } catch (error) {
      next(error);
    }
  },
  decide: async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.json({
        success: true,
        data: await dataPortabilityService.decide(
          req.params.id,
          req.body.action,
          String(req.user?._id),
          req.body.reason,
        ),
      });
    } catch (error) {
      next(error);
    }
  },
  cancel: async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.json({
        success: true,
        data: await dataPortabilityService.cancelAndVerifyDeletion(
          req.params.id,
          String(req.user?._id),
          req.body.reason,
          [SystemRole.SUPER_ADMIN, SystemRole.PRINCIPAL].includes(req.activeRole as SystemRole),
        ),
      });
    } catch (error) {
      next(error);
    }
  },
  create: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await dataPortabilityService.create(req.body, {
        id: String(req.user?._id),
        name: req.user?.name || "Administrator",
      });
      res.status(201).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  },
  download: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const job = await dataPortabilityService.getDownload(
        String(req.params["id"]),
        String(req.user?._id),
      );
      res.setHeader(
        "Content-Type",
        job.format === "ndjson" ? "application/x-ndjson" : "application/json",
      );
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${job.exportNumber}.${job.format}"`,
      );
      res.setHeader("Cache-Control", "private, no-store");
      const filters = {
        from: job.filters.from?.toISOString(),
        to: job.filters.to?.toISOString(),
        academicYear: job.filters.academicYear,
      };
      const manifest = {
        exportNumber: job.exportNumber,
        generatedAt: new Date().toISOString(),
        requestedBy: job.requestedByName,
        datasets: job.datasets,
        counts: job.counts,
        filters,
        artifactHash: job.artifactHash,
        artifactGeneratedAt: job.artifactGeneratedAt,
      };
      if (job.format === "ndjson") {
        await write(res, `${JSON.stringify({ type: "manifest", data: manifest })}\n`);
        for await (const chunk of dataPortabilityService.streamArtifact(job._id.toString())) {
          for (const row of chunk.rows) {
            const dataset = chunk.dataset;
            await write(res, `${JSON.stringify({ type: "record", dataset, data: row })}\n`);
          }
        }
      } else {
        await write(res, `{"manifest":${JSON.stringify(manifest)},"data":{`);
        let pendingChunk: { dataset: string; rows: Record<string, unknown>[] } | undefined;
        const artifact = dataPortabilityService.streamArtifact(job._id.toString());
        let cursor = await artifact.next();
        pendingChunk = cursor.done ? undefined : cursor.value;
        for (const [datasetIndex, dataset] of job.datasets.entries()) {
          if (datasetIndex > 0) await write(res, ",");
          await write(res, `${JSON.stringify(dataset)}:[`);
          let rowIndex = 0;
          while (pendingChunk?.dataset === dataset) {
            for (const row of pendingChunk.rows) {
              if (rowIndex > 0) await write(res, ",");
              await write(res, JSON.stringify(row));
              rowIndex += 1;
            }
            cursor = await artifact.next();
            pendingChunk = cursor.done ? undefined : cursor.value;
          }
          await write(res, "]");
        }
        await write(res, "}}");
      }
      res.end();
      void dataPortabilityService.markDownloaded(job._id.toString());
    } catch (error) {
      if (res.headersSent) {
        res.destroy(error instanceof Error ? error : undefined);
        return;
      }
      next(error);
    }
  },
  listDsars: async (_req: Request, res: Response, next: NextFunction) => {
    try {
      res.json({ success: true, data: await dataPortabilityService.listDsars() });
    } catch (error) {
      next(error);
    }
  },
  createDsar: async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.status(201).json({
        success: true,
        data: await dataPortabilityService.createDsar(req.body, String(req.user?._id)),
      });
    } catch (error) {
      next(error);
    }
  },
  decideDsar: async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.json({
        success: true,
        data: await dataPortabilityService.decideDsar(
          req.params.id,
          req.body.status,
          String(req.user?._id),
          req.body.resolution,
        ),
      });
    } catch (error) {
      next(error);
    }
  },
  listHolds: async (_req: Request, res: Response, next: NextFunction) => {
    try {
      res.json({ success: true, data: await dataPortabilityService.listLegalHolds() });
    } catch (error) {
      next(error);
    }
  },
  createHold: async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.status(201).json({
        success: true,
        data: await dataPortabilityService.createLegalHold(req.body, String(req.user?._id)),
      });
    } catch (error) {
      next(error);
    }
  },
  releaseHold: async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.json({
        success: true,
        data: await dataPortabilityService.releaseLegalHold(
          req.params.id,
          String(req.user?._id),
          req.body.reason,
        ),
      });
    } catch (error) {
      next(error);
    }
  },
  complianceSummary: async (_req: Request, res: Response, next: NextFunction) => {
    try {
      res.json({ success: true, data: await dataPortabilityService.complianceSummary() });
    } catch (error) {
      next(error);
    }
  },
};
