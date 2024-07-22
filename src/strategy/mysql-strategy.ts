import { Connection, createConnection, RowDataPacket } from 'mysql2/promise';
import { DatabaseIngotInterface } from '@myroslavshymon/orm/orm/core';
import { DatabaseStrategy, MigrationRowInterface } from './interfaces';
import {
	AddMigrationInterface,
	CheckTableExistenceInterface,
	ConnectionData,
	constants,
	GetMigrationByNameInterface,
	GetMigrationTableInterface,
	UpdateMigrationIngotInterface,
	UpdateMigrationStatusInterface
} from '../common';
import { DatabasesTypes } from '@myroslavshymon/orm';

export class MySqlStrategy implements DatabaseStrategy<DatabasesTypes.MYSQL> {
	client!: Connection;

	async connect(dataToConnect: ConnectionData): Promise<void> {
		this.client = await createConnection({ ...dataToConnect, multipleStatements: true });
		console.log('Connect with MySQL');
	}

	async createMigration({
							  databaseIngot,
							  migrationName,
							  databaseName,
							  migrationTable = constants.migrationsTableName
						  }: AddMigrationInterface<DatabasesTypes.MYSQL>
	): Promise<void> {
		const addMigrationQuery = `INSERT INTO ${databaseName}.${migrationTable} (name, ingot)
                                   VALUES ('${migrationName}', '${JSON.stringify(databaseIngot)}');`;

		await this.client.query(addMigrationQuery);
		console.log(`Migration is add successfully`);
	}

	async getCurrentDatabaseIngot({
									  migrationTable = constants.migrationsTableName,
									  databaseName
								  }: GetMigrationTableInterface
	): Promise<DatabaseIngotInterface<DatabasesTypes.MYSQL>> {
		const getCurrentDatabaseIngotQuery = `SELECT *
                                              FROM ${databaseName}.${migrationTable}
                                              WHERE name = '${constants.currentDatabaseIngot}';`;

		const [rows]: [MigrationRowInterface[], any] = await this.client.query(getCurrentDatabaseIngotQuery);

		if (rows.length === 0) {
			throw new Error('Initialize ORM!');
		}

		console.log(`Current database ingot`, rows[0].ingot);
		return rows[0].ingot;
	}

	async getLastDatabaseIngot(
		{
			migrationTable = constants.migrationsTableName,
			databaseName
		}: GetMigrationTableInterface
	): Promise<DatabaseIngotInterface<DatabasesTypes.MYSQL>> {
		const getLastDatabaseIngotQuery = `SELECT *
                                           FROM ${databaseName}.${migrationTable}
                                           ORDER BY id DESC LIMIT 1;`;


		const [rows]: [MigrationRowInterface[], any] = await this.client.query(getLastDatabaseIngotQuery);

		if (rows.length === 0) {
			throw new Error('Initialize ORM!');
		}

		return rows[0].ingot;
	}

	async updateMigrationStatus({
									migrationTable = constants.migrationsTableName,
									migrationName,
									databaseName,
									isUp
								}: UpdateMigrationStatusInterface
	): Promise<void> {
		const updateMigrationStatusQuery = `
            UPDATE ${databaseName}.${migrationTable}
            SET is_up = ${isUp.toString()}
            WHERE name = '${migrationName}';
		`;

		await this.client.query(updateMigrationStatusQuery);
		console.log(`Migration status of ${migrationName} is updated to ${isUp}`);
	}

	async updateMigrationIngot({
								   migrationTable = constants.migrationsTableName,
								   migrationTableSchema = constants.migrationsTableSchemaName,
								   ingot,
								   migrationName
							   }: UpdateMigrationIngotInterface<DatabasesTypes.MYSQL>): Promise<void> {
		const updateMigrationIngotQuery = `
            UPDATE ${migrationTableSchema ? migrationTableSchema + '.' : ''}${migrationTable ? migrationTable : ''}
            SET ingot = '${JSON.stringify(ingot)}'
            WHERE name = '${migrationName ? migrationName : constants.currentDatabaseIngot}';
		`;

		await this.client.query(updateMigrationIngotQuery);
		console.log(`Ingot of migration ${migrationName ? migrationName : constants.currentDatabaseIngot} is updated`);
	}

	async checkTableExistence(options: CheckTableExistenceInterface): Promise<void> {
		const checkTableExistenceQuery = `SELECT COUNT(*)
                                                     AS tableExists
                                          FROM information_schema.tables
                                          WHERE table_name = '${options.tableName}';`;

		const [rows]: [RowDataPacket[], any] = await this.client.execute(checkTableExistenceQuery);
		const tableExists = rows[0].tableExists > 0;
		if (!tableExists) {
			throw new Error(`Table with name ${options.tableName} doesn't exist\n
		    To resolve this Error you need to run the app\n`);
		}
	}

	async getMigrationByName({
								 migrationTable = constants.migrationsTableName,
								 migrationName, databaseName
							 }: GetMigrationByNameInterface): Promise<any> {
		const getMigrationByNameQuery = `SELECT name, is_up
                                         FROM ${databaseName}.${migrationTable}
                                         WHERE name LIKE '%${migrationName}'`;
		const [migrations] = await this.client.query(getMigrationByNameQuery);
		return migrations;
	}

	async query(sql: string): Promise<any> {
		console.log(`MySQL query executed: ${sql}`);
		return this.client.query(sql);
	}
}