import { DatabaseStrategy } from './database-strategy.interface';
import { ConnectionData } from './common/connection-data';
import { Connection, createConnection } from 'mysql2/promise';
import { AddMigrationInterface, GetMigrationTableInterface } from './common/interfaces';
import { DatabaseIngotInterface } from '@myroslavshymon/orm/orm/core';

export class MysqlStrategy implements DatabaseStrategy {
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
		//TODO зробити для mysql
		// const currentDatabaseIngot: DatabaseIngotInterface = response.sql[0].ingot;
		console.log(`Current database ingot`, response);
		// return currentDatabaseIngot;
		return {};
	}

	async query(sql: string): Promise<any> {
		console.log(`MySQL query executed: ${sql}`);
		return this.client.query(sql);
	}
}