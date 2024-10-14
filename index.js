const express = require('express');
const path = require('path');
const cookieSession = require('cookie-session');
const bcrypt = require('bcrypt');
const dbConnection = require('./database');
const { body, validationResult } = require('express-validator');

const app = express();
app.use('/pic', express.static('pic'));
app.use(express.static('public'));

app.use(express.urlencoded({ extended: false }));

// SET OUR VIEWS AND VIEW ENGINE
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

// APPLY COOKIE SESSION MIDDLEWARE
app.use(cookieSession({
    name: 'session',
    keys: ['key1', 'key2'],
    maxAge: 3600 * 1000 // 1hr
}));

// DECLARING CUSTOM MIDDLEWARE
const ifNotLoggedin = (req, res, next) => {
    console.log('ifNotLoggedin middleware triggered');
    if (!req.session.isLoggedIn) {
        return res.render('register');
    }
    next();
};

const ifLoggedin = (req, res, next) => {
    console.log('ifLoggedin middleware triggered');
    if (req.session.isLoggedIn) {
        return res.redirect('/main');
    }
    next();
};
// END OF CUSTOM MIDDLEWARE

// ROOT PAGE
app.get('/profile', ifNotLoggedin, (req, res) => {
    const userId = req.session.userID;

    // สอบถามข้อมูลเพิ่มเติมจากตาราง users
    const query = "SELECT `name`, `first_name`, `last_name` FROM `users` WHERE `id` = ?";
    
    dbConnection.execute(query, [userId])
        .then(([rows]) => {
            if (rows.length > 0) {
                res.render('profile', {
                    name: rows[0].name,
                    first_name: rows[0].first_name,
                    last_name: rows[0].last_name
                });
            } else {
                res.render('profile', { name: 'Guest' });
            }
        })
        .catch(err => {
            console.error(err);
            res.status(500).send('เกิดข้อผิดพลาดในการดึงข้อมูล');
        });
});// END OF ROOT PAGE

app.get('/', async (req, res) => {
    try {
        const query = "SELECT * FROM artist_database";
        const [rows] = await dbConnection.execute(query);
        res.render('index', { artists: rows });
    } catch (err) {
        console.error(err);
        res.status(500).send('เกิดข้อผิดพลาดในการดึงข้อมูลศิลปิน');
    }
});

app.get('/bands', (req, res) => {
    const query = "SELECT * FROM bands_database";

    dbConnection.execute(query)
        .then(([rows]) => {
            res.render('bands', { bands: rows });
        })
        .catch(err => {
            console.error(err);
            res.status(500).send('เกิดข้อผิดพลาดในการดึงข้อมูลวงดนตรี');
        });
});

// Route สำหรับแสดงรายละเอียดวงดนตรีพร้อมศิลปิน
app.get('/band/:id', async (req, res) => {
    const bandId = req.params.id;
    try {
        // ดึงข้อมูลวงดนตรีจาก bands_database
        const bandQuery = "SELECT * FROM bands_database WHERE id_bands = ?";
        const [bandRows] = await dbConnection.execute(bandQuery, [bandId]);

        if (bandRows.length === 0) {
            return res.status(404).send('วงดนตรีไม่พบ');
        }

        const band = bandRows[0];

        // ดึงข้อมูลศิลปินจาก artist_database ที่เกี่ยวข้องกับ id_bands
        const artistsQuery = "SELECT * FROM artist_database WHERE id_bands = ?";
        const [artistRows] = await dbConnection.execute(artistsQuery, [bandId]);

        // ตรวจสอบข้อมูลที่ดึงมา
        console.log('Band:', band);
        console.log('Artists:', artistRows);

        // ส่งข้อมูลไปยัง view 'artist.ejs'
        res.render('artist', { band: band, artists: artistRows });
    } catch (err) {
        console.error(err);
        res.status(500).send('เกิดข้อผิดพลาดในการดึงข้อมูลวงดนตรีและศิลปิน');
    }
});

app.get('/Tracking_channel/:id', async (req, res) => {
    const bandId = req.params.id;
    console.log('Accessing Tracking_channel with id:', bandId); // เพิ่มการล็อก

    try {
        // ดึงข้อมูลวงดนตรีจาก bands_database
        const bandQuery = "SELECT * FROM bands_database WHERE id_bands = ?";
        const [bandRows] = await dbConnection.execute(bandQuery, [bandId]);

        if (bandRows.length === 0) {
            console.log('Band not found');
            return res.status(404).send('วงดนตรีไม่พบ');
        }

        const band = bandRows[0];
        console.log('Band:', band);

        // ดึงข้อมูลศิลปินจาก artist_database ที่เกี่ยวข้องกับ id_bands
        const artistsQuery = "SELECT * FROM artist_database WHERE id_bands = ?";
        const [artistRows] = await dbConnection.execute(artistsQuery, [bandId]);

        console.log('Artists:', artistRows);

        // ดึงข้อมูลช่องทางสังคมจาก channels_database
        const channelsQuery = "SELECT * FROM channels_database WHERE id_bands = ?";
        const [channelRows] = await dbConnection.execute(channelsQuery, [bandId]);

        console.log('Channels:', channelRows);

        const channels = channelRows.length > 0 ? channelRows[0] : null;

        // ส่งข้อมูลไปยัง view 'Tracking_channel.ejs'
        res.render('Tracking_channel', { band: band, artists: artistRows, channels: channels });
    } catch (err) {
        console.error(err);
        res.status(500).send('เกิดข้อผิดพลาดในการดึงข้อมูลวงดนตรีและศิลปิน');
    }
});

