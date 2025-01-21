const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const STORAGE_DIR = path.join(process.cwd(), "storage");
const MAPPING_FILE = path.join(process.cwd(), "file-mapping.txt");
const SECRET_KEY = 29;

// Hàm băm tên file (SHA-256)
const hashFileName = (fileName) => {
    return crypto.createHash("sha256").update(fileName).digest("hex").substring(0, 16); // Sử dụng 16 ký tự đầu
};

// Hàm đọc tên gốc từ file mapping
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

// Hàm tạo hash không trùng lặp trong mapping
const generateUniqueHash = (fileName) => {
    let hash;
    do {
        hash = hashFileName(fileName);
        fileName += "-retry"; // Thay đổi nội dung băm nếu phát hiện trùng
    } while (getOriginalFileName(hash));
    return hash;
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
            console.log(`Processing file: ${file}`);

            // Kiểm tra xem tên gốc đã tồn tại trong file mapping chưa
            const existingHash = hashFileName(file);
            const existingOriginalFileName = getOriginalFileName(existingHash);
            if (existingOriginalFileName) {
                console.warn(`File '${file}' skipped. Encoded file with original name '${existingOriginalFileName}' already exists.`);
                return;
            }

            // Tạo hash không trùng lặp
            const hash = generateUniqueHash(file);

            // Mã hóa nội dung file
            encodeFile(filePath);

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