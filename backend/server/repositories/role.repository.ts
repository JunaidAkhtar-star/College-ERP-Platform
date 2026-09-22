import type { MongoFilter } from "../types/mongoose.types";
import type { IRole } from "../models/role.model";
import { RoleModel } from "../models/role.model";
import { buildPaginated, parsePagination } from "../utils/pagination.util";

export const roleRepository = {
  async paginate(filter: MongoFilter<IRole>, query: Record<string, unknown>) {
    const { page, limit } = parsePagination(query);

    const [data, total] = await Promise.all([
      RoleModel.find(filter)
        .sort({ isSystem: -1, displayName: 1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean()
        .exec(),
      RoleModel.countDocuments(filter),
    ]);

    return buildPaginated(data, total, page, limit);
  },

  create: (data: Record<string, unknown>) => RoleModel.create(data),

  findById: (id: string) => RoleModel.findById(id).lean().exec(),

  findByName: (name: string) => RoleModel.findOne({ name: name.toLowerCase() }).lean().exec(),

  findAssignedById: (id: string, assignedIds: import("mongoose").Types.ObjectId[]) =>
    RoleModel.findOne({ _id: id, isActive: true, $and: [{ _id: { $in: assignedIds } }] })
      .lean()
      .exec(),

  findAssigned: (assignedIds: import("mongoose").Types.ObjectId[]) =>
    RoleModel.find({ _id: { $in: assignedIds }, isActive: true })
      .sort({ displayName: 1 })
      .lean()
      .exec(),

  findAll: (filter: Record<string, unknown> = {}) =>
    RoleModel.find(filter as MongoFilter<IRole>)
      .sort({ isSystem: -1, displayName: 1 })
      .lean()
      .exec(),

  update: (id: string, data: Record<string, unknown>) =>
    RoleModel.findByIdAndUpdate(
      id,
      { $set: data },
      { returnDocument: "after", runValidators: true },
    )
      .lean()
      .exec(),

  delete: (id: string, deletedBy: string) =>
    RoleModel.findByIdAndUpdate(
      id,
      { $set: { isDeleted: true, deletedAt: new Date(), deletedBy, isActive: false } },
      { returnDocument: "after" },
    )
      .lean()
      .exec(),
};
