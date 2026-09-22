/**
 * Idempotently prepares GIET's 2026 B.Tech CSE curriculum for full timetable testing.
 * Existing catalogue subjects and semester mappings are preserved.
 * Run: pnpm migrate:giet-timetable-catalog [--dry-run]
 */
import "dotenv/config";
import mongoose, { Types } from "mongoose";

const DATABASE_NAME = "tenant_giet";
const PROGRAM = "B.Tech Computer Science & Engineering";
const dryRun = process.argv.includes("--dry-run");

const modules: Record<string, string[][]> = {
  CSE: [
    ["Programming Fundamentals", "Discrete Mathematics", "Programming Laboratory"],
    ["Object Oriented Programming", "Digital Logic", "OOP Laboratory"],
    ["Data Structures", "Computer Organization", "Data Structures Laboratory"],
    ["Database Management Systems", "Operating Systems", "DBMS Laboratory"],
    ["Computer Networks", "Design and Analysis of Algorithms", "Networks Laboratory"],
    ["Software Engineering", "Artificial Intelligence", "AI and Software Laboratory"],
    ["Cloud Computing", "Machine Learning", "Cloud and ML Laboratory"],
    ["Cyber Security", "Distributed Systems", "Major Project"],
  ],
  "BTECH-EE": [
    ["Basic Electrical Engineering", "Engineering Mathematics I", "Electrical Workshop"],
    ["Circuit Theory", "Engineering Mathematics II", "Circuit Simulation Laboratory"],
    ["Electrical Machines I", "Analog Electronics", "Machines Laboratory I"],
    ["Electrical Machines II", "Power Systems I", "Machines Laboratory II"],
    ["Control Systems", "Power Electronics", "Power Electronics Laboratory"],
    ["Power Systems II", "Microprocessors", "Control Systems Laboratory"],
    ["Renewable Energy Systems", "Electrical Drives", "Drives Laboratory"],
    ["Smart Grid Technology", "High Voltage Engineering", "Major Project"],
  ],
  "BTECH-ME": [
    ["Engineering Mechanics", "Engineering Mathematics I", "Mechanical Workshop"],
    ["Engineering Thermodynamics", "Engineering Mathematics II", "Workshop Practice"],
    ["Strength of Materials", "Manufacturing Processes", "Materials Testing Laboratory"],
    ["Fluid Mechanics", "Theory of Machines", "Fluid Mechanics Laboratory"],
    ["Heat Transfer", "Machine Design I", "Heat Transfer Laboratory"],
    ["IC Engines", "Machine Design II", "Thermal Engineering Laboratory"],
    ["Industrial Engineering", "CAD and CAM", "CAD CAM Laboratory"],
    ["Automobile Engineering", "Robotics and Automation", "Major Project"],
  ],
  "BTECH-CE": [
    ["Engineering Mechanics", "Engineering Mathematics I", "Civil Engineering Workshop"],
    ["Building Materials", "Engineering Mathematics II", "Surveying Practice"],
    ["Strength of Materials", "Surveying", "Surveying Laboratory"],
    ["Structural Analysis I", "Geotechnical Engineering I", "Geotechnical Laboratory"],
    ["Concrete Technology", "Transportation Engineering I", "Concrete Laboratory"],
    ["Structural Analysis II", "Environmental Engineering", "Environmental Laboratory"],
    ["Design of Steel Structures", "Transportation Engineering II", "Transportation Laboratory"],
    ["Construction Management", "Earthquake Engineering", "Major Project"],
  ],
};

const prefixes: Record<string, string> = {
  CSE: "CSE",
  "BTECH-EE": "EE",
  "BTECH-ME": "ME",
  "BTECH-CE": "CE",
};

const shortNameFor = (name: string) =>
  name
    .split(/\s+/)
    .filter((word) => !["and", "of", "the"].includes(word.toLowerCase()))
    .map((word) => word[0]?.toUpperCase())
    .join("")
    .slice(0, 10);

