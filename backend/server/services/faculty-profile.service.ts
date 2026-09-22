import createError from "http-errors";
import { facultyProfileRepository } from "../repositories";
import { pdfService } from "../pdf/pdf.service";
import type { IFacultyProfile } from "../models";
import type { IUser } from "../models/user.model";
import { calculatePayrollAmounts } from "./payroll.service";
import { nextSeq } from "../models/counter.model";
import { Types } from "mongoose";
import { FacultyProfileModel, FacultyStatus } from "../models/faculty-profile.model";
import { cryptoUtil } from "../utils/crypto.util";
import { formatIndiaDate } from "../utils/date.util";
import { userRepository } from "../repositories/user.repository";
import { DepartmentModel } from "../models/department.model";
import { SystemRole } from "../constants/roles";

const facultyStatusTransitions: Partial<Record<FacultyStatus, FacultyStatus[]>> = {
  [FacultyStatus.ACTIVE]: [
    FacultyStatus.ON_LEAVE,
    FacultyStatus.SUSPENDED,
    FacultyStatus.RESIGNED,
    FacultyStatus.RETIRED,
    FacultyStatus.TERMINATED,
  ],
  [FacultyStatus.ON_LEAVE]: [FacultyStatus.ACTIVE, FacultyStatus.RESIGNED],
  [FacultyStatus.SUSPENDED]: [FacultyStatus.ACTIVE, FacultyStatus.TERMINATED],
};

export function assertFacultyStatusTransition(current: FacultyStatus, next: FacultyStatus) {
  if (current === next) return;
  if (!facultyStatusTransitions[current]?.includes(next))
    throw createError(409, `Faculty status cannot change from ${current} to ${next}`);
}

const ADMIN_FIELDS: (keyof IFacultyProfile)[] = [
  "aadhaarNumber",
  "panNumber",
  "pfAccountNo",
  "firstName",
  "middleName",
  "lastName",
  "dateOfBirth",
  "gender",
  "bloodGroup",
  "nationality",
  "religion",
  "caste",
  "category",
  "isPhysicallyChallenged",
  "maritalStatus",
  "spouseName",
  "spouseOccupation",
  "numberOfChildren",
  "motherTongue",
  "personalEmail",
  "phone",
  "alternatePhone",
  "whatsappPhone",
  "emergencyContactName",
  "emergencyContactRelationship",
  "emergencyContactPhone",
  "permanentAddress",
  "currentAddress",
  "employmentType",
  "designation",
  "department",
  "joiningDate",
  "confirmationDate",
  "probationEndDate",
  "contractEndDate",
  "retirementDate",
  "status",
  "reportingTo",
  "highestQualification",
  "specialization",
  "qualifications",
  "experienceRecords",
  "salaryDetails",
  "leaveBalance",
  "appraisals",
  "remarks",
];

export function encryptFacultyFields(data: Partial<IFacultyProfile>) {
  const salary = data.salaryDetails;
  return {
    ...data,
    ...(data.aadhaarNumber ? { aadhaarNumber: cryptoUtil.encrypt(data.aadhaarNumber) } : {}),
    ...(data.panNumber ? { panNumber: cryptoUtil.encrypt(data.panNumber.toUpperCase()) } : {}),
    ...(salary
      ? {
          salaryDetails: {
            ...salary,
            ...(salary.panNumber
              ? { panNumber: cryptoUtil.encrypt(salary.panNumber.toUpperCase()) }
              : {}),
            ...(salary.bankAccountNo
              ? { bankAccountNo: cryptoUtil.encrypt(salary.bankAccountNo) }
              : {}),
          },
        }
      : {}),
  };
}

