const User = require('../models/user.model');

async function getUsers(req, res) {
  try {
    const users = await User.find().select('-password');

    res.json({
      ok: true,
      data: users,
    });
  } catch (error) {
    res.status(500).json({
      ok: false,
      error: error.message,
    });
  }
}

async function createTestUser(req, res) {
  try {
    const count = await User.countDocuments();

    const user = await User.create({
      name: `Admin Test ${count + 1}`,
      email: `admin${count + 1}@vayo.test`,
      password: '123456',
      role: 'ADMIN',
    });

    res.status(201).json({
      ok: true,
      data: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error) {
    res.status(500).json({
      ok: false,
      error: error.message,
    });
  }
}

module.exports = {
  getUsers,
  createTestUser,
};