export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import type { Metadata } from 'next';
import Link from 'next/link';
import { isAdminAuthed } from '@/lib/human-check/auth';
import {
  loadVisitorDashboard,
  type LabelCount,
  type VisitorDashboard,
} from '@/lib/telemetry/visitor-stats';
import AdminNav from '../AdminNav';
import styles from '../dashboard.module.css';

export const metadata: Metadata = {
  title: 'Visitors',
  robots: { index: false, follow: false, nocache: true },
};

const nf = new Intl.NumberFormat('en-US');

const formatTime = (iso: string) => iso.replace('T', ' ').slice(0, 16);

function truncate(value: string | null, max: number): string {
  if (!value) return '—';
  return value.length > max ? `${value.slice(0, max - 1)}…` : value;
}

/** Unique people per day. One series, so no legend — the card title names it. */
function Trend({ byDay }: { byDay: VisitorDashboard['byDay'] }) {
  const peak = Math.max(1, ...byDay.map((d) => d.visitors));
  const first = byDay[0]?.day ?? '';
  const last = byDay[byDay.length - 1]?.day ?? '';

  return (
    <section className={styles.card}>
      <div className={styles.cardHead}>
        <h2 className={styles.cardTitle}>People per day</h2>
        {/* Selective label: the peak only. A number on every bar would be noise. */}
        <span className="z-kicker" style={{ color: 'var(--z-ink-2)' }}>
          Peak {nf.format(peak)}/day · last 14 days
        </span>
      </div>

      <div
        className={styles.trend}
        role="img"
        aria-label={`Unique visitors per day from ${first} to ${last}, peak ${peak}`}
      >
        {byDay.map((day) => (
          <div
            key={day.day}
            className={`${styles.trendBar} ${day.visitors === 0 ? styles.trendBarEmpty : ''}`}
            style={{ height: day.visitors === 0 ? 2 : `${Math.max(4, (day.visitors / peak) * 100)}%` }}
            title={`${day.day} · ${nf.format(day.visitors)} people, ${nf.format(day.views)} views`}
          />
        ))}
      </div>

      <div className={styles.trendAxis}>
        <span className="z-kicker">{first}</span>
        <span className="z-kicker">{last} · today</span>
      </div>
    </section>
  );
}

