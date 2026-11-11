// Renders cover.html to cover.png at 2000×840 with Electron.
const { app, BrowserWindow } = require('electron');
const fs = require('fs'), path = require('path');
app.whenReady().then(async () => {
  const w = new BrowserWindow({ width: 800, height: 500, show: false, useContentSize: true, webPreferences: { offscreen: false, zoomFactor: 1 } });
  await w.loadFile(path.join(__dirname, 'blog.html'));
  await new Promise((r) => setTimeout(r, 500));
  w.webContents.setZoomFactor(1);
  const img = await w.webContents.capturePage();
  fs.writeFileSync(path.join(__dirname, 'blog.png'), img.toPNG());
  console.log('size', img.getSize());
  app.quit();
});
