const express = require("express");
const multer = require("multer");
const path = require("path");
const axios = require("axios"); // اضافه کردن axios برای ارسال درخواست HTTP
const cloudinary = require("cloudinary").v2;

const userRoutes = express.Router();
const apiUrl = "https://6733cdbea042ab85d1180a9a.mockapi.io/posts";
const commentsUrl = "https://6733cc0aa042ab85d118060e.mockapi.io/comments";
const likesUrl = "https://6733cd45a042ab85d1180908.mockapi.io/likes";

// پیکربندی Cloudinary با اطلاعات حساب کاربری
cloudinary.config({
  cloud_name: "draiyqire",
  api_key: "825621586982582",
  api_secret: "6aEOvM7rQJ6SkOpI5dejQjUmnKc",
});

const storage = multer.memoryStorage(); // ذ
const upload = multer({ storage: storage });

const uploadToCloudinary = (file, folder, resourceType) => {
  return new Promise((resolve, reject) => {
    cloudinary.uploader
      .upload_stream(
        { folder, resource_type: resourceType },
        (error, result) => {
          if (error) return reject(error);
          resolve(result);
        }
      )
      .end(file.buffer);
  });
};

userRoutes.post(
  "/post",
  upload.fields([
    { name: "image", maxCount: 1 },
    { name: "cover", maxCount: 1 },
  ]),
  async (req, res) => {
    try {
      const { user_id, name, caption } = req.body;
      const createdAt = new Date(); // تاریخ ایجاد

      // بررسی اینکه آیا فایلی آپلود شده است
      if (!req.files || !req.files.image) {
        return res
          .status(400)
          .json({ success: false, message: "لطفاً یک فایل ارسال کنید" });
      }

      const image = req.files.image[0]; // تصویر اصلی
      const cover = req.files.cover ? req.files.cover[0] : null; // کاور (اختیاری)

      const fileType = image.mimetype.split("/")[0]; // نوع فایل اصلی

      // آپلود فایل‌ها به Cloudinary
      const media = await uploadToCloudinary(image, "posts_media", fileType);

      let coverUrl = null;
      if (cover) {
        const coverType = cover.mimetype.split("/")[0]; // نوع فایل کاور
        const coverMedia = await uploadToCloudinary(
          cover,
          "posts_media/cover",
          coverType
        );
        coverUrl = coverMedia.secure_url;
      }

      const postData = {
        user_id,
        name,
        caption,
        media_url: media.secure_url,
        cover_url: coverUrl,
        created_at: createdAt,
      };

      // ارسال داده‌ها به MockAPI
      try {
        const apiResponse = await axios.post(apiUrl, postData);

        if (apiResponse.status === 201) {
          return res.status(201).json({
            success: true,
            message: "پست جدید با موفقیت ایجاد شد",
          });
        } else {
          return res.status(500).json({
            success: false,
            message: "ارسال به MockAPI با خطا مواجه شد",
          });
        }
      } catch (error) {
        console.error("Error posting to MockAPI:", error);
        return res.status(500).send("Server error");
      }
    } catch (error) {
      console.error("Error:", error);
      return res.status(500).send("Server error");
    }
  }
);

userRoutes.get("/posts/:userId", (req, res) => {
  const userId = req.params.userId; // دریافت userId از پارامتر URL
  const apiUrl = "https://6733cdbea042ab85d1180a9a.mockapi.io/posts";

  axios
    .get(`${apiUrl}?user_id=${userId}`) // ارسال درخواست به MockAPI
    .then((response) => {
      // بررسی اینکه آیا داده‌ای برگشته است
      const posts = response.data.filter(
        (post) => post.user_id === String(userId)
      );

      // بازگرداندن آرایه خالی اگر پستی پیدا نشد
      res.status(200).json(posts); // حتی اگر خالی باشد
    })
    .catch((error) => {
      console.error("Error fetching user posts:", error.message);

      // مدیریت خطاهای API
      res.status(500).send({
        error: "Unable to fetch posts. Please try again later.",
      });
    });
});

