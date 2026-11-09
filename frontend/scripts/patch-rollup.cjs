const fs = require('fs');
const path = require('path');

const nativeJsPath = path.join(__dirname, '../node_modules/rollup/dist/native.js');

if (fs.existsSync(nativeJsPath)) {
  let content = fs.readFileSync(nativeJsPath, 'utf8');
  if (!content.includes('@rollup/wasm-node')) {
    content = content.replace(
      /const nativeModule = requireWithFriendlyError\([\s\S]*?\);/,
      `let nativeModule;
try {
	nativeModule = requireWithFriendlyError(
		existsSync(path.join(__dirname, localName)) ? localName : \`@rollup/rollup-\${packageBase}\`
	);
} catch (e) {
	try {
		nativeModule = require('@rollup/wasm-node/dist/native.js');
	} catch {
		throw e;
	}
}`
    );
    fs.writeFileSync(nativeJsPath, content, 'utf8');
    console.log('[Build] Rollup wasm fallback successfully patched.');
  }
}
