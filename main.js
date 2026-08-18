import { createRequire } from 'module';
import { fileURLToPath } from 'url';
const require = createRequire(import.meta.url);

const {app, BrowserWindow, ipcMain} = require("electron");

const Store = require('electron-store');
const store = new Store();
Store.initRenderer();

const fs = require('fs');
const path = require('path');

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function createWindow() {
    const mainWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        webPreferences: {
            preload: path.join(__dirname, 'preload.cjs'), // loads preload script
            nodeIntegration: false,
            contextIsolation: true,
            sandbox: false, // tbd
        }
    });
    mainWindow.isMainWindow = true;
    mainWindow.loadFile("index.html");

    // store.delete('username');
    // store.delete('physics-units');
    // store.delete('physics-units-progress');
}


app.whenReady().then(createWindow);

ipcMain.on('open-quiz-window', () => {
    let quizWindow = new BrowserWindow({ // changed from const
        width: 800,
        height: 800,
        alwaysOnTop: true,
        webPreferences: {
            preload: path.join(__dirname, 'preload.cjs'),
            nodeIntegration: false,
            contextIsolation: true,
            sandbox: false, // tbd
        }
    })
    quizWindow.isQuizWindow = true;
    quizWindow.loadFile("quiz.html");

    quizWindow.on('closed', () => {
        quizWindow = null;
    })
})

ipcMain.on("diagnostic-check-done", async (event, score_corr, score_tot, random, unitIndex) => {
    // update phys unit progress
    console.log("recieving data in main: " + score_corr + score_tot);

    let up = store.get('physics-units-progress')
    if (score_tot >= 8) {
        console.log("SETTING MASTERED");
        console.log(unitIndex);
        console.log(up);
        up[unitIndex] = "mastered";
        console.log("content mastered");
        // send a message saying you can move on
    } else {
        up[unitIndex] = "needs work";
        console.log("content needs work");
        // send a message saying you need more work
        // ask if they want to review
    }
    console.log(up)
    store.set('physics-units-progress', up);

})

ipcMain.on('update-quiz', (event, html) => {
    const allWindows = BrowserWindow.getAllWindows();
    let quizWindow = allWindows.find(win => win.isQuizWindow === true);
    console.log(allWindows);
    console.log(quizWindow);
    if (quizWindow && quizWindow.webContents) {
        if (quizWindow.webContents.isLoading()) {
            quizWindow.webContents.on('did-finish-load', () => {
                quizWindow.webContents.send('update-quiz', html);
            });
        } else {
            quizWindow.webContents.send('update-quiz', html);
        }
    } else {
        console.error('quiz window doesnt exist');
    }
});

ipcMain.on('remove-loading', () => {
    const allWindows = BrowserWindow.getAllWindows();
    let quizWindow = allWindows.find(win => win.isQuizWindow === true);
    quizWindow.webContents.send('remove-loading');
});

ipcMain.on('diagnostic-is-done', (event) => {
    const allWindows = BrowserWindow.getAllWindows();
    let mainWindow = allWindows.find(win => win.isMainWindow === true);
    mainWindow.webContents.send('diagnostic-is-done');
});

ipcMain.on('unit-correct', (event, unitIndex) => {
    const allWindows = BrowserWindow.getAllWindows();
    let mainWindow = allWindows.find(win => win.isMainWindow === true);
    mainWindow.webContents.send('unit-correct', unitIndex);
});

ipcMain.on('update-quiz-answers', (event, data) => {
    const allWindows = BrowserWindow.getAllWindows();
    let quizWindow = allWindows.find(win => win.isQuizWindow === true);

    if (quizWindow && quizWindow.webContents) {
        if (quizWindow.webContents.isLoading()) {
            quizWindow.webContents.on('did-finish-load', () => {
                console.log("updating web contents");
                quizWindow.webContents.send('update-quiz-answers', data);
            });
        } else {
            console.log("updating web contents");
            quizWindow.webContents.send('update-quiz-answers', data);
        }
    }
});

ipcMain.on('update-diagnostic-questions-data', (event, question, index) => {
    const dcpath = path.join(__dirname, 'diagnostic_check.json');
    const data = JSON.parse(fs.readFileSync(dcpath, 'utf8'));
    data[parseInt(index, 10)].question = question;
    fs.writeFileSync(dcpath, JSON.stringify(data, null, 2), 'utf8');
})

ipcMain.on('update-diagnostic-check', async (event, question_index, correct) => {
    console.log("updating: ", correct);
    const dcpath = path.join(__dirname, 'diagnostic_check.json');
    const data = JSON.parse(fs.readFileSync(dcpath, 'utf8'));

    try {
        if (question_index > -1 && question_index < data.length) {
            console.log(correct);
            data[question_index].value = correct;
        } else {
            console.error("invalid question");
            return;
        }

        fs.writeFileSync(dcpath, JSON.stringify(data, null, 2), 'utf8');
        console.log('diagnostic data updated');

        store.set('topics-to-review', "");

        // save what stuff to review
        if (!correct) {
            let toreview = store.get('topics-to-review');
            console.log("TOPICS TO REVIEW: " + toreview);
            let newtoreview = toreview + " . " + data[question_index].question;
            console.log("ADDING " + data[question_index].question);
            store.set('topics-to-review', newtoreview);
        }
    } catch (e) {
        console.error(e);
    }
})

ipcMain.handle('store-get', (event, key) => {
    return store.get(key);
});

ipcMain.handle('store-set', (event, key, value) => {
    store.set(key, value);
    return true;
});

// store.delete("username");
// store.delete('physics-level');
// store.delete('physics-units');