const multer = require("multer");
const { CloudinaryStorage } = require("multer-storage-cloudinary");
const { v2: cloudinary } = require("cloudinary");
const ApiError = require("../utils/apiError");

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const storage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: "maintainiq",
    allowed_formats: ["jpg", "jpeg", "png", "webp", "gif"],
  },
});

const imageFilter = (req, file, cb) => {
  const allowed = [
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/gif",
  ];

  if (allowed.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new ApiError(400, "Only image files are allowed"), false);
  }
};

const uploadEvidence = multer({
  storage,
  fileFilter: imageFilter,
  limits: {
    fileSize: 5 * 1024 * 1024,
    files: 5,
  },
});

module.exports = {
  uploadEvidence,
};