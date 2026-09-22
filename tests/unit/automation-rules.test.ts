import { dateOnly, previousDate, getLocalScheduleDetails } from "@/lib/automation/engine";

describe("Unit Tests: Automation Rules & Engine Helpers", () => {
  it("formats dateOnly string in YYYY-MM-DD", () => {
    const d = new Date("2026-09-15T15:30:00.000Z");
    expect(dateOnly(d)).toBe("2026-09-15");
  });

  it("calculates previousDate accurately across month boundaries", () => {
    const marchFirst = new Date("2026-03-01T00:00:00.000Z");
    expect(previousDate(marchFirst)).toBe("2026-02-28");

    const janFirst = new Date("2026-01-01T00:00:00.000Z");
    expect(previousDate(janFirst)).toBe("2025-12-31");
  });

  it("extracts local schedule details with timezone", () => {
    const fixedDate = new Date("2026-09-15T12:00:00.000Z");
    const details = getLocalScheduleDetails(fixedDate, "UTC");

    expect(details.localDate).toBe("2026-09-15");
    expect(details.timeString).toBe("12:00");
    expect(details.weekday).toBe("tuesday");
  });

  describe("Automation Evaluation Rules", () => {
    type Task = {
      id: string;
      status: string;
      due_at: string | null;
      due_date: string | null;
    };

    function isTaskOverdue(task: Task, asOf: Date): boolean {
      const activeStatuses = ["backlog", "todo", "in_progress", "blocked", "review"];
      if (!activeStatuses.includes(task.status)) return false;

      const asOfIso = asOf.toISOString();
      const asOfDate = dateOnly(asOf);

      if (task.due_at && task.due_at < asOfIso) return true;
      if (task.due_date && task.due_date < asOfDate) return true;

      return false;
    }

    it("identifies active task with past due_date as overdue", () => {
      const now = new Date("2026-09-15T12:00:00.000Z");
      const overdueTask: Task = {
        id: "t-1",
        status: "in_progress",
        due_at: null,
        due_date: "2026-09-14",
      };

      expect(isTaskOverdue(overdueTask, now)).toBe(true);
    });

    it("does not flag completed or cancelled tasks as overdue", () => {
      const now = new Date("2026-09-15T12:00:00.000Z");
      const completedTask: Task = {
        id: "t-2",
        status: "completed",
        due_at: "2026-09-10T12:00:00.000Z",
        due_date: "2026-09-10",
      };
      const cancelledTask: Task = {
        id: "t-3",
        status: "cancelled",
        due_at: "2026-09-10T12:00:00.000Z",
        due_date: "2026-09-10",
      };

      expect(isTaskOverdue(completedTask, now)).toBe(false);
      expect(isTaskOverdue(cancelledTask, now)).toBe(false);
    });

    it("does not flag tasks with future due dates", () => {
      const now = new Date("2026-09-15T12:00:00.000Z");
      const futureTask: Task = {
        id: "t-4",
        status: "todo",
        due_at: null,
        due_date: "2026-09-20",
      };

      expect(isTaskOverdue(futureTask, now)).toBe(false);
    });
  });
});
