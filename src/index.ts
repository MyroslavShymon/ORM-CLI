#! /usr/bin/env node

import * as figlet from 'figlet';
import { Command } from 'commander';
import { CLI } from './cli';

const commander = new Command();

console.log(figlet.textSync('ORM CLI'));

commander
	.version('1.0.0')
	.description('ClI to work with ORM system')
	.option('-i, --init', 'Init ORM')
	.option('-mc, --migration:create [char]', 'Create migration')
	.parse(process.argv);

const options = commander.opts();
new CLI(options);