app.get('/webboard/:id', (req, res) => {
    const bandId = req.params.id;

    // Fetch the band data from the database
    getBandById(bandId, (error, band) => {
        if (error) {
            console.error("Error fetching band:", error);
            return res.status(500).send("Error fetching band details");
        }

        // Check if the band was found
        if (!band) {
            console.error("Band not found for ID:", bandId); // Log bandId for debugging
            return res.status(404).send("Band not found");
        }

        // Log the band object for debugging
        console.log("Band object:", band);

        // Render the webboard.ejs template with the band data
        res.render('webboard', { band }); // Pass the band object to EJS
    });
});





// เส้นทางสำหรับค้นหาวงดนตรี
app.get('/search', (req, res) => { 
    const searchTerm = req.query.q; // รับคำค้นจาก query parameter 'q'

    // สอบถามข้อมูลวงดนตรีจากตาราง bands_database โดยใช้ band_name LIKE
    const query = "SELECT `id_bands`, `band_name`, `band_picture` FROM `bands_database` WHERE `band_name` LIKE ? LIMIT 25";
    const likeSearchTerm = `%${searchTerm}%`;

    dbConnection.execute(query, [likeSearchTerm])
        .then(([rows]) => {
            res.render('search', {
                bands: rows,
                searchTerm: searchTerm
            });
        })
        .catch(err => {
            console.error(err);
            res.status(500).send('เกิดข้อผิดพลาดในการดึงข้อมูล');
        });
});

// HOME PAGE
app.get('/main', ifNotLoggedin, (req, res) => {
    dbConnection.execute("SELECT `name` FROM `users` WHERE `id`=?", [req.session.userID])
        .then(([rows]) => {
            res.render('main', {
                name: rows[0].name
            });
        })
        .catch(err => {
            // Handle the error properly
            console.error(err);
            res.status(500).send('Server Error');
        });
});// END OF HOME PAGE

// REGISTER PAGE
app.get('/register',(req, res) => {
    res.render('register');
});

app.post('/register', ifLoggedin,
    // Post data validation(using express-validator)
    [
        body('user_email', 'Invalid email address!').isEmail().custom((value) => {
            return dbConnection.execute('SELECT `email` FROM `users` WHERE `email`=?', [value])
                .then(([rows]) => {
                    if (rows.length > 0) {
                        return Promise.reject('This E-mail already in use!');
                    }
                    return true;
                });
        }),
        body('user_name', 'Username is Empty!').trim().not().isEmpty(),
        body('user_pass', 'The password must be of minimum length 6 characters').trim().isLength({ min: 6 }),
        body('first_name', 'First name is required').trim().not().isEmpty(),
        body('last_name', 'Last name is required').trim().not().isEmpty(),
    ], // end of post data validation
    (req, res, next) => {

        const validation_result = validationResult(req);
        const { user_name, user_pass, user_email, first_name, last_name } = req.body;

        // IF validation_result HAS NO ERROR
        if (validation_result.isEmpty()) {
            // Password encryption (using bcryptjs)
            bcrypt.hash(user_pass, 12).then((hash_pass) => {
                // INSERTING USER INTO DATABASE
                dbConnection.execute("INSERT INTO `users`(`first_name`, `last_name`, `name`, `email`, `password`) VALUES(?,?,?,?,?)", [first_name, last_name, user_name, user_email, hash_pass])
                    .then(result => {
                        res.redirect('/login');
                    }).catch(err => {
                        // THROW INSERTING USER ERROR'S
                        console.error(err);
                        res.status(500).send('Server Error');
                    });
            })
                .catch(err => {
                    // THROW HASHING ERROR'S
                    console.error(err);
                    res.status(500).send('Server Error');
                });
        } else {
            // COLLECT ALL THE VALIDATION ERRORS
            let allErrors = validation_result.errors.map((error) => {
                return error.msg;
            });
            // RENDERING REGISTER PAGE WITH VALIDATION ERRORS
            res.render('register', {
                register_error: allErrors,
                old_data: req.body
            });
        }
    }
);
// END OF REGISTER PAGE

