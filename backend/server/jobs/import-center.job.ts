import { ImportJobModel } from "../models/import-center.model";
import { importCenterService } from "../services/import-center.service";
import { registerJobHandler } from "../services/job-queue.service";

registerJobHandler("import-center.commit", {
  async run(payload) {
    await importCenterService.commit(String(payload.importJobId), String(payload.userId));
  },
  async onDead(payload, error) {
    await ImportJobModel.updateOne(
      { _id: String(payload.importJobId), status: { $in: ["queued", "committing"] } },
      { $set: { status: "failed" }, $push: { rowErrors: { row: 0, message: error } } },
    );
  },
});
