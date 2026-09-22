import "dotenv/config";
import mongoose, { Types } from "mongoose";

const DATABASE_NAME = process.env.DEMO_TENANT_DB || "tenant_giet";
const DEMO_TAG = "dean-dashboard-demo-v1";
const cleanup = process.argv.includes("--cleanup");
const programs = [
  "B.Tech Computer Science & Engineering",
  "B.Tech Electronics & Communication Engineering",
  "Bachelor of Computer Applications",
  "Master of Business Administration",
];

function dateAt(daysFromToday: number) {
  const date = new Date();
  date.setHours(9, 0, 0, 0);
  date.setDate(date.getDate() + daysFromToday);
  return date;
}

async function removeDemoData() {
  const collections = [
    "studentprofiles",
    "users",
    "facultyprofiles",
    "studentattendancesummaries",
    "attendancerecords",
    "semesterresults",
    "facultyworkloads",
    "courseprogresses",
    "events",
    "notices",
    "academiccalendars",
  ];
  const results = await Promise.all(
    collections.map(async (name) => ({
      name,
      deleted: (await mongoose.connection.collection(name).deleteMany({ demoTag: DEMO_TAG }))
        .deletedCount,
    })),
  );
  console.table(results);
}

async function seed() {
  await removeDemoData();
  const now = new Date();
  const departments = await mongoose.connection
    .collection("departments")
    .find({ status: "Active" })
    .project({ _id: 1, code: 1, name: 1 })
    .limit(7)
    .toArray();
  if (!departments.length)
    throw new Error("No active departments exist; configure academic departments first.");

  const studentUsers = Array.from({ length: 160 }, (_, index) => ({
    _id: new Types.ObjectId(),
    name: `Dashboard Demo Student ${String(index + 1).padStart(3, "0")}`,
    email: `dean.demo.student.${index + 1}@example.invalid`,
    roles: ["student"],
    status: "active",
    demoTag: DEMO_TAG,
    createdAt: now,
    updatedAt: now,
  }));
  const studentProfiles = studentUsers.map((user, index) => {
    const department = departments[index % departments.length];
    return {
      _id: new Types.ObjectId(),
      userId: user._id,
      firstName: "Demo",
      lastName: `Student ${index + 1}`,
      rollNumber: `DEMO${String(index + 1).padStart(4, "0")}`,
      collegeEmail: user.email,
      status: "active",
      program: programs[index % programs.length],
      department: department._id,
      currentSemester: (index % 8) + 1,
      section: ["A", "B", "C"][index % 3],
      academicYear: "2026-27",
      demoTag: DEMO_TAG,
      createdAt: now,
      updatedAt: now,
    };
  });
  await mongoose.connection.collection("users").insertMany(studentUsers);
  await mongoose.connection.collection("studentprofiles").insertMany(studentProfiles);

  const summaries = studentProfiles.map((profile, index) => {
    const percentage = 62 + ((index * 7) % 37);
    return {
      _id: new Types.ObjectId(),
      studentId: profile.userId,
      totalClasses: 120,
      presentCount: Math.round((percentage / 100) * 120),
      absentCount: 120 - Math.round((percentage / 100) * 120),
      percentage,
      isShortage: percentage < 75,
      demoTag: DEMO_TAG,
      createdAt: now,
      updatedAt: now,
    };
  });
  await mongoose.connection.collection("studentattendancesummaries").insertMany(summaries);

  const attendanceRecords = Array.from({ length: 30 }, (_, dayIndex) =>
    departments.map((department, departmentIndex) => {
      const totalStrength = 80 + departmentIndex * 9;
      const percentage = 78 + ((dayIndex * 3 + departmentIndex * 5) % 19);
      const totalPresent = Math.round((percentage / 100) * totalStrength);
      return {
        _id: new Types.ObjectId(),
        departmentId: department._id,
        subjectId: new Types.ObjectId(),
        periodNumber: departmentIndex + 1,
        section: `DEMO-${departmentIndex + 1}`,
        date: dateAt(dayIndex - 29),
        totalStrength,
        totalPresent,
        totalAbsent: totalStrength - totalPresent,
        demoTag: DEMO_TAG,
        createdAt: now,
        updatedAt: now,
      };
    }),
  ).flat();
  await mongoose.connection.collection("attendancerecords").insertMany(attendanceRecords);

  const results = studentProfiles.map((profile, index) => {
    const cgpa = Number((4.5 + ((index * 13) % 56) / 10).toFixed(1));
    return {
      _id: new Types.ObjectId(),
      studentId: profile.userId,
      departmentId: profile.department,
      semester: profile.currentSemester,
      academicYear: "2026-27",
      cgpa,
      sgpa: Math.min(10, cgpa + 0.2),
      result: cgpa >= 5 ? "PASS" : "FAIL",
      isPublished: true,
      demoTag: DEMO_TAG,
      createdAt: now,
      updatedAt: now,
    };
  });
  await mongoose.connection.collection("semesterresults").insertMany(results);

  const facultyUsers = Array.from({ length: 21 }, (_, index) => ({
    _id: new Types.ObjectId(),
    name: `Dr. Demo Faculty ${String(index + 1).padStart(2, "0")}`,
    email: `dean.demo.faculty.${index + 1}@example.invalid`,
    roles: ["faculty"],
    status: "active",
    demoTag: DEMO_TAG,
    createdAt: now,
    updatedAt: now,
  }));
  await mongoose.connection.collection("users").insertMany(facultyUsers);
  await mongoose.connection.collection("facultyprofiles").insertMany(
    facultyUsers.map((user, index) => ({
      _id: new Types.ObjectId(),
      userId: user._id,
      employeeId: `DEMO-F${String(index + 1).padStart(3, "0")}`,
      collegeEmail: user.email,
      firstName: "Demo",
      lastName: `Faculty ${index + 1}`,
      department: departments[index % departments.length]._id,
      status: "active",
      demoTag: DEMO_TAG,
      createdAt: now,
      updatedAt: now,
    })),
  );
  await mongoose.connection.collection("facultyworkloads").insertMany(
    facultyUsers.map((user, index) => ({
      _id: new Types.ObjectId(),
      facultyId: user._id,
      departmentId: departments[index % departments.length]._id,
      academicYear: "2026-27",
      semesterType: "odd",
      teachingAssignments: Array.from({ length: 3 + (index % 4) }, (_, assignmentIndex) => ({
        subjectId: new Types.ObjectId(),
        subjectCode: `D${index + 1}${assignmentIndex + 1}`,
        subjectName: `Demo Subject ${assignmentIndex + 1}`,
        program: programs[index % programs.length],
        semester: (index % 8) + 1,
        section: "A",
        classType: "theory",
        weeklyHours: 3,
        totalHours: 45,
      })),
      extraDuties: [],
      totalWeeklyTeachingHours: 12 + (index % 9),
      totalWeeklyHours: 18 + (index % 10),
      isApproved: index % 5 !== 0,
      demoTag: DEMO_TAG,
      createdAt: now,
      updatedAt: now,
    })),
  );

  await mongoose.connection.collection("courseprogresses").insertMany(
    departments.flatMap((department, departmentIndex) =>
      Array.from({ length: 6 }, (_, index) => ({
        _id: new Types.ObjectId(),
        lessonPlanId: new Types.ObjectId(),
        academicYear: "2026-27",
        sectionId: new Types.ObjectId(),
        curriculumId: new Types.ObjectId(),
        semesterType: "odd",
        subjectId: new Types.ObjectId(),
        subjectCode: `DEMO-${departmentIndex + 1}-${index + 1}`,
        subjectName: `Dashboard Demo Course ${index + 1}`,
        facultyId: facultyUsers[(departmentIndex * 3 + index) % facultyUsers.length]._id,
        departmentId: department._id,
        program: programs[(departmentIndex + index) % programs.length],
        semester: (index % 8) + 1,
        section: ["A", "B", "C"][index % 3],
        totalPlanedClasses: 45,
        totalConductedClasses: 22 + ((departmentIndex * 4 + index * 3) % 22),
        completionPercentage: 48 + ((departmentIndex * 9 + index * 7) % 49),
        topicEntries: [],
        isComplete: index < 2 + (departmentIndex % 4),
        demoTag: DEMO_TAG,
        createdAt: now,
        updatedAt: now,
      })),
    ),
  );
  await mongoose.connection.collection("events").insertMany(
    Array.from({ length: 8 }, (_, index) => ({
      _id: new Types.ObjectId(),
      title: [
        "Mid Semester Examination",
        "Faculty Development Workshop",
        "Curriculum Review Meeting",
        "Research Colloquium",
        "Project Evaluation",
        "Academic Council Meeting",
        "Industry Guest Lecture",
        "End Semester Examination",
      ][index],
      startDate: dateAt(3 + index * 4),
      endDate: dateAt(3 + index * 4),
      venue: index % 2 ? "Seminar Hall" : "Academic Block",
      description: "Academic event published for Dean dashboard evaluation.",
      eventType: index % 2 ? "seminar" : "workshop",
      targetAudience: ["all"],
      coordinators: [],
      registrations: [],
      registrationCount: 0,
      isPublished: true,
      isDeleted: false,
      createdBy: facultyUsers[index % facultyUsers.length]._id,
      demoTag: DEMO_TAG,
      createdAt: now,
      updatedAt: now,
    })),
  );
  await mongoose.connection.collection("notices").insertMany(
    Array.from({ length: 6 }, (_, index) => ({
      _id: new Types.ObjectId(),
      title: [
        "Mid-semester examination schedule published",
        "Course progress review due this week",
        "Faculty workload verification reminder",
        "Academic calendar revision approved",
        "Research proposal review meeting",
        "Attendance shortage review required",
      ][index],
      content: "Published academic update for Dean dashboard evaluation.",
      noticeType: "global",
      priority: index < 2 ? "high" : "normal",
      isPublished: true,
      isDeleted: false,
      publishedAt: dateAt(-index),
      expiryDate: dateAt(45),
      readCount: index * 7,
      createdBy: facultyUsers[index % facultyUsers.length]._id,
      demoTag: DEMO_TAG,
      createdAt: now,
      updatedAt: now,
    })),
  );

  const semesterStartDate = new Date(now.getFullYear(), 6, 15);
  const semesterEndDate = new Date(now.getFullYear(), 11, 20);
  await mongoose.connection.collection("academiccalendars").insertOne({
    _id: new Types.ObjectId(),
    academicYear: "2026-27",
    semesterType: "odd",
    semesterStartDate,
    semesterEndDate,
    internalExamStartDate: dateAt(12),
    internalExamEndDate: dateAt(18),
    universityExamStartDate: dateAt(75),
    universityExamEndDate: dateAt(90),
    vacationStartDate: dateAt(95),
    vacationEndDate: dateAt(110),
    totalWorkingDays: 92,
    isPublished: true,
    publishedAt: now,
    publishedBy: facultyUsers[0]._id,
    createdBy: facultyUsers[0]._id,
    events: [
      {
        _id: new Types.ObjectId(),
        title: "Semester Commencement & Orientation",
        description: "Orientation program for all enrolled semester students.",
        startDate: dateAt(-20),
        endDate: dateAt(-20),
        category: "technical",
        affectedRoles: ["all"],
      },
      {
        _id: new Types.ObjectId(),
        title: "Mid-Semester Examinations",
        description: "Continuous internal assessment 1 for all departments.",
        startDate: dateAt(12),
        endDate: dateAt(18),
        category: "internal_exam",
        affectedRoles: ["all"],
      },
      {
        _id: new Types.ObjectId(),
        title: "Faculty Development Workshop",
        description: "Pedagogy and outcome-based curriculum development workshop.",
        startDate: dateAt(24),
        endDate: dateAt(26),
        category: "technical",
        affectedRoles: ["faculty", "dean_academic", "hod"],
      },
      {
        _id: new Types.ObjectId(),
        title: "Annual Technical Symposium",
        description: "Departmental project presentations and coding hackathon.",
        startDate: dateAt(35),
        endDate: dateAt(37),
        category: "technical",
        affectedRoles: ["all"],
      },
      {
        _id: new Types.ObjectId(),
        title: "Diwali & Autumn Break",
        description: "Institutional festival holidays.",
        startDate: dateAt(45),
        endDate: dateAt(50),
        category: "holiday",
        affectedRoles: ["all"],
      },
      {
        _id: new Types.ObjectId(),
        title: "End Semester Theory & Practical Examinations",
        description: "University final examinations and evaluation.",
        startDate: dateAt(75),
        endDate: dateAt(90),
        category: "university_exam",
        affectedRoles: ["all"],
      },
    ],
    demoTag: DEMO_TAG,
    createdAt: now,
    updatedAt: now,
  });

  console.log(`Seeded reversible Dean dashboard demo data in ${DATABASE_NAME}.`);
  console.log(`Tag: ${DEMO_TAG}`);
  console.log("Cleanup: pnpm demo:dean-dashboard:cleanup");
}

async function main() {
  if (!process.env.MONGODB_URI) throw new Error("MONGODB_URI is not configured.");
  await mongoose.connect(process.env.MONGODB_URI, { dbName: DATABASE_NAME });
  try {
    if (cleanup) await removeDemoData();
    else await seed();
  } finally {
    await mongoose.disconnect();
  }
}

void main().catch((error: Error) => {
  console.error(error.message);
  process.exit(1);
});
