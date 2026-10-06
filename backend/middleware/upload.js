const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Vercel's filesystem is read-only except /tmp.
// Locally, keep using backend/uploads.
const isVercel = Boolean(process.env.VERCEL);

const uploadRoot = isVercel
  ? path.join('/tmp', 'shop-management', 'uploads')
  : path.join(__dirname, '..', 'uploads');

const uploadDir = path.join(uploadRoot, 'products');

// Make sure the directory exists.
fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },

  filename: (req, file, cb) => {
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `${unique}${path.extname(file.originalname)}`);
  }
});

function fileFilter(req, file, cb) {
  const allowed = /jpeg|jpg|png|webp/;

  const ok =
    allowed.test(path.extname(file.originalname).toLowerCase()) &&
    allowed.test(file.mimetype);

  if (ok) {
    return cb(null, true);
  }

  cb(new Error('Only image files (jpg, png, webp) are allowed'));
}

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 3 * 1024 * 1024
  }
});

// CSV/XLSX imports stay in memory because they are parsed immediately.
function importFileFilter(req, file, cb) {
  const allowed = /csv|xlsx|xls/;

  const ok = allowed.test(
    path.extname(file.originalname).toLowerCase()
  );

  if (ok) {
    return cb(null, true);
  }

  cb(new Error('Only .csv, .xlsx or .xls files are allowed'));
}

const uploadImportFile = multer({
  storage: multer.memoryStorage(),
  fileFilter: importFileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024
  }
});

module.exports = upload;
module.exports.uploadImportFile = uploadImportFile;
module.exports.uploadRoot = uploadRoot;