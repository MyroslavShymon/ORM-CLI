import {
	AddMigrationInterface,
	CheckTableExistenceInterface,
	ConnectionData,
	GetMigrationByNameInterface,
	GetMigrationTableInterface,
	UpdateMigrationIngotInterface,
	UpdateMigrationStatusInterface
} from '../common';
import { DatabaseContextInterface, DatabaseStrategy } from './interfaces';
import { DatabasesTypes } from '@myroslavshymon/orm';
import { DatabaseIngotInterface } from '@myroslavshymon/orm/dist/orm/core';

export class DatabaseContext<DT extends DatabasesTypes> implements DatabaseContextInterface<DT> {
	private databaseStrategy: DatabaseStrategy<DT>;

	constructor(strategy: DatabaseStrategy<DT>) {
		this.databaseStrategy = strategy;
	}

	async connect(dataToConnect: ConnectionData): Promise<void> {
		try {
			await this.databaseStrategy.connect(dataToConnect);
		} catch (error) {
			console.log(`Database connection error`);
			throw error;
		}
	}

	async createMigration(options: AddMigrationInterface<DT>): Promise<void> {
		try {
			await this.databaseStrategy.createMigration(options);
		} catch (error) {
			console.log(`Error while adding migration`);
			throw error;
		}
	}

	async getCurrentDatabaseIngot(options: GetMigrationTableInterface): Promise<DatabaseIngotInterface<DT>> {
		try {
			return this.databaseStrategy.getCurrentDatabaseIngot(options);
		} catch (error) {
			console.log(`Error while getting current database ingot`);
			throw error;
		}
	}

	async getLastDatabaseIngot(options: GetMigrationTableInterface): Promise<DatabaseIngotInterface<DT>> {
		try {
			return this.databaseStrategy.getLastDatabaseIngot(options);
		} catch (error) {
			console.log(`Error while getting last database ingot`);
			throw error;
		}
	}

	async updateMigrationStatus(options: UpdateMigrationStatusInterface): Promise<void> {
		try {
			return this.databaseStrategy.updateMigrationStatus(options);
		} catch (error) {
			console.log(`Error when changing migration status`);
			throw error;
		}
	}

	async updateMigrationIngot(options: UpdateMigrationIngotInterface<DT>): Promise<void> {
		try {
			return this.databaseStrategy.updateMigrationIngot(options);
		} catch (error) {
			console.log(`Error when changing migration ingot`);
			throw error;
		}
	}

	checkTableExistence(options: CheckTableExistenceInterface): Promise<void> {
		try {
			return this.databaseStrategy.checkTableExistence(options);
		} catch (error) {
			console.log(`Error when checking table existence`);
			throw error;
		}
	}

	getMigrationByName(options: GetMigrationByNameInterface): Promise<{ name: string, is_up: boolean }[]> {
		try {
			return this.databaseStrategy.getMigrationByName(options);
		} catch (error) {
			console.log(`Error when getting migration by name`);
			throw error;
		}
	}

	async query(sql: string): Promise<any> {
		try {
			return this.databaseStrategy.query(sql);
		} catch (error) {
			console.log(`An error occurred when querying the database`);
			throw error;
		}
	}
}
