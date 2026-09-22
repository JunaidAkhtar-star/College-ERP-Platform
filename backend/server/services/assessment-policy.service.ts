import createError from "http-errors";
import {
  AssessmentPolicyModel,
  AssessmentPolicyStatus,
  CalculationMethod,
  RoundingMethod,
  type IAssessmentComponent,
} from "../models/assessment-policy.model";

export interface IComponentScoreInput {
  componentKey: string;
  attempts: number[];
  attended?: boolean;
}
function round(value: number, method: RoundingMethod) {
  if (method === RoundingMethod.NEAREST_INTEGER) return Math.round(value);
  if (method === RoundingMethod.NEAREST_HALF) return Math.round(value * 2) / 2;
  if (method === RoundingMethod.FLOOR) return Math.floor(value);
  if (method === RoundingMethod.CEIL) return Math.ceil(value);
  return value;
}
export function calculateComponentScore(
  component: IAssessmentComponent,
  input: IComponentScoreInput,
) {
  if (component.attendanceRequired && input.attended !== true) return 0;
  if (!input.attempts.length || input.attempts.length > component.attemptCount)
    throw createError(400, `Invalid attempt count for ${component.name}`);
  if (
    input.attempts.some(
      (score) =>
        !Number.isFinite(score) ||
        score < 0 ||
        (component.scaleFrom ? score > component.scaleFrom : false),
    )
  )
    throw createError(400, `Invalid score for ${component.name}`);
  const sorted = [...input.attempts].sort((a, b) => b - a);
  let raw =
    component.method === CalculationMethod.AVERAGE
      ? sorted.reduce((a, b) => a + b, 0) / sorted.length
      : component.method === CalculationMethod.BEST_N
        ? sorted.slice(0, component.bestCount ?? 1).reduce((a, b) => a + b, 0)
        : component.method === CalculationMethod.DROP_LOWEST
          ? sorted.slice(0, Math.max(1, sorted.length - 1)).reduce((a, b) => a + b, 0)
          : sorted.reduce((a, b) => a + b, 0);
  if (component.scaleFrom) raw = (raw / component.scaleFrom) * component.maximumMarks;
  if (component.method === CalculationMethod.WEIGHTED) raw *= component.weight ?? 1;
  return Math.min(component.maximumMarks, round(raw, component.rounding));
}
function validatePolicy(input: Record<string, unknown>) {
  const components = input.components as IAssessmentComponent[];
  if (!Array.isArray(components) || !components.length)
    throw createError(400, "Assessment components are required");
  const keys = components.map((c) => c.key.trim().toLowerCase());
  if (new Set(keys).size !== keys.length) throw createError(400, "Component keys must be unique");
  for (const c of components) {
    if (
      !c.name?.trim() ||
      !c.key?.trim() ||
      c.maximumMarks <= 0 ||
      c.minimumPassMarks < 0 ||
      c.minimumPassMarks > c.maximumMarks
    )
      throw createError(400, `Invalid assessment component ${c.name || c.key || "unknown"}`);
    if (c.method === CalculationMethod.BEST_N && (!c.bestCount || c.bestCount > c.attemptCount))
      throw createError(400, `Invalid best-count rule for ${c.name}`);
  }
  const minimumTotalMarks = Number(input.minimumTotalMarks || 0);
  if (
    !Number.isFinite(minimumTotalMarks) ||
    minimumTotalMarks < 0 ||
    minimumTotalMarks > Number(input.maximumMarks)
  )
    throw createError(400, "Overall pass marks must be within the policy maximum");
  const gradeScale = (input.gradeScale ?? []) as Array<{
    letter: string;
    minimumPercentage: number;
    point: number;
  }>;
  if (
    gradeScale.some(
      (band) =>
        !band.letter?.trim() ||
        !Number.isFinite(band.minimumPercentage) ||
        band.minimumPercentage < 0 ||
        band.minimumPercentage > 100 ||
        !Number.isFinite(band.point) ||
        band.point < 0,
    )
  )
    throw createError(400, "Invalid grade scale");
  if (new Set(gradeScale.map((band) => band.minimumPercentage)).size !== gradeScale.length)
    throw createError(400, "Grade thresholds must be unique");
  const total = components.reduce((sum, c) => sum + Number(c.maximumMarks), 0);
  if (Math.abs(total - Number(input.maximumMarks)) > 0.0001)
    throw createError(400, `Component maximums must total ${input.maximumMarks}`);
}
export const assessmentPolicyService = {
  list: (filter: Record<string, unknown>) =>
    AssessmentPolicyModel.find(filter).sort({ code: 1, version: -1 }).lean(),
  get: async (id: string) => {
    const row = await AssessmentPolicyModel.findById(id).lean();
    if (!row) throw createError(404, "Assessment policy not found");
    return row;
  },
  create: async (input: Record<string, unknown>, userId: string) => {
    validatePolicy(input);
    return AssessmentPolicyModel.create({
      ...input,
      status: AssessmentPolicyStatus.DRAFT,
      createdBy: userId,
    });
  },
  update: async (id: string, input: Record<string, unknown>) => {
    const current = await AssessmentPolicyModel.findById(id);
    if (!current) throw createError(404, "Assessment policy not found");
    if (current.status !== AssessmentPolicyStatus.DRAFT)
      throw createError(409, "Published policies are immutable; clone a new version");
    validatePolicy({ ...current.toObject(), ...input });
    return AssessmentPolicyModel.findByIdAndUpdate(
      id,
      { $set: input },
      { returnDocument: "after", runValidators: true },
    ).lean();
  },
  publish: async (id: string, userId: string) => {
    const current = await AssessmentPolicyModel.findById(id);
    if (!current) throw createError(404, "Assessment policy not found");
    if (current.status !== AssessmentPolicyStatus.DRAFT)
      throw createError(409, "Only draft policies can be published");
    validatePolicy(current.toObject() as unknown as Record<string, unknown>);
    return AssessmentPolicyModel.findByIdAndUpdate(
      id,
      {
        $set: {
          status: AssessmentPolicyStatus.PUBLISHED,
          approvedBy: userId,
          publishedAt: new Date(),
        },
      },
      { returnDocument: "after" },
    ).lean();
  },
  retire: async (id: string, userId: string) => {
    const row = await AssessmentPolicyModel.findOneAndUpdate(
      { _id: id, status: AssessmentPolicyStatus.PUBLISHED },
      {
        $set: {
          status: AssessmentPolicyStatus.RETIRED,
          effectiveTo: new Date(),
          updatedBy: userId,
        },
      },
      { returnDocument: "after", runValidators: true },
    ).lean();
    if (!row) throw createError(409, "Only a published policy can be retired");
    return row;
  },
  clone: async (id: string, userId: string) => {
    const current = await AssessmentPolicyModel.findById(id).lean();
    if (!current) throw createError(404, "Assessment policy not found");
    const { _id, createdAt, updatedAt, approvedBy, publishedAt, ...copy } = current;
    void _id;
    void createdAt;
    void updatedAt;
    void approvedBy;
    void publishedAt;
    return AssessmentPolicyModel.create({
      ...copy,
      version: current.version + 1,
      status: AssessmentPolicyStatus.DRAFT,
      createdBy: userId,
    });
  },
  preview: async (id: string, scores: IComponentScoreInput[]) => {
    const policy = await AssessmentPolicyModel.findById(id).lean();
    if (!policy) throw createError(404, "Assessment policy not found");
    const byKey = new Map(scores.map((s) => [s.componentKey, s]));
    const components = policy.components.map((component) => {
      const input = byKey.get(component.key);
      const marks = input ? calculateComponentScore(component, input) : 0;
      return {
        key: component.key,
        name: component.name,
        marks,
        maximumMarks: component.maximumMarks,
        passed: marks >= component.minimumPassMarks,
      };
    });
    return {
      components,
      total: components.reduce((s, c) => s + c.marks, 0),
      maximumMarks: policy.maximumMarks,
      passed: components.every((c) => c.passed),
    };
  },
};
