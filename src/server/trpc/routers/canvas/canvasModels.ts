import z from "zod";

export const CanvasEnrollmentSchema = z.object({
  id: z.number(),
  user_id: z.number(),
  course_id: z.number(),
  type: z.string(),
  enrollment_state: z.string(),
  role: z.string(),
  created_at: z.string(),
  updated_at: z.string(),
  last_activity_at: z.string().nullable().optional(),
  last_attended_at: z.string().nullable().optional(),
  grades: z.record(z.any()).optional(),
  user: z.any().optional(),
});
export type CanvasEnrollment = z.infer<typeof CanvasEnrollmentSchema>;
export const CanvasTermSchema = z.object({
  id: z.coerce.number(),
  name: z.string(),
  start_at: z.coerce.string().nullable().default(null),
  end_at: z.coerce.string().nullable().default(null),
});

export const CanvasCourseSchema = z.object({
  id: z.coerce.number(),
  sis_course_id: z.string().nullable().default(null),
  uuid: z.string(),
  integration_id: z.string().nullable().default(null),
  name: z.string(),
  course_code: z.string(),
  workflow_state: z.enum(["unpublished", "available", "completed", "deleted"]),
  enrollment_term_id: z.coerce.number(),
  created_at: z.coerce.string(),
  start_at: z.coerce.string().nullable().default(null),
  end_at: z.coerce.string().nullable().default(null),
  total_students: z.number().nullable().default(null),
  default_view: z.string(),
  needs_grading_count: z.number().nullable().default(null),
  public_description: z.string().nullable().default(null),
  hide_final_grades: z.boolean(),
  original_record: z.any(),
  access_restricted_by_date: z.boolean().nullable().default(null),
  term: CanvasTermSchema,
});

export type CanvasCourse = z.infer<typeof CanvasCourseSchema>;
export type CanvasTerm = z.infer<typeof CanvasTermSchema>;

export const CanvasAssignmentSchema = z.object({
  id: z.number(),
  name: z.string(),
  description: z.string().nullable().default(null),
  due_at: z.string().nullable().default(null),
  unlock_at: z.string().nullable().default(null),
  lock_at: z.string().nullable().default(null),
  course_id: z.number(),
  html_url: z.string(),
  submission_types: z.array(z.string()),
  has_submitted_submissions: z.boolean(),
  grading_type: z.string(),
  points_possible: z.number().nullable().default(null),
  grading_standard_id: z.number().nullable().default(null),
  published: z.boolean(),
  muted: z.boolean(),
  context_module_id: z.number().nullable().default(null),
});

export type CanvasAssignment = z.infer<typeof CanvasAssignmentSchema>;

export const CanvasSubmissionCommentSchema = z.object({
  id: z.number(),
  author_id: z.number(),
  author_name: z.string().nullable().optional(),
  comment: z.string(),
  created_at: z.string(),
  edited_at: z.string().nullable().optional(),
  media_comment: z.any().nullable().optional(),
  attempt: z.number().nullable().optional(),
  avatar_path: z.string().nullable().optional(),
  attachments: z
    .array(
      z.object({
        id: z.number(),
        folder_id: z.number().nullable().optional(),
        display_name: z.string().nullable().optional(),
        filename: z.string().nullable().optional(),
        uuid: z.string().nullable().optional(),
        upload_status: z.string().nullable().optional(),
        "content-type": z.string().nullable().optional(),
        url: z.string().nullable().optional(),
        size: z.number().nullable().optional(),
        created_at: z.string().nullable().optional(),
        updated_at: z.string().nullable().optional(),
        unlock_at: z.string().nullable().optional(),
        locked: z.boolean().nullable().optional(),
        hidden: z.boolean().nullable().optional(),
        lock_at: z.string().nullable().optional(),
        hidden_for_user: z.boolean().nullable().optional(),
        thumbnail_url: z.string().nullable().optional(),
        modified_at: z.string().nullable().optional(),
        mime_class: z.string().nullable().optional(),
        media_entry_id: z.string().nullable().optional(),
        category: z.string().nullable().optional(),
        locked_for_user: z.boolean().nullable().optional(),
      })
    )
    .nullable()
    .optional(),
  author: z
    .object({
      id: z.number(),
      anonymous_id: z.string().nullable().optional(),
      display_name: z.string().nullable().optional(),
      avatar_image_url: z.string().nullable().optional(),
      html_url: z.string().nullable().optional(),
      pronouns: z.string().nullable().optional(),
    })
    .nullable()
    .optional(),
});

