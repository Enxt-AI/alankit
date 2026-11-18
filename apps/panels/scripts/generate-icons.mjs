#!/usr/bin/env node
/**
 * Generate PNG icons from base design
 * Requires: node-canvas (optional) or online tool fallback
 * 
 * Run: node scripts/generate-icons.mjs
 */

import { writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Icon sizes needed for PWA
const sizes = [
  { size: 72, name: 'icon-72x72.png' },
  { size: 96, name: 'icon-96x96.png' },
  { size: 128, name: 'icon-128x128.png' },
  { size: 144, name: 'icon-144x144.png' },
  { size: 152, name: 'icon-152x152.png' },
  { size: 180, name: 'apple-touch-icon.png' }, // iOS
  { size: 192, name: 'icon-192x192.png' }, // PWA minimum
  { size: 384, name: 'icon-384x384.png' },
  { size: 512, name: 'icon-512x512.png' }, // PWA minimum
  { size: 16, name: 'favicon-16x16.png' },
  { size: 32, name: 'favicon-32x32.png' },
];

console.log('⚠️  This script requires manual PNG generation.');
console.log('');
console.log('📋 Use one of these online tools to generate PNG icons:');
console.log('');
console.log('Option 1: https://realfavicongenerator.net/');
console.log('  - Upload a base image (512x512 or larger)');
console.log('  - Download the generated package');
console.log('  - Extract to public/icons/');
console.log('');
console.log('Option 2: https://www.pwabuilder.com/imageGenerator');
console.log('  - Upload base image');
console.log('  - Select "Generate PWA icons"');
console.log('  - Download and place in public/icons/');
console.log('');
console.log('Option 3: Use ImageMagick (if installed):');
console.log('');

sizes.forEach(({ size, name }) => {
  const cmd = `convert -size ${size}x${size} xc:"#0f172a" -gravity center -pointsize ${Math.floor(size * 0.4)} -font Arial-Bold -fill white -annotate +0+0 "US" "public/icons/${name}"`;
  console.log(cmd);
});

console.log('');
console.log('🎨 Design Specs:');
console.log('  - Background: #0f172a (dark blue)');
console.log('  - Text: "US" in white, bold, centered');
console.log('  - Font: Arial Bold or similar sans-serif');
console.log('');
console.log('📦 Required sizes:');
sizes.forEach(({ size, name }) => {
  console.log(`  - ${name.padEnd(25)} ${size}x${size}px`);
});

console.log('');
console.log(' After generating, run: node scripts/verify-icons.mjs');
