const express = require('express');
const mobindb = require('../DB/reactshop');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const axios = require('axios');
const cloudinary = require('cloudinary').v2;

// پیکربندی Cloudinary با اطلاعات حساب کاربری
cloudinary.config({
    cloud_name: 'draiyqire',
    api_key: '825621586982582',
    api_secret: '6aEOvM7rQJ6SkOpI5dejQjUmnKc'
  });
  

const apiUrl = 'https://6733cee0a042ab85d1180eb5.mockapi.io/users';
const followuser = 'https://6733cc0aa042ab85d118060e.mockapi.io/follows'
const groupsApiUrl = 'https://6733cd45a042ab85d1180908.mockapi.io/groups'

const storage = multer.memoryStorage(); // ذخیره‌سازی موقت در حافظه
const upload = multer({ storage: storage });



const userRoutes = express.Router();

// میانه‌رو برای تایید توکن
const authenticateToken = (req, res, next) => {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    if (!token) {
        return res.status(401).send('Access denied. No token provided.');
    }

    jwt.verify(token, process.env.JWT_SECRET || 'your_secret_key', (err, decoded) => {
        if (err) {
            return res.status(403).send('Invalid token.');
        }
        req.user = decoded;
        next();
    });
};

userRoutes.post('/register', async (req, res) => {
    try {
        const { username, email, password } = req.body;

        const hashedPassword = await bcrypt.hash(password, 10);

        const token = jwt.sign({ email: email }, process.env.JWT_SECRET || 'your_secret_key', { expiresIn: '24h' });

        const response = await axios.post(apiUrl, {
            username,
            email,
            password: hashedPassword, 
            token
        });

        res.status(201).json({ success: true, token: response.data.token });
    } catch (error) {
        console.error('Error:', error);
        res.status(500).send('Server error');
    }
});

userRoutes.post('/login', async (req, res) => {
    const { email, password } = req.body;

    try {
        const response = await axios.get(`${apiUrl}?email=${email}`);
        const users = response.data;

        if (users.length === 0) {
            res.status(401).send('رمز یا ایمیل اشتباه است');
        } else {
            const user = users[0];
            const isMatch = await bcrypt.compare(password, user.password);

            if (!isMatch) {
                res.status(401).send('رمز یا ایمیل اشتباه است');
            } else {
                const token = jwt.sign({ email: user.email }, process.env.JWT_SECRET || 'your_secret_key', { expiresIn: '24h' });

                await axios.put(`${apiUrl}/${user.id}`, { ...user, token });

                res.json({ success: true, token });
            }
        }
    } catch (error) {
        console.error('Error:', error);
        res.status(500).send('Server error');
    }
});

userRoutes.get('/userinfo', authenticateToken, async (req, res) => {
    const userEmail = req.user.email; // ایمیل از توکن استخراج می‌شود

    try {
        // ارسال درخواست به API خارجی برای دریافت اطلاعات کاربر بر اساس ایمیل
        const response = await axios.get(`${apiUrl}?email=${userEmail}`);
        const users = response.data;

        if (users.length === 0) {
            return res.status(404).json({ error: 'User not found' });  // اگر کاربر پیدا نشد
        }

        // اطلاعات کاربر را از پاسخ API برمی‌گردانیم
        return res.json(users[0]);
    } catch (error) {
        console.error('Error fetching user info from external API:', error);
        return res.status(500).json({ error: 'Server error' });  // در صورت بروز خطا
    }
});
// مسیر برای گرفتن فقط نام کاربری و بیوگرافی کاربر
userRoutes.get('/user/:username', async (req, res) => {
    const { username } = req.params;  // دریافت نام کاربری از پارامتر URL

    try {
        // درخواست به MockAPI برای دریافت اطلاعات کاربر بر اساس نام کاربری
        const response = await axios.get(`${apiUrl}?username=${username}`);

        // اگر کاربری پیدا نشد
        if (response.data.length === 0) {
            return res.status(404).send('User not found');
        }

        // برگرداندن اطلاعات کاربر (فقط نام کاربری و آیدی)
        return res.json({
            username: response.data[0].username,
            id: response.data[0].id
        });
    } catch (error) {
        console.error('Error fetching user data from MockAPI:', error);
        return res.status(500).send('Server error');
    }
});

