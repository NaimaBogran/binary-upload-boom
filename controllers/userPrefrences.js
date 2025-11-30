const Filters = require("../models/Filters");

exports.createUserPrefrences = async (req, res) => {
    try {
        console.log("REQ BODY:", req.body);
        console.log("REQ USER:", req.user);

        const { workType, camera } = req.body;

        // Create or update filter record for this user
        const filters = await Filters.findOneAndUpdate(
            { userId: req.user._id },
            {
                workType,
                camera,
                userId: req.user._id
            },
            { upsert: true, new: true, runValidators: true }
        );

        console.log("Saved filters:", filters);
        res.redirect("/match");
    } catch (err) {
        console.error(err);
        res.redirect("/");
    }
};
