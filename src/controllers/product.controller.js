const mongoose = require('mongoose');
const Product = require('../models/product.model');
const Category = require('../models/category.model');

function mapProductListItem(product) {
    return {
        id: product._id.toString(),
        categoryId: product.category._id.toString(),
        name: product.name,
        sku: product.sku,
        description: product.description,
        brand: product.brand,
        model: product.model,
        price: product.price,
        currency: product.currency,
        stock: product.stock,
        availabilityStatus: product.availabilityStatus,
        imageUrl: product.imageUrl,
        isActive: product.isActive,
        tags: product.tags ?? [],
    };
}

function mapProductDetail(product) {
    return {
        id: product._id.toString(),
        category: {
            id: product.category._id.toString(),
            name: product.category.name,
            slug: product.category.slug,
        },
        name: product.name,
        sku: product.sku,
        description: product.description,
        brand: product.brand,
        model: product.model,
        price: product.price,
        currency: product.currency,
        stock: product.stock,
        availabilityStatus: product.availabilityStatus,
        imageUrl: product.imageUrl,
        isActive: product.isActive,
        tags: product.tags ?? [],
        specs: product.specs ?? [],
        dimensions: product.dimensions ?? {},
        compatibility: product.compatibility ?? [],
        documents: product.documents ?? [],
    };
}

async function getProducts(req, res) {
    try {
        const { category, q } = req.query;

        const filter = { isActive: true };

        if (category) {
            const foundCategory = await Category.findOne({ slug: category, isActive: true });
            if (!foundCategory) {
                return res.json({
                    ok: true,
                    data: [],
                });
            }
            filter.category = foundCategory._id;
        }

        if (q) {
            filter.$or = [
                { name: { $regex: q, $options: 'i' } },
                { sku: { $regex: q, $options: 'i' } },
                { brand: { $regex: q, $options: 'i' } },
                { model: { $regex: q, $options: 'i' } },
            ];
        }

        const products = await Product.find(filter)
            .populate('category', 'name slug')
            .sort({ createdAt: -1 });

        res.json({
            ok: true,
            data: products.map(mapProductListItem),
        });
    } catch (error) {
        res.status(500).json({
            ok: false,
            error: error.message,
        });
    }
}

async function getProductById(req, res) {
    try {
        const { id } = req.params;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({
                ok: false,
                error: 'ID de producto inválido',
            });
        }

        const product = await Product.findById(id)
            .populate('category', 'name slug');

        if (!product || !product.isActive) {
            return res.status(404).json({
                ok: false,
                error: 'Producto no encontrado',
            });
        }

        res.json({
            ok: true,
            data: mapProductDetail(product),
        });
    } catch (error) {
        res.status(500).json({
            ok: false,
            error: error.message,
        });
    }
}

async function createProduct(req, res) {
    try {
        const {
            categoryId,
            name,
            sku,
            description,
            brand,
            model,
            price,
            currency,
            stock,
            availabilityStatus,
            imageUrl,
            isActive,
            tags,
            specs,
            dimensions,
            compatibility,
            documents,
        } = req.body;

        const category = await Category.findById(categoryId);

        if (!category) {
            return res.status(400).json({
                ok: false,
                error: 'La categoría no existe',
            });
        }

        const product = await Product.create({
            category: categoryId,
            name,
            sku,
            description,
            brand,
            model,
            price,
            currency,
            stock,
            availabilityStatus,
            imageUrl,
            isActive,
            tags,
            specs,
            dimensions,
            compatibility,
            documents,
        });

        const populatedProduct = await Product.findById(product._id)
            .populate('category', 'name slug');

        res.status(201).json({
            ok: true,
            data: mapProductDetail(populatedProduct),
        });
    } catch (error) {
        res.status(500).json({
            ok: false,
            error: error.message,
        });
    }
}

module.exports = {
    getProducts,
    getProductById,
    createProduct,
};