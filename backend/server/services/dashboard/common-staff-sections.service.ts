import { AcademicCalendarModel } from "../../models/academic-calendar.model";
import { EventModel } from "../../models/event.model";
import { LeaveRequestModel } from "../../models/leave.model";
import { NoticeModel } from "../../models/notice.model";
import { UserModel } from "../../models/user.model";

const now = () => new Date();

/** Shared, read-only widgets used by staff-facing role dashboards. */
export async function buildCommonStaffSections(userId: string) {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const monthStart = new Date(todayStart.getFullYear(), todayStart.getMonth(), 1);
  const monthEnd = new Date(todayStart.getFullYear(), todayStart.getMonth() + 2, 0, 23, 59, 59);

  const [user, calendar, upcomingEvents, notices, leaveStatus] = await Promise.all([
    UserModel.findById(userId).select("name email avatar employeeId roles").lean(),
    AcademicCalendarModel.findOne({ isPublished: true }).sort({ semesterStartDate: -1 }).lean(),
    EventModel.find({
      isPublished: true,
      endDate: { $gte: now() },
    } as unknown as Parameters<typeof EventModel.find>[0])
      .sort({ startDate: 1 })
      .limit(5)
      .select("title eventType startDate endDate venue")
      .lean(),
    NoticeModel.find({
      isPublished: true,
      $or: [{ expiryDate: { $gte: now() } }, { expiryDate: null }],
    } as unknown as Parameters<typeof NoticeModel.find>[0])
      .sort({ publishedAt: -1, createdAt: -1 })
      .limit(5)
      .select("title noticeType priority publishedAt createdAt")
      .lean(),
    LeaveRequestModel.find({ employeeId: userId })
      .sort({ createdAt: -1 })
      .limit(5)
      .select("leaveType fromDate toDate status reason createdAt")
      .lean(),
  ]);

  const schedules = (calendar?.events ?? [])
    .filter(
      (event) => new Date(event.startDate) >= monthStart && new Date(event.startDate) <= monthEnd,
    )
    .map((event) => ({
      title: event.title,
      startDate: event.startDate,
      endDate: event.endDate,
      category: event.category,
    }))
    .sort((left, right) => +new Date(left.startDate) - +new Date(right.startDate))
    .slice(0, 10);

  const profileSummary = user
    ? {
        name: user.name,
        avatar: user.avatar ?? null,
        idCode: user.employeeId ?? null,
        primaryRole: user.roles?.[0] ?? null,
      }
    : null;

  return {
    profileSummary,
    schedules,
    upcomingEvents,
    notices,
    leaveStatus,
    topNotice: notices[0]?.title ?? null,
  };
}
