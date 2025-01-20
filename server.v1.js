const express = require("express");
const fs = require("fs");
const path = require("path");

const app = express();
const STORAGE_DIR = path.join(__dirname, "storage");
const MAPPING_FILE = path.join(__dirname, "file_mapping.txt");
const PORT = 3000;
const SECRET_KEY = 29;

app.use(express.static(path.join(__dirname, "public")));

// Giải mã header 1 KB
const decodeHeader = (buffer) => {
    return Buffer.from(buffer.map(byte => byte ^ SECRET_KEY));
};

// Lấy tên gốc từ file mapping
const getOriginalFileName = (hash) => {
    if (!fs.existsSync(MAPPING_FILE)) return null;
    const lines = fs.readFileSync(MAPPING_FILE, "utf8").split("\n").filter(Boolean);

    for (const line of lines) {
        const decryptedLine = Buffer.from(line, "hex").map(byte => byte ^ SECRET_KEY).toString();
        const [storedHash, originalFileName] = decryptedLine.split("|");

        if (storedHash === hash) return originalFileName;
    }
    return null;
};

// Phục vụ video với giải mã và hỗ trợ HTTP Range
const serveVideo = (filePath, req, res) => {
    const stats = fs.statSync(filePath);
    const totalSize = stats.size;
    const range = req.headers.range;

    if (range) {
        // Phân tích Range từ request
        const [startStr, endStr] = range.replace(/bytes=/, "").split("-");
        const start = parseInt(startStr, 10);
        const end = endStr ? parseInt(endStr, 10) : totalSize - 1;

        const chunkSize = end - start + 1;

        // Giải mã dữ liệu trong khoảng Range
        const readStream = fs.createReadStream(filePath, { start, end });
        let headerDecoded = false;

        const decodedStream = readStream.pipe(
            require("stream").Transform({
                transform(chunk, encoding, callback) {
                    if (!headerDecoded && start < 1024) {
                        const headerSize = Math.min(1024 - start, chunk.length); // Giải mã header
                        const decodedHeader = decodeHeader(chunk.slice(0, headerSize));
                        const remaining = chunk.slice(headerSize);
                        headerDecoded = true;
                        callback(null, Buffer.concat([decodedHeader, remaining]));
                    } else {
                        callback(null, chunk);
                    }
                },
            })
        );

        // Gửi phản hồi với dữ liệu Range
        res.writeHead(206, {
            "Content-Range": `bytes ${start}-${end}/${totalSize}`,
            "Accept-Ranges": "bytes",
            "Content-Length": chunkSize,
            "Content-Type": "video/mp4",
        });

        decodedStream.pipe(res);
    } else {
        // Trường hợp không yêu cầu Range (phát toàn bộ file)
        const readStream = fs.createReadStream(filePath);
        let headerDecoded = false;

        const decodedStream = readStream.pipe(
            require("stream").Transform({
                transform(chunk, encoding, callback) {
                    if (!headerDecoded) {
                        const headerSize = Math.min(1024, chunk.length); // Giải mã header
                        const decodedHeader = decodeHeader(chunk.slice(0, headerSize));
                        const remaining = chunk.slice(headerSize);
                        headerDecoded = true;
                        callback(null, Buffer.concat([decodedHeader, remaining]));
                    } else {
                        callback(null, chunk);
                    }
                },
            })
        );

        res.writeHead(200, {
            "Content-Length": totalSize,
            "Content-Type": "video/mp4",
        });

        decodedStream.pipe(res);
    }
};

// Lấy danh sách file (giải mã tên file gốc từ hash)
const getVideoList = () => {
    const files = fs.readdirSync(STORAGE_DIR).filter(file => file.endsWith(".file"));
    return files.map(file => {
        const hash = file.replace(/\.file$/, "");
        const originalName = getOriginalFileName(hash);
        return originalName || hash;
    });
};

// API trả về danh sách video
app.get("/list", (req, res) => {
    const videoList = getVideoList();
    res.json(videoList);
});

// API phục vụ video
app.get("/video/:videoName", (req, res) => {
    const originalFileName = decodeURIComponent(req.params.videoName);
    const files = fs.readFileSync(MAPPING_FILE, "utf8").split("\n").filter(Boolean);

    // Tìm hash tương ứng với tên gốc
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
        return res.status(404).send("Video not found");
    }

    const filePath = path.join(STORAGE_DIR, `${hash}.file`);
    if (!fs.existsSync(filePath)) {
        return res.status(404).send("File not found");
    }

    try {
        // Phục vụ video với giải mã
        serveVideo(filePath, req, res);
    } catch (err) {
        console.error("Error processing file:", err);
        res.status(500).send("Internal Server Error");
    }
});

// API xóa video
app.delete("/delete/:videoName", (req, res) => {
    const originalFileName = decodeURIComponent(req.params.videoName);
    const files = fs.readFileSync(MAPPING_FILE, "utf8").split("\n").filter(Boolean);

    // Tìm hash tương ứng với tên gốc
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
        return res.status(404).send("Video not found");
    }

    const filePath = path.join(STORAGE_DIR, `${hash}.file`);

    if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        return res.json({ success: true, message: "File deleted" });
    }

    res.status(404).json({ success: false, message: "File not found" });
});

// Khởi động server
app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});