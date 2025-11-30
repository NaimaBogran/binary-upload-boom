const Filters = require("../models/Filters");
const User = require("../models/User");

exports.findMatch = (req, res) => {

  // get current user's filters
  Filters.findOne({ userId: req.user.id })
    .lean()
    .then((currentUserFilters) => {
      if (!currentUserFilters) {
        return res.send("Please set your filters first.");
      }

      //extracts the user's camera preference ( on or off)
      const myCameraPref = currentUserFilters.camera;
      const myWorkTypes = currentUserFilters.workType || []; //array
      const TEN_MINUTES = 10 * 60 * 1000;
      const cutoff = new Date(Date.now() - TEN_MINUTES);

      // find all valid matching users
      return Filters.find({
        userId: { $ne: req.user.id },    // not the same user
        camera: myCameraPref,            // share same camera preference
        // workType: { $in: myWorkTypes }   // at least one shared filter, I want to include this one but not enough users at the moment, so i won't narrow it down as much 
        updatedAt: { $gte: cutoff },
      })
        .lean()
        .then((candidates) => {
          if (!candidates.length) {
            return res.send("No matches found with your camera preference.");
          }

          // chooses a random candidate
          const randomCandidate =
            candidates[Math.floor(Math.random() * candidates.length)];

          // fetch matched user's profile
          return User.findById(randomCandidate.userId)
            .lean()
            .then((matchUser) => {
                //generates a roomId based on both users
                const roomId = `${req.user._id}-${matchUser._id}`;

              // render the match page
              if (myCameraPref === "on") {
                return res.render("videoChat", {
                    partner: matchUser,
                    myCameraPref,
                    roomId,
                 });
                } else {
                return res.render("textChat", {
                    partner: matchUser,
                    myCameraPref,
                    roomId,
             });
              }
            });
        });
    })
    .catch((err) => {
      console.error("Match error:", err);
      res.status(500).send("Error finding a match.");
    });
};
