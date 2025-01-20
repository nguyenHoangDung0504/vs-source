const fs = require("fs");
const path = require("path");

const STORAGE_DIR = path.join(__dirname, "storage");
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

// Giải mã tên file (chuyển từ hex trở lại)
const decodeFileName = (encodedFileName) => {
    const decodedBuffer = Buffer.from(encodedFileName, 'hex');
    return decodedBuffer.map(byte => byte ^ SECRET_KEY).toString(); // Giải mã tên file
};

// Giải mã và phục hồi các file
const decodeStorage = () => {
    const files = fs.readdirSync(STORAGE_DIR);

    files.forEach((file) => {
        const filePath = path.join(STORAGE_DIR, file);

        if (fs.lstatSync(filePath).isFile() && isEncoded(filePath)) {
            console.log(`Decoding file: ${file}`);

            // Giải mã file
            decodeFile(filePath);

            // Giải mã tên file
            const encodedFileName = file.split('.txt')[0]; // Lấy tên file đã mã hóa (bỏ phần .txt)
            const decodedFileName = decodeFileName(encodedFileName);
            const newFilePath = path.join(STORAGE_DIR, `${decodedFileName}.mp4`); // Đổi lại định dạng thành .mp4

            // Đổi tên file sau khi giải mã
            fs.renameSync(filePath, newFilePath);
        }
    });

    console.log("Decoding completed.");
};

// Kiểm tra file đã mã hóa chưa
const isEncoded = (filePath) => {
    return filePath.endsWith(".txt");
};

decodeStorage();