const http = require("http");
const fs = require("fs");
const path = require("path");

const STORAGE_DIR = path.join(__dirname, "storage");
const MAPPING_FILE = path.join(__dirname, "file_mapping.txt");
const PORT = 3000;
const SECRET_KEY = 29;

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

// Phục vụ video với hỗ trợ HTTP Range
const serveVideo = (filePath, req, res) => {
    const stats = fs.statSync(filePath);
    const totalSize = stats.size;
    const range = req.headers.range;

    if (range) {
        const [startStr, endStr] = range.replace(/bytes=/, "").split("-");
        const start = parseInt(startStr, 10);
        const end = endStr ? parseInt(endStr, 10) : totalSize - 1;

        const chunkSize = end - start + 1;
        const fileStream = fs.createReadStream(filePath, { start, end });

        res.writeHead(206, {
            "Content-Range": `bytes ${start}-${end}/${totalSize}`,
            "Accept-Ranges": "bytes",
            "Content-Length": chunkSize,
            "Content-Type": "video/mp4",
        });

        fileStream.pipe(res);
    } else {
        res.writeHead(200, {
            "Content-Length": totalSize,
            "Content-Type": "video/mp4",
        });

        fs.createReadStream(filePath).pipe(res);
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

// Xử lý request của client
const server = http.createServer((req, res) => {
    if (req.url === "/") {
        const indexPath = path.join(__dirname, "public", "index.html");
        res.writeHead(200, { "Content-Type": "text/html" });
        fs.createReadStream(indexPath).pipe(res);
    }

    else if (req.url.startsWith("/video/")) {
        const originalFileName = decodeURIComponent(req.url.replace("/video/", ""));
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
            res.writeHead(404, { "Content-Type": "text/plain" });
            return res.end("Video not found");
        }
    
        const filePath = path.join(STORAGE_DIR, `${hash}.file`);
        if (!fs.existsSync(filePath)) {
            res.writeHead(404, { "Content-Type": "text/plain" });
            return res.end("File not found");
        }
    
        // Tạo tên file tạm duy nhất
        const tempFilePath = `${filePath}.${Date.now()}.tmp`;
    
        try {
            const fileBuffer = fs.readFileSync(filePath, { flag: "r" });
    
            const headerSize = Math.min(1024, fileBuffer.length);
            const decodedHeader = decodeHeader(fileBuffer.slice(0, headerSize));
            const combinedBuffer = Buffer.concat([decodedHeader, fileBuffer.slice(headerSize)]);
    
            fs.writeFileSync(tempFilePath, combinedBuffer);
    
            // Phục vụ video
            serveVideo(tempFilePath, req, res);
    
            // Xóa file tạm sau khi phục vụ xong
            res.on("finish", () => {
                if (fs.existsSync(tempFilePath)) {
                    fs.unlinkSync(tempFilePath);
                }
            });
        } catch (err) {
            console.error("Error processing file:", err);
            res.writeHead(500, { "Content-Type": "text/plain" });
            res.end("Internal Server Error");
        }
    }       
    
    else if (req.url === "/list") {
        const videoList = getVideoList();
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify(videoList));
    }
    
    else if (req.url.startsWith("/delete/")) {
        const originalFileName = decodeURIComponent(req.url.replace("/delete/", ""));
        const hash = getVideoList().find((name) => name === originalFileName);
        const filePath = path.join(STORAGE_DIR, `${hash}.file`);

        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
            res.writeHead(200, { "Content-Type": "application/json" });
            return res.end(JSON.stringify({ success: true, message: "File deleted" }));
        }

        res.writeHead(404, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ success: false, message: "File not found" }));
    } else {
        res.writeHead(404, { "Content-Type": "text/plain" });
        res.end("Not Found");
    }
});

server.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});