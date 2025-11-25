import { MigrationInterface, QueryRunner } from "typeorm";

export class CreatePaymentStatusLogsTable1764096099871 implements MigrationInterface {
    name = 'CreatePaymentStatusLogsTable1764096099871'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "payment_status_logs" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "payment_id" uuid NOT NULL, "from_status" "public"."payments_status_enum" NOT NULL, "to_status" "public"."payments_status_enum" NOT NULL, "reason" character varying, "triggered_by" character varying, "created_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_18f23ee4b4bb0fef43f310d75d8" PRIMARY KEY ("id"))`);
        await queryRunner.query(`ALTER TABLE "payment_status_logs" ADD CONSTRAINT "FK_74cbd3f4db4ebfcab36da4aafe8" FOREIGN KEY ("payment_id") REFERENCES "payments"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "payment_status_logs" DROP CONSTRAINT "FK_74cbd3f4db4ebfcab36da4aafe8"`);
        await queryRunner.query(`DROP TABLE "payment_status_logs"`);
    }

}
