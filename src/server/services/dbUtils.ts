import pgpromise from "pg-promise";
import pgvector from "pgvector/pg-promise";

const pgp = pgpromise({
  async connect(e) {
    await pgvector.registerTypes(e.client);
  },
});
export const db = pgp("postgres://siteuser:postgresewvraer@db:5432/my_db");

db.$config.options.error = (err, e) => {
  console.error("Database error:", err);
  if (e && e.query) {
    console.error("Failed query:", e.query);
    if (e.params) {
      console.error("Query parameters:", e.params);
    }
  }
};

export async function executeReadOnlySQL(
  sql: string,
  parameters: Record<string, unknown> | undefined
) {
  const res = await db.tx(
    { mode: new pgp.txMode.TransactionMode({ readOnly: true }) },
    async (t) => {
      return t.any(sql, parameters ?? {});
    }
  );

  // console.log("result:", res);

  return res;
}

export async function listDbSchema() {
  // Get all table names in the public schema
  const tablesResult = await db.any(`
    SELECT tablename
    FROM pg_catalog.pg_tables
    WHERE schemaname = 'public'
  `);
  const tables = tablesResult.map(
    (row: { tablename: string }) => row.tablename
  );

  // For each table, get its DDL using a custom query
  const ddls = await Promise.all(
    tables.map(async (t) => {
      const [{ ddl }] = await db.any(
        `
        SELECT 'CREATE TABLE ' || tablename || E' (\n' ||
          string_agg('  ' || column_name || ' ' || type || 
            CASE WHEN is_nullable = 'NO' THEN ' NOT NULL' ELSE '' END, E',\n') ||
          E'\n);' as ddl
        FROM (
          SELECT
            c.relname as tablename,
            a.attname as column_name,
            pg_catalog.format_type(a.atttypid, a.atttypmod) as type,
            CASE WHEN a.attnotnull THEN 'NO' ELSE 'YES' END as is_nullable
          FROM pg_class c
            JOIN pg_namespace n ON n.oid = c.relnamespace
            JOIN pg_attribute a ON a.attrelid = c.oid
          WHERE c.relkind = 'r'
            AND c.relname =  $<tableName>
            AND n.nspname = 'public'
            AND a.attnum > 0
            AND NOT a.attisdropped
        ) cols
        GROUP BY tablename
      `,
        { tableName: t }
      );
      return { table: t, ddl };
    })
  );
  return ddls;
}
