#! /usr/bin/env node

import * as figlet from 'figlet';
import { Command } from 'commander';
import { CLI } from './cli';
import { DatabasesTypes } from '@myroslavshymon/orm';

const commander = new Command();

console.log(figlet.textSync('ORM CLI'));

commander
	.version('1.0.0')
	.description('ClI to work with ORM system')
	.option('-i, --init', 'Init ORM')
	.option('-mc, --migration:create [char]', 'Create migration')
	.option('-em, --empty', 'Empty migration')
	.option('-mup, --migration:up <char>', 'Migration up')
	.option('-mud, --migration:down <char>', 'Migration down')
	.option('-mu, --migrate:up', 'All migrations up')
	.option('-md, --migrate:down', 'All migrations down')
	.parse(process.argv);

const options = commander.opts();

const databaseType = process.env.DB_TYPE === DatabasesTypes.MYSQL
	? DatabasesTypes.MYSQL
	: DatabasesTypes.POSTGRES;

switch (databaseType) {
	case DatabasesTypes.MYSQL:
		new CLI<DatabasesTypes.MYSQL>(options);
		break;
	case DatabasesTypes.POSTGRES:
		new CLI<DatabasesTypes.POSTGRES>(options);
		break;
	default:
		new CLI<DatabasesTypes.POSTGRES>(options);
}
