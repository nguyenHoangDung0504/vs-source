const SECRET_KEY = 29;

function xorDecrypt(buffer) {
    return Buffer.from(buffer.map(byte => byte ^ SECRET_KEY));
}

function decryptLine(hexLine) {
    const buffer = Buffer.from(hexLine, "hex");
    return xorDecrypt(buffer).toString();
}

module.exports = {
    xorDecrypt,
    decryptLine,
    SECRET_KEY,
};
