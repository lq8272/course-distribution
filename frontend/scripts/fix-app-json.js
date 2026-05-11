const fs = require('fs');
const path = require('path');

const appJsonPath = path.join(__dirname, '..', 'dist', 'build', 'mp-weixin', 'app.json');

const data = JSON.parse(fs.readFileSync(appJsonPath, 'utf8'));
if (!data.lazyCodeLoading) {
  data.lazyCodeLoading = 'requiredComponents';
  fs.writeFileSync(appJsonPath, JSON.stringify(data, null, 2), 'utf8');
  console.log('Added lazyCodeLoading to app.json');
} else {
  console.log('lazyCodeLoading already set');
}
