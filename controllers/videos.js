const express = require("express");
const fs = require("fs");
const path = require("path");
const { serveVideo } = require("../services/videoService");
const { findHashByName, findNameByHash, cleanMapping } = require("../services/fileMapping");
const { cleanCache, cacheTTL } = require("../services/videoCache");

const STORAGE_DIR = path.join(process.cwd(), "storage");
const router = express.Router();

router.get("/", (_, res) => {
    const files = fs.readdirSync(STORAGE_DIR).filter(f => f.endsWith(".file"));
    const list = files.map(f => findNameByHash(f.replace(".file", "")) || f);
    res.json(list);
});

router.get("/:name", (req, res) => {
    const name = decodeURIComponent(req.params.name);
    const hash = findHashByName(name);
    if (!hash) return res.status(404).send("Video not found");

    const filePath = path.join(STORAGE_DIR, `${hash}.file`);
    const shouldDownload = req.query.download === "1";
    serveVideo(filePath, req, res, shouldDownload ? name : undefined);
});

router.delete("/:name", (req, res) => {
    const name = decodeURIComponent(req.params.name);
    const hash = findHashByName(name);
    if (!hash) return res.status(404).json({ success: false, message: "Video not found" });

    const filePath = path.join(STORAGE_DIR, `${hash}.file`);
    if (fs.existsSync(filePath)) {
        try {
            fs.unlinkSync(filePath);
            const remainingHashes = fs.readdirSync(STORAGE_DIR).map(f => f.replace(".file", ""));
            cleanMapping(remainingHashes);
            res.json({ success: true, message: "File deleted" });
        } catch {
            res.status(500).json({ success: false, message: "Delete failed" });
        }
    } else {
        res.status(404).json({ success: false, message: "File not found" });
    }
});

setInterval(cleanCache, cacheTTL / 2);

module.exports = router;
