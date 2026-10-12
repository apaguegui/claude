// Renderiza index.html cuadro por cuadro con Chromium y lo codifica con ffmpeg.
// Uso: node reel/render.cjs [--scale 1] [--fps 30] [--out reel/baguette-reel.mp4]
const { chromium } = require('playwright');
const { spawn } = require('node:child_process');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

(async () => {

const args = Object.fromEntries(process.argv.slice(2).reduce((acc, v, i, arr) =>
  v.startsWith('--') ? [...acc, [v.slice(2), arr[i + 1]]] : acc, []));
const scale = Number(args.scale ?? 1), fps = Number(args.fps ?? 30), dur = 15;
const dir = __dirname;
const out = args.out ?? path.join(dir, 'baguette-reel.mp4');

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
const page = await browser.newPage({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: scale });
await page.goto(pathToFileURL(path.join(dir, 'index.html')).href);
await page.evaluate(() => Promise.all([...document.images].map(i => i.decode())));

const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(fps), '-i', '-',
  '-c:v', 'libx264', '-preset', 'slow', '-crf', '18', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', out],
  { stdio: ['pipe', 'inherit', 'inherit'] });

const total = dur * fps;
for (let f = 0; f < total; f++) {
  await page.evaluate(t => window.renderAt(t), f / fps);
  const buf = await page.screenshot({ type: 'jpeg', quality: 95 });
  if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r));
  if (f % 60 === 0) process.stdout.write(`cuadro ${f}/${total}\n`);
}
ff.stdin.end();
await new Promise(r => ff.on('close', r));
await browser.close();
console.log('Listo:', out);
})();