async function main() {
  const mongoUri = process.env["MONGODB_URI"];
  if (!mongoUri) throw new Error("MONGODB_URI is required");
  await mongoose.connect(mongoUri, { dbName: DATABASE_NAME });
  const db = mongoose.connection.db;
  if (!db) throw new Error(`Database ${DATABASE_NAME} is unavailable`);

  const curriculum = await db.collection("curriculums").findOne({
    program: PROGRAM,
    regulationYear: "2026",
    isActive: true,
  });
  if (!curriculum) throw new Error(`Active ${PROGRAM} 2026 curriculum was not found`);
  if (Number(curriculum.totalSemesters) !== 8)
    throw new Error("Target curriculum must have 8 semesters");

  const departmentIds = curriculum._id
    ? await db
        .collection("departments")
        .distinct("_id", { curriculumIds: curriculum._id, status: "Active" })
    : [];
  const departments = await db
    .collection("departments")
    .find({ _id: { $in: departmentIds } })
    .toArray();
  const targetDepartments = departments.filter((department) => modules[String(department.code)]);
  if (targetDepartments.length !== 4) {
    throw new Error(
      `Expected CSE, EE, ME and CE departments; found ${targetDepartments.map((d) => d.code).join(", ")}`,
    );
  }

  const creator =
    (await db.collection("users").findOne({ roles: { $in: ["super_admin", "admin"] } })) ??
    (await db.collection("subjects").findOne({ createdBy: { $exists: true } }));
  const createdBy = creator?._id ?? creator?.createdBy;
  if (!createdBy)
    throw new Error("No administrative user is available for subject audit ownership");

  const migrationKey = "giet-timetable-catalog-2026-v1";
  if (!dryRun && !(await db.collection("migrationbackups").findOne({ migrationKey }))) {
    await db.collection("migrationbackups").insertOne({
      migrationKey,
      createdAt: new Date(),
      curriculum: structuredClone(curriculum),
      existingSubjectIds: await db.collection("subjects").find({}).project({ _id: 1 }).toArray(),
    });
  }

  let created = 0;
  const generatedBySemester = new Map<number, Array<Record<string, unknown>>>();
  for (const department of targetDepartments) {
    const code = String(department.code);
    for (let semester = 1; semester <= 8; semester += 1) {
      for (const [index, name] of modules[code]![semester - 1]!.entries()) {
        const practical = /Laboratory|Workshop|Practice|Project/i.test(name);
        const subjectCode = `${prefixes[code]}26${semester}${index + 1}`;
        const subjectData = {
          code: subjectCode,
          name,
          shortName: shortNameFor(name),
          departmentId: department._id,
          departmentCode: code,
          type: practical ? "Practical" : "Theory",
          category: "Core",
          credits: practical ? 2 : 3,
          lectureHours: practical ? 0 : 3,
          tutorialHours: 0,
          practicalHours: practical ? 2 : 0,
          totalHours: practical ? 2 : 3,
          semester,
          program: PROGRAM,
          internalMarks: 30,
          externalMarks: 70,
          totalMarks: 100,
          passMarksInternal: 12,
          passMarksExternal: 28,
          hasLabComponent: practical,
          isElective: false,
          isActive: true,
          createdBy,
          updatedAt: new Date(),
        };
        let subject = await db.collection("subjects").findOne({ code: subjectCode });
        if (!subject && !dryRun) {
          const result = await db.collection("subjects").insertOne({
            ...subjectData,
            _id: new Types.ObjectId(),
            createdAt: new Date(),
          });
          subject = { ...subjectData, _id: result.insertedId };
          created += 1;
        } else if (!subject) {
          subject = { ...subjectData, _id: new Types.ObjectId() };
          created += 1;
        } else if (!dryRun && subject.shortName !== subjectData.shortName) {
          await db
            .collection("subjects")
            .updateOne(
              { _id: subject._id },
              { $set: { shortName: subjectData.shortName, updatedAt: new Date() } },
            );
          subject.shortName = subjectData.shortName;
        }
        const entry = {
          subjectId: subject._id,
          subjectCode,
          subjectName: name,
          credits: practical ? 2 : 3,
          theoryHours: practical ? 0 : 3,
          labHours: practical ? 2 : 0,
          tutorialHours: 0,
          isElective: false,
          courseOutcomes: [],
        };
        generatedBySemester.set(semester, [...(generatedBySemester.get(semester) ?? []), entry]);
      }
    }
  }

  const existingPlans = Array.isArray(curriculum.semesterPlans) ? curriculum.semesterPlans : [];
  const semesterPlans = Array.from({ length: 8 }, (_, index) => {
    const semesterNo = index + 1;
    const existing = existingPlans.find((plan) => Number(plan.semesterNo) === semesterNo);
    const byId = new Map<string, Record<string, unknown>>();
    for (const entry of [
      ...(existing?.subjects ?? []),
      ...(generatedBySemester.get(semesterNo) ?? []),
    ]) {
      byId.set(String(entry.subjectId), entry);
    }
    const subjects = [...byId.values()];
    return {
      semesterNo,
      subjects,
      totalCredits: subjects.reduce((sum, subject) => sum + Number(subject.credits ?? 0), 0),
      totalTheoryHours: subjects.reduce(
        (sum, subject) => sum + Number(subject.theoryHours ?? 0),
        0,
      ),
      totalLabHours: subjects.reduce((sum, subject) => sum + Number(subject.labHours ?? 0), 0),
    };
  });
  if (!dryRun) {
    await db
      .collection("curriculums")
      .updateOne({ _id: curriculum._id }, { $set: { semesterPlans, updatedAt: new Date() } });
  }
  console.info(
    JSON.stringify(
      {
        dryRun,
        database: DATABASE_NAME,
        program: PROGRAM,
        createdSubjects: created,
        semesterCounts: semesterPlans.map((plan) => ({
          semester: plan.semesterNo,
          subjects: plan.subjects.length,
        })),
      },
      null,
      2,
    ),
  );
}

main()
  .catch((error) => {
    console.error("GIET timetable catalogue migration failed", error);
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());
