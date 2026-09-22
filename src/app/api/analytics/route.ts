import { NextResponse } from 'next/server';
import { getAnalyticsSummary } from '@/lib/db/analytics';
import { apiHandler } from '@/lib/api/api-wrapper';

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function parseDate(value: string | undefined) {
  if (!value || !ISO_DATE.test(value)) return null;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value ? null : parsed;
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

export const GET = apiHandler({
  auth: 'auth', // any authenticated user
  handler: async (request: Request) => {
    const auth = await (await import('@/lib/auth/roles')).requireAuth();
    const url = new URL(request.url);
    const startDate = url.searchParams.get('startDate') ?? undefined;
    const endDate = url.searchParams.get('endDate') ?? undefined;
    const parsedStart = parseDate(startDate);
    const parsedEnd = parseDate(endDate);
    if ((startDate && !parsedStart) || (endDate && !parsedEnd)) {
      return NextResponse.json({ error: 'Dates must use YYYY-MM-DD format' }, { status: 400 });
    }
    const resolvedEndDate = endDate ?? today();
    const resolvedStartDate = startDate ?? new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
    const resolvedStart = parseDate(resolvedStartDate);
    const resolvedEnd = parseDate(resolvedEndDate);
    if (!resolvedStart || !resolvedEnd || resolvedEnd < resolvedStart) {
      return NextResponse.json({ error: 'endDate must not precede startDate' }, { status: 400 });
    }
    if (resolvedEnd.getTime() - resolvedStart.getTime() > 366 * 86400000) {
      return NextResponse.json({ error: 'Analytics date range cannot exceed 366 days' }, { status: 400 });
    }
    const employeeId = url.searchParams.get('employeeId');
    if (auth.role !== 'admin' && employeeId) {
      return NextResponse.json({ error: 'Employees may only access their own metrics' }, { status: 403 });
    }
    const ownEmployeeId = auth.profile.employees?.[0]?.id;
    if (auth.role === 'employee' && !ownEmployeeId) {
      return NextResponse.json({ error: 'Employee record not found' }, { status: 404 });
    }
    const summary = await getAnalyticsSummary({
      startDate: resolvedStartDate,
      endDate: resolvedEndDate,
      employeeId: auth.role === 'admin' ? employeeId : ownEmployeeId,
    });
    return NextResponse.json({ summary, startDate: resolvedStartDate, endDate: resolvedEndDate, scope: auth.role === 'admin' ? 'organization' : 'employee' });
  },
});
