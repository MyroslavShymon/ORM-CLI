import path from 'path';
import fs from 'fs';
import prompts from 'prompts';
import { createDirectoryIfNotExists, InitManagerInterface } from '../common';


export class InitManager implements InitManagerInterface {
	constructor() {
	}

	async runInit(): Promise<void> {
		const projectRoot = process.cwd();
		const migrationPath = path.resolve(projectRoot, 'migrations');
		const entitiesPath = path.resolve(projectRoot, 'entities');

		const userInput = await this._promptInitQuestions();

		await this._handleEntityInit(userInput, entitiesPath);
		this._handleMigrationInit(userInput, migrationPath);
	}

	private async _promptInitQuestions() {
		return prompts([
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
	}

	private async _handleEntityInit(response: any, entitiesPath: string) {
		if (response.init.some((item: { entity: boolean }) => item.entity)) {
			createDirectoryIfNotExists(entitiesPath, 'entities');
			await this._createExampleEntity(entitiesPath);
		}
	}

	private async _createExampleEntity(entitiesPath: string) {
		const userInput = await prompts([
			{
				type: 'toggle',
				name: 'entity',
				message: 'Do you want to create an example entity?',
				initial: true,
				active: 'yes',
				inactive: 'no'
			}
		]);

		if (userInput.entity) {
			const exampleEntityPath = path.resolve(entitiesPath, 'example.entity.ts');
			const exampleEntityContent = this._generateExampleEntityContent();

			fs.writeFileSync(exampleEntityPath, exampleEntityContent);
			console.log(`Init entity created at ${exampleEntityPath}`);
		}
	}

	private _generateExampleEntityContent() {
		return `import {Column, PostgresqlDataTypes, Table} from "@myroslavshymon/orm";

@Table({name: "product"})
export class Product {
    @Column({options: {dataType: PostgresqlDataTypes.DATE}})
    createdAt: Date;
}`;
	}

	private _handleMigrationInit(response: any, migrationPath: string) {
		if (response.init.some((item: { migration: boolean }) => item.migration)) {
			createDirectoryIfNotExists(migrationPath, 'migrations');
		}
	}
}