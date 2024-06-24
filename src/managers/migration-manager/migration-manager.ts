import path from 'path';
import fs from 'fs';
import prompts from 'prompts';
import * as tsNode from 'ts-node';
import {
	ConnectionData,
	convertToCamelCase,
	createDirectoryIfNotExists,
	MigrationManagerInterface
} from '../../common';
import { DatabaseContextInterface } from '../../strategy';
import { DatabasesTypes } from '@myroslavshymon/orm';
import { CommandClass, CompressedTableIngotInterface, MigrationQueriesInterface, OperationClass } from '../common';
import { DatabaseIngotInterface, DatabaseManagerInterface } from '@myroslavshymon/orm/orm/core';
import {
	AddColumnCommand,
	AddColumnOperation,
	AddDefaultValueCommand,
	AddDefaultValueToColumnOperation,
	ChangeCheckConstraintCommand,
	ChangeCheckConstraintOfColumnOperation,
	ChangeDataTypeCommand,
	ChangeDataTypeOfColumnOperation,
	ChangeNotNullCommand,
	ChangeNotNullOfColumnOperation,
	ChangeUniqueCommand,
	ChangeUniqueValueOfColumnOperation,
	DeleteColumnCommand,
	DeleteColumnOperation,
	DeleteDefaultValueCommand,
	DeleteDefaultValueFromColumnOperation,
	MigrationCommandInterface,
	MigrationInvoker,
	OperationInterface,
	RenameColumnCommand,
	RenameOfColumnOperation
} from './columns-manager';
import { TableManager } from './tables-manager';
import { ForeignKeysManager } from './foreign-keys-manager';

export class MigrationManager implements MigrationManagerInterface {
	_projectRoot = process.cwd();
	_connectionData: ConnectionData;
	_databaseContext: DatabaseContextInterface;
	_databaseManager: DatabaseManagerInterface<DatabasesTypes>;

	constructor(
		databaseContext: DatabaseContextInterface,
		connectionData: ConnectionData,
		databaseManager: DatabaseManagerInterface<DatabasesTypes>
	) {
		this._connectionData = connectionData;
		this._databaseContext = databaseContext;
		this._databaseManager = databaseManager;
	}

	async migrationDown(migrationName: string): Promise<void> {
		await this._migrationDownOrUp(migrationName, 'down');
	}

	async migrationUp(migrationName: string): Promise<void> {
		await this._migrationDownOrUp(migrationName, 'up');
	}

	private async _migrationDownOrUp(migrationName: string, direction: 'up' | 'down'): Promise<void> {
		await this._prepareMigration();
		const filePath = path.resolve(this._projectRoot, `migrations`, migrationName);
		const migrationClassName = this._extractMigrationClassName(migrationName);

		await this._runMigration(filePath, migrationClassName, direction);
		await this._updateMigrationStatus(migrationName, direction === 'up');
	}

	async migrate(migrationName: string) {
		await this._prepareMigration();
		const migrationPath = path.resolve(this._projectRoot, `migrations`);
		const migrationFiles = fs.readdirSync(migrationPath).filter(file => file.endsWith('.migration.ts'));

		// for (const file of migrationFiles) {
		// 	const filePath = path.join(migrationPath, file);
		// 	const migrationClassName = this._extractMigrationClassName(migrationName);
		//
		// 	await this._runMigration(filePath, migrationClassName);
		// 	await this._updateMigrationStatus(migrationName, true);
		// }
	}

	private async _prepareMigration(): Promise<void> {
		await this._databaseManager.connectDatabase();
		await this._databaseContext.connect(this._connectionData);
	}

	private _extractMigrationClassName(migrationName: string): string {
		return convertToCamelCase(
			migrationName
				.split('_')
				.slice(1)
				.join('')
				.split('.migration.ts')[0]
		);
	}

	private async _runMigration(filePath: string, migrationClassName: string, direction: 'up' | 'down') {
		tsNode.register();
		const module = require(filePath);
		const MigrationClass = module[migrationClassName];

		const migrationClass = new MigrationClass();

		if (direction === 'up') {
			await migrationClass.up(this._databaseManager);
		} else if (direction === 'down') {
			await migrationClass.down(this._databaseManager);
		} else {
			throw new Error(`Invalid migration direction: ${direction}. Must be 'up' or 'down'.`);
		}
	}

	private async _updateMigrationStatus(migrationName: string, isUp: boolean): Promise<void> {
		await this._databaseContext.updateMigrationStatus({
			migrationTable: this._connectionData.migrationTable,
			migrationTableSchema: this._connectionData.migrationTableSchema,
			migrationName: migrationName.split('.migration.ts')[0],
			isUp
		});
	}

	/////////Create migration/////////

