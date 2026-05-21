const esbuild = require('esbuild');
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

// Load env from extension/.env if it exists, otherwise fallback to root or app/
dotenv.config();

const defines = {
  'process.env.VITE_FIREBASE_API_KEY': JSON.stringify(process.env.VITE_FIREBASE_API_KEY || ''),
  'process.env.VITE_FIREBASE_AUTH_DOMAIN': JSON.stringify(process.env.VITE_FIREBASE_AUTH_DOMAIN || ''),
  'process.env.VITE_FIREBASE_PROJECT_ID': JSON.stringify(process.env.VITE_FIREBASE_PROJECT_ID || ''),
  'process.env.VITE_FIREBASE_STORAGE_BUCKET': JSON.stringify(process.env.VITE_FIREBASE_STORAGE_BUCKET || ''),
  'process.env.VITE_FIREBASE_MESSAGING_SENDER_ID': JSON.stringify(process.env.VITE_FIREBASE_MESSAGING_SENDER_ID || ''),
  'process.env.VITE_FIREBASE_APP_ID': JSON.stringify(process.env.VITE_FIREBASE_APP_ID || ''),
  'process.env.VITE_FIREBASE_MEASUREMENT_ID': JSON.stringify(process.env.VITE_FIREBASE_MEASUREMENT_ID || ''),
};

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
    define: defines,
  });

  // Bundle background.js
  await esbuild.build({
    entryPoints: ['src/background.js'],
    bundle: true,
    outfile: 'dist/background.js',
    minify: true,
    sourcemap: false,
    target: ['chrome100'],
    define: defines,
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
