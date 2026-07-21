import { MyAttendance } from "@/components/attendance/my-attendance";
import { getMyAttendancePage } from "@/lib/data/attendance";

// Reads the current session (cookies) — render on demand, never prebuild.
export const dynamic = "force-dynamic";

export default async function AttendancePage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const { month } = await searchParams;
  const data = await getMyAttendancePage(month);
  return <MyAttendance data={data} />;
}
