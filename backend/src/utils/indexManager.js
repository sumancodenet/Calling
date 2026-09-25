import mysql from 'mysql2';
import dotenv from 'dotenv';

dotenv.config();

const pool = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_DBNAME, 
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
});

export const checkAndManageIndexes = (tableName) => {
    pool.getConnection((err, connection) => {
        if (err) {
            console.error('Error getting connection:', err);
            return;
        }

        connection.query(`SHOW INDEX FROM ${tableName}`, (error, results) => {
            if (error) {
                console.error(`Error fetching indexes for ${tableName}:`, error);
                connection.release();
                return;
            }

            if (results.length >= 64) {
                // Filter out primary key index from results
                const indexesToDrop = results.filter(index => index.Key_name !== 'PRIMARY');
                
                indexesToDrop.forEach(index => {
                    const indexToDrop = index.Key_name;

                    connection.query(`ALTER TABLE ${tableName} DROP INDEX ${indexToDrop}`, (err) => {
                        if (err) {
                            console.error(`Error dropping index ${indexToDrop} from ${tableName}:`, err);
                        } else {
                            console.log(`Index ${indexToDrop} dropped from ${tableName}.`);
                        }
                    });
                });

            } else {
                console.log(`Index count for ${tableName} is within the limit.`);
            }

            connection.release(); // Release connection back to pool
        });
    });
};