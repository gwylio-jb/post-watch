import type { CheckResult } from '../../../data/auditTypes';
import { auditFetch, isTauri, SKIPPED_TAURI } from '../fetchUtil';

// ─── Helpers ──────────────────────────────────────────────────────────────────

type FileCheckResult = { path: string; status: number; snippet?: string };

async function probePath(baseUrl: string, path: string): Promise<FileCheckResult> {
  const url = `${baseUrl}${path}`;
  try {
    const res = await auditFetch(url, { method: 'GET', redirect: 'follow' });
    const snippet = res.status === 200 ? (await res.text()).slice(0, 200) : undefined;
    return { path, status: res.status, snippet };
  } catch {
    return { path, status: 0 };
  }
}

function isExposed(r: FileCheckResult): boolean {
  return r.status === 200;
}

function resultForFile(r: FileCheckResult, severity: 'critical' | 'high' | 'medium', fileName: string, recommendation: string): CheckResult {
  if (r.status === 0) return { status: 'error', detail: `Could not reach ${r.path}` };
  if (!isExposed(r)) {
    return { status: 'pass', detail: `${fileName} not publicly accessible (HTTP ${r.status}).` };
  }
  return {
    status: 'fail',
    detail: `${fileName} is publicly accessible (HTTP 200). ${severity === 'critical' ? 'CRITICAL: ' : ''}Sensitive data may be exposed.`,
    evidence: r.snippet ? `URL: ${r.path}\nContent preview: ${r.snippet.replace(/</g, '<').slice(0, 150)}` : `URL: ${r.path}`,
    recommendation,
  };
}

// ─── Check runners ────────────────────────────────────────────────────────────

async function checkWpConfig(baseUrl: string): Promise<CheckResult> {
  const r = await probePath(baseUrl, '/wp-config.php');
  if (!isExposed(r)) return { status: 'pass', detail: `wp-config.php is not accessible (HTTP ${r.status}).` };
  return {
    status: 'fail',
    detail: 'wp-config.php is publicly accessible! Database credentials, auth keys, and salts are exposed.',
    evidence: r.snippet ? `Content: ${r.snippet.slice(0, 100)}` : undefined,
    recommendation: 'Move wp-config.php one directory above the web root, or deny access in .htaccess:\n<Files wp-config.php>\n  Order Allow,Deny\n  Deny from all\n</Files>',
  };
}

async function checkWpConfigBackup(baseUrl: string): Promise<CheckResult> {
  const paths = ['/wp-config.php.bak', '/wp-config.php~', '/wp-config.php.old', '/wp-config.php.orig', '/wp-config.bak'];
  const results = await Promise.all(paths.map(p => probePath(baseUrl, p)));
  const exposed = results.filter(isExposed);
  if (exposed.length === 0) return { status: 'pass', detail: 'No wp-config.php backup files found.' };
  return {
    status: 'fail',
    detail: `wp-config backup file(s) publicly accessible: ${exposed.map(r => r.path).join(', ')}`,
    evidence: exposed.map(r => r.path).join('\n'),
    recommendation: 'Delete all backup files of wp-config.php from the web root. Never store backups inside the public directory.',
  };
}

async function checkEnvFile(baseUrl: string): Promise<CheckResult> {
  const r = await probePath(baseUrl, '/.env');
  return resultForFile(
    r, 'critical', '.env file',
    'Block .env access in .htaccess:\n<Files .env>\n  Order Allow,Deny\n  Deny from all\n</Files>'
  );
}

async function checkGitConfig(baseUrl: string): Promise<CheckResult> {
  const r = await probePath(baseUrl, '/.git/config');
  if (!isExposed(r)) return { status: 'pass', detail: `.git/config is not accessible (HTTP ${r.status}).` };
  return {
    status: 'fail',
    detail: '.git/config is publicly accessible! Full Git repository (including history) may be downloadable.',
    evidence: r.snippet?.slice(0, 150),
    recommendation: 'Block .git access in .htaccess:\n<DirectoryMatch "^\\.git">\n  Order Allow,Deny\n  Deny from all\n</DirectoryMatch>\nBetter yet, move .git outside the web root entirely.',
  };
}

