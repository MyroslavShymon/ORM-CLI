import * as fs from 'fs';
import * as path from 'path';
const prompts = require('prompts');
import { OptionValues } from "commander";

export class CLI {
    private options: OptionValues;

    constructor(options: OptionValues) {
        this.options = options;
        if (this.options.init) {
            this.runInit();
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
                    { title: 'Do you want to add entities file?', value: {entity: true} },
                    { title: 'Do you want to add migration file?', value: {migration: true} },
                ],
            }
        ]);

        if (response.init.some((item: {migration: boolean, entity: boolean}) => item.entity)) {
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
                const exampleEntityContent =  `import {Column, PostgresqlDataTypes, Table} from "@myroslavshymon/orm";

@Table({name: "product"})
export class Product {
    @Column({options: {dataType: PostgresqlDataTypes.DATE}})
    createdAt: Date;
}`

                fs.writeFileSync(exampleEntityPath, exampleEntityContent);
                console.log(`Init entity created at ${exampleEntityPath}`);
            }

        }

        if (response.init.some((item: {migration: boolean, entity: boolean}) => item.migration)) {
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