userRoutes.get('/getalluserid', async (req, res) => {
    try {
        // ارسال درخواست به MockAPI برای دریافت اطلاعات کاربران
        const response = await axios.get(`${apiUrl}`); // فرض می‌کنیم apiUrl همان URL MockAPI است

        const users = response.data;

        if (users.length > 0) {
            // اگر کاربران پیدا شدند، نتیجه را ارسال می‌کنیم
            res.json({ results: users });
        } else {
            // اگر هیچ کاربر یافت نشد
            res.status(404).json({ error: 'User not found' });
        }
    } catch (error) {
        // در صورت بروز خطا
        console.error('Error fetching data from MockAPI:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// مسیر ویرایش پروفایل بدون تایید توکن
userRoutes.put('/edit-profile', upload.single('image'), async (req, res) => {
    const { username, bio } = req.body;
    const newImage = req.file ? req.file.buffer : null;  // دریافت فایل به صورت buffer
    const id = req.body.id; // شناسه کاربر باید از بدنه درخواست دریافت شود

    // بررسی کنید که شناسه کاربر وجود دارد
    if (!id) {
        return res.status(400).json({ message: 'User ID is required' });
    }

    try {
        // ارسال درخواست به MockAPI برای دریافت اطلاعات کاربر با استفاده از شناسه
        const response = await axios.get(`${apiUrl}/${id}`);
        const user = response.data;

        if (!user) {
            return res.status(404).send('User not found');
        }

        // آپلود تصویر به Cloudinary
        let finalImage = user.image || null; // تصویر قبلی یا جدید

        if (newImage) {
            // آپلود تصویر جدید به Cloudinary
            cloudinary.uploader.upload_stream(
                { folder: 'profile_pictures' }, // نام فولدر در Cloudinary
                async (error, image) => {
                    if (error) {
                        console.error('Error uploading to Cloudinary:', error);
                        return res.status(500).send('Error uploading image');
                    }

                    finalImage = image.secure_url; // URL تصویر آپلود شده

                    // ارسال درخواست PUT به MockAPI برای به‌روزرسانی اطلاعات کاربر
                    await axios.put(`${apiUrl}/${id}`, {
                        username: username || user.username,
                        bio: bio || user.bio,
                        image: finalImage, // ذخیره URL تصویر جدید
                    });

                    // ارسال پاسخ موفقیت‌آمیز
                    res.json({ success: true, message: 'Profile updated successfully', image: finalImage });
                }
            ).end(newImage);  // ارسال تصویر به صورت buffer به Cloudinary
        } else {
            // ارسال درخواست PUT به MockAPI بدون تغییر تصویر
            await axios.put(`${apiUrl}/${id}`, {
                username: username || user.username,
                bio: bio || user.bio,
                image: finalImage, // ذخیره تصویر قبلی
            });

            res.json({ success: true, message: 'Profile updated successfully', image: finalImage });
        }
    } catch (error) {
        console.error('Error updating user profile:', error);
        if (error.response && error.response.status === 404) {
            return res.status(404).send('User not found');
        }
        return res.status(500).send('Server error');
    }
});

userRoutes.post('/multiple', async (req, res) => {
    const { user_ids } = req.body; // دریافت آرایه آیدی‌ها

    if (!user_ids || !Array.isArray(user_ids) || user_ids.length === 0) {
        return res.status(400).json({ error: 'لطفاً یک آرایه از user_ids معتبر ارسال کنید' });
    }

    try {
        // ارسال درخواست به MockAPI برای دریافت اطلاعات کاربران بر اساس آیدی‌ها
        const promises = user_ids.map(id => axios.get(`${apiUrl}/${id}`)); // برای هر شناسه درخواست ارسال می‌شود

        // منتظر می‌مانیم تا همه درخواست‌ها تکمیل شوند
        const responses = await Promise.all(promises);

        // استخراج نتایج از پاسخ‌ها
        const userResults = responses.map(response => ({
            id: response.data.id,
            username: response.data.username,
            image: response.data.image
        }));

        res.status(200).json(userResults); // بازگشت نتایج

    } catch (error) {
        console.error('Error fetching user data:', error);
        return res.status(500).json({ error: 'Server error' }); // در صورت بروز خطا
    }
});


userRoutes.post('/getnamesusers', async (req, res) => {
    const id = req.body.id;  // دریافت id از بدنه درخواست
    console.log('id user =>' , id)

    try {
        // ارسال درخواست به API خارجی برای دریافت اطلاعات کاربر بر اساس id
        const response = await axios.get(`${apiUrl}/${id}`);
        const user = response.data;

        if (!user) {
            return res.status(404).json({ error: 'User not found' });  // اگر کاربر پیدا نشد
        }

        // برگرداندن نام کاربری
        return res.json({ username: user.username });
    } catch (error) {
        console.error('Error fetching user data from external API:', error);
        return res.status(500).json({ error: 'Server error' });  // در صورت بروز خطا
    }
});


userRoutes.get('/search', async (req, res) => {
    const name = req.query.name; // دریافت نام جستجو از query string

    if (!name) {
        return res.status(400).json({ error: 'نام را وارد کنید' }); // اگر نام وارد نشد خطا نمایش می‌دهیم
    }

    try {
        // ارسال درخواست به MockAPI برای جستجو
        const apiResponse = await axios.get(apiUrl, {
            params: {
                username: name // ارسال پارامتر name به MockAPI برای جستجو
            }
        });

        // بررسی پاسخ موفق از MockAPI
        if (apiResponse.status === 200) {
            console.log('نتایج جستجو با موفقیت دریافت شد');
            res.json(apiResponse.data); // ارسال نتایج به کاربر
        } else {
            res.status(500).json({ error: 'خطا در دریافت داده‌ها از MockAPI' });
        }
    } catch (error) {
        console.error('Error during search:', error);
        res.status(500).json({ error: 'خطا در انجام درخواست به MockAPI' });
    }
});

userRoutes.get('/followersCount', (req, res) => {
    const id = req.query.id;

    // درخواست به MockAPI برای شمارش فالوورها
    axios.get(`${followuser}?following_id=${id}`)
        .then(response => {
            const followersCount = response.data.length; // تعداد رکوردهایی که با id مربوطه تطابق دارند
            res.json({ followersCount }); // ارسال تعداد فالوورها به کلاینت
        })
        .catch(error => {
            console.error('Error fetching from MockAPI:', error);
            res.status(500).json({ error: 'Error fetching from MockAPI' });
        });
});

userRoutes.get('/imfollowing', (req, res) => {
    const id = req.query.id; 

    // درخواست به MockAPI برای دریافت فهرست دنبال کنندگان
    axios.get(`${followuser}?follower_id=${id}`)
    .then(response => {
        const imfollowing = response.data.length; // تعداد رکوردهایی که با id مربوطه تطابق دارند
        res.json({ imfollowing }); // ارسال تعداد فالوورها به کلاینت
    })
    .catch(error => {
        console.error('Error fetching from MockAPI:', error);
        res.status(500).json({ error: 'Error fetching from MockAPI' });
    });
});

userRoutes.get('/limeitedinfousers', (req, res) => {
    // ارسال درخواست GET به MockAPI برای دریافت کاربران
    axios.get(apiUrl)
        .then(response => {
            // استخراج id و image از نتایج
            const limitedInfo = response.data.map(user => ({
                id: user.id,
                image: user.image
            }));

            console.log('Limited user info retrieved');
            res.status(200).json(limitedInfo); // بازگشت نتیجه به کلاینت
        })
        .catch(error => {
            console.error('Error fetching user info from MockAPI:', error);
            res.status(500).send('Server error');
        });
});

userRoutes.get('/following/:id', (req, res) => {
    const id = req.params.id; // استفاده از پارامتر مسیر

    // ارسال درخواست به MockAPI برای دریافت فهرست افرادی که این کاربر دنبال می‌کند
    axios.get(`${followuser}?follower_id=${id}`)
        .then(response => {
            const followingList = response.data.map(follow => follow.following_id); // استخراج following_id ها
            console.log('Following list retrieved:', followingList);
            res.json(followingList); // ارسال فهرست following_id ها به کلاینت
        })
        .catch(error => {
            console.error('Error fetching from MockAPI:', error);
            res.status(500).json({ error: 'Error fetching from MockAPI' });
        });
});



userRoutes.get('/follow-check', authenticateToken, (req, res) => {
    const followerId = req.user.id; // ID کاربر جاری که وارد شده است
    const targetUserId = req.query.targetUserId; // ID کاربر هدف برای بررسی فالو کردن

    // ارسال درخواست به MockAPI برای بررسی فالو کردن
    axios.get(`${followuser}?follower_id=${followerId}&following_id=${targetUserId}`)
        .then(response => {
            const isFollowing = response.data.length > 0; // اگر رکوردی موجود باشد، یعنی فالو می‌کند
            res.json({ isFollowing }); // ارسال نتیجه به کلاینت
        })
        .catch(error => {
            console.error('Error checking follow status from MockAPI:', error);
            res.status(500).send('Server error');
        });
});


userRoutes.post('/follow', (req, res) => {
    const { targetUserId, currentUserId } = req.body; // شناسه کاربری که قرار است دنبال شود و شناسه کاربر فعلی

    // چک کردن ورودی‌ها
    if (!targetUserId || !currentUserId) {
        return res.status(400).json({ success: false, message: 'targetUserId and currentUserId are required' });
    }

    console.log('Checking follow status for:', { currentUserId, targetUserId });

    // ارسال درخواست بدون فیلتر در URL
    axios.get(followuser)
        .then(response => {
            console.log('Follow status response:', response.data);  // بررسی داده‌های دریافتی

            // فیلتر کردن داده‌ها برای مطابقت با follower_id و following_id
            const existingFollow = response.data.find(follow => 
                follow.follower_id === String(currentUserId) && follow.following_id === String(targetUserId)
            );

            // اگر داده‌ای یافت شد، یعنی کاربر قبلاً فالو کرده
            if (existingFollow) {
                // آنفالو کردن
                axios.delete(`${followuser}/${existingFollow.id}`)
                    .then(() => {
                        console.log('Unfollowed successfully');
                        res.json({ success: true, message: 'Unfollowed successfully' });
                    })
                    .catch(err => {
                        console.error('Error in deleting follow:', err);
                        res.status(500).send('Error in deleting follow');
                    });
            } else {
                // اگر فالو نشده بود، فالو کردن
                const newFollow = {
                    follower_id: String(currentUserId), // اطمینان از ارسال به عنوان رشته
                    following_id: String(targetUserId)  // اطمینان از ارسال به عنوان رشته
                };

                axios.post(followuser, newFollow)
                    .then(() => {
                        console.log('Followed successfully');
                        res.json({ success: true, message: 'Followed successfully' });
                    })
                    .catch(err => {
                        console.error('Error in adding follow:', err);
                        res.status(500).send('Error in adding follow');
                    });
            }
        })
        .catch(err => {
            console.error('Error in checking follow status:', err);
            res.status(500).send('Error in checking follow status');
        });
});


userRoutes.post('/unfollow', authenticateToken, (req, res) => {
    const { targetUserId } = req.body; // شناسه کاربری که قرار است آنفالو شود
    const followerId = req.user.id; // شناسه کاربر فعلی که در توکن ذخیره شده است

    // ارسال درخواست به MockAPI برای چک کردن اینکه کاربر فالو کرده است یا نه
    axios.get(`${followuser}?follower_id=${followerId}&following_id=${targetUserId}`)
        .then(response => {
            if (response.data.length === 0) {
                // اگر کاربر قبلاً این فرد را دنبال نکرده بود، پیام خطا برمی‌گردانیم
                return res.status(400).send('You are not following this user');
            } else {
                // اگر کاربر فرد مورد نظر را دنبال کرده بود، آنفالو کنیم
                const followIdToDelete = response.data[0].id; // ID رکورد فالو که باید حذف شود
                axios.delete(`${followuser}/${followIdToDelete}`)
                    .then(() => {
                        res.json({ success: true, message: 'Unfollowed successfully' });
                    })
                    .catch(err => {
                        console.log('Error in deleting follow:', err);
                        res.status(500).send('Server error');
                    });
            }
        })
        .catch(err => {
            console.log('Error in checking follow status:', err);
            res.status(500).send('Server error');
        });
});



userRoutes.get('/search-users', (req, res) => {
    const name = req.query.name;

    // ارسال درخواست به MockAPI برای جستجو در کاربران
    axios.get(`${apiUrl}?search=${name}`)
        .then(userResponse => {
            const users = userResponse.data; // داده‌های کاربران

            // بازگشت نتایج به کلاینت
            res.json({ users });
        })
        .catch(error => {
            console.error('Error in user query:', error.response ? error.response.data : error.message);
            res.status(500).json({ error: 'Error querying MockAPI' });
        });
});

userRoutes.get('/search-groups', (req, res) => {
    const name = req.query.name;

    // ارسال درخواست به MockAPI برای جستجو در کاربران
    axios.get(`${groupsApiUrl}?search=${name}`)
        .then(userResponse => {
            const users = userResponse.data; // داده‌های کاربران

            // بازگشت نتایج به کلاینت
            res.json({ users });
        })
        .catch(error => {
            console.error('Error in user query:', error.response ? error.response.data : error.message);
            res.status(500).json({ error: 'Error querying MockAPI' });
        });
});


module.exports = userRoutes;
