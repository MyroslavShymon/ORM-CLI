import { Connection, createConnection } from 'mysql2/promise';
import { DatabaseIngotInterface } from '@myroslavshymon/orm/orm/core';
import { DatabaseStrategy } from './interfaces';
import {
	AddMigrationInterface,
	CheckTableExistenceInterface,
	ConnectionData,
	GetMigrationByNameInterface,
	GetMigrationTableInterface,
	UpdateMigrationIngotInterface,
	UpdateMigrationStatusInterface
} from '../common';
import { DatabasesTypes } from '@myroslavshymon/orm';

export class MySqlStrategy implements DatabaseStrategy<DatabasesTypes.MYSQL> {
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
						  }: AddMigrationInterface<DatabasesTypes.MYSQL>
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
	): Promise<DatabaseIngotInterface<DatabasesTypes.MYSQL>> {
		const getCurrentDatabaseIngotQuery = `SELECT *
                                              FROM ${migrationTableSchema}.${migrationTable}
                                              WHERE name = 'current_database_ingot';`;
		const response = await this.client.query(getCurrentDatabaseIngotQuery);
		//TODO зробити для mysql
		// const currentDatabaseIngot: DatabaseIngotInterface = response.sql[0].ingot;
		// подивитись як реалізовано в postgres і зробити поп прикладу
		console.log(`Current database ingot`, response);
		// return currentDatabaseIngot;
		return { tables: [] };
	}

	async getLastDatabaseIngot(
		{
			migrationTableSchema,
			migrationTable
		}: GetMigrationTableInterface
	): Promise<DatabaseIngotInterface<DatabasesTypes.MYSQL>> {
		const getLastDatabaseIngotQuery = `SELECT *
                                           FROM ${migrationTableSchema}.${migrationTable}
                                           ORDER BY id DESC LIMIT 1;`;
		//TODO
		// const response = await this.client.query(getLastDatabaseIngotQuery);
		// if (response.rows.length === 0) {
		// 	throw new Error('Initialize ORM!');
		// }
		// return response.rows[0].ingot;
		return { tables: [] };
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

	async updateMigrationIngot({
								   ingot,
								   migrationTable,
								   migrationTableSchema,
								   migrationName
							   }: UpdateMigrationIngotInterface<DatabasesTypes.MYSQL>): Promise<void> {
		const updateMigrationIngotQuery = `
            UPDATE ${migrationTableSchema ? migrationTableSchema + '.' : ''}${migrationTable ? migrationTable : ''}
            SET ingot = '${JSON.stringify(ingot)}'
            WHERE name = '${migrationName ? migrationName : 'current_database_ingot'}';
		`;
		await this.client.query(updateMigrationIngotQuery);
		console.log(`Ingot of migration ${migrationName ? migrationName : 'current_database_ingot'} is updated`);
	}

	async checkTableExistence(options: CheckTableExistenceInterface): Promise<void> {
		console.log('checkTableExistence', options);
	}

	async getMigrationByName({
								 migrationName,
								 migrationTable,
								 migrationTableSchema
							 }: GetMigrationByNameInterface): Promise<any> {
		console.log('getMigrationByNameQuery');
	}

	async query(sql: string): Promise<any> {
		console.log(`MySQL query executed: ${sql}`);
		return this.client.query(sql);
	}
}