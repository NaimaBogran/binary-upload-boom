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
    secret: "keyboard cat",
    resave: false,
    saveUninitialized: false,
    store: new MongoStore({ mongooseConnection: mongoose.connection }),
  })
);

// Passport middleware
app.use(passport.initialize());
app.use(passport.session());

app.use((req, res, next) => {
    res.locals.user = req.user; // makes `user` available in ALL EJS files
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


//real time matching queue state
let waitingUser = null; //{ socketId, userInfo }
const socketToRoom = {};

//handle websocket connections | socketio handlers
io.on("connection", (socket) => {
  console.log("a user connected:", socket.id);

//user asks to find a match
socket.on("lookingForMatch", (userInfo) => {
  //userInfo: { userId, userName, cameraType, workType[] }

  if(!waitingUser) {
    //no one waiting => this user waits
    waitingUser = { socketId: socket.id, userInfo };
    io.to(socket.id).emit("waiting");
    return;
  }

  //someone is waiting => match them
  const partner = waitingUser;
  waitingUser = null; //reset queue

  //create roomId sp both users share the same one
  const ids = [userInfo.userId, partner.userInfo.userId].sort();
  const roomId = `room-${ids[0]}-${ids[1]}`;

  //notify both users that a match was found, stops user a from having to refresh once matched with user b
  io.to(partner.socketId).emit("matchFound", {
    roomId,
    partner: userInfo, //partner for user a
});

  io.to(socket.id).emit("matchFound", {
    roomId,
    partner: partner.userInfo, //partner for user b
   });
});

  socket.on("joinRoom", ({ roomId }) => {
    const room = io.sockets.adapter.rooms.get(roomId);

    //allows max 2 peopls per room
    if (room && room.size >= 2 ) {
      socket.emit("roomFull");
      return;
    }

    socket.join(roomId);
    socketToRoom[socket.id] = roomId;

    console.log(`${socket.id} joined room ${roomId}`);
  });

  //when a chat is sent
  socket.on("chatMessage", ({ roomId, message, senderName }) => {
    io.to(roomId).emit("chatMessage", {
      message,
      senderName,
    });
  });

  socket.on("disconnect", () => {
    console.log("a user disconnected", socket.id);

    //if a waiting user disconnects, clear them
    if(waitingUser && waitingUser.socketId === socket.id) {
      waitingUser = null;
    }

    //gets the chat room this socket was in (not its own auto-room/the id)
    const roomId = socketToRoom[socket.id];

    if (roomId) {
      //notify remaining user
      socket.to(roomId).emit("partnerDisconnected");

      //cleanup
      delete socketToRoom[socket.id];
    }
  });
});

//Server Running
const PORT = process.env.PORT;

server.listen(PORT, () => {
  console.log("Server is running, you better catch it!");
});
