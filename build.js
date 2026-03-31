const fs = require('fs');
const path = require('path');
const esbuild = require('esbuild');

const srcDir = path.join(__dirname, 'src');
const outFile = path.join(__dirname, 'build', 'sheep.min.js');

// Inline the sprite sheet as a base64 data URI
const pngPath = path.join(__dirname, 'rsc', 'sheep.png');
const pngBase64 = fs.readFileSync(pngPath, { encoding: 'base64' });
const imageDataUri = `data:image/png;base64,${pngBase64}`;

// Concatenate source files in dependency order
const sourceFiles = [
    'Sheep.js',   // utilities, mixinEvents, Sheep class
    'Easing.js',
    'Action.js',
    'Actions.js',
    'Position.js',
];

let combined = sourceFiles
    .map(f => fs.readFileSync(path.join(srcDir, f), 'utf8'))
    .join('\n');

// Replace the default image path with the inlined data URI
combined = combined.replace(
    `options.imagePath || 'rsc/sheep.png'`,
    `options.imagePath || '${imageDataUri}'`
);

// Write temp file, minify with esbuild, wrap in IIFE
const tmpFile = path.join(__dirname, 'build', '_tmp.js');
fs.mkdirSync(path.join(__dirname, 'build'), { recursive: true });
fs.writeFileSync(tmpFile, combined);

esbuild.buildSync({
    entryPoints: [tmpFile],
    outfile: outFile,
    bundle: false,
    minify: true,
    format: 'iife',
    target: ['es2015'],
});

fs.unlinkSync(tmpFile);

const size = fs.statSync(outFile).size;
console.log(`Built ${outFile} (${(size / 1024).toFixed(1)} KB)`);
