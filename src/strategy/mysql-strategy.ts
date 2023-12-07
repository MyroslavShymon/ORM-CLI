import { Connection, createConnection } from 'mysql2/promise';
import { DatabaseIngotInterface } from '@myroslavshymon/orm/orm/core';
import { DatabaseStrategy } from './interfaces';
import {
	AddMigrationInterface,
	ConnectionData,
	GetMigrationTableInterface,
	UpdateMigrationStatusInterface
} from '../common';

export class MySqlStrategy implements DatabaseStrategy {
	client!: Connection;

	async connect(dataToConnect: ConnectionData): Promise<void> {
		this.client = await createConnection(dataToConnect);
		console.log('Connect with MySQL');
	}

	async createMigration({
							  databaseIngot,
							  migrationName,
							  migrationTable = 'migrations',
							  migrationTableSchema = 'public'
						  }: AddMigrationInterface
	): Promise<void> {
		const addMigrationQuery = `INSERT INTO ${migrationTableSchema}.${migrationTable} (name, ingot)
    								VALUES ('${migrationName}', '${JSON.stringify(databaseIngot)}');`;

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
		//TODO зробити для mysql
		// const currentDatabaseIngot: DatabaseIngotInterface = response.sql[0].ingot;
		// подивитись як реалізовано в postgres і зробити поп прикладу
		console.log(`Current database ingot`, response);
		// return currentDatabaseIngot;
		return {};
	}

	async getLastDatabaseIngot(
		{
			migrationTableSchema,
			migrationTable
		}: GetMigrationTableInterface
	): Promise<DatabaseIngotInterface> {
		const getLastDatabaseIngotQuery = `SELECT * FROM ${migrationTableSchema}.${migrationTable} ORDER BY id DESC LIMIT 1;`;
		//TODO
		// const response = await this.client.query(getLastDatabaseIngotQuery);
		// if (response.rows.length === 0) {
		// 	throw new Error('Initialize ORM!');
		// }
		// return response.rows[0].ingot;
		return {};
	}

	async updateMigrationStatus({
									migrationTable,
									migrationTableSchema,
									migrationName,
									isUp
								}: UpdateMigrationStatusInterface
	): Promise<void> {
		const updateMigrationStatusQuery = `
					UPDATE ${migrationTableSchema}.${migrationTable}
					SET is_up = ${isUp.toString()}
					WHERE name = '${migrationName}';
		`;
		await this.client.query(updateMigrationStatusQuery);
		console.log(`Migration status of ${migrationName} is updated to ${isUp}`);
	}

	async query(sql: string): Promise<any> {
		console.log(`MySQL query executed: ${sql}`);
		return this.client.query(sql);
	}
}