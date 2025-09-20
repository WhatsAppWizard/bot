import express from "express";
import health from "../routes/health";

const app = express();

// Make io accessible to other modules

app.use(express.urlencoded({ extended: true }));
app.use("/api/health", health);


app.listen(process.env.PORT || 3020, () => {
    console.log("Server is running on port 3000");
});

export default app;
