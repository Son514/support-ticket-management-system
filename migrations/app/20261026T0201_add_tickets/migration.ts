#!/usr/bin/env -S node
import type { Contract as Start } from '../../snapshots/6351acfe1cb30ef43cea72d122daa75da9f16bc6077171fbf7489ecf9c562de9/contract';
import startContract from '../../snapshots/6351acfe1cb30ef43cea72d122daa75da9f16bc6077171fbf7489ecf9c562de9/contract.json' with { type: 'json' };
import type { Contract as End } from '../../snapshots/bb30061b6c226146c166118d96df880cbfa294cc4e3800642cdf1939be6cbddf/contract';
import endContract from '../../snapshots/bb30061b6c226146c166118d96df880cbfa294cc4e3800642cdf1939be6cbddf/contract.json' with { type: 'json' };
import {
  Migration,
  MigrationCLI,
  checkExpression,
  col,
  lit,
  primaryKey,
  sql,
} from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.createTable({
        schema: 'public',
        table: 'Ticket',
        columns: [
          col('accountId', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('category', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('createdAt', 'timestamptz', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('description', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('id', 'SERIAL', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('priority', 'text', {
            notNull: true,
            default: lit('medium'),
            codecRef: { codecId: 'pg/text@1' },
          }),
          col('status', 'text', {
            notNull: true,
            default: lit('open'),
            codecRef: { codecId: 'pg/text@1' },
          }),
          col('title', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('updatedAt', 'timestamptz', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
        ],
        constraints: [
          primaryKey(['id']),
          checkExpression(
            'Ticket_category_check_3ad1320d',
            sql`"category" IN ('technical', 'billing', 'account', 'general')`,
          ),
          checkExpression(
            'Ticket_priority_check_4fb75310',
            sql`"priority" IN ('low', 'medium', 'high', 'urgent')`,
          ),
          checkExpression(
            'Ticket_status_check_0e50b8c8',
            sql`"status" IN ('open', 'in_progress', 'resolved', 'closed')`,
          ),
        ],
      }),
      this.createTable({
        schema: 'public',
        table: 'TicketAttachment',
        columns: [
          col('contentType', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('data', 'bytea', { notNull: true, codecRef: { codecId: 'pg/bytea@1' } }),
          col('fileName', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('id', 'SERIAL', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('size', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('ticketId', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.addUnique({
        schema: 'public',
        table: 'TicketAttachment',
        constraint: 'TicketAttachment_ticketId_key',
        columns: ['ticketId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'Ticket',
        index: 'Ticket_accountId_idx_cbfb3085',
        columns: ['accountId'],
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'Ticket',
        foreignKey: {
          name: 'Ticket_accountId_fkey',
          columns: ['accountId'],
          references: { schema: 'public', table: 'Account', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'TicketAttachment',
        foreignKey: {
          name: 'TicketAttachment_ticketId_fkey',
          columns: ['ticketId'],
          references: { schema: 'public', table: 'Ticket', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
