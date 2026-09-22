import mongoose, { Schema, type Document, type Types } from "mongoose";

export enum PlacementNetworkListingStatus {
  PUBLISHED = "published",
  CLOSED = "closed",
  WITHDRAWN = "withdrawn",
}

export enum PlacementNetworkRequestStatus {
  PENDING = "pending",
  APPROVED = "approved",
  REJECTED = "rejected",
  WITHDRAWN = "withdrawn",
}

export interface IPlacementNetworkListing extends Document {
  ownerTenantId: string;
  ownerOrganizationName: string;
  sourceDriveId: string;
  academicYear: string;
  companyName: string;
  jobRole: string;
  venue: string;
  driveDate: Date;
  registrationEnd: Date;
  package: number;
  packageMax?: number;
  eligibilityCgpa?: number;
  eligibilityBacklogs?: number;
  eligiblePrograms: string[];
  eligibleBranches: string[];
  eligibleBatches: string[];
  participationNote?: string;
  availableSeats?: number;
  status: PlacementNetworkListingStatus;
  publishedBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface IPlacementNetworkRequest extends Document {
  listingId: Types.ObjectId;
  ownerTenantId: string;
  requesterTenantId: string;
  requesterOrganizationName: string;
  requestedBy: string;
  estimatedStudents: number;
  contactName: string;
  contactEmail: string;
  message?: string;
  status: PlacementNetworkRequestStatus;
  decisionNote?: string;
  decidedBy?: string;
  decidedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const PlacementNetworkListingSchema = new Schema<IPlacementNetworkListing>(
  {
    ownerTenantId: { type: String, required: true, lowercase: true, trim: true, index: true },
    ownerOrganizationName: { type: String, required: true, trim: true },
    sourceDriveId: { type: String, required: true, trim: true },
    academicYear: { type: String, required: true, trim: true, index: true },
    companyName: { type: String, required: true, trim: true },
    jobRole: { type: String, required: true, trim: true },
    venue: { type: String, required: true, trim: true },
    driveDate: { type: Date, required: true, index: true },
    registrationEnd: { type: Date, required: true },
    package: { type: Number, required: true, min: 0 },
    packageMax: { type: Number, min: 0 },
    eligibilityCgpa: { type: Number, min: 0, max: 10 },
    eligibilityBacklogs: { type: Number, min: 0 },
    eligiblePrograms: [{ type: String }],
    eligibleBranches: [{ type: String }],
    eligibleBatches: [{ type: String }],
    participationNote: { type: String, trim: true, maxlength: 1000 },
    availableSeats: { type: Number, min: 1 },
    status: {
      type: String,
      enum: Object.values(PlacementNetworkListingStatus),
      default: PlacementNetworkListingStatus.PUBLISHED,
      index: true,
    },
    publishedBy: { type: String, required: true },
  },
  { timestamps: true },
);

PlacementNetworkListingSchema.index({ ownerTenantId: 1, sourceDriveId: 1 }, { unique: true });
PlacementNetworkListingSchema.index({ status: 1, driveDate: 1, academicYear: 1 });

const PlacementNetworkRequestSchema = new Schema<IPlacementNetworkRequest>(
  {
    listingId: {
      type: Schema.Types.ObjectId,
      ref: "PlacementNetworkListing",
      required: true,
      index: true,
    },
    ownerTenantId: { type: String, required: true, lowercase: true, trim: true, index: true },
    requesterTenantId: { type: String, required: true, lowercase: true, trim: true, index: true },
    requesterOrganizationName: { type: String, required: true, trim: true },
    requestedBy: { type: String, required: true },
    estimatedStudents: { type: Number, required: true, min: 1, max: 10000 },
    contactName: { type: String, required: true, trim: true, maxlength: 150 },
    contactEmail: { type: String, required: true, lowercase: true, trim: true, maxlength: 254 },
    message: { type: String, trim: true, maxlength: 1000 },
    status: {
      type: String,
      enum: Object.values(PlacementNetworkRequestStatus),
      default: PlacementNetworkRequestStatus.PENDING,
      index: true,
    },
    decisionNote: { type: String, trim: true, maxlength: 1000 },
    decidedBy: String,
    decidedAt: Date,
  },
  { timestamps: true },
);

PlacementNetworkRequestSchema.index({ listingId: 1, requesterTenantId: 1 }, { unique: true });

export const PlacementNetworkListingModel = mongoose.model<IPlacementNetworkListing>(
  "PlacementNetworkListing",
  PlacementNetworkListingSchema,
);
export const PlacementNetworkRequestModel = mongoose.model<IPlacementNetworkRequest>(
  "PlacementNetworkRequest",
  PlacementNetworkRequestSchema,
);
