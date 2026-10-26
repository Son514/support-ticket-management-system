#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/8a0f74415d3d1a13b66cf050efa34fc6acb10ac852eb6b3c8111be0d5f1f4308/contract';
import endContract from '../../snapshots/8a0f74415d3d1a13b66cf050efa34fc6acb10ac852eb6b3c8111be0d5f1f4308/contract.json' with { type: 'json' };
import type { Contract as Start } from '../../snapshots/bb30061b6c226146c166118d96df880cbfa294cc4e3800642cdf1939be6cbddf/contract';
import startContract from '../../snapshots/bb30061b6c226146c166118d96df880cbfa294cc4e3800642cdf1939be6cbddf/contract.json' with { type: 'json' };
import { Migration, MigrationCLI } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.dropConstraint({
        schema: 'public',
        table: 'TicketAttachment',
        constraint: 'TicketAttachment_ticketId_key',
      }),
      this.createIndex({
        schema: 'public',
        table: 'TicketAttachment',
        index: 'TicketAttachment_ticketId_idx_2fe526c3',
        columns: ['ticketId'],
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
