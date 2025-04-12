import express from "express";
import { createServer } from "http";
import path from "path";
import { Server } from "socket.io";
import health from "../routes/health";
import home from "../routes/home";

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
app.use("/api/health", health);



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
