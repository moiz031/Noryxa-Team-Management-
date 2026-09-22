describe("Unit Tests: Attendance & Late Calculations", () => {
  type AttendanceStatus = "present" | "late" | "absent" | "half_day" | "remote" | "excused";

  type LateCalculationResult = {
    isLate: boolean;
    minutesLate: number;
    status: AttendanceStatus;
  };

  function evaluateAttendance(
    scheduleStartTime: string | null,
    actualCheckInTime: string,
    gracePeriodMinutes = 0,
    isRemote = false
  ): LateCalculationResult {
    if (isRemote) {
      return { isLate: false, minutesLate: 0, status: "remote" };
    }

    if (!scheduleStartTime) {
      return { isLate: false, minutesLate: 0, status: "present" };
    }

    const [schH, schM] = scheduleStartTime.split(":").map(Number);
    const [curH, curM] = actualCheckInTime.split(":").map(Number);

    const scheduleTotalMins = schH * 60 + schM;
    const currentTotalMins = curH * 60 + curM;

    const thresholdMins = scheduleTotalMins + gracePeriodMinutes;

    if (currentTotalMins > thresholdMins) {
      const lateMins = currentTotalMins - scheduleTotalMins;
      return {
        isLate: true,
        minutesLate: lateMins,
        status: lateMins > 240 ? "half_day" : "late",
      };
    }

    return {
      isLate: false,
      minutesLate: 0,
      status: "present",
    };
  }

  it("marks as present if check-in is on or before scheduled time", () => {
    const res = evaluateAttendance("09:00", "08:55", 15);
    expect(res.isLate).toBe(false);
    expect(res.minutesLate).toBe(0);
    expect(res.status).toBe("present");
  });

  it("marks as present within grace period", () => {
    const res = evaluateAttendance("09:00", "09:14", 15);
    expect(res.isLate).toBe(false);
    expect(res.minutesLate).toBe(0);
    expect(res.status).toBe("present");
  });

  it("marks as late after grace period expires", () => {
    const res = evaluateAttendance("09:00", "09:20", 15);
    expect(res.isLate).toBe(true);
    expect(res.minutesLate).toBe(20);
    expect(res.status).toBe("late");
  });

  it("marks as half_day if late beyond 4 hours (240 mins)", () => {
    const res = evaluateAttendance("09:00", "13:30", 15);
    expect(res.isLate).toBe(true);
    expect(res.minutesLate).toBe(270);
    expect(res.status).toBe("half_day");
  });

  it("retains remote status regardless of time", () => {
    const res = evaluateAttendance("09:00", "11:00", 15, true);
    expect(res.isLate).toBe(false);
    expect(res.minutesLate).toBe(0);
    expect(res.status).toBe("remote");
  });
});
