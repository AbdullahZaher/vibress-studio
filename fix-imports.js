const fs = require('fs');
const path = require('path');
const dir = '/Users/abdullahzaher/vibress-studio/packages/studio-react/src/components/cards';

const files = fs.readdirSync(dir).filter(f => f.endsWith('.tsx'));
for (const f of files) {
  const p = path.join(dir, f);
  let content = fs.readFileSync(p, 'utf8');
  content = content.replace(/import React, {/g, 'import {');
  content = content.replace(/import React from 'react';\n/g, '');
  fs.writeFileSync(p, content);
}

// ButtonCardEditor specific fixes
const btnPath = path.join(dir, 'ButtonCardEditor.tsx');
let btnContent = fs.readFileSync(btnPath, 'utf8');
btnContent = btnContent.replace(/const isPopulated = [^;]+;/g, '');
btnContent = btnContent.replace(/onKeyDown={\(e\) => e\.stopPropagation\(\)}/g, 'onKeyDown={() => {}}');
btnContent = btnContent.replace(/onKeyUp={\(e\) => e\.stopPropagation\(\)}/g, 'onKeyUp={() => {}}');
btnContent = btnContent.replace(/onKeyPress={\(e\) => e\.stopPropagation\(\)}/g, 'onKeyPress={() => {}}');
fs.writeFileSync(btnPath, btnContent);

// CalloutCardEditor specific fix (also remove React, )
const calloutPath = path.join(dir, 'CalloutCardEditor.tsx');
let calloutContent = fs.readFileSync(calloutPath, 'utf8');
calloutContent = calloutContent.replace(/import React, {/g, 'import {');
fs.writeFileSync(calloutPath, calloutContent);

// NestedCaptionEditor fix
const ncePath = path.join(dir, 'NestedCaptionEditor.tsx');
let nceContent = fs.readFileSync(ncePath, 'utf8');
nceContent = nceContent.replace(/import React, {/g, 'import {');
fs.writeFileSync(ncePath, nceContent);

// VibressStudio.tsx fix
const vsPath = '/Users/abdullahzaher/vibress-studio/packages/studio-react/src/VibressStudio.tsx';
let vsContent = fs.readFileSync(vsPath, 'utf8');
vsContent = vsContent.replace(/import { \$createStudioCardNode } from '\@vibress\/studio-nodes';\n/g, '');
vsContent = vsContent.replace(/, \$createStudioCardNode/g, '');
fs.writeFileSync(vsPath, vsContent);
