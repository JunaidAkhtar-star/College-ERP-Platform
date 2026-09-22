import type { Types, UpdateQuery } from "mongoose";
import type { MongoFilter } from "../types/mongoose.types";
import { type IUser, UserModel } from "../models/user.model";
import type { PaginationQuery } from "../types";
import { buildPaginated, parsePagination } from "../utils/pagination.util";
import { tenantLocalStorage } from "../configs/connectionManager";
import { TenantModel } from "../models/tenant.model";
import { SystemRole } from "../constants/roles";
import createError from "http-errors";
import { StudentProfileModel, StudentStatus } from "../models/student-profile.model";

/**
 * User Repository — all direct database operations for the User collection.
 * Services must NOT import UserModel directly; they go through this repository.
 */
export const userRepository = {
  async findById(id: string | Types.ObjectId, includePassword = false) {
    const q = UserModel.findById(id).populate("department", "name code").lean();
    if (includePassword) q.select("+password +mfaSecret");
    return q.lean().exec();
  },

  async findByEmail(email: string, includePassword = false) {
    const q = UserModel.findOne({ email: email.toLowerCase().trim() }).lean();
    if (includePassword) q.select("+password +mfaSecret");
    return q.lean().exec();
  },

  /**
   * Resolves a tenant-local login identity without permitting student email login.
   * Students use ERP Student ID or university registration number. Faculty may
   * use Faculty ID or email; other staff accounts retain email/employee-ID login.
   */
  async findByLoginIdentifier(identifier: string, includePassword = false) {
    const normalized = identifier.trim();
    const selectSecrets = <T extends ReturnType<typeof UserModel.findOne>>(query: T): T => {
      if (includePassword) query.select("+password +mfaSecret");
      return query;
    };

    if (normalized.includes("@")) {
      return selectSecrets(UserModel.findOne({ email: normalized.toLowerCase() }))
        .lean()
        .exec();
    }

    const institutionalId = normalized.toUpperCase();
    const directUser = await selectSecrets(
      UserModel.findOne({
        $or: [
          { studentId: institutionalId },
          { facultyId: institutionalId },
          { employeeId: institutionalId },
        ],
      }),
    )
      .lean()
      .exec();
    if (directUser) return directUser;

    const profile = await StudentProfileModel.findOne({ registrationNumber: institutionalId })
      .select("userId")
      .lean()
      .exec();
    if (!profile) return null;
    return selectSecrets(UserModel.findOne({ _id: profile.userId, roles: SystemRole.STUDENT }))
      .lean()
      .exec();
  },

  async findOne(filter: MongoFilter<IUser>, includePassword = false) {
    const q = UserModel.findOne(filter).lean();
    if (includePassword) q.select("+password");
    return q.lean().exec();
  },

  async create(data: Partial<IUser>) {
    const store = tenantLocalStorage.getStore();
    if (store && store.tenantId) {
      const tenantRecord = await TenantModel.findOne({
        tenantId: store.tenantId.toLowerCase(),
      })
        .lean()
        .exec();
      if (tenantRecord) {
        const isStudent = data.roles?.includes(SystemRole.STUDENT);
        const isEmployee = data.roles?.some(
          (role) =>
            role !== SystemRole.STUDENT &&
            role !== SystemRole.PARENT &&
            role !== SystemRole.SUPER_ADMIN,
        );

        if (isStudent && tenantRecord.maxStudents !== undefined) {
          // Count only *truly enrolled* students — users who have a StudentProfile
          // (created at enrollment via seedStudentProfile) with an active student
          // status. This deliberately excludes:
          //   • Pending admission applications (DRAFT/SUBMITTED/APPROVED) — the user
          //     account is created at initiation, but no StudentProfile exists yet.
          //   • Rejected applicants — never enrolled, no StudentProfile.
          //   • Passed-out / transferred / dropped / rusticated students — excluded
          //     via the StudentStatus filter so their seats are freed.
          // The applicant user account stays `status: "active"` so they can log in
          // to the admission portal; only an enrolled StudentProfile consumes a seat.
          const enrolledStudentStatuses: StudentStatus[] = [
            StudentStatus.ACTIVE,
            StudentStatus.DETAINED,
            StudentStatus.LATERAL_PROMOTED,
          ];
          const enrolledStudents = await StudentProfileModel.countDocuments({
            status: { $in: enrolledStudentStatuses },
          }).exec();
          if (enrolledStudents >= tenantRecord.maxStudents) {
            throw createError(
              409,
              `Enrollment limit reached. Maximum students allowed for this tenant: ${tenantRecord.maxStudents}`,
            );
          }
        }

        if (isEmployee && tenantRecord.maxEmployees !== undefined) {
          const nonEmployeeRoles = [SystemRole.STUDENT, SystemRole.PARENT, SystemRole.SUPER_ADMIN];
          const activeEmployees = await UserModel.countDocuments({
            roles: { $elemMatch: { $nin: nonEmployeeRoles } },
            status: "active",
          } as unknown as MongoFilter<IUser>);
          if (activeEmployees >= tenantRecord.maxEmployees) {
            throw createError(
              409,
              `Employee limit reached. Maximum employees allowed for this tenant: ${tenantRecord.maxEmployees}`,
            );
          }
        }
      }
    }

    const user = await UserModel.create(data);
    return user.toObject();
  },

  async updateById(id: string | Types.ObjectId, update: UpdateQuery<IUser>) {
    return UserModel.findByIdAndUpdate(id, update, { returnDocument: "after" }).lean().exec();
  },

  /** Atomically claims one refresh-token rotation so concurrent reloads converge. */
  async rotateSession(
    id: string | Types.ObjectId,
    currentJti: string,
    nextJti: string,
    rotatedAt: Date,
  ) {
    return UserModel.findOneAndUpdate(
      {
        _id: id,
        activeSessions: {
          $elemMatch: { jti: currentJti, rotatedAt: { $exists: false } },
        },
      },
      [
        {
          $set: {
            activeSessions: {
              $concatArrays: [
                {
                  $map: {
                    input: "$activeSessions",
                    as: "session",
                    in: {
                      $cond: [
                        {
                          $and: [
                            { $eq: ["$$session.jti", currentJti] },
                            { $eq: [{ $type: "$$session.rotatedAt" }, "missing"] },
                          ],
                        },
                        {
                          $mergeObjects: ["$$session", { rotatedAt, rotatedToJti: nextJti }],
                        },
                        "$$session",
                      ],
                    },
                  },
                },
                [
                  {
                    jti: nextJti,
                    device: "token_refresh",
                    ip: "",
                    createdAt: rotatedAt,
                  },
                ],
              ],
            },
          },
        },
      ],
      {
        returnDocument: "after",
        updatePipeline: true,
      },
    )
      .select("+activeSessions")
      .lean()
      .exec();
  },

  pruneRotatedSessions(id: string | Types.ObjectId, rotatedBefore: Date) {
    return UserModel.updateOne(
      { _id: id },
      { $pull: { activeSessions: { rotatedAt: { $lt: rotatedBefore } } } },
    ).exec();
  },

  async existsByEmail(email: string): Promise<boolean> {
    return !!(await UserModel.exists({ email: email.toLowerCase().trim() }));
  },

  async paginate(filter: MongoFilter<IUser>, query: PaginationQuery) {
    const { page, limit, sortBy, sortOrder, search } = parsePagination(
      query as Record<string, unknown>,
    );

    const searchFilter: MongoFilter<IUser> = search
      ? {
          ...filter,
          $or: [
            { name: { $regex: search, $options: "i" } },
            { email: { $regex: search, $options: "i" } },
            { employeeId: { $regex: search, $options: "i" } },
            { studentId: { $regex: search, $options: "i" } },
          ],
        }
      : filter;

    const [data, total] = await Promise.all([
      UserModel.find(searchFilter)
        .sort({ [sortBy]: sortOrder === "asc" ? 1 : -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .populate("department", "name code")
        .lean()
        .exec(),
      UserModel.countDocuments(searchFilter),
    ]);

    return buildPaginated(data, total, page, limit);
  },

  async getDirectorySummary(filter: MongoFilter<IUser>) {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const withFilter = (extra: MongoFilter<IUser>): MongoFilter<IUser> => ({
      $and: [filter, extra],
    });

    const [
      total,
      active,
      pending,
      inactive,
      suspended,
      blocked,
      withoutDepartment,
      mfaEnabled,
      dormant,
    ] = await Promise.all([
      UserModel.countDocuments(filter),
      UserModel.countDocuments(withFilter({ status: "active" })),
      UserModel.countDocuments(withFilter({ status: "pending_verification" })),
      UserModel.countDocuments(withFilter({ status: "inactive" })),
      UserModel.countDocuments(withFilter({ status: "suspended" })),
      UserModel.countDocuments(withFilter({ status: "blocked" })),
      UserModel.countDocuments(
        withFilter({ $or: [{ department: null }, { department: { $exists: false } }] }),
      ),
      UserModel.countDocuments(withFilter({ mfaEnabled: true })),
      UserModel.countDocuments(
        withFilter({
          status: "active",
          $or: [
            { lastLogin: { $lt: thirtyDaysAgo } },
            { lastLogin: { $exists: false } },
            { lastLogin: null },
          ],
        }),
      ),
    ]);

    return {
      total,
      active,
      pending,
      inactive,
      suspended,
      blocked,
      withoutDepartment,
      mfaEnabled,
      dormant,
      mfaAdoptionPercent: total ? Math.round((mfaEnabled / total) * 100) : 0,
    };
  },

  async countByRoles(roles: string[]): Promise<number> {
    return UserModel.countDocuments({ roles: { $in: roles } } as unknown as MongoFilter<IUser>);
  },

  async findStudentIdsByDepartment(
    departmentId: string | Types.ObjectId,
  ): Promise<Types.ObjectId[]> {
    return UserModel.distinct("_id", {
      roles: "student",
      department: departmentId,
    } as unknown as MongoFilter<IUser>);
  },

  findByIdWithSessions(id: unknown) {
    return UserModel.findById(id).select("+activeSessions").lean();
  },

  findByIdWithAccess(id: string | Types.ObjectId) {
    return UserModel.findById(id)
      .select("+activeSessions")
      .populate("department", "name code")
      .lean()
      .exec();
  },

  revokeAllSessions(id: string | Types.ObjectId) {
    return UserModel.updateOne({ _id: id }, { $set: { activeSessions: [] } }).exec();
  },

  deleteById(id: string | Types.ObjectId) {
    return UserModel.findByIdAndDelete(id).exec();
  },
};
