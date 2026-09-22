/** Backfills class scope and immutable lifecycle metadata for legacy study materials. */
import "dotenv/config";
import mongoose, { type Connection } from "mongoose";

const mongoUri = process.env["MONGODB_URI"] ?? "";
const masterDatabaseName = process.env["MASTER_DB_NAME"] ?? "devvelocity_master";
const VALID_STATUSES = new Set(["draft", "published", "archived"]);

async function migrateTenant(connection: Connection, databaseName: string) {
  const tenantDb = connection.useDb(databaseName, { useCache: true });
  const materials = tenantDb.collection("studymaterials");
  const sections = tenantDb.collection("sections");
  const curricula = tenantDb.collection("curricula");
  const subjects = tenantDb.collection("subjects");
  let migrated = 0;

  for await (const material of materials.find({})) {
    const subject = await subjects.findOne({ _id: material.subjectId });
    if (!subject) {
      throw new Error(`${databaseName}: material ${String(material._id)} references no subject`);
    }
    let sectionIds = Array.isArray(material.sectionIds) ? material.sectionIds : [];
    let academicYear = material.academicYear;
    if (!sectionIds.length) {
      const candidates = await sections
        .find({
          departmentId: subject.departmentId,
          program: material.program,
          semesterNo: material.semester,
        })
        .toArray();
      const eligible = [];
      for (const section of candidates) {
        const curriculum = await curricula.findOne({ _id: section.curriculumId, isActive: true });
        const semesterPlan = Array.isArray(curriculum?.semesterPlans)
          ? curriculum.semesterPlans.find(
              (plan: Record<string, unknown>) =>
                Number(plan.semesterNo) === Number(section.semesterNo),
            )
          : undefined;
        const assigned = Array.isArray((semesterPlan as { subjects?: unknown[] })?.subjects)
          ? (semesterPlan as { subjects: Array<{ subjectId?: unknown }> }).subjects.some(
              (row) => String(row.subjectId) === String(material.subjectId),
            )
          : false;
        if (assigned) eligible.push(section);
      }
      const academicYears = [...new Set(eligible.map((section) => String(section.academicYear)))];
      if (academicYears.length !== 1 || !eligible.length) {
        throw new Error(
          `${databaseName}: material ${String(material._id)} has ambiguous section cohort (${academicYears.join(", ") || "none"})`,
        );
      }
      academicYear = academicYears[0];
      sectionIds = eligible.map((section) => section._id);
    }
    const status = VALID_STATUSES.has(String(material.status))
      ? material.status
      : material.isActive === false
        ? "archived"
        : "published";
    await materials.updateOne(
      { _id: material._id },
      {
        $set: {
          subjectCode: subject.code,
          departmentId: subject.departmentId,
          sectionIds,
          academicYear,
          externalLink: material.externalLink ?? material.externalUrl,
          status,
          isActive: status === "published",
          version: Math.max(1, Number(material.version ?? 1)),
          viewCount: Math.max(0, Number(material.viewCount ?? 0)),
          downloadCount: Math.max(0, Number(material.downloadCount ?? 0)),
          ...(status === "published" && !material.publishedAt
            ? { publishedAt: material.createdAt ?? new Date() }
            : {}),
          ...(status === "archived" && !material.archivedAt
            ? { archivedAt: material.updatedAt ?? new Date() }
            : {}),
        },
        $unset: { externalUrl: "" },
      },
    );
    migrated += 1;
  }
  await materials.createIndex(
    { sectionIds: 1, status: 1, subjectId: 1 },
    { name: "material_section_lifecycle" },
  );
  const accesses = tenantDb.collection("studymaterialaccesses");
  await accesses.createIndex(
    { materialId: 1, userId: 1, accessType: 1, accessDate: 1 },
    { unique: true, name: "material_daily_access_unique" },
  );
  await accesses.createIndex(
    { createdAt: 1 },
    { expireAfterSeconds: 400 * 24 * 60 * 60, name: "material_access_retention" },
  );
  console.info(`Migrated ${migrated} study materials in ${databaseName}`);
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
    console.error("Study-material lifecycle migration failed", error);
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());
