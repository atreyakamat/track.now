const esbuild = require('esbuild');
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) {
    return;
  }

  const parsed = dotenv.parse(fs.readFileSync(filePath));
  Object.assign(process.env, parsed);
}

[
  path.join(__dirname, '.env'),
  path.join(__dirname, '.env.production'),
  path.join(__dirname, '..', 'app', '.env'),
  path.join(__dirname, '..', 'app', '.env.production'),
  path.join(__dirname, '..', '.env'),
  path.join(__dirname, '..', '.env.production')
].forEach(loadEnvFile);

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
  fs.mkdirSync(distDir, { recursive: true });

  // Bundle popup.js
  await esbuild.build({
    entryPoints: [path.join(__dirname, 'src', 'popup.js')],
    bundle: true,
    outfile: path.join(distDir, 'popup.js'),
    minify: true,
    sourcemap: false,
    target: ['chrome100'],
    define: defines,
  });

  // Bundle background.js
  await esbuild.build({
    entryPoints: [path.join(__dirname, 'src', 'background.js')],
    bundle: true,
    outfile: path.join(distDir, 'background.js'),
    minify: true,
    sourcemap: false,
    target: ['chrome100'],
    define: defines,
  });

  // Copy manifest.json
  fs.copyFileSync(path.join(__dirname, 'manifest.json'), path.join(distDir, 'manifest.json'));

  // Copy popup.html
  fs.copyFileSync(path.join(__dirname, 'popup.html'), path.join(distDir, 'popup.html'));

  // Copy icons directory
  const iconsDist = path.join(distDir, 'icons');
  fs.mkdirSync(iconsDist, { recursive: true });
  const icons = fs.readdirSync(path.join(__dirname, 'icons'));
  for (const icon of icons) {
    fs.copyFileSync(path.join(__dirname, 'icons', icon), path.join(iconsDist, icon));
  }

  console.log('Build complete!');
}

build().catch((err) => {
  console.error(err);
  process.exit(1);
});
