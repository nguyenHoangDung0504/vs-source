const fs = require("fs");
const path = require("path");
const { decryptLine } = require("../utils/encryption");

const rootDir = process.cwd();
const MAPPING_FILE = path.join(rootDir, "file-mapping.txt");

function readMapping() {
    if (!fs.existsSync(MAPPING_FILE)) return [];
    return fs.readFileSync(MAPPING_FILE, "utf8")
        .split("\n")
        .filter(Boolean)
        .map(decryptLine)
        .map(line => {
            const [hash, name] = line.split("|");
            return { hash, name };
        });
}

function findHashByName(name) {
    const mappings = readMapping();
    const entry = mappings.find(item => item.name === name);
    return entry ? entry.hash : null;
}

function findNameByHash(hash) {
    const mappings = readMapping();
    const entry = mappings.find(item => item.hash === hash);
    return entry ? entry.name : null;
}

function cleanMapping(storageHashes) {
    const validLines = readMapping()
        .filter(entry => storageHashes.includes(entry.hash))
        .map(entry => Buffer.from(`${entry.hash}|${entry.name}`).map(byte => byte ^ 29).toString("hex"));

    fs.writeFileSync(MAPPING_FILE, validLines.join("\n") + "\n");
}

module.exports = {
    readMapping,
    findHashByName,
    findNameByHash,
    cleanMapping,
};
