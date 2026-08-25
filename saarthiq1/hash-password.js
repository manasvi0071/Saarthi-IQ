const bcrypt = require('bcryptjs');

const password = 'password123';
const saltRounds = 10;
const hashedPassword = bcrypt.hashSync(password, saltRounds);

console.log("Hashed Password:", hashedPassword);