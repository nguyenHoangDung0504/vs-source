const fs = require("fs");
const { xorDecrypt } = require("../utils/encryption");
const { getFromCache, addToCache } = require("./videoCache");

function serveVideo(filePath, req, res, downloadName) {
    if (!fs.existsSync(filePath)) return res.status(404).send("File not found");

    const stats = fs.statSync(filePath);
    const range = req.headers.range;
    const headers = {
        "Accept-Ranges": "bytes",
        "Content-Type": "video/mp4",
    };

    if (downloadName) {
        headers["Content-Disposition"] = `attachment; filename*=UTF-8''${encodeURIComponent(downloadName)}`;
    }

    if (range) {
        const [startStr, endStr] = range.replace(/bytes=/, "").split("-");
        const start = parseInt(startStr, 10);
        const end = endStr ? parseInt(endStr, 10) : stats.size - 1;
        const chunkSize = end - start + 1;

        headers["Content-Range"] = `bytes ${start}-${end}/${stats.size}`;
        headers["Content-Length"] = chunkSize;

        let buffer = getFromCache(filePath);
        if (!buffer) {
            buffer = fs.readFileSync(filePath);
            addToCache(filePath, buffer);
        }

        let responseChunk;
        if (start < 1024) {
            const decodedHeader = xorDecrypt(buffer.slice(0, 1024));
            responseChunk = Buffer.concat([
                decodedHeader.subarray(start, Math.min(decodedHeader.length, end + 1)),
                buffer.slice(Math.max(1024, start), end + 1),
            ]);
        } else {
            responseChunk = buffer.slice(start, end + 1);
        }

        res.writeHead(206, headers);
        res.end(responseChunk);
    } else {
        headers["Content-Length"] = stats.size;
        res.writeHead(200, headers);
        fs.createReadStream(filePath).pipe(res);
    }
}

module.exports = { serveVideo };
