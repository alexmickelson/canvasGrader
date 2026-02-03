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
  `postgres://${dbUser}:${dbPassword}@${dbHost}:${dbPort}/${dbName}`,
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
    course_id BIGINT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    canvas_object JSONB NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS enrollments (
    id BIGINT UNIQUE NOT NULL,
    course_id BIGINT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    user_id BIGINT NOT NULL,
    canvas_object JSONB NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS submissions (
    id BIGINT UNIQUE NOT NULL,
    assignment_id BIGINT NOT NULL REFERENCES assignments(id) ON DELETE CASCADE,
    user_id BIGINT NOT NULL,
    canvas_object JSONB NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS submission_attachments (
    id BIGINT UNIQUE NOT NULL,
    submission_id BIGINT NOT NULL REFERENCES submissions(id) ON DELETE CASCADE,
    type TEXT NOT NULL,
    filepath TEXT NOT NULL,
    ai_transcription TEXT
  );

  CREATE TABLE IF NOT EXISTS favorite_courses (
    course_id BIGINT REFERENCES courses(id) ON DELETE CASCADE NOT NULL,
    name TEXT NOT NULL,
    UNIQUE(course_id)
  );

  -- github classroom tables
  CREATE TABLE IF NOT EXISTS github_student_usernames (
    course_id BIGINT REFERENCES courses(id) ON DELETE CASCADE NOT NULL,
    user_id BIGINT NOT NULL,
    github_username TEXT,
    UNIQUE(course_id, user_id)
  );

  CREATE TABLE IF NOT EXISTS github_classroom_courses (
    github_classroom_id BIGINT UNIQUE NOT NULL,
    course_id BIGINT REFERENCES courses(id) ON DELETE CASCADE NOT NULL,
    name TEXT not null,
    url TEXT not null,
    UNIQUE(github_classroom_id, course_id)
  );

  CREATE TABLE IF NOT EXISTS github_classroom_assignments (
    github_classroom_assignment_id BIGINT UNIQUE NOT NULL,
    assignment_id BIGINT REFERENCES assignments(id) ON DELETE CASCADE NOT NULL,
    github_classroom_id BIGINT NOT NULL REFERENCES github_classroom_courses(github_classroom_id) ON DELETE CASCADE,
    name TEXT not null,
    UNIQUE(github_classroom_assignment_id, assignment_id)
  );

  CREATE TABLE IF NOT EXISTS submission_git_repository (
    id SERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL,
    assignment_id BIGINT REFERENCES assignments(id) ON DELETE CASCADE NOT NULL,
    repo_url TEXT NOT NULL,
    repo_path TEXT,
    UNIQUE(user_id, assignment_id)
  );

  CREATE TABLE IF NOT EXISTS rubric_criterion_analysis (
    id SERIAL PRIMARY KEY,
    rubric_criterion_id text NOT NULL,
    submission_id BIGINT REFERENCES submissions(id) ON DELETE CASCADE NOT NULL,
    evaluation_object JSONB NOT NULL
  );

  CREATE TABLE IF NOT EXISTS submission_ai_tasks (
    id SERIAL PRIMARY KEY,
    submission_id BIGINT REFERENCES submissions(id) ON DELETE CASCADE NOT NULL,
    task_object JSONB NOT NULL
  );


  -- not used yet...
  CREATE TABLE IF NOT EXISTS ai_conversations (
    conversation_key TEXT PRIMARY KEY,
    conversation_type TEXT NOT NULL, -- used to tell how to parse conversation result
    related_id BIGINT,
    conversation_messages JSONB NOT NULL,
    conversation_result JSONB
  );
`,
).catch((err) => {
  console.error("Error creating tables:", err);
});
