const router = require("express").Router();
const userController = require("../controller/userController.js");
const multer = require('multer');
// Multer configuration for handling file uploads
const multerStorage = multer.memoryStorage();
const multerUpload = multer({ storage: multerStorage });

router.get("/", userController.getUser);
router.get("/:id", userController.getUserById);
router.post("/update-profile", multerUpload.single('profileImage'), userController.updateUser);
router.post("/follow", userController.follow);
router.get("/followers-list/:id", userController.getFollowers);
router.get("/followings-list/:id", userController.getFollowing);

module.exports = router;