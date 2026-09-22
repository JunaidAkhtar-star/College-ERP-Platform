/** Backfills authoritative ownership and governance fields for legacy question banks. */
import "dotenv/config";
import { createHash } from "node:crypto";
import mongoose, { type Connection } from "mongoose";

const mongoUri = process.env["MONGODB_URI"] ?? "";
const masterDatabaseName = process.env["MASTER_DB_NAME"] ?? "devvelocity_master";
const VALID_STATUSES = new Set(["draft", "approved", "retired"]);

function fingerprint(text: string) {
  return createHash("sha256")
    .update(text.trim().replace(/\s+/g, " ").toLocaleLowerCase("en-IN"))
    .digest("hex");
}

async function migrateTenant(connection: Connection, databaseName: string) {
  const tenantDb = connection.useDb(databaseName, { useCache: true });
  const questions = tenantDb.collection("questions");
  const subjects = tenantDb.collection("subjects");
  let migrated = 0;
  const activeFingerprints = new Set<string>();

  for await (const question of questions.find({})) {
    if (!question.subjectId) {
      throw new Error(`${databaseName}: question ${String(question._id)} has no subjectId`);
    }
    const subject = await subjects.findOne({ _id: question.subjectId });
    if (!subject) {
      throw new Error(`${databaseName}: question ${String(question._id)} references no subject`);
    }
    const questionText = String(question.questionText ?? "").trim();
    if (questionText.length < 3) {
      throw new Error(`${databaseName}: question ${String(question._id)} has invalid text`);
    }
    const status = VALID_STATUSES.has(String(question.status))
      ? question.status
      : question.isActive === false
        ? "retired"
        : "approved";
    const hash = fingerprint(questionText);
    const duplicateKey = `${String(question.subjectId)}:${hash}`;
    if (status !== "retired" && activeFingerprints.has(duplicateKey)) {
      throw new Error(`${databaseName}: duplicate active question detected: ${questionText}`);
    }
    if (status !== "retired") activeFingerprints.add(duplicateKey);
    await questions.updateOne(
      { _id: question._id },
      {
        $set: {
          questionText,
          fingerprint: hash,
          subjectCode: subject.code,
          departmentId: subject.departmentId,
          status,
          isActive: status === "approved",
          usageCount: Math.max(0, Number(question.usageCount ?? 0)),
          revision: Math.max(1, Number(question.revision ?? 1)),
          ...(status === "approved" && !question.approvedAt
            ? { approvedAt: question.createdAt ?? new Date() }
            : {}),
          ...(status === "retired" && !question.retiredAt
            ? {
                retiredAt: question.updatedAt ?? new Date(),
                retirementReason: question.retirementReason ?? "Legacy inactive question",
              }
            : {}),
        },
      },
    );
    migrated += 1;
  }
  await questions.createIndex(
    { departmentId: 1, status: 1, createdBy: 1 },
    { name: "question_governance_scope" },
  );
  await questions.createIndex(
    { subjectId: 1, fingerprint: 1 },
    { name: "question_subject_fingerprint" },
  );
  console.info(`Migrated ${migrated} questions in ${databaseName}`);
}

async function main() {
  if (!mongoUri) throw new Error("MONGODB_URI is required");
  await mongoose.connect(mongoUri, { dbName: masterDatabaseName });
  const tenants = await mongoose.connection.collection("tenants").find({}).toArray();
  for (const tenant of tenants) {
    const databaseName = String(tenant.databaseName ?? "");
    if (!databaseName) throw new Error(`Tenant ${String(tenant.tenantId)} has no databaseName`);
    await migrateTenant(mongoose.connection, databaseName);
  }
}

main()
  .catch((error) => {
    console.error("Question-bank governance migration failed", error);
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());