function Ranking({
  title,
  rows,
  total,
  unit,
  flush,
}: {
  title: string;
  rows: LabelCount[];
  total: number;
  unit: string;
  flush?: boolean;
}) {
  const peak = Math.max(1, ...rows.map((r) => r.count));

  return (
    <section className={`${styles.card} ${flush ? styles.flush : ''}`}>
      <div className={styles.cardHead}>
        <h2 className={styles.cardTitle}>{title}</h2>
        <span className="z-kicker" style={{ color: 'var(--z-ink-2)' }}>
          {unit}
        </span>
      </div>

      {rows.length === 0 ? (
        <p className={styles.empty}>Nothing recorded yet.</p>
      ) : (
        <div className={styles.rank}>
          {rows.map((row) => {
            const share = total > 0 ? (row.count / total) * 100 : 0;
            return (
              <div key={row.label} className={styles.rankRow}>
                <span className={styles.rankLabel} title={row.label}>
                  {row.label}
                </span>
                <span
                  className={styles.rankTrack}
                  title={`${row.label} · ${nf.format(row.count)} (${share.toFixed(1)}%)`}
                >
                  <span
                    className={styles.rankFill}
                    style={{ width: `${Math.max(2, (row.count / peak) * 100)}%` }}
                  />
                </span>
                <span className={styles.rankValue}>
                  {nf.format(row.count)} · {share.toFixed(0)}%
                </span>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

export default async function VisitorsDashboard() {
  if (!(await isAdminAuthed())) {
    return (
      <main className={styles.page}>
        <div className={styles.shell}>
          <div className="z-kicker" style={{ color: 'var(--z-ink-2)' }}>
            icomics.wiki · internal
          </div>
          <h1 className={styles.title}>Visitors</h1>
          <p className={styles.empty}>
            Locked. Unlock the dashboard on the{' '}
            <Link href="/admin/human" style={{ color: 'var(--z-blue)' }}>
              human check
            </Link>{' '}
            page, then come back.
          </p>
        </div>
      </main>
    );
  }

  let data: VisitorDashboard | null = null;
  let loadError: string | null = null;
  try {
    data = await loadVisitorDashboard();
  } catch (e) {
    loadError = e instanceof Error ? e.message : 'Unknown database error';
  }

  if (!data) {
    return (
      <main className={styles.page}>
        <div className={styles.shell}>
          <h1 className={styles.title}>Visitors</h1>
          <p className={styles.empty}>Could not read the log: {loadError}</p>
        </div>
      </main>
    );
  }

  const { totals, byDay, topPages, topReferrers, countries, devices, browsers, recent } = data;
  // Percentages are of the external arrivals shown, not of every page view — internal
  // navigation is excluded from this card, so the whole would not add up otherwise.
  const arrivals = topReferrers.reduce((sum, r) => sum + r.count, 0);

  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        <header className={styles.header}>
          <div>
            <div className="z-kicker" style={{ color: 'var(--z-ink-2)' }}>
              icomics.wiki · internal
            </div>
            <h1 className={styles.title}>Visitors</h1>
            <p className={styles.subtitle}>
              Every real page view, newest first — bots and headless clients are dropped before
              they are counted. Times are UTC.
            </p>
            <AdminNav current="visitors" />
          </div>
          <form method="post" action="/api/admin/human/session">
            <input type="hidden" name="intent" value="logout" />
            <button type="submit" className="z-btn z-btn--paper z-btn--sm">
              Sign out
            </button>
          </form>
        </header>

        <div className={styles.kpis}>
          <div className={`${styles.kpi} ${styles.kpiLead}`}>
            <div className="z-kicker">People today</div>
            <div className={styles.kpiValue}>{nf.format(totals.visitorsToday)}</div>
            <div className={styles.kpiHint}>{nf.format(totals.viewsToday)} page views today</div>
          </div>
          <div className={styles.kpi}>
            <div className="z-kicker" style={{ color: 'var(--z-ink-2)' }}>
              People · 7 days
            </div>
            <div className={styles.kpiValue}>{nf.format(totals.visitors7d)}</div>
            <div className={styles.kpiHint}>{nf.format(totals.visitors30d)} in 30 days</div>
          </div>
          <div className={styles.kpi}>
            <div className="z-kicker" style={{ color: 'var(--z-ink-2)' }}>
              People · all time
            </div>
            <div className={styles.kpiValue}>{nf.format(totals.visitors)}</div>
            <div className={styles.kpiHint}>distinct browsers</div>
          </div>
          <div className={styles.kpi}>
            <div className="z-kicker" style={{ color: 'var(--z-ink-2)' }}>
              Page views
            </div>
            <div className={styles.kpiValue}>{nf.format(totals.views)}</div>
            <div className={styles.kpiHint}>
              {totals.visitors > 0
                ? `${(totals.views / totals.visitors).toFixed(1)} per person`
                : 'all time'}
            </div>
          </div>
        </div>

        <Trend byDay={byDay} />

        <div className={styles.split} style={{ marginTop: 26 }}>
          <Ranking
            title="How they found us"
            rows={topReferrers}
            total={arrivals}
            unit="external arrivals"
            flush
          />
          <Ranking title="Countries" rows={countries} total={totals.visitors} unit="by person" flush />
        </div>

        <div className={styles.split} style={{ marginTop: 26 }}>
          <Ranking title="Most-read pages" rows={topPages} total={totals.views} unit="by page view" flush />
          <div className={styles.stack}>
            <Ranking title="Devices" rows={devices} total={totals.visitors} unit="by person" flush />
            <Ranking title="Browsers" rows={browsers} total={totals.visitors} unit="by person" flush />
          </div>
        </div>

        <section className={styles.card}>
          <div className={styles.cardHead}>
            <h2 className={styles.cardTitle}>Recent visits</h2>
            <span className="z-kicker" style={{ color: 'var(--z-ink-2)' }}>
              last {recent.length}
            </span>
          </div>

          {recent.length === 0 ? (
            <p className={styles.empty}>
              Nothing yet. The next person who opens a page shows up here.
            </p>
          ) : (
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Time (UTC)</th>
                    <th>Country</th>
                    <th>Page</th>
                    <th>Came from</th>
                    <th>Device</th>
                    <th>Browser</th>
                    <th>OS</th>
                    <th>Lang</th>
                    <th>Timezone</th>
                    <th>Person</th>
                  </tr>
                </thead>
                <tbody>
                  {recent.map((row) => (
                    <tr key={row.id}>
                      <td className={styles.mono}>{formatTime(row.createdAt)}</td>
                      <td className={styles.mono}>{row.country ?? '—'}</td>
                      <td title={row.path ?? ''}>{truncate(row.path, 32)}</td>
                      <td className={styles.dim} title={row.referrer ?? ''}>
                        {truncate(row.referrer, 24)}
                      </td>
                      <td>{row.device ?? '—'}</td>
                      <td>{row.browser ?? '—'}</td>
                      <td>{row.os ?? '—'}</td>
                      <td className={styles.dim}>{row.uiLang ?? '—'}</td>
                      <td className={styles.dim}>{row.timezone ?? '—'}</td>
                      <td className={styles.dim} title={row.visitorId ?? ''}>
                        {row.visitorId ? row.visitorId.slice(0, 8) : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
