export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import type { Metadata } from 'next';
import { isAdminAuthed, getAdminToken } from '@/lib/human-check/auth';
import { loadDashboard, type Dashboard, type LabelCount } from '@/lib/human-check/stats';
import styles from './dashboard.module.css';

export const metadata: Metadata = {
  title: 'Human check',
  robots: { index: false, follow: false, nocache: true },
};

const nf = new Intl.NumberFormat('en-US');

function formatDuration(ms: number | null): string {
  if (ms == null) return '—';
  if (ms < 1000) return `${Math.round(ms)}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function formatTime(iso: string): string {
  return iso.replace('T', ' ').slice(0, 16);
}

function truncate(value: string | null, max: number): string {
  if (!value) return '—';
  return value.length > max ? `${value.slice(0, max - 1)}…` : value;
}

/* ------------------------------------------------------------------- login --- */

function LoginGate({ error }: { error?: string }) {
  const configured = getAdminToken() !== null;

  return (
    <div className={styles.gateWrap}>
      <form className={styles.gateCard} method="post" action="/api/admin/human/session">
        <div className="z-kicker" style={{ color: 'var(--z-ink-2)' }}>
          icomics.wiki · internal
        </div>
        <h1 className={styles.gateTitle}>Human check</h1>
        <p className={styles.gateBody}>
          {configured
            ? 'Enter the dashboard token to view the verification log.'
            : 'ADMIN_DASHBOARD_TOKEN is not set on this deployment, so the dashboard stays locked.'}
        </p>

        <input
          className={styles.input}
          type="password"
          name="token"
          autoComplete="current-password"
          placeholder="Dashboard token"
          aria-label="Dashboard token"
          disabled={!configured}
          required
        />
        <input type="hidden" name="intent" value="login" />

        <button
          type="submit"
          className="z-btn z-btn--red"
          style={{ width: '100%', marginTop: 18 }}
          disabled={!configured}
        >
          Unlock
        </button>

        {error === 'invalid' && <p className={styles.error}>That token is not valid.</p>}
        {error === 'unconfigured' && (
          <p className={styles.error}>Set ADMIN_DASHBOARD_TOKEN, then redeploy.</p>
        )}
      </form>
    </div>
  );
}

/* ------------------------------------------------------------------- charts --- */

/** 14-day trend. One series, so no legend — the card title names it. */
function Trend({ byDay }: { byDay: Dashboard['byDay'] }) {
  const peak = Math.max(1, ...byDay.map((d) => d.count));
  const first = byDay[0]?.day ?? '';
  const last = byDay[byDay.length - 1]?.day ?? '';

  return (
    <section className={styles.card}>
      <div className={styles.cardHead}>
        <h2 className={styles.cardTitle}>Confirmations per day</h2>
        {/* Selective label: the peak only. A number on every bar would be noise. */}
        <span className="z-kicker" style={{ color: 'var(--z-ink-2)' }}>
          Peak {nf.format(peak)}/day · last 14 days
        </span>
      </div>

      <div className={styles.trend} role="img" aria-label={`Daily confirmations from ${first} to ${last}, peak ${peak}`}>
        {byDay.map((day) => (
          <div
            key={day.day}
            className={`${styles.trendBar} ${day.count === 0 ? styles.trendBarEmpty : ''}`}
            style={{ height: day.count === 0 ? 2 : `${Math.max(4, (day.count / peak) * 100)}%` }}
            title={`${day.day} · ${nf.format(day.count)} confirmations`}
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
  emptyLabel,
}: {
  title: string;
  rows: LabelCount[];
  total: number;
  emptyLabel: string;
}) {
  const peak = Math.max(1, ...rows.map((r) => r.count));

  return (
    <section className={`${styles.card} ${styles.flush}`}>
      <div className={styles.cardHead}>
        <h2 className={styles.cardTitle}>{title}</h2>
      </div>

      {rows.length === 0 ? (
        <p className={styles.empty}>{emptyLabel}</p>
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
                    style={{ width: `${Math.max(2, (row.count / peak) * 100)}%`, display: 'block' }}
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

/* ---------------------------------------------------------------- dashboard --- */

export default async function HumanCheckDashboard({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  if (!(await isAdminAuthed())) return <LoginGate error={error} />;

  let data: Dashboard | null = null;
  let loadError: string | null = null;
  try {
    data = await loadDashboard();
  } catch (e) {
    loadError = e instanceof Error ? e.message : 'Unknown database error';
  }

  if (!data) {
    return (
      <main className={styles.page}>
        <div className={styles.shell}>
          <h1 className={styles.title}>Human check</h1>
          <p className={styles.empty}>Could not read the log: {loadError}</p>
        </div>
      </main>
    );
  }

  const { totals, byDay, byCountry, byDevice, byBrowser, recent } = data;

  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        <header className={styles.header}>
          <div>
            <div className="z-kicker" style={{ color: 'var(--z-ink-2)' }}>icomics.wiki · internal</div>
            <h1 className={styles.title}>Human check</h1>
            <p className={styles.subtitle}>
              Every &ldquo;Yes, I&rsquo;m human&rdquo; confirmation, newest first. Times are UTC.
            </p>
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
            <div className="z-kicker">Confirmations</div>
            <div className={styles.kpiValue}>{nf.format(totals.total)}</div>
            <div className={styles.kpiHint}>all time</div>
          </div>
          <div className={styles.kpi}>
            <div className="z-kicker" style={{ color: 'var(--z-ink-2)' }}>Unique people</div>
            <div className={styles.kpiValue}>{nf.format(totals.uniqueVisitors)}</div>
            <div className={styles.kpiHint}>distinct browsers</div>
          </div>
          <div className={styles.kpi}>
            <div className="z-kicker" style={{ color: 'var(--z-ink-2)' }}>Today</div>
            <div className={styles.kpiValue}>{nf.format(totals.today)}</div>
            <div className={styles.kpiHint}>{nf.format(totals.last7)} in the last 7 days</div>
          </div>
          <div className={styles.kpi}>
            <div className="z-kicker" style={{ color: 'var(--z-ink-2)' }}>Median decision</div>
            <div className={styles.kpiValue}>{formatDuration(totals.medianDecidedMs)}</div>
            <div className={styles.kpiHint}>modal shown → tapped</div>
          </div>
        </div>

        <Trend byDay={byDay} />

        <div className={styles.split} style={{ marginTop: 26 }}>
          <Ranking
            title="Countries"
            rows={byCountry}
            total={totals.total}
            emptyLabel="No confirmations logged yet."
          />
          <div className={styles.stack}>
            <Ranking
              title="Devices"
              rows={byDevice}
              total={totals.total}
              emptyLabel="No data yet."
            />
            <Ranking
              title="Browsers"
              rows={byBrowser}
              total={totals.total}
              emptyLabel="No data yet."
            />
          </div>
        </div>

        <section className={styles.card}>
          <div className={styles.cardHead}>
            <h2 className={styles.cardTitle}>Recent confirmations</h2>
            <span className="z-kicker" style={{ color: 'var(--z-ink-2)' }}>last {recent.length}</span>
          </div>

          {recent.length === 0 ? (
            <p className={styles.empty}>
              Nothing logged yet. The first visitor to tap the gate shows up here.
            </p>
          ) : (
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Time (UTC)</th>
                    <th>Country</th>
                    <th>Device</th>
                    <th>Browser</th>
                    <th>OS</th>
                    <th>Lang</th>
                    <th>Page</th>
                    <th>Referrer</th>
                    <th>Took</th>
                    <th>Visitor</th>
                  </tr>
                </thead>
                <tbody>
                  {recent.map((row) => (
                    <tr key={row.id}>
                      <td className={styles.mono}>{formatTime(row.createdAt)}</td>
                      <td className={styles.mono}>{row.country ?? '—'}</td>
                      <td>
                        {row.device ?? '—'}
                        {row.repeatVisit && <span className="z-tag z-tag--yellow" style={{ marginLeft: 6 }}>return</span>}
                      </td>
                      <td>{row.browser ?? '—'}</td>
                      <td>{row.os ?? '—'}</td>
                      <td className={styles.dim}>{row.uiLang ?? '—'}</td>
                      <td title={row.path ?? ''}>{truncate(row.path, 28)}</td>
                      <td className={styles.dim} title={row.referrer ?? ''}>
                        {truncate(row.referrer, 24)}
                      </td>
                      <td className={styles.mono}>{formatDuration(row.decidedMs)}</td>
                      <td className={styles.dim} title={row.visitorId}>
                        {row.visitorId.slice(0, 8)}
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
