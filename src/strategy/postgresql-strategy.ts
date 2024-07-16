import { Pool, PoolClient } from 'pg';
import { DatabaseIngotInterface } from '@myroslavshymon/orm/orm/core';
import {
	AddMigrationInterface,
	CheckTableExistenceInterface,
	ConnectionData,
	GetMigrationByNameInterface,
	GetMigrationTableInterface,
	UpdateMigrationIngotInterface,
	UpdateMigrationStatusInterface
} from '../common';
import { DatabaseStrategy } from './interfaces';
import { DatabasesTypes } from '@myroslavshymon/orm';

export class PostgreSqlStrategy implements DatabaseStrategy<DatabasesTypes.POSTGRES> {
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
						  }: AddMigrationInterface<DatabasesTypes.POSTGRES>
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
	): Promise<DatabaseIngotInterface<DatabasesTypes.POSTGRES>> {
		const getCurrentDatabaseIngotQuery = `SELECT *
                                              FROM ${migrationTableSchema}.${migrationTable}
                                              WHERE name = 'current_database_ingot';`;
		const response = await this.client.query(getCurrentDatabaseIngotQuery);
		if (response.rows.length === 0) {
			throw new Error('Initialize ORM!');
		}
		return response.rows[0].ingot;
	}

	async getLastDatabaseIngot(
		{
			migrationTableSchema,
			migrationTable
		}: GetMigrationTableInterface
	): Promise<DatabaseIngotInterface<DatabasesTypes.POSTGRES>> {
		const getLastDatabaseIngotQuery = `SELECT *
                                           FROM ${migrationTableSchema}.${migrationTable}
                                           ORDER BY id DESC LIMIT 1;`;
		const response = await this.client.query(getLastDatabaseIngotQuery);

		if (response.rows.length === 0) {
			throw new Error('Initialize ORM!');
		}

		//TODO Typing
		return response.rows[0].ingot;
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
							   }: UpdateMigrationIngotInterface<DatabasesTypes.POSTGRES>): Promise<void> {
		const updateMigrationIngotQuery = `
            UPDATE ${migrationTableSchema ? migrationTableSchema + '.' : ''}${migrationTable ? migrationTable : ''}
            SET ingot = '${JSON.stringify(ingot)}'
            WHERE name = '${migrationName ? migrationName : 'current_database_ingot'}';
		`;
		await this.client.query(updateMigrationIngotQuery);
		console.log(`Ingot of migration ${migrationName ? migrationName : 'current_database_ingot'} is updated`);
	}

	async checkTableExistence(options: CheckTableExistenceInterface): Promise<void> {
		const checkTableExistenceQuery = `SELECT EXISTS (SELECT 1
                                                         FROM information_schema.tables
                                                         WHERE table_name = '${options.tableName}'
                                                           and table_schema = '${options.schema ? options.schema : 'public'}');`;
		const tableExistence = await this.client.query(checkTableExistenceQuery);
		if (tableExistence.rows[0].exists === false) {
			throw new Error(`Table with name ${options.tableName} doesnt exist\n
			To resolve this Error you need to run app\n`);
		}
	}

	async getMigrationByName({
								 migrationName,
								 migrationTable,
								 migrationTableSchema
							 }: GetMigrationByNameInterface): Promise<{ name: string, is_up: boolean }[]> {
		const getMigrationByNameQuery = `SELECT name, is_up
                                         FROM ${migrationTableSchema}.${migrationTable}
                                         WHERE name LIKE '%${migrationName}'`;
		const migrations = await this.client.query(getMigrationByNameQuery);
		return migrations.rows;
	}

	async query(sql: string): Promise<any> {
		console.log(`PostgreSQL query executed: ${sql}`);
		return await this.client.query(sql);
	}
}