// LOGIN PAGE
app.get('/login', ifLoggedin, (req, res) => {
    res.render('login'); // render login.ejs
});
app.post('/login', ifLoggedin, [
    body('user_email').custom((value) => {
        return dbConnection.execute('SELECT email FROM users WHERE email=?', [value])
            .then(([rows]) => {
                if (rows.length == 1) {
                    return true;
                }
                return Promise.reject('Invalid Email Address!');
            });
    }),
    body('user_pass', 'Password is empty!').trim().not().isEmpty(),
], (req, res) => {
    const validation_result = validationResult(req);
    const { user_pass, user_email } = req.body;
    if (validation_result.isEmpty()) {

        dbConnection.execute("SELECT * FROM `users` WHERE `email`=?", [user_email])
            .then(([rows]) => {
                bcrypt.compare(user_pass, rows[0].password).then(compare_result => {
                    if (compare_result === true) {
                        req.session.isLoggedIn = true;
                        req.session.userID = rows[0].id;

                        res.redirect('/main');
                    }
                    else {
                        res.render('login', {
                            login_errors: ['Invalid Password!']
                        });
                    }
                })
                    .catch(err => {
                        console.error(err);
                        res.status(500).send('Server Error');
                    });

            }).catch(err => {
                console.error(err);
                res.status(500).send('Server Error');
            });
    }
    else {
        let allErrors = validation_result.errors.map((error) => {
            return error.msg;
        });
        // RENDERING login-register PAGE WITH LOGIN VALIDATION ERRORS
        res.render('login', {
            login_errors: allErrors
        });
    }
});
// END OF LOGIN PAGE

// LOGOUT
app.get('/logout', (req, res) => {
    // Session destroy
    req.session = null;
    res.redirect('/register');
});
// END OF LOGOUT

// Route สำหรับแสดงฟอร์ม
app.get('/submit_song', (req, res) => {
    res.render('submit_song'); // render submit_song.ejs
});

// Route สำหรับจัดการข้อมูลจากฟอร์ม
app.post('/submit_song', async (req, res) => {
    const { song_name, artist_name, youtube_url, spotify_url, release_date } = req.body;

    // ตรวจสอบการป้อนข้อมูล
    if (!song_name || !artist_name || !youtube_url || !release_date) {
        return res.render('submit_song', {
            error: 'All fields are required!',
            old_data: req.body
        });
    }

    try {
        // เพิ่มข้อมูลเพลงลงในฐานข้อมูล
        const query = "INSERT INTO `submit_song` (`song_name`, `artist_name`, `youtube_url`, `spotify_url`, `release_date`) VALUES (?, ?, ?, ?, ?)";
        const values = [song_name, artist_name, youtube_url, spotify_url || null, release_date];

        const [result] = await dbConnection.execute(query, values);
        console.log('Insert result:', result);

        res.redirect('/login'); // รีไดเร็กไปหน้า login หลังจากกด submit
    } catch (err) {
        console.error('Database insertion error:', err.message); // ล็อกข้อผิดพลาดที่เกิดขึ้น
        res.status(500).send('Server Error');
    }
});

app.get('/information', (req, res) => {
    res.render('information'); // render information.ejs
});

app.get('/main', (req, res) => {
    res.render('main'); // render main.ejs
});

app.get('/profile', (req, res) => {
    res.render('profile'); // render profile.ejs
});

app.get('/webboard', (req, res) => {
    res.render('webboard'); // render webboard.ejs
});

// app.get('/Tracking_channel', (req, res) => {
//     res.render('Tracking_channel'); // render Tracking_channel.ejs
// });

app.get('/song', (req, res) => {
    res.render('song'); // render song.ejs
});

app.get('/search', (req, res) => {
    res.render('search'); // render search.ejs
});

app.get('/Create_post', (req, res) => {
    res.render('Create_post'); // render Create_post.ejs
});

// 404 Page
app.use('/', (req, res) => {
    res.status(404).send('<h1>404 Page Not Found!</h1>');
});

app.listen(3000, () => console.log("Server is Running..."));
app.get('/search', async (req, res) => {
    const searchTerm = req.query.q;  // รับค่าคำค้นหาจาก URL
    try {
        // ค้นหาจากฐานข้อมูล (แทนที่ด้วยคำสั่งค้นหาของคุณ)
        const bands = await db.query('SELECT * FROM bands WHERE band_name LIKE ?', [`%${searchTerm}%`]);

        // ส่งผลลัพธ์ไปยังหน้าผลลัพธ์
        res.render('search', {
            bands: bands,  // ผลลัพธ์จากฐานข้อมูล
            searchTerm: searchTerm,  // คำค้นหาที่ใช้
            message: bands.length > 0 ? null : 'ไม่พบวงดนตรีที่ตรงกับคำค้นหา'
        });
    } catch (error) {
        res.render('search', {
            bands: [],
            searchTerm: searchTerm,
            message: 'เกิดข้อผิดพลาดในการค้นหา'
        });
    }
});
