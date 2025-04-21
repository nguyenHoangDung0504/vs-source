const express = require('express');
const path = require('path');
const os = require('os');
const app = express();

const vids = require('./routes-old/vids');

const PORT = 3000;

app.use(express.static(path.join(__dirname, "public")));
app.use(express.json());

app.use('/vids', vids);

app.listen(PORT, () => {
    console.log(`Server đang chạy trên http://${getServerWiFiIP()}:${PORT}`);
});

function getServerWiFiIP() {
    const interfaces = os.networkInterfaces();
    const wifiInterface = interfaces['Wi-Fi'];

    if (wifiInterface) {
        for (const details of wifiInterface) {
            if (details.family === 'IPv4' && !details.internal) {
                return details.address;
            }
        }
    }

    return undefined;
}