import { MentorModel, StudentProfileModel } from "../models";
import { mentorRepository } from "../repositories";

const mentorError = (message: string, status: number) =>
  Object.assign(new Error(message), { status });

export const mentorService = {
  getAll: (filter: Record<string, unknown>, page: number, limit: number) =>
    mentorRepository.list(filter, page, limit),

  getById: (id: string) => mentorRepository.findById(id),

  getForFaculty: (facultyId: string, academicYear: string) =>
    mentorRepository.findByFacultyYear(facultyId, academicYear),

  getMentorForStudent: (studentId: string, academicYear: string) =>
    mentorRepository.findMentorForStudent(studentId, academicYear),

  create: async (data: Record<string, unknown>) => {
    const existing = await MentorModel.exists({
      facultyId: String(data.facultyId),
      academicYear: String(data.academicYear),
    });
    if (existing)
      throw mentorError("This faculty member already has an assignment for the year", 409);
    return mentorRepository.create(data);
  },

  update: (id: string, data: Record<string, unknown>) => mentorRepository.updateById(id, data),

  assignMentee: async (mentorId: string, studentId: string) => {
    const mentor = await MentorModel.findById(mentorId);
    if (!mentor) throw mentorError("Mentor assignment not found", 404);
    if (!mentor.isActive) throw mentorError("This mentor assignment is inactive", 400);
    if (mentor.menteeIds.some((id) => String(id) === studentId)) {
      throw mentorError("Student is already assigned to this mentor", 409);
    }
    if (mentor.menteeIds.length >= mentor.maxMentees) {
      throw mentorError("Mentor capacity has been reached", 400);
    }
    const student = await StudentProfileModel.findOne({ userId: studentId });
    if (!student) throw mentorError("Student profile not found", 404);
    if (String(student.department) !== String(mentor.departmentId)) {
      throw mentorError("Mentor and student must belong to the same department", 400);
    }
    const assignedElsewhere = await MentorModel.exists({
      _id: { $ne: mentor._id },
      academicYear: mentor.academicYear,
      menteeIds: studentId,
      isActive: true,
    });
    if (assignedElsewhere) {
      throw mentorError("Student already has an active mentor for this academic year", 409);
    }
    const updated = await mentorRepository.addMentee(mentorId, studentId);
    await StudentProfileModel.updateOne(
      { userId: studentId },
      { $set: { mentor: mentor.facultyId } },
    );
    return updated;
  },

  syncMentees: async (mentorId: string, studentIds: string[]) => {
    const uniqueStudentIds = [...new Set(studentIds.map(String))];
    const mentor = await MentorModel.findById(mentorId);
    if (!mentor) throw mentorError("Mentor assignment not found", 404);
    if (!mentor.isActive) throw mentorError("This mentor assignment is inactive", 400);
    if (uniqueStudentIds.length > mentor.maxMentees) {
      throw mentorError(`Select no more than ${mentor.maxMentees} mentees`, 400);
    }

    const profiles = await StudentProfileModel.find({ userId: { $in: uniqueStudentIds } })
      .select("userId department")
      .lean();
    if (profiles.length !== uniqueStudentIds.length) {
      throw mentorError("One or more selected student profiles are unavailable", 404);
    }
    if (profiles.some((profile) => String(profile.department) !== String(mentor.departmentId))) {
      throw mentorError("Every selected student must belong to the mentor department", 400);
    }
    const assignedElsewhere = await MentorModel.exists({
      _id: { $ne: mentor._id },
      academicYear: mentor.academicYear,
      menteeIds: { $in: uniqueStudentIds },
      isActive: true,
    });
    if (assignedElsewhere) {
      throw mentorError("One or more students already have an active mentor for this year", 409);
    }

    const previousIds = mentor.menteeIds.map(String);
    const addedIds = uniqueStudentIds.filter((id) => !previousIds.includes(id));
    const removedIds = previousIds.filter((id) => !uniqueStudentIds.includes(id));
    const updated = await MentorModel.findByIdAndUpdate(
      mentorId,
      { $set: { menteeIds: uniqueStudentIds } },
      { new: true },
    ).lean();
    if (addedIds.length) {
      await StudentProfileModel.updateMany(
        { userId: { $in: addedIds } },
        { $set: { mentor: mentor.facultyId } },
      );
    }
    if (removedIds.length) {
      await StudentProfileModel.updateMany(
        { userId: { $in: removedIds }, mentor: mentor.facultyId },
        { $unset: { mentor: 1 } },
      );
    }
    return updated;
  },

  logMeeting: async (mentorId: string, meeting: Record<string, unknown>, conductedBy: string) => {
    const mentor = await MentorModel.findById(mentorId);
    if (!mentor) throw mentorError("Mentor assignment not found", 404);
    if (String(mentor.facultyId) !== conductedBy) {
      throw mentorError("You can log meetings only for your own mentees", 403);
    }
    const studentId = String(meeting.studentId ?? "");
    if (!mentor.menteeIds.some((id) => String(id) === studentId)) {
      throw mentorError("Select a student assigned to this mentor", 400);
    }
    return mentorRepository.addMeeting(mentorId, { ...meeting, conductedBy });
  },
};
