import createError from "http-errors";
import { PlacementDriveModel } from "../models/placement.model";
import {
  PlacementNetworkListingModel,
  PlacementNetworkListingStatus,
  PlacementNetworkRequestModel,
  PlacementNetworkRequestStatus,
} from "../models/placement-network.model";
import { TenantModel } from "../models/tenant.model";

async function organizationName(tenantId: string): Promise<string> {
  const tenant = await TenantModel.findOne({ tenantId }).select("name").lean();
  if (!tenant) throw createError(404, "Institution is unavailable");
  return tenant.name;
}

export const placementNetworkService = {
  list: async (tenantId: string) => {
    const now = new Date();
    const [listings, requests] = await Promise.all([
      PlacementNetworkListingModel.find({
        status: PlacementNetworkListingStatus.PUBLISHED,
        driveDate: { $gte: now },
      })
        .sort({ driveDate: 1 })
        .lean(),
      PlacementNetworkRequestModel.find({ requesterTenantId: tenantId }).lean(),
    ]);
    const requestByListing = new Map(
      requests.map((request) => [String(request.listingId), request]),
    );
    return listings.map((listing) => ({
      ...listing,
      isOwnedByCurrentTenant: listing.ownerTenantId === tenantId,
      request: requestByListing.get(String(listing._id)) ?? null,
    }));
  },

  publish: async (
    tenantId: string,
    driveId: string,
    publishedBy: string,
    input: { participationNote?: string; availableSeats?: number },
  ) => {
    const drive = await PlacementDriveModel.findById(driveId).lean();
    if (!drive) throw createError(404, "Placement drive not found");
    if (drive.status !== "upcoming")
      throw createError(409, "Only an upcoming drive can be published to the network");
    if (drive.registrationEnd <= new Date())
      throw createError(409, "Registration has already closed for this drive");
    const ownerOrganizationName = await organizationName(tenantId);
    return PlacementNetworkListingModel.findOneAndUpdate(
      { ownerTenantId: tenantId, sourceDriveId: driveId },
      {
        $set: {
          ownerOrganizationName,
          academicYear: drive.academicYear,
          companyName: drive.companyName,
          jobRole: drive.jobRole,
          venue: drive.venue,
          driveDate: drive.driveDate,
          registrationEnd: drive.registrationEnd,
          package: drive.package,
          packageMax: drive.packageMax,
          eligibilityCgpa: drive.eligibilityCgpa,
          eligibilityBacklogs: drive.eligibilityBacklogs,
          eligiblePrograms: drive.eligiblePrograms,
          eligibleBranches: drive.eligibleBranches,
          eligibleBatches: drive.eligibleBatches,
          participationNote: input.participationNote,
          availableSeats: input.availableSeats,
          status: PlacementNetworkListingStatus.PUBLISHED,
          publishedBy,
        },
        $setOnInsert: { ownerTenantId: tenantId, sourceDriveId: driveId },
      },
      { upsert: true, returnDocument: "after", runValidators: true },
    ).lean();
  },

  withdrawListing: async (tenantId: string, listingId: string) => {
    const listing = await PlacementNetworkListingModel.findOneAndUpdate(
      { _id: listingId, ownerTenantId: tenantId, status: PlacementNetworkListingStatus.PUBLISHED },
      { $set: { status: PlacementNetworkListingStatus.WITHDRAWN } },
      { returnDocument: "after" },
    ).lean();
    if (!listing) throw createError(404, "Published network drive was not found");
    return listing;
  },

  requestParticipation: async (
    tenantId: string,
    listingId: string,
    requestedBy: string,
    input: {
      estimatedStudents: number;
      contactName: string;
      contactEmail: string;
      message?: string;
    },
  ) => {
    const listing = await PlacementNetworkListingModel.findOne({
      _id: listingId,
      status: PlacementNetworkListingStatus.PUBLISHED,
      driveDate: { $gte: new Date() },
    }).lean();
    if (!listing) throw createError(404, "Network placement drive is unavailable");
    if (listing.ownerTenantId === tenantId)
      throw createError(409, "Your institution owns this placement drive");
    const requesterOrganizationName = await organizationName(tenantId);
    try {
      return await PlacementNetworkRequestModel.create({
        listingId,
        ownerTenantId: listing.ownerTenantId,
        requesterTenantId: tenantId,
        requesterOrganizationName,
        requestedBy,
        estimatedStudents: input.estimatedStudents,
        contactName: input.contactName,
        contactEmail: input.contactEmail,
        message: input.message,
      });
    } catch (error) {
      if ((error as { code?: number }).code === 11000)
        throw createError(409, "Your institution has already requested this drive");
      throw error;
    }
  },

  requests: async (tenantId: string) => {
    const [incoming, outgoing] = await Promise.all([
      PlacementNetworkRequestModel.find({ ownerTenantId: tenantId })
        .populate("listingId", "companyName jobRole driveDate ownerOrganizationName")
        .sort({ createdAt: -1 })
        .lean(),
      PlacementNetworkRequestModel.find({ requesterTenantId: tenantId })
        .populate("listingId", "companyName jobRole driveDate ownerOrganizationName")
        .sort({ createdAt: -1 })
        .lean(),
    ]);
    return { incoming, outgoing };
  },

  decideRequest: async (
    tenantId: string,
    requestId: string,
    decision: "approve" | "reject",
    decidedBy: string,
    decisionNote?: string,
  ) => {
    const request = await PlacementNetworkRequestModel.findOneAndUpdate(
      {
        _id: requestId,
        ownerTenantId: tenantId,
        status: PlacementNetworkRequestStatus.PENDING,
      },
      {
        $set: {
          status:
            decision === "approve"
              ? PlacementNetworkRequestStatus.APPROVED
              : PlacementNetworkRequestStatus.REJECTED,
          decisionNote,
          decidedBy,
          decidedAt: new Date(),
        },
      },
      { returnDocument: "after", runValidators: true },
    ).lean();
    if (!request) throw createError(404, "Pending participation request was not found");
    return request;
  },
};
