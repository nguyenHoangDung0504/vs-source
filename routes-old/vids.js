const express = require('express');
const fs = require("fs");
const path = require("path");

const router = express.Router();
const rootDir = process.cwd();

const STORAGE_DIR = path.join(rootDir, "storage");
const MAPPING_FILE = path.join(rootDir, "file-mapping.txt");
const SECRET_KEY = 29;
const cache = new Map();
const cacheTTL = 1 * 60 * 1000;

router.get("/", (_, res) => {
    const files = fs.readdirSync(STORAGE_DIR).filter(file => file.endsWith(".file"));
    const videoList = files.map(file => {
        const hash = file.replace(/\.file$/, "");
        const originalName = getOriginalFileName(hash);
        return originalName || hash;
    });

    res.json(videoList);
});

router.get("/:name", (req, res) => {
    const originalFileName = decodeURIComponent(req.params.name);
    const files = fs.readFileSync(MAPPING_FILE, "utf8").split("\n").filter(Boolean);
    let hash = null;

    for (const line of files) {
        const decryptedLine = Buffer.from(line, "hex").map(byte => byte ^ SECRET_KEY).toString();
        const [storedHash, originalName] = decryptedLine.split("|");
        if (originalName === originalFileName) {
            hash = storedHash;
            break;
        }
    }

    if (!hash) {
        res.status(404).send("Video not found");
        return;
    }

    const filePath = path.join(STORAGE_DIR, `${hash}.file`);
    serveVideo(filePath, req, res);
});

router.get("/download/:name", (req, res) => {
    const originalFileName = decodeURIComponent(req.params.name);
    const files = fs.readFileSync(MAPPING_FILE, "utf8").split("\n").filter(Boolean);
    let hash = null;

    for (const line of files) {
        const decryptedLine = Buffer.from(line, "hex").map(byte => byte ^ SECRET_KEY).toString();
        const [storedHash, originalName] = decryptedLine.split("|");
        if (originalName === originalFileName) {
            hash = storedHash;
            break;
        }
    }

    if (!hash) {
        res.status(404).send("Video not found");
        return;
    }

    const filePath = path.join(STORAGE_DIR, `${hash}.file`);
    serveVideo(filePath, req, res, originalFileName); // Đánh dấu là tải xuống
});

router.delete("/:name", (req, res) => {
    const originalFileName = decodeURIComponent(req.params.name);
    const files = fs.readFileSync(MAPPING_FILE, "utf8").split("\n").filter(Boolean);
    const cleanUpMapping = () => {
        if (!fs.existsSync(MAPPING_FILE)) return;

        // Lấy danh sách các hash trong thư mục storage
        const storageFiles = fs.readdirSync(STORAGE_DIR)
            .filter(file => file.endsWith(".file"))
            .map(file => path.basename(file, ".file"));

        const lines = fs.readFileSync(MAPPING_FILE, "utf8").split("\n").filter(Boolean);
        const updatedLines = lines.filter((line) => {
            const decryptedLine = Buffer.from(line, "hex").map(byte => byte ^ SECRET_KEY).toString();
            const [storedHash] = decryptedLine.split("|");
            // Chỉ giữ lại các hash có trong storage
            return storageFiles.includes(storedHash);
        });

        fs.writeFileSync(MAPPING_FILE, updatedLines.join("\n") + "\n");
    };
    let hash = null;

    for (const line of files) {
        const decryptedLine = Buffer.from(line, "hex").map(byte => byte ^ SECRET_KEY).toString();
        const [storedHash, originalName] = decryptedLine.split("|");
        if (originalName === originalFileName) {
            hash = storedHash;
            break;
        }
    }

    if (!hash) {
        res.status(404).send("Video not found");
        return;
    }

    const filePath = path.join(STORAGE_DIR, `${hash}.file`);
    if (fs.existsSync(filePath)) {
        try {
            fs.unlinkSync(filePath);
            cleanUpMapping();
            res.json({ success: true, message: "File deleted and mapping cleaned" });
        } catch (err) {
            res.status(500).json({ success: false, message: "Failed to delete file" });
        }
    } else {
        res.status(404).json({ success: false, message: "File not found" });
    }
});

setInterval(cleanCache, cacheTTL / 2);

module.exports = router;

function decodeHeader(buffer) {
    return Buffer.from(buffer.map(byte => byte ^ SECRET_KEY));
}

function getOriginalFileName(hash) {
    if (!fs.existsSync(MAPPING_FILE)) return null;
    const lines = fs.readFileSync(MAPPING_FILE, "utf8").split("\n").filter(Boolean);
    for (const line of lines) {
        const decryptedLine = Buffer.from(line, "hex").map(byte => byte ^ SECRET_KEY).toString();
        const [storedHash, originalFileName] = decryptedLine.split("|");
        if (storedHash === hash) return originalFileName;
    }
    return null;
}

function addToCache(filePath, buffer) {
    const currentTime = Date.now();
    cache.set(filePath, {
        buffer,
        lastAccess: currentTime,
    });
}

function cleanCache() {
    const currentTime = Date.now();
    for (const [filePath, fileData] of cache.entries()) {
        if (currentTime - fileData.lastAccess > cacheTTL) {
            cache.delete(filePath);
            console.log(`Cache expired for file: ${filePath}`);
        }
    }
}

function getFromCache(filePath) {
    if (cache.has(filePath)) {
        const fileData = cache.get(filePath);
        fileData.lastAccess = Date.now();
        return fileData.buffer;
    }
    return null;
}

function serveVideo(filePath, req, res, downloadName) {
    if (!fs.existsSync(filePath)) {
        res.status(404).send("File not found");
        return;
    }

    const stats = fs.statSync(filePath);
    const totalSize = stats.size;
    const range = req.headers.range;

    // Tạo response headers
    const headers = {
        "Accept-Ranges": "bytes",
        "Content-Type": "video/mp4",
    };

    if (downloadName) headers["Content-Disposition"] = `attachment; filename*=UTF-8''${encodeURIComponent(downloadName)}`;

    if (range) {
        const [startStr, endStr] = range.replace(/bytes=/, "").split("-");
        const start = parseInt(startStr, 10);
        const end = endStr ? parseInt(endStr, 10) : totalSize - 1;
        const chunkSize = end - start + 1;

        headers["Content-Range"] = `bytes ${start}-${end}/${totalSize}`;
        headers["Content-Length"] = chunkSize;

        let buffer = getFromCache(filePath);
        let responseChunk;

        if (!buffer) {
            console.log("Cache miss. Reading file...");
            buffer = fs.readFileSync(filePath);
            addToCache(filePath, buffer);
        }

        if (start < 1024) {
            const headerSize = Math.min(1024, buffer.length);
            const decodedHeader = decodeHeader(buffer.slice(0, headerSize));
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
        headers["Content-Length"] = totalSize;
        res.writeHead(200, headers);
        fs.createReadStream(filePath).pipe(res);
    }
}