	async createMigration(migrationName: string | boolean): Promise<void> {
		const migrationPath = path.resolve(this._projectRoot, 'migrations');

		await this._handleMigrationFolderCreation(migrationPath);

		const isMigrationsExist = fs.readdirSync(migrationPath).length !== 0;

		migrationName = await this._generateMigrationName(migrationName, isMigrationsExist);

		await this._handleMigrationCreation(migrationPath, migrationName, isMigrationsExist);
	}

	private async _handleMigrationFolderCreation(migrationPath: string) {
		const isMigrationFolderExist = fs.existsSync(migrationPath);
		await this._databaseContext.connect(this._connectionData);

		if (!isMigrationFolderExist) {
			console.error(`Folder ${migrationPath} doesn't exist.`);
			await this._promptToAddMigrationFolder(migrationPath);
			return;
		}
	}

	private async _promptToAddMigrationFolder(migrationPath: string) {
		let addMigrationFolder = true;

		while (addMigrationFolder) {
			const userInput = await prompts([
				{
					type: 'toggle',
					name: 'addMigrationFolder',
					message: 'Do you want to add a migration folder?',
					initial: true,
					active: 'yes',
					inactive: 'no'
				}
			]);

			if (userInput.addMigrationFolder) {
				createDirectoryIfNotExists(migrationPath, 'migrations');
				addMigrationFolder = false; // Exit the loop if the user agrees
			} else {
				console.log('A migration folder is required for migrations. Please agree to create one.');
			}
		}
	}

	private async _generateMigrationName(
		migrationName: string | boolean,
		isMigrationsExist: boolean
	): Promise<string> {
		//migrationName === true --- means that there is no name in the migration
		if (!isMigrationsExist && migrationName === true) {
			const userInput = await prompts([
				{
					type: 'toggle',
					name: 'migrationName',
					message: `Do you want to name initial migration 'init'?`,
					initial: true,
					active: 'yes',
					inactive: 'no'
				}
			]);
			return userInput.migrationName ? (Date.now() + '_' + 'init') : await this._promptMigrationName();
		}
		if (typeof migrationName === 'string') {
			const migrationsByName = await this._databaseContext.getMigrationByName({
				migrationName: migrationName,
				migrationTableSchema: this._connectionData.migrationTableSchema,
				migrationTable: this._connectionData.migrationTable
			});
			if (migrationsByName.length) {
				throw Error(`Migrations with name '${migrationName}' already exist`);
			}
		}
		return migrationName === true ? await this._promptMigrationName() : (Date.now() + '_' + (migrationName as string));
	}

	private async _promptMigrationName(): Promise<string> {
		const userInput = await prompts({
			type: 'text',
			name: 'migrationName',
			message: 'Enter migration name'
		});
		if (userInput.migrationName === undefined || userInput.migrationName === '') {
			throw new Error('You specified an incorrect migration name');
		}
		return Date.now() + '_' + userInput.migrationName;
	}

	private async _handleMigrationCreation(
		migrationPath: string,
		migrationName: string,
		isMigrationsExist: boolean
	) {
		await this._databaseContext.checkTableExistence({
			tableName: this._connectionData.migrationTable,
			schema: this._connectionData.migrationTableSchema
		});
		let currentDatabaseIngot: DatabaseIngotInterface = await this._databaseContext.getCurrentDatabaseIngot({
			migrationTable: this._connectionData.migrationTable,
			migrationTableSchema: this._connectionData.migrationTableSchema
		});

		const lastDatabaseIngot: DatabaseIngotInterface = await this._databaseContext.getLastDatabaseIngot({
			migrationTable: this._connectionData.migrationTable,
			migrationTableSchema: this._connectionData.migrationTableSchema
		});

		const migrationQueries = await this._createMigrationQuery(currentDatabaseIngot, lastDatabaseIngot, isMigrationsExist);
		this._createMigrationFile(migrationPath, migrationName, migrationQueries.migrationQuery, migrationQueries.undoMigrationQuery);

		await this._databaseContext.createMigration({
			migrationName,
			databaseIngot: currentDatabaseIngot,
			migrationTable: this._connectionData.migrationTable,
			migrationTableSchema: this._connectionData.migrationTableSchema
		});
		console.log(`Migration created at ${migrationPath}`);
		return;
	}


