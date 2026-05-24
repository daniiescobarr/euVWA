const express = require('express');
const helmet = require('helmet');
const session = require('express-session');
const bcrypt = require('bcrypt');
const bodyParser = require('body-parser');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const { execFile } = require('child_process');
const multer = require('multer');

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads/');
    },
    filename: (req, file, cb) => {
        const safeName = Date.now() + '-' + file.originalname.replace(/[^a-zA-Z0-9.-]/g, '');
        cb(null, safeName);
    }
});

const fileFilter = (req, file, cb) => {
    const allowedTypes = [
        'image/png',
        'image/jpeg',
        'image/jpg',
        'application/pdf'
    ];

    if (allowedTypes.includes(file.mimetype)) {
        cb(null, true);
    } else {
        cb(new Error('Tipo de archivo no permitido'), false);
    }
};

const upload = multer({
    storage: storage,
    limits: {
        fileSize: 2 * 1024 * 1024
    },
    fileFilter: fileFilter
});

const app = express();
const db = new sqlite3.Database('./database/euvwa.db');


app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(bodyParser.urlencoded({ extended: true }));
app.use(session({
    secret: 'clave_segura_euvwa',
    resave: false,
    saveUninitialized: false
}));
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use(helmet());

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

    const query = "SELECT * FROM users WHERE username = ?";

    db.get(query, [username], async (err, user) => {
    if (err) {
        return res.render('login', {
            message: 'Error en la consulta SQL',
            query: 'Consulta preparada con parámetros'
        });
    }

    if (!user) {
        return res.render('login', {
            message: 'Login incorrecto. Usuario o contraseña no válidos.',
            query: 'Consulta preparada con parámetros'
        });
    }

    const passwordCorrecta = await bcrypt.compare(password, user.password);

    if (passwordCorrecta) {
        req.session.user = {
            id: user.id,
            username: user.username,
            role: user.role
        };

        res.render('login', {
            message: 'Login correcto. Bienvenido ' + user.username + ' | Rol: ' + user.role,
            query: 'Consulta preparada con parámetros + bcrypt'
        });
    } else {
        res.render('login', {
            message: 'Login incorrecto. Usuario o contraseña no válidos.',
            query: 'Consulta preparada con parámetros + bcrypt'
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

    const validTarget = /^[a-zA-Z0-9.-]+$/.test(target);

    if (!validTarget) {

        return res.render('command-injection', {
            command: 'Entrada bloqueada',
            output: 'Entrada no válida'
        });

    }

    execFile('ping', ['-c', '4', target], (error, stdout, stderr) => {

        const output = stdout || stderr;

        res.render('command-injection', {
            command: 'ping -c 4 ' + target,
            output: output
        });

    });

});

app.get('/file-upload', (req, res) => {
    res.render('file-upload');
});

app.post('/file-upload', (req, res) => {
    upload.single('file')(req, res, (err) => {
        if (err) {
            return res.render('file-upload', {
                error: err.message
            });
        }

        if (!req.file) {
            return res.render('file-upload', {
                error: 'No se ha subido ningún archivo'
            });
        }

        res.render('file-upload', {
            file: req.file
        });
    });
});

app.get('/sensitive-data', (req, res) => {
    const query = "SELECT id, username, role FROM users";

    db.all(query, (err, users) => {
        if (err) {
            return res.send('Error obteniendo usuarios');
        }

        res.render('sensitive-data', {
            users: users
        });
    });
});

app.get('/misconfiguration', (req, res) => {
    res.render('misconfiguration');
});

app.post('/misconfiguration', (req, res) => {
    res.render('misconfiguration', {
        error: 'Se ha producido un error interno. Contacte con el administrador.'
    });
});

app.get('/admin', (req, res) => {
    if (!req.session.user || req.session.user.role !== 'administrator') {
        return res.send('Acceso denegado. Debes iniciar sesión como administrador.');
    }

    db.all("SELECT id, username, role FROM users", (err, users) => {
        if (err) {
            return res.send('Error');
        }

        res.render('admin', {
            users: users
        });
    });
});


app.listen(3000, () => {
    console.log('Server corriendo en http://localhost:3000');
});