async function checkDebugLog(baseUrl: string): Promise<CheckResult> {
  const paths = ['/wp-content/debug.log', '/debug.log'];
  const results = await Promise.all(paths.map(p => probePath(baseUrl, p)));
  const exposed = results.filter(isExposed);
  if (exposed.length === 0) return { status: 'pass', detail: 'No debug.log files publicly accessible.' };
  return {
    status: 'fail',
    detail: `debug.log is publicly accessible. WordPress error log may contain file paths, plugin names, database queries.`,
    evidence: exposed.map(r => r.path).join('\n') + (exposed[0]?.snippet ? `\nPreview: ${exposed[0].snippet.slice(0, 120)}` : ''),
    recommendation: "Disable debug logging or protect the log file:\ndefine('WP_DEBUG_LOG', '/private/path/outside/webroot/debug.log');",
  };
}

async function checkReadme(baseUrl: string): Promise<CheckResult> {
  const r = await probePath(baseUrl, '/readme.html');
  if (!isExposed(r)) return { status: 'pass', detail: 'readme.html is not publicly accessible.' };
  const versionMatch = r.snippet?.match(/Version\s+([\d.]+)/i);
  return {
    status: 'fail',
    detail: `readme.html is accessible${versionMatch ? ` and reveals WordPress version ${versionMatch[1]}` : ' and discloses WordPress installation'}.`,
    evidence: `URL: ${baseUrl}/readme.html`,
    recommendation: 'Delete readme.html from the WordPress root directory.',
  };
}

async function checkLicense(baseUrl: string): Promise<CheckResult> {
  const r = await probePath(baseUrl, '/license.txt');
  if (!isExposed(r)) return { status: 'pass', detail: 'license.txt is not publicly accessible.' };
  return {
    status: 'warning',
    detail: 'license.txt is accessible and confirms a WordPress installation.',
    evidence: `URL: ${baseUrl}/license.txt`,
    recommendation: 'Delete license.txt from the WordPress root directory.',
  };
}

async function checkPhpInfo(baseUrl: string): Promise<CheckResult> {
  const paths = ['/phpinfo.php', '/info.php', '/php_info.php', '/test.php'];
  const results = await Promise.all(paths.map(p => probePath(baseUrl, p)));
  const exposed = results.filter(r => isExposed(r) && r.snippet?.includes('phpinfo'));
  if (exposed.length === 0) return { status: 'pass', detail: 'No phpinfo() files found.' };
  return {
    status: 'fail',
    detail: `phpinfo() file accessible at: ${exposed.map(r => r.path).join(', ')}. Full PHP config, server paths, environment variables exposed.`,
    evidence: exposed.map(r => r.path).join('\n'),
    recommendation: 'Delete phpinfo.php and all similar diagnostic files from the web root immediately.',
  };
}

async function checkBackupFiles(baseUrl: string): Promise<CheckResult> {
  const backupNames = [
    '/backup.zip', '/backup.sql', '/www.zip', '/site.zip', '/wordpress.zip',
    '/wp.zip', '/website.zip', '/db.sql', '/database.sql', '/dump.sql',
    `/${new URL(baseUrl).hostname}.zip`, `/${new URL(baseUrl).hostname}.sql`,
  ];
  const results = await Promise.all(backupNames.map(p => probePath(baseUrl, p)));
  const exposed = results.filter(isExposed);
  if (exposed.length === 0) return { status: 'pass', detail: 'No common backup files found in web root.' };
  return {
    status: 'fail',
    detail: `${exposed.length} backup file(s) publicly accessible: ${exposed.map(r => r.path).join(', ')}`,
    evidence: exposed.map(r => r.path).join('\n'),
    recommendation: 'Delete backup files from the web root. Store backups outside the publicly accessible directory. Use a backup plugin that stores off-site.',
  };
}

