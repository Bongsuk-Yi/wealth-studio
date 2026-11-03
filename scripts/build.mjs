// 정적 사이트 빌드: 소스 파일과 라이브러리(node_modules)를 dist/ 로 모은다.
import { cpSync, mkdirSync, rmSync, readdirSync, statSync, writeFileSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { sitePassword, encrypt, gatePage, LOCK_SNIPPET } from './gate.mjs';

const STORE_KEY = 'wealth-studio.pw';

const root = new URL('..', import.meta.url).pathname;
const dist = join(root, 'dist');
rmSync(dist, { recursive: true, force: true });
mkdirSync(join(dist, 'vendor'), { recursive: true });

const SKIP = new Set(['dist', 'node_modules', 'scripts', '.git', '.github', 'package.json', 'package-lock.json', 'README.md', '.gitignore']);
for (const f of readdirSync(root)) {
  if (SKIP.has(f) || f.startsWith('.')) continue;
  cpSync(join(root, f), join(dist, f), { recursive: true });
}

const VENDOR = {
  'chart.umd.js': 'chart.js/dist/chart.umd.js',
  'xlsx.full.min.js': 'xlsx/dist/xlsx.full.min.js',
  'html2canvas.min.js': 'html2canvas/dist/html2canvas.min.js',
  'jspdf.umd.min.js': 'jspdf/dist/jspdf.umd.min.js',
};
for (const [out, src] of Object.entries(VENDOR)) cpSync(join(root, 'node_modules', src), join(dist, 'vendor', out));

// 캐시 무효화: app.js·styles.css 에 빌드 시각을 붙인다
const ver = Date.now().toString(36);
const idx = join(dist, 'index.html');
writeFileSync(idx, readFileSync(idx, 'utf8').replace('href="styles.css"', `href="styles.css?v=${ver}"`).replace('src="app.js"', `src="app.js?v=${ver}"`));
writeFileSync(join(dist, '.nojekyll'), '');

// 비밀번호 게이트: 모든 .html 을 암호화해 게이트 페이지로 바꾼다
const pw = sitePassword();
const walk = (d) => readdirSync(d).flatMap((f) => { const p = join(d, f); return statSync(p).isDirectory() ? walk(p) : [p]; });
let n = 0;
for (const f of walk(dist).filter((p) => p.endsWith('.html'))) {
  let html = readFileSync(f, 'utf8');
  html = html.replace('<head>', '<head>\n<meta name="robots" content="noindex, nofollow, noarchive">').replace(/<\/body>/i, LOCK_SNIPPET(STORE_KEY) + '\n</body>');
  const title = (html.match(/<title>([^<]*)<\/title>/) || [, '자산형성 스튜디오'])[1].split('|')[0].trim();
  writeFileSync(f, gatePage({ title, mark: '📈', storeKey: STORE_KEY, envelope: encrypt(html, pw), theme: 'dark' }));
  n++;
}
console.log(`HTML ${n}개 암호화 완료`);

const size = (p) => statSync(p).isDirectory() ? readdirSync(p).reduce((s, f) => s + size(join(p, f)), 0) : statSync(p).size;
console.log(`dist/ 빌드 완료 (${(size(dist) / 1024).toFixed(0)} KB, v=${ver})`);
