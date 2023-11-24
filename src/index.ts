#! /usr/bin/env node

import {Command} from "commander";
import * as figlet from "figlet"
import {CLI} from "./cli";

const commander = new Command();

console.log(figlet.textSync("ORM CLI"));

commander
    .version("1.0.0")
    .description("ClI to work with ORM system")
    .option('-i, --init', 'Init ORM')
    .parse(process.argv);

const options = commander.opts();

const cli = new CLI(options);