userRoutes.post("/multiple", (req, res) => {
  const { user_ids } = req.body;

  // بررسی اینکه user_ids معتبر است
  if (!user_ids || !Array.isArray(user_ids) || user_ids.length === 0) {
    return res
      .status(400)
      .json({ error: "لطفاً یک آرایه از user_ids معتبر ارسال کنید" });
  }

  // دریافت تمام پست‌ها و فیلتر کردن بر اساس user_id های مورد نظر
  axios
    .get(apiUrl)
    .then((response) => {
      const allPosts = response.data;

      // فیلتر کردن پست‌ها بر اساس user_ids
      const filteredPosts = allPosts.filter((post) =>
        user_ids.includes(post.user_id)
      );

      res.status(200).json(filteredPosts);
    })
    .catch((error) => {
      console.error("Error fetching posts:", error);
      res.status(500).send("Server error");
    });
});
userRoutes.post("/multiple-comments", (req, res) => {
  const { user_ids } = req.body; // دریافت آرایه آیدی‌های پست

  // بررسی اینکه user_ids معتبر است
  if (!user_ids || !Array.isArray(user_ids) || user_ids.length === 0) {
    return res
      .status(400)
      .json({ error: "لطفاً یک آرایه از user_ids معتبر ارسال کنید" });
  }

  // درخواست برای دریافت همه کامنت‌ها از MockAPI
  axios
    .get(commentsUrl)
    .then((response) => {
      const allComments = response.data;

      // فیلتر کردن کامنت‌ها بر اساس post_id های مورد نظر
      const filteredComments = allComments.filter((comment) =>
        user_ids.includes(comment.post_id)
      );

      res.status(200).json(filteredComments); // ارسال کامنت‌های فیلتر شده به کلاینت
    })
    .catch((error) => {
      console.error("Error fetching comments:", error);
      res.status(500).send("Server error");
    });
});

userRoutes.get("/getallpost", (req, res) => {
  axios
    .get(apiUrl)
    .then((response) => {
      res.status(200).json(response.data); // ارسال نتیجه به کلاینت
    })
    .catch((error) => {
      console.error("Error fetching posts:", error);
      res.status(500).send("Server error");
    });
});

userRoutes.post("/comment", async (req, res) => {
  try {
    const { user_id, post_id, comment_text } = req.body; // دریافت اطلاعات کامنت
    const createdAt = new Date().toISOString(); // زمان ایجاد کامنت به صورت ISO

    // ارسال درخواست POST به MockAPI برای اضافه کردن کامنت
    const response = await axios.post(commentsUrl, {
      user_id,
      post_id,
      comment_text,
      created_at: createdAt,
    });

    // ارسال پاسخ موفقیت به کلاینت
    res.status(201).json({
      success: true,
      message: "کامنت با موفقیت اضافه شد",
      data: response.data, // نمایش اطلاعات کامنت اضافه‌شده
    });
  } catch (error) {
    console.error("Error adding comment:", error);
    res.status(500).json({ error: "Server error", details: error.message });
  }
});

userRoutes.post("/likesuser", (req, res) => {
  const userId = req.body.id; // دریافت user_id از بدنه درخواست

  // ارسال درخواست به MockAPI برای دریافت تمام رکوردهای likes بر اساس user_id
  axios
    .get(`${likesUrl}?user_id=${userId}`)
    .then((response) => {
      const results = response.data; // داده‌های دریافت شده از MockAPI

      if (results.length === 0) {
        return res
          .status(404)
          .json({ message: "No likes found for this user" });
      }

      // ارسال نتایج به فرانت‌اند
      res.status(200).json(results);
    })
    .catch((error) => {
      console.error("Error fetching user posts from MockAPI:", error);
      res.status(500).send("Server error");
    });
});

userRoutes.get("/post/:postId/details", async (req, res) => {
  const postId = req.params.postId;

  try {
    // ارسال درخواست به MockAPI برای گرفتن تعداد لایک‌ها
    const likesResponse = await axios.get(`${likesUrl}?post_id=${postId}`);
    const likeCount = likesResponse.data.length;

    // ارسال درخواست به MockAPI برای گرفتن تعداد کامنت‌ها
    const commentsResponse = await axios.get(
      `${commentsUrl}?post_id=${postId}`
    );
    const commentCount = commentsResponse.data.length;

    // ارسال تعداد لایک‌ها و کامنت‌ها به کلاینت
    res
      .status(200)
      .json({ like_count: likeCount, comment_count: commentCount });
  } catch (error) {
    console.error("Error fetching post details:", error);
    res.status(500).json({ error: "Server error" });
  }
});

