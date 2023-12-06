import * as dotenv from 'dotenv';
import { OptionValues } from 'commander';
import { DatabaseManager, DatabasesTypes, DataSourceContext } from '@myroslavshymon/orm';
import { ConnectionData, DatabaseContextInterface, InitManagerInterface, MigrationManagerInterface } from './common';
import { InitManager, MigrationManager } from './managers';
import { DatabaseContext, DatabaseStrategy, MySqlStrategy, PostgreSqlStrategy } from './strategy';
import { DatabaseManagerInterface } from '@myroslavshymon/orm/orm/core';

export class CLI {
	private readonly _connectionData: ConnectionData;
	private readonly _migrationManager: MigrationManagerInterface;
	private readonly _initManager: InitManagerInterface;
	private readonly _databaseContext: DatabaseContextInterface;
	private readonly _databaseManager: DatabaseManagerInterface;
	private _databaseType: DatabasesTypes = process.env.DB_TYPE === DatabasesTypes.MYSQL
		? DatabasesTypes.MYSQL
		: DatabasesTypes.POSTGRES;

	constructor(commanderOptions: OptionValues) {
		dotenv.config();
		const strategy = this._getStrategy();
		this._databaseContext = new DatabaseContext(strategy);
		this._connectionData = this._initializeConnectionData();
		this._databaseManager = new DatabaseManager({
			...this._connectionData,
			type: this._databaseType
		}, new DataSourceContext());
		this._migrationManager = new MigrationManager(this._databaseContext, this._connectionData, this._databaseManager);
		this._initManager = new InitManager();

		if (commanderOptions.init) {
			this._initManager.runInit();
		}
		if (commanderOptions['migration:create']) {
			this._migrationManager.createMigration(commanderOptions['migration:create']);
		}

		if (commanderOptions['migration:up']) {
			this._migrationManager.migrationUp(commanderOptions['migration:up']);
		}
	}

	private _initializeConnectionData(): ConnectionData {
		const host = process.env.HOST;
		const database = process.env.DATABASE;
		const port = Number(process.env.PORT);
		const user = process.env.USER;
		const password = process.env.PASSWORD;

		if (!host || !database || !port || !user || !password) {
			throw new Error('Missing required environment variables. Please check your configuration.');
		}

		return {
			host,
			database,
			port,
			user,
			password,
			migrationTable: process.env.MIGRATION_TABLE || 'migrations',
			migrationTableSchema: process.env.MIGRATION_SCHEMA || 'public'
		};
	}

	private _getStrategy(): DatabaseStrategy {
		const dbType = process.env.DB_TYPE;

		switch (dbType) {
			case DatabasesTypes.POSTGRES:
				return new PostgreSqlStrategy();
			case DatabasesTypes.MYSQL:
				return new MySqlStrategy();
			default:
				return new PostgreSqlStrategy(); // Default to PostgreSqlStrategy if dbType is not recognized or not provided
		}
	}
}