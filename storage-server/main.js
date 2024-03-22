const express = require('express');
const multer = require('multer');
const path = require('path');
const cors = require('cors');
const fs = require('fs-extra');

const app = express();
const port = 3000;
const OUT_FOLDER = "storage-server/data";

function ensureDirectoryExistence(filePath) {
  var dirname = path.dirname(filePath);
  if (fs.existsSync(dirname)) {
    return true;
  }
  ensureDirectoryExistence(dirname);
  fs.mkdirSync(dirname);
}

const saveAsset = (asset, basePath, name) => {
  const assetPath = path.join(basePath, `${name}`);
  ensureDirectoryExistence(assetPath);
  fs.writeFile(assetPath, Buffer.from(asset), (err) => {
    if (err) {
      console.error(`Error saving asset ${name}:`, err);
    } else {
      console.log(`Asset saved: ${assetPath}`);
    }
  });
};

function deleteDirectoryContents(directoryPath) {
  if (fs.existsSync(directoryPath)) {
    fs.readdirSync(directoryPath).forEach((file) => {
      const currentPath = path.join(directoryPath, file);
      if (fs.lstatSync(currentPath).isDirectory()) {
        deleteDirectoryContents(currentPath);
        fs.rmdirSync(currentPath);
      } else {
        fs.unlinkSync(currentPath);
      }
    });
  }
}

async function readFilesRecursively(directory) {
  const filesMap = {};
  const files = await fs.readdir(directory);

  for (const file of files) {
    const filePath = path.join(directory, file);
    const stat = await fs.stat(filePath);

    if (stat.isDirectory()) {
      // Recursive call for subfolders
      const subFilesMap = await readFilesRecursively(filePath);
      Object.assign(filesMap, subFilesMap);
    } else {
      // Read file content and add to the map
      const fileContent = await fs.readFile(filePath);
      filesMap[filePath] = {
        file,
        content: fileContent.toString('base64'),
      };
    }
  }
  return filesMap;
}

// Set up multer to handle file uploads
const storage = multer.memoryStorage();
const upload = multer({ storage });

// Configure cors
const corsOptions = {
  origin: 'http://localhost:8601',
};
app.use(cors(corsOptions));

// Route to handle file uploads
app.post('/api/save', [upload.fields([{ name: "scratch", maxCount: 1 }, { name: "leopard", maxCount: 100 }])], (req, res) => {
  // Delete old saved files
  if (!fs.existsSync(OUT_FOLDER)) {
    fs.mkdirSync(OUT_FOLDER, { recursive: true });
  } else {
    deleteDirectoryContents(OUT_FOLDER)
  }

  // Save the new received files
  saveAsset(req.files.scratch[0].buffer, path.join(OUT_FOLDER, "scratch"), req.files.scratch[0].originalname);
  for (var i = 0; i < req.files.leopard.length; i++) {
    const file = req.files.leopard[i];
    saveAsset(file.buffer, path.join(OUT_FOLDER, "leopard", req.body["leopard"][i]), file.originalname);
  }
});

// Route to handle file downloads
app.get('/api/load', async (req, res) => {
  try {
    if (!fs.existsSync(OUT_FOLDER)) {
        fs.mkdirSync(OUT_FOLDER, { recursive: true });
    } 
    const baseDir = path.join(".", OUT_FOLDER);
    const filesMap = await readFilesRecursively(baseDir);
    res.json({ filesMap });
  } catch (error) {
    console.error('Error reading files:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Start the server
app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});