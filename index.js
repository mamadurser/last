const express = require("express");
const http = require("http");
const axios = require("axios");
const cors = require("cors");
const userRoutes = require("./routes/userRoutes"); // روت‌های کاربران
const posts = require("./routes/posts"); // روت‌های پست‌ها
const { Server } = require("socket.io"); // برای استفاده از socket.io
const app = express();
const server = http.createServer(app); // ساخت سرور HTTP برای Express
// مقداردهی اولیه io پس از ساخت سرور
const io = new Server(server, {
  cors: {
    origin: "https://mobinegee.github.io", // آدرس دقیق فرانت‌اند
    methods: ["GET", "POST"],
    credentials: true,
  },
});

// وارد کردن روت‌های چت و ارسال io به آن
// const chats = require('./routes/chats')(io);  // روت‌های چت که به io نیاز دارند
const group = require("./routes/group")(io); // روت‌های چت که به io نیاز دارند
app.set("io", io); // برای دسترسی جهانی به io در اپ

// تنظیم میدل‌ویرها
app.use(express.json()); // برای تجزیه داده‌های JSON
app.use(express.urlencoded({ extended: true })); // برای تجزیه داده‌های URL-encoded
app.use(cors()); // فعال‌سازی CORS

// دایرکتوری استاتیک برای آپلودها
app.use("/uploads", express.static("uploads")); // فایل‌های آپلود شده در مسیر '/uploads' در دسترس خواهند بود

// استفاده از روت‌ها
app.use("/api/users", userRoutes); // روت‌های مربوط به کاربران
app.use("/api/posts", posts); // روت‌های مربوط به پست‌ها
// app.use('/api/chats', chats);  // روت‌های مربوط به چت‌ها که از io استفاده می‌کنند
app.use("/api/group", group); // روت‌های مربوط به چت‌ها که از io استفاده می‌کنند

// روت تست
app.get("/", (req, res) => {
  res.send("Server is running");
});

const PORT = process.env.PORT || 5200;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
setInterval(() => {
  axios
    .get("https://p56x7f-5200.csb.app") // آدرس پروژه خود را جایگزین کنید
    .then(() => console.log("Ping successful!"))
    .catch((err) => console.error("Ping failed:", err));
}, 5 * 1000); // هر 5 دقیقه
