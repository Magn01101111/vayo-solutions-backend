require('dotenv').config();
const mongoose = require('mongoose');
const Category = require('../models/category.model');

const categories = [
    {
        name: 'Compresores',
        slug: 'compresores',
        description: 'Repuestos y componentes para compresores de climatización.',
        isActive: true,
    },
    {
        name: 'Ventiladores',
        slug: 'ventiladores',
        description: 'Ventiladores axiales, centrífugos y componentes asociados.',
        isActive: true,
    },
    {
        name: 'Válvulas',
        slug: 'valvulas',
        description: 'Válvulas y componentes de control para sistemas HVAC.',
        isActive: true,
    },
    {
        name: 'Sensores',
        slug: 'sensores',
        description: 'Sensores de temperatura, presión y monitoreo.',
        isActive: true,
    },
    {
        name: 'Filtros',
        slug: 'filtros',
        description: 'Filtros secadores y otros elementos de filtrado.',
        isActive: true,
    },
];

async function seedCategories() {
    try {
        const uri = process.env.ATLAS_URL;

        if (!uri) {
            throw new Error('Falta la variable de entorno ATLAS_URL');
        }

        await mongoose.connect(uri);
        console.log('Conectado a MongoDB');

        await Category.deleteMany({});
        console.log('Categorías anteriores eliminadas');

        const insertedCategories = await Category.insertMany(categories);
        console.log(`Se insertaron ${insertedCategories.length} categorías`);

        insertedCategories.forEach((category) => {
            console.log(`- ${category.name} (${category._id})`);
        });

        await mongoose.connection.close();
        console.log('Conexión cerrada');
    } catch (error) {
        console.error('Error ejecutando seed de categorías:', error.message);
        process.exit(1);
    }
}

seedCategories();