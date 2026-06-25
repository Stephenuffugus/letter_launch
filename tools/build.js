/* Letter Launch — build the single-file standalone.
 * Inlines styles.css and all scripts (in load order) from ../docs into one
 * portable .html written back into ../docs.
 *   node tools/build.js   ->  docs/letter-launch-standalone.html
 *
 * The standalone is the "drop into any website / hand to anyone" artifact:
 * one self-contained file, no local dependencies (fonts still load from Google
 * Fonts over the network). The multi-file docs/ folder is what GitHub Pages serves.
 */
const fs=require('fs'), path=require('path');
const docs=path.join(__dirname,'..','docs');
const read=f=>fs.readFileSync(path.join(docs,f),'utf8');

let html=read('index.html');
const css=read('styles.css');
const scripts=['dict.js','rng.js','audio.js','share.js','store.js','levels.js','game.js'];

// inline stylesheet
html=html.replace(/<link rel="stylesheet" href="styles\.css">/,'<style>\n'+css+'\n</style>');

// inline scripts (replace each <script src="x"> with its contents)
for(const s of scripts){
  const tag=new RegExp('<script src="'+s.replace('.','\\.')+'"><\\/script>');
  html=html.replace(tag,'<script>\n'+read(s)+'\n</script>');
}

const out=path.join(docs,'letter-launch-standalone.html');
fs.writeFileSync(out,html);
console.log('Built standalone ('+(html.length/1024|0)+' KB) ->\n  '+out);
