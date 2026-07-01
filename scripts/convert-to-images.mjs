// HTML → 스마트스토어용 이미지 변환 스크립트
// 사용법: node scripts/convert-to-images.mjs output/상품명.html

import { execSync } from 'child_process';
import { existsSync, mkdirSync, readFileSync } from 'fs';
import { basename, dirname, join, resolve } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const htmlFile = process.argv[2];

if (!htmlFile) {
  console.error('❌ HTML 파일 경로를 입력해주세요.');
  console.error('   사용법: node scripts/convert-to-images.mjs output/상품명.html');
  process.exit(1);
}

if (!existsSync(htmlFile)) {
  console.error(`❌ 파일을 찾을 수 없습니다: ${htmlFile}`);
  process.exit(1);
}

const productName = basename(htmlFile, '.html');
const outputDir = join(dirname(htmlFile), `${productName}-images`);

mkdirSync(outputDir, { recursive: true });

console.log(`\n🖼️  이미지 변환을 시작합니다...`);
console.log(`   상품명: ${productName}`);
console.log(`   저장 위치: ${outputDir}\n`);

// puppeteer 설치 여부 확인
let puppeteer;
try {
  puppeteer = (await import('puppeteer')).default;
} catch {
  console.log('📦 puppeteer를 설치합니다...');
  execSync('npm install puppeteer', { stdio: 'inherit' });
  puppeteer = (await import('puppeteer')).default;
}

const browser = await puppeteer.launch({ headless: 'new' });
const page = await browser.newPage();

// 스마트스토어 권장 가로 860px
await page.setViewport({ width: 860, height: 1200, deviceScaleFactor: 2 });

const absolutePath = resolve(htmlFile);
await page.goto(`file://${absolutePath}`, { waitUntil: 'networkidle0' });

// 전체 페이지 스크린샷
const fullPath = join(outputDir, 'full.jpg');
await page.screenshot({
  path: fullPath,
  fullPage: true,
  type: 'jpeg',
  quality: 90,
});
console.log(`✅ 전체 이미지 저장: ${fullPath}`);

// 섹션별 분할 (각 섹션의 직계 자식 div 기준)
const sections = await page.evaluate(() => {
  const els = document.body.querySelectorAll('body > div');
  return Array.from(els).map((el, i) => {
    const rect = el.getBoundingClientRect();
    const scrollY = window.scrollY;
    return {
      index: i + 1,
      top: rect.top + scrollY,
      height: rect.height,
    };
  });
});

for (const section of sections) {
  if (section.height < 50) continue;

  const sectionPath = join(outputDir, `section-${String(section.index).padStart(2, '0')}.jpg`);
  const clipHeight = Math.min(section.height, 2000);

  await page.screenshot({
    path: sectionPath,
    type: 'jpeg',
    quality: 90,
    clip: {
      x: 0,
      y: section.top,
      width: 860,
      height: clipHeight,
    },
  });
  console.log(`✅ 섹션 ${section.index} 저장: ${sectionPath}`);
}

await browser.close();

console.log(`
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✨ 이미지 변환이 완료되었습니다!

📁 결과물 위치: ${outputDir}

스마트스토어에 올리는 방법:
1. 스마트스토어 센터 → 상품 등록/수정
2. "상세 설명" 영역 → 에디터에서 "이미지" 버튼 클릭
3. section-01.jpg부터 순서대로 업로드
4. 이미지 사이 간격 없이 붙여서 배치

💡 팁: full.jpg는 전체 미리보기용이고,
   실제 업로드는 section 파일들을 순서대로 올리시면 됩니다.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`);
