import { readFileSync, writeFileSync } from 'node:fs';

const css = readFileSync(new URL('../css/styles.css', import.meta.url), 'utf8').replace(/\s+$/, '');
const htmlPath = new URL('../index.html', import.meta.url);
const html = readFileSync(htmlPath, 'utf8');
const next = html.replace(
    /<style id="app-css">[\s\S]*?<\/style>/,
    `<style id="app-css">\n${css}\n</style>`,
);

if (next === html) {
    throw new Error('index.html is missing <style id="app-css">');
}

writeFileSync(htmlPath, next);
