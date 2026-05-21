const esbuild = require('esbuild');
const fs = require('fs');
const path = require('path');

async function build() {
  const distDir = path.join(__dirname, 'dist');
  
  // Ensure dist directory exists
  if (!fs.existsSync(distDir)) {
    fs.mkdirSync(distDir);
  }

  // Bundle popup.js
  await esbuild.build({
    entryPoints: ['src/popup.js'],
    bundle: true,
    outfile: 'dist/popup.js',
    minify: true,
    sourcemap: false,
    target: ['chrome100'],
  });

  // Bundle background.js
  await esbuild.build({
    entryPoints: ['src/background.js'],
    bundle: true,
    outfile: 'dist/background.js',
    minify: true,
    sourcemap: false,
    target: ['chrome100'],
  });

  // Copy manifest.json
  fs.copyFileSync('manifest.json', 'dist/manifest.json');

  // Copy popup.html
  fs.copyFileSync('popup.html', 'dist/popup.html');

  // Copy icons directory
  const iconsDist = path.join(distDir, 'icons');
  if (!fs.existsSync(iconsDist)) {
    fs.mkdirSync(iconsDist);
  }
  const icons = fs.readdirSync('icons');
  for (const icon of icons) {
    fs.copyFileSync(path.join('icons', icon), path.join(iconsDist, icon));
  }

  console.log('Build complete!');
}

build().catch((err) => {
  console.error(err);
  process.exit(1);
});