// برای مثال در مسیر like:
userRoutes.post("/like", async (req, res) => {
  try {
    const { user_id, post_id } = req.body;

    // ارسال درخواست برای دریافت همه لایک‌ها
    const getAllLikesUrl = "https://6733cd45a042ab85d1180908.mockapi.io/likes";
    const response = await axios.get(getAllLikesUrl);

    // بررسی اینکه آیا کاربر قبلاً این پست را لایک کرده است
    const alreadyLiked = response.data.some(
      (like) => like.user_id === user_id && like.post_id === post_id
    );

    if (alreadyLiked) {
      return res
        .status(400)
        .json({ error: "User has already liked this post" });
    }

    // اگر لایک قبلی وجود ندارد، لایک جدید اضافه شود
    const likeData = { user_id, post_id };
    await axios.post(getAllLikesUrl, likeData);

    res.status(201).json({ success: true, message: "پست با موفقیت لایک شد" });
  } catch (error) {
    console.error("Error:", error);
    res.status(500).json({ error: "Server error", details: error.message });
  }
});

// axios.get(likesUrl)

//     .then(response => {
//         console.log('Likes data:', response.data);
//     })
//     .catch(error => {
//         console.error('Error fetching likes:', error);
//     });
// مسیر POST برای دریافت تعداد لایک‌ها و کامنت‌ها برای پست‌های مشخص

userRoutes.post("/likes-comments", async (req, res) => {
  const { post_ids } = req.body;

  if (!post_ids || !Array.isArray(post_ids) || post_ids.length === 0) {
    return res
      .status(400)
      .json({ error: "لطفاً یک آرایه از post_ids معتبر ارسال کنید" });
  }

  try {
    console.log("apiUrl:", apiUrl);
    console.log("likesUrl:", likesUrl);
    console.log("commentsUrl:", commentsUrl);
    console.log(post_ids);

    // دریافت پست‌ها از MockAPI
    const postsResponse = await axios.get(apiUrl);
    const posts = postsResponse.data;

    // فیلتر کردن پست‌های موجود در post_ids
    const filteredPosts = posts.filter((post) =>
      post_ids.includes(post.post_id)
    );

    // شمارش لایک‌ها و کامنت‌ها برای هر پست
    const likesCommentsData = [];

    for (const post of filteredPosts) {
      const postId = post.post_id;

      // دریافت لایک‌ها برای پست
      let likeCount = 0;
      try {
        const likesResponse = await axios.get(`${likesUrl}?post_id=${postId}`);
        likeCount = Array.isArray(likesResponse.data)
          ? likesResponse.data.length
          : 0;
      } catch (error) {
        console.warn(`Error fetching likes for post ${postId}:`, error.message);
        likeCount = 0; // در صورت خطا، مقدار پیش‌فرض
      }

      // دریافت کامنت‌ها برای پست
      let commentCount = 0;
      try {
        const commentsResponse = await axios.get(
          `${commentsUrl}?post_id=${postId}`
        );
        commentCount = Array.isArray(commentsResponse.data)
          ? commentsResponse.data.length
          : 0;
      } catch (error) {
        console.warn(
          `Error fetching comments for post ${postId}:`,
          error.message
        );
        commentCount = 0; // در صورت خطا، مقدار پیش‌فرض
      }

      // افزودن اطلاعات پست به داده‌ها
      likesCommentsData.push({
        post_id: postId,
        like_count: likeCount,
        comment_count: commentCount,
      });
    }

    res.status(200).json(likesCommentsData);
  } catch (error) {
    console.error("Error fetching likes and comments:", error);
    res.status(500).json({ error: "Server error", details: error.message });
  }
});

userRoutes.delete("/unlike", async (req, res) => {
  try {
    const { user_id, post_id } = req.query;
    console.log("user_id =>", user_id);
    console.log("post_id =>", post_id);

    // ارسال درخواست به MockAPI برای بررسی لایک
    const checkLikeResponse = await axios.get(
      `${likesUrl}?user_id=${user_id}&post_id=${post_id}`
    );

    console.log("Response from MockAPI:", checkLikeResponse.data); // لاگ پاسخ MockAPI برای بررسی

    if (checkLikeResponse.data.length === 0) {
      console.log("Like not found for user_id:", user_id, "post_id:", post_id);
      return res.status(404).json({ error: "لایک یافت نشد" });
    }

    // استخراج like_id به جای id
    const likeId = checkLikeResponse.data[0].like_id; // استفاده از like_id
    console.log("Deleting like with likeId:", likeId); // لاگ کردن likeId برای بررسی

    // ارسال درخواست DELETE به MockAPI برای حذف لایک
    await axios.delete(`${likesUrl}/${likeId}`);

    res.status(200).json({ success: true, message: "لایک با موفقیت حذف شد" });
  } catch (error) {
    console.error("Error deleting like:", error.message);
    res.status(500).json({ error: "خطا در حذف لایک", details: error.message });
  }
});

module.exports = userRoutes;