	//TODO не заюуваємо шо в нас ще будуть трігери процедури і так далі
	private async _createMigrationQuery(
		currentDatabaseIngot: DatabaseIngotInterface,
		lastDatabaseIngot: DatabaseIngotInterface,
		isMigrationsExist: boolean
	): Promise<MigrationQueriesInterface> {
		let migrationQuery = '';
		let undoMigrationQuery = '';
		if (!isMigrationsExist) {
			migrationQuery += this._databaseManager.tableCreator.generateCreateTableQuery(currentDatabaseIngot.tables);

			for (const table of currentDatabaseIngot.tables) {
				undoMigrationQuery += await this._databaseManager.tableManipulation
					.alterTable(table.name, true)
					.dropTable({ type: 'CASCADE' }) + '\n\t\t\t\t';
			}

			return { migrationQuery, undoMigrationQuery };
		}

		const currentCompressedTables: CompressedTableIngotInterface[] = currentDatabaseIngot.tables.map(table => ({
			id: table?.id,
			name: table.name,
			columns: table.columns,
			computedColumns: table.computedColumns
		}));

		const lastCompressedTables: CompressedTableIngotInterface[] = lastDatabaseIngot.tables.map(table => ({
			id: table?.id,
			name: table.name,
			columns: table.columns,
			computedColumns: table.computedColumns
		}));

		const invoker = new MigrationInvoker();

		const executeOperation = async <O extends OperationInterface, C extends MigrationCommandInterface>
		(operationClass: OperationClass<O>, commandClass: CommandClass<O, C>) => {
			const operation = new operationClass(this._databaseManager, currentCompressedTables, lastCompressedTables);
			const command = new commandClass(operation);
			migrationQuery += await invoker.executeCommand(command);
			undoMigrationQuery += await invoker.undoCommand();
		};

		await executeOperation<AddColumnOperation, AddColumnCommand>(AddColumnOperation, AddColumnCommand);
		await executeOperation<DeleteColumnOperation, DeleteColumnCommand>(DeleteColumnOperation, DeleteColumnCommand);
		await executeOperation<AddDefaultValueToColumnOperation, AddDefaultValueCommand>(AddDefaultValueToColumnOperation, AddDefaultValueCommand);
		await executeOperation<DeleteDefaultValueFromColumnOperation, DeleteDefaultValueCommand>(DeleteDefaultValueFromColumnOperation, DeleteDefaultValueCommand);
		await executeOperation<ChangeDataTypeOfColumnOperation, ChangeDataTypeCommand>(ChangeDataTypeOfColumnOperation, ChangeDataTypeCommand);
		await executeOperation<ChangeNotNullOfColumnOperation, ChangeNotNullCommand>(ChangeNotNullOfColumnOperation, ChangeNotNullCommand);
		await executeOperation<ChangeUniqueValueOfColumnOperation, ChangeUniqueCommand>(ChangeUniqueValueOfColumnOperation, ChangeUniqueCommand);
		await executeOperation<ChangeCheckConstraintOfColumnOperation, ChangeCheckConstraintCommand>(ChangeCheckConstraintOfColumnOperation, ChangeCheckConstraintCommand);
		await executeOperation<RenameOfColumnOperation, RenameColumnCommand>(RenameOfColumnOperation, RenameColumnCommand);

		const [foreignKeysMigrationQuery, foreignKeysUndoMigrationQuery] = await ForeignKeysManager.manage(currentDatabaseIngot, lastDatabaseIngot, this._databaseManager);
		migrationQuery += foreignKeysMigrationQuery;
		undoMigrationQuery += foreignKeysUndoMigrationQuery;

		const [tableMigrationQuery, tableUndoMigrationQuery] = await TableManager.manage(currentDatabaseIngot, lastDatabaseIngot, this._databaseManager);
		migrationQuery += tableMigrationQuery;
		undoMigrationQuery += tableUndoMigrationQuery;

		if (!migrationQuery || !undoMigrationQuery) {
			console.error('There is no changes to make migration.\n Please restart your app!');
			throw new Error('There is no changes to make migration.\n Please restart your app!');
		}

		return { migrationQuery, undoMigrationQuery };
	}

	private _createMigrationFile(migrationPath: string, migrationName: string, migrationQuery: string, undoMigrationQuery: string) {
		migrationPath = path.resolve(migrationPath, `${migrationName}.migration.ts`);
		migrationName = convertToCamelCase(migrationName.split('_').slice(1).join(''));

		const migrationContent = `import {DatabaseManagerInterface, MigrationInterface} from "@myroslavshymon/orm/orm/core";
import {DatabasesTypes} from "@myroslavshymon/orm";

export class ${migrationName} implements MigrationInterface {
    async up(databaseManager: DatabaseManagerInterface<DatabasesTypes.POSTGRES>): Promise<void> {
        await databaseManager.query(
            \`${migrationQuery}\`
        );
    }

   async down(databaseManager: DatabaseManagerInterface<DatabasesTypes.POSTGRES>): Promise<void> {
       await databaseManager.query(
             \`${undoMigrationQuery}\`
       );
    }
}`;
		fs.writeFileSync(migrationPath, migrationContent);
	}
}