async function checkHtaccess(baseUrl: string): Promise<CheckResult> {
  const r = await probePath(baseUrl, '/.htaccess');
  if (!isExposed(r)) return { status: 'pass', detail: '.htaccess is not publicly accessible.' };
  return {
    status: 'warning',
    detail: '.htaccess is readable. Server rewrite rules, denied paths, and authentication configs may be visible.',
    evidence: r.snippet?.slice(0, 150),
    recommendation: 'Block .htaccess access:\n<Files .htaccess>\n  Order Allow,Deny\n  Deny from all\n</Files>',
  };
}

// ─── Directory listing checks ─────────────────────────────────────────────────

async function checkUploadListing(baseUrl: string): Promise<CheckResult> {
  const r = await probePath(baseUrl, '/wp-content/uploads/');
  if (!isExposed(r)) return { status: 'pass', detail: '/wp-content/uploads/ directory listing is disabled.' };
  const isListing = r.snippet?.toLowerCase().includes('index of');
  if (!isListing) return { status: 'pass', detail: '/wp-content/uploads/ accessible but directory listing is disabled.' };
  return {
    status: 'fail',
    detail: 'Directory listing is enabled on /wp-content/uploads/. All uploaded files are enumerable.',
    evidence: `URL: ${baseUrl}/wp-content/uploads/`,
    recommendation: 'Disable directory listing in .htaccess:\nOptions -Indexes\nOr add an empty index.php to /wp-content/uploads/.',
  };
}

async function checkWpIncludesListing(baseUrl: string): Promise<CheckResult> {
  const r = await probePath(baseUrl, '/wp-includes/');
  if (!isExposed(r)) return { status: 'pass', detail: '/wp-includes/ directory listing is disabled.' };
  const isListing = r.snippet?.toLowerCase().includes('index of');
  if (!isListing) return { status: 'pass', detail: '/wp-includes/ accessible but directory listing appears disabled.' };
  return {
    status: 'fail',
    detail: 'Directory listing is enabled on /wp-includes/. WordPress core files are enumerable by attackers.',
    evidence: `URL: ${baseUrl}/wp-includes/`,
    recommendation: 'Block access to wp-includes/ in .htaccess:\n<IfModule mod_rewrite.c>\nRewriteRule ^wp-includes/[^/]+\\.php$ - [F,L]\n</IfModule>',
  };
}

// ─── Module entry point ───────────────────────────────────────────────────────

export async function runFileExposureChecks(baseUrl: string): Promise<Map<string, CheckResult>> {
  const results = new Map<string, CheckResult>();

  if (!isTauri()) {
    const checkIds = [
      'file-wp-config', 'file-wp-config-bak', 'file-env', 'file-git-config',
      'file-debug-log', 'file-readme', 'file-license', 'file-phpinfo',
      'file-backup', 'file-htaccess', 'file-upload-listing', 'file-wp-includes-listing',
    ];
    checkIds.forEach(id => results.set(id, SKIPPED_TAURI));
    return results;
  }

  const [wpConfig, wpConfigBak, env, gitConfig, debugLog, readme, license, phpInfo, backup, htaccess, uploadListing, wpIncludesListing] = await Promise.all([
    checkWpConfig(baseUrl),
    checkWpConfigBackup(baseUrl),
    checkEnvFile(baseUrl),
    checkGitConfig(baseUrl),
    checkDebugLog(baseUrl),
    checkReadme(baseUrl),
    checkLicense(baseUrl),
    checkPhpInfo(baseUrl),
    checkBackupFiles(baseUrl),
    checkHtaccess(baseUrl),
    checkUploadListing(baseUrl),
    checkWpIncludesListing(baseUrl),
  ]);

  results.set('file-wp-config', wpConfig);
  results.set('file-wp-config-bak', wpConfigBak);
  results.set('file-env', env);
  results.set('file-git-config', gitConfig);
  results.set('file-debug-log', debugLog);
  results.set('file-readme', readme);
  results.set('file-license', license);
  results.set('file-phpinfo', phpInfo);
  results.set('file-backup', backup);
  results.set('file-htaccess', htaccess);
  results.set('file-upload-listing', uploadListing);
  results.set('file-wp-includes-listing', wpIncludesListing);

  return results;
}
