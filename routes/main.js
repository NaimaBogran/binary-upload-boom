const express = require("express");
const router = express.Router();

const authController = require("../controllers/auth");
const homeController = require("../controllers/home");
const postsController = require("../controllers/posts");
const { ensureAuth, ensureGuest } = require("../middleware/auth");
const Filters = require("../models/Filters");

const userPrefrencesController = require("../controllers/userPrefrences");
const matchController = require("../controllers/matchUsers");

// Main Routes
router.get("/", homeController.getIndex);

// router.get("/profile", ensureAuth, postsController.getProfile);
// router.get("/feed", ensureAuth, postsController.getFeed);

// Auth Routes
router.get("/login", authController.getLogin);
router.post("/login", authController.postLogin);
router.get("/logout", authController.logout);
router.get("/signup", authController.getSignup);
router.post("/signup", authController.postSignup);

// User Filters
router.get("/filters", ensureAuth, (req, res) => {
  res.render("userPrefrences");
});
router.post("/filters", ensureAuth, userPrefrencesController.createUserPrefrences);

// Matching
router.get("/match", ensureAuth, async (req, res) => {
    const filters = await Filters.findOne({ userId: req.user._id}).lean();
    if (!filters) {
        return res.redirect("/filters");
    }

    res.render("match", { filters });
});

//video chat (25 min focus sessions)
router.get("/videoChat/:roomId", ensureAuth, (req, res) => {
    const { roomId } = req.params;
    const partnerName = req.query.partnerName || "your partner";
    const isCaller = req.query.isCaller === "true";

    res.render("videoChat", {
        roomId,
        partnerName,
        isCaller,
    });
});

//chat room (25 min focus sessions)
router.get("/textChat/:roomId", ensureAuth, (req, res) => {
    const roomId = req.params.roomId;
    const partnerName = req.query.partnerName || "your partner";

    res.render("textChat", {
        roomId,
        partnerName,
    });
});

//solo break room (5 minutes)
router.get("/break", ensureAuth, authController.getBreak);


// Safety redirect if POST /match happens
router.post("/match", ensureAuth, (req, res) => {
  return res.redirect("/match");
});

module.exports = router;
