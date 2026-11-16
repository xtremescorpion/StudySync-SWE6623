/*
 * CalendarService: Assignment 3, Figure 2.  Application layer.
 *
 * Attributes:  accountEmail, isLinked
 * Operations:  syncDeadlines(), exportICalendar()
 *
 * Realises FR 31 and FR 34.  User 1 --- 0..1 CalendarService.
 *
 * STATUS: exportICalendar() is implemented; syncDeadlines() is not.
 * Both were Could priority in Assignment 2. Export needs no third party, so it
 * is finished. Google Calendar sync needs OAuth credentials that are not
 * configured, so it is stubbed. Assignment 3 isolates the external API behind
 * this class, so completing it touches only this file.
 */
import Assignment from "../models/Assignment.js";
import Course from "../models/Course.js";

/* Escape the characters iCalendar treats specially (RFC 5545). */
function esc(text) {
  return String(text).replace(/([,;\\])/g, "\\$1").replace(/\n/g, "\\n");
}

/* Format a Date as an iCalendar UTC timestamp. */
function stamp(date) {
  return new Date(date).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

export class CalendarService {
  constructor({ accountEmail = null, isLinked = false } = {}) {
    this.accountEmail = accountEmail;
    this.isLinked = isLinked;
  }

  /*
   * FR 31: push assignment deadlines to the student's Google Calendar.
   * NOT IMPLEMENTED: requires Google OAuth credentials.
   */
  async syncDeadlines() {
    throw Object.assign(
      new Error(
        "Google Calendar sync is not implemented yet. This was a Could-priority " +
          "requirement (FR 31) and needs OAuth credentials. Use the iCalendar " +
          "export (FR 34) instead, which produces a file any calendar can import."
      ),
      { status: 501 }
    );
  }

  /*
   * FR 34: export every open assignment as an .ics file.
   * Fully implemented; the file imports into Google Calendar, Outlook or Apple
   * Calendar, which covers most of what FR 31 was for.
   */
  async exportICalendar(userId) {
    const assignments = await Assignment.find({
      userId,
      status: { $ne: "completed" },
    }).sort({ dueDate: 1 });

    const courses = await Course.find({ userId });
    const codeOf = new Map(courses.map((c) => [c.courseId, c.code]));

    const lines = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//StudySync//Study Planner//EN",
      "CALSCALE:GREGORIAN",
      "METHOD:PUBLISH",
      "X-WR-CALNAME:StudySync Deadlines",
    ];

    for (const a of assignments) {
      const due = new Date(a.dueDate);
      const start = new Date(due.getTime() - 60 * 60 * 1000); // one-hour block
      lines.push(
        "BEGIN:VEVENT",
        `UID:studysync-task-${a.taskId}@studysync.local`,
        `DTSTAMP:${stamp(new Date())}`,
        `DTSTART:${stamp(start)}`,
        `DTEND:${stamp(due)}`,
        `SUMMARY:${esc(`${codeOf.get(a.courseId) || "Course"}: ${a.title}`)}`,
        `DESCRIPTION:${esc(
          `Estimated effort ${a.estimatedHours}h, worth ${a.gradeWeight}% of the course grade.`
        )}`,
        "BEGIN:VALARM",
        "TRIGGER:-P1D",
        "ACTION:DISPLAY",
        `DESCRIPTION:${esc(`"${a.title}" is due tomorrow`)}`,
        "END:VALARM",
        "END:VEVENT"
      );
    }

    lines.push("END:VCALENDAR");
    return lines.join("\r\n");
  }
}

export default new CalendarService();
