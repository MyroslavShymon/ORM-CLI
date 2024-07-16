import path from 'path';
import fs from 'fs';
import prompts from 'prompts';
import * as tsNode from 'ts-node';
import {
	ConnectionData,
	convertToCamelCase,
	createDirectoryIfNotExists,
	MigrationManagerInterface,
	MigrationsType
} from '../../common';
import { DatabaseContextInterface } from '../../strategy';
import { DatabasesTypes } from '@myroslavshymon/orm';
import { CommandClass, CompressedTableIngotInterface, MigrationQueriesInterface, OperationClass } from '../common';
import { DatabaseIngotInterface, DatabaseManagerInterface, DropTableInterface } from '@myroslavshymon/orm/orm/core';
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

export class MigrationManager<DT extends DatabasesTypes> implements MigrationManagerInterface {
	_projectRoot = process.cwd();
	_connectionData: ConnectionData;
	_databaseContext: DatabaseContextInterface<DT>;
	_databaseManager: DatabaseManagerInterface<DT>;
	_databaseType: DatabasesTypes;

	constructor(
		databaseContext: DatabaseContextInterface<DT>,
		connectionData: ConnectionData,
		databaseManager: DatabaseManagerInterface<DT>,
		databaseType: DatabasesTypes
	) {
		this._connectionData = connectionData;
		this._databaseContext = databaseContext;
		this._databaseType = databaseType;
		this._databaseManager = databaseManager;
	}

	async migrationDown(migrationName: string): Promise<void> {
		await this._migrateDownOrUp(migrationName, 'down');
	}

	async migrationUp(migrationName: string): Promise<void> {
		await this._migrateDownOrUp(migrationName, 'up');
	}

	async migrate(direction: MigrationsType): Promise<void> {
		const migrationPath = path.resolve(this._projectRoot, `migrations`);
		const migrationFiles = fs.readdirSync(migrationPath).filter(file => file.endsWith('.migration.ts'));

		for (const migrationName of migrationFiles) {
			await this._migrateDownOrUp(migrationName, direction);
		}
	}

