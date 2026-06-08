import { Migration } from '@mikro-orm/migrations';

export class Migration20260608_AddPayOutBatch extends Migration {

  override async up(): Promise<void> {
    this.addSql(`create table \`pay_out_batches\` (\`uuid\` varchar(255) not null, \`created_at\` datetime not null default CURRENT_TIMESTAMP, \`updated_at\` datetime not null default CURRENT_TIMESTAMP, \`deleted_at\` datetime null, \`user\` varchar(255) null, \`total_amount\` decimal(10,2) null default 0, \`status\` varchar(255) null default 'pending', \`transfer_code\` varchar(255) null, \`reference\` varchar(255) null, \`provider_reference\` varchar(255) null, \`metadata\` longtext null, \`currency\` enum('NGN') not null default 'NGN', primary key (\`uuid\`)) default character set utf8mb4 engine = InnoDB;`);
    this.addSql(`alter table \`pay_out_batches\` add index \`pay_out_batches_user_index\`(\`user\`);`);
    this.addSql(`alter table \`pay_out_batches\` add constraint \`pay_out_batches_user_foreign\` foreign key (\`user\`) references \`users\` (\`uuid\`) on update cascade on delete set null;`);

    this.addSql(`alter table \`pay_outs\` add \`batch\` varchar(255) null;`);
    this.addSql(`alter table \`pay_outs\` add index \`pay_outs_batch_index\`(\`batch\`);`);
    this.addSql(`alter table \`pay_outs\` add constraint \`pay_outs_batch_foreign\` foreign key (\`batch\`) references \`pay_out_batches\` (\`uuid\`) on update cascade on delete set null;`);
  }

  override async down(): Promise<void> {
    this.addSql(`alter table \`pay_outs\` drop foreign key \`pay_outs_batch_foreign\`;`);
    this.addSql(`alter table \`pay_outs\` drop index \`pay_outs_batch_index\`;`);
    this.addSql(`alter table \`pay_outs\` drop column \`batch\`;`);

    this.addSql(`drop table if exists \`pay_out_batches\`;`);
  }

}
