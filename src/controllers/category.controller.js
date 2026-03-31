const Category = require('../models/category.model');

async function getCategories(req, res) {
  try {
    const categories = await Category.find({ isActive: true })
      .sort({ name: 1 });

    res.json({
      ok: true,
      data: categories.map((category) => ({
        id: category._id.toString(),
        name: category.name,
        slug: category.slug,
        description: category.description,
        isActive: category.isActive,
      })),
    });
  } catch (error) {
    res.status(500).json({
      ok: false,
      error: error.message,
    });
  }
}

module.exports = {
  getCategories,
};