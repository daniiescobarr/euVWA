const bcrypt = require('bcrypt');

async function generarHashes() {

    const passwords = [
        'admin123',
        '1234',
        'test123'
    ];

    for (const password of passwords) {

        const hash = await bcrypt.hash(password, 10);

        console.log(password + ' -> ' + hash);
    }
}

generarHashes();