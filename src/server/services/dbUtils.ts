import pgpromise from "pg-promise";

const pgp = pgpromise({});

const dbUser = process.env.POSTGRES_USER;
const dbPassword = process.env.POSTGRES_PASSWORD;
const dbHost = process.env.POSTGRES_HOST;
const dbPort = process.env.POSTGRES_PORT || "5432";
const dbName = process.env.POSTGRES_DB;

if (!dbUser) {
  throw new Error("POSTGRES_USER environment variable is required");
}
if (!dbPassword) {
  throw new Error("POSTGRES_PASSWORD environment variable is required");
}
if (!dbHost) {
  throw new Error("POSTGRES_HOST environment variable is required");
}
if (!dbName) {
  throw new Error("POSTGRES_DB environment variable is required");
}

export const db = pgp(
  `postgres://${dbUser}:${dbPassword}@${dbHost}:${dbPort}/${dbName}`
);

db.$config.options.error = (err, e) => {
  console.error("Database error:", err);
  if (e && e.query) {
    console.error("Failed query:", e.query);
    if (e.params) {
      console.error("Query parameters:", e.params);
    }
  }
};

// Apply schema on startup
db.none(
  `
  CREATE TABLE IF NOT EXISTS courses (
    id BIGINT UNIQUE NOT NULL,
    term_id BIGINT,
    term_name TEXT,
    canvas_object JSONB NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS assignments (
    id BIGINT UNIQUE NOT NULL,
    course_id BIGINT NOT NULL,
    canvas_object JSONB NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS enrollments (
    id BIGINT UNIQUE NOT NULL,
    course_id BIGINT NOT NULL,
    user_id BIGINT NOT NULL,
    canvas_object JSONB NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS submissions (
    id BIGINT UNIQUE NOT NULL,
    assignment_id BIGINT NOT NULL,
    user_id BIGINT NOT NULL,
    canvas_object JSONB NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS favorite_courses (
    course_id BIGINT REFERENCES courses(id) NOT NULL
  );

  CREATE TABLE IF NOT EXISTS github_usernames (
    course_id BIGINT REFERENCES courses(id) NOT NULL,
    enrollment_id BIGINT REFERENCES enrollments(id) NOT NULL,
    github_username TEXT,
    UNIQUE(course_id, enrollment_id)
  );

`
).catch((err) => {
  console.error("Error creating tables:", err);
});
