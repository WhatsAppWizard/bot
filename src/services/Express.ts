import { Server } from "socket.io";
import { createServer } from "http";
import express from "express";
import home from "../routes/home";
import path from "path";

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer);

// Make io accessible to other modules
app.set("io", io);

app.set("view engine", "ejs");
app.set("views", path.join(process.cwd(), "src", "views"));
app.use(express.urlencoded({ extended: true }));
app.use(express.static("public"));
app.use("/", home);

// Socket.IO connection handling
io.on("connection", (socket) => {
  console.log("A user connected");
  
  socket.on("disconnect", () => {
    console.log("User disconnected");
  });
});

httpServer.listen(3000, () => {
    console.log("Server is running on port 3000");
});

export default app;
