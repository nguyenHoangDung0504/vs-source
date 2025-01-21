const fs = require("fs");
const path = require("path");

const STORAGE_DIR = path.join(process.cwd(), "storage");
const MAPPING_FILE = path.join(process.cwd(), "file-mapping.txt");
const SECRET_KEY = 29;

// Giải mã 1 KB đầu tiên
const decodeFile = (filePath) => {
    const fileBuffer = fs.readFileSync(filePath);

    // Giải mã 1 KB đầu tiên
    const headerSize = Math.min(1024, fileBuffer.length); // Giới hạn 1 KB
    const header = Buffer.from(fileBuffer.subarray(0, headerSize).map(byte => byte ^ SECRET_KEY));

    // Kết hợp header đã giải mã với phần còn lại của file
    const decodedBuffer = Buffer.concat([header, fileBuffer.subarray(headerSize)]);

    // Ghi lại file đã giải mã (ghi đè lên file gốc)
    fs.writeFileSync(filePath, decodedBuffer);
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

// Xóa hash và tên file gốc khỏi file mapping
const removeMapping = (hash) => {
    if (!fs.existsSync(MAPPING_FILE)) return;
    const lines = fs.readFileSync(MAPPING_FILE, "utf8").split("\n").filter(Boolean);
    const updatedLines = lines.filter((line) => {
        const decryptedLine = Buffer.from(line, "hex").map(byte => byte ^ SECRET_KEY).toString();
        const [storedHash] = decryptedLine.split("|");
        return storedHash !== hash;
    });
    fs.writeFileSync(MAPPING_FILE, updatedLines.join("\n") + "\n");
};

// Giải mã và phục hồi các file
const decodeStorage = () => {
    const files = fs.readdirSync(STORAGE_DIR);

    files.forEach((file) => {
        const filePath = path.join(STORAGE_DIR, file);

        if (fs.lstatSync(filePath).isFile() && isEncoded(file)) {
            console.log(`Decoding file: ${file}`);

            // Lấy hash từ tên file mã hóa
            const hash = path.basename(file, ".file");

            // Lấy tên gốc từ mapping
            const originalFileName = getOriginalFileName(hash);
            if (!originalFileName) {
                console.warn(`Original file name for hash '${hash}' not found. Skipping file.`);
                return;
            }

            // Giải mã file
            decodeFile(filePath);

            // Tạo đường dẫn mới với tên gốc
            const newFilePath = path.join(STORAGE_DIR, `${originalFileName}`);

            // Đổi tên file sau khi giải mã
            try {
                fs.renameSync(filePath, newFilePath);
                console.log(`Renamed ${file} to ${originalFileName}`);

                // Xóa hash và tên gốc khỏi file mapping
                removeMapping(hash);
            } catch (err) {
                console.error(`Failed to rename ${file}:`, err);
            }
        }
    });

    console.log("Decoding completed.");
};

// Kiểm tra file đã mã hóa chưa
const isEncoded = (fileName) => {
    return fileName.endsWith(".file");
};

decodeStorage();