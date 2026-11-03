// 정적 사이트 빌드: 소스 파일과 라이브러리(node_modules)를 dist/ 로 모은다.
import { cpSync, mkdirSync, rmSync, readdirSync, statSync, writeFileSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

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

const size = (p) => statSync(p).isDirectory() ? readdirSync(p).reduce((s, f) => s + size(join(p, f)), 0) : statSync(p).size;
console.log(`dist/ 빌드 완료 (${(size(dist) / 1024).toFixed(0)} KB, v=${ver})`);
