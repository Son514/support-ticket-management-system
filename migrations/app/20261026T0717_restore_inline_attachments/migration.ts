#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/3359a2bc9f5811fc614f04dc9c2f00e3041ad840fb4ebd4fc427333669b97ce3/contract';
import endContract from '../../snapshots/3359a2bc9f5811fc614f04dc9c2f00e3041ad840fb4ebd4fc427333669b97ce3/contract.json' with { type: 'json' };
import type { Contract as Start } from '../../snapshots/335d3b42cc48793d5bc93b197da202fac90803f384ec5713896cb25277bef987/contract';
import startContract from '../../snapshots/335d3b42cc48793d5bc93b197da202fac90803f384ec5713896cb25277bef987/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, rawSql, sql } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      rawSql({
        id: 'data.clear-ticket-attachments',
        label: 'Delete object-storage ticket attachments',
        summary: 'Deletes attachment rows before restoring the inline data column',
        operationClass: 'destructive',
        target: {
          id: 'postgres',
          details: {
            schema: 'public',
            objectType: 'table',
            name: 'TicketAttachment',
          },
        },
        precheck: [],
        execute: [
          {
            description: 'delete ticket attachment rows',
            sql: 'DELETE FROM "public"."TicketAttachment"',
          },
        ],
        postcheck: [],
      }),
      this.dropNotNull({ schema: 'public', table: 'TicketAttachment', column: 'storageKey' }),
      this.addColumnWithTemporaryDefault({
        schema: 'public',
        table: 'TicketAttachment',
        column: 'data',
        type: 'bytea',
        temporaryDefault: sql`''::bytea`,
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
