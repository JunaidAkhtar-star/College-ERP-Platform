import type { MongoFilter } from "../types/mongoose.types";
import { DocumentModel, DocumentStatus, type IDocument } from "../models/document.model";

export const documentRepository = {
  create: (data: Record<string, unknown>) => DocumentModel.create(data),

  findById: (id: string) => DocumentModel.findById(id).lean().exec(),

  findByOwner: (ownerId: string, type?: string, limit = 200) => {
    const filter: Record<string, unknown> = { owner: ownerId };
    if (type) filter.type = type;
    return DocumentModel.find(filter).sort({ createdAt: -1 }).limit(limit).lean().exec();
  },

  updateStatus: (
    id: string,
    currentStatuses: DocumentStatus[],
    status: DocumentStatus,
    verifiedBy?: string,
    rejectionReason?: string,
  ) =>
    DocumentModel.findOneAndUpdate(
      { _id: id, status: { $in: currentStatuses } },
      {
        $set: {
          status,
          ...(verifiedBy ? { verifiedBy, verifiedAt: new Date() } : {}),
          ...(rejectionReason ? { rejectionReason } : {}),
        },
        $unset: verifiedBy
          ? { rejectionReason: 1 }
          : rejectionReason
            ? { verifiedBy: 1, verifiedAt: 1 }
            : {},
      },
      { returnDocument: "after", runValidators: true },
    )
      .lean()
      .exec(),

  addVersion: (id: string, version: Record<string, unknown>) =>
    DocumentModel.findOneAndUpdate(
      { _id: id, status: { $in: [DocumentStatus.REJECTED, DocumentStatus.EXPIRED] } },
      {
        $push: { versions: version },
        $set: {
          url: version.url,
          publicId: version.publicId,
          fileSize: version.fileSize,
          format: version.format,
          status: DocumentStatus.PENDING,
        },
        $unset: { verifiedBy: 1, verifiedAt: 1, rejectionReason: 1 },
      },
      { returnDocument: "after", runValidators: true },
    )
      .lean()
      .exec(),

  paginate: (filter: Record<string, unknown>, page = 1, limit = 20) => {
    const [skip] = [(page - 1) * limit];
    return Promise.all([
      DocumentModel.find(filter as MongoFilter<IDocument>)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean()
        .exec(),
      DocumentModel.countDocuments(filter as MongoFilter<IDocument>),
    ]).then(([data, total]) => ({
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    }));
  },

  findExpiring: (withinDays: number) => {
    const future = new Date(Date.now() + withinDays * 24 * 60 * 60 * 1000);
    return DocumentModel.find({ expiresAt: { $lte: future, $gte: new Date() }, isExpired: false })
      .lean()
      .exec();
  },

  markExpired: () =>
    DocumentModel.updateMany(
      { expiresAt: { $lt: new Date() }, isExpired: false },
      { isExpired: true, status: DocumentStatus.EXPIRED },
    ),
};
