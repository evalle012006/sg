const bcrypt = require('bcryptjs');

export async function getPasswordHash(password) {
    const salt = await bcrypt.genSalt(6);
    return await bcrypt.hash(password, salt);
}

export async function verifyPassword(password, hashedPassword) {
    return await bcrypt.compare(password, hashedPassword);
}