describe("Unit Tests: Date & Time Calculations", () => {
  function getLocalDayTime(date: Date, timezone: string) {
    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      weekday: "long",
      hour12: false,
    });
    const parts = formatter.formatToParts(date);
    const get = (type: string) => parts.find((p) => p.type === type)?.value;

    const yyyy = get("year");
    const mm = get("month");
    const dd = get("day");

    let hh = get("hour");
    if (hh === "24") hh = "00";

    const min = get("minute");
    const weekday = get("weekday")?.toLowerCase();

    return {
      localDate: `${yyyy}-${mm}-${dd}`,
      localTime: `${hh}:${min}`,
      weekday: weekday,
    };
  }

  function calculateDurationMinutes(startIso: string, endIso: string): number {
    const start = new Date(startIso).getTime();
    const end = new Date(endIso).getTime();
    if (isNaN(start) || isNaN(end) || end < start) return 0;
    return Math.round((end - start) / 60000);
  }

  it("extracts correct local date and time in UTC", () => {
    const fixedUtc = new Date("2026-09-15T12:30:00.000Z");
    const result = getLocalDayTime(fixedUtc, "UTC");

    expect(result.localDate).toBe("2026-09-15");
    expect(result.localTime).toBe("12:30");
    expect(result.weekday).toBe("tuesday");
  });

  it("handles timezone shifts correctly (e.g. Asia/Karachi UTC+5)", () => {
    // 2026-09-15 20:30 UTC is 2026-09-16 01:30 in Asia/Karachi
    const utcDate = new Date("2026-09-15T20:30:00.000Z");
    const result = getLocalDayTime(utcDate, "Asia/Karachi");

    expect(result.localDate).toBe("2026-09-16");
    expect(result.localTime).toBe("01:30");
    expect(result.weekday).toBe("wednesday");
  });

  it("handles negative timezone shifts (e.g. America/New_York)", () => {
    // 2026-09-15 02:00 UTC is 2026-09-14 22:00 EDT (UTC-4)
    const utcDate = new Date("2026-09-15T02:00:00.000Z");
    const result = getLocalDayTime(utcDate, "America/New_York");

    expect(result.localDate).toBe("2026-09-14");
    expect(result.localTime).toBe("22:00");
    expect(result.weekday).toBe("monday");
  });

  it("calculates duration in minutes accurately", () => {
    const start = "2026-09-15T09:00:00.000Z";
    const end = "2026-09-15T17:30:00.000Z"; // 8.5 hours = 510 minutes

    expect(calculateDurationMinutes(start, end)).toBe(510);
    expect(calculateDurationMinutes(start, start)).toBe(0);
    expect(calculateDurationMinutes(end, start)).toBe(0); // end before start
  });
});
