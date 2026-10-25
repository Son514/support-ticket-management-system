#!/usr/bin/env -S node
import type { Contract as Start } from '../../snapshots/9be67c50f3374bd58b611dfff69b72e62b4d24a68011131e84989dd0d1bfc9d8/contract';
import startContract from '../../snapshots/9be67c50f3374bd58b611dfff69b72e62b4d24a68011131e84989dd0d1bfc9d8/contract.json' with { type: 'json' };
import type { Contract as End } from '../../snapshots/a86d2fa17f5164d8ef45e30607b367ba213ceeee161ef9a716cb91f9b6e087c2/contract';
import endContract from '../../snapshots/a86d2fa17f5164d8ef45e30607b367ba213ceeee161ef9a716cb91f9b6e087c2/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col, lit, sql } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.addColumn({
        schema: 'public',
        table: 'Account',
        column: col('role', 'text', {
          notNull: true,
          default: lit('customer'),
          codecRef: { codecId: 'pg/text@1' },
        }),
      }),
      this.addCheckConstraint({
        schema: 'public',
        table: 'Account',
        constraint: 'Account_role_check_7e859979',
        expression: sql`"role" IN ('customer', 'agent', 'admin')`,
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
