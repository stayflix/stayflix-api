import { Migration } from '@mikro-orm/migrations';

export class Migration20250628143026_AdminMigrations extends Migration {

  override async up(): Promise<void> {
    this.addSql(`create table \`admin_users\` (\`uuid\` varchar(255) not null, \`created_at\` datetime not null default CURRENT_TIMESTAMP, \`updated_at\` datetime not null default CURRENT_TIMESTAMP, \`deleted_at\` datetime null, \`fullname\` varchar(255) null, \`email\` varchar(255) null, \`password\` varchar(255) null, primary key (\`uuid\`)) default character set utf8mb4 engine = InnoDB;`);
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists \`admin_users\`;`);
  }

}
