const {contextBridge, ipcRenderer} = require('electron');
const path = require('path');
const { styleText } = require('util');

// expose APIs to renderer
contextBridge.exposeInMainWorld('electronAPI', {
    getDiagnosticCheckPath: () => path.join(__dirname, 'diagnostic_check.json'),
    sendUpdateDiagnosticCheck: (questionIndex, correct) => ipcRenderer.send('update-diagnostic-check', questionIndex, correct),
    onUpdateQuiz: (callback) => ipcRenderer.on('update-quiz', (event, html) => callback(html)),
    onUpdateQuizAnswers: (callback) => ipcRenderer.on('update-quiz-answers', (event, data) => callback(data)),
    onDiagnosticCheckDone: (event, score_corr, score_tot) => ipcRenderer.send('diagnostic-check-done', event, score_corr, score_tot),
    onUpdateDiagnosticQuestionsData: (question, index) => ipcRenderer.send('update-diagnostic-questions-data', question, index),
    tellRendererDiagnosticDone: () => ipcRenderer.send('diagnostic-is-done'),
    onTellRendererDiagnosticDone: (callback) => ipcRenderer.on('diagnostic-is-done', (event, data) => callback(data)),

    openQuizWindow: () => ipcRenderer.send('open-quiz-window'),
    updateQuiz: (html) => ipcRenderer.send('update-quiz', html),
    updateQuizAnswers: (data) => ipcRenderer.send('update-quiz-answers', data),
    storeGet: (key) => ipcRenderer.invoke('store-get', key),
    storeSet: (key, value) => ipcRenderer.invoke('store-set', key, value),
    styleText: (styles, text) => styleText(styles, text),
});