const { app, BrowserWindow, globalShortcut, Menu, MenuItem} = require("electron");

var win;

const menu = new Menu();
menu.append(new MenuItem({
    label: 'ショートカット',
    submenu: [{
        role: 'reload',
        accelerator: 'F5',
        click: () => {
            win.loadFile('3dcg.html');
        }
    },{
        role: 'toggleDevTools',
        accelerator: 'F12',
        click: () => {
            if (win.webContents.isDevToolsOpened()){
                win.webContents.closeDevTools();
            } else {
                win.webContents.openDevTools();
            }
        }
    }]
}));

Menu.setApplicationMenu(menu);
const createWindow = () => {
    win = new BrowserWindow({
        backgroundColor: '#1e1e1e',
        width: 800,
        height: 820,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            enableRemoteModule: false,
        }
    });
    win.loadFile('index.html');
};


app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
    }
});

app.on('will-quit', () => {
    globalShortcut.unregisterAll();
});
