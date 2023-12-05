#! /usr/bin/env node

import * as figlet from 'figlet';
import { Command } from 'commander';
import { CLI } from './cli';
import { DatabaseManager, DatabasesTypes, DataSourceContext } from '@myroslavshymon/orm';

const commander = new Command();

console.log(figlet.textSync('ORM CLI'));

commander
	.version('1.0.0')
	.description('ClI to work with ORM system')
	.option('-i, --init', 'Init ORM')
	.option('-mc, --migration:create [char]', 'Create migration')
	.parse(process.argv);

const dbM = new DatabaseManager({ type: DatabasesTypes.POSTGRES }, new DataSourceContext());
const aaa = dbM.tableCreator.generateCreateTableQuery(JSON.parse(`{
  "tables": [
    {
      "name": "user",
      "options": {
        "checkConstraint": [
          {
            "name": "randomName1",
            "check": "age > old_age"
          },
          {
            "name": "randomName2",
            "check": "LENGTH(name) <= LENGTH(middle_name)"
          }
        ],
        "unique": [
          "name",
          "middle_name"
        ]
      },
      "columns": [
        {
          "name": "isMail",
          "options": {
            "dataType": "BOOLEAN",
            "nullable": false
          }
        },
        {
          "name": "age",
          "options": {
            "dataType": "INTEGER",
            "nullable": false
          }
        },
        {
          "name": "old_age",
          "options": {
            "dataType": "INTEGER",
            "nullable": false
          }
        },
        {
          "name": "name",
          "options": {
            "dataType": "VARCHAR",
            "nullable": false,
            "unique": true,
            "length": 5
          }
        },
        {
          "name": "middle_name",
          "options": {
            "dataType": "VARCHAR",
            "length": 10,
            "unique": true,
            "nullsNotDistinct": true,
            "defaultValue": "",
            "nullable": true
          }
        },
        {
          "name": "height_cm",
          "options": {
            "dataType": "NUMERIC",
            "nullable": true
          }
        }
      ],
      "computedColumns": [
        {
          "name": "height_in",
          "dataType": "NUMERIC",
          "stored": true,
          "calculate": "height_cm / 2.54"
        },
        {
          "name": "height_in_2",
          "dataType": "NUMERIC",
          "stored": true,
          "calculate": "height_cm / 2.55"
        }
      ]
    },
    {
      "name": "product",
      "columns": [
        {
          "name": "createdAt",
          "options": {
            "dataType": "DATE",
            "nullable": true
          }
        }
      ]
    }
  ]
}`).tables);


const options = commander.opts();
new CLI(options);