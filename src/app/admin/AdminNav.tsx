import Link from 'next/link';
import styles from './dashboard.module.css';

/** Two internal surfaces share one login; this is the jump between them. */
export default function AdminNav({ current }: { current: 'visitors' | 'human' }) {
  return (
    <nav className={styles.nav}>
      <Link
        href="/admin/visitors"
        className={`${styles.navLink} ${current === 'visitors' ? styles.navLinkActive : ''}`}
      >
        Visitors
      </Link>
      <Link
        href="/admin/human"
        className={`${styles.navLink} ${current === 'human' ? styles.navLinkActive : ''}`}
      >
        Human check
      </Link>
    </nav>
  );
}
