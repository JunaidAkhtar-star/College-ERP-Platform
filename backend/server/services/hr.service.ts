import createError from "http-errors";
import { hrRepository } from "../repositories/hr.repository";
import { EmploymentStatus, type IHrEmployee } from "../models/hr.model";
import { redisUtil } from "../utils/redis.util";
import { Types } from "mongoose";
import { nextSeq } from "../models/counter.model";
import { UserModel } from "../models/user.model";
import { DepartmentModel } from "../models/department.model";
import { cryptoUtil } from "../utils/crypto.util";

const statusTransitions: Partial<Record<EmploymentStatus, EmploymentStatus[]>> = {
  [EmploymentStatus.ACTIVE]: [
    EmploymentStatus.ON_LEAVE,
    EmploymentStatus.RESIGNED,
    EmploymentStatus.RETIRED,
    EmploymentStatus.TERMINATED,
  ],
  [EmploymentStatus.ON_LEAVE]: [EmploymentStatus.ACTIVE, EmploymentStatus.RESIGNED],
};

export function assertEmploymentStatusTransition(
  current: EmploymentStatus,
  next: EmploymentStatus,
) {
  if (current === next) return;
  if (!statusTransitions[current]?.includes(next))
    throw createError(409, `Employment status cannot change from ${current} to ${next}`);
}

function encryptHrFields(data: Partial<IHrEmployee>) {
  return {
    ...data,
    ...(data.aadhaarNumber ? { aadhaarNumber: cryptoUtil.encrypt(data.aadhaarNumber) } : {}),
    ...(data.panNumber ? { panNumber: cryptoUtil.encrypt(data.panNumber.toUpperCase()) } : {}),
    ...(data.bankAccountNumber
      ? { bankAccountNumber: cryptoUtil.encrypt(data.bankAccountNumber) }
      : {}),
  };
}

const CACHE_TTL = 300; // 5 minutes

export const hrService = {
  // ─── Create Employee ───────────────────────────────────────────────────────
  async create(data: Partial<IHrEmployee>, createdBy: string) {
    const userId = data.userId?.toString();
    const departmentId = data.department?.toString();
    if (!userId || !departmentId) throw createError(400, "User and department are required");
    const [user, department, existing] = await Promise.all([
      UserModel.findById(userId).lean(),
      DepartmentModel.findById(departmentId).lean(),
      hrRepository.findByUserId(userId),
    ]);
    if (!user || !department) throw createError(404, "User or department not found");
    if (existing) throw createError(409, "An HR record already exists for this user");
    const sequence = await nextSeq("hr-employee");
    const employeeId = `EMP-${String(sequence).padStart(7, "0")}`;
    const employee = await hrRepository.create({
      ...encryptHrFields(data),
      employeeId,
      employmentStatus: EmploymentStatus.ACTIVE,
      createdBy: new Types.ObjectId(createdBy),
    });

    return employee;
  },

  // ─── Get by ID ─────────────────────────────────────────────────────────────
  async getById(id: string) {
    const cacheKey = `hr:employee:${id}`;
    return redisUtil.remember(cacheKey, CACHE_TTL, async () => {
      const emp = await hrRepository.findById(id);
      if (!emp) throw createError(404, "Employee not found");
      return emp;
    });
  },

  // ─── List with filters ─────────────────────────────────────────────────────
  list(
    filter: {
      department?: string;
      employmentStatus?: EmploymentStatus;
      employmentType?: string;
      search?: string;
    },
    page = 1,
    limit = 20,
  ) {
    const query: Record<string, unknown> = {};
    if (filter.department) query.department = filter.department;
    if (filter.employmentStatus) query.employmentStatus = filter.employmentStatus;
    if (filter.employmentType) query.employmentType = filter.employmentType;
    if (filter.search) {
      query.$or = [
        { name: { $regex: filter.search, $options: "i" } },
        { employeeId: { $regex: filter.search, $options: "i" } },
        { email: { $regex: filter.search, $options: "i" } },
        { designation: { $regex: filter.search, $options: "i" } },
      ];
    }
    return hrRepository.list(query, page, limit);
  },

  // ─── Update ────────────────────────────────────────────────────────────────
  async update(id: string, data: Partial<IHrEmployee>, updatedBy: string) {
    const current = await hrRepository.findById(id);
    if (!current) throw createError(404, "Employee not found");
    if (data.employmentStatus)
      assertEmploymentStatusTransition(current.employmentStatus, data.employmentStatus);
    if (data.userId && data.userId.toString() !== current.userId.toString())
      throw createError(409, "Linked user is immutable");
    const updated = await hrRepository.updateById(id, {
      ...encryptHrFields(data),
      updatedBy: new Types.ObjectId(updatedBy),
    } as Partial<IHrEmployee>);
    if (!updated) throw createError(404, "Employee not found");

    // Invalidate cache
    await redisUtil.del(`hr:employee:${id}`);

    return updated;
  },

  // ─── Terminate (soft delete) ───────────────────────────────────────────────
  async terminate(id: string, updatedBy: string) {
    const current = await hrRepository.findById(id);
    if (!current) throw createError(404, "Employee not found");
    assertEmploymentStatusTransition(current.employmentStatus, EmploymentStatus.TERMINATED);
    const deleted = await hrRepository.updateById(id, {
      employmentStatus: EmploymentStatus.TERMINATED,
      dateOfLeaving: new Date(),
      updatedBy: new Types.ObjectId(updatedBy),
    });
    await UserModel.updateOne({ _id: current.userId }, { $set: { status: "inactive" } });
    await redisUtil.del(`hr:employee:${id}`);
    return deleted;
  },

  // ─── Get by User ID ────────────────────────────────────────────────────────
  async getByUserId(userId: string) {
    const emp = await hrRepository.findByUserId(userId);
    if (!emp) throw createError(404, "Employee record not found");
    return emp;
  },
};
