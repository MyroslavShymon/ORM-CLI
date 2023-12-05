import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';
import { OptionValues } from 'commander';
import { DatabaseContext } from './database-context';
import { PostgresStrategy } from './postgres-strategy';
import { DatabasesTypes } from '@myroslavshymon/orm';
import { MysqlStrategy } from './mysql-strategy';
import { ConnectionData } from './common/connection-data';

const prompts = require('prompts');

export class CLI {
	private readonly _commanderOptions: OptionValues;
	private readonly _connectionData: ConnectionData;
	private _databaseContext = new DatabaseContext();

	constructor(commanderOptions: OptionValues) {
		dotenv.config();
		const dbType = process.env.DB_TYPE;
		this._connectionData = {
			host: process.env.HOST,
			database: process.env.DATABASE,
			port: Number(process.env.PORT),
			user: process.env.USER,
			password: process.env.PASSWORD,
			migrationTable: process.env.MIGRATION_TABLE || 'migrations',
			migrationTableSchema: process.env.MIGRATION_SCHEMA || 'public'
		};

		if (dbType === DatabasesTypes.POSTGRES) {
			this._databaseContext.setStrategy(new PostgresStrategy());
		}

		if (dbType === DatabasesTypes.MYSQL) {
			this._databaseContext.setStrategy(new MysqlStrategy());
		}


		this._commanderOptions = commanderOptions;
		if (this._commanderOptions.init) {
			this.runInit();
		}
		if (this._commanderOptions['migration:create']) {
			this.createMigration(this._commanderOptions['migration:create']);
		}
	}

	private async createMigration(migrationName?: string | boolean) {
		let resultMigrationName = Date.now() + '_' + migrationName;
		await this._databaseContext.connect(this._connectionData);
		const projectRoot = process.cwd();
		const migrationPath = path.resolve(projectRoot, 'migrations');
		const isMigrationFolderExist = fs.existsSync(migrationPath);

		//TODO optimize ifs
		if (isMigrationFolderExist) {
			// array of existed folders and files in this folder
			const nameOfFilesInMigrationPath = fs.readdirSync(migrationPath);
			const isMigrationsExist = nameOfFilesInMigrationPath.length !== 0;

			if (!isMigrationsExist) {
				if (migrationName === true) {
					const value = await prompts([
						{
							type: 'toggle',
							name: 'migrationName',
							message: `Do you want to name initial migration 'init'?`,
							initial: true,
							active: 'yes',
							inactive: 'no'
						}
					]);
					if (value.migrationName) {
						resultMigrationName = Date.now() + '_' + 'init';
					} else {
						const response = await prompts({
							type: 'text',
							name: 'migrationName',
							message: 'Enter migration name'
						});
						resultMigrationName = Date.now() + '_' + response.migrationName;
					}
				}

				console.error(`Folder ${migrationPath} is empty. \nMigrations have not yet been detected`);
				const databaseIngot = await this._databaseContext.getCurrentDatabaseIngot({
					migrationTable: this._connectionData.migrationTable,
					migrationTableSchema: this._connectionData.migrationTableSchema
				});
				await this._databaseContext.createMigration({
					migrationName: resultMigrationName,
					databaseIngot,
					migrationTable: this._connectionData.migrationTable,
					migrationTableSchema: this._connectionData.migrationTableSchema
				});

				const exampleMigrationPath = path.resolve(migrationPath, `${resultMigrationName}.ts`);
				const exampleMigrationContent = `console.log('try')`;

				fs.writeFileSync(exampleMigrationPath, exampleMigrationContent);
				console.log(`Init migration created at ${exampleMigrationContent}`);
				return;
			}
			console.log(`The folder ${migrationPath} has migrations:`, nameOfFilesInMigrationPath);

			if (migrationName === true) {
				const response = await prompts({
					type: 'text',
					name: 'migrationName',
					message: 'Enter migration name'
				});
				resultMigrationName = Date.now() + '_' + response.migrationName;
			}

			const databaseIngot = await this._databaseContext.getCurrentDatabaseIngot({
				migrationTable: this._connectionData.migrationTable,
				migrationTableSchema: this._connectionData.migrationTableSchema
			});
			await this._databaseContext.createMigration({
				migrationName: resultMigrationName,
				databaseIngot,
				migrationTable: this._connectionData.migrationTable,
				migrationTableSchema: this._connectionData.migrationTableSchema
			});

			const exampleMigrationPath = path.resolve(migrationPath, `${resultMigrationName}.ts`);
			const exampleMigrationContent = `console.log('try 2')`;

			fs.writeFileSync(exampleMigrationPath, exampleMigrationContent);
			console.log(`Migration created at ${exampleMigrationContent}`);

		}
		//TODO створити папку міграцій якшо її не існує

		if (!isMigrationFolderExist) {
			console.error(`Folder ${migrationPath} doesn't exist.`);
			const value = await prompts([
				{
					type: 'toggle',
					name: 'addMigrationFolder',
					message: `Do you want to add migration folder?`,
					initial: true,
					active: 'yes',
					inactive: 'no'
				}
			]);
			if (value.addMigrationFolder) {
				this._createDirectoryIfNotExists(migrationPath, 'migrations');
			}
		}
	}

	private async runInit() {
		const projectRoot = process.cwd();
		const migrationPath = path.resolve(projectRoot, 'migrations');
		const entitiesPath = path.resolve(projectRoot, 'entities');

		const response = await prompts([
			{
				type: 'multiselect',
				name: 'init',
				message: 'Init questions',
				choices: [
					{ title: 'Do you want to add entities file?', value: { entity: true } },
					{ title: 'Do you want to add migration file?', value: { migration: true } }
				]
			}
		]);

		if (response.init.some((item: { migration: boolean, entity: boolean }) => item.entity)) {
			this._createDirectoryIfNotExists(entitiesPath, 'entities');
			const value = await prompts([
				{
					type: 'toggle',
					name: 'entity',
					message: 'Do you want to create example entity?',
					initial: true,
					active: 'yes',
					inactive: 'no'
				}
			]);

			if (value.entity) {
				const exampleEntityPath = path.resolve(entitiesPath, 'example.entity.ts');
				const exampleEntityContent = `import {Column, PostgresqlDataTypes, Table} from "@myroslavshymon/orm";

@Table({name: "product"})
export class Product {
    @Column({options: {dataType: PostgresqlDataTypes.DATE}})
    createdAt: Date;
}`;

				fs.writeFileSync(exampleEntityPath, exampleEntityContent);
				console.log(`Init entity created at ${exampleEntityPath}`);
			}

		}

		if (response.init.some((item: { migration: boolean, entity: boolean }) => item.migration)) {
			this._createDirectoryIfNotExists(migrationPath, 'migrations');
		}
	}

	private _createDirectoryIfNotExists(directoryPath: string, directoryName: string) {
		if (!fs.existsSync(directoryPath)) {
			fs.mkdirSync(directoryPath);
			console.log(`Created ${directoryName} folder.`);
		}
	}
}