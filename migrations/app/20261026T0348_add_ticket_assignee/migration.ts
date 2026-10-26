#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/338309c95dedc5ac73090773a50a5d74cdd5d1455627ec9f515708a7dd55b454/contract';
import endContract from '../../snapshots/338309c95dedc5ac73090773a50a5d74cdd5d1455627ec9f515708a7dd55b454/contract.json' with { type: 'json' };
import type { Contract as Start } from '../../snapshots/8a0f74415d3d1a13b66cf050efa34fc6acb10ac852eb6b3c8111be0d5f1f4308/contract';
import startContract from '../../snapshots/8a0f74415d3d1a13b66cf050efa34fc6acb10ac852eb6b3c8111be0d5f1f4308/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.addColumn({
        schema: 'public',
        table: 'Ticket',
        column: col('assigneeId', 'int4', { codecRef: { codecId: 'pg/int4@1' } }),
      }),
      this.createIndex({
        schema: 'public',
        table: 'Ticket',
        index: 'Ticket_assigneeId_idx_fd12ae38',
        columns: ['assigneeId'],
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'Ticket',
        foreignKey: {
          name: 'Ticket_assigneeId_fkey',
          columns: ['assigneeId'],
          references: { schema: 'public', table: 'Account', columns: ['id'] },
          onDelete: 'setNull',
        },
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