export const facultyProfileService = {
  create: async (data: Partial<IFacultyProfile>, createdBy: string) => {
    if (data.employeeId) {
      const exists = await facultyProfileRepository.findByEmployeeId(data.employeeId);
      if (exists)
        throw createError(409, `Faculty with employee ID ${data.employeeId} already exists`);
    }
    return facultyProfileRepository.create({
      ...encryptFacultyFields(data),
      status: FacultyStatus.ACTIVE,
      createdBy: new Types.ObjectId(createdBy),
    });
  },

  getById: async (id: string, includeSalary = false) => {
    const profile = await facultyProfileRepository.findById(id, includeSalary);
    if (!profile) throw createError(404, "Faculty profile not found");
    return profile;
  },

  getByUserId: async (userId: string) => {
    const profile = await facultyProfileRepository.findByUserId(userId);
    if (!profile) throw createError(404, "Faculty profile not found");
    return profile;
  },

  list: async (query: Record<string, unknown>, page = 1, limit = 20, user?: IUser) => {
    const filter = { ...query };
    const search = (query["search"] as string) || undefined;
    delete filter["search"];

    const requestedDept = filter["departmentId"] || filter["department"];
    delete filter["departmentId"];

    if (requestedDept) {
      const deptStr = String(requestedDept);
      filter["department"] = Types.ObjectId.isValid(deptStr)
        ? { $in: [new Types.ObjectId(deptStr), deptStr] }
        : deptStr;
    } else if (
      user &&
      user.roles.includes(SystemRole.HOD) &&
      !user.roles.some((r) =>
        [
          SystemRole.SUPER_ADMIN,
          SystemRole.ADMIN,
          SystemRole.PRINCIPAL,
          SystemRole.DEAN_ACADEMIC,
          SystemRole.HR_DEPARTMENT,
        ].includes(r),
      )
    ) {
      let deptIdStr = "";
      if (user.department) {
        deptIdStr =
          typeof user.department === "object" && "_id" in (user.department as object)
            ? String((user.department as { _id: Types.ObjectId })._id)
            : String(user.department);
      } else {
        const hodProfile = await facultyProfileRepository.findByUserId(user._id.toString());
        if (hodProfile?.department) {
          deptIdStr =
            typeof hodProfile.department === "object" && "_id" in hodProfile.department
              ? String((hodProfile.department as { _id: Types.ObjectId })._id)
              : String(hodProfile.department);
        } else {
          const deptDoc = await DepartmentModel.findOne({ hodId: user._id }).lean();
          if (deptDoc) deptIdStr = deptDoc._id.toString();
        }
      }
      if (deptIdStr) {
        filter["department"] = Types.ObjectId.isValid(deptIdStr)
          ? { $in: [new Types.ObjectId(deptIdStr), deptIdStr] }
          : deptIdStr;
      }
      filter["userId"] = { $ne: user._id };
    }

    return facultyProfileRepository.paginate(filter, { page, limit, search });
  },

  update: async (
    id: string,
    data: Partial<IFacultyProfile> & { assignedRole?: string; roles?: string[] },
    updatedBy: string,
  ) => {
    const current = await facultyProfileRepository.findById(id, true);
    if (!current) throw createError(404, "Faculty profile not found");
    if (data.status) assertFacultyStatusTransition(current.status, data.status);
    const patch: Partial<IFacultyProfile> = {};
    for (const key of ADMIN_FIELDS)
      if (key in data)
        (patch as Record<string, unknown>)[key] = (data as Record<string, unknown>)[key];
    const updated = await facultyProfileRepository.updateById(id, {
      ...encryptFacultyFields(patch),
      updatedBy: new Types.ObjectId(updatedBy),
    });
    if (!updated) throw createError(404, "Faculty profile not found");

    // Sync underlying User document (roles, name, department, phone)
    if (current.userId) {
      const userObjId =
        typeof current.userId === "object" && "_id" in current.userId
          ? (current.userId as { _id: Types.ObjectId })._id
          : new Types.ObjectId(current.userId as string);

      const newRole = data.assignedRole || (data.roles && data.roles[0]);
      const userPatch: Record<string, unknown> = {};

      const newFirstName = data.firstName ?? current.firstName;
      const newLastName = data.lastName ?? current.lastName;
      if (data.firstName || data.lastName) {
        userPatch.name = `${newFirstName} ${newLastName}`.trim();
      }
      if (data.phone) userPatch.phone = data.phone;
      if (data.department) userPatch.department = new Types.ObjectId(String(data.department));
      if (newRole) userPatch.roles = [newRole];

      if (Object.keys(userPatch).length > 0) {
        await userRepository.updateById(userObjId.toString(), userPatch);
      }

      // Department HOD management
      const targetDeptId = data.department
        ? String(data.department)
        : current.department
          ? typeof current.department === "object" && "_id" in current.department
            ? String((current.department as { _id: Types.ObjectId })._id)
            : String(current.department)
          : "";
      if (newRole === SystemRole.HOD && targetDeptId) {
        const fullNameStr = `${newFirstName} ${newLastName}`.trim();
        await DepartmentModel.updateOne(
          { _id: new Types.ObjectId(targetDeptId) },
          {
            $set: {
              hodId: userObjId,
              hodName: fullNameStr,
              updatedBy: new Types.ObjectId(updatedBy),
            },
          },
        );
      } else if (newRole && newRole !== SystemRole.HOD && targetDeptId) {
        await DepartmentModel.updateOne(
          { _id: new Types.ObjectId(targetDeptId), hodId: userObjId },
          { $unset: { hodId: "", hodName: "" } },
        );
      }
    }

    return updated;
  },

  /**
   * Self-service update for the logged-in faculty. Whitelists only fields the
   * faculty is allowed to edit; HR-controlled fields (employeeId, designation,
   * department, salary, joiningDate, status, etc.) are stripped.
   */
  updateMyProfile: async (userId: string, data: Partial<IFacultyProfile>) => {
    const profile = await facultyProfileRepository.findByUserId(userId);
    if (!profile) throw createError(404, "Faculty profile not found");

    // Faculty-editable personal/contact fields ONLY.
    // Locked (admin/HR-only — payroll, exam, identity audit depend on these):
    //   employeeId, designation, department, joiningDate, salary, status,
    //   employmentType, qualifications, publications, trainings,
    //   aadhaarNumber    -> salary disbursement / PF / IT filing
    //   passportPhotoUrl -> faculty ID card / NAAC · NBA reports
    //   signatureUrl     -> exam mark sheets / official letters
    // Faculty must re-submit photo / signature / Aadhaar via the Documents
    // module so HR can verify before they take effect.
    const ALLOWED: (keyof IFacultyProfile)[] = [
      "middleName",
      "personalEmail",
      "whatsappPhone",
      "bloodGroup",
      "religion",
      "maritalStatus",
      "spouseName",
      "passportNumber",
      "permanentAddress",
      "currentAddress",
      "emergencyContactName",
      "emergencyContactRelationship",
      "emergencyContactPhone",
    ];
    const patch: Partial<IFacultyProfile> = {};
    for (const key of ALLOWED) {
      if (key in data)
        (patch as Record<string, unknown>)[key as string] = (data as Record<string, unknown>)[
          key as string
        ];
    }

    const updated = await facultyProfileRepository.updateById(
      (profile as { _id: { toString(): string } })._id.toString(),
      { ...patch, updatedBy: new Types.ObjectId(userId) },
    );
    if (!updated) throw createError(404, "Faculty profile not found");
    return updated;
  },

  delete: async (_id: string) => {
    throw createError(409, "Faculty records cannot be deleted; use a governed employment status");
  },

  addPublication: async (
    profileId: string,
    publication: Record<string, unknown>,
    actorId: string,
    canManage: boolean,
  ) => {
    const profile = await facultyProfileRepository.findById(profileId);
    if (!profile) throw createError(404, "Faculty profile not found");
    const ownerId = (profile.userId as unknown as { _id?: Types.ObjectId })._id ?? profile.userId;
    if (!canManage && ownerId.toString() !== actorId)
      throw createError(403, "You can update only your own profile");
    const year = Number(publication.year);
    if (
      !String(publication.title ?? "").trim() ||
      year < 1900 ||
      year > new Date().getFullYear() + 1
    )
      throw createError(400, "Publication title or year is invalid");
    const updated = await facultyProfileRepository.addPublication(
      profileId,
      publication as unknown as IFacultyProfile["publications"][0],
    );
    if (!updated) throw createError(404, "Faculty profile not found");
    return updated;
  },

  addTraining: async (
    profileId: string,
    training: Record<string, unknown>,
    actorId: string,
    canManage: boolean,
  ) => {
    const profile = await facultyProfileRepository.findById(profileId);
    if (!profile) throw createError(404, "Faculty profile not found");
    const ownerId = (profile.userId as unknown as { _id?: Types.ObjectId })._id ?? profile.userId;
    if (!canManage && ownerId.toString() !== actorId)
      throw createError(403, "You can update only your own profile");
    const fromDate = new Date(String(training.fromDate ?? ""));
    const toDate = new Date(String(training.toDate ?? ""));
    if (Number.isNaN(fromDate.getTime()) || Number.isNaN(toDate.getTime()) || toDate < fromDate)
      throw createError(400, "Training dates are invalid");
    training.durationDays = Math.floor((toDate.getTime() - fromDate.getTime()) / 86400000) + 1;
    const updated = await facultyProfileRepository.addTraining(
      profileId,
      training as unknown as IFacultyProfile["trainingRecords"][0],
    );
    if (!updated) throw createError(404, "Faculty profile not found");
    return updated;
  },

  getStats: async (matchFilter: Record<string, unknown> = {}) => {
    const [total, statusCounts, pubsRes, trainRes, deptCounts, pubTypesRes, trainTypesRes] =
      await Promise.all([
        FacultyProfileModel.countDocuments(matchFilter),
        FacultyProfileModel.aggregate([
          { $match: matchFilter },
          { $group: { _id: "$status", count: { $sum: 1 } } },
        ]),
        FacultyProfileModel.aggregate([
          { $match: matchFilter },
          { $project: { pubCount: { $size: { $ifNull: ["$publications", []] } } } },
          { $group: { _id: null, total: { $sum: "$pubCount" } } },
        ]),
        FacultyProfileModel.aggregate([
          { $match: matchFilter },
          { $project: { trainCount: { $size: { $ifNull: ["$trainingRecords", []] } } } },
          { $group: { _id: null, total: { $sum: "$trainCount" } } },
        ]),
        FacultyProfileModel.aggregate([
          { $match: matchFilter },
          { $group: { _id: "$department", count: { $sum: 1 } } },
          { $lookup: { from: "departments", localField: "_id", foreignField: "_id", as: "dept" } },
          { $unwind: { path: "$dept", preserveNullAndEmptyArrays: true } },
          { $project: { name: { $ifNull: ["$dept.name", "General"] }, count: 1 } },
          { $sort: { count: -1 } },
          { $limit: 6 },
        ]),
        FacultyProfileModel.aggregate([
          { $match: matchFilter },
          { $unwind: "$publications" },
          { $group: { _id: "$publications.type", count: { $sum: 1 } } },
        ]),
        FacultyProfileModel.aggregate([
          { $match: matchFilter },
          { $unwind: "$trainingRecords" },
          { $group: { _id: "$trainingRecords.type", count: { $sum: 1 } } },
        ]),
      ]);

    const statusMap = Object.fromEntries(statusCounts.map((s) => [s._id, s.count]));

    return {
      total,
      active: statusMap[FacultyStatus.ACTIVE] ?? 0,
      onLeave: statusMap[FacultyStatus.ON_LEAVE] ?? 0,
      suspended: statusMap[FacultyStatus.SUSPENDED] ?? 0,
      resigned: statusMap[FacultyStatus.RESIGNED] ?? 0,
      retired: statusMap[FacultyStatus.RETIRED] ?? 0,
      totalPublications: pubsRes[0]?.total ?? 0,
      totalTrainings: trainRes[0]?.total ?? 0,
      departmentDistribution: deptCounts.map((d) => ({ name: d.name, count: d.count })),
      publicationsByType: pubTypesRes.map((p) => ({ type: p._id || "journal", count: p.count })),
      trainingsByType: trainTypesRes.map((t) => ({ type: t._id || "fdp", count: t.count })),
    };
  },

  generateSalarySlip: async (profileId: string, month: string, year: number, lopDays = 0) => {
    const profile = (await facultyProfileRepository.findById(
      profileId,
      true,
    )) as unknown as IFacultyProfile & Record<string, unknown>;
    if (!profile) throw createError(404, "Faculty profile not found");
    const salary = (profile["salaryDetails"] as unknown as Record<string, unknown>) || {};
    const basicPay = Number(salary["basicPay"] || 0);
    const monthNumber =
      [
        "january",
        "february",
        "march",
        "april",
        "may",
        "june",
        "july",
        "august",
        "september",
        "october",
        "november",
        "december",
      ].indexOf(month.toLowerCase()) + 1;
    if (!monthNumber) throw createError(400, "Month name is invalid");
    const calendarDays = new Date(year, monthNumber, 0).getDate();
    if (lopDays < 0 || lopDays > calendarDays) throw createError(400, "LOP days are invalid");
    const paidDays = calendarDays - lopDays;
    const { earnedBasic, da, hra, ta, grossPay, pf, pt, tds, totalDeductions, netPay } =
      await calculatePayrollAmounts(basicPay, paidDays, monthNumber, year);

    const seq = await nextSeq(`salary-slip:${year}:${monthNumber}`);
    let bankAccount = "";
    if (salary["bankAccountNo"])
      try {
        bankAccount = cryptoUtil.decrypt(String(salary["bankAccountNo"]));
      } catch {
        throw createError(500, "Faculty bank details could not be decrypted");
      }
    return pdfService.generateSalarySlip({
      slipNumber: `SAL-${year}-${month}-${String(seq).padStart(4, "0")}`,
      employeeId: profile.employeeId || "",
      employeeName: (profile["fullName"] as string) || "",
      designation: profile.designation || "",
      department: String(
        (profile["departmentId"] as Record<string, unknown>)?.["code"] ||
          profile.departmentId ||
          "",
      ),
      month,
      year,
      earnings: [
        { component: "Basic Pay", amount: earnedBasic },
        { component: "Dearness Allowance", amount: da },
        { component: "House Rent Allowance", amount: hra },
        { component: "Transport Allowance", amount: ta },
      ],
      deductions: [
        { component: "Provident Fund (12%)", amount: pf },
        { component: "Professional Tax", amount: pt },
        { component: "TDS (Income Tax)", amount: tds },
      ],
      grossPay,
      totalDeductions,
      netPay,
      bankAccount: bankAccount ? `XXXX${bankAccount.slice(-4)}` : "N/A",
      pfAccount: profile.pfAccountNo || "N/A",
      paidDays,
      lopDays,
    });
  },

  generateExperienceLetter: async (
    profileId: string,
    dateOfRelieving: string,
    issuedBy: string,
    principalName: string,
  ) => {
    const profile = (await facultyProfileRepository.findById(
      profileId,
    )) as unknown as IFacultyProfile & Record<string, unknown>;
    if (!profile) throw createError(404, "Faculty profile not found");
    if (
      ![FacultyStatus.RESIGNED, FacultyStatus.RETIRED, FacultyStatus.TERMINATED].includes(
        profile.status,
      )
    )
      throw createError(409, "Experience letters are available only after employment ends");
    const relievingDate = new Date(dateOfRelieving);
    if (Number.isNaN(relievingDate.getTime()) || relievingDate < new Date(profile.joiningDate))
      throw createError(400, "Relieving date is invalid");

    const year = new Date().getFullYear();
    const seq = await nextSeq(`experience-letter:${year}`);
    return pdfService.generateExperienceLetter({
      letterNumber: `EXP-${year}-${String(seq).padStart(7, "0")}`,
      employeeName: (profile["fullName"] as string) || "",
      employeeId: profile.employeeId || "",
      designation: profile.designation || "",
      department: String((profile["departmentId"] as Record<string, unknown>)?.["code"] || ""),
      dateOfJoining: (profile["dateOfJoining"] as Date | undefined)
        ? formatIndiaDate(profile["dateOfJoining"] as Date)
        : "",
      dateOfRelieving: formatIndiaDate(relievingDate),
      issuedDate: formatIndiaDate(new Date()),
      issuedBy,
      principalName,
    });
  },
};
