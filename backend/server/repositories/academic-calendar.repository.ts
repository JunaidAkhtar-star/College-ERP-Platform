import { AcademicCalendarModel } from "../models";

export const academicCalendarRepository = {
  findById: (id: string) => AcademicCalendarModel.findById(id).lean(),

  findByYear: (academicYear: string, semesterType: "odd" | "even") =>
    AcademicCalendarModel.findOne({ academicYear, semesterType }).lean(),

  create: (data: Record<string, unknown>) => AcademicCalendarModel.create(data),

  updateById: (id: string, data: Record<string, unknown>) =>
    AcademicCalendarModel.findOneAndUpdate(
      { _id: id, isPublished: false },
      { $set: data },
      { returnDocument: "after", runValidators: true },
    ).lean(),

  publish: (id: string, publishedBy: string) =>
    AcademicCalendarModel.findOneAndUpdate(
      { _id: id, isPublished: false, createdBy: { $ne: publishedBy } },
      { $set: { isPublished: true, publishedAt: new Date(), publishedBy, updatedBy: publishedBy } },
      { returnDocument: "after" },
    ).lean(),

  list: async (filter: Record<string, unknown>, page = 1, limit = 10) => {
    const skip = (page - 1) * limit;
    const [data, total] = await Promise.all([
      AcademicCalendarModel.find(filter).sort({ academicYear: -1 }).skip(skip).limit(limit).lean(),
      AcademicCalendarModel.countDocuments(filter),
    ]);
    return { data, total, page, limit, pages: Math.ceil(total / limit) };
  },
};
