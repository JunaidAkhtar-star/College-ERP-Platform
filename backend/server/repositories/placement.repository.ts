import { PlacementDriveModel } from "../models";
import {
  PlacementApplicationModel,
  PlacementApplicationStatus,
} from "../models/placement-application.model";
import { StudentPlacementProfileModel } from "../models/student-placement-profile.model";

export const placementRepository = {
  findById: (id: string) => PlacementDriveModel.findById(id).lean(),

  create: (data: Record<string, unknown>) => PlacementDriveModel.create(data),

  updateById: (id: string, data: Record<string, unknown>) =>
    PlacementDriveModel.findByIdAndUpdate(id, { $set: data }).lean(),

  list: async (filter: Record<string, unknown>, page = 1, limit = 20, studentId?: string) => {
    const skip = (page - 1) * limit;
    const [data, total] = await Promise.all([
      PlacementDriveModel.find(filter).sort({ driveDate: -1 }).skip(skip).limit(limit).lean(),
      PlacementDriveModel.countDocuments(filter),
    ]);
    const driveIds = data.map((drive) => drive._id);
    const [counts, registrations] = await Promise.all([
      PlacementApplicationModel.aggregate<{
        _id: { driveId: unknown; status: PlacementApplicationStatus };
        count: number;
      }>([
        { $match: { driveId: { $in: driveIds } } },
        { $group: { _id: { driveId: "$driveId", status: "$status" }, count: { $sum: 1 } } },
      ]),
      studentId
        ? PlacementApplicationModel.find({ driveId: { $in: driveIds }, studentId })
            .select("driveId")
            .lean()
        : [],
    ]);
    const registered = new Set(registrations.map((application) => String(application.driveId)));
    const enriched = data.map((drive) => {
      const rows = counts.filter((row) => String(row._id.driveId) === String(drive._id));
      const selectedStatuses: PlacementApplicationStatus[] = [
        PlacementApplicationStatus.SELECTED,
        PlacementApplicationStatus.OFFERED,
        PlacementApplicationStatus.ACCEPTED,
        PlacementApplicationStatus.DECLINED,
        PlacementApplicationStatus.SUPERSEDED,
      ];
      return {
        ...drive,
        registeredCount: rows.reduce((sum, row) => sum + row.count, 0),
        selectedCount: rows
          .filter((row) => selectedStatuses.includes(row._id.status))
          .reduce((sum, row) => sum + row.count, 0),
        isRegistered: registered.has(String(drive._id)),
      };
    });
    return { data: enriched, total, page, limit, pages: Math.ceil(total / limit) };
  },

  countByStatus: async () => {
    const now = new Date();
    const responseWindow = new Date(now);
    responseWindow.setDate(responseWindow.getDate() + 7);
    const [drives, applications, compensation, profiles, monthlyApplications, branchOutcomes] =
      await Promise.all([
        PlacementDriveModel.aggregate<{ _id: string; count: number }>([
          { $group: { _id: "$status", count: { $sum: 1 } } },
        ]),
        PlacementApplicationModel.aggregate<{ _id: PlacementApplicationStatus; count: number }>([
          { $group: { _id: "$status", count: { $sum: 1 } } },
        ]),
        PlacementApplicationModel.aggregate<{
          _id: null;
          average: number;
          highest: number;
        }>([
          { $match: { offeredPackage: { $gt: 0 } } },
          {
            $group: {
              _id: null,
              average: { $avg: "$offeredPackage" },
              highest: { $max: "$offeredPackage" },
            },
          },
        ]),
        StudentPlacementProfileModel.aggregate<{ _id: string; count: number }>([
          {
            $project: {
              readiness: {
                $switch: {
                  branches: [
                    { case: { $eq: ["$eligibilityStatus", "placed"] }, then: "placed" },
                    { case: { $eq: ["$eligibilityStatus", "opted_out"] }, then: "optedOut" },
                    {
                      case: { $eq: ["$eligibilityStatus", "higher_studies"] },
                      then: "higherStudies",
                    },
                    {
                      case: {
                        $and: [
                          "$isEligibleForPlacement",
                          { $gt: [{ $strLenCP: { $ifNull: ["$resumeUrl", ""] } }, 0] },
                        ],
                      },
                      then: "ready",
                    },
                    { case: "$isEligibleForPlacement", then: "resumeMissing" },
                  ],
                  default: "notEligible",
                },
              },
            },
          },
          { $group: { _id: "$readiness", count: { $sum: 1 } } },
        ]),
        PlacementApplicationModel.aggregate<{
          _id: string;
          applications: number;
          selections: number;
        }>([
          {
            $match: { registeredAt: { $gte: new Date(now.getFullYear() - 1, now.getMonth(), 1) } },
          },
          {
            $group: {
              _id: { $dateToString: { format: "%Y-%m", date: "$registeredAt" } },
              applications: { $sum: 1 },
              selections: {
                $sum: {
                  $cond: [
                    {
                      $in: [
                        "$status",
                        ["selected", "offered", "accepted", "declined", "superseded"],
                      ],
                    },
                    1,
                    0,
                  ],
                },
              },
            },
          },
          { $sort: { _id: 1 } },
        ]),
        PlacementApplicationModel.aggregate<{
          _id: string;
          applications: number;
          selections: number;
        }>([
          {
            $group: {
              _id: "$branch",
              applications: { $sum: 1 },
              selections: {
                $sum: {
                  $cond: [
                    {
                      $in: [
                        "$status",
                        ["selected", "offered", "accepted", "declined", "superseded"],
                      ],
                    },
                    1,
                    0,
                  ],
                },
              },
            },
          },
          { $sort: { applications: -1 } },
          { $limit: 6 },
        ]),
      ]);
    const driveCounts = Object.fromEntries(drives.map((row) => [row._id, row.count]));
    const applicationCounts = Object.fromEntries(applications.map((row) => [row._id, row.count]));
    const readiness = Object.fromEntries(profiles.map((row) => [row._id, row.count]));
    const totalDrives = drives.reduce((sum, row) => sum + row.count, 0);
    const totalRegistered = applications.reduce((sum, row) => sum + row.count, 0);
    const selectedStatuses = ["selected", "offered", "accepted", "declined", "superseded"];
    const totalSelected = applications
      .filter((row) => selectedStatuses.includes(row._id))
      .reduce((sum, row) => sum + row.count, 0);
    const offersIssued = ["offered", "accepted", "declined", "superseded"].reduce(
      (sum, status) => sum + (applicationCounts[status] ?? 0),
      0,
    );
    const [closingSoon, offersExpiring] = await Promise.all([
      PlacementDriveModel.countDocuments({
        status: "upcoming",
        registrationEnd: { $gte: now, $lte: responseWindow },
      }),
      PlacementApplicationModel.countDocuments({
        status: PlacementApplicationStatus.OFFERED,
        offerExpiresAt: { $gte: now, $lte: responseWindow },
      }),
    ]);
    return {
      ...driveCounts,
      totalDrives,
      totalRegistered,
      totalSelected,
      placementRate: totalRegistered ? (totalSelected / totalRegistered) * 100 : 0,
      offersIssued,
      offersAccepted: applicationCounts.accepted ?? 0,
      offersDeclined: applicationCounts.declined ?? 0,
      offersPending: applicationCounts.offered ?? 0,
      offerAcceptanceRate: offersIssued
        ? ((applicationCounts.accepted ?? 0) / offersIssued) * 100
        : 0,
      averageOfferedCtc: compensation[0]?.average ?? 0,
      highestOfferedCtc: compensation[0]?.highest ?? 0,
      closingSoon,
      offersExpiring,
      readiness,
      applicationStatus: applicationCounts,
      monthlyApplications: monthlyApplications.map((row) => ({
        month: row._id,
        applications: row.applications,
        selections: row.selections,
      })),
      branchOutcomes: branchOutcomes.map((row) => ({
        branch: row._id || "Unassigned",
        applications: row.applications,
        selections: row.selections,
      })),
    };
  },
};
