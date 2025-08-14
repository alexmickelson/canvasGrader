export function describeTimeDifference(
  submittedAt: string,
  dueAt: string
): string {
  const submitted = new Date(submittedAt);
  const due = new Date(dueAt);
  const diffMs = submitted.getTime() - due.getTime();

  const absMs = Math.abs(diffMs);
  const minute = 60 * 1000;
  const hour = 60 * minute;
  const day = 24 * hour;
  const week = 7 * day;

  let value: number;
  let unit: string;

  if (absMs < hour) {
    value = Math.round(absMs / minute);
    unit = "min";
  } else if (absMs < day) {
    value = Math.round(absMs / hour);
    unit = "hour";
  } else if (absMs < week) {
    value = Math.round(absMs / day);
    unit = "day";
  } else {
    value = Math.round(absMs / week);
    unit = "week";
  }

  const direction = diffMs < 0 ? "early" : "late";
  return `${value} ${unit}${value !== 1 ? "s" : ""} ${direction}`;
}
