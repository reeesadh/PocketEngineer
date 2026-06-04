import { createRequire } from 'module';
const require = createRequire(import.meta.url);

const {app, BrowserWindow} = require("electron");

const Store = require('electron-store');
const store = new Store();
Store.initRenderer();

function createWindow() {
    const window = new BrowserWindow({
        width: 1200,
        height: 800,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
        }
    })
    window.loadFile("index.html");
}

app.whenReady().then(createWindow);