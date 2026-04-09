#!/usr/bin/env node

/**
 * MongoDB CSV Data Loader
 * Loads CSV data into MongoDB collections with proper schema
 * Usage: node load-csv.js [--db-size 5k|10k|25k]
 */

const { spawn } = require('child_process');
const path = require('path');

// Get db_size from command line args or default to 5k
const dbSize = process.argv[2]?.split('=')[1] || '5k';
const mongoConnection = 'mongodb://localhost:27017/healthcare_db';

// Map db_size to CSV folder size
const sizeMap = {
    '5k': '5000',
    '10k': '10000',
    '25k': '25000'
};

const csvSize = sizeMap[dbSize];
if (!csvSize) {
    console.error(`Invalid db_size. Use: 5k, 10k, or 25k`);
    process.exit(1);
}

const baseDir = path.join(__dirname, '../../datasets', csvSize);
const collections = [
    { 
        file: `patients${csvSize}.csv`, 
        collection: `patients_${dbSize}`,
        description: 'Patients'
    },
    { 
        file: `doctors${csvSize}.csv`, 
        collection: `doctors_${dbSize}`,
        description: 'Doctors'
    },
    { 
        file: `appointments${csvSize}.csv`, 
        collection: `appointments_${dbSize}`,
        description: 'Appointments'
    },
    { 
        file: `prescriptions${csvSize}.csv`, 
        collection: `prescriptions_${dbSize}`,
        description: 'Prescriptions'
    },
    { 
        file: `billing${csvSize}.csv`, 
        collection: `billing_${dbSize}`,
        description: 'Billing'
    },
    { 
        file: `doctor_specializations${csvSize}.csv`, 
        collection: `doctor_specializations_${dbSize}`,
        description: 'Doctor Specializations'
    }
];

const departmentCollections = [
    {
        file: `departments${csvSize}.csv`,
        collection: `departments`,
        description: 'Departments (shared)'
    }
];

/**
 * Execute mongoimport command
 */
function executeImport(file, collection, description) {
    return new Promise((resolve, reject) => {
        const csvPath = path.join(baseDir, file);
        console.log(`\n📥 Importing ${description}...`);
        console.log(`   File: ${csvPath}`);
        console.log(`   Collection: ${collection}`);

        const args = [
            '--uri', mongoConnection,
            '--collection', collection,
            '--type', 'csv',
            '--headerline',
            '--mode', 'upsert',
            '--file', csvPath
        ];

        const mongoimport = spawn('mongoimport', args);

        let output = '';
        let errorOutput = '';

        mongoimport.stdout.on('data', (data) => {
            output += data.toString();
            console.log(`   ${data}`);
        });

        mongoimport.stderr.on('data', (data) => {
            errorOutput += data.toString();
            console.error(`   ERROR: ${data}`);
        });

        mongoimport.on('close', (code) => {
            if (code === 0) {
                console.log(`✅ ${description} imported successfully`);
                resolve();
            } else {
                reject(new Error(`mongoimport failed for ${description} (exit code: ${code})`));
            }
        });
    });
}

/**
 * Create indexes for performance
 */
async function createIndexes() {
    console.log('\n📊 Creating indexes for performance...');
    const mongoose = require('mongoose');
    
    try {
        await mongoose.connect(mongoConnection);
        
        const collections_to_index = [
            { name: `patients_${dbSize}`, keys: { patient_id: 1 } },
            { name: `doctors_${dbSize}`, keys: { doctor_id: 1, department_id: 1 } },
            { name: `appointments_${dbSize}`, keys: { patient_id: 1, doctor_id: 1 } },
            { name: `prescriptions_${dbSize}`, keys: { appointment_id: 1, patient_id: 1, doctor_id: 1 } },
            { name: `billing_${dbSize}`, keys: { appointment_id: 1, patient_id: 1 } },
            { name: `doctor_specializations_${dbSize}`, keys: { doctor_id: 1 } },
            { name: 'departments', keys: { department_id: 1 } }
        ];

        for (const { name, keys } of collections_to_index) {
            const collection = mongoose.connection.collection(name);
            await collection.createIndex(keys);
            console.log(`   ✓ Created index on ${name}`);
        }

        await mongoose.connection.close();
        console.log('✅ All indexes created successfully');
    } catch (err) {
        console.error('Error creating indexes:', err.message);
        throw err;
    }
}

/**
 * Main execution
 */
async function main() {
    console.log('🚀 MongoDB CSV Data Loader');
    console.log(`📦 Dataset Size: ${dbSize}`);
    console.log(`🗄️  Database: healthcare_db`);
    console.log(`📁 Base Directory: ${baseDir}`);

    try {
        // Import collection-specific data
        for (const col of collections) {
            await executeImport(col.file, col.collection, col.description);
        }

        // Import shared departments (only once)
        console.log('\n⚠️  Note: Departments collection is shared across all sizes.');
        console.log('   Skipping departments import if it already exists.');
        
        // Try to import, but don't fail if collection already exists
        try {
            for (const col of departmentCollections) {
                await executeImport(col.file, col.collection, col.description);
            }
        } catch (err) {
            console.log('   (Departments may already exist - this is OK)');
        }

        // Create indexes
        await createIndexes();

        console.log('\n✨ Data loading complete!');
        console.log(`\n📝 Summary:`);
        console.log(`   - Loaded ${collections.length} collection(s) for ${dbSize} dataset`);
        console.log(`   - Collections created with pattern: <name>_${dbSize}`);
        console.log(`   - Departments in: departments`);
        console.log(`   - All data uses integer IDs (PostgreSQL compatible)`);
        console.log(`   - Ready for benchmarking with k6`);

    } catch (err) {
        console.error('\n❌ Data loading failed:', err.message);
        process.exit(1);
    }
}

main();
