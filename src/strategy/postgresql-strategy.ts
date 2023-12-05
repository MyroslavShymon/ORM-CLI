import { Pool, PoolClient } from 'pg';
import { DatabaseIngotInterface } from '@myroslavshymon/orm/orm/core';
import { AddMigrationInterface, ConnectionData, GetMigrationTableInterface } from '../common';
import { DatabaseStrategy } from './database-strategy.interface';

export class PostgreSqlStrategy implements DatabaseStrategy {
	client!: PoolClient;

	async connect(dataToConnect: ConnectionData): Promise<void> {
		const pool = new Pool(dataToConnect);
		this.client = await pool.connect();
		console.log('Connect with PostgreSQL');
	}

	async createMigration({
							  databaseIngot,
							  migrationName,
							  migrationTable = 'migrations',
							  migrationTableSchema = 'public'
						  }: AddMigrationInterface
	): Promise<void> {
		const addMigrationQuery = `INSERT INTO ${migrationTableSchema}.${migrationTable} (name, up, down, ingot)
    								VALUES ('${migrationName}', NULL, NULL, '${JSON.stringify(databaseIngot)}');`;

		await this.client.query(addMigrationQuery);
		console.log(`Migration is add successfully`);
	}

	async getCurrentDatabaseIngot({
									  migrationTable,
									  migrationTableSchema
								  }: GetMigrationTableInterface
	): Promise<DatabaseIngotInterface> {
		const getCurrentDatabaseIngotQuery = `SELECT * FROM ${migrationTableSchema}.${migrationTable} WHERE name = 'current_database_ingot';`;
		const response = await this.client.query(getCurrentDatabaseIngotQuery);
		if (response.rows.length === 0) {
			throw new Error('Initialize ORM!');
		}
		return response.rows[0].ingot;
	}

	async query(sql: string): Promise<any> {
		console.log(`PostgreSQL query executed: ${sql}`);
		return await this.client.query(sql);
	}
}