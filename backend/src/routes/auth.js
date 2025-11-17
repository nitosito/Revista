const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const router = express.Router();

router.post('/login', async (req, res) => {
  const { username, password } = req.body;
  const knex = req.db;
  try {
    const user = await knex('users').where({ username }).first();
    if (!user) return res.status(401).json({ error: 'Credenciales inválidas' });
    const ok = await bcrypt.compare(password, user.password);
    if (!ok) return res.status(401).json({ error: 'Credenciales inválidas' });
    const token = jwt.sign({ userId: user.id, username: user.username }, process.env.JWT_SECRET || 'secret_dev_jwt', { expiresIn: '8h' });
    res.json({ token, username: user.username, full_name: user.full_name });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error en autenticación' });
  }
});

module.exports = router;
