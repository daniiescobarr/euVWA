const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const { exec } = require('child_process');
const multer = require('multer');
const upload = multer({ dest: 'uploads/' });

const app = express();
const db = new sqlite3.Database('./database/euvwa.db');
// Middleware
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

app.get('/', (req, res) => {
    res.render('index');
});

app.get('/login', (req, res) => {
    res.render('login', {
        message: undefined,
        query: undefined
    });
});

app.post('/login', (req, res) => {
    const username = req.body.username;
    const password = req.body.password;

    const query = "SELECT * FROM users WHERE username = '" + username + "' AND password = '" + password + "'";

    db.get(query, (err, user) => {
        if (err) {
            return res.render('login' , {
                message: 'Error en la consulta SQL' ,
                query: query
            });
        }

        if (user) {
            res.render('login', {
                message: 'Login correcto. Bienvenido ' + user.username + ' | Rol: ' + user.role,
                query: query
            });
        } else {
            res.render('login', {
                message: 'Login incorrecto. Usuario o contraseña no válidos.',
                query: query
            });
        }
    });
});

app.get('/xss-reflected', (req, res) => {
    const search = req.query.search;
    res.render('xss-reflected', { search: search });
});

app.get('/xss-stored', (req, res) => {
    const comments = JSON.parse(
        fs.readFileSync('./database/comments.json')
    );
    
    res.render('xss-stored', { comments: comments });
});

app.post('/xss-stored', (req, res) => {
    const name = req.body.name;
    const comment = req.body.comment;

    const comments = JSON.parse(
        fs.readFileSync('./database/comments.json')
    );

    comments.push({ name: name, comment: comment });

    fs.writeFileSync('./database/comments.json', JSON.stringify(comments, null, 2));

    res.redirect('/xss-stored');
});

app.get('/command-injection', (req, res) => {
    res.render('command-injection');
});

app.post('/command-injection', (req, res) => {
    const target = req.body.target;

    const command = 'ping -c 4 ' + target;

    exec(command, (error, stdout, stderr) => {
        const output = stdout || stderr || error;

        res.render('command-injection', { command: command, output: output });

    });
});

app.get('/file-upload', (req, res) => {
    res.render('file-upload');
});

app.post('/file-upload', upload.single('file'), (req, res) => {
    res.render('file-upload', {
        file: req.file
    });
});

app.get('/sensitive-data', (req, res) => {
    const query = "SELECT * FROM users";

    db.all(query, (err, users) => {
        if (err) {
            return res.send('Error obteniendo usuarios');
        }

        res.render('sensitive-data', {
            users: users,
            projectPath: __dirname
        });
    });
});

app.get('/misconfiguration', (req, res) => {
    res.render('misconfiguration');
});

app.post('/misconfiguration', (req, res) => {
    try {
        throw new Error('Error simulado: ruta interna /home/user/euVWA/vulnerable/app.js expuesta en modo desarrollo');
    } catch (error) {
        res.render('misconfiguration', {
            error: error.stack
        });
    }
});

app.get('/admin', (req, res) => {
    const role = req.query.role;

    if (role === 'admin') {
        db.all("SELECT * FROM users", (err, users) => {
            if (err) {
                return res.send('Error');
            }

            res.render('admin', {
                users: users
            });
        });
    } else {
        res.send('Acceso denegado');
    }
});


app.listen(3000, () => {
    console.log('Server corriendo en http://localhost:3000');
});