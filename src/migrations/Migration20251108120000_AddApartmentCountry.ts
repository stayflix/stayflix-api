import { Migration } from '@mikro-orm/migrations';

export class Migration20251108120000_AddApartmentCountry extends Migration {

  override async up(): Promise<void> {
    this.addSql('alter table `apartments` add `country` varchar(255) null;');
  }

  override async down(): Promise<void> {
    this.addSql('alter table `apartments` drop column `country`;');
  }

}
