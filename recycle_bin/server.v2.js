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

const cache = new Map(); // Cache lưu trữ tạm thời
const cacheTTL = 1 * 60 * 1000; // TTL: 2 phút (120,000 ms)

// Hàm thêm file vào cache
function addToCache(filePath, buffer) {
    const currentTime = Date.now();
    cache.set(filePath, {
        buffer,
        lastAccess: currentTime,
    });

    // Tự động xóa khỏi cache sau TTL
    setTimeout(() => {
        if (cache.has(filePath) && cache.get(filePath).lastAccess < currentTime) {
            cache.delete(filePath);
            console.log(`Cache expired for file: ${filePath}`);
        }
    }, cacheTTL);
}

// Hàm lấy file từ cache (nếu có)
function getFromCache(filePath) {
    if (cache.has(filePath)) {
        const fileData = cache.get(filePath);
        fileData.lastAccess = Date.now(); // Cập nhật thời gian truy cập
        return fileData.buffer;
    }
    return null;
}

// Hàm phục vụ video
function serveVideo(filePath, req, res) {
    // Kiểm tra file có tồn tại không
    if (!fs.existsSync(filePath)) {
        res.statusCode = 404;
        res.end("File not found");
        return;
    }

    const stats = fs.statSync(filePath);
    const totalSize = stats.size;
    const range = req.headers.range;

    // Xử lý Range request
    if (range) {
        const [startStr, endStr] = range.replace(/bytes=/, "").split("-");
        const start = parseInt(startStr, 10);
        const end = endStr ? parseInt(endStr, 10) : totalSize - 1;

        const chunkSize = end - start + 1;

        console.log(`Serving range: ${start}-${end}`);

        // Kiểm tra cache
        let buffer = getFromCache(filePath);

        if (!buffer) {
            console.log("Cache miss. Reading file...");
            buffer = fs.readFileSync(filePath); // Đọc toàn bộ file vào RAM
            addToCache(filePath, buffer); // Thêm vào cache
        }

        // Nếu đoạn cần giải mã nằm trong phần 1KB đầu tiên
        let responseChunk;
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

        // Gửi phản hồi
        res.writeHead(206, {
            "Content-Range": `bytes ${start}-${end}/${totalSize}`,
            "Accept-Ranges": "bytes",
            "Content-Length": chunkSize,
            "Content-Type": "video/mp4",
        });
        res.end(responseChunk);
    } else {
        // Trường hợp không có Range (tải toàn bộ file)
        console.log("Serving full video");
        res.writeHead(200, {
            "Content-Length": totalSize,
            "Content-Type": "video/mp4",
        });
        fs.createReadStream(filePath).pipe(res);
    }
}

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