export const CanvasRubricAssessmentSchema = z.record(
  z.string(), // criterion ID keys like "_1688", "_6165"
  z.object({
    rating_id: z.string().nullable().optional(),
    comments: z.string().nullable().optional(),
    points: z.number().optional(),
  })
);

export const CanvasSubmissionSchema = z.object({
  // Base identifiers
  id: z.number().optional(),
  assignment_id: z.number(),
  user_id: z.number(),

  // Linked resources
  assignment: z.any().nullable().optional(),
  course: z.any().nullable().optional(),

  // Attempt & content
  attempt: z.number().nullable().optional(),
  body: z.string().nullable().optional(),

  // Grading & score
  grade: z.string().nullable().optional(),
  grade_matches_current_submission: z.boolean().nullable().optional(),
  score: z.number().nullable().optional(),
  grader_id: z.number().nullable().optional(),
  graded_at: z.string().nullable().optional(),
  entered_grade: z.string().nullable().optional(),
  entered_score: z.number().nullable().optional(),

  // Links
  html_url: z.string().nullable().optional(),
  preview_url: z.string().nullable().optional(),
  url: z.string().nullable().optional(),

  // Comments & type
  submission_comments: z
    .array(CanvasSubmissionCommentSchema)
    .nullable()
    .optional(),
  submission_html_comments: z
    .array(CanvasSubmissionCommentSchema)
    .nullable()
    .optional(),
  submission_type: z.string().nullable().optional(),

  // Rubric assessment
  rubric_assessment: CanvasRubricAssessmentSchema.nullable().optional(),

  // Timestamps & status
  submitted_at: z.string().nullable().optional(),
  workflow_state: z.string(),
  late: z.boolean().nullable().optional(),
  missing: z.boolean().nullable().optional(),
  late_policy_status: z
    .enum(["late", "missing", "extended", "none"])
    .nullable()
    .optional(),
  points_deducted: z.number().nullable().optional(),
  seconds_late: z.number().nullable().optional(),

  // Visibility & exceptions
  assignment_visible: z.boolean().nullable().optional(),
  excused: z.boolean().nullable().optional(),
  redo_request: z.boolean().nullable().optional(),

  // Additional Canvas fields
  cached_due_date: z.string().nullable().optional(),
  grading_period_id: z.number().nullable().optional(),
  custom_grade_status_id: z.string().nullable().optional(),
  sticker: z.string().nullable().optional(),

  // Misc
  extra_attempts: z.number().nullable().optional(),
  anonymous_id: z.string().nullable().optional(),
  posted_at: z.string().nullable().optional(),
  read_status: z.string().nullable().optional(),

  user: z.object({
    id: z.number(),
    name: z.string(),
    created_at: z.string().nullable().optional(),
    sortable_name: z.string().nullable().optional(),
    short_name: z.string().nullable().optional(),
    sis_user_id: z.string().nullable().optional(),
    integration_id: z.string().nullable().optional(),
    root_account: z.string().nullable().optional(),
    login_id: z.string().nullable().optional(),
    pronouns: z.string().nullable().optional(),
    avatar_url: z.string().nullable().optional(),
  }),
});
export type CanvasSubmission = z.infer<typeof CanvasSubmissionSchema>;

export const CanvasRubricCriterionSchema = z.object({
  id: z.string(),
  description: z.string().optional(),
  long_description: z.string().optional(),
  points: z.number(),
  criterion_use_range: z.boolean().optional(),
  ratings: z.array(
    z.object({
      id: z.string(),
      description: z.string().optional(),
      long_description: z.string().optional(),
      points: z.number(),
    })
  ),
});

export const CanvasRubricSchema = z.object({
  id: z.number(),
  title: z.string(),
  context_id: z.number(),
  context_type: z.string(),
  points_possible: z.number(),
  reusable: z.boolean().optional(),
  read_only: z.boolean().optional(),
  free_form_criterion_comments: z.boolean().nullable().optional(),
  hide_score_total: z.boolean().nullable().optional(),
  data: z.array(CanvasRubricCriterionSchema),
});

export type CanvasRubric = z.infer<typeof CanvasRubricSchema>;
export type CanvasRubricCriterion = z.infer<typeof CanvasRubricCriterionSchema>;
export type CanvasSubmissionComment = z.infer<
  typeof CanvasSubmissionCommentSchema
>;
export type CanvasRubricAssessment = z.infer<
  typeof CanvasRubricAssessmentSchema
>;
