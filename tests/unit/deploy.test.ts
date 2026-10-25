import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');

// Spec §11, character for character.
const CSP =
  "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self'; connect-src 'self' https:; frame-ancestors 'none'; base-uri 'none'; form-action 'none'";

const template = read('deploy/nginx/admin.conf.template');
const releaseScript = read('deploy/release.sh');
const setupScript = read('deploy/setup-host.sh');
const workflow = read('.github/workflows/deploy.yml');

/** The body of each `location` block, found by brace matching. */
function locationBlocks(conf: string): { head: string; body: string }[] {
  const blocks: { head: string; body: string }[] = [];
  const opener = /^[ \t]*location\s+([^{]+)\{/gm;
  for (const match of conf.matchAll(opener)) {
    const start = match.index + match[0].length;
    let depth = 1;
    let end = start;
    while (depth > 0 && end < conf.length) {
      const ch = conf[end];
      if (ch === '{') depth += 1;
      if (ch === '}') depth -= 1;
      end += 1;
    }
    blocks.push({ head: (match[1] ?? '').trim(), body: conf.slice(start, end - 1) });
  }
  return blocks;
}

describe('nginx template', () => {
  it('falls back to the app shell for client-side routes', () => {
    expect(template).toContain('try_files $uri /index.html;');
  });

  it('sends the Content-Security-Policy from the spec', () => {
    expect(template).toContain(`Content-Security-Policy "${CSP}"`);
  });

  it('sends the robots, referrer and framing headers', () => {
    expect(template).toContain('X-Robots-Tag "noindex, nofollow"');
    expect(template).toContain('Referrer-Policy no-referrer');
    expect(template).toContain('X-Frame-Options DENY');
  });

  it('repeats the CSP in every location, because add_header does not inherit', () => {
    const blocks = locationBlocks(template);
    expect(blocks.length).toBeGreaterThanOrEqual(3);
    const cspCount = template.match(/add_header Content-Security-Policy/g)?.length ?? 0;
    // One per location, plus the server-level default.
    expect(cspCount).toBe(blocks.length + 1);
    for (const block of blocks) {
      expect(block.body, block.head).toContain(`add_header Content-Security-Policy "${CSP}" always;`);
    }
  });

  it('caches /assets/ as immutable and never caches index.html', () => {
    const blocks = locationBlocks(template);
    const assets = blocks.find((b) => b.head === '^~ /assets/');
    const index = blocks.find((b) => b.head === '= /index.html');
    expect(assets?.body).toContain('immutable');
    expect(index?.body).toContain('add_header Cache-Control "no-cache"');
  });

  it('has the placeholder the setup script fills in', () => {
    expect(template).toContain('server_name __SERVER_NAME__;');
    expect(template).toContain('root  /srv/interacti-admin/current;');
  });
});

describe('host scripts', () => {
  it('release.sh defaults to the admin release tree', () => {
    expect(releaseScript).toContain('/srv/interacti-admin');
  });

  it('setup-host.sh defaults to the admin subdomain and paths', () => {
    expect(setupScript).toContain('admin.interacti.84-12-92-46.sslip.io');
    expect(setupScript).toContain('APP_DIR=${APP_DIR:-/srv/interacti-admin}');
    expect(setupScript).toContain('SITE=${SITE:-/etc/nginx/conf.d/interacti-admin.conf}');
    expect(setupScript).toContain('nginx/admin.conf.template');
  });
});

describe('deploy workflow', () => {
  it('is named for the admin and runs on a push to main', () => {
    expect(workflow).toContain('name: Deploy interacti admin');
    expect(workflow).toMatch(/push:\s*\n\s*branches: \[main\]/);
  });

  it('tests, builds and uploads to the release directory', () => {
    expect(workflow).toContain('yarn test');
    expect(workflow).toContain('yarn build');
    expect(workflow).toContain('/srv/interacti-admin/releases/$GITHUB_SHA/');
    expect(workflow).toContain('rsync');
  });
});
