import { StudyMaterialAccessModel, StudyMaterialModel } from "../models";
import { StudyMaterialStatus } from "../models/study-material.model";

export const studyMaterialRepository = {
  findById: (id: string) => StudyMaterialModel.findById(id).lean(),

  create: (data: Record<string, unknown>) => StudyMaterialModel.create(data),

  updateDraft: (id: string, data: Record<string, unknown>, uploadedBy?: string) =>
    StudyMaterialModel.findOneAndUpdate(
      {
        _id: id,
        status: StudyMaterialStatus.DRAFT,
        ...(uploadedBy ? { uploadedBy } : {}),
      },
      { $set: data },
      { returnDocument: "after", runValidators: true },
    ).lean(),

  publish: async (id: string, uploadedBy?: string) => {
    const session = await StudyMaterialModel.db.startSession();
    try {
      let published: {
        _id: unknown;
        uploadedBy: unknown;
        replacesMaterialId?: unknown;
      } | null = null;
      await session.withTransaction(async () => {
        published = await StudyMaterialModel.findOneAndUpdate(
          {
            _id: id,
            status: StudyMaterialStatus.DRAFT,
            ...(uploadedBy ? { uploadedBy } : {}),
          },
          {
            $set: {
              status: StudyMaterialStatus.PUBLISHED,
              isActive: true,
              publishedAt: new Date(),
            },
          },
          { returnDocument: "after", runValidators: true, session },
        ).lean();
        if (!published?.replacesMaterialId) return;
        const predecessor = await StudyMaterialModel.updateOne(
          {
            _id: published.replacesMaterialId,
            status: StudyMaterialStatus.PUBLISHED,
            replacedByMaterialId: { $exists: false },
          },
          {
            $set: {
              status: StudyMaterialStatus.ARCHIVED,
              isActive: false,
              archivedAt: new Date(),
              archivedBy: published.uploadedBy,
              replacedByMaterialId: published._id,
            },
          },
          { session },
        );
        if (predecessor.modifiedCount !== 1)
          throw new Error("The previous material version is no longer publishable");
      });
      return published as {
        _id: unknown;
        uploadedBy: unknown;
        replacesMaterialId?: unknown;
      } | null;
    } finally {
      await session.endSession();
    }
  },

  archive: (id: string, archivedBy: string, uploadedBy?: string) =>
    StudyMaterialModel.findOneAndUpdate(
      {
        _id: id,
        status: { $in: [StudyMaterialStatus.DRAFT, StudyMaterialStatus.PUBLISHED] },
        ...(uploadedBy ? { uploadedBy } : {}),
      },
      {
        $set: {
          status: StudyMaterialStatus.ARCHIVED,
          isActive: false,
          archivedAt: new Date(),
          archivedBy,
        },
      },
      { returnDocument: "after", runValidators: true },
    ).lean(),

  deleteUnusedDraft: (id: string, uploadedBy?: string) =>
    StudyMaterialModel.findOneAndDelete({
      _id: id,
      status: StudyMaterialStatus.DRAFT,
      viewCount: 0,
      downloadCount: 0,
      ...(uploadedBy ? { uploadedBy } : {}),
    }).lean(),

  list: async (filter: Record<string, unknown>, page = 1, limit = 20) => {
    const skip = (page - 1) * limit;
    const [data, total] = await Promise.all([
      StudyMaterialModel.find(filter)
        .populate("subjectId", "name code")
        .populate("sectionIds", "sectionName semesterNo academicYear")
        .populate("uploadedBy", "name email")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      StudyMaterialModel.countDocuments(filter),
    ]);
    return { data, total, page, limit, pages: Math.ceil(total / limit) };
  },

  recordAccess: async (
    id: string,
    userId: string,
    accessType: "view" | "download",
    accessDate: string,
  ) => {
    const session = await StudyMaterialAccessModel.db.startSession();
    try {
      await session.withTransaction(async () => {
        await StudyMaterialAccessModel.create(
          [{ materialId: id, userId, accessType, accessDate }],
          { session },
        );
        const counterUpdate = await StudyMaterialModel.updateOne(
          { _id: id },
          { $inc: { [accessType === "view" ? "viewCount" : "downloadCount"]: 1 } },
          { session },
        );
        if (counterUpdate.modifiedCount !== 1) throw new Error("Study material not found");
      });
    } catch (error) {
      if ((error as { code?: number }).code === 11000) return false;
      throw error;
    } finally {
      await session.endSession();
    }
    return true;
  },
};
