import { Migration } from '@mikro-orm/migrations';

export class Migration20251015235755 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`alter table \`apartments\` modify \`photos\` longtext;`);
  }

  override async down(): Promise<void> {
    this.addSql(`alter table \`apartments\` modify \`photos\` varchar(255);`);
  }

}
