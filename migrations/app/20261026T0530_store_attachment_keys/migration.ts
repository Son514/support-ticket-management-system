#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/335d3b42cc48793d5bc93b197da202fac90803f384ec5713896cb25277bef987/contract';
import endContract from '../../snapshots/335d3b42cc48793d5bc93b197da202fac90803f384ec5713896cb25277bef987/contract.json' with { type: 'json' };
import type { Contract as Start } from '../../snapshots/338309c95dedc5ac73090773a50a5d74cdd5d1455627ec9f515708a7dd55b454/contract';
import startContract from '../../snapshots/338309c95dedc5ac73090773a50a5d74cdd5d1455627ec9f515708a7dd55b454/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, rawSql } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      rawSql({
        id: 'data.clear-ticket-attachments',
        label: 'Delete existing ticket attachments',
        summary: 'Deletes bytea attachment rows before switching to object storage',
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
      this.dropColumn({ schema: 'public', table: 'TicketAttachment', column: 'data' }),
      this.addRequiredColumnToEmptyTable({
        schema: 'public',
        table: 'TicketAttachment',
        column: 'storageKey',
        type: 'text',
      }),
      this.addUnique({
        schema: 'public',
        table: 'TicketAttachment',
        constraint: 'TicketAttachment_storageKey_key',
        columns: ['storageKey'],
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
