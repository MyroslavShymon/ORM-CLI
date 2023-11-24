import * as fs from 'fs';
import * as path from 'path';
import { OptionValues } from "commander";

export class CLI {
    private options: OptionValues;

    constructor(options: OptionValues) {
        this.options = options;
        if (this.options.init) {
            this.runInit();
        }
    }

    private runInit() {
        const projectRoot = process.cwd();
        const migrationPath = path.resolve(projectRoot, 'migration');
        const entitiesPath = path.resolve(projectRoot, 'entities');

        console.log("projectRoot", projectRoot);

        this.createDirectoryIfNotExists(migrationPath, 'migration');
        this.createDirectoryIfNotExists(entitiesPath, 'entities');

        const exampleEntityPath = path.resolve(entitiesPath, 'example.entity.ts');
        const exampleEntityContent = `
            import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

            @Entity()
            export class InitEntity {
                @PrimaryGeneratedColumn()
                id: number;

                @Column()
                name: string;
            }
        `;

        fs.writeFileSync(exampleEntityPath, exampleEntityContent);
        console.log(`Init entity created at ${exampleEntityPath}`);

        // Add code to read migration and entity files and perform actions for each of them
        console.log('Reading migration files...');
        console.log('Reading entity files...');
    }

    private createDirectoryIfNotExists(directoryPath: string, directoryName: string) {
        if (!fs.existsSync(directoryPath)) {
            fs.mkdirSync(directoryPath);
            console.log(`Created ${directoryName} folder.`);
        }
    }
}