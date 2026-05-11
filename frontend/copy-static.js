const fs = require('fs');
const path = require('path');

const src = path.join(__dirname, 'static');
const dst = path.join(__dirname, 'dist/dev/mp-weixin/static');

function copyDir(s, d) {
  fs.mkdirSync(d, { recursive: true });
  for (const f of fs.readdirSync(s)) {
    const sf = path.join(s, f), df = path.join(d, f);
    const st = fs.statSync(sf);
    if (st.isDirectory()) copyDir(sf, df);
    else fs.writeFileSync(df, fs.readFileSync(sf));
  }
}

copyDir(src, dst);
console.log('static copied to dist/dev/mp-weixin/static/');
