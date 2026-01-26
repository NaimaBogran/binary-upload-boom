//everything needed to set up server
//mods needed to make it work

const express = require("express");
const { createServer } = require("node:http");
const { Server } = require("socket.io");
const app = express();

const mongoose = require("mongoose");
const passport = require("passport");
const session = require("express-session");
const MongoStore = require("connect-mongo")(session);
const methodOverride = require("method-override");
const flash = require("express-flash");
const logger = require("morgan");
const connectDB = require("./config/database");
const mainRoutes = require("./routes/main");
const postRoutes = require("./routes/posts");

//Use .env file in config folder
require("dotenv").config({ path: "./config/.env" });

// Passport config
require("./config/passport")(passport);

//Connect To Database
connectDB();

//Using EJS for views
app.set("view engine", "ejs");

//Static Folder
app.use(express.static("public"));

app.use((req, res, next) => {
  res.setHeader("Cache-Control", "no-store");
  next();
});


//Body Parsing
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

//Logging
app.use(logger("dev"));

//Use forms for put / delete
app.use(methodOverride("_method"));

// Setup Sessions - stored in MongoDB
app.use(
  session({
    secret: process.env.SESSION_SECRET || "dev-secret-change-me",
    resave: false,
    saveUninitialized: false,
    store: new MongoStore({ mongooseConnection: mongoose.connection }),
    cookie: {
      sameSite: "lax",
      secure: true || process.env.NODE_ENV === "production",
    },
  })
);


// Passport middleware
app.use(passport.initialize());
app.use(passport.session());

app.use((req, res, next) => {
  res.locals.user = req.user;
  next();
});

//Use flash messages for errors, info, ect...
app.use(flash());

//Setup Routes For Which The Server Is Listening
app.use("/", mainRoutes);
app.use("/post", postRoutes);

//creates HTTP server from express app
const server = createServer(app);

//creates socket.io instance
const io = new Server(server);

// =============================
//      MATCH / BREAK STATE
// =============================

// One waiting user
let waitingUser = null;

// Map socket.id → roomId
const socketToRoom = {};

// Stores break choices
// roomState[roomId] = { choices: {}, sockets: [] }
const roomState = {};

// tracks intentional navigation to break
const goingOnBreak = {};

io.on("connection", (socket) => {
  console.log("a user connected:", socket.id);

  // =============================
  //       MATCHING
  // =============================
  socket.on("lookingForMatch", (userInfo) => {
    if (!waitingUser) {
      waitingUser = { socketId: socket.id, userInfo };
      io.to(socket.id).emit("waiting");
      return;
    }

    const partner = waitingUser;
    waitingUser = null;

    const ids = [userInfo.userId, partner.userInfo.userId].sort();
    const roomId = `room-${ids[0]}-${ids[1]}`;

    // Notify both users
    io.to(partner.socketId).emit("matchFound", {
      roomId,
      partner: userInfo,
      isCaller: true,
    });

    io.to(socket.id).emit("matchFound", {
      roomId,
      partner: partner.userInfo,
      isCaller: false,
    });
  });

  // =============================
  //        JOIN ROOM
  // =============================
  socket.on("joinRoom", ({ roomId }) => {
    const room = io.sockets.adapter.rooms.get(roomId);

    if (room && room.size >= 2) {
      socket.emit("roomFull");
      return;
    }

    socket.join(roomId);
    socketToRoom[socket.id] = roomId;

    console.log(`${socket.id} joined room ${roomId}`);
  });

  // =============================
  //      USER GOING TO BREAK
  // =============================
  socket.on("goingOnBreak", ({ roomId }) => {
    console.log(socket.id, "is going on break");
    goingOnBreak[socket.id] = true;
  });

  // =============================
  //        BREAK CHOICES
  // =============================
  socket.on("breakChoice", ({ roomId, choice }) => {
    console.log("breakChoice", socket.id, "room", roomId, "choice", choice);

    if (!roomId) return;

    if (!roomState[roomId]) {
      roomState[roomId] = { choices: {}, sockets: [] };
    }

    const state = roomState[roomId];

    if (!state.choices[socket.id]) {
      state.sockets.push(socket.id);
    }

    state.choices[socket.id] = choice;

    // When both users have chosen
    if (state.sockets.length === 2) {
      const [u1, u2] = state.sockets;
      const c1 = state.choices[u1];
      const c2 = state.choices[u2];

      let action = (c1 === "stay" && c2 === "stay") ? "stay" : "new";

      const s1 = io.sockets.sockets.get(u1);
      const s2 = io.sockets.sockets.get(u2);

      if (s1) s1.leave(roomId);
      if (s2) s2.leave(roomId);

      // Send result directly to each user
      io.to([u1, u2]).emit("prepareForReconnect");

      if (action === "stay") {
    
      const caller = u1;
      const callee = u2;

      io.to(caller).emit("breakResult", { action, isCaller: true });
      io.to(callee).emit("breakResult", { action, isCaller: false });

  } else {
    
      io.to(u1).emit("breakResult", { action });
      io.to(u2).emit("breakResult", { action });
  }


      delete roomState[roomId];
    }
  });

  // =============================
  //      WEBRTC + CHAT
  // =============================
  socket.on("readyToCall", ({ roomId }) => {
    socket.to(roomId).emit("readyToCall");
  });

  socket.on("stopVideo", ({ roomId }) => {
    socket.to(roomId).emit("stopVideo");
  });

  socket.on("offer", ({ roomId, offer }) => {
    socket.to(roomId).emit("offer", { offer });
  });

  socket.on("answer", ({ roomId, answer }) => {
    socket.to(roomId).emit("answer", { answer });
  });

  socket.on("iceCandidate", ({ roomId, candidate }) => {
    socket.to(roomId).emit("iceCandidate", { candidate });
  });

  socket.on("chatMessage", ({ roomId, message, senderName }) => {
    io.to(roomId).emit("chatMessage", { message, senderName });
  });

  // user clicked 'find new double' (not a break)
socket.on("leavingSession", ({ roomId }) => {
  console.log("leavingSession:", socket.id, "room:", roomId);

  // notify the partner that this user left intentionally
  if (roomId) {
    socket.to(roomId).emit("partnerDisconnected");
  }

  // clean their room tracking
  socket.leave(roomId);
  delete socketToRoom[socket.id];
});

  // =============================
  //        DISCONNECT
  // =============================
  socket.on("disconnect", () => {
    console.log("a user disconnected", socket.id);

    // If they intentionally went to break → ignore disconnect
    if (goingOnBreak[socket.id]) {
      console.log("intentional break disconnect:", socket.id);
      delete goingOnBreak[socket.id];
      delete socketToRoom[socket.id];
      return;
    }

    // Unexpected disconnect
    const roomId = socketToRoom[socket.id];
    if (roomId) {
      console.log("unexpected disconnect:", socket.id, "→ notify partner");
      socket.to(roomId).emit("partnerDisconnected");
      delete socketToRoom[socket.id];
    }

    // If they were waiting in queue
    if (waitingUser && waitingUser.socketId === socket.id) {
      waitingUser = null;
    }
  });

});

// =============================
//         START SERVER
// =============================
const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
  console.log("Server is running, you better catch it!");
});
