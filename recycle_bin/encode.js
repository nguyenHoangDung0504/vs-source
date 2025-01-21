const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const STORAGE_DIR = path.join(__dirname, "storage");
const MAPPING_FILE = path.join(__dirname, "file_mapping.txt");
const SECRET_KEY = 29;

// Hàm băm tên file (SHA-256)
const hashFileName = (fileName) => {
    return crypto.createHash("sha256").update(fileName).digest("hex").substring(0, 16); // Sử dụng 16 ký tự đầu
};

// Mã hóa 1 KB đầu tiên
const encodeFile = (filePath) => {
    const fileBuffer = fs.readFileSync(filePath);

    // Mã hóa 1 KB đầu tiên
    const headerSize = Math.min(1024, fileBuffer.length); // Mã hóa tối đa 1 KB
    const header = Buffer.from(fileBuffer.subarray(0, headerSize).map(byte => byte ^ SECRET_KEY));

    // Kết hợp header đã mã hóa với phần còn lại của file
    const encodedBuffer = Buffer.concat([header, fileBuffer.subarray(headerSize)]);

    // Ghi đè lên file gốc
    fs.writeFileSync(filePath, encodedBuffer);
};

// Lưu hash và tên file gốc vào file mapping
const saveMapping = (hash, originalFileName) => {
    const encryptedLine = Buffer.from(`${hash}|${originalFileName}`).map(byte => byte ^ SECRET_KEY).toString('hex');
    fs.appendFileSync(MAPPING_FILE, encryptedLine + "\n"); // Lưu dòng mã hóa
};

// Mã hóa tên file và đổi định dạng
const encodeStorage = () => {
    const files = fs.readdirSync(STORAGE_DIR);

    files.forEach((file) => {
        const filePath = path.join(STORAGE_DIR, file);

        if (fs.lstatSync(filePath).isFile() && file.endsWith(".mp4")) {
            console.log(`Encoding file: ${file}`);

            // Mã hóa nội dung file
            encodeFile(filePath);

            // Tạo hash cho tên file
            const hash = hashFileName(file);
            const newFilePath = path.join(STORAGE_DIR, `${hash}.file`);

            // Lưu hash và tên file gốc vào file mapping
            saveMapping(hash, file);

            // Đổi tên file
            try {
                fs.renameSync(filePath, newFilePath);
                console.log(`Renamed ${file} to ${hash}.file`);
            } catch (err) {
                console.error(`Failed to rename ${file}:`, err);
            }
        }
    });

    console.log("Encoding completed.");
};

encodeStorage();