	private async _migrateDownOrUp(migrationName: string, direction: MigrationsType): Promise<void> {
		await this._prepareMigration();
		const filePath = path.resolve(this._projectRoot, `migrations`, migrationName);
		const migrationClassName = this._extractMigrationClassName(migrationName);

		const migration = await this._databaseContext.getMigrationByName({
			migrationName: migrationName.split('.migration.ts')[0],
			migrationTable: this._connectionData.migrationTable,
			migrationTableSchema: this._connectionData.migrationTableSchema
		});

		if (migration[0].is_up && direction === 'up') {
			console.error('Migration is already upped');
			return;
		}

		if (!migration[0].is_up && direction === 'down') {
			console.error('Migration is already downed');
			return;
		}

		if (
			(!migration[0].is_up && direction === 'up') ||
			(migration[0].is_up && direction === 'down')
		) {
			await this._runMigration(filePath, migrationClassName, direction);
			await this._updateMigrationStatus(migrationName, direction === 'up');
		}
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

	private async _runMigration(filePath: string, migrationClassName: string, direction: MigrationsType) {
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
		let currentDatabaseIngot: DatabaseIngotInterface<DT> = await this._databaseContext.getCurrentDatabaseIngot({
			migrationTable: this._connectionData.migrationTable,
			migrationTableSchema: this._connectionData.migrationTableSchema
		});

		const lastDatabaseIngot: DatabaseIngotInterface<DT> = await this._databaseContext.getLastDatabaseIngot({
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

	//TODO не забуваємо шо в нас ще будуть трігери процедури і так далі
	private async _createMigrationQuery(
		currentDatabaseIngot: DatabaseIngotInterface<DT>,
		lastDatabaseIngot: DatabaseIngotInterface<DT>,
		isMigrationsExist: boolean
	): Promise<MigrationQueriesInterface> {
		let migrationQuery = '';
		let undoMigrationQuery = '';
		if (!isMigrationsExist) {
			migrationQuery += this._databaseManager.tableCreator.generateCreateTableQuery(currentDatabaseIngot.tables);

			for (const table of currentDatabaseIngot.tables) {
				let dropTableOptions: DropTableInterface<DT>;

				if (this._databaseType === DatabasesTypes.POSTGRES) {
					dropTableOptions = { type: 'CASCADE' } as DropTableInterface<DT>;
				} else if (this._databaseType === DatabasesTypes.MYSQL) {
					dropTableOptions = {} as DropTableInterface<DT>;
				} else {
					throw new Error(`Unsupported database type: ${this._databaseType}`);
				}

				undoMigrationQuery += await this._databaseManager.tableManipulation
					.alterTable(table.name, true)
					.dropTable(dropTableOptions) + '\n\t\t\t\t';
			}
			return { migrationQuery, undoMigrationQuery };
		}

		const currentCompressedTables: CompressedTableIngotInterface<DT>[] = currentDatabaseIngot.tables.map(table => ({
			id: table?.id,
			name: table.name,
			columns: table.columns,
			computedColumns: table.computedColumns
		}));

		const lastCompressedTables: CompressedTableIngotInterface<DT>[] = lastDatabaseIngot.tables.map(table => ({
			id: table?.id,
			name: table.name,
			columns: table.columns,
			computedColumns: table.computedColumns
		}));

		const invoker = new MigrationInvoker();

		const executeOperation = async <O extends OperationInterface, C extends MigrationCommandInterface>
		(operationClass: OperationClass<O, DT>, commandClass: CommandClass<O, C>) => {
			const operation = new operationClass(this._databaseManager, currentCompressedTables, lastCompressedTables);
			const command = new commandClass(operation);
			migrationQuery += await invoker.executeCommand(command);
			undoMigrationQuery += await invoker.undoCommand();
		};

		await executeOperation<AddColumnOperation<DT>, AddColumnCommand<DT>>(AddColumnOperation, AddColumnCommand);
		await executeOperation<DeleteColumnOperation<DT>, DeleteColumnCommand<DT>>(DeleteColumnOperation, DeleteColumnCommand);
		await executeOperation<AddDefaultValueToColumnOperation<DT>, AddDefaultValueCommand<DT>>(AddDefaultValueToColumnOperation, AddDefaultValueCommand);
		await executeOperation<DeleteDefaultValueFromColumnOperation<DT>, DeleteDefaultValueCommand<DT>>(DeleteDefaultValueFromColumnOperation, DeleteDefaultValueCommand);
		await executeOperation<ChangeDataTypeOfColumnOperation<DT>, ChangeDataTypeCommand<DT>>(ChangeDataTypeOfColumnOperation, ChangeDataTypeCommand);
		await executeOperation<ChangeNotNullOfColumnOperation<DT>, ChangeNotNullCommand<DT>>(ChangeNotNullOfColumnOperation, ChangeNotNullCommand);
		await executeOperation<ChangeUniqueValueOfColumnOperation<DT>, ChangeUniqueCommand<DT>>(ChangeUniqueValueOfColumnOperation, ChangeUniqueCommand);
		await executeOperation<ChangeCheckConstraintOfColumnOperation<DT>, ChangeCheckConstraintCommand<DT>>(ChangeCheckConstraintOfColumnOperation, ChangeCheckConstraintCommand);
		await executeOperation<RenameOfColumnOperation<DT>, RenameColumnCommand<DT>>(RenameOfColumnOperation, RenameColumnCommand);

		const [foreignKeysMigrationQuery, foreignKeysUndoMigrationQuery] = await ForeignKeysManager.manage<DT>(currentDatabaseIngot, lastDatabaseIngot, this._databaseManager, this._databaseType);
		migrationQuery += foreignKeysMigrationQuery;
		undoMigrationQuery += foreignKeysUndoMigrationQuery;

		const [tableMigrationQuery, tableUndoMigrationQuery] = await TableManager.manage<DT>(currentDatabaseIngot, lastDatabaseIngot, this._databaseManager, this._databaseType);
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
    async up(databaseManager: DatabaseManagerInterface<${this._databaseType === DatabasesTypes.POSTGRES ? 'DatabasesTypes.POSTGRES' : 'DatabasesTypes.MYSQL'}>): Promise<void> {
        await databaseManager.query(
            \`${migrationQuery}\`
        );
    }

   async down(databaseManager: DatabaseManagerInterface<${this._databaseType === DatabasesTypes.POSTGRES ? 'DatabasesTypes.POSTGRES' : 'DatabasesTypes.MYSQL'}>): Promise<void> {
       await databaseManager.query(
             \`${undoMigrationQuery}\`
       );
    }
}`;
		fs.writeFileSync(migrationPath, migrationContent);
	}
}