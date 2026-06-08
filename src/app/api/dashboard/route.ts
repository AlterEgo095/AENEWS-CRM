import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

// Default tenant used until multi-tenant auth is wired
const DEFAULT_TENANT_ID = 'default';

// ============================================================
// GET /api/dashboard
// Returns live dashboard card data aggregated from the CRM
// ============================================================
export async function GET() {
  try {
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfYesterday = new Date(startOfToday.getTime() - 24 * 60 * 60 * 1000);

    // Run all queries in parallel for performance
    const [
      totalContacts,
      recentContactsThisWeek,
      todayContacts,
      yesterdayContacts,
      activeDeals,
      todayDeals,
    ] = await Promise.all([
      // Total contacts
      db.crmContact.count({
        where: { tenantId: DEFAULT_TENANT_ID },
      }),
      // Contacts created in the last 7 days
      db.crmContact.count({
        where: {
          tenantId: DEFAULT_TENANT_ID,
          createdAt: { gte: sevenDaysAgo },
        },
      }),
      // Contacts created today
      db.crmContact.count({
        where: {
          tenantId: DEFAULT_TENANT_ID,
          createdAt: { gte: startOfToday },
        },
      }),
      // Contacts created yesterday (for trend comparison)
      db.crmContact.count({
        where: {
          tenantId: DEFAULT_TENANT_ID,
          createdAt: { gte: startOfYesterday, lt: startOfToday },
        },
      }),
      // "Active deals" = contacts with status 'customer'
      db.crmContact.count({
        where: {
          tenantId: DEFAULT_TENANT_ID,
          status: 'customer',
        },
      }),
      // Contacts with status 'customer' created today
      db.crmContact.count({
        where: {
          tenantId: DEFAULT_TENANT_ID,
          status: 'customer',
          createdAt: { gte: startOfToday },
        },
      }),
    ]);

    // Build trend strings based on real data
    const totalTrend = buildContactTrend(todayContacts, totalContacts, 'today');
    const recentTrend = buildRecentTrend(todayContacts, yesterdayContacts);
    const dealsTrend = todayDeals > 0 ? `+${todayDeals} today` : 'No new today';

    return NextResponse.json({
      cards: [
        {
          id: 'crm-total-contacts',
          value: String(totalContacts),
          trend: totalTrend,
        },
        {
          id: 'crm-recent-contacts',
          value: String(recentContactsThisWeek),
          trend: recentTrend,
        },
        {
          id: 'crm-active-deals',
          value: String(activeDeals),
          trend: dealsTrend,
        },
      ],
    });
  } catch (error) {
    console.error('[GET /api/dashboard] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch dashboard data' },
      { status: 500 }
    );
  }
}

// ============================================================
// Helpers
// ============================================================

function buildContactTrend(
  todayCount: number,
  totalCount: number,
  period: 'today' | 'week'
): string {
  if (todayCount > 0) {
    return `+${todayCount} ${period}`;
  }
  return `${totalCount} total`;
}

function buildRecentTrend(todayCount: number, yesterdayCount: number): string {
  if (todayCount > 0) {
    return `+${todayCount} today`;
  }
  if (yesterdayCount > 0) {
    return `+${yesterdayCount} yesterday`;
  }
  return 'This week';
}
