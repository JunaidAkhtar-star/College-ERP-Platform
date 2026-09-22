/**
 * Replaces GIET's latest active draft Semester 1 timetable with a complete
 * Monday-Saturday test schedule. A one-time copy of the original timetable is
 * stored in migrationbackups before the update.
 */
import "dotenv/config";
import mongoose, { Types } from "mongoose";

const DATABASE_NAME = "tenant_giet";
const PROGRAM = "B.Tech Computer Science & Engineering";
const dryRun = process.argv.includes("--dry-run");
const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const teachingTimes = [
  ["09:00", "09:50"],
  ["09:50", "10:40"],
  ["10:50", "11:40"],
  ["11:40", "12:30"],
  ["13:20", "14:10"],
  ["14:10", "15:00"],
];

async function main() {
  const mongoUri = process.env["MONGODB_URI"];
  if (!mongoUri) throw new Error("MONGODB_URI is required");
  await mongoose.connect(mongoUri, { dbName: DATABASE_NAME });
  const db = mongoose.connection.db;
  if (!db) throw new Error(`Database ${DATABASE_NAME} is unavailable`);

  const timetable = await db
    .collection("timetables")
    .findOne(
      { program: PROGRAM, semester: 1, academicYear: "2026-27", isActive: true, isApproved: false },
      { sort: { updatedAt: -1 } },
    );
  if (!timetable) throw new Error("No active draft Semester 1 timetable was found");
  const branchIds: string[] = (timetable.branchDepartmentIds ?? []).map((id: Types.ObjectId) =>
    String(id),
  );
  const branches: string[] = (timetable.branches ?? []).map(String);
  if (branchIds.length < 2 || branchIds.length !== branches.length) {
    throw new Error("The target timetable must contain at least two valid branch lanes");
  }

  const curriculumId = String(timetable.curriculumId ?? "");
  const curriculum = await db
    .collection("curriculums")
    .findOne({ _id: new Types.ObjectId(curriculumId) });
  const semesterPlan = curriculum?.semesterPlans?.find(
    (plan: { semesterNo: number }) => Number(plan.semesterNo) === 1,
  );
  if (!semesterPlan) throw new Error("Semester 1 curriculum plan was not found");
  const plannedIds = semesterPlan.subjects.map(
    (entry: { subjectId: Types.ObjectId }) => entry.subjectId,
  );
  const subjects = await db
    .collection("subjects")
    .find({
      _id: { $in: plannedIds },
      departmentId: { $in: branchIds.map((id: string) => new Types.ObjectId(id)) },
      isActive: true,
    })
    .sort({ departmentCode: 1, code: 1 })
    .toArray();
  const subjectsByDepartment = new Map<string, typeof subjects>();
  for (const id of branchIds) {
    subjectsByDepartment.set(
      id,
      subjects.filter((subject) => String(subject.departmentId) === id),
    );
    if (!subjectsByDepartment.get(id)?.length)
      throw new Error(`No Semester 1 subjects found for branch ${id}`);
  }

  const faculty = await db
    .collection("users")
    .find({ status: "active", roles: { $in: ["faculty", "hod"] } })
    .sort({ name: 1 })
    .toArray();
  const profiles = await db
    .collection("facultyprofiles")
    .find({ userId: { $in: faculty.map((row) => row._id) } })
    .toArray();
  if (faculty.length < branchIds.length * 3)
    throw new Error("Not enough active faculty for a clash-free test timetable");
  const facultyCode = new Map(
    profiles.map((profile) => [String(profile.userId), profile.employeeId]),
  );

  const spaces = await db.collection("facilityspaces").find({ status: "active" }).toArray();
  const classrooms = spaces.filter((space) => space.type === "classroom");
  const laboratories = spaces.filter((space) => space.type === "laboratory");
  if (classrooms.length < branchIds.length || !laboratories.length) {
    throw new Error("The timetable requires one classroom per branch and at least one laboratory");
  }

  const slots: Array<Record<string, unknown>> = [];
  const commonSubject =
    subjects.find((subject) => subject.code === "CSE2611") ??
    subjectsByDepartment.get(branchIds.find((_, index) => branches[index] === "CSE") ?? "")?.[0] ??
    subjects[0]!;
  for (const [dayIndex, day] of days.entries()) {
    for (const [branchIndex, branchDepartmentId] of branchIds.entries()) {
      const branchSubjects = subjectsByDepartment.get(branchDepartmentId)!;
      const facultyPoolStart = branchIndex * Math.floor(faculty.length / branchIds.length);
      for (const [periodIndex, [startTime, endTime]] of teachingTimes.entries()) {
        const combinedPeriod = periodIndex === 0 && [0, 2, 4].includes(dayIndex);
        if (combinedPeriod && branchIndex > 0) continue;
        const subject = combinedPeriod
          ? commonSubject
          : branchSubjects[
              (dayIndex * teachingTimes.length + periodIndex) % branchSubjects.length
            ]!;
        const teacher = faculty[(facultyPoolStart + periodIndex) % faculty.length]!;
        const practical = subject.type === "Practical" || subject.hasLabComponent === true;
        const room = practical
          ? laboratories[branchIndex % laboratories.length]!
          : classrooms[branchIndex % classrooms.length]!;
        slots.push({
          _id: new Types.ObjectId(),
          day,
          periodNo: periodIndex + 1,
          startTime,
          endTime,
          slotKind: "teaching",
          subjectId: subject._id,
          subjectCode: subject.code,
          subjectShortName: subject.shortName,
          subjectName: subject.name,
          facultyId: teacher._id,
          facultyName: teacher.name,
          facultyCode: facultyCode.get(String(teacher._id)),
          roomId: room._id,
          roomNo: room.code,
          classType: practical ? "lab" : "theory",
          branches: combinedPeriod ? branches : [branches[branchIndex]],
          isCombined: combinedPeriod,
          branch: combinedPeriod ? undefined : branches[branchIndex],
          branchDepartmentId: new Types.ObjectId(branchDepartmentId),
          branchDepartmentIds: combinedPeriod
            ? branchIds.map((id: string) => new Types.ObjectId(id))
            : [new Types.ObjectId(branchDepartmentId)],
        });
      }
    }
    for (const [periodNo, block] of [
      { title: "Lunch Break", startTime: "12:30", endTime: "13:20", slotKind: "break" },
      {
        title: "Mentoring / Club Activity",
        startTime: "15:10",
        endTime: "16:00",
        slotKind: "activity",
      },
      { title: "Library / Self Study", startTime: "16:00", endTime: "16:50", slotKind: "activity" },
    ].entries()) {
      slots.push({
        _id: new Types.ObjectId(),
        day,
        periodNo: periodNo + 7,
        startTime: block.startTime,
        endTime: block.endTime,
        slotKind: block.slotKind,
        title: block.title,
        subjectCode: "",
        subjectName: block.title,
        facultyName: "",
        roomNo: "",
        classType: "theory",
        branches,
        branchDepartmentIds: branchIds.map((id: string) => new Types.ObjectId(id)),
        isCombined: true,
      });
    }
  }

  const migrationKey = `giet-complete-timetable-${String(timetable._id)}-v1`;
  if (!dryRun && !(await db.collection("migrationbackups").findOne({ migrationKey }))) {
    await db.collection("migrationbackups").insertOne({
      migrationKey,
      createdAt: new Date(),
      timetable: structuredClone(timetable),
    });
  }
  if (!dryRun) {
    await db.collection("timetables").updateOne(
      { _id: timetable._id, isApproved: false },
      {
        $set: {
          scheduleStartTime: "09:00",
          scheduleEndTime: "17:00",
          slots,
          updatedAt: new Date(),
        },
      },
    );
  }

  const usedSubjects = new Set(slots.map((slot) => String(slot.subjectCode ?? "")).filter(Boolean));
  console.info(
    JSON.stringify(
      {
        dryRun,
        timetableId: String(timetable._id),
        branches,
        totalSlots: slots.length,
        teachingSlots: slots.filter((slot) => slot.slotKind === "teaching").length,
        sharedBlocks: slots.filter((slot) => slot.slotKind !== "teaching").length,
        availableSubjects: subjects.length,
        usedSubjects: usedSubjects.size,
      },
      null,
      2,
    ),
  );
}

main()
  .catch((error) => {
    console.error("GIET complete timetable preparation failed", error);
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());
