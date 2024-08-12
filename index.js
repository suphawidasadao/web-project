const express = require('express');
const path = require('path');
const cookieSession = require('cookie-session');
const bcrypt = require('bcrypt');
const dbConnection = require('./database');
const { body, validationResult } = require('express-validator');

const app = express();
app.use('/pic', express.static('pic'));
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
        return res.redirect('/home');
    }
    next();
};

// END OF CUSTOM MIDDLEWARE

// ROOT PAGE
app.get('/', ifNotLoggedin, (req, res) => {
    dbConnection.execute("SELECT `name` FROM `users` WHERE `id`=?", [req.session.userID])
        .then(([rows]) => {
            res.render('home', {
                name: rows[0].name
            });
        })
        .catch(err => {
            // Handle the error properly
            console.error(err);
            res.status(500).send('Server Error');
        });
});// END OF ROOT PAGE

// HOME PAGE
app.get('/home', ifNotLoggedin, (req, res) => {
    dbConnection.execute("SELECT `name` FROM `users` WHERE `id`=?", [req.session.userID])
        .then(([rows]) => {
            res.render('home', {
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
app.get('/login', ifLoggedin, (req, res) => {
    res.render('login'); // render login.ejs
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
    ], // end of post data validation
    (req, res, next) => {

        const validation_result = validationResult(req);
        const { user_name, user_pass, user_email } = req.body;
        // IF validation_result HAS NO ERROR
        if (validation_result.isEmpty()) {
            // Password encryption (using bcryptjs)
            bcrypt.hash(user_pass, 12).then((hash_pass) => {
                // INSERTING USER INTO DATABASE
                dbConnection.execute("INSERT INTO `users`(`name`,`email`,`password`) VALUES(?,?,?)", [user_name, user_email, hash_pass])
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
        }
        else {
            // COLLECT ALL THE VALIDATION ERRORS
            let allErrors = validation_result.errors.map((error) => {
                return error.msg;
            });
            // RENDERING login-register PAGE WITH VALIDATION ERRORS
            res.render('register', {
                register_error: allErrors,
                old_data: req.body
            });
        }
    }
);// END OF REGISTER PAGE

// LOGIN PAGE
app.post('/', ifLoggedin, [
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

                        res.redirect('/home');
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
    res.redirect('/');
});
// END OF LOGOUT

app.use('/', (req, res) => {
    res.status(404).send('<h1>404 Page Not Found!</h1>');
});

app.listen(3000, () => console.log("Server is Running..."));
