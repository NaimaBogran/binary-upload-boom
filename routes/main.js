const express = require("express");
const router = express.Router();
const authController = require("../controllers/auth");
const homeController = require("../controllers/home");
const postsController = require("../controllers/posts");
const { ensureAuth, ensureGuest } = require("../middleware/auth");
<<<<<<< Updated upstream
=======
const userPrefrencesController = require("../controllers/userPrefrences");
const matchController = require("../controllers/matchUsers");
<<<<<<< Updated upstream
>>>>>>> Stashed changes
=======
>>>>>>> Stashed changes

//Main Routes - simplified for now
router.get("/", homeController.getIndex);
router.get("/profile", ensureAuth, postsController.getProfile);
router.get("/feed", ensureAuth, postsController.getFeed);
router.get("/login", authController.getLogin);
router.post("/login", authController.postLogin);
router.get("/logout", authController.logout);
router.get("/signup", authController.getSignup);
router.post("/signup", authController.postSignup);
<<<<<<< Updated upstream
=======
router.post("/filters", userPrefrencesController.createUserPrefrences);
router.get("/filters", ensureAuth, (req, res) => {
    res.render("userPrefrences");
});
router.get("/match", ensureAuth, matchController.findMatch);
router.post("/match", ensureAuth, (req, res) =>{
    return res.redirect("/match"); //in case it does a POST /match, turns into a GET /match
})
<<<<<<< Updated upstream
>>>>>>> Stashed changes
=======
>>>>>>> Stashed changes

module.exports = router;
